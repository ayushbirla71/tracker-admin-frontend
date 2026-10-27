import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Download, Eraser, Crosshair, LayoutDashboard, LogOut, MapPinned, Menu, Monitor, Moon, Settings as SettingsIcon, Smartphone, Sun, Target, Users, FileText } from 'lucide-react';
import { Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAlertActions } from '../alertActions';
import { alertIcon, relativeTime } from '../alertMeta';
import { api, post, type Alert } from '../api';
import { APP_NAME, POWERED_BY } from '../brand';
import { useAuth } from '../auth';
import { useToast } from '../feedback';
import { useLive, useLiveStatus } from '../live';
import { useTheme, type ThemeChoice } from '../theme';
import { Skeleton } from '../ui';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/live', label: 'Live map', icon: MapPinned },
  { to: '/workers', label: 'Workers', icon: Users },
  { to: '/devices', label: 'Devices', icon: Smartphone },
  { to: '/geofences', label: 'Geofences', icon: Target },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/app', label: 'Mobile app', icon: Download },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

const TITLES: Record<string, string> = Object.fromEntries(NAV.map((n) => [n.to, n.label]));

export default function Layout() {
  const { logout } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const connected = useLiveStatus();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => setNavOpen(false), [location.pathname]);

  const unread = useQuery({ queryKey: ['alerts', 'unread'], queryFn: () => api<{ unread: number }>('/alerts/unread-count'), refetchInterval: 60_000 });
  const pendingDevices = useQuery({ queryKey: ['devices'], queryFn: () => api<{ status: string }[]>('/devices'), refetchInterval: 30_000 });
  const pendingCount = (pendingDevices.data ?? []).filter((d) => d.status === 'pending').length;

  useLive((msg) => {
    if (msg.type === 'alert') {
      qc.invalidateQueries({ queryKey: ['alerts'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      const a = msg.alert;
      if (a.severity !== 'info') toast(a.severity === 'critical' ? 'error' : 'warning', a.message);
    } else if (msg.type === 'alert-resolved' || msg.type === 'alerts-cleared') {
      qc.invalidateQueries({ queryKey: ['alerts'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });

  useEffect(() => {
    document.title = APP_NAME;
  }, []);

  const title = TITLES['/' + location.pathname.split('/')[1]] ?? (location.pathname === '/' ? 'Dashboard' : APP_NAME);

  return (
    <div className={`shell${navOpen ? ' nav-open' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Crosshair size={20} />
          </span>
          <div>
            <strong>{APP_NAME}</strong>
            <div className="small">Powered by {POWERED_BY}</div>
          </div>
        </div>
        <nav>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon size={18} />
              <span>{label}</span>
              {to === '/alerts' && (unread.data?.unread ?? 0) > 0 && <span className="count">{unread.data!.unread}</span>}
              {to === '/devices' && pendingCount > 0 && <span className="count amber">{pendingCount}</span>}
            </NavLink>
          ))}
        </nav>
        <button className="signout" onClick={logout}>
          <LogOut size={18} /> Sign out
        </button>
      </aside>
      {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} />}

      <div className="main-col">
        <header className="topbar">
          <button className="icon-btn menu-btn" aria-label="Open menu" onClick={() => setNavOpen(true)}>
            <Menu size={20} />
          </button>
          <h1 className="topbar-title">{title}</h1>
          <span className="grow" />
          <span className={`live-chip ${connected ? 'on' : 'off'}`} title={connected ? 'Receiving live updates' : 'Reconnecting...'}>
            <i /> {connected ? 'Live' : 'Offline'}
          </span>
          <ThemeToggle />
          <NotificationBell unread={unread.data?.unread ?? 0} />
        </header>
        <main>
          <Suspense fallback={<div className="page"><Skeleton height={120} /></div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { choice, setChoice } = useTheme();
  const order: ThemeChoice[] = ['light', 'dark', 'system'];
  const next = order[(order.indexOf(choice) + 1) % order.length]!;
  const Icon = choice === 'light' ? Sun : choice === 'dark' ? Moon : Monitor;
  return (
    <button className="icon-btn" onClick={() => setChoice(next)} title={`Theme: ${choice} (click for ${next})`} aria-label={`Theme: ${choice}`}>
      <Icon size={18} />
    </button>
  );
}

function NotificationBell({ unread }: { unread: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { clear, busy } = useAlertActions();

  const recent = useQuery({ queryKey: ['alerts', 'bell'], queryFn: () => api<Alert[]>('/alerts?limit=8'), enabled: open });

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const markAll = async () => {
    await post('/alerts/read', {});
    qc.invalidateQueries({ queryKey: ['alerts'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  return (
    <div className="bell" ref={ref}>
      <button className="icon-btn" aria-label={`Alerts${unread ? `, ${unread} unread` : ''}`} onClick={() => setOpen((o) => !o)}>
        <Bell size={18} />
        {unread > 0 && <span className="bell-count">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="popover">
          <div className="popover-head">
            <strong>Alerts</strong>
            <span className="popover-actions">
              <button className="link" onClick={markAll} disabled={unread === 0}>
                <CheckCheck size={14} /> Mark all read
              </button>
              <button
                className="link"
                onClick={() => {
                  setOpen(false);
                  clear('all');
                }}
                disabled={busy || recent.data?.length === 0}
              >
                <Eraser size={14} /> Clear all
              </button>
            </span>
          </div>
          <ul>
            {(recent.data ?? []).map((a) => {
              const Icon = alertIcon(a.type);
              return (
                <li key={a.id} className={a.read_at ? '' : 'unread'}>
                  <span className={`alert-icon ${a.severity}`}>
                    <Icon size={16} />
                  </span>
                  <div className="grow">
                    <div>{a.message}</div>
                    <div className="muted small">{relativeTime(a.created_at)}</div>
                  </div>
                </li>
              );
            })}
            {recent.data?.length === 0 && <li className="muted pad">No alerts yet</li>}
          </ul>
          <button
            className="popover-foot"
            onClick={() => {
              setOpen(false);
              navigate('/alerts');
            }}
          >
            View all alerts
          </button>
        </div>
      )}
    </div>
  );
}
