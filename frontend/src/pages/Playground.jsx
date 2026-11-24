/*import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eraser, SendHorizontal, SquareTerminal } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage, gatewayApi } from '../services/api';
import { Badge, Field, PageHeader, Spinner } from '../components/ui';
import { keyVault } from '../lib/keyVault';
import { fmtMs, fmtUsd, PROVIDER_LABEL } from '../lib/format';

const MODEL_HINTS = ['gemini-2.5-flash', 'gpt-4o-mini', 'claude-haiku-4-5', 'llama3.2'];

function Meta({ r }) {
  const tone = r.cache_status === 'hit' ? 'accent' : r.cache_status === 'miss' ? 'neutral' : 'saved';
  const label = { hit: 'Cache hit', miss: 'Cache miss', unavailable: 'Cache unavailable', disabled: 'Cache disabled', bypass: 'Cache bypassed' }[r.cache_status] || r.cache_status;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2 text-xs text-muted">
      <Badge tone={tone}>{label}</Badge>
      {r.similarity_score != null && <span>similarity <b className="text-ink num">{r.similarity_score}</b></span>}
      <span>{PROVIDER_LABEL[r.provider]} · {r.model}</span>
      <span className="num">{fmtMs(r.latency_ms)}</span>
      <span className="num">{r.usage.total_tokens} tokens</span>
      <span className="num">cost {fmtUsd(r.cost_usd)}</span>
      {r.saved_usd != null && <span className="num text-saved">saved {fmtUsd(r.saved_usd)}</span>}
      {r.cache_debug && <span className="num" title="Closest cached entry seen on this miss (dev mode only)">closest {r.cache_debug.best_similarity} / overlap {r.cache_debug.best_keyword_overlap}</span>}
    </div>
  );
}

export default function Playground() {
  const [saved, setSaved] = useState(() => keyVault.list());
  const [keyId, setKeyId] = useState(saved[0]?.id || 'manual');
  const [manualKey, setManualKey] = useState('');
  const [model, setModel] = useState('gemini-3.5-flash');
  const [system, setSystem] = useState('');
  const [temperature, setTemperature] = useState('');
  const [maxTokens, setMaxTokens] = useState('');
  const [input, setInput] = useState('');
  const [chat, setChat] = useState([]); // { role, content, meta?, error? }
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [chat, busy]);
  useEffect(() => { setSaved(keyVault.list()); }, []);

  const apiKey = useMemo(() => (keyId === 'manual' ? manualKey.trim() : saved.find((k) => k.id === keyId)?.key || ''), [keyId, manualKey, saved]);

  const send = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    if (!apiKey) return toast.error('Choose or paste a gateway key first');
    if (!model.trim()) return toast.error('Enter a model name');

    const history = [...chat.filter((m) => !m.error), { role: 'user', content: text }];
    setChat((c) => [...c, { role: 'user', content: text }]);
    setInput('');
    setBusy(true);

    const body = {
      model: model.trim(),
      messages: [...(system.trim() ? [{ role: 'system', content: system.trim() }] : []), ...history.map(({ role, content }) => ({ role, content }))],
    };
    if (temperature !== '') body.temperature = Number(temperature);
    if (maxTokens !== '') body.max_tokens = Number(maxTokens);

    try {
      const r = await gatewayApi.chat(apiKey, body);
      setChat((c) => [...c, { role: 'assistant', content: r.content, meta: r }]);
    } catch (err) {
      setChat((c) => [...c, { role: 'assistant', error: errorMessage(err) }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Playground"
        description="Send real requests through the gateway. Ask the same question twice to see the semantic cache answer the second one."
        actions={chat.length > 0 && <button className="btn-ghost" onClick={() => setChat([])}><Eraser className="h-4 w-4" /> Clear chat</button>}
      />

      <div className="grid lg:grid-cols-[300px_1fr] gap-6 items-start">
        <div className="card p-5 space-y-4 lg:sticky lg:top-24">
          <Field label="Gateway key" hint={saved.length === 0 ? 'Keys are only shown once when created. Create one on an application, or paste an existing key.' : undefined}>
            <select className="input" value={keyId} onChange={(e) => setKeyId(e.target.value)}>
              {saved.map((k) => <option key={k.id} value={k.id}>{k.appName} · {k.label}</option>)}
              <option value="manual">Paste a key…</option>
            </select>
          </Field>
          {keyId === 'manual' && (
            <input className="input font-mono" type="password" autoComplete="off" placeholder="aegis_…" value={manualKey} onChange={(e) => setManualKey(e.target.value)} />
          )}
          <Field label="Model" hint="gpt* → OpenAI, claude* → Claude, gemini* → Gemini, anything else → Ollama.">
            <input className="input font-mono text-[13px]" list="model-hints" value={model} onChange={(e) => setModel(e.target.value)} />
            <datalist id="model-hints">{MODEL_HINTS.map((m) => <option key={m} value={m} />)}</datalist>
          </Field>
          <Field label="System prompt" hint="Optional."><textarea className="input" rows={3} value={system} onChange={(e) => setSystem(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Temperature"><input className="input" type="number" min="0" max="2" step="0.1" placeholder="auto" value={temperature} onChange={(e) => setTemperature(e.target.value)} /></Field>
            <Field label="Max tokens"><input className="input" type="number" min="1" step="1" placeholder="auto" value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} /></Field>
          </div>
          <Link to="/applications" className="block text-sm text-accent hover:underline">Manage applications and keys</Link>
        </div>

        <div className="card flex flex-col min-h-[520px]">
          <div className="flex-1 p-5 space-y-5 overflow-y-auto max-h-[62vh]">
            {chat.length === 0 && !busy && (
              <div className="h-full min-h-[380px] grid place-items-center text-center">
                <div>
                  <div className="h-11 w-11 rounded-xl bg-sunken grid place-items-center mx-auto mb-4"><SquareTerminal className="h-5 w-5 text-muted" /></div>
                  <p className="font-medium">Send your first request</p>
                  <p className="text-sm text-muted mt-1 max-w-xs mx-auto">Each message goes to <code className="font-mono text-xs">/v1/chat/completions</code> with the selected key.</p>
                </div>
              </div>
            )}
            {chat.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-accent text-accent-ink px-4 py-2.5 text-sm whitespace-pre-wrap">{m.content}</p>
                </div>
              ) : (
                <div key={i} className="max-w-[92%]">
                  {m.error ? (
                    <p className="rounded-2xl rounded-bl-md bg-danger/10 text-danger px-4 py-2.5 text-sm">{m.error}</p>
                  ) : (
                    <>
                      <p className="rounded-2xl rounded-bl-md bg-sunken px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed">{m.content}</p>
                      <Meta r={m.meta} />
                    </>
                  )}
                </div>
              ),
            )}
            {busy && <div className="flex items-center gap-2 text-sm text-muted"><Spinner /> Waiting for the model…</div>}
            <div ref={endRef} />
          </div>

          <form onSubmit={send} className="border-t p-3 flex items-end gap-2">
            <textarea
              className="input !h-auto min-h-[44px] max-h-40 resize-none" rows={1} placeholder="Ask something…"
              value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) send(e); }}
            />
            <button className="btn-primary !h-11 !w-11 !p-0 shrink-0" disabled={busy || !input.trim()} aria-label="Send"><SendHorizontal className="h-4 w-4" /></button>
          </form>
        </div>
      </div>
    </>
  );
}
*/


