export const API_BASE: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const TOKEN_KEY = 'tracker.token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string | null) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function send(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const token = getToken();
  if (token) headers.set('authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    if (res.status === 401 && token) {
      setToken(null);
      window.dispatchEvent(new Event('auth:logout'));
    }
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? `request failed (${res.status})`);
  }
  return res;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await send(path, init);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const post = <T>(path: string, body: unknown) => api<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const patch = <T>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const del = (path: string) => api<void>(path, { method: 'DELETE' });

/** Downloads an authenticated CSV endpoint (a plain <a href> can't send the bearer token). */
export async function downloadFile(path: string, filename: string) {
  const res = await send(path);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---- types -------------------------------------------------------------------------------------
export interface LiveWorker {
  worker_id: number;
  name: string;
  phone: string | null;
  recorded_at: string | null;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  battery: number | null;
  online: boolean;
  stationary_since: string | null;
}

export interface TrackPoint {
  recorded_at: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  speed: number | null;
  battery: number | null;
}

export interface WorkerStats {
  worker_id: number;
  name: string;
  points: number;
  distance_m: number;
  stays: number;
  stay_seconds: number;
  first_seen: string | null;
  last_seen: string | null;
}

export interface TrackResponse {
  from: string;
  to: string;
  stats: WorkerStats | null;
  points: TrackPoint[];
}

export interface Stay {
  id: string;
  start_at: string;
  end_at: string;
  lat: number;
  lng: number;
  point_count: number;
  address: string | null;
  duration_s: number;
  ongoing: boolean;
}

export interface Worker {
  id: number;
  name: string;
  phone: string | null;
  active: boolean;
  device_count: number;
  last_seen: string | null;
  battery: number | null;
  online: boolean;
}

export interface Device {
  id: number;
  android_id: string;
  status: 'pending' | 'active' | 'blocked';
  model: string | null;
  os: string | null;
  app_version: string | null;
  first_seen: string;
  last_seen: string;
  battery: number | null;
  gps_enabled: boolean | null;
  permission_ok: boolean | null;
  last_heartbeat: string | null;
  worker_id: number | null;
  worker_name: string | null;
}

export interface Geofence {
  id: number;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
}

export interface GeofenceEvent {
  id: string;
  type: 'enter' | 'exit';
  at: string;
  worker_id: number;
  worker_name: string;
  geofence_id: number;
  geofence_name: string;
}

export interface Summary {
  from: string;
  to: string;
  workers: WorkerStats[];
}

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  type: string;
  severity: AlertSeverity;
  message: string;
  is_condition: boolean;
  created_at: string;
  read_at: string | null;
  resolved_at: string | null;
  worker_id: number;
  worker_name: string;
}

export interface Dashboard {
  workers: { total: number; online: number; offline: number; never_reported: number };
  pending_devices: number;
  last24h: { distance_m: number; stops: number; stay_seconds: number; active_workers: number };
  top_distance: { worker_id: number; name: string; distance_m: number; stays: number }[];
  hourly: { hour: string; workers: number }[];
  recent_alerts: Alert[];
  unread_alerts: number;
}

export type SegmentType = 'moving' | 'stopped' | 'no_signal';

export interface Timeline {
  from: string;
  to: string;
  segments: { type: SegmentType; start: string; end: string }[];
  totals: Record<SegmentType, number>;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  is_system: boolean;
  created_at: string;
}

export interface AppRelease {
  id: number;
  version_name: string;
  notes: string | null;
  size_bytes: number;
  sha256: string;
  created_at: string;
  uploaded_by: string | null;
}

/** Multipart upload with progress (fetch can't report upload progress). */
export function uploadWithProgress<T>(path: string, form: FormData, onProgress: (fraction: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}${path}`);
    const token = getToken();
    if (token) xhr.setRequestHeader('authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onerror = () => reject(new Error('Upload failed: cannot reach the server'));
    xhr.onabort = () => reject(new Error('Upload cancelled'));
    xhr.onload = () => {
      let body: { error?: string } | null = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* not JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as T);
      else reject(new ApiError(xhr.status, body?.error ?? `Upload failed (${xhr.status})`));
    };
    xhr.send(form);
  });
}
