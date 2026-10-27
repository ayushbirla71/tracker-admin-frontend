import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Monitor, Moon, Sun, Trash2, UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api, del, post, type AdminUser } from '../api';
import { useConfirm, useErrorToast, useToast } from '../feedback';
import { formatDateTime } from '../format';
import { useTheme, type ThemeChoice } from '../theme';
import { Modal, PageHeader, SkeletonRows } from '../ui';

export default function Settings() {
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<AdminUser>('/auth/me') });
  const isSystem = me.data?.is_system === true;
  return (
    <div className="page narrow">
      <PageHeader title="Settings" subtitle="Appearance, your password and who can sign in" />
      <Appearance />
      {me.data && (isSystem ? <Password /> : <PasswordManaged />)}
      {me.data && <Admins me={me.data} />}
    </div>
  );
}

/** Admins created from the website can't change their own password: the system admin sets it. */
function PasswordManaged() {
  return (
    <section className="card">
      <div className="card-head">
        <h2>Password</h2>
      </div>
      <p className="muted">Your password is managed by the system administrator. Ask them to set a new one if you need it changed.</p>
    </section>
  );
}

function Appearance() {
  const { choice, setChoice } = useTheme();
  const options: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];
  return (
    <section className="card">
      <div className="card-head">
        <h2>Appearance</h2>
      </div>
      <div className="choice-row">
        {options.map(({ value, label, icon: Icon }) => (
          <button key={value} className={`choice${choice === value ? ' active' : ''}`} onClick={() => setChoice(value)}>
            <Icon size={18} /> {label}
          </button>
        ))}
      </div>
    </section>
  );
}

function Password() {
  const toast = useToast();
  const onError = useErrorToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const mismatch = again.length > 0 && next !== again;

  const change = useMutation({
    mutationFn: () => post('/auth/change-password', { current_password: current, new_password: next }),
    onSuccess: () => {
      toast('success', 'Password changed');
      setCurrent('');
      setNext('');
      setAgain('');
    },
    onError,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!mismatch && next.length >= 8) change.mutate();
  };

  return (
    <section className="card">
      <div className="card-head">
        <h2>Change password</h2>
      </div>
      <form className="form-stack" onSubmit={submit}>
        <label>
          Current password
          <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </label>
        <label>
          New password <span className="muted">(at least 8 characters)</span>
          <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </label>
        <label>
          Repeat new password
          <input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} aria-invalid={mismatch} />
          {mismatch && <span className="field-error">Passwords don't match</span>}
        </label>
        <div>
          <button className="primary" disabled={!current || next.length < 8 || mismatch || !again || change.isPending}>
            <KeyRound size={16} /> Update password
          </button>
        </div>
      </form>
    </section>
  );
}

function Admins({ me }: { me: AdminUser }) {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const onError = useErrorToast();
  const admins = useQuery({ queryKey: ['admins'], queryFn: () => api<AdminUser[]>('/admins') });
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState<AdminUser | null>(null);
  const canManage = me.is_system;

  const remove = useMutation({
    mutationFn: (id: number) => del(`/admins/${id}`),
    onSuccess: () => {
      toast('success', 'Admin removed');
      qc.invalidateQueries({ queryKey: ['admins'] });
    },
    onError,
  });

  const askRemove = async (a: AdminUser) => {
    if (await confirm({ title: `Remove ${a.name}?`, message: `${a.email} will no longer be able to sign in.`, confirmLabel: 'Remove', danger: true })) remove.mutate(a.id);
  };

  return (
    <section className="card">
      <div className="card-head">
        <h2>Administrators</h2>
        {canManage && (
          <button onClick={() => setAdding(true)}>
            <UserPlus size={16} /> Add admin
          </button>
        )}
      </div>
      {admins.isLoading ? (
        <SkeletonRows rows={2} />
      ) : (
        <ul className="plain-list">
          {(admins.data ?? []).map((a) => (
            <li key={a.id}>
              <div className="grow">
                <strong>{a.name}</strong> {a.is_system && <span className="pill amber">System admin</span>} {me.id === a.id && <span className="pill blue">You</span>}
                <div className="muted small">
                  {a.email} · added {formatDateTime(a.created_at)}
                </div>
              </div>
              {canManage && !a.is_system && (
                <>
                  <button className="icon-btn" title="Set a new password" aria-label={`Set a new password for ${a.name}`} onClick={() => setResetting(a)}>
                    <KeyRound size={16} />
                  </button>
                  <button className="icon-btn" aria-label={`Remove ${a.name}`} onClick={() => askRemove(a)}>
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {resetting && <ResetPassword admin={resetting} onClose={() => setResetting(null)} />}
      {adding && <AddAdmin onClose={() => setAdding(false)} onDone={() => (setAdding(false), qc.invalidateQueries({ queryKey: ['admins'] }))} />}
    </section>
  );
}

function AddAdmin({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const onError = useErrorToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const create = useMutation({
    mutationFn: () => post('/admins', { name: name.trim(), email: email.trim(), password }),
    onSuccess: () => {
      toast('success', 'Admin added', email.trim());
      onDone();
    },
    onError,
  });
  const valid = name.trim() && /\S+@\S+\.\S+/.test(email) && password.length >= 8;

  return (
    <Modal
      title="Add administrator"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose}>Cancel</button>
          <button className="primary" form="admin-form" disabled={!valid || create.isPending}>
            Add admin
          </button>
        </>
      }
    >
      <form
        id="admin-form"
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) create.mutate();
        }}
      >
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Temporary password <span className="muted">(at least 8 characters)</span>
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
      </form>
    </Modal>
  );
}

function ResetPassword({ admin, onClose }: { admin: AdminUser; onClose: () => void }) {
  const toast = useToast();
  const onError = useErrorToast();
  const [password, setPassword] = useState('');

  const reset = useMutation({
    mutationFn: () => post(`/admins/${admin.id}/password`, { new_password: password }),
    onSuccess: () => {
      toast('success', 'Password updated', `Tell ${admin.name} their new password.`);
      onClose();
    },
    onError,
  });

  return (
    <Modal
      title={`New password for ${admin.name}`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose}>Cancel</button>
          <button className="primary" form="reset-form" disabled={password.length < 8 || reset.isPending}>
            Set password
          </button>
        </>
      }
    >
      <form
        id="reset-form"
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (password.length >= 8) reset.mutate();
        }}
      >
        <p className="muted small">{admin.email} can't change their own password, so you set it here and share it with them.</p>
        <label>
          New password <span className="muted">(at least 8 characters)</span>
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </label>
      </form>
    </Modal>
  );
}
