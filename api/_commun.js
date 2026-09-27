/* =================================================================
   Outils communs aux fonctions du serveur (Vercel)
   Les clés restent ici, côté serveur : FAL_KEY, WLT_API_KEY.
   ACCES_CODE (facultatif) : si renseigné, chaque appel doit porter
   l'en-tête x-code-acces avec ce code.
   ================================================================= */

// réponses JSON sans cache
export function repondre(res, statut, corps) {
  res.statusCode = statut;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(corps));
}

// seules les pages du site peuvent appeler ces fonctions (pas un script tiers)
export function origineAutorisee(req) {
  const hote = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
  const permis = new Set([hote].concat(String(process.env.ORIGINES || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)));
  if (req.headers['sec-fetch-site'] === 'same-origin') return true;
  for (const h of ['origin', 'referer']) {
    const v = req.headers[h];
    if (!v) continue;
    try { if (permis.has(new URL(v).host.toLowerCase())) return true; } catch (_) { /* en-tête illisible */ }
  }
  return false;
}

export function codeAutorise(req) {
  const code = process.env.ACCES_CODE;
  return !code || req.headers['x-code-acces'] === code;
}

// limite simple par adresse (mémoire de l'instance : un garde-fou, pas un quota exact)
const COMPTES = new Map();
export function limite(req, cle, max, fenetreMs) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '?').split(',')[0].trim();
  const k = cle + ':' + ip, t = Date.now();
  const l = (COMPTES.get(k) || []).filter(x => t - x < fenetreMs);
  if (l.length >= max) { COMPTES.set(k, l); return false; }
  l.push(t);
  COMPTES.set(k, l);
  return true;
}

// corps JSON (Vercel le fournit déjà décodé ; sinon on le lit)
export async function lireCorps(req, max = 6e6) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (_) { return null; } }
  let taille = 0;
  const morceaux = [];
  for await (const m of req) {
    taille += m.length;
    if (taille > max) return null;
    morceaux.push(m);
  }
  try { return JSON.parse(Buffer.concat(morceaux).toString('utf8')); } catch (_) { return null; }
}

export const texte = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