import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eraser, SendHorizontal, SquareTerminal } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage, gatewayApi } from '../services/api';
import { Badge, Field, PageHeader, Spinner } from '../components/ui';
import { keyVault } from '../lib/keyVault';
import { fmtMs, fmtUsd, PROVIDER_LABEL } from '../lib/format';

const MODEL_OPTIONS = [
  { label: 'Gemini 3.5 Flash', value: 'gemini-3.5-flash' },
  { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
  { label: 'Claude Haiku 4.5', value: 'claude-haiku-4-5' },
  { label: 'Llama 3.2 (Local Ollama)', value: 'llama3.2:3b' },
];

function Meta({ r }) {
  const tone = r.cache_status === 'hit' ? 'accent' : r.cache_status === 'miss' ? 'neutral' : 'saved';
  const label = {
    hit: 'Cache hit',
    miss: 'Cache miss',
    unavailable: 'Cache unavailable',
    disabled: 'Cache disabled',
    bypass: 'Cache bypassed'
  }[r.cache_status] || r.cache_status;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2 text-xs text-muted">
      <Badge tone={tone}>{label}</Badge>
      {r.similarity_score != null && <span>similarity <b className="text-ink num">{r.similarity_score}</b></span>}
      <span>{PROVIDER_LABEL[r.provider]} · {r.model}</span>
      <span className="num">{fmtMs(r.latency_ms)}</span>
      <span className="num">{r.usage.total_tokens} tokens</span>
      <span className="num">cost {fmtUsd(r.cost_usd)}</span>
      {r.saved_usd != null && <span className="num text-saved">saved {fmtUsd(r.saved_usd)}</span>}
      {r.cache_debug && <span className="num" title="Closest cached entry seen on this miss (dev mode only)">closest {r.cache_debug.best_similarity} / overlap {r.cache_debug.best_keyword_overlap}</span>}
    </div>
  );
}

