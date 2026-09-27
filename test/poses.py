#!/usr/bin/env python3
"""Essai de poses de caméra (téléphone) : une capture par pose."""
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from run import serve, route, OUT, PORT
from playwright.async_api import async_playwright

POSES = json.loads(sys.argv[1])
VP = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {'width': 390, 'height': 844}

async def main():
    srv = serve()
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'])
        ctx = await b.new_context(viewport=VP, device_scale_factor=1, is_mobile=VP['width'] < 700, has_touch=VP['width'] < 700)
        await ctx.route('**/*', route)
        page = await ctx.new_page()
        await page.add_init_script('window.MC_QUALITE = { dpr: .6, dprMin: .6, ombre: 1024, debug: true };')
        await page.goto(f'http://127.0.0.1:{PORT}/local.html')
        await page.wait_for_function('() => window.VISITE3D && window.VISITE3D.ok', timeout=60000)
        await page.wait_for_selector('.preloader', state='detached', timeout=45000)
        await page.evaluate("""() => { document.querySelector('.hero').classList.add('is-parti'); document.documentElement.classList.add('mode-3d');
          VISITE3D.setActif(true); VISITE3D.setEspace(null, { etiquettes: true }); }""")
        for i, p in enumerate(POSES):
            await page.evaluate('p => { VISITE3D.setDecalage(p.dx || 0, p.dy || 0, true); VISITE3D.placer(p, !!p.brut); }', p)
            await page.wait_for_timeout(1800)
            await page.evaluate('() => window.__mc3d.pause()')
            f = OUT / f'pose-{i:02d}.png'
            await page.screenshot(path=str(f))
            await page.evaluate('() => window.__mc3d.reprise()')
            print('capture', f.name, p)
        await b.close()
    srv.shutdown()

asyncio.run(main())
