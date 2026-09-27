// Banc d'essai des fonctions api/ : sert public/ comme Vercel et simule fal.ai et World Labs
// (injoignables depuis l'environnement d'essai). Usage : node test/serveur_api.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ICI, '..', 'public');
const PORT = Number(process.argv[2] || 8790);
process.env.FAL_KEY = 'cle-de-test';
process.env.WLT_API_KEY = 'cle-de-test';
export const JOURNAL = [];

// fausses API distantes
const vrai = globalThis.fetch;
const etats = { fal: 0, monde: 0 };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
globalThis.fetch = async (u, o = {}) => {
  u = String(u);
  if (u.startsWith('https://queue.fal.run/')) {
    if (o.method === 'POST') {
      const b = JSON.parse(o.body);
      JOURNAL.push({ fal: 'soumission', cle: o.headers.Authorization, images: b.image_urls.length, maquette: b.image_urls[0].slice(0, 23), autres: b.image_urls.slice(1), resolution: b.resolution, format: b.aspect_ratio });
      fs.writeFileSync(path.join(ICI, '..', 'build', 'derniere-consigne.txt'), b.prompt);
      etats.fal = 0;
      const id = '0f6c7c0e-3f1d-4d0b-9d6a-7f5b3b2b1a10';
      return json({ request_id: id, status_url: `https://queue.fal.run/fal-ai/nano-banana-pro/requests/${id}/status`, response_url: `https://queue.fal.run/fal-ai/nano-banana-pro/requests/${id}`, queue_position: 0 });
    }
    if (u.endsWith('/status')) { etats.fal++; return json({ status: etats.fal < 2 ? 'IN_QUEUE' : etats.fal < 3 ? 'IN_PROGRESS' : 'COMPLETED', queue_position: 1 }); }
    return json({ images: [{ url: 'https://v3.fal.media/files/essai/rendu.jpg', width: 1536, height: 1024 }], description: '' });
  }
  if (u.startsWith('https://api.worldlabs.ai/')) {
    if (o.method === 'POST') {
      const b = JSON.parse(o.body);
      JOURNAL.push({ monde: 'soumission', cle: o.headers['WLT-Api-Key'], modele: b.model, source: b.world_prompt.image_prompt.uri, texte: b.world_prompt.text_prompt });
      etats.monde = 0;
      return json({ operation_id: 'op-essai-123456', done: false });
    }
    if (u.includes('/operations/')) {
      etats.monde++;
      if (etats.monde < 2) return json({ operation_id: 'op-essai-123456', done: false, metadata: { progress: { status: 'IN_PROGRESS', description: 'Génération du monde' } } });
      return json({ operation_id: 'op-essai-123456', done: true, response: { id: 'w-essai', world_marble_url: 'https://marble.worldlabs.ai/world/w-essai', assets: { thumbnail_url: 'https://cdn.worldlabs.ai/essai.jpg', splats: { spz_urls: { '500k': 'https://cdn.worldlabs.ai/essai-500k.spz' } } } } });
    }
  }
  return vrai(u, o);
};

const fonctions = {
  etat: (await import('../api/etat.js')).default,
  rendu: (await import('../api/rendu.js')).default,
  monde: (await import('../api/monde.js')).default
};
const TYPES = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.js': 'text/javascript', '.css': 'text/css' };

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://local');
  const m = u.pathname.match(/^\/api\/([a-z]+)$/);
  if (m && fonctions[m[1]]) {
    req.query = Object.fromEntries(u.searchParams);
    try { await fonctions[m[1]](req, res); } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ erreur: String(e) })); }
    JOURNAL.push({ api: req.method + ' ' + m[1], statut: res.statusCode });
    return;
  }
  if (u.pathname === '/__journal') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(JOURNAL)); return; }
  const f = path.join(PUBLIC, u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname));
  if (!f.startsWith(PUBLIC) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; res.end('introuvable'); return; }
  res.setHeader('Content-Type', TYPES[path.extname(f)] || 'application/octet-stream');
  fs.createReadStream(f).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log('serveur prêt', PORT));
