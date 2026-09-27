#!/usr/bin/env python3
"""Planches de contrôle : toutes les maquettes génériques d'une famille du
catalogue, alignées et rendues d'un coup (captures dans OUT).

Usage : python3 test/galerie.py [famille ...]   (par défaut : toutes)
"""
import asyncio, base64, os, pathlib, sys, time
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from run import serve, route, OUT, PORT
from playwright.async_api import async_playwright

FAMILLES = sys.argv[1:] or ['lit', 'fauteuil', 'canape', 'suspension', 'lustre', 'applique', 'baignoire', 'salon-jardin',
                           'sculpture', 'banc', 'pouf', 'tabouret', 'meridienne', 'table', 'meuble', 'miroir', 'tapis', 'plafonnier', 'lampadaire']


async def main():
    srv = serve()
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'])
        ctx = await b.new_context(viewport={'width': 1500, 'height': 1000}, device_scale_factor=1)
        await ctx.route('**/*', route)
        page = await ctx.new_page()
        logs = []
        page.on('console', lambda m: logs.append((m.type, m.text)))
        page.on('pageerror', lambda e: logs.append(('pageerror', str(e))))
        await page.add_init_script('window.MC_QUALITE = { dpr: 1, dprMin: 1, ombre: 1024, debug: true };')
        t0 = time.time()
        await page.goto(f'http://127.0.0.1:{PORT}/local.html')
        await page.wait_for_function('() => window.VISITE3D && window.VISITE3D.ok', timeout=120000)
        print('3D prête en', round(time.time() - t0, 1), 's')
        for fam in FAMILLES:
            skus = await page.evaluate("f => Object.values(MC_DATA.PRODUITS).filter(p => p.fam === f && p.boutique).map(p => p.id)", fam)
            for k in range(0, len(skus), 36):
                lot = skus[k:k + 36]
                col = 6 if len(lot) > 12 else max(3, min(len(lot), 4))
                data = await page.evaluate("""([l, c]) => { __mc3d.galerie(l, c, 2.8); return document.getElementById('scene3d').toDataURL('image/jpeg', .9); }""", [lot, col])
                f = OUT / f'galerie-{fam}-{k // 36 + 1}.jpg'
                f.write_bytes(base64.b64decode(data.split(',', 1)[1]))
                print(fam, len(lot), '->', f.name)
                if len(lot) > 1:
                    noms = await page.evaluate("l => l.map((s, i) => i + ':' + MC_DATA.PRODUITS[s].nom + ' [' + MC_DATA.PRODUITS[s].st + ']')", lot)
                    print('   ', ' | '.join(noms))
        for l in logs:
            if l[0] in ('error', 'pageerror', 'warning'):
                print(l)
        await b.close()
    srv.shutdown()


if __name__ == '__main__':
    asyncio.run(main())
