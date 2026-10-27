import { format } from 'date-fns';

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

export const formatDistance = (meters: number) => (meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`);

export const formatDateTime = (iso: string) => format(new Date(iso), 'dd MMM, HH:mm');
export const formatTime = (iso: string) => format(new Date(iso), 'HH:mm:ss');

export function timeAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return 'never';
  const sec = (now - new Date(iso).getTime()) / 1000;
  if (sec < 15) return 'just now';
  return `${formatDuration(sec)} ago`;
}

/** m/s -> km/h */
export const kmh = (mps: number | null) => (mps == null ? '-' : `${Math.round(mps * 3.6)} km/h`);

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}
