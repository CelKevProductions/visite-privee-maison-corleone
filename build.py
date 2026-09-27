#!/usr/bin/env python3
"""Assemble la page à partir des sources.

La 3D (three.js + maquettes + moteur) est regroupée par esbuild en un seul
script classique, intégré à la page : aucun module ni import map à charger
depuis un CDN.

dist/index.html : le fragment publié (le squelette <!doctype>/<head>/<body>
                  est ajouté par l'outil de publication).
dist/local.html : la même page dans un squelette équivalent, pour les essais.
"""
import os
import pathlib
import shutil
import subprocess

RACINE = pathlib.Path(__file__).parent
SRC = RACINE / 'src'
DIST = RACINE / 'dist'
PUBLIC = RACINE / 'public'
# icône de l'onglet : la fleur de la charte, sur fond aubergine
ICONE = ("data:image/svg+xml," + "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%232E0422'/%3E"
         "%3Cg fill='%23F2F2E8'%3E%3Cpath d='M32 31C27 25 26.6 18.6 32 15C37.4 18.6 37 25 32 31Z'/%3E%3Cpath d='M32 31C27 25 26.6 18.6 32 15C37.4 18.6 37 25 32 31Z' transform='rotate(90 32 32)'/%3E"
         "%3Cpath d='M32 31C27 25 26.6 18.6 32 15C37.4 18.6 37 25 32 31Z' transform='rotate(180 32 32)'/%3E%3Cpath d='M32 31C27 25 26.6 18.6 32 15C37.4 18.6 37 25 32 31Z' transform='rotate(270 32 32)'/%3E"
         "%3Ccircle cx='32' cy='32' r='2'/%3E%3C/g%3E%3C/svg%3E")
BUILD = RACINE / 'build'
# three, gsap et esbuild : « npm install » à la racine (ou VENDOR=chemin/vers/node_modules)
VENDOR = pathlib.Path(os.environ.get('VENDOR') or (RACINE / 'node_modules' if (RACINE / 'node_modules' / 'three').exists() else '/home/claude/vendor/node_modules'))
CDN = 'https://cdn.jsdelivr.net/npm/'

SQUELETTE_DEBUT = ('<!doctype html><html><head><meta charset="utf-8">'
                   '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
                   '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
                   'body{margin:0;font:14px/1.4 system-ui,sans-serif;background:#FAFAF7}img{max-width:100%}[hidden]{display:none!important}</style>'
                   '</head><body>')
SQUELETTE_FIN = '</body></html>'


def lire(nom):
    return (SRC / nom).read_text(encoding='utf-8')


def bundle_3d():
    """Concatène les fichiers 3D (portée partagée) et les regroupe avec three.js."""
    BUILD.mkdir(exist_ok=True)
    entree = BUILD / 'v3d-entree.js'
    entree.write_text('\n'.join(lire(n) for n in ('v3d-core.js', 'v3d-objets.js', 'v3d-catalogue.js', 'v3d-espaces.js', 'v3d-moteur.js')), encoding='utf-8')
    sortie = BUILD / 'v3d.js'
    env = dict(os.environ, NODE_PATH=str(VENDOR))
    subprocess.run([str(VENDOR / '.bin' / 'esbuild'), str(entree), '--bundle', '--format=iife', '--minify',
                    '--target=es2020', '--legal-comments=eof', '--log-level=warning', '--outfile=' + str(sortie)],
                   check=True, env=env)
    return sortie.read_text(encoding='utf-8')


def gsap_local():
    """GSAP (noyau, SplitText, CustomEase) intégré à la page : aucun script externe."""
    d = VENDOR / 'gsap' / 'dist'
    return [(d / n).read_text(encoding='utf-8') for n in ('gsap.min.js', 'SplitText.min.js', 'CustomEase.min.js')]


def main():
    css = lire('style.css')
    body = lire('body.html')
    catalogue = lire('catalogue.js')
    data = lire('data.js')
    app = lire('app.js')
    v3d = bundle_3d()
    gs = gsap_local()
    for nom, txt in [('app', app), ('catalogue', catalogue), ('data', data), ('v3d', v3d)] + [('gsap%d' % i, t) for i, t in enumerate(gs)]:
        assert '</script' not in txt.lower(), nom

    page = '\n'.join([
        '<title>Visite privée Maison Corleone</title>',
        '<link rel="preconnect" href="https://fonts.googleapis.com">',
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Jost:wght@400;500&family=Oranienbaum&family=Pinyon+Script&display=swap">',
        '<style>', css, '</style>',
        body] +
        ['<script>\n' + t + '\n</script>' for t in gs] + [
        '<script>', catalogue, '</script>',
        '<script>', data, '</script>',
        '<script>', app, '</script>',
        '<script>', v3d, '</script>',
        ''
    ])
    DIST.mkdir(exist_ok=True)
    (DIST / 'index.html').write_text(page, encoding='utf-8')
    (DIST / 'local.html').write_text(SQUELETTE_DEBUT + page + SQUELETTE_FIN, encoding='utf-8')
    print('dist/index.html', len(page.encode('utf-8')) // 1024, 'Ko ; 3D', len(v3d.encode('utf-8')) // 1024, 'Ko')

    # version en ligne (Vercel) : document complet, avec les fonctions api/ à côté
    site = '\n'.join([
        '<!doctype html>',
        '<html lang="fr">',
        '<head>',
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
        '<title>Visite privée · Maison Corleone</title>',
        '<meta name="description" content="Proposition de réaménagement préparée par Maison Corleone : visite 3D des espaces, pièces, prix et rendu réaliste.">',
        '<meta name="robots" content="noindex, nofollow">',
        '<meta name="theme-color" content="#2E0422">',
        '<meta property="og:title" content="Visite privée · Maison Corleone">',
        '<meta property="og:description" content="La proposition de réaménagement, en 3D : chaque pièce avec sa fiche et son prix.">',
        '<meta property="og:image" content="img/chambre-deluxe.webp">',
        '<link rel="icon" href="' + ICONE + '">',
        '<link rel="preconnect" href="https://fonts.googleapis.com">',
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
        '<link rel="preconnect" href="https://cdn.shopify.com" crossorigin>',
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Jost:wght@400;500&family=Oranienbaum&family=Pinyon+Script&display=swap">',
        '<style>', css, '</style>',
        '</head>',
        '<body>',
        body] +
        ['<script>\n' + t + '\n</script>' for t in gs] + [
        '<script>', catalogue, '</script>',
        '<script>', data, '</script>',
        '<script>', app, '</script>',
        '<script>', v3d, '</script>',
        '</body>',
        '</html>',
        ''
    ])
    PUBLIC.mkdir(exist_ok=True)
    (PUBLIC / 'index.html').write_text(site, encoding='utf-8')
    (PUBLIC / 'img').mkdir(exist_ok=True)
    for img in (DIST / 'img').glob('*.webp'):
        shutil.copyfile(img, PUBLIC / 'img' / img.name)
    print('public/index.html', len(site.encode('utf-8')) // 1024, 'Ko')


if __name__ == '__main__':
    main()
