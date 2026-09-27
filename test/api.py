#!/usr/bin/env python3
"""Essai de bout en bout de la version en ligne : public/index.html servie avec
les vraies fonctions api/*.js (fal.ai et World Labs simulés par test/serveur_api.mjs).
Vérifie aussi les refus : autre origine, suivi vers un autre hôte, image invalide."""
import asyncio, json, pathlib, subprocess, sys, time, urllib.request
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from run import route, OUT, FONTS
from playwright.async_api import async_playwright

PORT = 8790
RACINE = pathlib.Path(__file__).resolve().parent.parent


def appel(methode, chemin, corps=None, entetes=None):
    req = urllib.request.Request(f'http://127.0.0.1:{PORT}{chemin}', method=methode,
                                 data=json.dumps(corps).encode() if corps is not None else None,
                                 headers=dict({'Content-Type': 'application/json'}, **(entetes or {})))
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b'{}')


async def main():
    srv = subprocess.Popen(['node', str(RACINE / 'test' / 'serveur_api.mjs'), str(PORT)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    srv.stdout.readline()
    try:
        # refus attendus (appels directs, sans page)
        print('état :', appel('GET', '/api/etat'))
        print('sans origine :', appel('POST', '/api/rendu', {'maquette': 'x'}))
        o = {'Origin': f'http://127.0.0.1:{PORT}'}
        print('maquette invalide :', appel('POST', '/api/rendu', {'maquette': 'data:image/jpeg;base64,@@'}, o))
        print('suivi détourné :', appel('GET', '/api/rendu?suivi=' + urllib.parse.quote('https://evil.example/requests/0f6c7c0e-3f1d-4d0b-9d6a-7f5b3b2b1a10/status') + '&resultat=x', None, o))
        print('monde, image étrangère :', appel('POST', '/api/monde', {'image': 'https://evil.example/a.jpg'}, o))
        print('autre site :', appel('POST', '/api/monde', {'image': 'https://v3.fal.media/files/a.jpg'}, {'Origin': 'https://pirate.example'}))

        async with async_playwright() as pw:
            b = await pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'])
            ctx = await b.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)

            async def r2(r):
                u = r.request.url
                if u.startswith(f'http://127.0.0.1:{PORT}'):
                    return await r.continue_()
                if 'fal.media' in u:   # l'image « générée » : une photo locale
                    return await r.fulfill(status=200, body=(RACINE / 'public' / 'img' / 'chambre-deluxe.webp').read_bytes(), headers={'Content-Type': 'image/webp'})
                return await route(r)
            await ctx.route('**/*', r2)
            page = await ctx.new_page()
            logs = []
            page.on('console', lambda m: logs.append((m.type, m.text)))
            page.on('pageerror', lambda e: logs.append(('pageerror', str(e))))
            await page.add_init_script('window.MC_QUALITE = { dpr: .5, dprMin: .5, ombre: 1024 };')
            await page.goto(f'http://127.0.0.1:{PORT}/')
            print('titre :', await page.title())
            await page.wait_for_selector('.preloader', state='detached', timeout=60000)
            await page.wait_for_function('() => window.VISITE3D && window.VISITE3D.ok', timeout=60000)
            await page.evaluate('() => gsap.ticker.lagSmoothing(0)')
            await page.evaluate("() => document.querySelector('#entrer').click()")
            await page.wait_for_timeout(5000)
            await page.evaluate("() => document.querySelector('[data-aller=\"3\"]') ? document.querySelector('[data-aller=\"3\"]').click() : null")
            await page.wait_for_timeout(5000)
            await page.evaluate("() => document.querySelector('[data-amb=\"1\"]').click()")
            await page.wait_for_timeout(2500)
            await page.evaluate("() => document.querySelector('[data-rendu]').click()")
            await page.wait_for_timeout(1500)
            print('fenêtre :', await page.evaluate("() => [document.querySelector('.rendu__titre').textContent, document.querySelector('[data-rendu-generer]').hidden, document.querySelector('.rendu__indispo').hidden]"))
            await page.evaluate("() => document.querySelector('[data-rendu-generer]').click()")
            for i in range(12):
                await page.wait_for_timeout(2500)
                fini = await page.evaluate("() => document.querySelector('#rendu').classList.contains('a-resultat')")
                if fini:
                    break
            print('rendu affiché :', fini, await page.evaluate("() => [document.querySelector('[data-rendu-ouvrir]').href, document.querySelector('.rendu__indispo').textContent]"))
            await page.wait_for_timeout(1600)
            await page.screenshot(path=str(OUT / 'api-rendu.png'))
            await page.evaluate("() => document.querySelector('[data-monde-generer]').click()")
            for i in range(6):
                await page.wait_for_timeout(5000)
                pret = await page.evaluate("() => !document.querySelector('[data-monde-ouvrir]').hidden")
                if pret:
                    break
            print('monde :', pret, await page.evaluate("() => [document.querySelector('[data-monde-ouvrir]').href, document.querySelector('.rendu__monde-etat').textContent]"))
            await page.screenshot(path=str(OUT / 'api-monde.png'))
            j = json.loads(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/__journal').read())
            for e in j:
                if 'api' not in e:
                    print('  ', e)
            print('   appels :', [e['api'] + ' ' + str(e['statut']) for e in j if 'api' in e][-14:])
            print('\n--- console ---')
            for l in logs:
                if l[0] in ('error', 'pageerror'):
                    print(l)
            await b.close()
        print('\n--- consigne envoyée ---')
        print((RACINE / 'build' / 'derniere-consigne.txt').read_text())
    finally:
        srv.terminate()


if __name__ == '__main__':
    asyncio.run(main())
