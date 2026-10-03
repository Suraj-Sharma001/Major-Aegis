// OFFLINE TEST DOUBLE for the embedding service (no model download needed).
// Bag-of-words hashing into 256 dims, L2-normalised. Good enough to exercise the cache logic
// (identical / near-identical text -> high cosine). It is NOT semantic: use the real service for demos.
import http from 'node:http';

const PORT = Number(process.env.MOCK_EMBED_PORT || 8002);
const DIM = 256;

function embed(text) {
  const v = new Array(DIM).fill(0);
  for (const w of String(text).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean)) {
    let h = 2166136261;
    for (const ch of w) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    v[h % DIM] += 1;
  }
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

http
  .createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ok', model: 'mock-bow-256', dim: DIM }));
    }
    if (req.method === 'POST' && req.url === '/embed') {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        try {
          const { texts } = JSON.parse(raw);
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ embeddings: texts.map(embed), model: 'mock-bow-256', dim: DIM }));
        } catch {
          res.writeHead(400).end('bad request');
        }
      });
      return;
    }
    res.writeHead(404).end();
  })
  .listen(PORT, () => console.log(`[mock-embedding] listening on :${PORT}`));
