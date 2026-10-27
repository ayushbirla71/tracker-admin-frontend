import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Download, FileUp, PackageOpen, QrCode, ShieldCheck, Smartphone, Trash2, Upload } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { API_BASE, api, del, post, uploadWithProgress, type AdminUser, type AppRelease } from '../api';
import { useConfirm, useErrorToast, useToast } from '../feedback';
import { formatBytes, formatDateTime } from '../format';
import { EmptyState, Modal, PageHeader, Skeleton } from '../ui';

const base = () => API_BASE.replace(/\/+$/, '');

/** Asks the server for a short-lived link to this release. */
async function createLink(id: number) {
  const { path, expires_at } = await post<{ path: string; expires_at: string }>(`/app/releases/${id}/link`, {});
  return { url: `${base()}${path}`, expiresAt: new Date(expires_at) };
}

export default function MobileApp() {
  const toast = useToast();
  const onError = useErrorToast();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<AdminUser>('/auth/me') });
  const releases = useQuery({ queryKey: ['app-releases'], queryFn: () => api<AppRelease[]>('/app/releases') });
  const [qrFor, setQrFor] = useState<AppRelease | null>(null);
  const canUpload = me.data?.is_system === true;

  const download = async (r: AppRelease) => {
    try {
      const { url } = await createLink(r.id);
      window.location.assign(url); // the server answers with an attachment, so the page stays put and the browser downloads
      toast('success', 'Download started', `${formatBytes(r.size_bytes)} · v${r.version_name}`);
    } catch (err) {
      onError(err);
    }
  };

  const list = releases.data ?? [];
  const latest = list[0];

  return (
    <div className="page">
      <PageHeader title="Mobile app" subtitle="Download the worker app and install it on a phone" />

      {releases.isLoading ? (
        <div className="card">
          <Skeleton height={120} />
        </div>
      ) : latest ? (
        <section className="card release-hero">
          <span className="stat-icon blue big">
            <Smartphone size={28} />
          </span>
          <div className="grow">
            <div className="row-gap">
              <h2>Version {latest.version_name}</h2>
              <span className="pill green">Latest</span>
            </div>
            <div className="muted small">
              {formatBytes(latest.size_bytes)} · uploaded {formatDateTime(latest.created_at)}
              {latest.uploaded_by && ` by ${latest.uploaded_by}`}
            </div>
            {latest.notes && <p className="release-notes">{latest.notes}</p>}
            <Checksum sha={latest.sha256} />
          </div>
          <div className="release-actions">
            <button className="primary" onClick={() => download(latest)}>
              <Download size={16} /> Download APK
            </button>
            <button onClick={() => setQrFor(latest)}>
              <QrCode size={16} /> Install on a phone
            </button>
          </div>
        </section>
      ) : (
        <section className="card">
          <EmptyState icon={PackageOpen} title="No app uploaded yet" text={canUpload ? 'Upload the first build below.' : 'Ask the system administrator to upload the app.'} />
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>How to install</h2>
        </div>
        <ol className="steps">
          <li>
            Open this page on the worker's phone, or press <strong>Install on a phone</strong> and scan the QR code with its camera.
          </li>
          <li>Download the APK. If the phone asks, allow your browser to <strong>install unknown apps</strong> (Settings → Apps → your browser).</li>
          <li>
            Open the downloaded file and tap <strong>Install</strong>, then open the app and allow location <strong>"all the time"</strong>.
          </li>
          <li>
            The phone appears on the <strong>Devices</strong> page. Approve it and link it to a worker to start tracking.
          </li>
        </ol>
      </section>

      {canUpload && <UploadCard hasReleases={list.length > 0} />}

      {list.length > 1 && (
        <section className="card table-card">
          <div className="table-tools">
            <h2>Previous versions</h2>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Uploaded</th>
                  <th>Size</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.slice(1).map((r) => (
                  <ReleaseRow key={r.id} release={r} canDelete={canUpload} onDownload={() => download(r)} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {canUpload && latest && <DeleteLatest release={latest} />}
      {qrFor && <QrModal release={qrFor} onClose={() => setQrFor(null)} />}
    </div>
  );
}

function Checksum({ sha }: { sha: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="checksum small muted" title="SHA-256 of the file. Compare it with the file you uploaded to be sure nothing was altered.">
      <ShieldCheck size={14} /> SHA-256 <span className="mono">{sha.slice(0, 16)}…{sha.slice(-8)}</span>
      <button
        className="icon-btn tiny"
        aria-label="Copy SHA-256"
        onClick={() => {
          navigator.clipboard?.writeText(sha).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </div>
  );
}

function ReleaseRow({ release, canDelete, onDownload }: { release: AppRelease; canDelete: boolean; onDownload: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const onError = useErrorToast();
  const remove = useMutation({
    mutationFn: () => del(`/app/releases/${release.id}`),
    onSuccess: () => {
      toast('success', 'Version deleted');
      qc.invalidateQueries({ queryKey: ['app-releases'] });
    },
    onError,
  });
  return (
    <tr>
      <td>
        <strong>{release.version_name}</strong>
        {release.notes && <div className="muted small clamp">{release.notes}</div>}
      </td>
      <td>{formatDateTime(release.created_at)}</td>
      <td>{formatBytes(release.size_bytes)}</td>
      <td className="right actions">
        <button onClick={onDownload}>
          <Download size={14} /> Download
        </button>
        {canDelete && (
          <button
            className="icon-btn"
            aria-label={`Delete version ${release.version_name}`}
            onClick={async () => (await confirm({ title: `Delete version ${release.version_name}?`, message: 'The file is removed from the server. Phones that already installed it are not affected.', confirmLabel: 'Delete', danger: true })) && remove.mutate()}
          >
            <Trash2 size={16} />
          </button>
        )}
      </td>
    </tr>
  );
}

/** Lets the system admin remove the newest build (e.g. a bad upload) without hunting for a table row. */
function DeleteLatest({ release }: { release: AppRelease }) {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const onError = useErrorToast();
  const remove = useMutation({
    mutationFn: () => del(`/app/releases/${release.id}`),
    onSuccess: () => {
      toast('success', 'Version deleted');
      qc.invalidateQueries({ queryKey: ['app-releases'] });
    },
    onError,
  });
  return (
    <div className="danger-zone">
      <span className="muted small">Uploaded the wrong file?</span>
      <button
        className="danger"
        onClick={async () => (await confirm({ title: `Delete version ${release.version_name}?`, message: 'The file is removed from the server. Phones that already installed it are not affected.', confirmLabel: 'Delete', danger: true })) && remove.mutate()}
      >
        <Trash2 size={14} /> Delete version {release.version_name}
      </button>
    </div>
  );
}

function UploadCard({ hasReleases }: { hasReleases: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState('');
  const [notes, setNotes] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const pick = (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (!/\.apk$/i.test(f.name)) return setError('Choose an .apk file');
    setFile(f);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files[0]);
  };

  const uploading = progress !== null;
  const upload = async () => {
    if (!file || !version.trim()) return;
    setError(null);
    setProgress(0);
    const form = new FormData();
    form.append('version_name', version.trim());
    if (notes.trim()) form.append('notes', notes.trim());
    form.append('file', file); // the file goes last so the server sees the details first
    try {
      await uploadWithProgress<AppRelease>('/app/releases', form, setProgress);
      toast('success', 'App uploaded', `Version ${version.trim()} is now the latest`);
      setFile(null);
      setVersion('');
      setNotes('');
      if (inputRef.current) inputRef.current.value = '';
      qc.invalidateQueries({ queryKey: ['app-releases'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setProgress(null);
    }
  };

  return (
    <section className="card">
      <div className="card-head">
        <h2>{hasReleases ? 'Upload a new version' : 'Upload the first version'}</h2>
        <span className="muted small">Only you (system admin) can upload</span>
      </div>
      <div className="form-stack">
        <div
          className={`dropzone${dragging ? ' over' : ''}${file ? ' has-file' : ''}`}
          onDragOver={(e) => (e.preventDefault(), setDragging(true))}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        >
          <FileUp size={26} />
          {file ? (
            <span>
              <strong>{file.name}</strong> · {formatBytes(file.size)}
            </span>
          ) : (
            <span>
              <strong>Choose the .apk file</strong> or drop it here
            </span>
          )}
          <input ref={inputRef} type="file" accept=".apk,application/vnd.android.package-archive" hidden onChange={(e) => pick(e.target.files?.[0])} />
        </div>
        <div className="two-col">
          <label>
            Version <span className="muted">(e.g. 1.2.0)</span>
            <input value={version} onChange={(e) => setVersion(e.target.value)} maxLength={50} disabled={uploading} />
          </label>
          <label>
            What changed <span className="muted">(optional)</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} disabled={uploading} />
          </label>
        </div>
        {uploading && (
          <div className="progress" role="progressbar" aria-valuenow={Math.round((progress ?? 0) * 100)} aria-valuemin={0} aria-valuemax={100}>
            <i style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
            <span className="small">{progress! >= 1 ? 'Checking the file…' : `Uploading ${Math.round((progress ?? 0) * 100)}%`}</span>
          </div>
        )}
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <div>
          <button className="primary" disabled={!file || !version.trim() || uploading} onClick={upload}>
            <Upload size={16} /> {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </section>
  );
}

function QrModal({ release, onClose }: { release: AppRelease; onClose: () => void }) {
  const onError = useErrorToast();
  const [state, setState] = useState<{ qr: string; url: string; expiresAt: Date } | null>(null);
  const [now, setNow] = useState(Date.now());

  const generate = async () => {
    try {
      const { url, expiresAt } = await createLink(release.id);
      setState({ qr: await QRCode.toDataURL(url, { width: 260, margin: 1 }), url, expiresAt });
    } catch (err) {
      onError(err);
    }
  };
  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const left = state ? Math.max(0, Math.round((state.expiresAt.getTime() - now) / 1000)) : 0;
  const expired = state != null && left === 0;

  return (
    <Modal
      title={`Install version ${release.version_name} on a phone`}
      onClose={onClose}
      footer={
        <>
          <button onClick={generate}>New link</button>
          <button className="primary" onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      <div className="qr-box">
        {state ? <img src={state.qr} alt="QR code to download the app" className={expired ? 'expired' : ''} width={260} height={260} /> : <Skeleton height={260} width={260} />}
        <p className="muted small center">
          Scan with the phone's camera and open the link to download the app.
          <br />
          {state && (expired ? 'This link has expired. Press "New link".' : `The link works for ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} more.`)}
        </p>
        {!/^https:/.test(base()) && (
          <p className="muted small center warn">The server address is not HTTPS, so some phones may warn before downloading. Use the https:// address for the best result.</p>
        )}
      </div>
    </Modal>
  );
}
