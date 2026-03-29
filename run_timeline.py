import json
import os
import time
from datetime import datetime, timezone
from datasets import load_dataset
from google import genai
from google.genai import types

from extract_timeline import ClinicalEvent, PatientTimeline, ImageCaption, PDFPageImages

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_json")
API_KEY = os.getenv("API_KEY")


def extract_pdf(pdf_path: str) -> tuple[str, str]:
    """Extract (text, encounter_date) from a PDF file using its metadata date."""
    from pypdf import PdfReader
    print(f"Extracting PDF: {pdf_path}")
    reader = PdfReader(pdf_path)

    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    print(f"  Extracted {len(text)} characters from {len(reader.pages)} pages")

    # Try to get creation date from PDF metadata
    encounter_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    meta = reader.metadata
    if meta:
        raw = meta.get("/CreationDate") or meta.get("/ModDate")
        if raw:
            # PDF date format: D:YYYYMMDDHHmmSSOHH'mm' — strip prefix and timezone
            raw = str(raw).lstrip("D:").replace("'", "")
            for fmt, length in [("%Y%m%d%H%M%S", 14), ("%Y%m%d", 8)]:
                try:
                    encounter_date = datetime.strptime(raw[:length], fmt).strftime("%Y-%m-%d")
                    break
                except ValueError:
                    continue
    print(f"  Encounter date: {encounter_date}")
    return text, encounter_date


def transcribe_audio(audio_path: str) -> str:
    """Transcribe an audio file to text using Gemini."""
    print(f"Transcribing audio: {audio_path}")
    client = genai.Client(api_key=API_KEY)

    with open(audio_path, "rb") as f:
        audio_bytes = f.read()

    ext = os.path.splitext(audio_path)[1].lower()
    mime_map = {".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".ogg": "audio/ogg", ".flac": "audio/flac"}
    mime_type = mime_map.get(ext, "audio/mpeg")

    response = client.models.generate_content(
        model="gemini-3.1-pro-preview",
        contents=[
            types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
            "Transcribe this audio recording verbatim.",
        ],
    )
    transcription = response.text
    print(f"  Transcription length: {len(transcription)} characters")
    return transcription


def load_cardiology_sample() -> tuple[str, str]:
    """Return (transcription_text, encounter_date_str) for the first cardiovascular sample."""
    print("Loading MTSamples dataset...")
    dataset = load_dataset("harishnair04/mtsamples", split="train")
    df = dataset.to_pandas()

    mask = df["medical_specialty"].str.contains("Cardiovascular", case=False, na=False)
    cardiology_df = df[mask]

    if cardiology_df.empty:
        raise ValueError("No cardiovascular samples found in MTSamples dataset")

    first_row = cardiology_df.iloc[0]
    transcription = first_row["transcription"]
    specialty = first_row["medical_specialty"].strip()
    encounter_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    print(f"  Specialty: {specialty}")
    print(f"  Transcription length: {len(transcription)} characters")
    return transcription, encounter_date, specialty


IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}


def describe_standalone_image(image_path: str, encounter_date: str) -> list[dict]:
    """Send a standalone image to Gemini and return a ClinicalEvent-style record."""
    print(f"Describing image: {image_path}")
    client = genai.Client(api_key=API_KEY)

    ext = os.path.splitext(image_path)[1].lower()
    mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
                ".gif": "image/gif", ".webp": "image/webp"}
    mime_type = mime_map.get(ext, "image/jpeg")

    with open(image_path, "rb") as f:
        image_bytes = f.read()

    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            f"This is a medical/clinical image. Provide a concise ~5-word caption describing its "
            f"medical relevance, and assign a severity score from 1-5 (1=routine/normal, "
            f"5=critical/life-threatening). Encounter date: {encounter_date}.",
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ImageCaption,
            temperature=0.0,
        ),
    )

    result = response.parsed
    print(f"  Caption: {result.caption!r}  severity={result.severity_score}")

    try:
        dt = datetime.strptime(encounter_date, "%Y-%m-%d").replace(
            hour=12, minute=0, second=0, microsecond=0, tzinfo=timezone.utc
        )
    except ValueError:
        dt = datetime.now(timezone.utc).replace(hour=12, minute=0, second=0, microsecond=0)

    start_ms = int(dt.timestamp() * 1000)
    return [{
        "type": "ClinicalEvent",
        "dataTypeId": 9000,
        "startMs": start_ms,
        "endMs": start_ms + 86_400_000,
        "value": result.severity_score,
        "sourceId": 0,
        "sourceName": f"Image/{os.path.basename(image_path)}",
        "generationType": "AI_EXTRACTED",
        "offsetToUtcMinutes": 0,
        "createdAtMs": int(time.time() * 1000),
        "event_category": "Imaging",
        "event_description": result.caption,
        "timestamp_confidence": "Low",
        "source_text_quote": f"Image file: {os.path.basename(image_path)}",
    }]


