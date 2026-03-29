#!/usr/bin/env python3
"""FastAPI REST API for health event data.

Run with:
    uvicorn api:app --reload --port 8000
"""
import json
import os
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from db import init_db, query_events, get_type_counts, list_documents, get_document_meta, get_document_content

app = FastAPI(title="Health Events API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_methods=["GET"],
    allow_headers=["*"],
)

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_json")


@app.on_event("startup")
def startup():
    init_db()


@app.get("/events")
def get_events(
    type: Optional[str] = Query(None, description="Filter by event type (e.g. HeartRate)"),
    start_ms: Optional[int] = Query(None, description="Start of time range (epoch ms, inclusive)"),
    end_ms: Optional[int] = Query(None, description="End of time range (epoch ms, inclusive)"),
    document_id: Optional[int] = Query(None, description="Filter by source document ID"),
    limit: Optional[int] = Query(None, ge=1, le=100_000, description="Max records to return"),
):
    """Fetch events with optional type, time-range, and document filters."""
    events = query_events(type_filter=type, start_ms=start_ms, end_ms=end_ms, document_id=document_id, limit=limit)
    return {"count": len(events), "events": events}


@app.get("/events/range")
def get_events_range(
    start_ms: int = Query(..., description="Start of time range (epoch ms, inclusive)"),
    end_ms: int = Query(..., description="End of time range (epoch ms, inclusive)"),
    type: Optional[str] = Query(None, description="Filter by event type"),
):
    """Fetch events within a required time range."""
    if start_ms > end_ms:
        raise HTTPException(status_code=400, detail="start_ms must be <= end_ms")
    events = query_events(type_filter=type, start_ms=start_ms, end_ms=end_ms)
    return {"count": len(events), "events": events}


@app.get("/events/types")
def get_event_types():
    """List all distinct event types with their record counts."""
    return {"types": get_type_counts()}


@app.get("/documents")
def get_documents():
    """List all ingested documents (PDFs etc.) with their IDs and filenames."""
    return {"documents": list_documents()}


@app.get("/documents/{doc_id}")
def download_document(doc_id: int = Path(..., description="Document ID")):
    """Download the raw PDF (or other file) stored for this document."""
    meta = get_document_meta(doc_id)
    if not meta:
        raise HTTPException(status_code=404, detail=f"Document {doc_id} not found")
    content = get_document_content(doc_id)
    filename = meta["filename"]
    media_type = "application/pdf" if filename.lower().endswith(".pdf") else "application/octet-stream"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@app.get("/manifest")
def get_manifest():
    """Return the manifest.json metadata (time bounds, counts by type, etc.)."""
    manifest_path = os.path.join(OUT_DIR, "manifest.json")
    if not os.path.exists(manifest_path):
        raise HTTPException(status_code=404, detail="manifest.json not found — run the pipeline first")
    with open(manifest_path) as f:
        return JSONResponse(content=json.load(f))
