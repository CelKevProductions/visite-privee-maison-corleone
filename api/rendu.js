/* =================================================================
   Rendu réaliste d'un espace : fal.ai, Nano Banana Pro (édition d'image)
   POST : { espace, soir, maquette (JPEG en data URI), photo (URL), produits[] }
          -> { id, suivi, resultat }  (demande placée dans la file de fal)
   GET  ?suivi=…&resultat=…  -> { etat: 'file' | 'en cours' | 'fini' | 'erreur', image }
   La clé FAL_KEY reste sur le serveur. Le texte envoyé au modèle est
   composé ici : la page ne fournit que des données (noms, photos).
   ================================================================= */
import { repondre, origineAutorisee, codeAutorise, limite, lireCorps, texte } from './_commun.js';

const MODELE = process.env.FAL_MODELE || 'fal-ai/nano-banana-pro/edit';
const FILE = 'https://queue.fal.run/';
const PHOTOS_PRODUITS = /^https:\/\/cdn\.shopify\.com\/s\/files\//;
const SUIVI = /^https:\/\/queue\.fal\.run\/[a-z0-9._\/-]+\/requests\/[0-9a-f-]{36}(\/status)?$/i;

function consigne(espace, soir, avecPhoto, produits) {
  const n0 = avecPhoto ? 3 : 2;
  const lignes = produits.map((p, i) => {
    const dims = Array.isArray(p.dims) && p.dims.length === 3 ? ` — about ${p.dims[0]} × ${p.dims[1]} × ${p.dims[2]} cm (width × depth × height)` : '';
    const qte = p.qte > 1 ? ` (${p.qte} identical pieces)` : '';
    return `- Image ${n0 + i}: ${texte(p.cat, 40)} "${texte(p.nom, 60)}"${qte}: ${texte(p.titre, 160)}${dims}.`;
  });
  return [
    `Create one photorealistic interior photograph of "${texte(espace.nom, 60)}" (${texte(espace.type, 40)}) in the Marriott hotel at Paris Roissy–Charles-de-Gaulle airport, furnished by the French design house Maison Corleone.`,
    `Image 1 is a simplified 3D mock-up of this space. Keep exactly its camera position, framing, perspective and lens, the room layout, walls, windows and doors, and the position, orientation and scale of every piece of furniture. Replace the simplified shapes and flat colours with real materials and the real products below.`,
    avecPhoto ? `Image 2 is a photo of the space. Use it only for the architecture, wall and floor finishes, window view and light. Where its furniture differs from the mock-up, follow the mock-up and the product photos.` : '',
    produits.length ? `These images show the exact Maison Corleone products placed in the mock-up. Reproduce each one faithfully (silhouette, proportions, colours, materials and details) at the place of its simplified shape:` : '',
    ...lignes,
    espace.texte ? `Intent of the space (in French): ${texte(espace.texte, 300)}` : '',
    soir
      ? `Evening atmosphere: dark sky outside, warm lamps and LED strips switched on, cosy contrast.`
      : `Soft natural daylight with warm accent lighting.`,
    `High-end hotel interior photography, realistic shadows and reflections, sharp focus, eye-level camera, 3:2 frame. Do not add furniture that is not in the mock-up, do not change the room. No people, no text, no logo, no watermark.`
  ].filter(Boolean).join('\n');
}

export default async function handler(req, res) {
  const cle = process.env.FAL_KEY;
  if (!cle) return repondre(res, 503, { erreur: 'rendu non activé (clé fal.ai absente)' });
  if (!origineAutorisee(req)) return repondre(res, 403, { erreur: 'origine refusée' });
  if (!codeAutorise(req)) return repondre(res, 401, { erreur: 'code d’accès requis' });

  // suivi d'une demande
  if (req.method === 'GET') {
    const suivi = String(req.query?.suivi || ''), resultat = String(req.query?.resultat || '');
    if (!SUIVI.test(suivi) || !SUIVI.test(resultat)) return repondre(res, 400, { erreur: 'suivi invalide' });
    if (!limite(req, 'suivi', 400, 3600e3)) return repondre(res, 429, { erreur: 'trop de demandes' });
    const url = suivi.endsWith('/status') ? suivi : suivi + '/status';
    const r = await fetch(url, { headers: { Authorization: 'Key ' + cle } });
    const s = await r.json().catch(() => ({}));
    if (!r.ok) return repondre(res, 502, { etat: 'erreur', erreur: s.detail || 'suivi indisponible' });
    if (s.status === 'IN_QUEUE') return repondre(res, 200, { etat: 'file', position: s.queue_position });
    if (s.status === 'IN_PROGRESS') return repondre(res, 200, { etat: 'en cours' });
    if (s.status !== 'COMPLETED') return repondre(res, 200, { etat: 'en cours' });
    const r2 = await fetch(resultat.replace(/\/status$/, ''), { headers: { Authorization: 'Key ' + cle } });
    const j = await r2.json().catch(() => ({}));
    const img = j.images && j.images[0];
    if (!r2.ok || !img || !img.url) return repondre(res, 200, { etat: 'erreur', erreur: (j.detail && (j.detail[0]?.msg || j.detail)) || 'aucune image produite' });
    return repondre(res, 200, { etat: 'fini', image: img.url, largeur: img.width, hauteur: img.height });
  }

  if (req.method !== 'POST') return repondre(res, 405, { erreur: 'méthode non permise' });
  if (!limite(req, 'rendu', Number(process.env.RENDUS_PAR_HEURE || 20), 3600e3)) return repondre(res, 429, { erreur: 'trop de rendus demandés, réessayez dans une heure' });
  const b = await lireCorps(req);
  if (!b || typeof b !== 'object') return repondre(res, 400, { erreur: 'demande illisible' });
  const maquette = String(b.maquette || '');
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(maquette) || maquette.length > 3.5e6) return repondre(res, 400, { erreur: 'vue de la maquette invalide' });
  const espace = b.espace && typeof b.espace === 'object' ? b.espace : {};
  let photo = null;
  try {
    const u = new URL(String(b.photo || ''));
    const hote = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
    if (u.protocol === 'https:' && (u.host.toLowerCase() === hote || PHOTOS_PRODUITS.test(u.href))) photo = u.href;
  } catch (_) { photo = null; }
  const produits = (Array.isArray(b.produits) ? b.produits : []).filter(p => p && PHOTOS_PRODUITS.test(String(p.img || ''))).slice(0, 12);
  const images = [maquette].concat(photo ? [photo] : [], produits.map(p => String(p.img)));
  const corps = {
    prompt: consigne(espace, !!b.soir, !!photo, produits),
    image_urls: images,
    num_images: 1,
    aspect_ratio: '3:2',
    output_format: 'jpeg',
    resolution: process.env.FAL_RESOLUTION || '2K'
  };
  const r = await fetch(FILE + MODELE, { method: 'POST', headers: { Authorization: 'Key ' + cle, 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.request_id) return repondre(res, 502, { erreur: (j.detail && (j.detail[0]?.msg || j.detail)) || 'fal.ai a refusé la demande (' + r.status + ')' });
  const base = FILE + MODELE.split('/').slice(0, 2).join('/') + '/requests/' + j.request_id;
  return repondre(res, 200, { id: j.request_id, suivi: j.status_url || base + '/status', resultat: j.response_url || base });
}
