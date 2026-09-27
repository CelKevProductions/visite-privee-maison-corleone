#!/usr/bin/env python3
"""Mesure du chargement : étapes de la maquette et longues tâches pendant le préchargement."""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from run import serve, route, PORT
from playwright.async_api import async_playwright

async def main():
    srv = serve()
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'])
        ctx = await b.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
        await ctx.route('**/*', route)
        page = await ctx.new_page()
        await page.add_init_script('window.MC_QUALITE = { debug: true };')
        await page.add_init_script("""
          window.__longues = [];
          try { new PerformanceObserver(l => l.getEntries().forEach(e => __longues.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true }); } catch (e) {}
          window.__ev = [];
          ['visite3d:progres','visite3d:pret'].forEach(n => addEventListener(n, e => __ev.push([n.slice(9), Math.round(performance.now()), e.detail && e.detail.p])));
        """)
        await page.goto(f'http://127.0.0.1:{PORT}/local.html')
        await page.wait_for_selector('.preloader', state='detached', timeout=60000)
        ch = await page.evaluate('() => window.__chrono')
        prev = None
        for nom, t in ch:
            print(f'{t:6d} ms  +{t - prev if prev is not None else 0:5d}  {nom}')
            prev = t
        lt = await page.evaluate('() => __longues')
        print('longues tâches (début, durée) :', lt)
        print('total bloqué :', sum(d for _, d in lt), 'ms')
        await b.close()
    srv.shutdown()

asyncio.run(main())
