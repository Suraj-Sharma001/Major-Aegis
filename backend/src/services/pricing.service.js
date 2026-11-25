const PRICES = [
  ['gpt-4o-mini', 0.15, 0.6],
  ['gpt-4o', 2.5, 10],
  ['gpt-4.1-nano', 0.1, 0.4],
  ['gpt-4.1-mini', 0.4, 1.6],
  ['gpt-4.1', 2, 8],
  ['o4-mini', 1.1, 4.4],
  ['o3-mini', 1.1, 4.4],
  ['claude-opus', 15, 75],
  ['claude-sonnet', 3, 15],
  ['claude-haiku', 0.8, 4],
  ['gemini-3.8-flash', 0.75, 3.75],
  ['gemini-3.6-flash', 0.75, 3.75],
  ['gemini-3.5-flash-lite', 0.3, 2.5],
  ['gemini-2.5-pro', 1.25, 10],
  ['gemini-2.0-flash', 0.1, 0.4],
  ['grok-2-mini', 0.2, 0.6],
  ['grok-2', 2, 10],
];

export function calculateCost(provider, model, promptTokens, completionTokens) {
  if (provider === 'OLLAMA') return 0;
  const m = String(model).toLowerCase();
  const row = PRICES.find(([prefix]) => m.startsWith(prefix));
  if (!row) return 0;
  const [, inPerM, outPerM] = row;
  return (promptTokens * inPerM + completionTokens * outPerM) / 1_000_000;
}
