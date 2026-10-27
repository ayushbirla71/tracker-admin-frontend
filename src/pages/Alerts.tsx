import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellOff, CheckCheck, Eraser, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAlertActions } from '../alertActions';
import { ALERT_TYPES, alertIcon, alertLabel, relativeTime } from '../alertMeta';
import { api, post, type Alert } from '../api';
import { useErrorToast } from '../feedback';
import { formatDateTime } from '../format';
import { useLive } from '../live';
import { EmptyState, Menu, PageHeader, SkeletonRows, StatusPill } from '../ui';

type Status = 'all' | 'unread' | 'open';

export default function Alerts() {
  const qc = useQueryClient();
  const onError = useErrorToast();
  const [status, setStatus] = useState<Status>('all');
  const [type, setType] = useState('');

  const qs = `status=${status}${type ? `&type=${type}` : ''}&limit=200`;
  const alerts = useQuery({ queryKey: ['alerts', 'list', qs], queryFn: () => api<Alert[]>(`/alerts?${qs}`) });
  useLive((m) => (m.type === 'alert' || m.type === 'alert-resolved' || m.type === 'alerts-cleared') && qc.invalidateQueries({ queryKey: ['alerts'] }));
  const { clear, dismiss, busy } = useAlertActions();

  const markRead = useMutation({
    mutationFn: (ids?: string[]) => post('/alerts/read', ids ? { ids: ids.map(Number) } : {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError,
  });

  const list = alerts.data ?? [];
  const unread = list.filter((a) => !a.read_at).length;

  return (
    <div className="page">
      <PageHeader
        title="Alerts"
        subtitle="Offline workers, low batteries, GPS problems and site arrivals"
        actions={
          <>
            <button onClick={() => markRead.mutate(undefined)} disabled={markRead.isPending}>
              <CheckCheck size={16} /> Mark all as read
            </button>
            <Menu
              label="Clear"
              icon={Eraser}
              disabled={busy}
              items={[
                { label: 'Clear read alerts', hint: 'Keeps unread ones', onSelect: () => clear('read') },
                { label: 'Clear all alerts', hint: 'Ongoing issues stay', danger: true, onSelect: () => clear('all') },
              ]}
            />
          </>
        }
      />

      <div className="toolbar">
        <div className="segmented">
          {(['all', 'unread', 'open'] as Status[]).map((s) => (
            <button key={s} className={status === s ? 'active' : ''} onClick={() => setStatus(s)}>
              {s === 'open' ? 'Ongoing issues' : s[0]!.toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type">
          <option value="">All types</option>
          {ALERT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        {status === 'all' && unread > 0 && <span className="muted small">{unread} unread</span>}
      </div>

      <div className="card">
        {alerts.isLoading ? (
          <SkeletonRows rows={5} />
        ) : list.length === 0 ? (
          <EmptyState icon={BellOff} title="No alerts" text={status === 'open' ? 'No ongoing issues. Everything looks fine.' : 'Nothing to show for this filter.'} />
        ) : (
          <ul className="alert-list roomy">
            {list.map((a) => {
              const Icon = alertIcon(a.type);
              return (
                <li key={a.id} className={a.read_at ? '' : 'unread'} onClick={() => !a.read_at && markRead.mutate([a.id])}>
                  <span className={`alert-icon ${a.severity}`}>
                    <Icon size={18} />
                  </span>
                  <div className="grow">
                    <div>{a.message}</div>
                    <div className="muted small">
                      {alertLabel(a.type)} · <Link to={`/workers/${a.worker_id}`} onClick={(e) => e.stopPropagation()}>{a.worker_name}</Link> · <span title={formatDateTime(a.created_at)}>{relativeTime(a.created_at)}</span>
                    </div>
                  </div>
                  {a.is_condition && (a.resolved_at ? <StatusPill tone="green">Resolved</StatusPill> : <StatusPill tone={a.severity === 'critical' ? 'red' : 'amber'}>Ongoing</StatusPill>)}
                  {!a.read_at && <span className="unread-dot" aria-label="Unread" />}
                  {!(a.is_condition && !a.resolved_at) && (
                    <button
                      className="icon-btn dismiss"
                      title="Dismiss"
                      aria-label="Dismiss this alert"
                      onClick={(e) => {
                        e.stopPropagation();
                        dismiss(a.id);
                      }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {list.some((a) => a.is_condition && !a.resolved_at) && <p className="muted small">Ongoing issues stay in the list until the cause is fixed, then you can dismiss them.</p>}
    </div>
  );
}
