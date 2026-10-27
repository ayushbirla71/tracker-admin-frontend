import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Check, MapPinOff, ShieldAlert, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { api, patch, type Device, type Worker } from '../api';
import { useConfirm, useErrorToast, useNow, useToast } from '../feedback';
import { formatDateTime, timeAgo } from '../format';
import { Battery, EmptyState, PageHeader, SkeletonRows, StatusPill } from '../ui';

const NEW_WORKER = 'new';

export default function Devices() {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const onError = useErrorToast();
  const now = useNow();
  const devices = useQuery({ queryKey: ['devices'], queryFn: () => api<Device[]>('/devices'), refetchInterval: 10_000 });
  const workers = useQuery({ queryKey: ['workers'], queryFn: () => api<Worker[]>('/workers') });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) => patch(`/devices/${id}`, body),
    onSuccess: (_d, v) => {
      const s = v.body.status;
      toast('success', s === 'active' ? 'Phone approved' : s === 'blocked' ? 'Phone blocked' : 'Phone updated');
      for (const k of ['devices', 'workers', 'live', 'dashboard']) qc.invalidateQueries({ queryKey: [k] });
    },
    onError,
  });

  const all = devices.data ?? [];
  const pending = all.filter((d) => d.status === 'pending');
  const others = all.filter((d) => d.status !== 'pending');

  const block = async (d: Device) => {
    const ok = await confirm({
      title: 'Block this phone?',
      message: `${d.worker_name ?? d.model ?? 'This phone'} will stop sending locations until you unblock it.`,
      confirmLabel: 'Block phone',
      danger: true,
    });
    if (ok) update.mutate({ id: d.id, body: { status: 'blocked' } });
  };

  return (
    <div className="page">
      <PageHeader title="Devices" subtitle="Each worker phone registers itself with its Android ID. Approve a phone and link it to a worker to start recording." />

      {pending.length > 0 && (
        <section className="stack">
          <h2 className="section-title">
            Waiting for approval <span className="count amber">{pending.length}</span>
          </h2>
          {pending.map((d) => (
            <PendingCard
              key={d.id}
              device={d}
              workers={workers.data ?? []}
              busy={update.isPending}
              onApprove={(body) => update.mutate({ id: d.id, body: { ...body, status: 'active' } })}
              onBlock={() => update.mutate({ id: d.id, body: { status: 'blocked' } })}
            />
          ))}
        </section>
      )}

      <section className="stack">
        <h2 className="section-title">All phones</h2>
        <div className="card table-card">
          {devices.isLoading ? (
            <div className="pad"><SkeletonRows rows={3} /></div>
          ) : others.length === 0 ? (
            <EmptyState icon={Smartphone} title="No approved phones yet" text="Install the app on a worker's phone and open it. It will show up above for approval." />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Worker</th>
                    <th>Phone</th>
                    <th>Health</th>
                    <th>Status</th>
                    <th>Last contact</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {others.map((d) => (
                    <tr key={d.id}>
                      <td>{d.worker_name ? <strong>{d.worker_name}</strong> : <span className="muted">Unassigned</span>}</td>
                      <td>
                        {d.model ?? '-'}
                        <div className="muted small">
                          {d.os}
                          {d.app_version && ` · app ${d.app_version}`}
                        </div>
                        <div className="mono muted">{d.android_id}</div>
                      </td>
                      <td>
                        <div className="health">
                          <Battery level={d.battery} />
                          {d.gps_enabled === false && (
                            <StatusPill tone="red">
                              <MapPinOff size={12} /> GPS off
                            </StatusPill>
                          )}
                          {d.permission_ok === false && (
                            <StatusPill tone="red">
                              <ShieldAlert size={12} /> No permission
                            </StatusPill>
                          )}
                        </div>
                      </td>
                      <td>{d.status === 'active' ? <StatusPill tone="green">Active</StatusPill> : <StatusPill tone="red">Blocked</StatusPill>}</td>
                      <td title={formatDateTime(d.last_seen)}>{timeAgo(d.last_seen, now)}</td>
                      <td className="right">
                        {d.status === 'active' ? (
                          <button className="danger" onClick={() => block(d)}>
                            <Ban size={14} /> Block
                          </button>
                        ) : (
                          <button disabled={d.worker_id == null} title={d.worker_id == null ? 'Assign a worker first' : ''} onClick={() => update.mutate({ id: d.id, body: { status: 'active' } })}>
                            Unblock
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function PendingCard({
  device,
  workers,
  busy,
  onApprove,
  onBlock,
}: {
  device: Device;
  workers: Worker[];
  busy: boolean;
  onApprove: (body: { worker_id?: number; worker_name?: string }) => void;
  onBlock: () => void;
}) {
  const [choice, setChoice] = useState<string>(NEW_WORKER);
  const [name, setName] = useState('');
  const canApprove = choice === NEW_WORKER ? name.trim().length > 0 : true;

  return (
    <div className="card pending-card">
      <span className="stat-icon amber">
        <Smartphone size={20} />
      </span>
      <div className="grow">
        <strong>{device.model ?? 'Unknown phone'}</strong>
        <div className="muted small">
          {device.os} · first seen {formatDateTime(device.first_seen)}
        </div>
        <div className="mono muted">{device.android_id}</div>
      </div>
      <div className="approve-controls">
        <select value={choice} onChange={(e) => setChoice(e.target.value)} aria-label="Assign to worker">
          <option value={NEW_WORKER}>New worker…</option>
          {workers
            .filter((w) => w.active)
            .map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
        </select>
        {choice === NEW_WORKER && <input placeholder="Worker name" value={name} onChange={(e) => setName(e.target.value)} aria-label="New worker name" />}
        <button className="primary" disabled={busy || !canApprove} onClick={() => onApprove(choice === NEW_WORKER ? { worker_name: name.trim() } : { worker_id: Number(choice) })}>
          <Check size={16} /> Approve
        </button>
        <button className="danger" disabled={busy} onClick={onBlock}>
          Block
        </button>
      </div>
    </div>
  );
}
