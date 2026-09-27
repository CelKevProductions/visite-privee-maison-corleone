#!/usr/bin/env python3
"""Mesure du passage de l'accueil à la 3D (clic sur « Entrer ») :
images longues, programmes WebGL compilés, géométries et textures envoyées
au GPU et rendus d'ombres pendant le vol de la caméra.

  python3 test/freeze.py            # page construite dans dist/
Sans GPU (SwiftShader), les durées sont gonflées : on regarde surtout ce qui
se passe pendant le vol (compilations, envois, ombres), qui devrait être nul.
"""
import asyncio, json, sys, time
from run import serve, route, PORT
from playwright.async_api import async_playwright

MESURE = """() => {
  const r = __mc3d.renderer, i = r.info;
  return { prog: i.programs.length, geo: i.memory.geometries, tex: i.memory.textures, ombres: window.__sh || 0 };
}"""

async def main():
    srv = serve()
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = await b.new_context(viewport={'width': 1280, 'height': 800})
        await ctx.route('**/*', route)
        page = await ctx.new_page()
        await page.add_init_script('window.MC_QUALITE = { dpr: .6, dprMin: .5, debug: true };')
        t0 = time.time()
        await page.goto(f'http://127.0.0.1:{PORT}/local.html')
        await page.wait_for_function('window.VISITE3D && window.VISITE3D.ok === true', timeout=180000)
        await page.wait_for_selector('.preloader', state='detached', timeout=60000)
        print('prêt en', round(time.time() - t0, 1), 's', flush=True)
        await page.wait_for_timeout(1500)
        await page.evaluate('''() => {
          const r = __mc3d.renderer; window.__sh = 0;
          const o = r.shadowMap.render.bind(r.shadowMap);
          r.shadowMap.render = (...a) => { if (r.shadowMap.needsUpdate) window.__sh++; return o(...a); };
          // rendus lents : durée, programmes compilés pendant le rendu, ombres recalculées
          window.__rendus = [];
          const rr = r.render.bind(r);
          r.render = (sc, cm) => {
            const p0 = r.info.programs.length, noms0 = new Set(r.info.programs), ombre = r.shadowMap.needsUpdate, t = performance.now();
            const res = rr(sc, cm);
            const d = performance.now() - t;
            if (d > 120) __rendus.push({ t: Math.round(t), d: Math.round(d), ombre, nouveaux: r.info.programs.filter(p => !noms0.has(p)).map(p => p.name + ' ' + (p.cacheKey || '').slice(0, 60)) });
            return res;
          };
          window.__longues = [];
          try { new PerformanceObserver(l => l.getEntries().forEach(e => __longues.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: false }); } catch (_) {}
        }''')
        avant = await page.evaluate(MESURE)
        # images pendant 9 s après le clic
        await page.evaluate('''() => { window.__images = []; let d = performance.now();
          const f = now => { __images.push([Math.round(now), Math.round(now - d)]); d = now; if (__images.length < 2000) requestAnimationFrame(f); };
          requestAnimationFrame(f); window.__clic = performance.now(); }''')
        await page.click('#entrer')
        await page.wait_for_timeout(9000)
        apres = await page.evaluate(MESURE)
        res = await page.evaluate('() => ({ clic: __clic, images: __images, longues: __longues, rendus: __rendus })')
        for x in res['rendus']:
            print('rendu lent à', round(x['t'] - res['clic']), 'ms :', x['d'], 'ms', '(ombres)' if x['ombre'] else '', x['nouveaux'][:8])
        clic = res['clic']
        longues = [(round(t - clic), d) for t, d in res['longues'] if t >= clic - 50]
        images = [(round(t - clic), d) for t, d in res['images'] if t >= clic]
        dts = sorted(d for _, d in images)
        print('avant le clic :', avant)
        print('après le vol  :', apres)
        print('compilés pendant le vol :', apres['prog'] - avant['prog'], '· géométries envoyées :', apres['geo'] - avant['geo'],
              '· textures :', apres['tex'] - avant['tex'], '· rendus d’ombres :', apres['ombres'])
        print('images :', len(images), '· médiane', dts[len(dts) // 2] if dts else '-', 'ms · max', max(dts) if dts else '-', 'ms')
        print('images > 150 ms (t depuis le clic, durée) :', [x for x in images if x[1] > 150][:30])
        print('tâches longues :', longues[:30])
        await b.close()
    srv.shutdown()

asyncio.run(main())
