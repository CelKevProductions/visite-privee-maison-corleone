// Essai réel du rendu réaliste sur le site en ligne (coûte un rendu fal.ai, ≈ 0,15 $) :
//   node test/rendu_reel.mjs [https://visite-privee-maison-corleone.vercel.app] [image.jpg]
// Envoie une vraie vue de la maquette (test/fixtures/maquette-deluxe.jpg), la photo de la
// chambre et les photos des quatre pièces proposées pour la Chambre Deluxe, puis suit la file.
import fs from 'node:fs';

const site = (process.argv[2] || 'https://visite-privee-maison-corleone.vercel.app').replace(/\/$/, '');
const fichier = process.argv[3] || new URL('./fixtures/maquette-deluxe.jpg', import.meta.url);
const maquette = 'data:image/jpeg;base64,' + fs.readFileSync(fichier).toString('base64');
const IMG = 'https://cdn.shopify.com/s/files/1/0938/1055/7195/files/';
const produits = [
  { nom: 'Royal Curve Edition', cat: 'Lit', titre: 'Lit design en cuir orange à chevets intégrés', emplacement: 'Le lit', qte: 1, dims: [300, 220, 115], img: IMG + '2026-04-0902.12.38.jpg?v=1780100146&width=900' },
  { nom: 'Luna Stack', cat: 'Suspension', titre: 'Suspension en albâtre naturel à 3 diffuseurs empilés', emplacement: 'La suspension de chevet', qte: 1, dims: [16, 16, 35], img: IMG + '2026-04-1107.07.06.jpg?v=1780106747&width=900' },
  { nom: 'Terracotta', cat: 'Fauteuil', titre: 'Fauteuil lounge en velours terracotta à bourrelets sculptés', emplacement: 'Le fauteuil', qte: 1, dims: [95, 90, 75], img: IMG + 'DJI_20251102172108_0439_D.jpg?v=1771175062&width=900' },
  { nom: 'Wood Orb Duo', cat: 'Applique', titre: 'Applique murale en bois teinté noyer et globe opalin', emplacement: 'L’applique', qte: 1, dims: [15, 13, 38], img: IMG + '2026-04-1105.36.37.jpg?v=1780105435&width=900' }
];
const corps = {
  espace: { id: 'deluxe', nom: 'Chambre Deluxe', type: 'Chambre', texte: 'Tête de lit en cuir, lumière chaude et un vrai fauteuil : la Deluxe donne le ton de tout l’hôtel.' },
  soir: false, maquette, photo: site + '/img/chambre-deluxe.webp', produits
};
const entetes = { 'Content-Type': 'application/json', Origin: site };
const t0 = Date.now();
const sec = () => Math.round((Date.now() - t0) / 1000) + ' s';

const r = await fetch(site + '/api/rendu', { method: 'POST', headers: entetes, body: JSON.stringify(corps) });
const j = await r.json().catch(() => ({}));
console.log('soumission', r.status, JSON.stringify(j));
if (!r.ok) process.exit(1);
for (;;) {
  await new Promise(ok => setTimeout(ok, 3000));
  const q = await fetch(site + '/api/rendu?suivi=' + encodeURIComponent(j.suivi) + '&resultat=' + encodeURIComponent(j.resultat), { headers: { Origin: site } });
  const s = await q.json().catch(() => ({}));
  console.log(sec(), q.status, JSON.stringify(s));
  if (!q.ok || s.etat === 'fini' || s.etat === 'erreur') break;
  if (Date.now() - t0 > 300e3) { console.log('délai dépassé'); break; }
}
