import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Search, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, patch, post, type Worker } from '../api';
import { useErrorToast, useNow, useToast } from '../feedback';
import { timeAgo } from '../format';
import { Avatar, Battery, EmptyState, Modal, PageHeader, SkeletonRows, StatusPill } from '../ui';

export default function Workers() {
  const qc = useQueryClient();
  const toast = useToast();
  const onError = useErrorToast();
  const now = useNow();
  const workers = useQuery({ queryKey: ['workers'], queryFn: () => api<Worker[]>('/workers') });
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Worker | 'new' | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['workers'] });
    qc.invalidateQueries({ queryKey: ['live'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const save = useMutation({
    mutationFn: (v: { id?: number; name: string; phone: string }) => (v.id ? patch(`/workers/${v.id}`, { name: v.name, phone: v.phone || null }) : post('/workers', { name: v.name, phone: v.phone || null })),
    onSuccess: (_d, v) => {
      toast('success', v.id ? 'Worker updated' : 'Worker added');
      setEditing(null);
      refresh();
    },
    onError,
  });
  const setActive = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => patch(`/workers/${id}`, { active }),
    onSuccess: (_d, v) => {
      toast('success', v.active ? 'Worker activated' : 'Worker deactivated');
      refresh();
    },
    onError,
  });

  const list = (workers.data ?? []).filter((w) => w.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="page">
      <PageHeader
        title="Workers"
        subtitle="People who carry a tracked phone"
        actions={
          <button className="primary" onClick={() => setEditing('new')}>
            <Plus size={16} /> Add worker
          </button>
        }
      />

      <div className="card table-card">
        <div className="table-tools">
          <div className="search">
            <Search size={16} />
            <input placeholder="Search by name" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search workers" />
          </div>
          <span className="muted small">{list.length} worker{list.length === 1 ? '' : 's'}</span>
        </div>

        {workers.isLoading ? (
          <div className="pad"><SkeletonRows rows={5} /></div>
        ) : list.length === 0 ? (
          <EmptyState icon={Users} title={search ? 'No matches' : 'No workers yet'} text={search ? undefined : 'Workers are created when you approve a phone, or add one here first.'} />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Worker</th>
                  <th>Status</th>
                  <th>Last seen</th>
                  <th>Battery</th>
                  <th>Phones</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((w) => (
                  <tr key={w.id} className={w.active ? '' : 'inactive'}>
                    <td>
                      <Link to={`/workers/${w.id}`} className="person">
                        <Avatar name={w.name} online={w.active ? w.online : undefined} />
                        <span>
                          <strong>{w.name}</strong>
                          <span className="muted small block">{w.phone ?? 'No phone number'}</span>
                        </span>
                      </Link>
                    </td>
                    <td>{!w.active ? <StatusPill tone="gray">Inactive</StatusPill> : w.online ? <StatusPill tone="green">Online</StatusPill> : <StatusPill tone="red">Offline</StatusPill>}</td>
                    <td>{timeAgo(w.last_seen, now)}</td>
                    <td><Battery level={w.battery} /></td>
                    <td>{w.device_count === 0 ? <span className="muted">none</span> : w.device_count}</td>
                    <td className="right actions">
                      <button className="icon-btn" title="Edit" aria-label={`Edit ${w.name}`} onClick={() => setEditing(w)}>
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => setActive.mutate({ id: w.id, active: !w.active })}>{w.active ? 'Deactivate' : 'Activate'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && <WorkerForm worker={editing === 'new' ? null : editing} busy={save.isPending} onClose={() => setEditing(null)} onSave={(v) => save.mutate(v)} />}
    </div>
  );
}

function WorkerForm({ worker, busy, onClose, onSave }: { worker: Worker | null; busy: boolean; onClose: () => void; onSave: (v: { id?: number; name: string; phone: string }) => void }) {
  const [name, setName] = useState(worker?.name ?? '');
  const [phone, setPhone] = useState(worker?.phone ?? '');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) onSave({ id: worker?.id, name: name.trim(), phone: phone.trim() });
  };
  return (
    <Modal
      title={worker ? 'Edit worker' : 'Add worker'}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose}>Cancel</button>
          <button className="primary" form="worker-form" disabled={!name.trim() || busy}>
            {worker ? 'Save changes' : 'Add worker'}
          </button>
        </>
      }
    >
      <form id="worker-form" className="form-stack" onSubmit={submit}>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Ravi Kumar" />
        </label>
        <label>
          Phone number <span className="muted">(optional)</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 ..." inputMode="tel" />
        </label>
      </form>
    </Modal>
  );
}
