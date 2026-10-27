export type Preset = '24h' | '48h' | '7d' | '30d' | 'custom';

export interface RangeValue {
  preset: Preset;
  /** datetime-local strings, only used when preset === 'custom' */
  from: string;
  to: string;
}

const PRESETS: { value: Preset; label: string }[] = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '48h', label: 'Last 48 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom' },
];

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export const defaultRange = (): RangeValue => ({ preset: '24h', from: '', to: '' });

/** Query string understood by the backend's parseRange. Returns null while a custom range is incomplete. */
export function rangeQuery(v: RangeValue): string | null {
  if (v.preset !== 'custom') return `range=${v.preset}`;
  if (!v.from || !v.to) return null;
  const from = new Date(v.from);
  const to = new Date(v.to);
  if (from >= to) return null;
  return `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
}

export function RangePicker({ value, onChange }: { value: RangeValue; onChange: (v: RangeValue) => void }) {
  const select = (preset: Preset) => {
    if (preset === 'custom' && !value.from) {
      const now = new Date();
      onChange({ preset, from: toLocalInput(new Date(now.getTime() - 24 * 3600 * 1000)), to: toLocalInput(now) });
    } else {
      onChange({ ...value, preset });
    }
  };

  return (
    <div className="range-picker">
      <div className="segmented">
        {PRESETS.map((p) => (
          <button key={p.value} className={value.preset === p.value ? 'active' : ''} onClick={() => select(p.value)}>
            {p.label}
          </button>
        ))}
      </div>
      {value.preset === 'custom' && (
        <div className="custom-range">
          <input type="datetime-local" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} />
          <span>to</span>
          <input type="datetime-local" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} />
        </div>
      )}
    </div>
  );
}
