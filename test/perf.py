import asyncio, pathlib, sys, time
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from run import serve, route, PORT
from playwright.async_api import async_playwright

async def main():
    srv = serve()
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = await b.new_context(viewport={'width': 1440, 'height': 900})
        await ctx.route('**/*', route)
        page = await ctx.new_page()
        await page.add_init_script('window.MC_QUALITE = { dpr: .5, dprMin: .5, bloom: false, ombre: 1024, debug: true };')
        page.on('console', lambda m: print('console', m.type, m.text) if m.type in ('error','warning') else None)
        t0 = time.time()
        await page.goto(f'http://127.0.0.1:{PORT}/local.html')
        print('goto', round(time.time()-t0,1), flush=True)
        await page.wait_for_selector('.preloader', state='detached', timeout=40000)
        print('preloader gone', round(time.time()-t0,1), flush=True)
        await page.evaluate('''() => { const r = __mc3d.renderer; window.__sh = 0; const o = r.shadowMap.render.bind(r.shadowMap); r.shadowMap.render = (...a) => { if (r.shadowMap.needsUpdate) __sh++; return o(...a); }; }''')
        for i in range(3):
            r = await page.evaluate("""() => new Promise(res => { const t = []; let last = performance.now(); let n = 0;
              const f = () => { const now = performance.now(); t.push(Math.round(now - last)); last = now; if (++n < 15) requestAnimationFrame(f); else res({t, mode: VISITE3D.getMode(), amb: VISITE3D.getAmbiance(), sh: __sh, calls: __mc3d.renderer.info.render.calls, tri: __mc3d.renderer.info.render.triangles, prog: __mc3d.renderer.info.programs.length, tex: __mc3d.renderer.info.memory.textures, geo: __mc3d.renderer.info.memory.geometries}); };
              requestAnimationFrame(f); })""")
            print(i, round(time.time()-t0,1), r, flush=True)
        await b.close()
    srv.shutdown()
asyncio.run(main())
