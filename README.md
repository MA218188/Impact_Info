# Impact Info

Impact Info is a medtech hackathon prototype that brings wearable data, clinical documents, and AI-extracted findings into a single patient timeline view.

The goal of the project is to show how fragmented health information can be made easier to interpret for clinicians: continuous sensor streams, PDFs/images, and structured clinical events are combined into one dashboard with lightweight alerting and summarization.

## What the prototype does

- Visualizes wearable and sensor data in a React dashboard
- Shows a patient timeline with visits, medications, labs, imaging, notes, and alerts
- Exposes health event data through a FastAPI backend
- Stores ingested events and source documents in SQLite
- Includes scripts to convert wearable exports into JSON and import them into the database
- Includes experimental AI pipelines for extracting timeline events from PDFs, images, and audio

## Repository structure

### `frontend/`

The frontend is a Vite + React + TypeScript application styled with Tailwind and shadcn/ui components.

Key behavior in the current prototype:

- `src/pages/Index.tsx` builds the main dashboard layout
- `src/components/dashboard/SensorCharts.tsx` renders wearable metrics such as heart rate, SpO2, steps, sleep, distance, and rule-based alert bands
- `src/components/dashboard/Timeline.tsx` renders the longitudinal clinical timeline
- `src/components/dashboard/PatientSidebar.tsx` provides patient selection and layer toggles
- `src/components/dashboard/PatientHeader.tsx` shows summary KPIs and alert badges
- `src/components/dashboard/AIFooter.tsx` displays an AI-style clinical summary panel
- `src/lib/api.ts` connects the frontend to the backend API under `/api`

The first patient in the UI is backed by real example wearable data; the other patients are currently mock/demo records used to illustrate the interface.

### `backend/`

The backend is a lightweight FastAPI service plus a SQLite persistence layer.

Main files:

- `api.py` exposes endpoints for events, event types, document listing/download, and the manifest
- `db.py` defines the SQLite schema and handles inserts/queries for `health_events` and `documents`
- `run_timeline.py` is an experimental ingestion script that can extract structured clinical events from PDFs, images, audio, or a sample clinical dataset using Gemini
- `extract_timeline.py` defines the Pydantic schemas used for AI-based structured extraction
- `scripts/convert_withings_csv_to_json.py` converts a wearable export CSV into JSON files and a manifest
- `scripts/import_json_to_db.py` bulk-loads the generated JSON files into SQLite
- `scripts/create_example_epa.py` generates an example German ePA-style radiology PDF with an embedded image

### `data/`

This folder contains the sample inputs and generated outputs used by the prototype.

- `data/raw/`
  - Example wearable export CSV
  - Example radiology PDFs
  - Example MRI image
- `data/out_json/`
  - Generated JSON event files by type
  - `manifest.json` with record counts and time bounds
  - Combined event export
- `data/archive/`
  - Additional CSV files for demographic, medication, lab, diet, examination, and questionnaire data

## Included example data

The repository already contains a processed wearable dataset in `data/out_json/manifest.json`.

Current sample contents include:

- 22,244 total records
- Wearable metrics such as heart rate, SpO2, steps, blood pressure, sleep state, and activity
- 1 `ClinicalEvent` record
- Time range from February 22, 2026 to March 30, 2026

This makes the repository usable as a demo without having to ingest fresh data first.

## Architecture summary

1. Raw wearable or document data is placed in `data/raw/`
2. Conversion/extraction scripts transform that data into structured JSON events
3. Events are stored in SQLite through the backend import layer
4. The FastAPI service exposes those events to the frontend
5. The React dashboard visualizes the data as sensor charts, a clinical timeline, and AI-style insights

## Tech stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Recharts, TanStack Query
- Backend: Python, FastAPI, SQLite
- AI extraction experiments: Google Gemini, Pydantic structured outputs
- Data processing: CSV to JSON conversion, manifest generation, SQLite import

## Running the prototype locally

### Frontend

From `frontend/`:

```bash
npm install
npm run dev
```

The frontend runs on `http://localhost:8080` and proxies API requests to port `8000`.

### Backend

From `backend/`:

```bash
uvicorn api:app --reload --port 8000
```

Note: backend Python dependencies are not pinned in a `requirements.txt` file in this repository, so they need to be installed manually based on the imported packages.


## Why this project matters

Impact Info demonstrates a practical medtech idea: instead of forcing clinicians to inspect raw wearable feeds, isolated PDFs, and scattered notes separately, the system tries to surface the clinically relevant story in a single timeline.
