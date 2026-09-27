#!/usr/bin/env python3
"""Banc d'essai local : sert dist/, redirige les polices, parcourt la visite
et prend des captures.

Scénarios : desktop, mobile, repli (sans WebGL), rapide.
"""
import asyncio, functools, http.server, os, pathlib, sys, threading, time
from playwright.async_api import async_playwright

RACINE = pathlib.Path(__file__).resolve().parent.parent
# Chemins relatifs au dépôt, modifiables par variables d'environnement.
ROOT = pathlib.Path(os.environ.get('ROOT') or RACINE / 'dist')
# Polices locales facultatives (machine sans accès à Google Fonts) : Jost.ttf, Oranienbaum.ttf…
FONTS = pathlib.Path(os.environ.get('FONTS') or RACINE / 'build' / 'polices')
OUT = pathlib.Path(os.environ.get('OUT') or RACINE / 'build' / 'captures')
OUT.mkdir(parents=True, exist_ok=True)
PORT = int(os.environ.get('PORT', '8765'))
_vp = os.environ.get('VIEWPORT')
VP = {'width': int(_vp.split('x')[0]), 'height': int(_vp.split('x')[1])} if _vp else None

FONT_CSS = """
@font-face{font-family:'Jost';font-weight:100 900;src:url(https://fonts.gstatic.com/t/Jost.ttf)}
@font-face{font-family:'Oranienbaum';font-weight:400;src:url(https://fonts.gstatic.com/t/Oranienbaum.ttf)}
@font-face{font-family:'Pinyon Script';font-weight:400;src:url(https://fonts.gstatic.com/t/Pinyon.ttf)}
@font-face{font-family:'IBM Plex Mono';font-weight:400;src:url(https://fonts.gstatic.com/t/PlexMono-400.ttf)}
@font-face{font-family:'IBM Plex Mono';font-weight:500;src:url(https://fonts.gstatic.com/t/PlexMono-500.ttf)}
@font-face{font-family:'IBM Plex Mono';font-weight:600;src:url(https://fonts.gstatic.com/t/PlexMono-600.ttf)}
"""

SANS_WEBGL = """
(() => {
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t, o) {
    if (/webgl/i.test(t)) return null;
    return orig.call(this, t, o);
  };
})();
"""


def serve():
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    class Q(http.server.ThreadingHTTPServer):
        allow_reuse_address = True
    srv = Q(('127.0.0.1', PORT), h)
    srv.RequestHandlerClass.log_message = lambda *a, **k: None
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


async def route(r):
    url = r.request.url
    hdr = {'Access-Control-Allow-Origin': '*'}
    if ('fonts.googleapis.com' in url or 'fonts.gstatic.com' in url) and not FONTS.is_dir():
        return await r.continue_()  # pas de polices locales : on les charge depuis Google
    if 'fonts.googleapis.com' in url:
        return await r.fulfill(status=200, body=FONT_CSS, headers=dict(hdr, **{'Content-Type': 'text/css'}))
    if 'fonts.gstatic.com/t/' in url:
        f = FONTS / url.rsplit('/', 1)[1]
        return await r.fulfill(status=200, body=f.read_bytes(), headers=dict(hdr, **{'Content-Type': 'font/ttf'}))
    if url.startswith('http://127.0.0.1'):
        return await r.continue_()
    # toute autre origine (CDN, images Shopify…) : bloquée, comme la CSP de l'aperçu
    print('   bloqué :', url[:90])
    return await r.abort()


class Page:
    def __init__(self, page, nom):
        self.p = page; self.nom = nom; self.n = 0
        self.logs = []
        page.on('console', lambda m: self.logs.append((m.type, m.text)))
        page.on('pageerror', lambda e: self.logs.append(('pageerror', str(e))))

    async def shot(self, label):
        self.n += 1
        f = OUT / f'{self.nom}-{self.n:02d}-{label}.png'
        await self.js("() => { const d = window.__mc3d; if (d) d.pause(); }")
        await self.p.wait_for_timeout(120)
        await self.p.screenshot(path=str(f), timeout=90000)
        await self.js("() => { const d = window.__mc3d; if (d) d.reprise(); }")
        print('capture', f.name)
        return f

    async def js(self, code, arg=None):
        return await self.p.evaluate(code, arg)

    async def etat(self):
        return await self.js("""() => ({
          station: document.querySelector('[data-num]').textContent,
          classes: document.documentElement.className,
          titre: document.querySelector('.site-nav__titre').textContent,
          points: [...document.querySelectorAll('.hs.is-visible')].map(b => b.dataset.espace + ':' + b.dataset.slot),
          etiquettes: document.querySelectorAll('.hs-espace.is-visible').length,
          actif: !!(window.__mc3d && window.__mc3d.actif())
        })""")


