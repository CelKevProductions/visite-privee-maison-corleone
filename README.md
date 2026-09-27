# Visite privée · Maison Corleone

Proposition de réaménagement du Marriott Roissy-Charles-de-Gaulle : préchargement et accueil en 2D, puis une visite entièrement en 3D (three.js animé par GSAP). Chaque meuble a son point : on le voit seul, avec sa fiche, son prix, les propositions de Maison Corleone et **tout le catalogue compatible** (341 pièces actives de la boutique, filtrées par famille et par dimensions de l’emplacement). Chaque espace peut passer en **rendu réaliste** (IA), puis en **pièce 3D réaliste**.

## Structure

| Dossier | Contenu |
| --- | --- |
| `public/` | Le site publié (page unique `index.html`, images). Généré par `build.py` : ne pas modifier à la main. |
| `api/` | Fonctions serveur Vercel : `etat.js`, `rendu.js` (fal.ai), `monde.js` (World Labs). Les clés ne quittent jamais le serveur. |
| `src/` | Sources : `app.js` (interface), `data.js` (propositions, espaces, emplacements), `catalogue.js` (généré), `v3d-*.js` (3D), `style.css`, `body.html`. |
| `outils/` | `export_shopify.py` (export des produits actifs), `catalogue.py` (familles, styles, dimensions, couleurs → `src/catalogue.js`). |
| `test/` | Essais Playwright (visite, catalogue, rendu avec serveur simulé, planches des maquettes). |

## Construire

```bash
npm install            # three, gsap, esbuild
python3 build.py       # public/index.html (Vercel) et dist/ (aperçu intégré)
```

## Mettre le catalogue à jour (prix, nouveaux produits)

```bash
SHOPIFY_BOUTIQUE=xxx.myshopify.com SHOPIFY_JETON=shpat_… python3 outils/export_shopify.py
python3 outils/catalogue.py && python3 build.py
```

Les pièces choisies dans `src/data.js` gardent leur texte et leur maquette détaillée. Les autres reçoivent une maquette générique déduite du titre et de la description (famille, style, dimensions, couleurs, matière). Pour qu’une pièce soit proposée à un emplacement, elle doit être de la bonne famille et tenir dans son gabarit (`fam`, `max`, `min`, `sans`, `ext` dans `data.js`).

## Variables d’environnement (Vercel → Settings → Environment Variables)

| Variable | Rôle |
| --- | --- |
| `FAL_KEY` | Clé fal.ai : active le rendu réaliste (Nano Banana Pro, édition d’image). |
| `WLT_API_KEY` | Clé World Labs : active la pièce 3D réaliste (Marble). |
| `ACCES_CODE` | Facultatif : réserve le rendu aux liens `…/?code=VOTRECODE`. |
| `RENDUS_PAR_HEURE`, `MONDES_PAR_HEURE` | Plafonds par visiteur (20 et 4 par défaut). |
| `FAL_RESOLUTION` | `1K`, `2K` (défaut) ou `4K`. |
| `MARBLE_MODELE` | `marble-1.1` (défaut), `marble-1.1-plus`, ou `marble-1.0-draft` pour des essais moins chers. |
| `ORIGINES` | Autres domaines autorisés à appeler l’API (séparés par des virgules). |

Coûts indicatifs : un rendu fal.ai en 2K ≈ 0,15 $ (4K ≈ 0,30 $) ; une pièce Marble ≈ 1 580 crédits (≈ 1,26 $) en `marble-1.1`, ≈ 230 crédits en brouillon. Pensez aux plafonds de dépense dans les tableaux de bord fal.ai et World Labs.

## Photos des espaces

Le rendu réaliste part de la vue intérieure de la maquette, des photos produits et, si elle existe, de la photo de l’espace (`photo` dans `data.js`). Seule la Chambre Deluxe en a une pour l’instant : ajoutez les autres dans `public/img/` (ou une URL publique) pour de meilleurs rendus.

## Essais

```bash
python3 test/run.py desktop        # la visite complète (aussi : mobile, repli, reduit)
python3 test/catalogue.py mobile   # catalogue compatible et rendu (API simulée)
python3 test/api.py                # fonctions api/ de bout en bout (fal.ai et World Labs simulés)
python3 test/galerie.py fauteuil   # planche de toutes les maquettes d'une famille
```
