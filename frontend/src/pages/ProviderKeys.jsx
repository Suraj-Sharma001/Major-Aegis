import { useState } from 'react';
import { KeyRound, Lock, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage, providerKeysApi } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { Badge, ConfirmDialog, EmptyState, ErrorState, Field, Modal, PageHeader, Skeleton, Spinner } from '../components/ui';
import { fmtDate, PROVIDER_LABEL } from '../lib/format';

const PROVIDERS = ['OPENAI', 'CLAUDE', 'GEMINI'];

export default function ProviderKeys() {
  const keys = useAsync(() => providerKeysApi.list());
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ provider: 'OPENAI', label: '', apiKey: '' });
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const list = keys.data?.keys || [];

  const submit = async (e) => {
    e.preventDefault();
    if (form.apiKey.trim().length < 8) return toast.error('That API key looks too short');
    setBusy(true);
    try {
      await providerKeysApi.add({ provider: form.provider, label: form.label.trim() || 'default', apiKey: form.apiKey.trim() });
      toast.success(`${PROVIDER_LABEL[form.provider]} key saved`);
      setForm({ provider: 'OPENAI', label: '', apiKey: '' });
      setAdding(false);
      keys.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    try {
      await providerKeysApi.remove(removing.id);
      toast.success('Provider key deleted');
      keys.reload();
    } catch (err) {
      toast.error(errorMessage(err));
      throw err;
    }
  };

  return (
    <>
      <PageHeader
        title="Provider keys"
        description="Bring your own keys. The gateway uses your organization's active key for each provider, stored encrypted."
        actions={<button className="btn-primary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add key</button>}
      />

      <div className="flex gap-3 rounded-xl bg-sunken p-4 mb-6 text-sm text-muted">
        <Lock className="h-4 w-4 mt-0.5 shrink-0 text-accent" />
        <p>Keys are encrypted with AES-256-GCM and never shown again after you save them. Adding a new key for a provider makes it the active one and deactivates the previous key. Ollama models run locally and need no key.</p>
      </div>

      {keys.error ? (
        <ErrorState message={keys.error} onRetry={keys.reload} />
      ) : (
        <div className="card overflow-hidden">
          {keys.loading ? (
            <div className="p-4 space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : list.length === 0 ? (
            <EmptyState icon={KeyRound} title="No provider keys" description="Add a key for OpenAI, Claude or Gemini to start routing requests." action={<button className="btn-primary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add key</button>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead><tr><th className="th">Provider</th><th className="th">Label</th><th className="th">Key</th><th className="th">Status</th><th className="th">Added</th><th className="th" /></tr></thead>
                <tbody>
                  {list.map((k) => (
                    <tr key={k.id}>
                      <td className="td font-medium">{PROVIDER_LABEL[k.provider]}</td>
                      <td className="td text-muted">{k.label}</td>
                      <td className="td font-mono text-xs text-muted">{k.keyHint}</td>
                      <td className="td">{k.isActive ? <Badge tone="ok">Active</Badge> : <Badge>Replaced</Badge>}</td>
                      <td className="td text-muted">{fmtDate(k.createdAt)}</td>
                      <td className="td text-right"><button className="btn-quiet !h-8 hover:!text-danger" onClick={() => setRemoving(k)}><Trash2 className="h-4 w-4" /> Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add provider key">
        <form onSubmit={submit} className="space-y-4" autoComplete="off">
          <Field label="Provider">
            <select className="input" value={form.provider} onChange={set('provider')}>
              {PROVIDERS.map((p) => <option key={p} value={p}>{PROVIDER_LABEL[p]}</option>)}
            </select>
          </Field>
          <Field label="Label" hint="Optional, for your own reference."><input className="input" placeholder="default" value={form.label} onChange={set('label')} /></Field>
          <Field label="API key"><input className="input font-mono" type="password" autoComplete="new-password" placeholder="Paste your key" value={form.apiKey} onChange={set('apiKey')} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
            <button className="btn-primary" disabled={busy}>{busy && <Spinner />} Save key</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!removing} onClose={() => setRemoving(null)} onConfirm={remove}
        title="Delete this provider key?"
        description={`Requests to ${removing ? PROVIDER_LABEL[removing.provider] : ''} will fail until you add another key.`}
      />
    </>
  );
}