export default function Playground() {
  const [saved, setSaved] = useState(() => keyVault.list());
  const [keyId, setKeyId] = useState(saved[0]?.id || 'manual');
  const [manualKey, setManualKey] = useState('');
  const [model, setModel] = useState('gemini-3.5-flash');
  const [system, setSystem] = useState('');
  const [temperature, setTemperature] = useState('');
  const [maxTokens, setMaxTokens] = useState('');
  const [input, setInput] = useState('');
  const [chat, setChat] = useState([]);
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat, busy]);

  useEffect(() => {
    setSaved(keyVault.list());
  }, []);

  const apiKey = useMemo(
    () => keyId === 'manual'
      ? manualKey.trim()
      : saved.find((k) => k.id === keyId)?.key || '',
    [keyId, manualKey, saved]
  );

  const send = async (e) => {
    e?.preventDefault();

    const text = input.trim();
    if (!text || busy) return;
    if (!apiKey) return toast.error('Choose or paste a gateway key first');
    if (!model) return toast.error('Select a model');

    const history = [
      ...chat.filter((m) => !m.error),
      { role: 'user', content: text }
    ];

    setChat((c) => [...c, { role: 'user', content: text }]);
    setInput('');
    setBusy(true);

    const body = {
      model,
      messages: [
        ...(system.trim()
          ? [{ role: 'system', content: system.trim() }]
          : []),
        ...history.map(({ role, content }) => ({ role, content }))
      ],
    };

    if (temperature !== '') body.temperature = Number(temperature);
    if (maxTokens !== '') body.max_tokens = Number(maxTokens);

    try {
      const r = await gatewayApi.chat(apiKey, body);
      setChat((c) => [...c, { role: 'assistant', content: r.content, meta: r }]);
    } catch (err) {
      setChat((c) => [...c, { role: 'assistant', error: errorMessage(err) }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Playground"
        description="Send real requests through the gateway. Ask the same question twice to see the semantic cache answer the second one."
        actions={
          chat.length > 0 && (
            <button className="btn-ghost" onClick={() => setChat([])}>
              <Eraser className="h-4 w-4" /> Clear chat
            </button>
          )
        }
      />

      <div className="grid lg:grid-cols-[300px_1fr] gap-6 items-start">
        <div className="card p-5 space-y-4 lg:sticky lg:top-24">

          <Field
            label="Gateway key"
            hint={saved.length === 0
              ? 'Keys are only shown once when created. Create one on an application, or paste an existing key.'
              : undefined}
          >
            <select
              className="input"
              value={keyId}
              onChange={(e) => setKeyId(e.target.value)}
            >
              {saved.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.appName} · {k.label}
                </option>
              ))}
              <option value="manual">Paste a key…</option>
            </select>
          </Field>

          {keyId === 'manual' && (
            <input
              className="input font-mono"
              type="password"
              autoComplete="off"
              placeholder="aegis_…"
              value={manualKey}
              onChange={(e) => setManualKey(e.target.value)}
            />
          )}

          {/* Model Dropdown */}
          <Field
            label="Model"
            hint="Select a model. Llama 3.2 runs locally through Ollama."
          >
            <select
              className="input font-mono text-[13px]"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={busy}
            >
              <option value="" disabled>Select a model</option>
              {MODEL_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="System prompt" hint="Optional.">
            <textarea
              className="input"
              rows={3}
              value={system}
              onChange={(e) => setSystem(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Temperature">
              <input
                className="input"
                type="number"
                min="0"
                max="2"
                step="0.1"
                placeholder="auto"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
              />
            </Field>

            <Field label="Max tokens">
              <input
                className="input"
                type="number"
                min="1"
                step="1"
                placeholder="auto"
                value={maxTokens}
                onChange={(e) => setMaxTokens(e.target.value)}
              />
            </Field>
          </div>

          <Link
            to="/applications"
            className="block text-sm text-accent hover:underline"
          >
            Manage applications and keys
          </Link>
        </div>

        <div className="card flex flex-col min-h-[520px]">
          <div className="flex-1 p-5 space-y-5 overflow-y-auto max-h-[62vh]">

            {chat.length === 0 && !busy && (
              <div className="h-full min-h-[380px] grid place-items-center text-center">
                <div>
                  <div className="h-11 w-11 rounded-xl bg-sunken grid place-items-center mx-auto mb-4">
                    <SquareTerminal className="h-5 w-5 text-muted" />
                  </div>
                  <p className="font-medium">Send your first request</p>
                  <p className="text-sm text-muted mt-1 max-w-xs mx-auto">
                    Each message goes to <code className="font-mono text-xs">/v1/chat/completions</code> with the selected key.
                  </p>
                </div>
              </div>
            )}

            {chat.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-accent text-accent-ink px-4 py-2.5 text-sm whitespace-pre-wrap">
                    {m.content}
                  </p>
                </div>
              ) : (
                <div key={i} className="max-w-[92%]">
                  {m.error ? (
                    <p className="rounded-2xl rounded-bl-md bg-danger/10 text-danger px-4 py-2.5 text-sm">
                      {m.error}
                    </p>
                  ) : (
                    <>
                      <p className="rounded-2xl rounded-bl-md bg-sunken px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed">
                        {m.content}
                      </p>
                      <Meta r={m.meta} />
                    </>
                  )}
                </div>
              )
            )}

            {busy && (
              <div className="flex items-center gap-2 text-sm text-muted">
                <Spinner /> Waiting for the model…
              </div>
            )}

            <div ref={endRef} />
          </div>

          <form
            onSubmit={send}
            className="border-t p-3 flex items-end gap-2"
          >
            <textarea
              className="input !h-auto min-h-[44px] max-h-40 resize-none"
              rows={1}
              placeholder="Ask something…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) send(e);
              }}
            />

            <button
              className="btn-primary !h-11 !w-11 !p-0 shrink-0"
              disabled={busy || !input.trim()}
              aria-label="Send"
            >
              <SendHorizontal className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}