def extract_pdf_images(pdf_path: str, encounter_date: str) -> list[dict]:
    """Rasterize each PDF page, find images + captions via Gemini, score each one."""
    try:
        import fitz  # pymupdf
    except ImportError:
        print("  [skip] pymupdf not installed — run: pip install pymupdf")
        return []

    print(f"Extracting images from PDF pages: {pdf_path}")
    client = genai.Client(api_key=API_KEY)
    records = []
    created_at_ms = int(time.time() * 1000)

    try:
        dt = datetime.strptime(encounter_date, "%Y-%m-%d").replace(
            hour=12, minute=0, second=0, microsecond=0, tzinfo=timezone.utc
        )
    except ValueError:
        dt = datetime.now(timezone.utc).replace(hour=12, minute=0, second=0, microsecond=0)
    start_ms = int(dt.timestamp() * 1000)

    doc = fitz.open(pdf_path)
    for page_num, page in enumerate(doc):
        print(f"  Page {page_num + 1}/{len(doc)} — scanning for images...")

        # Rasterize page at 2× zoom (~144 DPI) to PNG bytes
        pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0))
        page_bytes = pix.tobytes("png")

        # Step 1: identify all images on the page with their captions + positions
        r1 = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[
                types.Part.from_bytes(data=page_bytes, mime_type="image/png"),
                "Extract all images (photographs, charts, diagrams, X-rays, scans, etc.) from "
                "this medical document page. For each image provide: (1) any caption or label "
                "text found near it, and (2) its approximate location on the page "
                "(e.g. 'top-left quadrant', 'center', 'bottom-right'). "
                "If no images are present return an empty list.",
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=PDFPageImages,
                temperature=0.0,
            ),
        )
        page_images = r1.parsed
        if not page_images.images:
            print(f"    No images found on page {page_num + 1}")
            continue

        print(f"    Found {len(page_images.images)} image(s) on page {page_num + 1}")

        # Step 2: for each image, send page + caption → get 5-word caption + severity
        for img_info in page_images.images:
            caption_ctx = f" Its caption reads: '{img_info.caption_text}'." if img_info.caption_text else ""
            r2 = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=[
                    types.Part.from_bytes(data=page_bytes, mime_type="image/png"),
                    f"Focus on the image located in the {img_info.bounding_box_description} of "
                    f"this page.{caption_ctx} Provide a concise ~5-word clinical summary caption "
                    f"and assign a severity score from 1-5 (1=routine/normal, "
                    f"5=critical/life-threatening). Encounter date: {encounter_date}.",
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=ImageCaption,
                    temperature=0.0,
                ),
            )
            result = r2.parsed
            print(f"      {img_info.bounding_box_description}: {result.caption!r}  severity={result.severity_score}")

            records.append({
                "type": "ClinicalEvent",
                "dataTypeId": 9000,
                "startMs": start_ms,
                "endMs": start_ms + 86_400_000,
                "value": result.severity_score,
                "sourceId": 0,
                "sourceName": f"PDF-Image/page{page_num + 1}",
                "generationType": "AI_EXTRACTED",
                "offsetToUtcMinutes": 0,
                "createdAtMs": created_at_ms,
                "event_category": "Imaging",
                "event_description": result.caption,
                "timestamp_confidence": "Low",
                "source_text_quote": img_info.caption_text or f"Image on page {page_num + 1}",
            })

    doc.close()
    print(f"  Total image events extracted: {len(records)}")
    return records


def extract_events(transcription: str, encounter_date: str) -> PatientTimeline:
    """Call the Gemini API and return a PatientTimeline."""
    client = genai.Client(api_key=API_KEY)

    prompt = f"""
You are an expert clinical data abstraction AI.
Review the following clinical note and extract a chronological timeline of significant medical,
psychological, and social events.

Current Encounter Date for reference: {encounter_date}.

Clinical Note:
{transcription}
"""

    print("Calling Gemini API...")
    response = client.models.generate_content(
        model="gemini-3.1-pro-preview",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=PatientTimeline,
            temperature=0.0,
        ),
    )
    return response.parsed


