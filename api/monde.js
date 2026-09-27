/* =================================================================
   Pièce 3D réaliste à partir d'un rendu : World Labs, API Marble
   POST : { image (URL publique du rendu fal), nom, texte } -> { op }
   GET  ?op=…  -> { etat: 'en cours' | 'fini' | 'erreur', monde: { url, vignette, spz, pano } }
   La clé WLT_API_KEY reste sur le serveur. Modèle : MARBLE_MODELE
   (marble-1.1 par défaut ; marble-1.0-draft pour des essais moins chers).
   ================================================================= */
import { repondre, origineAutorisee, codeAutorise, limite, lireCorps, texte } from './_commun.js';

const API = 'https://api.worldlabs.ai/marble/v1/';
const RENDUS = /^https:\/\/([a-z0-9-]+\.)*fal\.(media|run|ai)\//i;

export default async function handler(req, res) {
  const cle = process.env.WLT_API_KEY;
  if (!cle) return repondre(res, 503, { erreur: 'pièce 3D non activée (clé World Labs absente)' });
  if (!origineAutorisee(req)) return repondre(res, 403, { erreur: 'origine refusée' });
  if (!codeAutorise(req)) return repondre(res, 401, { erreur: 'code d’accès requis' });
  const entetes = { 'WLT-Api-Key': cle, 'Content-Type': 'application/json' };

  if (req.method === 'GET') {
    const op = String(req.query?.op || '');
    if (!/^[0-9a-zA-Z_-]{8,80}$/.test(op)) return repondre(res, 400, { erreur: 'opération invalide' });
    if (!limite(req, 'op', 300, 3600e3)) return repondre(res, 429, { erreur: 'trop de demandes' });
    const r = await fetch(API + 'operations/' + op, { headers: entetes });
    const o = await r.json().catch(() => ({}));
    if (!r.ok) return repondre(res, 502, { etat: 'erreur', erreur: o.message || o.detail || 'suivi indisponible' });
    if (o.error) return repondre(res, 200, { etat: 'erreur', erreur: o.error.message || 'génération échouée' });
    if (!o.done) return repondre(res, 200, { etat: 'en cours', progres: o.metadata?.progress?.description || '' });
    let w = o.response && (o.response.world || o.response);
    const id = (w && (w.id || w.world_id)) || o.metadata?.world_id;
    if ((!w || !w.assets) && id) {
      const r2 = await fetch(API + 'worlds/' + id, { headers: entetes });
      const j2 = await r2.json().catch(() => ({}));
      w = j2.world || j2;
    }
    if (!w) return repondre(res, 200, { etat: 'erreur', erreur: 'monde introuvable' });
    const a = w.assets || {};
    return repondre(res, 200, {
      etat: 'fini',
      monde: {
        id: w.id || id,
        url: w.world_marble_url || ('https://marble.worldlabs.ai/world/' + (w.id || id)),
        vignette: a.thumbnail_url || null,
        pano: a.imagery?.pano_url || null,
        spz: a.splats?.spz_urls || null,
        echelle: a.splats?.semantics_metadata || null
      }
    });
  }

  if (req.method !== 'POST') return repondre(res, 405, { erreur: 'méthode non permise' });
  if (!limite(req, 'monde', Number(process.env.MONDES_PAR_HEURE || 4), 3600e3)) return repondre(res, 429, { erreur: 'trop de pièces 3D demandées, réessayez plus tard' });
  const b = await lireCorps(req, 1e5);
  const image = String(b?.image || '');
  if (!RENDUS.test(image)) return repondre(res, 400, { erreur: 'image de rendu invalide' });
  const corps = {
    display_name: 'Maison Corleone · ' + texte(b.nom, 60),
    model: process.env.MARBLE_MODELE || 'marble-1.1',
    world_prompt: {
      type: 'image',
      image_prompt: { source: 'uri', uri: image },
      text_prompt: texte(b.texte, 400) || 'Hotel room interior, photorealistic.'
    }
  };
  const r = await fetch(API + 'worlds:generate', { method: 'POST', headers: entetes, body: JSON.stringify(corps) });
  const j = await r.json().catch(() => ({}));
  const op = j.operation_id || j.id || j.name;
  if (!r.ok || !op) return repondre(res, 502, { erreur: j.message || j.detail || 'World Labs a refusé la demande (' + r.status + ')' });
  return repondre(res, 200, { op: String(op).replace(/^operations\//, '') });
}
