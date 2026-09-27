#!/usr/bin/env python3
"""Essai du catalogue complet et du rendu réaliste (serveur simulé).

- fiche d'un fauteuil, catalogue compatible, filtres, choix d'une pièce du
  catalogue, retour dans la pièce ;
- un lit du catalogue plus large (chevets intégrés) ;
- rendu réaliste : /api simulé (fal.ai et World Labs ne sont pas joignables
  d'ici), états d'attente, résultat et comparaison, pièce 3D.

Usage : python3 test/catalogue.py [desktop|mobile]
"""
import asyncio, json, pathlib, sys, time
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from run import serve, route, OUT, PORT, Page
from playwright.async_api import async_playwright

SCENARIO = sys.argv[1] if len(sys.argv) > 1 else 'desktop'
MOBILE = SCENARIO == 'mobile'
APPELS = []


async def api(r):
    """Serveur simulé : mêmes réponses que api/*.js, sans appel externe."""
    req = r.request
    url = req.url
    APPELS.append((req.method, url.split('/api/')[1][:60]))
    rep = lambda o, s=200: r.fulfill(status=s, body=json.dumps(o), headers={'Content-Type': 'application/json'})
    if '/api/etat' in url:
        return await rep({'rendu': True, 'monde': True, 'code': False})
    if '/api/rendu' in url and req.method == 'POST':
        corps = json.loads(req.post_data or '{}')
        APPELS.append(('corps', {'produits': len(corps.get('produits', [])), 'photo': bool(corps.get('photo')),
                                 'maquette_ko': len(corps.get('maquette', '')) // 1024, 'espace': corps.get('espace', {}).get('id')}))
        base = 'https://queue.fal.run/fal-ai/nano-banana-pro/requests/0f6c7c0e-3f1d-4d0b-9d6a-7f5b3b2b1a10'
        return await rep({'id': 'x', 'suivi': base + '/status', 'resultat': base})
    if '/api/rendu' in url:
        n = sum(1 for a in APPELS if a[0] == 'GET' and a[1].startswith('rendu?'))
        if n < 3:
            return await rep({'etat': 'en cours'})
        return await rep({'etat': 'fini', 'image': f'http://127.0.0.1:{PORT}/img/chambre-deluxe.webp'})
    if '/api/monde' in url and req.method == 'POST':
        return await rep({'op': 'op_1234567890'})
    if '/api/monde' in url:
        n = sum(1 for a in APPELS if a[0] == 'GET' and a[1].startswith('monde?'))
        if n < 2:
            return await rep({'etat': 'en cours', 'progres': 'Génération du panorama'})
        return await rep({'etat': 'fini', 'monde': {'url': 'https://marble.worldlabs.ai/world/essai', 'vignette': None}})
    return await r.fulfill(status=404, body='{}')


async def main():
    srv = serve()
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844} if MOBILE else {'width': 1440, 'height': 900},
                                  device_scale_factor=1, is_mobile=MOBILE, has_touch=MOBILE)
        await ctx.route('**/*', route)
        await ctx.route('**/api/**', api)
        page = await ctx.new_page()
        await page.add_init_script('window.MC_QUALITE = { dpr: .5, dprMin: .5, ombre: 1024, debug: true }; try { localStorage.clear(); } catch (e) {}')
        P = Page(page, 'cata-' + SCENARIO)
        t0 = time.time()
        await page.goto(f'http://127.0.0.1:{PORT}/local.html')
        await page.wait_for_selector('.preloader', state='detached', timeout=60000)
        await page.wait_for_function('() => window.VISITE3D && window.VISITE3D.ok', timeout=60000)
        await P.js('() => gsap.ticker.lagSmoothing(0)')
        print('prêt en', round(time.time() - t0, 1), 's')
        await P.js("() => document.querySelector('#entrer').click()")
        await page.wait_for_timeout(5200)
        await P.js("() => document.querySelector('[data-station=\"suiv\"]').click()")
        await page.wait_for_timeout(4200)
        print('station :', await P.js("() => document.querySelector('[data-num]').textContent"))

        # fiche du fauteuil, puis le catalogue compatible
        await P.js("() => document.querySelector('[data-piece=\"deluxe:fauteuil\"]').click()")
        await page.wait_for_timeout(2600)
        print('bouton catalogue :', await P.js("() => { const b = document.querySelector('[data-cata-ouvrir]'); return [b.hidden, b.textContent.trim()]; }"))
        await P.shot('fiche-fauteuil')
        await P.js("() => document.querySelector('[data-cata-ouvrir]').click()")
        await page.wait_for_timeout(1500)
        print('catalogue :', await P.js("() => [document.querySelector('.cata__titre').textContent, document.querySelector('.cata__nb').textContent, document.querySelectorAll('.puce').length]"))
        await P.shot('catalogue')
        # filtre matière : cuir, puis couleur : sombres
        await P.js("() => document.querySelector('.puce[data-f=\"mat\"][data-v=\"cuir\"]').click()")
        await page.wait_for_timeout(500)
        await P.js("() => { const b = document.querySelector('.puce[data-f=\"fc\"][data-v=\"sombre\"]'); if (b) b.click(); }")
        await page.wait_for_timeout(700)
        print('filtré :', await P.js("() => document.querySelector('.cata__nb').textContent"))
        await P.shot('catalogue-filtre')
        # une pièce du catalogue (pas une proposition)
        sku = await P.js("() => { const b = [...document.querySelectorAll('.pc:not([hidden])')].find(x => !x.querySelector('.pc__badge:not(.pc__badge--actuel)')); b.click(); return b.dataset.sku; }")
        await page.wait_for_timeout(2400)
        print('choisi :', sku, await P.js("s => [MC_DATA.PRODUITS[s].nom, MC_ETAT.choix.deluxe && MC_ETAT.choix.deluxe.fauteuil]", sku))
        await P.shot('catalogue-choix')
        # recherche texte
        await page.fill('.cata__cherche input', 'velours vert')
        await page.wait_for_timeout(700)
        print('recherche « velours vert » :', await P.js("() => document.querySelector('.cata__nb').textContent"))
        await P.js("() => document.querySelector('[data-cata-raz]') && document.querySelector('[data-cata-raz]').click()")
        await page.fill('.cata__cherche input', '')
        await page.wait_for_timeout(400)
        await P.js("() => document.querySelector('[data-cata-fermer]').click()")
        await page.wait_for_timeout(900)
        print('fiche :', await P.js("() => [document.querySelector('.fiche__nom').textContent, document.querySelectorAll('.variante').length, document.querySelector('.variante--choix') && document.querySelector('.variante--choix').textContent]"))
        await P.shot('fiche-choix')
        await P.js("() => document.querySelector('[data-dans-piece]').click()")
        await page.wait_for_timeout(3600)
        await P.shot('dans-la-piece')

        # un lit du catalogue à chevets intégrés, très large
        lit = await P.js("() => MC_DATA.compatibles('deluxe', 'lit').find(s => MC_DATA.PRODUITS[s].chevets && !MC_DATA.PRODUITS[s].look)")
        await P.js("s => document.querySelector('[data-piece=\"deluxe:lit\"]').click()", lit)
        await page.wait_for_timeout(2600)
        await P.js("() => document.querySelector('[data-cata-ouvrir]').click()")
        await page.wait_for_timeout(1200)
        await P.js("s => document.querySelector('.pc[data-sku=\"' + s + '\"]').click()", lit)
        await page.wait_for_timeout(2200)
        print('lit :', lit, await P.js("s => MC_DATA.PRODUITS[s].nom", lit))
        await P.shot('lit-studio')
        await P.js("() => document.querySelector('[data-cata-fermer]').click()")
        await page.wait_for_timeout(500)
        await P.js("() => document.querySelector('[data-dans-piece]').click()")
        await page.wait_for_timeout(3600)
        await P.shot('lit-dans-la-piece')
        await P.js("() => document.querySelector('[data-vue=\"oeil\"]').click()")
        await page.wait_for_timeout(2800)
        await P.shot('lit-interieur')

        # rendu réaliste (serveur simulé)
        await P.js("() => document.querySelector('[data-rendu]').click()")
        await page.wait_for_timeout(1500)
        print('rendu :', await P.js("() => [document.querySelector('.rendu__titre').textContent, document.querySelectorAll('.rendu__sources figure').length, !document.querySelector('[data-rendu-generer]').hidden, document.querySelector('.rendu__indispo').hidden]"))
        await P.shot('rendu-ouvert')
        await P.js("() => document.querySelector('[data-rendu-generer]').click()")
        await page.wait_for_timeout(3000)
        print('   attente :', await P.js("() => document.querySelector('.rendu__etat').textContent"))
        await P.shot('rendu-attente')
        await page.wait_for_timeout(8000)
        print('   résultat :', await P.js("() => [document.querySelector('#rendu').classList.contains('a-resultat'), !document.querySelector('.rendu__alerte').hidden, !document.querySelector('.rendu__monde').hidden]"))
        await P.js("() => { const c = document.querySelector('.rendu__curseur'); c.value = 30; c.dispatchEvent(new Event('input')); }")
        await page.wait_for_timeout(1600)
        await P.shot('rendu-resultat')
        await P.js("() => document.querySelector('[data-monde-generer]').click()")
        await page.wait_for_timeout(2500)
        print('   monde :', await P.js("() => document.querySelector('.rendu__monde-etat').textContent"))
        await page.wait_for_timeout(21000)
        print('   monde :', await P.js("() => [document.querySelector('.rendu__monde-etat').textContent, !document.querySelector('[data-monde-ouvrir]').hidden]"))
        await P.shot('rendu-monde')
        print('appels API :', [a for a in APPELS if a[0] == 'corps'], len(APPELS))
        await P.js("() => document.querySelector('.rendu__fermer').click()")
        await page.wait_for_timeout(900)
        # la sélection garde le choix du catalogue après rechargement
        await page.reload()
        await page.wait_for_selector('.preloader', state='detached', timeout=60000)
        print('après rechargement :', await P.js("() => [MC_ETAT.choix.deluxe && MC_ETAT.choix.deluxe.fauteuil, MC_ETAT.choix.deluxe && MC_ETAT.choix.deluxe.lit]"))
        print('\n--- console ---')
        for l in P.logs:
            if l[0] in ('error', 'warning', 'pageerror'):
                print(l)
        await b.close()
    srv.shutdown()


if __name__ == '__main__':
    asyncio.run(main())
