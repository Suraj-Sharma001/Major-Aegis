// OFFLINE TEST DOUBLE for OpenAI / Anthropic / Gemini / Ollama.
// Lets you exercise every adapter without internet or real keys. Replies echo the question and the
// last 4 chars of the API key it received, which proves the organization's own decrypted key was used.
//
// Start the backend with:
//   OPENAI_BASE_URL=http://localhost:9100 ANTHROPIC_BASE_URL=http://localhost:9100
//   GEMINI_BASE_URL=http://localhost:9100 OLLAMA_BASE_URL=http://localhost:9100
import http from 'node:http';

const PORT = Number(process.env.MOCK_PROVIDERS_PORT || 9100);
let counter = 0;

const send = (res, code, obj) => {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(obj));
};
const words = (s) => String(s).split(/\s+/).filter(Boolean).length;

http
  .createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      let body = {};
      try { body = raw ? JSON.parse(raw) : {}; } catch { return send(res, 400, { error: 'bad json' }); }
      counter += 1;
      const url = req.url.split('?')[0];
      const h = req.headers;

      if (url === '/v1/chat/completions') {
        const key = (h.authorization || '').replace('Bearer ', '');
        if (!key) return send(res, 401, { error: { message: 'missing bearer key' } });
        const q = body.messages.at(-1).content;
        return send(res, 200, {
          choices: [{ message: { role: 'assistant', content: `MOCK-OPENAI#${counter} key=${key.slice(-4)} | ${q}` } }],
          usage: { prompt_tokens: words(q) + 10, completion_tokens: 20, total_tokens: words(q) + 30 },
        });
      }
      if (url === '/v1/messages') {
        const key = h['x-api-key'];
        if (!key || h['anthropic-version'] !== '2023-06-01') return send(res, 401, { error: { message: 'missing key or version header' } });
        if (!body.max_tokens) return send(res, 400, { error: { message: 'max_tokens required' } });
        const q = body.messages.at(-1).content;
        return send(res, 200, {
          content: [{ type: 'text', text: `MOCK-CLAUDE#${counter} key=${key.slice(-4)} sys=${body.system ? 'yes' : 'no'} | ${q}` }],
          usage: { input_tokens: words(q) + 8, output_tokens: 18 },
        });
      }
      if (/^\/v1beta\/models\/[^/]+:generateContent$/.test(url)) {
        const key = h['x-goog-api-key'];
        if (!key) return send(res, 401, { error: { message: 'missing x-goog-api-key' } });
        const q = body.contents.at(-1).parts[0].text;
        return send(res, 200, {
          candidates: [{ content: { parts: [{ text: `MOCK-GEMINI#${counter} key=${key.slice(-4)} | ${q}` }] } }],
          usageMetadata: { promptTokenCount: words(q) + 6, candidatesTokenCount: 16, totalTokenCount: words(q) + 22 },
        });
      }
      if (url === '/api/chat') {
        const q = body.messages.at(-1).content;
        return send(res, 200, {
          message: { role: 'assistant', content: `MOCK-OLLAMA#${counter} model=${body.model} | ${q}` },
          prompt_eval_count: words(q) + 4, eval_count: 12,
        });
      }
      send(res, 404, { error: 'unknown mock route ' + url });
    });
  })
  .listen(PORT, () => console.log(`[mock-providers] listening on :${PORT}`));
