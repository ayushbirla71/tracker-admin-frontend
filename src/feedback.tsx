import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal } from './ui';

// ---- toasts ------------------------------------------------------------------------------------
type ToastKind = 'success' | 'error' | 'info' | 'warning';
interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  text?: string;
}

interface FeedbackValue {
  toast: (kind: ToastKind, title: string, text?: string) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

const FeedbackContext = createContext<FeedbackValue | null>(null);
const ICONS = { success: CircleCheck, error: CircleAlert, info: Info, warning: TriangleAlert };

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback(
    (kind: ToastKind, title: string, text?: string) => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-3), { id, kind, title, text }]);
      window.setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4500);
    },
    [dismiss],
  );

  const confirm = useCallback((opts: ConfirmOptions) => new Promise<boolean>((resolve) => setDialog({ ...opts, resolve })), []);
  const answer = (v: boolean) => {
    dialog?.resolve(v);
    setDialog(null);
  };

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}
      <div className="toasts" role="region" aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => {
          const Icon = ICONS[t.kind];
          return (
            <div key={t.id} className={`toast ${t.kind}`}>
              <Icon size={18} />
              <div className="grow">
                <strong>{t.title}</strong>
                {t.text && <div className="muted small">{t.text}</div>}
              </div>
              <button className="icon-btn" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
      {dialog && (
        <Modal
          title={dialog.title}
          onClose={() => answer(false)}
          footer={
            <>
              <button onClick={() => answer(false)}>Cancel</button>
              <button className={dialog.danger ? 'danger-solid' : 'primary'} onClick={() => answer(true)} autoFocus>
                {dialog.confirmLabel ?? 'Confirm'}
              </button>
            </>
          }
        >
          {dialog.message}
        </Modal>
      )}
    </FeedbackContext.Provider>
  );
}

function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('feedback hooks outside FeedbackProvider');
  return ctx;
}

export const useToast = () => {
  const { toast } = useFeedback();
  return toast;
};
export const useConfirm = () => useFeedback().confirm;

/** Shows a toast for any error thrown by a mutation / query. */
export function useErrorToast() {
  const toast = useToast();
  return useCallback((err: unknown) => toast('error', 'Something went wrong', err instanceof Error ? err.message : String(err)), [toast]);
}

/** Re-renders on an interval so "5m ago" labels stay fresh. */
export function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
