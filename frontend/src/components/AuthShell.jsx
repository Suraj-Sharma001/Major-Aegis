import Logo from './Logo';
import { BASE_URL } from '../services/api';

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-full grid lg:grid-cols-[1.05fr_1fr]">
      <div className="hidden lg:flex flex-col justify-between bg-sunken border-r p-12">
        <div className="flex items-center gap-2.5">
          <Logo size={32} />
          <span className="text-lg font-semibold tracking-tight">Aegis</span>
        </div>

        <div className="max-w-md">
          <h2 className="text-[34px] leading-[1.15] font-semibold tracking-tight">
            One endpoint for every model your team uses.
          </h2>
          <p className="text-muted mt-4 leading-relaxed">
            Route requests to OpenAI, Claude, Gemini or Ollama with your own keys, keep each team's
            apps separate, and stop paying twice for questions that were already answered.
          </p>

          <div className="mt-9 rounded-xl border bg-surface overflow-hidden">
            <div className="px-4 py-2.5 border-b text-xs text-muted font-mono">POST {BASE_URL}/v1/chat/completions</div>
            <pre className="p-4 text-[13px] leading-6 font-mono overflow-x-auto">
{`x-api-key: aegis_…

{
  "model": "gemini-2.5-flash",
  "messages": [
    { "role": "user", "content": "Hello" }
  ]
}`}
            </pre>
          </div>
        </div>

        <p className="text-xs text-muted">Auth, multi-tenancy, gateway and semantic cache in one dashboard.</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <Logo size={30} />
            <span className="text-lg font-semibold tracking-tight">Aegis</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted mt-1.5 mb-7">{subtitle}</p>
          {children}
          <p className="text-sm text-muted mt-7 text-center">{footer}</p>
        </div>
      </div>
    </div>
  );
}
