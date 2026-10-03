// Prices in USD per 1,000,000 tokens: [model-name prefix, input, output].
// ILLUSTRATIVE VALUES. Providers change prices often; verify against their pricing pages and edit here.
// First matching prefix wins, so keep more specific prefixes above general ones.
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
  ['gemini-2.5-pro', 1.25, 10],
  ['gemini-2.5-flash', 0.3, 2.5],
  ['gemini-2.0-flash', 0.1, 0.4],
];

export function calculateCost(provider, model, promptTokens, completionTokens) {
  if (provider === 'OLLAMA') return 0; // local execution
  const m = String(model).toLowerCase();
  const row = PRICES.find(([prefix]) => m.startsWith(prefix));
  if (!row) return 0; // unknown model: cost not tracked (add it to PRICES)
  const [, inPerM, outPerM] = row;
  return (promptTokens * inPerM + completionTokens * outPerM) / 1_000_000;
}