def events_to_json_records(timeline: PatientTimeline, specialty: str) -> list[dict]:
    """Convert PatientTimeline to out_json-compatible records."""
    created_at_ms = int(time.time() * 1000)
    records = []

    for event in timeline.extracted_events:
        ts = event.timestamp
        if not ts or ts.lower() == "unknown":
            continue

        # Normalise YYYY-MM to YYYY-MM-01
        if len(ts) == 7:
            ts = ts + "-01"

        try:
            dt = datetime.strptime(ts, "%Y-%m-%d").replace(
                hour=12, minute=0, second=0, microsecond=0, tzinfo=timezone.utc
            )
        except ValueError:
            continue

        start_ms = int(dt.timestamp() * 1000)
        end_ms = start_ms + 86_400_000

        records.append({
            # Standard out_json fields
            "type": "ClinicalEvent",
            "dataTypeId": 9000,
            "startMs": start_ms,
            "endMs": end_ms,
            "value": event.severity_score,
            "sourceId": 0,
            "sourceName": f"MTSamples/{specialty}",
            "generationType": "AI_EXTRACTED",
            "offsetToUtcMinutes": 0,
            "createdAtMs": created_at_ms,
            # Clinical-specific extra fields
            "event_category": event.event_category,
            "event_description": event.event_description,
            "timestamp_confidence": event.timestamp_confidence,
            "source_text_quote": event.source_text_quote,
        })

    return records


def write_output(records: list[dict]) -> None:
    """Write type_clinicalevent.json and update manifest.json."""
    # 1. Write the type file
    type_path = os.path.join(OUT_DIR, "type_clinicalevent.json")
    with open(type_path, "w") as f:
        json.dump(records, f, indent=2)
    print(f"Wrote {len(records)} events → {type_path}")

    # 2. Update manifest.json
    manifest_path = os.path.join(OUT_DIR, "manifest.json")
    with open(manifest_path) as f:
        manifest = json.load(f)

    manifest["countsByType"]["ClinicalEvent"] = len(records)
    manifest["totalRecords"] = sum(manifest["countsByType"].values())

    if records:
        all_start = [r["startMs"] for r in records]
        all_end = [r["endMs"] for r in records]
        manifest["timeBounds"]["minStartMs"] = min(
            manifest["timeBounds"]["minStartMs"], min(all_start)
        )
        manifest["timeBounds"]["maxEndMs"] = max(
            manifest["timeBounds"]["maxEndMs"], max(all_end)
        )

    manifest["files"]["perType"]["ClinicalEvent"] = "type_clinicalevent.json"
    manifest["generatedAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")

    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"Updated manifest → {manifest_path}")


def process_input(input_path: str | None) -> tuple[list[dict], str | None]:
    """Process a single input file (PDF, audio, image) or load the sample dataset.
    Returns (records, pdf_path_or_none)."""
    from db import init_db, insert_document, insert_records
    init_db()

    pdf_path = None

    if input_path is None:
        transcription, encounter_date, specialty = load_cardiology_sample()
        image_records = []
    else:
        input_ext = os.path.splitext(input_path)[1].lower()
        if input_ext == ".pdf":
            pdf_path = input_path
            transcription, encounter_date = extract_pdf(input_path)
            specialty = "PDF"
            image_records = extract_pdf_images(input_path, encounter_date)
        elif input_ext in IMAGE_EXTENSIONS:
            encounter_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            specialty = "Image"
            transcription = None
            image_records = describe_standalone_image(input_path, encounter_date)
        else:
            transcription = transcribe_audio(input_path)
            encounter_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            specialty = "Audio"
            image_records = []

    if transcription:
        timeline = extract_events(transcription, encounter_date)
        print(f"  Extracted {len(timeline.extracted_events)} text events total")
        text_records = events_to_json_records(timeline, specialty)
        print(f"  {len(text_records)} text events have parseable timestamps")
    else:
        text_records = []

    records = text_records + image_records

    # Store the PDF once and link all events to it
    document_id = None
    if pdf_path:
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()
        document_id = insert_document(os.path.basename(pdf_path), pdf_bytes)
        print(f"  PDF stored in DB as document_id={document_id} ({len(pdf_bytes):,} bytes)")

    n = insert_records(records, document_id=document_id)
    print(f"  Persisted to DB: {n} new rows inserted (document_id={document_id})")

    return records, pdf_path


def main():
    import argparse
    parser = argparse.ArgumentParser(
        description="Extract clinical events from medical documents and persist to DB."
    )
    parser.add_argument(
        "inputs",
        nargs="*",
        help="Paths to PDF, audio, or image files. Pass multiple to batch-ingest. "
             "Omit to load the built-in MTSamples cardiology example.",
    )
    args = parser.parse_args()

    inputs = args.inputs or [None]  # None triggers the sample dataset

    all_records: list[dict] = []

    for input_path in inputs:
        label = input_path or "<MTSamples>"
        print(f"\n--- Processing: {label} ---")
        records, _ = process_input(input_path)
        all_records.extend(records)
        print(f"  {len(records)} total events (text + image)")

    # Write all records to JSON (last batch wins for the type file)
    if all_records:
        write_output(all_records)

    print(f"\nDone. {len(all_records)} total events across {len(inputs)} input(s).")
    print("Run plot.py to visualize.")


if __name__ == "__main__":
    main()
