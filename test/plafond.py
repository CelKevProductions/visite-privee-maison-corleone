#!/usr/bin/env python3
"""Vue « Intérieur » : en tournant la caméra (glisser), la caméra reste dans la
pièce et le plafond reste affiché. Captures dans OUT (plafond-*.png)."""
import asyncio, sys
from run import serve, route, OUT, PORT
from playwright.async_api import async_playwright

ETAT = """() => {
  const g = __mc3d.scene.getObjectByName('espace-deluxe'), c = __mc3d.camera.position;
  const plafonds = []; g.traverse(o => { if (o.isMesh && o.material && o.material.name === 'plafond') plafonds.push(o.visible); });
  return { plafond: plafonds, camera: [c.x, c.y, c.z].map(v => +(v - (v === c.y ? 0 : 0)).toFixed(2)), local: [+(c.x - g.position.x).toFixed(2), +c.y.toFixed(2), +(c.z - g.position.z).toFixed(2)] };
}"""

async def main():
    srv = serve()
    ok = True
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = await b.new_context(viewport={'width': 1280, 'height': 800})
        await ctx.route('**/*', route)
        page = await ctx.new_page()
        await page.add_init_script('window.MC_QUALITE = { dpr: .6, dprMin: .5, debug: true };')
        await page.goto(f'http://127.0.0.1:{PORT}/local.html')
        await page.wait_for_function('window.VISITE3D && window.VISITE3D.ok === true', timeout=180000)
        await page.wait_for_selector('.preloader', state='detached', timeout=60000)
        await page.click('#entrer')
        await page.wait_for_timeout(6000)
        await page.click('[data-station="suiv"]')
        await page.wait_for_timeout(5000)
        await page.click('[data-vue="oeil"]')
        await page.wait_for_timeout(5000)
        e0 = await page.evaluate(ETAT)
        print('intérieur, au repos :', e0)
        await page.screenshot(path=str(OUT / 'plafond-1-repos.png'))
        for i, (dx, dy) in enumerate([(320, 0), (-640, 0), (0, -160)]):
            x, y = 640, 420
            await page.mouse.move(x, y)
            await page.mouse.down()
            for s in range(1, 11):
                await page.mouse.move(x + dx * s / 10, y + dy * s / 10)
                await page.wait_for_timeout(30)
            await page.mouse.up()
            await page.wait_for_timeout(2500)
            e = await page.evaluate(ETAT)
            print('après glisser', (dx, dy), ':', e)
            await page.screenshot(path=str(OUT / f'plafond-{i + 2}-glisse.png'))
            if not all(e['plafond']) or e['local'] != e0['local']:
                ok = False
        await b.close()
    srv.shutdown()
    print('OK : plafond toujours là, caméra immobile' if ok else 'ÉCHEC')
    sys.exit(0 if ok else 1)

asyncio.run(main())
