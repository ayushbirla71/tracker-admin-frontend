import { format } from 'date-fns';
import { useState } from 'react';
import type { SegmentType, Timeline } from '../api';
import { formatDateTime, formatDuration } from '../format';

/** Workers reporting per hour over the last 24h. Hours without data are drawn as empty slots. */
export function HourlyChart({ data }: { data: { hour: string; workers: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const byHour = new Map(data.map((d) => [new Date(d.hour).getTime(), d.workers]));
  // The server groups by UTC hour, so slots must start on UTC hour boundaries (local ones differ in :30 time zones)
  const endHour = Math.floor(Date.now() / 3600_000) * 3600_000;
  const slots = Array.from({ length: 24 }, (_, i) => {
    const t = endHour - (23 - i) * 3600_000;
    return { t, workers: byHour.get(t) ?? 0 };
  });
  const max = Math.max(1, ...slots.map((s) => s.workers));

  const W = 720;
  const H = 180;
  const pad = { l: 28, r: 8, t: 10, b: 24 };
  const bw = (W - pad.l - pad.r) / slots.length;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);

  const ticks = [0, Math.ceil(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Workers reporting per hour, last 24 hours">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="grid" />
            <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" className="axis">
              {v}
            </text>
          </g>
        ))}
        {slots.map((s, i) => {
          const x = pad.l + i * bw;
          return (
            <g key={s.t} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={x} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
              {s.workers > 0 && <rect x={x + 2} y={y(s.workers)} width={bw - 4} height={H - pad.b - y(s.workers)} rx={3} className={`bar${hover === i ? ' hot' : ''}`} />}
              {i % 4 === 0 && (
                <text x={x + bw / 2} y={H - 6} textAnchor="middle" className="axis">
                  {format(s.t, 'HH:mm')}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <div className="chart-tip">
          {format(slots[hover]!.t, 'dd MMM HH:00')} · <strong>{slots[hover]!.workers}</strong> worker{slots[hover]!.workers === 1 ? '' : 's'} reporting
        </div>
      )}
    </div>
  );
}

const SEGMENT_LABEL: Record<SegmentType, string> = { moving: 'Moving', stopped: 'Stopped', no_signal: 'No signal' };

/** One stacked bar for the whole range: when the worker was moving, stopped, or sending nothing. */
export function TimelineBar({ timeline }: { timeline: Timeline }) {
  const from = new Date(timeline.from).getTime();
  const total = new Date(timeline.to).getTime() - from;
  if (total <= 0) return null;

  return (
    <div>
      <div className="timeline" role="img" aria-label="Activity timeline">
        {timeline.segments.map((s, i) => {
          const start = new Date(s.start).getTime();
          const width = ((new Date(s.end).getTime() - start) / total) * 100;
          return (
            <span
              key={i}
              className={`seg ${s.type}`}
              style={{ width: `${width}%` }}
              title={`${SEGMENT_LABEL[s.type]} · ${formatDateTime(s.start)} → ${formatDateTime(s.end)} (${formatDuration((new Date(s.end).getTime() - start) / 1000)})`}
            />
          );
        })}
      </div>
      <div className="timeline-axis small muted">
        <span>{formatDateTime(timeline.from)}</span>
        <span>{formatDateTime(timeline.to)}</span>
      </div>
      <div className="legend">
        {(Object.keys(SEGMENT_LABEL) as SegmentType[]).map((t) => (
          <span key={t}>
            <i className={`swatch ${t}`} />
            {SEGMENT_LABEL[t]} <strong>{formatDuration(timeline.totals[t])}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}
