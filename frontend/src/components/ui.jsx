import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, Copy, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

export const Spinner = ({ className = 'h-4 w-4' }) => <Loader2 className={`animate-spin ${className}`} />;

export const Skeleton = ({ className = '' }) => <div className={`skeleton ${className}`} />;

export function PageHeader({ title, description, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
      <div className="min-w-0">
        <h1 className="text-[26px] leading-8 font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted mt-1 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({ tone = 'neutral', children, className = '' }) {
  const tones = {
    neutral: 'bg-sunken text-muted',
    accent: 'bg-accent/15 text-accent',
    ok: 'bg-ok/15 text-ok',
    saved: 'bg-saved/15 text-saved',
    danger: 'bg-danger/15 text-danger',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center text-center py-14 px-6">
      {Icon && (
        <div className="h-11 w-11 rounded-xl bg-sunken grid place-items-center mb-4">
          <Icon className="h-5 w-5 text-muted" />
        </div>
      )}
      <h3 className="font-medium">{title}</h3>
      {description && <p className="text-sm text-muted mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="card flex flex-col items-center text-center py-12 px-6">
      <div className="h-11 w-11 rounded-xl bg-danger/10 grid place-items-center mb-4">
        <AlertTriangle className="h-5 w-5 text-danger" />
      </div>
      <h3 className="font-medium">Something went wrong</h3>
      <p className="text-sm text-muted mt-1 max-w-md">{message}</p>
      {onRetry && <button className="btn-ghost mt-5" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Field({ label, hint, error, children }) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      {children}
      {hint && !error && <p className="text-xs text-muted mt-1.5">{hint}</p>}
      {error && <p className="text-xs text-danger mt-1.5">{error}</p>}
    </div>
  );
}

export function Modal({ open, onClose, title, description, children, width = 'max-w-md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog" aria-modal="true" aria-label={title}
            className={`relative w-full ${width} card shadow-pop max-h-[90vh] overflow-y-auto`}
            initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }} transition={{ duration: 0.16 }}
          >
            <div className="flex items-start justify-between gap-4 px-6 pt-5">
              <div>
                <h2 className="text-base font-semibold">{title}</h2>
                {description && <p className="text-sm text-muted mt-1">{description}</p>}
              </div>
              <button className="btn-quiet !h-8 !w-8 !p-0 -mr-2" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <div className="px-6 pb-6 pt-4">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// Confirmation dialog. `onConfirm` may be async; the button shows a spinner meanwhile.
export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = 'Delete' }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { await onConfirm(); onClose(); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={title} description={description}>
      <div className="flex justify-end gap-2 pt-2">
        <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn-danger" onClick={run} disabled={busy}>
          {busy && <Spinner />} {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function CopyButton({ text, label = 'Copy', className = 'btn-ghost' }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    } catch {
      toast.error('Could not copy. Select the text and copy it manually.');
    }
  };
  return (
    <button type="button" className={className} onClick={copy}>
      {done ? <Check className="h-4 w-4 text-ok" /> : <Copy className="h-4 w-4" />}
      {done ? 'Copied' : label}
    </button>
  );
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="inline-flex rounded-lg bg-sunken p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`h-8 px-3 rounded-md text-sm font-medium transition-colors ${
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function RoleBadge({ role }) {
  const tone = role === 'ADMIN' ? 'accent' : role === 'DEVELOPER' ? 'neutral' : 'neutral';
  return <Badge tone={tone}>{role.charAt(0) + role.slice(1).toLowerCase()}</Badge>;
}