async def main(scenario):
    srv = serve()
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'])
        mobile = scenario.startswith('mobile')
        ctx = await b.new_context(
            viewport=VP if VP else ({'width': 390, 'height': 844} if mobile else {'width': 1440, 'height': 900}),
            device_scale_factor=1, is_mobile=mobile, has_touch=mobile,
            reduced_motion='reduce' if scenario == 'reduit' else 'no-preference')
        await ctx.route('**/*', route)
        page = await ctx.new_page()
        await page.add_init_script('window.MC_QUALITE = { dpr: .5, dprMin: .5, ombre: 1024, debug: true };')
        await page.add_init_script("""
          window.__ev = [];
          ['visite3d:progres','visite3d:pret','visite3d:echec'].forEach(n => addEventListener(n, e => __ev.push([n.slice(9), Math.round(performance.now()), e.detail && e.detail.p])));
        """)
        if scenario == 'repli':
            await page.add_init_script(SANS_WEBGL)
        P = Page(page, scenario + ('-' + _vp if _vp else ''))
        t0 = time.time()
        await page.goto(f'http://127.0.0.1:{PORT}/local.html')
        await page.wait_for_timeout(1200)
        await P.shot('prechargement')
        try:
            await page.wait_for_selector('.preloader', state='detached', timeout=45000)
        except Exception as e:
            print('préchargement toujours là', e)
        await P.js('() => window.gsap && gsap.ticker.lagSmoothing(0)')
        print('accueil en', round(time.time() - t0, 1), 's ; 3D :', await P.js('() => !!(window.VISITE3D && window.VISITE3D.ok)'))
        print('événements 3D :', await P.js('() => __ev'))
        await page.wait_for_timeout(1500)
        await P.shot('accueil')
        print('   bouton :', await P.js("() => document.querySelector('#entrer-etat').textContent"))

        if scenario == 'repli':
            await P.js("() => document.querySelector('#entrer').click()")
            await page.wait_for_timeout(1500)
            await P.shot('repli-selection')
            await P.js("() => document.querySelector('[data-voir]').click()")
            await page.wait_for_timeout(1500)
            await P.shot('repli-fiche')
            await P.js("() => document.querySelector('.fiche__fermer').click()")
            await page.wait_for_timeout(1500)
            await P.shot('repli-retour-selection')
        else:
            # entrée dans la visite
            if mobile:
                await page.tap('#entrer')
            else:
                await page.mouse.move(720, 450)
                await page.mouse.wheel(0, 120)
            await page.wait_for_timeout(1000)
            await P.shot('entree-vol')
            await page.wait_for_timeout(4200)
            print('   station 0 :', await P.etat())
            await P.shot('station-00')

            async def suivante(label, attente=3600):
                if mobile:
                    await P.js("() => document.querySelector('[data-station=\"suiv\"]').click()")
                else:
                    await page.mouse.wheel(0, 120)
                await page.wait_for_timeout(attente)
                print('   ', label, await P.etat())
                await P.shot(label)

            await suivante('station-01', 5200)
            # un point sur un meuble : la pièce seule
            pts = await P.js("() => [...document.querySelectorAll('.hs.is-visible')].map(b => b.dataset.slot)")
            if pts:
                await P.js("() => document.querySelector('.hs.is-visible').click()")
                await page.wait_for_timeout(2600)
                await P.shot('piece-seule')
                await P.js("() => { const v = [...document.querySelectorAll('.variante')].find(b => b.getAttribute('aria-pressed') === 'false'); v && v.click(); }")
                await page.wait_for_timeout(2200)
                await P.shot('piece-variante')
                await P.js("() => document.querySelector('[data-dans-piece]').click()")
                await page.wait_for_timeout(3400)
                print('   dans la pièce :', await P.etat())
                await P.shot('dans-la-piece')
            # vue intérieure
            await P.js("() => document.querySelector('[data-vue=\"oeil\"]').click()")
            await page.wait_for_timeout(2800)
            await P.shot('station-01-interieur')
            await P.js("() => document.querySelector('[data-vue=\"maquette\"]').click()")
            await page.wait_for_timeout(600)
            for i in range(2, 8):
                await suivante('station-%02d' % i, 4000 if i in (2, 7) else 3600)
                if i == 3 and not mobile:
                    await P.js("() => document.querySelector('[data-amb=\"1\"]').click()")
                    await page.wait_for_timeout(2400)
                    await P.shot('station-03-soir')
                    await P.js("() => document.querySelector('[data-amb=\"0\"]').click()")
                    await page.wait_for_timeout(600)
            # la sélection et le rendez-vous
            await P.js("() => document.querySelector('.station__in.is-actif [data-panier]').click()")
            await page.wait_for_timeout(1600)
            await P.shot('selection')
            await P.js("() => document.querySelector('.panier [data-modal-open]').click()")
            await page.wait_for_timeout(1400)
            await P.shot('rdv')
            await page.fill('input[name=nom]', 'Test')
            await page.fill('input[name=email]', 'test@example.com')
            await P.js("() => document.querySelector('#rdv-form [type=submit]').click()")
            await page.wait_for_timeout(1200)
            await P.shot('rdv-envoi')
            await P.js("() => document.querySelector('.modal__close').click()")
            await page.wait_for_timeout(700)
            await P.js("() => document.querySelector('.panier__fermer').click()")
            await page.wait_for_timeout(900)
            # menu, puis retour direct à un espace
            await P.js("() => document.querySelector('.menu-btn').click()")
            await page.wait_for_timeout(1600)
            await P.shot('menu')
            await P.js("() => document.querySelector('.menu__list [data-aller=\"3\"]').click()")
            await page.wait_for_timeout(4400)
            print('   menu → 03 :', await P.etat())
            await P.shot('menu-vers-03')
            # retour à l'accueil par l'emblème
            await P.js("() => document.querySelector('[data-accueil]').click()")
            await page.wait_for_timeout(1500)
            await P.shot('sortie-vol')
            await page.wait_for_timeout(4000)
            print('   retour :', await P.etat())
            await P.shot('retour-accueil')

        print('\n--- console ---')
        for l in P.logs:
            if l[0] in ('error', 'warning', 'pageerror'):
                print(l)
        await b.close()
    srv.shutdown()


if __name__ == '__main__':
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else 'desktop'))
