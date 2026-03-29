import os
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

# ---------------------------------------------------------
# 1. Define the exact JSON schema using Pydantic
# Gemini will be forced to adhere strictly to this structure.
# ---------------------------------------------------------
class ClinicalEvent(BaseModel):
    event_category: str = Field(description="Category of the event, e.g., Clinical, Social/Psychological, Procedure.")
    event_description: str = Field(description="A concise description of what happened.")
    timestamp: str = Field(description="The date of the event in YYYY-MM-DD or YYYY-MM format. Calculate absolute dates based on the encounter date if necessary. If totally unknown, use 'Unknown'.")
    timestamp_confidence: str = Field(description="Rate as 'High', 'Medium', or 'Low' based on how explicitly the date was stated in the text.")
    severity_score: int = Field(description="An integer from 1 to 5, where 1 is routine/mild and 5 is life-threatening/severe.")
    source_text_quote: str = Field(description="The exact verbatim quote from the text that justifies this event extraction.")

class PatientTimeline(BaseModel):
    extracted_events: list[ClinicalEvent]


class ImageCaption(BaseModel):
    caption: str = Field(description="A concise ~5-word clinical caption describing the image's medical significance.")
    severity_score: int = Field(description="An integer from 1 to 5, where 1 is routine/normal and 5 is critical/life-threatening.")


class PDFPageImageInfo(BaseModel):
    caption_text: str = Field(description="The caption or label text found near the image on the page, or an empty string if none.")
    bounding_box_description: str = Field(description="Approximate location of the image on the page, e.g. 'top-left quadrant', 'center', 'bottom-right'.")


class PDFPageImages(BaseModel):
    images: list[PDFPageImageInfo]

if __name__ == "__main__":
    # ---------------------------------------------------------
    # 2. Initialize the Gemini Client
    # ---------------------------------------------------------
    # It automatically picks up the GEMINI_API_KEY environment variable
    client = genai.Client(api_key=os.get_env("API_KEY"))

    # ---------------------------------------------------------
    # 3. Prepare the Input Data
    # ---------------------------------------------------------
    # A messy, realistic narrative similar to what you'll find in MTSamples
    sample_clinical_note = """
CHIEF COMPLAINT: Chest pain and shortness of breath.
HISTORY OF PRESENT ILLNESS: The patient is a 55-year-old male who presents to the ER today,
October 12th, 2023, with severe crushing chest pain that began 2 hours ago.
He reports a history of hypertension diagnosed in 2015.
He also mentions his father passed away from a massive heart attack
back in November 2021, which has caused him significant anxiety lately.
"""

    # Construct the prompt, injecting the current encounter date to help with relative time math
    prompt = f"""
You are an expert clinical data abstraction AI.
Review the following clinical note and extract a chronological timeline of significant medical,
psychological, and social events.

Current Encounter Date for reference: 2023-10-12.

Clinical Note:
{sample_clinical_note}
"""

    # ---------------------------------------------------------
    # 4. Call the API with Structured Outputs Enabled
    # ---------------------------------------------------------
    print("Analyzing clinical note and extracting timeline...")

    response = client.models.generate_content(
        model="gemini-3.1-pro-preview", # The flagship model, great for complex medical reasoning
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=PatientTimeline,
            temperature=0.0, # Keep temperature at 0 to maximize factual extraction and minimize hallucinations
        ),
    )

    # ---------------------------------------------------------
    # 5. Parse and Print the Output
    # ---------------------------------------------------------
    # Because we used Structured Outputs, response.parsed is automatically
    # converted back into our PatientTimeline Pydantic object!
    timeline = response.parsed

    print("\n--- EXTRACTED PATIENT TIMELINE ---\n")
    for event in timeline.extracted_events:
        print(f"[{event.timestamp}] {event.event_category} (Severity: {event.severity_score}/5)")
        print(f"↳ Description: {event.event_description}")
        print(f"↳ Confidence:  {event.timestamp_confidence}")
        print(f"↳ Quote:       '{event.source_text_quote}'\n")
