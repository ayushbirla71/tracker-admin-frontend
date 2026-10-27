import { BatteryFull, BatteryLow, BatteryMedium, ChevronDown, X, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="header-actions">{actions}</div>}
    </header>
  );
}

const PALETTE = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#0d9488', '#4f46e5', '#ca8a04', '#0891b2'];

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('') || '?';

/** Stable colour per name so the same worker always looks the same. */
export const colorFor = (name: string) => {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
};

export function Avatar({ name, size = 36, online }: { name: string; size?: number; online?: boolean }) {
  return (
    <span className="avatar" style={{ width: size, height: size, background: colorFor(name), fontSize: size * 0.38 }} aria-hidden>
      {initials(name)}
      {online != null && <span className={`avatar-dot ${online ? 'on' : 'off'}`} />}
    </span>
  );
}

export function StatusPill({ tone, children }: { tone: 'green' | 'red' | 'amber' | 'blue' | 'gray'; children: ReactNode }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export function Battery({ level }: { level: number | null }) {
  if (level == null) return <span className="muted">-</span>;
  const Icon = level <= 15 ? BatteryLow : level <= 50 ? BatteryMedium : BatteryFull;
  return (
    <span className={`battery${level <= 15 ? ' low' : ''}`} title={`Battery ${level}%`}>
      <Icon size={16} />
      {level}%
    </span>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={26} />
      </span>
      <strong>{title}</strong>
      {text && <p className="muted">{text}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ height = 16, width = '100%' }: { height?: number; width?: number | string }) {
  return <span className="skeleton" style={{ height, width }} />;
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="skeleton-rows">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={44} />
      ))}
    </div>
  );
}

export function StatTile({ icon: Icon, label, value, hint, tone = 'blue' }: { icon: LucideIcon; label: string; value: ReactNode; hint?: ReactNode; tone?: 'blue' | 'green' | 'amber' | 'red' | 'violet' }) {
  return (
    <div className="stat-tile">
      <span className={`stat-icon ${tone}`}>
        <Icon size={20} />
      </span>
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-number">{value}</div>
        {hint && <div className="muted small">{hint}</div>}
      </div>
    </div>
  );
}

export function Modal({ title, children, footer, onClose }: { title: string; children: ReactNode; footer?: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export interface MenuItem {
  label: string;
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

/** Button that opens a small list of actions. */
export function Menu({ label, icon: Icon, items, disabled }: { label: string; icon?: LucideIcon; items: MenuItem[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="menu" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} disabled={disabled} aria-haspopup="menu" aria-expanded={open}>
        {Icon && <Icon size={16} />} {label} <ChevronDown size={14} />
      </button>
      {open && (
        <div className="menu-list" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              className={item.danger ? 'danger' : ''}
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              <span>{item.label}</span>
              {item.hint && <span className="muted small">{item.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
