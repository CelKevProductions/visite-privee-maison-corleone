#!/usr/bin/env python3
"""Parcours au clavier : entrée, stations, pièce seule, Échap."""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from run import serve, route, OUT, PORT, Page
from playwright.async_api import async_playwright

async def main():
    srv = serve()
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'])
        ctx = await b.new_context(viewport={'width': 1280, 'height': 800}, device_scale_factor=1)
        await ctx.route('**/*', route)
        page = await ctx.new_page()
        await page.add_init_script('window.MC_QUALITE = { dpr: .5, dprMin: .5, ombre: 1024, debug: true };')
        P = Page(page, 'clavier')
        await page.goto(f'http://127.0.0.1:{PORT}/local.html')
        await page.wait_for_selector('.preloader', state='detached', timeout=45000)
        await P.js('() => gsap.ticker.lagSmoothing(0)')
        await page.wait_for_timeout(2500)
        etat = lambda: P.js("""() => ({ num: document.querySelector('[data-num]').textContent, cls: document.documentElement.className,
             focus: document.activeElement && (document.activeElement.className || document.activeElement.tagName),
             studio: document.documentElement.classList.contains('studio-open'), fiche: document.querySelector('#fiche').classList.contains('is-open') })""")
        await page.keyboard.press('ArrowDown')
        await page.wait_for_timeout(5500)
        print('après ↓ :', await etat())
        await page.keyboard.press('ArrowDown'); await page.wait_for_timeout(1200)
        await page.keyboard.press('ArrowDown'); await page.wait_for_timeout(4200)
        print('après ↓↓ :', await etat())
        # tabulation jusqu'à la première pièce du panneau
        for i in range(30):
            await page.keyboard.press('Tab')
            cls = await P.js('() => document.activeElement.className')
            if 'piece' in cls:
                break
        print('focus :', await P.js("() => document.activeElement.getAttribute('aria-label')"))
        await page.keyboard.press('Enter'); await page.wait_for_timeout(2400)
        print('après Entrée :', await etat())
        await P.shot('studio-clavier')
        await page.keyboard.press('Escape'); await page.wait_for_timeout(2000)
        print('après Échap :', await etat())
        await page.keyboard.press('Home'); await page.wait_for_timeout(4200)
        print('après Début :', await etat())
        await page.keyboard.press('ArrowUp'); await page.wait_for_timeout(6500)
        print('après ↑ (accueil) :', await etat())
        errs = [l for l in P.logs if l[0] in ('error', 'pageerror') and 'ERR_FAILED' not in l[1]]
        print('erreurs :', errs)
        await b.close()
    srv.shutdown()

asyncio.run(main())
