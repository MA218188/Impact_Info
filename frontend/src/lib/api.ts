const API_BASE = "/api";

export interface HealthEvent {
  id: number;
  type: string;
  dataTypeId: number;
  startMs: number;
  endMs: number;
  value: number | null;
  sourceId: number | null;
  sourceName: string | null;
  generationType: string | null;
  offsetToUtcMinutes: number | null;
  createdAtMs: number | null;
  event_category: string | null;
  event_description: string | null;
  timestamp_confidence: string | null;
  source_text_quote: string | null;
  documentId: number | null;
}

export interface Manifest {
  generatedAt: string;
  totalRecords: number;
  timeBounds: { minStartMs: number; maxEndMs: number };
  countsByType: Record<string, number>;
}

export async function fetchEvents(params: {
  type?: string;
  start_ms?: number;
  end_ms?: number;
  limit?: number;
}): Promise<HealthEvent[]> {
  const url = new URL(`${API_BASE}/events`, window.location.origin);
  if (params.type) url.searchParams.set("type", params.type);
  if (params.start_ms != null) url.searchParams.set("start_ms", String(params.start_ms));
  if (params.end_ms != null) url.searchParams.set("end_ms", String(params.end_ms));
  if (params.limit != null) url.searchParams.set("limit", String(params.limit));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  return data.events as HealthEvent[];
}

export async function fetchManifest(): Promise<Manifest> {
  const res = await fetch(`${API_BASE}/manifest`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}
