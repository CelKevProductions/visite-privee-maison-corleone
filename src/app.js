/* =================================================================
   Visite privée — Maison Corleone (v6)
   Le préchargement et l'accueil sont en 2D. Passé « Entrer dans la
   visite », tout se joue dans la maquette 3D : stations animées par
   GSAP (caméra three.js), points sur les meubles, pièce seule avec sa
   fiche (description, prix, variantes), sélection et budget.
   La maquette arrive par window.VISITE3D (script intégré à la page).
   ================================================================= */
(() => {
  'use strict';

  document.documentElement.lang = 'fr';
  const DATA = window.MC_DATA;
  const { CONFIG, PRODUITS, ESPACES } = DATA;

  /* ---------------------------------------------------------------
     Outils
     --------------------------------------------------------------- */
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const root = document.documentElement;
  const hasGSAP = !!(window.gsap && window.SplitText && window.CustomEase);
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ANIM = hasGSAP && !REDUCE;
  const TACTILE = matchMedia('(pointer: coarse)').matches;
  // panneau de la station en bas de l'écran (même règle que la feuille de style)
  const MQ_BAS = matchMedia('(max-width: 699px), (orientation: portrait) and (max-width: 1100px)');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pad2 = n => String(n).padStart(2, '0');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const f0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const f2 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const prix = v => (Math.abs(v - Math.round(v)) < .001 ? f0 : f2).format(v);
  const prixT = v => f0.format(Math.round(v));
  const pl = (n, mot) => n + ' ' + mot + (n > 1 ? 's' : '');
  const has3D = () => !!(window.VISITE3D && window.VISITE3D.ok);
  const V = () => window.VISITE3D;
  const MOTS = ['Zéro', 'Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept', 'Huit', 'Neuf', 'Dix'];
  const enLettres = n => MOTS[n] || String(n);
  // visibilité sans animation (mouvement réduit, ou GSAP absent)
  const montrer = (el, on) => { if (!el) return; el.style.opacity = on ? '1' : '0'; el.style.visibility = on ? 'visible' : 'hidden'; };

  /* ---------------------------------------------------------------
     Départ et pauses de la maquette 3D : sa construction occupe le
     navigateur, elle attend donc que l'introduction du préchargement
     soit jouée, et se met en pause pendant l'ouverture sur l'accueil
     --------------------------------------------------------------- */
  let feu3D = null, pause3D = null, libere3D = null;
  window.MC_FEU_3D = new Promise(r => { feu3D = r; });
  const donnerFeu = () => { if (feu3D) { feu3D(); feu3D = null; } };
  setTimeout(donnerFeu, 5000);
  window.MC_ATTENTE_3D = () => pause3D || Promise.resolve();
  function suspendre3D(ms) {
    if (!pause3D) pause3D = new Promise(r => { libere3D = r; });
    setTimeout(() => { const l = libere3D; pause3D = null; libere3D = null; if (l) l(); }, ms);
  }

  function alea(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  /* ---------------------------------------------------------------
     État de la sélection (partagé avec la maquette, gardé sur l'appareil)
     --------------------------------------------------------------- */
  const DEF = {};
  ESPACES.forEach(e => { DEF[e.id] = e; });
  const slotDef = (eid, sid) => DEF[eid].emplacements.find(s => s.id === sid);
  const CLE = 'mc-visite-privee-v5';
  const ETAT = { choix: {}, retenu: {}, quantites: {} };
  try {
    const s = JSON.parse(localStorage.getItem(CLE) || 'null');
    if (s && typeof s === 'object') {
      ESPACES.forEach(e => {
        e.emplacements.forEach(sl => {
          const c = s.choix && s.choix[e.id] && s.choix[e.id][sl.id];
          if (c && PRODUITS[c] && DATA.compatibles(e.id, sl.id).includes(c)) (ETAT.choix[e.id] = ETAT.choix[e.id] || {})[sl.id] = c;
          const r = s.retenu && s.retenu[e.id] && s.retenu[e.id][sl.id];
          if (r === false) (ETAT.retenu[e.id] = ETAT.retenu[e.id] || {})[sl.id] = false;
        });
        const q = s.quantites && s.quantites[e.id];
        if (Number.isInteger(q) && q >= 0 && q < 10000) ETAT.quantites[e.id] = q;
      });
    }
  } catch (_) { /* stockage indisponible : la sélection repart de la proposition */ }
  window.MC_ETAT = ETAT;
  function sauver() { try { localStorage.setItem(CLE, JSON.stringify(ETAT)); } catch (_) { /* rien */ } }

  const choixDe = (eid, sid) => (ETAT.choix[eid] && ETAT.choix[eid][sid]) || slotDef(eid, sid).choix[0];
  const retenuDe = (eid, sid) => !(ETAT.retenu[eid] && ETAT.retenu[eid][sid] === false);
  const quantiteDe = eid => (ETAT.quantites[eid] !== undefined ? ETAT.quantites[eid] : DEF[eid].quantite);
  const sing = e => e.unite.replace(/s$/, '');
  const qteLabel = (e, n) => n + ' ' + (n > 1 ? sing(e) + 's' : sing(e));
  const deOu = mot => (/^[aeiouéèêh]/i.test(mot) ? "d'" : 'de ');

  function budgetEspace(eid) {
    const e = DEF[eid];
    let unite = 0, devis = 0, pieces = 0, lignes = 0;
    e.emplacements.forEach(s => {
      if (!retenuDe(eid, s.id)) return;
      const p = PRODUITS[choixDe(eid, s.id)];
      lignes++;
      pieces += s.qte;
      if (p && p.prix > 0) unite += p.prix * s.qte; else devis++;
    });
    const n = quantiteDe(eid);
    return { unite, devis, pieces, lignes, n, total: unite * n };
  }
  function budgetTotal() {
    const t = { total: 0, devis: 0, pieces: 0, lignes: 0, espaces: 0 };
    ESPACES.forEach(e => {
      const b = budgetEspace(e.id);
      t.total += b.total;
      if (b.n > 0 && b.lignes) { t.espaces++; t.lignes += b.lignes; t.pieces += b.pieces * b.n; t.devis += b.devis; }
    });
    return t;
  }
  const chambresEtSuites = () => ESPACES.filter(e => /chambre|suite/i.test(e.type)).reduce((n, e) => n + quantiteDe(e.id), 0);

  /* ---------------------------------------------------------------
     Textes de la proposition (réglages)
     --------------------------------------------------------------- */
  $$('[data-fill]').forEach(el => { const v = CONFIG[el.dataset.fill]; if (v) el.textContent = v; });
  if (!CONFIG.afficherPrix) root.classList.add('sans-prix');

  /* ---------------------------------------------------------------
     Les stations de la visite :
     00 vue d'ensemble · 01 à 06 un espace chacune · 07 la proposition, le soir
     --------------------------------------------------------------- */
  const NB = ESPACES.length;
  const DERNIERE = NB + 1;
  const NB_PIECES = ESPACES.reduce((n, e) => n + e.emplacements.length, 0);
  const espaceDe = n => (n >= 1 && n <= NB ? ESPACES[n - 1] : null);
  const stationDe = eid => ESPACES.findIndex(e => e.id === eid) + 1;
  const nomStation = n => (n === 0 ? 'Vue d’ensemble' : n === DERNIERE ? 'La proposition' : espaceDe(n).nom);

  const stationEl = $('.station');
  const liste = items => '<ol class="station__pieces">' + items.join('') + '</ol>';
  function pieceHTML(e, s, i) {
    return '<li><button class="piece" type="button" data-piece="' + e.id + ':' + s.id + '"><em>' + pad2(i + 1) + '</em>' +
      '<span class="piece__txt"><small>' + esc(s.label) + (s.qte > 1 ? ' · ' + s.qte : '') + '</small><b data-piece-nom></b></span>' +
      '<span class="piece__prix" data-prix data-piece-prix></span></button></li>';
  }
  function panneauHTML(n) {
    const pill = txt => '<p><span class="pill station__pill"><i></i>' + txt + '</span></p>';
    if (n === 0) {
      return pill('Maison Corleone · ' + esc(CONFIG.hotelCourt)) +
        '<h2 class="station__titre display">' + enLettres(NB) + ' espaces</h2>' +
        '<p class="station__script script">Vue d’ensemble</p>' +
        '<p class="station__texte">Chambres, suites, lobby, bar et jardin, meublés avec les pièces proposées. Choisissez un espace, puis ' +
        (TACTILE ? 'touchez' : 'cliquez sur') + ' un meuble pour le voir seul, avec sa description et son prix.</p>' +
        liste(ESPACES.map((e, i) => '<li><button class="piece" type="button" data-aller="' + (i + 1) + '"><em>' + pad2(i + 1) + '</em>' +
          '<span class="piece__txt"><small>' + esc(e.type) + '</small><b>' + esc(e.nom) + '</b></span>' +
          '<span class="piece__prix" data-station-qte="' + e.id + '"></span></button></li>')) +
        '<p class="station__data mono"><span><b>' + NB_PIECES + '</b> pièces proposées</span><span><b data-nb-chambres></b> chambres et suites</span></p>';
    }
    if (n === DERNIERE) {
      return pill('(' + pad2(n) + ') La proposition') +
        '<h2 class="station__titre display">Votre sélection</h2>' +
        '<p class="station__script script">Le soir venu</p>' +
        '<p class="station__texte"><span data-final-resume></span> Envoyez-nous vos plans : nous construisons la maquette de votre hôtel et vous adressons la proposition chiffrée.</p>' +
        '<div class="station__total" data-prix><span class="mono">Budget indicatif, prix catalogue</span><b data-total-visite></b></div>' +
        '<div class="station__actions"><button class="btn btn--sm" type="button" data-panier>Voir ma sélection</button>' +
        '<button class="btn btn--sm btn--solid" type="button" data-modal-open>Prendre rendez-vous</button></div>';
    }
    const e = espaceDe(n);
    const long = Math.max.apply(null, e.nom.split(/\s+/).map(w => w.length)) > 10;
    return pill('(' + pad2(n) + ') ' + esc(e.type) + ' · <span data-station-qte="' + e.id + '"></span>') +
      '<h2 class="station__titre display' + (long ? ' station__titre--long' : '') + '">' + esc(e.nom) + '</h2>' +
      '<p class="station__script script">' + esc(e.accroche) + '</p>' +
      '<p class="station__texte">' + esc(e.texte) + '</p>' +
      liste(e.emplacements.map((s, i) => pieceHTML(e, s, i))) +
      '<p class="station__data mono"><span>Maquette ' + esc(e.maquette) + '</span><span data-prix>Par ' + esc(sing(e)) + ' <b data-station-prix="' + e.id + '"></b></span></p>';
  }
  const panneaux = [];
  for (let n = 0; n <= DERNIERE; n++) {
    const a = document.createElement('article');
    a.className = 'station__in';
    a.dataset.k = String(n);
    a.tabIndex = -1;
    a.setAttribute('aria-label', nomStation(n));
    a.innerHTML = panneauHTML(n);
    stationEl.appendChild(a);
    panneaux.push(a);
  }

  // le menu liste les stations
  const indices = Array.from({ length: DERNIERE + 1 }, (_, n) => n);
  $('.menu__list').innerHTML = indices.map(n => '<li><button type="button" data-aller="' + n + '"><span class="mask"><span class="mask__in"><span class="num">(' + pad2(n) + ')</span><span>' + esc(nomStation(n)) + '</span></span></span></button></li>').join('');
  $$('[data-nb-stations]').forEach(el => { el.textContent = pad2(DERNIERE); });
  const aide = $('.aide');
  aide.textContent = TACTILE ? 'Balayez vers le haut pour avancer · glissez pour tourner · touchez un point' : 'Molette ou flèches pour avancer · glissez pour tourner · cliquez sur un point';

  /* ---------------------------------------------------------------
     Ma sélection : une carte par espace, dans le tiroir
     --------------------------------------------------------------- */
  const panier = $('#selection');
  const panierFond = $('.panier-fond');
  const grille = $('.panier__liste', panier);
  function carteHTML(e, i) {
    const pluriel = sing(e) + 's';
    return '<article class="carte" id="carte-' + e.id + '" data-espace="' + e.id + '">' +
      '<div class="carte__top"><div><span class="carte__idx">(' + pad2(i + 1) + ') ' + esc(e.type) + '</span>' +
      '<h3 class="carte__nom display">' + esc(e.nom) + '</h3><p class="carte__meta mono">Maquette ' + esc(e.maquette) + '</p></div>' +
      '<button class="btn btn--sm carte__3d" type="button" data-aller="' + (i + 1) + '">Voir en 3D</button></div>' +
      '<div class="carte__qte"><span class="mono">Nombre ' + deOu(pluriel) + esc(pluriel) + '</span>' +
      '<div class="stepper"><button type="button" data-pas="-1" aria-label="Retirer une unité">−</button>' +
      '<input id="q-' + e.id + '" type="number" inputmode="numeric" min="0" max="9999" step="1" aria-label="Nombre ' + deOu(pluriel) + esc(pluriel) + ', ' + esc(e.nom) + '">' +
      '<button type="button" data-pas="1" aria-label="Ajouter une unité">+</button></div></div>' +
      '<div class="lignes"></div>' +
      '<div class="carte__total" data-prix><div><span>Par ' + esc(sing(e)) + '</span><strong data-unite></strong></div>' +
      '<div><span data-total-label></span><strong data-total-espace></strong></div></div>' +
      '</article>';
  }
  grille.innerHTML = ESPACES.map(carteHTML).join('');

  function lignesHTML(e) {
    return e.emplacements.map(s => {
      const p = PRODUITS[choixDe(e.id, s.id)], on = retenuDe(e.id, s.id);
      const id = 'l-' + e.id + '-' + s.id;
      const px = p.prix > 0 ? prix(p.prix * s.qte) : '<span class="ligne__devis">Sur devis</span>';
      const nc = DATA.compatibles(e.id, s.id).length;
      return '<div class="ligne' + (on ? '' : ' is-off') + '" data-slot="' + s.id + '">' +
        '<input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '>' +
        '<label class="ligne__txt" for="' + id + '"><span class="ligne__slot">' + esc(s.label) + '</span>' +
        '<span class="ligne__prod">' + esc(p.nom) + (s.qte > 1 ? ' × ' + s.qte : '') + '</span></label>' +
        '<span class="ligne__prix" data-prix>' + px + '</span>' +
        '<button class="ligne__voir" type="button" data-voir="' + e.id + ':' + s.id + '">Voir la pièce' + (nc > 1 ? ' · ' + nc + ' choix' : '') + '</button></div>';
    }).join('');
  }

  const compteurs = $$('[data-sel-count]');
  const compteurSr = $('[data-sel-count-sr]');
  function majSelection(renduLignes = true) {
    ESPACES.forEach(e => {
      const c = $('#carte-' + e.id, grille), b = budgetEspace(e.id);
      if (renduLignes) $('.lignes', c).innerHTML = lignesHTML(e);
      const inp = $('input[type="number"]', c);
      if (document.activeElement !== inp) inp.value = String(b.n);
      $('[data-unite]', c).textContent = prixT(b.unite) + (b.devis ? ' + devis' : '');
      $('[data-total-label]', c).textContent = '× ' + qteLabel(e, b.n);
      $('[data-total-espace]', c).textContent = prixT(b.total);
      $$('[data-station-qte="' + e.id + '"]').forEach(el => { el.textContent = qteLabel(e, b.n); });
      $$('[data-station-prix="' + e.id + '"]').forEach(el => { el.textContent = prixT(b.unite) + (b.devis ? ' + devis' : ''); });
      e.emplacements.forEach(s => {
        const p = PRODUITS[choixDe(e.id, s.id)], on = retenuDe(e.id, s.id);
        $$('[data-piece="' + e.id + ':' + s.id + '"]').forEach(btn => {
          btn.classList.toggle('is-off', !on);
          $('[data-piece-nom]', btn).textContent = p.nom;
          $('[data-piece-prix]', btn).textContent = p.prix > 0 ? prix(p.prix) : 'Sur devis';
          btn.setAttribute('aria-label', s.label + ' : ' + p.nom + (on ? '' : ', non retenue') + '. Voir la pièce seule');
        });
      });
    });
    const t = budgetTotal(), ch = chambresEtSuites();
    $('[data-total]', panier).textContent = prixT(t.total);
    $$('[data-total-visite]').forEach(el => { el.textContent = prixT(t.total) + (t.devis ? ' + devis' : ''); });
    $('[data-recap-detail]', panier).textContent = pl(t.lignes, 'pièce') + ' · ' + pl(t.pieces, 'unité') + ' au total · ' + pl(t.espaces, 'espace') + (t.devis ? ' · ' + t.devis + ' sur devis' : '');
    compteurs.forEach(el => { el.textContent = String(t.lignes); });
    if (compteurSr) compteurSr.textContent = ', ' + pl(t.lignes, 'pièce') + ' retenue' + (t.lignes > 1 ? 's' : '');
    $$('[data-nb-chambres]').forEach(el => { el.textContent = pad2(ch); });
    $$('[data-final-resume]').forEach(el => {
      el.textContent = t.lignes ? pl(t.lignes, 'pièce') + ' retenue' + (t.lignes > 1 ? 's' : '') + ' dans ' + pl(t.espaces, 'espace') + ', pour ' + ch + ' chambres et suites.' : 'Aucune pièce retenue pour le moment.';
    });
  }
  majSelection();

  // interactions du tiroir
  grille.addEventListener('change', e => {
    const carte = e.target.closest('.carte');
    if (!carte) return;
    const eid = carte.dataset.espace;
    if (e.target.matches('input[type="checkbox"]')) {
      definirRetenu(eid, e.target.closest('.ligne').dataset.slot, e.target.checked);
    } else if (e.target.matches('input[type="number"]')) {
      const v = clamp(parseInt(e.target.value, 10) || 0, 0, 9999);
      ETAT.quantites[eid] = v;
      e.target.value = String(v);
      sauver(); majSelection(false); majTitreCourant();
    }
  });
  grille.addEventListener('click', e => {
    const pas = e.target.closest('[data-pas]');
    if (!pas) return;
    const eid = pas.closest('.carte').dataset.espace;
    ETAT.quantites[eid] = clamp(quantiteDe(eid) + parseInt(pas.dataset.pas, 10), 0, 9999);
    sauver(); majSelection(false); majTitreCourant();
  });

  function definirRetenu(eid, sid, on) {
    (ETAT.retenu[eid] = ETAT.retenu[eid] || {})[sid] = on;
    if (has3D()) V().setRetenu(eid, sid, on);
    if (on) delete ETAT.retenu[eid][sid];
    sauver();
    majSelection();
    if (ficheCtx && ficheCtx.eid === eid && ficheCtx.sid === sid) majBascule();
  }
  function definirChoix(eid, sid, sku) {
    if (choixDe(eid, sid) === sku) return;
    (ETAT.choix[eid] = ETAT.choix[eid] || {})[sid] = sku;
    if (has3D()) {
      V().setChoix(eid, sid, sku);
      if (ouvert.studio) V().studio.changer(eid, sid, sku);
    }
    if (sku === slotDef(eid, sid).choix[0]) delete ETAT.choix[eid][sid];
    sauver();
    majSelection();
  }
  function reinitialiser() {
    ESPACES.forEach(e => e.emplacements.forEach(s => {
      const def = s.choix[0];
      if (choixDe(e.id, s.id) !== def) { if (has3D()) V().setChoix(e.id, s.id, def); delete ETAT.choix[e.id][s.id]; }
      if (!retenuDe(e.id, s.id)) { if (has3D()) V().setRetenu(e.id, s.id, true); delete ETAT.retenu[e.id][s.id]; }
    }));
    ETAT.quantites = {};
    sauver();
    majSelection();
    majTitreCourant();
    toast('Sélection revenue à la proposition');
  }

  /* ---------------------------------------------------------------
     Résumé de la sélection (demande de rendez-vous)
     --------------------------------------------------------------- */
  function resumeSelection() {
    const L = [];
    let total = 0, devis = 0;
    ESPACES.forEach(e => {
      const b = budgetEspace(e.id);
      const lignes = e.emplacements.filter(s => retenuDe(e.id, s.id));
      if (!lignes.length || !b.n) return;
      L.push(e.nom.toUpperCase() + ' (' + qteLabel(e, b.n) + ')');
      lignes.forEach(s => {
        const p = PRODUITS[choixDe(e.id, s.id)];
        L.push('- ' + s.label + ' : ' + p.nom + (s.qte > 1 ? ' × ' + s.qte : '') + ', réf. ' + p.id +
          (CONFIG.afficherPrix ? ' (' + (p.prix > 0 ? prix(p.prix * s.qte) : 'sur devis') + ')' : ''));
      });
      if (CONFIG.afficherPrix) L.push('  Par ' + sing(e) + ' : ' + prixT(b.unite) + (b.devis ? ' + sur devis' : '') + ' · total ' + prixT(b.total));
      L.push('');
      total += b.total; devis += b.devis;
    });
    if (!L.length) return 'Aucune pièce retenue pour le moment.';
    if (CONFIG.afficherPrix) L.push('Total indicatif : ' + prixT(total) + ' (prix catalogue public, hors remise projet, livraison et pose' + (devis ? ', pièces sur mesure sur devis' : '') + ').');
    return L.join('\n');
  }

  /* ---------------------------------------------------------------
     Notification discrète, copie
     --------------------------------------------------------------- */
  const toastEl = $('.toast');
  let toastT = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('is-on'), 2600);
  }
  async function copier(txt) {
    try { await navigator.clipboard.writeText(txt); return true; } catch (_) { /* repli */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = txt; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;opacity:0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (_) { return false; }
  }

  /* ---------------------------------------------------------------
     Fleurs de bougainvillier dessinées en code
     (branches issues d'un angle, grappes de bractées en triades,
     feuilles, longues retombées ; aucune image externe)
     --------------------------------------------------------------- */
  function peindreBougainvillier(cv, graine, bas) {
    const r = alea(graine * 7919 + 13);
    const rr = (a, b) => a + (b - a) * r();
    const S = cv.width;
    const c = cv.getContext('2d');
    c.setTransform(S, 0, 0, S, 0, 0);
    c.clearRect(0, 0, 1, 1);
    c.lineCap = 'round';
    c.lineJoin = 'round';

    const tiges = [], grappes = [];
    const branches = [];
    const nb = 4 + Math.floor(r() * 3);
    for (let b = 0; b < nb; b++) {
      const haut = r() < .6;
      let x = haut ? rr(-.04, .32) : -.03, y = haut ? -.03 : rr(-.03, .3);
      let a = haut ? rr(.25, 1.05) : rr(.05, .7);
      const L = rr(.42, .84), n = 26, pas = L / n;
      const pts = [[x, y]];
      for (let i = 0; i < n; i++) {
        a += rr(.005, .045) + (a < 1.25 ? .012 : 0);
        a = Math.min(a, 1.5);
        x += Math.cos(a) * pas; y += Math.sin(a) * pas;
        pts.push([x, y]);
      }
      branches.push(pts);
      tiges.push({ pts, w: .0065, prof: r() * .5 });
    }
    branches.forEach(pts => {
      pts.forEach((p, i) => {
        if (i < 2) return;
        const t = i / pts.length;
        if (r() < .58) grappes.push({ x: p[0] + rr(-.02, .02), y: p[1] + rr(-.012, .03), r: rr(.03, .066) * (1.15 - t * .5), prof: r() });
        if (i % 3 === 0 && r() < .72) {
          let x = p[0], y = p[1], a = (bas ? rr(0, Math.PI * 2) : Math.PI / 2 + rr(-.7, .5));
          const n = 5 + Math.floor(r() * 7), pas = rr(.012, .022);
          const tp = [[x, y]];
          for (let q = 0; q < n; q++) {
            a += rr(-.14, .14);
            if (!bas) a += (Math.PI / 2 - a) * .14;
            x += Math.cos(a) * pas; y += Math.sin(a) * pas;
            tp.push([x, y]);
            if (q > 1 && r() < .45) grappes.push({ x: x + rr(-.012, .012), y: y + rr(-.006, .012), r: rr(.022, .045) * (1 - q / n * .45), prof: r() });
          }
          tiges.push({ pts: tp, w: .0028, prof: r() });
          grappes.push({ x, y, r: rr(.02, .04), prof: r() });
        }
      });
    });
    if (!bas) {
      const nc = 3 + Math.floor(r() * 4);
      for (let q = 0; q < nc; q++) {
        const pts = branches[Math.floor(r() * branches.length)];
        const p = pts[Math.floor(rr(.3, .95) * pts.length)];
        let x = p[0], y = p[1];
        const n = Math.round(rr(.15, .38) / .02);
        const tp = [[x, y]];
        for (let i = 0; i < n; i++) {
          x += rr(-.006, .006); y += .02;
          tp.push([x, y]);
          if (r() < .55) grappes.push({ x: x + rr(-.01, .01), y, r: rr(.012, .03) * (1 - i / n * .5), prof: r() });
        }
        grappes.push({ x, y: y + .005, r: rr(.012, .022), prof: r() });
        tiges.push({ pts: tp, w: .0018, prof: r() });
      }
    }

    function tige(t) {
      const p = t.pts;
      c.beginPath();
      c.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < p.length - 1; i++) c.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2);
      c.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
      c.strokeStyle = 'hsla(' + rr(30, 70) + ',22%,' + (15 + t.prof * 12) + '%,.92)';
      c.lineWidth = t.w;
      c.stroke();
    }
    function feuille(x, y, a, L, lum) {
      c.save(); c.translate(x, y); c.rotate(a); c.scale(1, rr(.6, 1));
      c.beginPath(); c.moveTo(0, 0);
      c.bezierCurveTo(-L * .4, -L * .25, -L * .3, -L * .8, 0, -L);
      c.bezierCurveTo(L * .3, -L * .8, L * .4, -L * .25, 0, 0);
      c.fillStyle = 'hsl(' + rr(86, 110) + ',' + rr(28, 44) + '%,' + clamp(lum * .55, 14, 34) + '%)';
      c.fill();
      c.beginPath(); c.moveTo(0, -L * .05); c.lineTo(0, -L * .9);
      c.strokeStyle = 'rgba(18,28,10,.35)'; c.lineWidth = L * .03; c.stroke();
      c.restore();
    }
    function bractee(L, Wd, col, veine, reflet) {
      c.beginPath(); c.moveTo(0, 0);
      c.bezierCurveTo(-Wd, -L * .15, -Wd * 1.1, -L * .72, 0, -L);
      c.bezierCurveTo(Wd * 1.1, -L * .72, Wd, -L * .15, 0, 0);
      c.fillStyle = col; c.fill();
      if (reflet) {
        c.beginPath(); c.moveTo(0, -L * .2);
        c.bezierCurveTo(-Wd * .55, -L * .35, -Wd * .6, -L * .75, 0, -L * .9);
        c.bezierCurveTo(Wd * .1, -L * .6, Wd * .05, -L * .35, 0, -L * .2);
        c.fillStyle = reflet; c.fill();
      }
      c.beginPath(); c.moveTo(0, -L * .04); c.quadraticCurveTo(Wd * .12, -L * .5, 0, -L * .9);
      c.strokeStyle = veine; c.lineWidth = L * .035; c.stroke();
    }
    function fleur(x, y, L, lum) {
      c.save(); c.translate(x, y); c.rotate(rr(0, Math.PI * 2)); c.scale(1, rr(.55, 1));
      const h = rr(318, 334), s = rr(70, 90);
      for (let q = 0; q < 3; q++) {
        c.save(); c.rotate(q * 2.094 + rr(-.2, .2));
        const l = clamp(lum + rr(-5, 5) + (q === 0 ? 4 : 0), 22, 72);
        bractee(L * rr(.85, 1.1), L * rr(.5, .62), 'hsl(' + h + ',' + s + '%,' + l + '%)',
          'hsla(' + h + ',' + s + '%,' + (l - 14) + '%,.4)',
          r() < .55 ? 'hsla(' + (h + 4) + ',' + (s - 12) + '%,' + Math.min(88, l + 16) + '%,.32)' : null);
        c.restore();
      }
      if (r() < .6) { c.fillStyle = '#F4EAD2'; c.beginPath(); c.arc(0, -L * .1, L * .085, 0, 6.2832); c.fill(); }
      c.restore();
    }
    function grappe(g) {
      const lum = 32 + g.prof * 28;
      const nf = r() < .7 ? 1 + Math.floor(r() * 3) : 0;
      for (let i = 0; i < nf; i++) {
        const a = rr(0, Math.PI * 2);
        feuille(g.x + Math.cos(a) * g.r * .7, g.y + Math.sin(a) * g.r * .7, a + Math.PI / 2, g.r * rr(.8, 1.2), lum);
      }
      const nfl = Math.max(3, Math.round(g.r * 140 * rr(.8, 1.2)));
      for (let i = 0; i < nfl; i++) {
        const a = rr(0, Math.PI * 2), d = Math.sqrt(r()) * g.r;
        fleur(g.x + Math.cos(a) * d, g.y + Math.sin(a) * d * .85, g.r * rr(.34, .52), lum + rr(-6, 8));
      }
    }
    tiges.forEach(tige);
    grappes.sort((a, b) => a.prof - b.prof).forEach(grappe);
  }

  const heroFleurs = $$('.hero .fleur');
  function preparerFleurs() {
    // une fleur par image : le préchargement reste fluide
    return new Promise(resolve => {
      let i = 0;
      const suivante = () => {
        if (i >= heroFleurs.length) { resolve(); return; }
        const el = heroFleurs[i++];
        const droite = el.classList.contains('fleur--tr');
        const sway = document.createElement('div');
        sway.className = 'fleur__sway';
        const cv = document.createElement('canvas');
        const css = Math.max(160, el.getBoundingClientRect().width || 400);
        cv.width = cv.height = Math.round(clamp(css * Math.min(devicePixelRatio || 1, 2), 320, 1100));
        cv.style.transform = 'scale(' + (droite ? -1 : 1) + ',1)';
        sway.appendChild(cv);
        el.appendChild(sway);
        try { peindreBougainvillier(cv, parseInt(el.dataset.fleur, 10) || i, false); } catch (err) { console.warn(err); }
        requestAnimationFrame(suivante);
      };
      requestAnimationFrame(suivante);
    });
  }

  /* ---------------------------------------------------------------
     Éléments de la page
     --------------------------------------------------------------- */
  const mainEl = $('#main');
  const hero = $('.hero');
  const heroPhoto = $('.hero__photo');
  const heroEdge = $('.hero__edge');
  const header = $('.site-header');
  const rail = $('.rail');
  const railFill = $('.rail__fill');
  const railNum = $('.rail__num');
  const navTitre = $('.site-nav__titre');
  const navSous = $('.site-nav__sous');
  const menu = $('#menu');
  const menuBtn = $('.menu-btn');
  const menuLabel = $('.menu-btn__label');
  const visiteUI = $('#visite-ui');
  const visiteVoile = $('.visite-voile');
  const couche = $('.hs-couche');
  const canvas = $('#scene3d');
  const voile = $('.voile');
  const fiche = $('#fiche');
  const rendu = $('#rendu');
  const studioRetour = $('.studio-retour');
  const studioRetourTxt = $('span', studioRetour);
  const modal = $('#rdv');
  const segVue = $('.seg--vue');
  const renduBtn = $('.rendu-btn');
  const btnSuiv = $('[data-station="suiv"]');
  const btnPrec = $('[data-station="prec"]');
  const numEl = $('[data-num]');
  const entrerBtn = $('#entrer');
  const entrerEtat = $('#entrer-etat');
  const entrerPlein = $('.entrer__plein');
  const entrerTxt = $('.entrer__txt');
  navTitre.textContent = 'Visite privée';
  navSous.textContent = CONFIG.hotelCourt;

  // chargement | accueil | entree | visite | sortie
  let mode = 'chargement';
  let k = 0, vue = 'maquette', poseCourante = null, kPanneau = -1;
  let ambChoix = 0, amb7Auto = true, chrome3D = false;
  let heroChars = [], scriptChars = [], titresChars = [];
  const ouvert = { menu: false, modal: false, fiche: false, panier: false, studio: false, rendu: false };
  const bloque = () => ouvert.modal || ouvert.fiche || ouvert.panier || ouvert.studio || ouvert.rendu;

  function majInert() {
    const couvre = bloque();
    const ui = mode !== 'visite' || couvre || ouvert.menu;
    mainEl.inert = mode !== 'accueil' || couvre || ouvert.menu;
    visiteUI.inert = ui;
    visiteUI.setAttribute('aria-hidden', String(ui));
    couche.inert = ui;
    header.inert = couvre;
    fiche.inert = !ouvert.fiche || ouvert.modal;
    fiche.setAttribute('aria-hidden', String(!ouvert.fiche));
    panier.inert = !ouvert.panier || ouvert.modal;
    panier.setAttribute('aria-hidden', String(!ouvert.panier));
    studioRetour.inert = !ouvert.studio || ouvert.modal;
    menu.inert = !ouvert.menu;
    rendu.inert = !ouvert.rendu;
    rendu.setAttribute('aria-hidden', String(!ouvert.rendu));
    if (ouvert.rendu) { header.inert = true; fiche.inert = true; panier.inert = true; }
  }

  // teinte de l'en-tête : blanc sur la photo et le soir, encre sur la maquette de jour
  function majChrome() {
    const m = chrome3D && !root.classList.contains('is-soir') ? 'on-page' : 'on-dark';
    header.dataset.mode = m;
    rail.dataset.mode = m;
  }

  let titreTl = null;
  function majTitre(titre, sous) {
    if (navTitre.textContent === titre && navSous.textContent === sous) return;
    if (!ANIM) { navTitre.textContent = titre; navSous.textContent = sous; return; }
    if (titreTl) titreTl.kill();
    titreTl = gsap.timeline()
      .to([navTitre, navSous], { autoAlpha: 0, y: -8, duration: .25, stagger: .04, ease: 'power2.in' })
      .add(() => { navTitre.textContent = titre; navSous.textContent = sous; })
      .fromTo([navTitre, navSous], { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: .6, stagger: .06, ease: 'mcOut' });
  }
  function titreStation(n) {
    if (n === 0) return [CONFIG.hotelCourt, 'Vue d’ensemble'];
    if (n === DERNIERE) return ['La proposition', 'Le soir venu'];
    const e = espaceDe(n);
    return [e.nom, qteLabel(e, quantiteDe(e.id))];
  }
  function majTitreCourant() { if (mode === 'visite') { const [t, s] = titreStation(k); majTitre(t, s); } }

  function majRail(n) {
    railFill.style.transform = 'scaleY(' + (n / DERNIERE).toFixed(4) + ')';
    railNum.textContent = pad2(n);
  }

  function majCommandes(n) {
    numEl.textContent = pad2(n);
    btnSuiv.disabled = n >= DERNIERE;
    btnPrec.setAttribute('aria-label', n === 0 ? 'Revenir à l’accueil' : 'Espace précédent');
    const avecVue = !!espaceDe(n);
    segVue.classList.toggle('is-off', !avecVue);
    renduBtn.classList.toggle('is-off', !avecVue || !has3D());
    renduBtn.disabled = !avecVue || !has3D();
    if (avecVue) renduBtn.setAttribute('aria-label', 'Rendu réaliste de l’espace ' + espaceDe(n).nom);
    $$('button', segVue).forEach(b => { b.disabled = !avecVue; b.setAttribute('aria-pressed', String(b.dataset.vue === vue)); });
    $$('.menu__list [data-aller]').forEach(b => b.setAttribute('aria-current', String(mode !== 'accueil' && +b.dataset.aller === n)));
  }

  /* ---------------------------------------------------------------
     Panneau de la station : sortie de l'ancien, entrée du nouveau
     --------------------------------------------------------------- */
  const nettoyer = el => Array.from(el.children).forEach(c => { c.style.opacity = ''; c.style.visibility = ''; c.style.transform = ''; });
  function montrerPanneau(n, dir = 1, delai = 0) {
    if (n === kPanneau) return;
    const avant = kPanneau, out = panneaux[avant], inn = panneaux[n];
    kPanneau = n;
    // le focus suit le panneau (clavier, lecteur d'écran) s'il était dans l'ancien
    const a = document.activeElement;
    if (mode === 'visite' && (!a || a === document.body || (out && out.contains(a)))) requestAnimationFrame(() => inn.focus({ preventScroll: true }));
    if (!ANIM) {
      if (out) out.classList.remove('is-actif');
      inn.classList.add('is-actif');
      nettoyer(inn);
      return;
    }
    if (out) {
      gsap.to(out.children, { autoAlpha: 0, y: -18 * dir, duration: .35, stagger: .025, ease: 'power2.in', overwrite: true,
        onComplete: () => { if (kPanneau !== avant) out.classList.remove('is-actif'); } });
    }
    inn.classList.add('is-actif');
    gsap.fromTo(inn.children, { autoAlpha: 0, y: 26 * dir }, { autoAlpha: 1, y: 0, duration: .9, stagger: .06, ease: 'mcOut', delay: delai + .15, overwrite: true });
    const chars = titresChars[n];
    if (chars && chars.length) {
      gsap.fromTo(chars, { opacity: 0, scaleY: 1.9, yPercent: -12, filter: 'blur(8px)', transformOrigin: '50% 0%' },
        { opacity: 1, scaleY: 1, yPercent: 0, filter: 'blur(0px)', duration: 1.2, stagger: .03, ease: 'expo.out', delay: delai + .24, overwrite: true });
    }
  }
  function cacherPanneaux() {
    panneaux.forEach(p => p.classList.remove('is-actif'));
    kPanneau = -1;
  }

  /* ---------------------------------------------------------------
     Décalage optique : la maquette laisse la place au panneau et à la fiche
     --------------------------------------------------------------- */
  function majDecalage(instant) {
    if (!has3D()) return;
    const w = innerWidth, h = innerHeight;
    let x = 0, y = 0;
    if (ouvert.studio) {
      const lf = Math.min(420, w - 24) + 24;
      if (MQ_BAS.matches) { y = .3; V().studio.zone(1, .36); } else { x = -(lf / 2) / w; V().studio.zone(Math.max(.4, (w - lf) / w), 1); }
    } else if ((mode === 'visite' || mode === 'entree') && kPanneau >= 0) {
      const r = panneaux[kPanneau].getBoundingClientRect();
      if (MQ_BAS.matches) y = clamp((h - 100 - r.top) / (2 * h), 0, .17);
      else x = clamp((r.right - 40) / (2 * w), 0, .17);
    }
    V().setDecalage(x, y, instant);
  }

  /* ---------------------------------------------------------------
     Ambiance : jour ou soir (la dernière station passe au soir)
     --------------------------------------------------------------- */
  const ambianceCible = () => ((mode === 'visite' || mode === 'entree') && k === DERNIERE && amb7Auto ? 1 : ambChoix);
  function appliquerAmbiance(duree) {
    const a = ambianceCible();
    if (has3D()) V().setAmbiance(a, duree);
    root.classList.toggle('is-soir', a > .5 && chrome3D);
    $$('[data-amb]').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.amb === '1') === (a > .5))));
    majChrome();
  }
  function choisirAmbiance(v) {
    if (k === DERNIERE) amb7Auto = false;
    ambChoix = v;
    appliquerAmbiance();
  }

  /* ---------------------------------------------------------------
     Aller à une station : la caméra vole (GSAP), le panneau change
     --------------------------------------------------------------- */
  // recul le long de l'axe de visée (le panneau occupe la gauche de l'écran)
  const recul = (p, f) => Object.assign({}, p, { px: p.tx + (p.px - p.tx) * f, py: p.ty + (p.py - p.ty) * f, pz: p.tz + (p.pz - p.tz) * f });
  function poseStation(n, v = vue) {
    const e = espaceDe(n), bas = MQ_BAS.matches;
    if (n === 0) {
      // écran tenu droit : l'hôtel vu depuis l'ouest, ses deux ailes en colonnes
      if (bas && innerHeight > innerWidth * 1.1) return { px: -33.7, py: 61.7, pz: .5, tx: 7, ty: -1, tz: .5, fov: 52, brut: true };
      return bas ? V().pose('ensemble') : recul(V().pose('ensemble'), 1.16);
    }
    if (e) return V().pose(e.id, v);
    // la proposition : le jardin la nuit, fontaine et chambres bulle allumées
    return recul(V().pose('jardin', 'fontaine'), bas ? 1.05 : 1.22);
  }
  function orbite(n) {
    if (n === 0) return { yaw: .5, pitch: .1 };
    if (n === DERNIERE) return { yaw: .55, pitch: .12 };
    return vue === 'oeil' ? { yaw: 1.05, pitch: .2 } : { yaw: .7, pitch: .16 };
  }
  function allerStation(n, o = {}) {
    if (!has3D()) return 0;
    n = clamp(n, 0, DERNIERE);
    const v = V(), dir = n >= k ? 1 : -1;
    k = n;
    if (n !== DERNIERE) amb7Auto = true;
    const e = espaceDe(n);
    v.setEspace(e ? e.id : null, { points: !!e, etiquettes: n === 0 });
    v.resetOrbite(.8);
    v.setOrbite(true, orbite(n));
    poseCourante = o.pose || poseStation(n);
    const tw = v.allerA(poseCourante, { fin: o.fin, duree: o.duree, brut: !!poseCourante.brut });
    const d = tw ? tw.duration() : 0;
    appliquerAmbiance(n === DERNIERE ? 2.6 : 1.6);
    montrerPanneau(n, dir, o.delai != null ? o.delai : Math.min(1.1, d * .4));
    majCommandes(n);
    majRail(n);
    const [t, s] = titreStation(n);
    majTitre(t, s);
    requestAnimationFrame(() => majDecalage());
    return d;
  }
  function choisirVue(v) {
    if (v === vue) return;
    vue = v;
    $$('button', segVue).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.vue === vue)));
    if (mode !== 'visite' || !espaceDe(k) || !has3D()) return;
    V().resetOrbite(.8);
    V().setOrbite(true, orbite(k));
    poseCourante = poseStation(k);
    V().allerA(poseCourante);
  }

  /* ---------------------------------------------------------------
     Entrée dans la visite : la photo s'efface sur la maquette vue du
     même point, puis la caméra prend du recul jusqu'à la vue d'ensemble
     --------------------------------------------------------------- */
  let veutEntrer = null;
  const balancements = [];
  function entrer(n = 0, o = {}) {
    if (mode !== 'accueil') return;
    if (etat3D === 'echec') { ouvrirPanier(); return; }
    if (!has3D()) { veutEntrer = { n, o }; majEntrer(); return; }
    veutEntrer = null;
    if (ouvert.menu) { closeMenu().then(() => entrer(n, o)); return; }
    if (ouvert.panier) fermerPanier(true);
    mode = 'entree';
    arreterPetales();
    const v = V();
    v.setEspace(null, {});
    v.setOrbite(false);
    v.setDecalage(0, 0, true);
    v.setAmbiance(ambChoix, 0);
    v.placer(v.pose('deluxe', 'oeil'));
    v.setActif(true);
    majInert();
    const voler = () => {
      root.classList.add('mode-3d');
      chrome3D = true;
      allerStation(n, { pose: o.pose, fin: o.fin });
      majChrome();
      if (ANIM) gsap.to([visiteVoile, visiteUI], { autoAlpha: 1, duration: 1, ease: 'power2.out', delay: .4 });
      else { montrer(visiteVoile, true); montrer(visiteUI, true); }
    };
    const fin = () => {
      mode = 'visite';
      hero.classList.add('is-parti');
      balancements.forEach(t => t.pause());
      majInert();
      majCommandes(k);
      majDecalage();
      const a = document.activeElement;
      if (!a || a === document.body || a === entrerBtn || hero.contains(a)) panneaux[k].focus({ preventScroll: true });
      setTimeout(() => { if (mode === 'visite') aide.classList.add('is-vu'); }, 14000);
    };
    if (!ANIM) { hero.classList.add('is-parti'); voler(); fin(); return; }
    gsap.set([visiteVoile, visiteUI], { autoAlpha: 0 });
    gsap.timeline({ onComplete: fin })
      .to(heroChars.concat(scriptChars), { opacity: 0, yPercent: -24, filter: 'blur(8px)', duration: .55, stagger: .012, ease: 'power2.in' }, 0)
      .to(['.hero__kicker', '.hero__fade'], { autoAlpha: 0, duration: .45, ease: 'power1.in' }, 0)
      .to(heroFleurs, { autoAlpha: 0, scale: .84, duration: .9, ease: 'power2.in' }, 0)
      .fromTo(heroPhoto, { clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 100%)', duration: 1.3, ease: 'mc' }, .3)
      .fromTo('.hero__photo .media__inner', { scale: 1 }, { scale: 1.06, duration: 1.3, ease: 'mc' }, .3)
      .fromTo(heroEdge, { left: '0%', autoAlpha: 1 }, { left: '100%', duration: 1.3, ease: 'mc' }, .3)
      .to(heroEdge, { autoAlpha: 0, duration: .2 }, 1.45)
      .add(voler, 1.5)
      .to({}, { duration: .3 });
  }

  /* Retour à l'accueil : la caméra revient dans la chambre, la photo se repose dessus */
  function retourAccueil() {
    if (mode !== 'visite' || !has3D()) return;
    if (ouvert.studio) { fermerPiece(retourAccueil); return; }
    if (ouvert.panier) fermerPanier(true);
    mode = 'sortie';
    majInert();
    const v = V();
    v.setEspace(null, {});
    v.setOrbite(false);
    v.setDecalage(0, 0);
    amb7Auto = true;
    v.setAmbiance(0, 1.4);
    if (ANIM) gsap.to([visiteVoile, visiteUI], { autoAlpha: 0, duration: .45, ease: 'power2.in' });
    else { montrer(visiteVoile, false); montrer(visiteUI, false); }
    const fin = () => {
      root.classList.remove('mode-3d');
      v.setActif(false);
      cacherPanneaux();
      mode = 'accueil';
      majInert();
      majEntrer();
      majCommandes(k);
      planifierPetales();
      entrerBtn.focus({ preventScroll: true });
    };
    const photo = () => {
      chrome3D = false;
      root.classList.remove('is-soir');
      majChrome();
      majTitre('Visite privée', CONFIG.hotelCourt);
      hero.classList.remove('is-parti');
      balancements.forEach(t => t.resume());
      if (!ANIM) { fin(); return; }
      gsap.timeline({ onComplete: fin })
        .fromTo(heroPhoto, { clipPath: 'inset(0% 0% 0% 100%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.25, ease: 'mc' }, 0)
        .fromTo('.hero__photo .media__inner', { scale: 1.06 }, { scale: 1, duration: 1.8, ease: 'mcOut' }, 0)
        .fromTo(heroEdge, { left: '100%', autoAlpha: 1 }, { left: '0%', duration: 1.25, ease: 'mc' }, 0)
        .to(heroEdge, { autoAlpha: 0, duration: .2 }, 1.15)
        .add(heroRevient(), .65);
    };
    const tw = v.allerA(v.pose('deluxe', 'oeil'), { fin: photo });
    if (!tw) photo();
  }
  function heroRevient() {
    return gsap.timeline()
      .fromTo(heroChars, { opacity: 0, scaleY: 1.9, yPercent: -14, filter: 'blur(8px)' }, { opacity: 1, scaleY: 1, yPercent: 0, filter: 'blur(0px)', duration: 1.3, stagger: .04, ease: 'expo.out' }, 0)
      .fromTo(scriptChars, { opacity: 0, x: -12, yPercent: 0, filter: 'blur(6px)' }, { opacity: 1, x: 0, filter: 'blur(0px)', duration: .9, stagger: .03, ease: 'power2.out' }, .4)
      .to(['.hero__kicker', '.hero__fade'], { autoAlpha: 1, duration: .8, stagger: .06, ease: 'power2.out' }, .5)
      .fromTo(heroFleurs, { autoAlpha: 0, scale: .84 }, { autoAlpha: 1, scale: 1, duration: 1.6, ease: 'expo.out', stagger: .12 }, .15);
  }

  /* ---------------------------------------------------------------
     Navigation : molette, balayage, flèches, boutons
     --------------------------------------------------------------- */
  let verrou = 0, aideVue = false;
  function marquerAide() {
    if (aideVue) return;
    aideVue = true;
    setTimeout(() => aide.classList.add('is-vu'), 2200);
  }
  function naviguer(dir) {
    const t = performance.now();
    if (t < verrou || bloque() || ouvert.menu) return false;
    if (mode === 'accueil') {
      if (dir > 0) { verrou = t + 1500; entrer(0); return true; }
      return false;
    }
    if (mode !== 'visite') return false;
    if (dir < 0 && k === 0) { verrou = t + 1800; retourAccueil(); return true; }
    const n = clamp(k + dir, 0, DERNIERE);
    if (n === k) return false;
    verrou = t + 700;
    allerStation(n);
    marquerAide();
    return true;
  }
  function allerVers(n) {
    if (etat3D === 'echec') {
      const e = espaceDe(n);
      ouvrirPanier(e ? { espace: e.id } : {});
      return;
    }
    const go = () => {
      if (ouvert.studio) { fermerPiece(() => allerVers(n)); return; }
      if (ouvert.fiche) fermerFiche(true);
      if (ouvert.panier) fermerPanier(true);
      if (mode === 'accueil') entrer(n);
      else if (mode === 'visite') allerStation(n);
    };
    if (ouvert.menu) closeMenu().then(go); else go();
  }

  // molette : un geste (même continu, avec l'inertie du pavé tactile) = une station
  const DEFILANTS = '.fiche, .panier, .modal, .menu, .rendu';
  const roue = { acc: 0, t: 0, utilise: false };
  addEventListener('wheel', e => {
    const cible = e.target instanceof Element ? e.target : null;
    if (e.ctrlKey || (cible && cible.closest(DEFILANTS))) return;
    e.preventDefault();
    if (ouvert.studio) return;
    const now = performance.now();
    if (now - roue.t > 220) { roue.acc = 0; roue.utilise = false; }
    roue.t = now;
    if (roue.utilise) return;
    const d = e.deltaMode === 1 ? e.deltaY * 18 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY;
    if (Math.abs(e.deltaX) > Math.abs(d)) return;
    roue.acc += d;
    if (Math.abs(roue.acc) >= 30) { roue.utilise = true; naviguer(roue.acc > 0 ? 1 : -1); }
  }, { passive: false });

  // balayage vertical (le glisser horizontal fait tourner la maquette)
  let doigt = null;
  addEventListener('touchstart', e => {
    const cible = e.target instanceof Element ? e.target : null;
    if (e.touches.length !== 1 || (cible && cible.closest(DEFILANTS))) { doigt = null; return; }
    doigt = { x: e.touches[0].clientX, y: e.touches[0].clientY, fait: false };
  }, { passive: true });
  addEventListener('touchmove', e => {
    if (!doigt || doigt.fait || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - doigt.x, dy = e.touches[0].clientY - doigt.y;
    if (Math.abs(dy) > 48 && Math.abs(dy) > Math.abs(dx) * 1.4) { doigt.fait = true; naviguer(dy < 0 ? 1 : -1); }
  }, { passive: true });
  addEventListener('touchend', () => { doigt = null; }, { passive: true });
  addEventListener('touchcancel', () => { doigt = null; }, { passive: true });

  canvas.addEventListener('pointerdown', () => { if (mode === 'visite') marquerAide(); });

  // un point s'allume quand on survole sa pièce dans le panneau
  const pointDe = b => { const [eid, sid] = b.dataset.piece.split(':'); return $('.hs[data-espace="' + eid + '"][data-slot="' + sid + '"]'); };
  const allumer = (e, on) => { const b = e.target.closest && e.target.closest('[data-piece]'); const h = b && pointDe(b); if (h) h.classList.toggle('is-proche', on); };
  stationEl.addEventListener('pointerover', e => allumer(e, true));
  stationEl.addEventListener('pointerout', e => allumer(e, false));
  stationEl.addEventListener('focusin', e => allumer(e, true));
  stationEl.addEventListener('focusout', e => allumer(e, false));
  function signaler(eid, sid) {
    const b = $('.hs[data-espace="' + eid + '"][data-slot="' + sid + '"]');
    if (!b) return;
    b.classList.add('is-proche');
    setTimeout(() => b.classList.remove('is-proche'), 4200);
  }

  /* ---------------------------------------------------------------
     Menu
     --------------------------------------------------------------- */
  function openMenu() {
    if (ouvert.menu) return;
    ouvert.menu = true;
    root.classList.add('menu-open');
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden', 'false');
    menuBtn.setAttribute('aria-expanded', 'true');
    menuLabel.textContent = 'Fermer';
    majInert();
    if (ANIM) {
      gsap.timeline()
        .fromTo(menu, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: .9, ease: 'mc' })
        .fromTo($$('.menu__list .mask__in'), { yPercent: 115 }, { yPercent: 0, duration: 1, stagger: .04, ease: 'mcOut' }, .3)
        .fromTo($$('.menu__aside > *'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: .8, stagger: .06, ease: 'mcOut' }, .45);
    } else if (hasGSAP) gsap.set(menu, { clipPath: 'inset(0% 0% 0% 0%)' });
    setTimeout(() => { const a = $('.menu__list [aria-current="true"]') || $('.menu__list button'); if (a) a.focus({ preventScroll: true }); }, ANIM ? 450 : 0);
  }
  function closeMenu() {
    return new Promise(resolve => {
      if (!ouvert.menu) { resolve(); return; }
      ouvert.menu = false;
      menuBtn.setAttribute('aria-expanded', 'false');
      menuLabel.textContent = 'Menu';
      const done = () => {
        menu.classList.remove('is-open');
        menu.setAttribute('aria-hidden', 'true');
        root.classList.remove('menu-open');
        majInert();
        resolve();
      };
      if (ANIM) gsap.to(menu, { clipPath: 'inset(0% 0% 100% 0%)', duration: .75, ease: 'mc', onComplete: done });
      else { if (hasGSAP) gsap.set(menu, { clipPath: 'inset(0% 0% 100% 0%)' }); done(); }
    });
  }
  menuBtn.addEventListener('click', () => (ouvert.menu ? closeMenu().then(() => menuBtn.focus()) : openMenu()));

  /* ---------------------------------------------------------------
     Fenêtre de rendez-vous
     --------------------------------------------------------------- */
  const modalCard = $('.modal__card', modal);
  const modalVeil = $('.modal__veil', modal);
  const rdvForm = $('#rdv-form');
  const envoi = $('.envoi', modal);
  const envoiTexte = $('.envoi__texte', modal);
  const champMessage = $('textarea[name="message"]', rdvForm);
  let messageTouche = false, modalFrom = null, texteDemande = '';
  champMessage.addEventListener('input', () => { messageTouche = true; });
  const messageParDefaut = () => 'Bonjour,\n\nJe souhaite recevoir la proposition chiffrée pour la sélection ci-dessous.\n\n' + resumeSelection();

  function openModal(trigger) {
    if (ouvert.modal) return;
    ouvert.modal = true;
    modalFrom = trigger || document.activeElement;
    if (!messageTouche) champMessage.value = messageParDefaut();
    rdvForm.hidden = false; envoi.hidden = true;
    modal.classList.add('is-open');
    modal.removeAttribute('inert');
    modal.setAttribute('aria-hidden', 'false');
    majInert();
    if (ANIM) {
      gsap.to(modalVeil, { opacity: 1, duration: .45, ease: 'power2.out' });
      gsap.fromTo(modalCard, { opacity: 0, rotationX: 16, y: 48 }, { opacity: 1, rotationX: 0, y: 0, duration: .9, ease: 'mcOut' });
    } else { modalVeil.style.opacity = '1'; modalCard.style.opacity = '1'; }
    setTimeout(() => { const f = $('input', modal); if (f) f.focus({ preventScroll: true }); }, ANIM ? 380 : 0);
  }
  function closeModal() {
    if (!ouvert.modal) return;
    ouvert.modal = false;
    const done = () => {
      modal.classList.remove('is-open');
      modal.setAttribute('inert', '');
      modal.setAttribute('aria-hidden', 'true');
      majInert();
      if (modalFrom && modalFrom.focus && document.contains(modalFrom)) modalFrom.focus({ preventScroll: true });
    };
    if (ANIM) {
      gsap.to(modalVeil, { opacity: 0, duration: .35 });
      gsap.to(modalCard, { opacity: 0, y: 30, duration: .35, ease: 'power2.in', onComplete: done });
    } else { modalVeil.style.opacity = '0'; modalCard.style.opacity = '0'; done(); }
  }
  rdvForm.addEventListener('submit', e => {
    e.preventDefault();
    const d = new FormData(rdvForm);
    texteDemande = [
      'Objet : demande de proposition, visite privée ' + CONFIG.hotelCourt,
      '',
      'Nom : ' + (d.get('nom') || ''),
      'Hôtel : ' + (d.get('hotel') || ''),
      'E-mail : ' + (d.get('email') || ''),
      'Téléphone : ' + (d.get('tel') || ''),
      '',
      String(d.get('message') || '')
    ].join('\n');
    envoiTexte.textContent = texteDemande;
    rdvForm.hidden = true;
    envoi.hidden = false;
    if (ANIM) gsap.from(envoi.children, { autoAlpha: 0, y: 16, duration: .7, stagger: .06, ease: 'mcOut' });
    const b = $('[data-copier="texte"]', envoi);
    if (b) b.focus({ preventScroll: true });
  });
  modal.addEventListener('click', async e => {
    const c = e.target.closest('[data-copier]');
    if (c) {
      const adresse = c.dataset.copier === 'adresse';
      const ok = await copier(adresse ? CONFIG.email : texteDemande);
      if (ok) { toast(adresse ? 'Adresse copiée' : 'Demande copiée'); return; }
      // copie refusée par le navigateur : le texte est sélectionné, prêt à copier
      try {
        const r = document.createRange();
        r.selectNodeContents(adresse ? $('.envoi__adresse [data-fill]', envoi) : envoiTexte);
        const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      } catch (_) { /* rien */ }
      toast('Texte sélectionné : copiez-le avec votre clavier ou un appui long');
      return;
    }
    if (e.target.closest('[data-envoi-retour]')) { envoi.hidden = true; rdvForm.hidden = false; }
  });

  /* ---------------------------------------------------------------
     Fiche produit
     --------------------------------------------------------------- */
  // panneaux coulissants : par la droite sur grand écran, par le bas sur téléphone
  const EN_PLACE = { x: 0, y: 0, xPercent: 0, yPercent: 0 };
  const horsEcran = (el, mobile) => (mobile ? { x: 0, y: 0, xPercent: 0, yPercent: 105 } : { x: el.offsetWidth + 24, y: 0, xPercent: 0, yPercent: 0 });
  const fichePhoto = $('.fiche__photo', fiche);
  const ficheImg = $('img', fichePhoto);
  const bascule = $('.bascule', fiche);
  let ficheCtx = null, ficheFrom = null, ficheDepuis = null;
  const couleurDe = p => {
    const l = p.look || {};
    return l.tete || l.couleur || l.ext || l.coussins || (p.cols && p.cols[0]) || ({ Suspension: '#E7DCC6', Lustre: '#E9E4DA', Applique: '#D9C39C', Lampadaire: '#C8A15A', Sculpture: '#8C6A3F', Fontaine: '#9FB9C2', Jardinière: '#F2F0EA' }[p.cat]) || '#D8CFBF';
  };
  function majBascule() {
    if (!ficheCtx) return;
    bascule.setAttribute('aria-checked', String(retenuDe(ficheCtx.eid, ficheCtx.sid)));
  }
  function remplirFiche(eid, sid) {
    const e = DEF[eid], s = slotDef(eid, sid), sku = choixDe(eid, sid), p = PRODUITS[sku];
    const i = e.emplacements.indexOf(s);
    ficheCtx = { eid, sid };
    $('.fiche__kicker', fiche).textContent = '(' + pad2(i + 1) + ') ' + e.nom + ' · ' + s.label;
    $('.fiche__nom', fiche).textContent = p.nom;
    $('.fiche__titre', fiche).textContent = p.titre;
    $('.fiche__texte', fiche).textContent = p.texte;
    $('.specs', fiche).innerHTML = (p.points || []).map(pt => '<div><dt>' + esc(pt[0]) + '</dt><dd>' + esc(pt[1]) + '</dd></div>').join('');
    $('.fiche__prix b', fiche).textContent = p.prix > 0 ? prix(p.prix) : 'Sur devis';
    $('.fiche__prix .mono', fiche).textContent = p.prix > 0 ? 'Prix catalogue' + (s.qte > 1 ? ', l’unité' : '') : (p.brouillon ? 'Pièce sur mesure' : 'Prix');
    $('.fiche__ref', fiche).innerHTML = 'Réf. ' + esc(p.id) + (p.url ? ' · <a href="' + esc(p.url) + '" target="_blank" rel="noopener">Voir sur ' + esc(CONFIG.boutique) + '</a>' : ' · sur mesure, chiffrée sur devis');
    // photo du catalogue : affichée seulement si elle se charge
    fichePhoto.classList.add('is-vide');
    ficheImg.removeAttribute('src');
    if (p.img) {
      ficheImg.alt = p.titre;
      ficheImg.referrerPolicy = 'no-referrer';
      ficheImg.onload = () => { if (ficheCtx && PRODUITS[choixDe(ficheCtx.eid, ficheCtx.sid)] === p) fichePhoto.classList.remove('is-vide'); };
      ficheImg.onerror = () => fichePhoto.classList.add('is-vide');
      ficheImg.src = p.img;
    }
    const listeV = $('.variantes__liste', fiche);
    // les propositions Maison Corleone, et la pièce choisie dans le catalogue s'il y en a une
    const affiches = s.choix.includes(sku) ? s.choix : [sku].concat(s.choix);
    listeV.innerHTML = affiches.map(sk => {
      const q = PRODUITS[sk], hors = !s.choix.includes(sk);
      return '<button class="variante' + (hors ? ' variante--choix' : '') + '" type="button" data-sku="' + esc(sk) + '" aria-pressed="' + (sk === sku) + '">' +
        '<span class="variante__pastille" style="background:' + esc(couleurDe(q)) + '"></span>' +
        '<span class="variante__nom">' + esc(q.nom) + '<small>' + esc(hors ? 'Votre choix · ' + q.cat : q.cat) + '</small></span>' +
        '<span class="variante__prix" data-prix>' + (q.prix > 0 ? prix(q.prix) : 'Sur devis') + '</span></button>';
    }).join('');
    const nbCompat = DATA.compatibles(eid, sid).length;
    $('.variantes > .caps', fiche).textContent = s.choix.length > 1 ? 'Nos ' + s.choix.length + ' propositions pour cet emplacement' : 'Notre proposition pour cet emplacement';
    const tout = $('[data-cata-ouvrir]', fiche);
    tout.hidden = nbCompat <= s.choix.length;
    $('[data-cata-nb]', tout).textContent = pl(nbCompat, 'pièce') + ' aux dimensions de l’emplacement';
    const n = quantiteDe(eid);
    $('.fiche__qte', fiche).textContent = (s.qte > 1 ? s.qte + ' par ' + sing(e) + ' · ' : '') + qteLabel(e, n) + ' dans la sélection';
    majBascule();
  }
  function ouvrirFiche(eid, sid, o = {}) {
    if (cataCtx && (cataCtx.eid !== eid || cataCtx.sid !== sid)) fermerCata(true);
    remplirFiche(eid, sid);
    $('.fiche__defil', fiche).scrollTop = 0;
    if (!ouvert.fiche) {
      ouvert.fiche = true;
      if (!ouvert.studio) ficheDepuis = o.depuis || null;
      ficheFrom = document.activeElement;
      root.classList.add('fiche-open');
      fiche.classList.add('is-open');
      majInert();
      const mobile = MQ_BAS.matches;
      if (ANIM) gsap.fromTo(fiche, horsEcran(fiche, mobile), Object.assign({ duration: .8, ease: 'mcOut', delay: ouvert.studio ? .12 : 0 }, EN_PLACE));
      else if (hasGSAP) gsap.set(fiche, EN_PLACE);
      else fiche.style.transform = 'none';
    } else if (ANIM) {
      gsap.fromTo($$('.fiche__defil > *', fiche), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: .5, stagger: .03, ease: 'mcOut' });
    }
    setTimeout(() => { $('.fiche__fermer', fiche).focus({ preventScroll: true }); }, 60);
  }
  function fermerFiche(silencieux) {
    if (!ouvert.fiche) return;
    ouvert.fiche = false;
    fermerCata(true);
    root.classList.remove('fiche-open');
    const mobile = MQ_BAS.matches;
    const done = () => { if (!ouvert.fiche) fiche.classList.remove('is-open'); };
    if (ANIM) gsap.to(fiche, Object.assign(horsEcran(fiche, mobile), { duration: .5, ease: 'power2.in', onComplete: done }));
    else { if (hasGSAP) gsap.set(fiche, { clearProps: 'transform' }); else fiche.style.transform = ''; done(); }
    majInert();
    if (ouvert.studio) return;
    const retour = ficheDepuis === 'panier' && !silencieux;
    ficheDepuis = null;
    if (retour) { ouvrirPanier(); return; }
    if (!silencieux && ficheFrom && ficheFrom.focus && document.contains(ficheFrom) && !ficheFrom.closest('.fiche')) ficheFrom.focus({ preventScroll: true });
  }
  fiche.addEventListener('click', e => {
    const v = e.target.closest('.variante');
    if (v && ficheCtx) { definirChoix(ficheCtx.eid, ficheCtx.sid, v.dataset.sku); remplirFiche(ficheCtx.eid, ficheCtx.sid); return; }
    if (e.target.closest('.bascule') && ficheCtx) { definirRetenu(ficheCtx.eid, ficheCtx.sid, !retenuDe(ficheCtx.eid, ficheCtx.sid)); return; }
    if (e.target.closest('[data-dans-piece]') && ficheCtx) { voirDansPiece(ficheCtx.eid, ficheCtx.sid); return; }
    if (e.target.closest('[data-cata-ouvrir]') && ficheCtx) { ouvrirCata(ficheCtx.eid, ficheCtx.sid); return; }
    if (e.target.closest('[data-cata-fermer]')) { fermerCata(); return; }
    if (e.target.closest('[data-cata-raz]')) { razFiltres(); return; }
    const c = e.target.closest('.pc');
    if (c && cataCtx) { choisirDansCata(c.dataset.sku); return; }
    const f = e.target.closest('.puce');
    if (f && cataCtx) basculerFiltre(f);
  });

  /* ---------------------------------------------------------------
     Le catalogue compatible : toutes les pièces de la boutique de même
     famille et de même gabarit que l'emplacement, à filtrer et essayer
     --------------------------------------------------------------- */
  const cata = $('.cata', fiche);
  const cataGrille = $('.cata__grille', cata);
  const cataFiltres = $('.cata__filtres', cata);
  const cataRecherche = $('.cata__cherche input', cata);
  const cataTri = $('.cata__tri select', cata);
  const cataNb = $('.cata__nb', cata);
  const cataVide = $('.cata__vide', cata);
  const MATIERES = DATA.MATIERES || {};
  const STYLES = {
    panneau: 'Tête droite', capitonne: 'Capitonné', matelasse: 'Matelassé', cannele: 'Cannelé', galbe: 'Galbé', ailes: 'Enveloppant',
    nuage: 'Nuage', tubes: 'Boudins', chesterfield: 'Chesterfield', rond: 'Rond', lounge: 'Lounge', club: 'Club', bergere: 'Bergère',
    haut: 'Dossier haut', pivotant: 'Pivotant', coque: 'Coque', cocon: 'Cocon', petales: 'Pétales', tubulaire: 'Structure métal',
    bois: 'Bois', pouf: 'Pouf', fourrure: 'Fourrure', corde: 'Corde', sculptural: 'Sculptural', relax: 'Relax', suspendu: 'Suspendu',
    bascule: 'À bascule', droit: 'Droit', angle: 'D’angle', courbe: 'Courbe', modules: 'Modulable', cercle: 'Circulaire',
    globe: 'Globe', cylindre: 'Cylindre', empile: 'Empilée', grappe: 'Grappe', cristal: 'Cristal', sputnik: 'Sputnik', anneau: 'Anneaux',
    anneaux: 'Anneaux', lineaire: 'Linéaire', tresse: 'Tressée', matrice: 'Matrice', floral: 'Florale', infini: 'Spirale infinie',
    spirale: 'Spirale', ondes: 'Ondes', cascade: 'Cascade', tube: 'Tube', vasques: 'Vasques', cadre: 'Cadre', grille: 'Grille',
    ovale: 'Ovale', rect: 'Rectangulaire', cannelee: 'Cannelée', slipper: 'Slipper', griffe: 'Pieds griffe', balneo: 'Balnéo',
    feu: 'Autour du feu', silhouette: 'Silhouette', cactus: 'Cactus', arbre: 'Jardin zen', daybed: 'Daybed'
  };
  const COULEURS = [['clair', 'Clairs', '#EDE6D6'], ['chaud', 'Chauds', '#C0663A'], ['froid', 'Froids', '#4E7A8A'], ['sombre', 'Sombres', '#2A2628'], ['multi', 'Multicolores', 'linear-gradient(90deg,#C84B31,#E0B53B,#4E7A4A,#3E5C8A)']];
  const TRANCHES = [['a', 'Moins de 500 €', p => p.prix > 0 && p.prix < 500], ['b', '500 à 1 000 €', p => p.prix >= 500 && p.prix < 1000],
    ['c', '1 000 à 2 000 €', p => p.prix >= 1000 && p.prix < 2000], ['d', 'Plus de 2 000 €', p => p.prix >= 2000], ['devis', 'Sur devis', p => !(p.prix > 0)]];
  const PLURIELS = { lit: 'lits', fauteuil: 'fauteuils', canape: 'canapés', suspension: 'suspensions', lustre: 'lustres', applique: 'appliques',
    baignoire: 'baignoires', tabouret: 'tabourets', banc: 'bancs', pouf: 'poufs', sculpture: 'sculptures', meridienne: 'méridiennes',
    'salon-jardin': 'salons de jardin', lampadaire: 'lampadaires', jardiniere: 'jardinières', balancelle: 'balancelles' };
  const sansAcc = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const m2 = v => String(Math.round(v * 100) / 100).replace('.', ',') + ' m';
  let cataCtx = null;

  function gabaritTexte(s) {
    const noms = ['largeur', 'profondeur', 'hauteur'], t = [];
    if (s.max) s.max.forEach((v, i) => { if (v != null) t.push(noms[i] + ' jusqu’à ' + m2(v)); });
    if (s.min) s.min.forEach((v, i) => { if (v != null) t.push(noms[i] + ' dès ' + m2(v)); });
    if (s.ext === true) t.push('pour l’extérieur');
    if (s.ext === false) t.push('pour l’intérieur');
    return t.length ? 'Pièces retenues pour cet emplacement : ' + t.join(', ') + '.' : '';
  }
  function carteCataHTML(sku, proposee) {
    const p = PRODUITS[sku];
    const meta = [p.dimsTexte, MATIERES[p.mat]].filter(Boolean).join(' · ');
    const img = p.vign || p.img;
    return '<button class="pc" type="button" data-sku="' + esc(sku) + '" aria-pressed="false">' +
      '<span class="pc__img' + (img ? '' : ' is-vide') + '" style="--c:' + esc(couleurDe(p)) + '">' + (img ? '<img loading="lazy" decoding="async" referrerpolicy="no-referrer" alt="" src="' + esc(img) + '">' : '') + '</span>' +
      (proposee ? '<i class="pc__badge">Proposée</i>' : '') + '<i class="pc__badge pc__badge--actuel" hidden>Choisie</i>' +
      '<span class="pc__nom">' + esc(p.nom) + '</span><span class="pc__meta">' + esc(meta) + '</span>' +
      '<span class="pc__prix" data-prix>' + (p.prix > 0 ? prix(p.prix) + (p.parModule ? ' / module' : '') : 'Sur devis') + '</span></button>';
  }
  // rangées de filtres : seulement les valeurs présentes dans la liste
  function filtresHTML(liste) {
    const compte = (cle) => { const c = new Map(); liste.forEach(sk => { const v = cle(PRODUITS[sk]); if (v) c.set(v, (c.get(v) || 0) + 1); }); return c; };
    const rangee = (nom, f, items) => items.length > 1 ? '<div class="filtre" role="group" aria-label="' + esc(nom) + '"><span class="filtre__nom">' + esc(nom) + '</span>' + items.map(([v, lib, n, c]) =>
      '<button class="puce" type="button" data-f="' + f + '" data-v="' + esc(v) + '" aria-pressed="false">' + (c ? '<i style="--c:' + esc(c) + '"></i>' : '') + esc(lib) + ' <small>' + n + '</small></button>').join('') + '</div>' : '';
    const st = compte(p => p.st), ma = compte(p => p.mat), co = compte(p => p.fc);
    const pr = TRANCHES.map(([v, lib, test]) => [v, lib, liste.filter(sk => test(PRODUITS[sk])).length]).filter(x => x[2]);
    return rangee('Style', 'st', [...st].sort((a, b) => b[1] - a[1]).map(([v, n]) => [v, STYLES[v] || v, n])) +
      rangee('Matière', 'mat', [...ma].sort((a, b) => b[1] - a[1]).map(([v, n]) => [v, MATIERES[v] || v, n])) +
      rangee('Couleur', 'fc', COULEURS.filter(([v]) => co.has(v)).map(([v, lib, c]) => [v, lib, co.get(v), c])) +
      rangee('Prix', 'prix', pr);
  }
  function ouvrirCata(eid, sid) {
    const e = DEF[eid], s = slotDef(eid, sid), liste = DATA.compatibles(eid, sid);
    if (!cataCtx || cataCtx.eid !== eid || cataCtx.sid !== sid) {
      // ordre par défaut : nos propositions, puis le même style que la première, puis le prix
      const ref = PRODUITS[s.choix[0]] || {};
      const reste = liste.filter(sk => !s.choix.includes(sk)).sort((a, b) => {
        const pa = PRODUITS[a], pb = PRODUITS[b];
        return (pb.st === ref.st) - (pa.st === ref.st) || (pa.prix || 1e9) - (pb.prix || 1e9);
      });
      cataCtx = { eid, sid, ordre: s.choix.filter(sk => liste.includes(sk)).concat(reste), filtres: {}, q: '', tri: '' };
      const i = e.emplacements.indexOf(s);
      $('.cata__kicker', cata).textContent = '(' + pad2(i + 1) + ') ' + e.nom + ' · ' + s.label;
      const fam = (s.fam || [])[0];
      $('.cata__titre', cata).textContent = (PLURIELS[fam] ? PLURIELS[fam].charAt(0).toUpperCase() + PLURIELS[fam].slice(1) : 'Pièces') + ' compatibles';
      $('.cata__gabarit', cata).textContent = gabaritTexte(s);
      cataFiltres.innerHTML = filtresHTML(liste);
      cataGrille.innerHTML = cataCtx.ordre.map(sk => carteCataHTML(sk, s.choix.includes(sk))).join('');
      cataRecherche.value = '';
      cataTri.value = '';
    }
    majCataChoix();
    appliquerFiltres();
    fiche.classList.add('is-cata');
    cata.hidden = false;
    cata.scrollTop = 0;
    if (ANIM) gsap.fromTo([$('.cata__barre', cata), $('.cata__haut', cata)].concat($$('.pc:not([hidden])', cataGrille).slice(0, 8)), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: .55, stagger: .035, ease: 'mcOut', clearProps: 'opacity,visibility,transform' });
    setTimeout(() => { const r = $('.cata__retour', cata); if (r) r.focus({ preventScroll: true }); }, 60);
  }
  function fermerCata(silencieux) {
    if (cata.hidden) return;
    fiche.classList.remove('is-cata');
    cata.hidden = true;
    if (!silencieux) { const b = $('[data-cata-ouvrir]', fiche); if (b && !b.hidden) b.focus({ preventScroll: true }); }
  }
  function majCataChoix() {
    if (!cataCtx) return;
    const actuel = choixDe(cataCtx.eid, cataCtx.sid);
    $$('.pc', cataGrille).forEach(b => { const on = b.dataset.sku === actuel; b.setAttribute('aria-pressed', String(on)); $('.pc__badge--actuel', b).hidden = !on; });
  }
  function choisirDansCata(sku) {
    definirChoix(cataCtx.eid, cataCtx.sid, sku);
    remplirFiche(cataCtx.eid, cataCtx.sid);
    majCataChoix();
    const p = PRODUITS[sku];
    toast(p.nom + ' · ' + (p.prix > 0 ? prix(p.prix) : 'sur devis'));
  }
  function basculerFiltre(b) {
    const f = b.dataset.f, v = b.dataset.v, set = cataCtx.filtres[f] || (cataCtx.filtres[f] = new Set());
    if (set.has(v)) set.delete(v); else set.add(v);
    b.setAttribute('aria-pressed', String(set.has(v)));
    appliquerFiltres();
  }
  function razFiltres() {
    if (!cataCtx) return;
    cataCtx.filtres = {}; cataCtx.q = ''; cataRecherche.value = '';
    $$('.puce', cataFiltres).forEach(b => b.setAttribute('aria-pressed', 'false'));
    appliquerFiltres();
  }
  function passe(p) {
    const F = cataCtx.filtres;
    if (F.st && F.st.size && !F.st.has(p.st)) return false;
    if (F.mat && F.mat.size && !F.mat.has(p.mat)) return false;
    if (F.fc && F.fc.size && !F.fc.has(p.fc)) return false;
    if (F.prix && F.prix.size && !TRANCHES.some(([v, , test]) => F.prix.has(v) && test(p))) return false;
    if (cataCtx.q) {
      const t = sansAcc([p.nom, p.titre, (p.couleurs || []).join(' '), MATIERES[p.mat], STYLES[p.st]].join(' '));
      if (!cataCtx.q.split(/\s+/).every(m => t.includes(m))) return false;
    }
    return true;
  }
  function appliquerFiltres() {
    if (!cataCtx) return;
    const cartes = new Map($$('.pc', cataGrille).map(b => [b.dataset.sku, b]));
    let ordre = cataCtx.ordre.slice();
    const tri = cataCtx.tri;
    if (tri === 'prix' || tri === '-prix') { const k0 = tri === 'prix' ? 1 : -1; ordre.sort((a, b) => k0 * ((PRODUITS[a].prix || (k0 > 0 ? 1e9 : -1)) - (PRODUITS[b].prix || (k0 > 0 ? 1e9 : -1)))); }
    else if (tri === 'nom') ordre.sort((a, b) => PRODUITS[a].nom.localeCompare(PRODUITS[b].nom, 'fr'));
    let n = 0;
    ordre.forEach(sk => { const b = cartes.get(sk); const ok = passe(PRODUITS[sk]); b.hidden = !ok; if (ok) n++; cataGrille.appendChild(b); });
    cataNb.textContent = n === ordre.length ? pl(n, 'pièce') : n + ' sur ' + ordre.length;
    cataVide.hidden = n > 0;
  }
  let cataT = 0;
  cataRecherche.addEventListener('input', () => { clearTimeout(cataT); cataT = setTimeout(() => { if (!cataCtx) return; cataCtx.q = sansAcc(cataRecherche.value.trim()); appliquerFiltres(); }, 140); });
  cataTri.addEventListener('change', () => { if (!cataCtx) return; cataCtx.tri = cataTri.value; appliquerFiltres(); });
  // photo absente ou bloquée : la pastille de couleur la remplace
  cataGrille.addEventListener('error', e => { if (e.target.tagName === 'IMG') e.target.parentNode.classList.add('is-vide'); }, true);

  /* ---------------------------------------------------------------
     La pièce seule : le meuble sur un socle, qui tourne, avec sa fiche
     --------------------------------------------------------------- */
  let pieceDepuis = null;
  function ouvrirPiece(eid, sid, o = {}) {
    if (mode === 'chargement' || mode === 'entree' || mode === 'sortie') return;
    if (!has3D()) {
      if (ouvert.panier) { fermerPanier(true); o.depuis = o.depuis || 'panier'; }
      ouvrirFiche(eid, sid, o);
      return;
    }
    const sku = choixDe(eid, sid);
    if (ouvert.studio) { V().studio.ouvrir(eid, sid, sku); ouvrirFiche(eid, sid); return; }
    if (ouvert.menu) { closeMenu().then(() => ouvrirPiece(eid, sid, o)); return; }
    if (ouvert.panier) { fermerPanier(true); o.depuis = o.depuis || 'panier'; }
    ouvert.studio = true;
    pieceDepuis = o.depuis || null;
    studioRetourTxt.textContent = pieceDepuis === 'panier' ? 'Retour à la sélection' : mode === 'visite' ? 'Retour à la visite' : 'Retour à l’accueil';
    majInert();
    const basculer = () => {
      root.classList.add('studio-open');
      V().setActif(true);
      V().studio.ouvrir(eid, sid, sku);
      majDecalage(true);
      ouvrirFiche(eid, sid);
    };
    if (!ANIM) { basculer(); return; }
    voile.style.background = '#ECE7DC';
    gsap.timeline()
      .to(voile, { autoAlpha: 1, duration: .42, ease: 'power2.inOut' })
      .add(basculer)
      .to(voile, { autoAlpha: 0, duration: .7, ease: 'power2.out' }, '+=.1');
  }
  function fermerPiece(ensuite) {
    if (!ouvert.studio) { if (ouvert.fiche) fermerFiche(!!ensuite); if (ensuite) ensuite(); return; }
    const retour = !ensuite && pieceDepuis === 'panier';
    fermerFiche(true);
    const quitter = () => {
      V().studio.fermer();
      root.classList.remove('studio-open');
      ouvert.studio = false;
      pieceDepuis = null;
      if (mode !== 'visite') V().setActif(false);
      majDecalage(true);
      majInert();
    };
    const apres = () => {
      if (ensuite) ensuite();
      else if (retour) ouvrirPanier();
      else if (mode === 'visite') panneaux[k].focus({ preventScroll: true });
      else entrerBtn.focus({ preventScroll: true });
    };
    if (!ANIM) { quitter(); apres(); return; }
    if (mode === 'visite') {
      voile.style.background = V().getAmbiance() > .5 ? '#1B1116' : '#E6E1D5';
      gsap.timeline({ onComplete: apres })
        .to(voile, { autoAlpha: 1, duration: .38, ease: 'power2.inOut' }, .1)
        .add(quitter)
        .to(voile, { autoAlpha: 0, duration: .6, ease: 'power2.out' }, '+=.08');
    } else {
      gsap.timeline({ onComplete: apres })
        .to(canvas, { autoAlpha: 0, duration: .45, ease: 'power2.inOut' }, .1)
        .add(quitter)
        .set(canvas, { autoAlpha: 1 });
    }
  }
  // « Voir dans la pièce » : retour à la maquette, cadrée sur le meuble
  function voirDansPiece(eid, sid) {
    if (!has3D()) return;
    const n = stationDe(eid);
    const signal = () => signaler(eid, sid);
    fermerPiece(() => {
      const p = V().poseProduit(eid, sid);
      if (mode === 'accueil') { entrer(n, { pose: p, fin: signal }); return; }
      if (mode !== 'visite') return;
      if (k !== n) { allerStation(n, { pose: p, fin: signal }); return; }
      poseCourante = p;
      V().resetOrbite(.6);
      V().allerA(p, { duree: 1.6, fin: signal });
    });
  }

  /* ---------------------------------------------------------------
     Ma sélection : ouverture et fermeture du tiroir
     --------------------------------------------------------------- */
  let panierFrom = null;
  const defilPanier = $('.panier__defil', panier);
  function montrerCarte(eid) {
    const c = $('#carte-' + eid, panier);
    if (c) defilPanier.scrollTop += c.getBoundingClientRect().top - defilPanier.getBoundingClientRect().top - 12;
  }
  function ouvrirPanier(o = {}) {
    if (ouvert.studio) { fermerPiece(() => ouvrirPanier(o)); return; }
    if (ouvert.fiche) fermerFiche(true);
    if (ouvert.menu) { closeMenu().then(() => ouvrirPanier(o)); return; }
    if (ouvert.panier) { if (o.espace) montrerCarte(o.espace); return; }
    ouvert.panier = true;
    panierFrom = document.activeElement;
    majSelection();
    panier.classList.add('is-open');
    root.classList.add('panier-open');
    majInert();
    defilPanier.scrollTop = 0;
    const mobile = innerWidth < 700;
    if (ANIM) {
      gsap.to(panierFond, { autoAlpha: 1, duration: .5, ease: 'power2.out' });
      gsap.fromTo(panier, horsEcran(panier, mobile), Object.assign({ duration: .85, ease: 'mcOut' }, EN_PLACE));
      gsap.fromTo($$('.carte', panier), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: .8, stagger: .05, ease: 'mcOut', delay: .15 });
    } else {
      montrer(panierFond, true);
      if (hasGSAP) gsap.set(panier, EN_PLACE); else panier.style.transform = 'none';
    }
    if (o.espace) montrerCarte(o.espace);
    setTimeout(() => { const b = $('.panier__fermer', panier); if (b) b.focus({ preventScroll: true }); }, 60);
  }
  function fermerPanier(silencieux) {
    if (!ouvert.panier) return;
    ouvert.panier = false;
    root.classList.remove('panier-open');
    const mobile = innerWidth < 700;
    const done = () => { if (!ouvert.panier) panier.classList.remove('is-open'); };
    if (ANIM) {
      gsap.to(panierFond, { autoAlpha: 0, duration: .4 });
      gsap.to(panier, Object.assign(horsEcran(panier, mobile), { duration: .5, ease: 'power2.in', onComplete: done }));
    } else {
      montrer(panierFond, false);
      if (hasGSAP) gsap.set(panier, { clearProps: 'transform' }); else panier.style.transform = '';
      done();
    }
    majInert();
    if (!silencieux && panierFrom && panierFrom.focus && document.contains(panierFrom) && !panierFrom.closest('.panier')) panierFrom.focus({ preventScroll: true });
  }

  /* ---------------------------------------------------------------
     Rendu réaliste (IA). La vue intérieure de la maquette, la photo de
     l'espace et les photos des pièces retenues partent vers une fonction
     du serveur (api/rendu), qui interroge fal.ai (Nano Banana Pro) avec
     sa clé : aucune clé dans la page. Ensuite, en option, le rendu
     devient une pièce 3D réaliste (api/monde, World Labs Marble).
     Sans serveur (aperçu intégré), la fenêtre l'explique simplement.
     --------------------------------------------------------------- */
  const renduCarte = $('.rendu__carte', rendu), renduVoile = $('.rendu__voile', rendu);
  const renduScene = $('.rendu__scene', rendu), renduMaquette = $('.rendu__maquette', rendu);
  const renduRes = $('.rendu__resultat', rendu), renduResImg = $('img', renduRes);
  const renduCurseur = $('.rendu__curseur', rendu), renduAttente = $('.rendu__attente', rendu), renduEtat = $('.rendu__etat', rendu);
  const renduAlerte = $('.rendu__alerte', rendu), renduEtiqD = $('.rendu__etiquette--d', rendu);
  const renduSources = $('.rendu__sources', rendu), renduIndispo = $('.rendu__indispo', rendu);
  const btnGenerer = $('[data-rendu-generer]', rendu), lienImage = $('[data-rendu-ouvrir]', rendu);
  const blocMonde = $('.rendu__monde', rendu), btnMonde = $('[data-monde-generer]', rendu), lienMonde = $('[data-monde-ouvrir]', rendu), mondeEtat = $('.rendu__monde-etat', rendu);
  const CLE_RENDUS = 'mc-rendus-v1';
  let rendus = {};
  try { rendus = JSON.parse(localStorage.getItem(CLE_RENDUS) || '{}') || {}; } catch (_) { rendus = {}; }
  const sauverRendus = () => { try { localStorage.setItem(CLE_RENDUS, JSON.stringify(rendus)); } catch (_) { /* rien */ } };
  // la version en ligne expose api/etat ; l'aperçu intégré, non
  let API = null;
  const apiPrete = fetch('api/etat', { headers: { accept: 'application/json' }, cache: 'no-store' })
    .then(r => (r.ok ? r.json() : null)).then(j => { API = j && typeof j === 'object' ? j : null; return API; }).catch(() => null);
  // code d'accès facultatif (ACCES_CODE côté serveur) : transmis une fois par le lien (?code=…), puis gardé
  const codeAcces = (() => {
    let c = '';
    try { c = new URLSearchParams(location.search).get('code') || ''; if (c) localStorage.setItem('mc-code', c); else c = localStorage.getItem('mc-code') || ''; } catch (_) { /* rien */ }
    return c;
  })();
  const entetes = json => Object.assign(json ? { 'Content-Type': 'application/json' } : {}, codeAcces ? { 'x-code-acces': codeAcces } : {});
  let renduCtx = null, renduFrom = null;
  const enCours = {};   // générations en cours, par espace (elles continuent fenêtre fermée)

  // signature de la sélection d'un espace : un rendu ne vaut que pour elle
  const signature = (eid, soir) => DEF[eid].emplacements.map(s => (retenuDe(eid, s.id) ? choixDe(eid, s.id) : '-')).join(',') + (soir ? ':soir' : '');
  function piecesRendu(eid) {
    const e = DEF[eid];
    return e.emplacements.filter(s => retenuDe(eid, s.id)).map(s => {
      const p = PRODUITS[choixDe(eid, s.id)];
      return { nom: p.nom, cat: p.cat, titre: p.titre, emplacement: s.label, qte: s.qte, dims: p.dim ? p.dim.map(v => Math.round(v * 100)) : null, img: p.img || null, couleur: couleurDe(p) };
    });
  }
  function sourcesHTML(eid) {
    const e = DEF[eid];
    const vign = (src, legende, c) => '<figure style="--c:' + esc(c || '#EDEAE1') + '">' + (src ? '<img alt="" referrerpolicy="no-referrer" src="' + esc(src) + '">' : '') + '<figcaption>' + esc(legende) + '</figcaption></figure>';
    return vign(renduCtx.maquette, 'Maquette') + (e.photo ? vign(e.photo, 'Photo') : '') +
      piecesRendu(eid).map(p => vign(p.img, p.nom, p.couleur)).join('');
  }
  renduSources.addEventListener('error', e => { if (e.target.tagName === 'IMG') e.target.remove(); }, true);

  function attenteRendu(txt) {
    renduAttente.hidden = !txt;
    renduEtat.textContent = txt || '';
  }
  function montrerResultat(url, anime) {
    renduCtx.image = url;
    lienImage.href = url;
    lienImage.hidden = false;
    btnGenerer.textContent = 'Relancer un rendu';
    const pret = () => {
      if (!renduCtx || renduCtx.image !== url) return;
      renduRes.hidden = false; renduCurseur.hidden = false; renduAlerte.hidden = false; renduEtiqD.hidden = false;
      rendu.classList.add('a-resultat');
      renduCurseur.value = '50';
      if (ANIM && anime) gsap.fromTo(renduScene, { '--coupe': '100%' }, { '--coupe': '50%', duration: 1.4, ease: 'expo.inOut' });
      else renduScene.style.setProperty('--coupe', '50%');
      attenteRendu('');
    };
    renduResImg.onload = pret;
    renduResImg.onerror = () => { attenteRendu(''); renduIndispo.hidden = false; renduIndispo.textContent = 'Le rendu est prêt mais l’image ne s’affiche pas ici : ouvrez-la avec le bouton ci-dessous.'; };
    renduResImg.src = url;
    const m = rendus[renduCtx.eid] && rendus[renduCtx.eid].monde;
    blocMonde.hidden = !(API && API.monde);
    lienMonde.hidden = !(m && m.url);
    if (m && m.url) lienMonde.href = m.url;
    btnMonde.hidden = !!(m && m.url);
    mondeEtat.textContent = m && m.url ? 'La pièce en 3D est prête.' : '';
    if (m && m.op && !m.url) suivreMonde(renduCtx.eid, m.op);
  }
  function viderResultat() {
    rendu.classList.remove('a-resultat');
    renduRes.hidden = true; renduCurseur.hidden = true; renduAlerte.hidden = true; renduEtiqD.hidden = true;
    renduResImg.removeAttribute('src');
    lienImage.hidden = true;
    blocMonde.hidden = true;
    btnGenerer.textContent = 'Générer le rendu';
  }
  renduCurseur.addEventListener('input', () => renduScene.style.setProperty('--coupe', renduCurseur.value + '%'));

  async function ouvrirRendu(eid) {
    if (!has3D() || ouvert.rendu || !DEF[eid]) return;
    const e = DEF[eid], soir = V().getAmbiance() > .5;
    renduCtx = { eid, soir, image: null, maquette: null, sig: signature(eid, soir) };
    ouvert.rendu = true;
    renduFrom = document.activeElement;
    $('.rendu__titre', rendu).textContent = e.nom;
    $('[data-rendu-photo]', rendu).hidden = !e.photo;
    // la vue intérieure de la maquette, rendue à part (sans panneaux ni points)
    try { renduCtx.maquette = V().capture(eid, { vue: 'oeil', largeur: 1536, hauteur: 1024, ambiance: soir ? 1 : 0 }); } catch (err) { renduCtx.maquette = null; }
    if (renduCtx.maquette) renduMaquette.src = renduCtx.maquette; else renduMaquette.removeAttribute('src');
    renduSources.innerHTML = sourcesHTML(eid);
    viderResultat();
    attenteRendu('');
    renduIndispo.hidden = true;
    btnGenerer.disabled = true;
    rendu.classList.add('is-open');
    majInert();
    if (ANIM) {
      gsap.to(renduVoile, { opacity: 1, duration: .45, ease: 'power2.out' });
      gsap.fromTo(renduCarte, { opacity: 0, y: 40, scale: .98 }, { opacity: 1, y: 0, scale: 1, duration: .8, ease: 'mcOut' });
    } else { renduVoile.style.opacity = '1'; renduCarte.style.opacity = '1'; }
    setTimeout(() => { const c = $('.rendu__fermer', rendu); if (c) c.focus({ preventScroll: true }); }, 60);
    await apiPrete;
    if (!renduCtx || renduCtx.eid !== eid) return;
    if (!API || !API.rendu || (API.code && !codeAcces)) {
      renduIndispo.hidden = false;
      renduIndispo.textContent = !API ? 'Le rendu réaliste fonctionne sur la version en ligne du site : ici, l’aperçu n’a pas accès au serveur de génération.'
        : !API.rendu ? 'Le rendu réaliste n’est pas encore activé sur ce site (clé fal.ai à ajouter côté serveur).'
        : 'Le rendu réaliste est réservé : ouvrez la visite depuis le lien transmis par Maison Corleone.';
      btnGenerer.hidden = true;
      return;
    }
    btnGenerer.hidden = false;
    btnGenerer.disabled = !renduCtx.maquette;
    const deja = rendus[eid];
    if (enCours[eid]) attenteRendu('Génération en cours…');
    else if (deja && deja.image && deja.sig === renduCtx.sig) montrerResultat(deja.image, false);
  }
  function fermerRendu() {
    if (!ouvert.rendu) return;
    ouvert.rendu = false;
    const done = () => {
      if (ouvert.rendu) return;
      rendu.classList.remove('is-open');
      majInert();
      if (renduFrom && renduFrom.focus && document.contains(renduFrom)) renduFrom.focus({ preventScroll: true });
    };
    if (ANIM) {
      gsap.to(renduVoile, { opacity: 0, duration: .35 });
      gsap.to(renduCarte, { opacity: 0, y: 30, duration: .35, ease: 'power2.in', onComplete: done });
    } else { renduVoile.style.opacity = '0'; renduCarte.style.opacity = '0'; done(); }
  }
  async function lireJSON(r) { try { return await r.json(); } catch (_) { return {}; } }
  async function genererRendu() {
    if (!renduCtx || !renduCtx.maquette || enCours[renduCtx.eid]) return;
    const eid = renduCtx.eid, e = DEF[eid], sig = renduCtx.sig;
    enCours[eid] = true;
    btnGenerer.disabled = true;
    renduIndispo.hidden = true;
    attenteRendu('Envoi des images…');
    const maj = txt => { if (ouvert.rendu && renduCtx && renduCtx.eid === eid) attenteRendu(txt); };
    try {
      const corps = {
        espace: { id: e.id, nom: e.nom, type: e.type, texte: e.texte }, soir: renduCtx.soir, maquette: renduCtx.maquette,
        photo: e.photo ? new URL(e.photo, location.href).href : null, produits: piecesRendu(eid)
      };
      const r = await fetch('api/rendu', { method: 'POST', headers: entetes(true), body: JSON.stringify(corps) });
      const j = await lireJSON(r);
      if (!r.ok) throw new Error(j.erreur || 'Le serveur a refusé la demande (' + r.status + ')');
      const t0 = Date.now();
      maj('Génération en cours…');
      for (;;) {
        await wait(2500);
        const q = await fetch('api/rendu?suivi=' + encodeURIComponent(j.suivi) + '&resultat=' + encodeURIComponent(j.resultat), { cache: 'no-store', headers: entetes(false) });
        const s2 = await lireJSON(q);
        if (!q.ok || s2.etat === 'erreur') throw new Error(s2.erreur || 'La génération a échoué');
        if (s2.etat === 'fini' && s2.image) {
          rendus[eid] = { image: s2.image, sig, date: Date.now() };
          sauverRendus();
          if (ouvert.rendu && renduCtx && renduCtx.eid === eid) montrerResultat(s2.image, true);
          else toast('Le rendu de l’espace ' + e.nom + ' est prêt');
          break;
        }
        const sec = Math.round((Date.now() - t0) / 1000);
        maj((s2.etat === 'file' ? 'En file d’attente' : 'Génération en cours') + ' · ' + sec + ' s');
        if (sec > 300) throw new Error('La génération prend trop de temps, réessayez dans un instant');
      }
    } catch (err) {
      if (ouvert.rendu && renduCtx && renduCtx.eid === eid) {
        attenteRendu('');
        renduIndispo.hidden = false;
        renduIndispo.textContent = 'Rendu impossible : ' + (err && err.message ? err.message : 'erreur inconnue') + '.';
      }
    } finally {
      delete enCours[eid];
      if (renduCtx && renduCtx.eid === eid) btnGenerer.disabled = false;
    }
  }
  const suivisMonde = {};
  async function genererMonde() {
    if (!renduCtx || !renduCtx.image) return;
    const eid = renduCtx.eid, e = DEF[eid];
    btnMonde.disabled = true;
    mondeEtat.textContent = 'Envoi du rendu…';
    try {
      const r = await fetch('api/monde', { method: 'POST', headers: entetes(true),
        body: JSON.stringify({ image: renduCtx.image, nom: e.nom, texte: e.type + ' d’hôtel, ' + e.nom + ', aménagé par Maison Corleone' }) });
      const j = await lireJSON(r);
      if (!r.ok || !j.op) throw new Error(j.erreur || 'Le serveur a refusé la demande (' + r.status + ')');
      rendus[eid] = Object.assign(rendus[eid] || {}, { monde: { op: j.op } });
      sauverRendus();
      suivreMonde(eid, j.op);
    } catch (err) {
      mondeEtat.textContent = 'Pièce 3D impossible : ' + (err && err.message ? err.message : 'erreur inconnue') + '.';
      btnMonde.disabled = false;
    }
  }
  async function suivreMonde(eid, op) {
    if (suivisMonde[op]) return;
    suivisMonde[op] = true;
    const ici = () => ouvert.rendu && renduCtx && renduCtx.eid === eid;
    const t0 = Date.now();
    try {
      for (;;) {
        const q = await fetch('api/monde?op=' + encodeURIComponent(op), { cache: 'no-store', headers: entetes(false) });
        const s2 = await lireJSON(q);
        if (!q.ok || s2.etat === 'erreur') throw new Error(s2.erreur || 'La génération a échoué');
        if (s2.etat === 'fini' && s2.monde) {
          rendus[eid] = Object.assign(rendus[eid] || {}, { monde: { op, url: s2.monde.url, vignette: s2.monde.vignette } });
          sauverRendus();
          if (ici()) { lienMonde.href = s2.monde.url; lienMonde.hidden = false; btnMonde.hidden = true; mondeEtat.textContent = 'La pièce en 3D est prête.'; }
          else toast('La pièce 3D de l’espace ' + DEF[eid].nom + ' est prête');
          return;
        }
        const min = Math.floor((Date.now() - t0) / 60000);
        if (ici()) { btnMonde.disabled = true; mondeEtat.textContent = 'Pièce 3D en préparation' + (min ? ' · ' + min + ' min' : '') + (s2.progres ? ' · ' + s2.progres : '') + ' (environ 5 minutes)'; }
        if (Date.now() - t0 > 25 * 60000) throw new Error('délai dépassé');
        await wait(10000);
      }
    } catch (err) {
      if (ici()) { mondeEtat.textContent = 'Pièce 3D impossible : ' + (err && err.message ? err.message : 'erreur inconnue') + '.'; btnMonde.disabled = false; }
      if (rendus[eid] && rendus[eid].monde && rendus[eid].monde.op === op && !rendus[eid].monde.url) { delete rendus[eid].monde; sauverRendus(); }
    } finally { delete suivisMonde[op]; }
  }

  /* ---------------------------------------------------------------
     Clics : une seule écoute pour toute la page
     --------------------------------------------------------------- */
  document.addEventListener('click', e => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    let el;
    if ((el = t.closest('[data-aller]'))) { e.preventDefault(); allerVers(+el.dataset.aller); return; }
    if ((el = t.closest('[data-piece]'))) { const [eid, sid] = el.dataset.piece.split(':'); ouvrirPiece(eid, sid); return; }
    if ((el = t.closest('[data-voir]'))) { const [eid, sid] = el.dataset.voir.split(':'); ouvrirPiece(eid, sid, { depuis: 'panier' }); return; }
    if (t.closest('[data-fiche-fermer]')) { if (ouvert.studio) fermerPiece(); else fermerFiche(); return; }
    if (t.closest('[data-panier-fermer]')) { fermerPanier(); return; }
    if (t.closest('[data-reinit]')) { reinitialiser(); return; }
    if (t.closest('[data-panier]')) { e.preventDefault(); ouvrirPanier(); return; }
    if ((el = t.closest('[data-modal-open]'))) { e.preventDefault(); const b = el; (ouvert.menu ? closeMenu() : Promise.resolve()).then(() => openModal(b)); return; }
    if (t.closest('[data-modal-close]')) { e.preventDefault(); closeModal(); return; }
    if (t.closest('[data-accueil]')) {
      e.preventDefault();
      const go = () => { if (ouvert.panier) fermerPanier(true); if (mode === 'visite') retourAccueil(); };
      if (ouvert.menu) closeMenu().then(go); else go();
      return;
    }
    if ((el = t.closest('[data-station]'))) { verrou = 0; naviguer(el.dataset.station === 'suiv' ? 1 : -1); return; }
    if ((el = t.closest('[data-amb]'))) { choisirAmbiance(+el.dataset.amb); return; }
    if ((el = t.closest('[data-vue]'))) { choisirVue(el.dataset.vue); return; }
    if (t.closest('[data-rendu-fermer]')) { fermerRendu(); return; }
    if (t.closest('[data-rendu-generer]')) { genererRendu(); return; }
    if (t.closest('[data-monde-generer]')) { genererMonde(); return; }
    if (t.closest('[data-rendu]')) { const e2 = espaceDe(k); if (e2 && mode === 'visite') ouvrirRendu(e2.id); return; }
    if (t.closest('.skip')) { e.preventDefault(); entrerBtn.focus(); return; }
    if (t.closest('#entrer')) { if (mode === 'accueil') entrer(0); }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (ouvert.rendu) fermerRendu();
      else if (ouvert.modal) closeModal();
      else if (ouvert.fiche && !cata.hidden) fermerCata();
      else if (ouvert.menu) closeMenu().then(() => menuBtn.focus());
      else if (ouvert.studio) fermerPiece();
      else if (ouvert.fiche) fermerFiche();
      else if (ouvert.panier) fermerPanier();
      return;
    }
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target instanceof Element ? e.target : null;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (bloque() || ouvert.menu) return;
    let dir = 0;
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !(t && t.closest('button, a')))) dir = 1;
    else if (e.key === 'ArrowUp' || e.key === 'PageUp') dir = -1;
    if (dir) { e.preventDefault(); naviguer(dir); return; }
    if (mode === 'visite' && (e.key === 'Home' || e.key === 'End')) { e.preventDefault(); allerStation(e.key === 'Home' ? 0 : DERNIERE); }
  });

  let rzT = 0;
  addEventListener('resize', () => {
    clearTimeout(rzT);
    rzT = setTimeout(() => {
      if (has3D() && mode === 'visite' && !ouvert.studio && !V().enMouvement()) {
        if (k === 0) poseCourante = poseStation(0);
        if (poseCourante) V().placer(poseCourante, !!poseCourante.brut);
      }
      majDecalage(true);
    }, 150);
  });

  /* ---------------------------------------------------------------
     Maquette 3D : avancement, prête, indisponible
     --------------------------------------------------------------- */
  let p3d = 0, etat3D = 'attente', dernierSigne = performance.now();
  function majEntrer() {
    if (etat3D === 'echec') {
      entrerBtn.classList.remove('is-attente', 'is-pret');
      entrerBtn.removeAttribute('aria-busy');
      entrerTxt.textContent = 'Découvrir la sélection';
      entrerEtat.textContent = 'La 3D ne s’affiche pas ici : toutes les pièces sont dans la sélection';
      entrerPlein.style.strokeDashoffset = '0';
      return;
    }
    const pret = has3D(), p = clamp(p3d, 0, 1);
    entrerBtn.classList.toggle('is-pret', pret);
    entrerBtn.classList.toggle('is-attente', !pret);
    entrerBtn.setAttribute('aria-busy', String(!pret));
    entrerPlein.style.strokeDashoffset = String(Math.round(100 - 100 * (pret ? 1 : p)));
    entrerEtat.textContent = pret
      ? enLettres(NB) + ' espaces · ' + NB_PIECES + ' pièces à découvrir'
      : (veutEntrer ? 'Ouverture de la maquette · ' : 'Maquette 3D en préparation · ') + Math.round(p * 100) + ' %';
  }
  addEventListener('visite3d:progres', e => {
    p3d = Math.max(p3d, (e.detail && e.detail.p) || 0);
    dernierSigne = performance.now();
    if (mode === 'accueil') majEntrer();
  });
  const pret3D = new Promise(resolve => {
    addEventListener('visite3d:pret', () => { etat3D = 'pret'; resolve(); }, { once: true });
    addEventListener('visite3d:echec', () => { etat3D = 'echec'; resolve(); }, { once: true });
  });
  addEventListener('visite3d:pret', () => {
    root.classList.remove('no-3d');
    majEntrer();
    // le visiteur attendait : on laisse la maquette souffler un instant avant le vol d'entrée
    if (veutEntrer && mode === 'accueil') { const v = veutEntrer; setTimeout(() => { if (mode === 'accueil') entrer(v.n, v.o); }, 450); }
  });
  addEventListener('visite3d:echec', () => {
    root.classList.add('no-3d');
    const leg = $('.hero__legende > span:last-child');
    if (leg) leg.textContent = 'La proposition, rendue à partir de la photo de la chambre. Chaque pièce proposée, avec sa fiche et son prix, est dans la sélection.';
    majEntrer();
    if (veutEntrer && mode === 'accueil') { veutEntrer = null; ouvrirPanier(); }
  });
  addEventListener('visite3d:point', e => { if (mode === 'visite' && e.detail) ouvrirPiece(e.detail.espace, e.detail.slot); });
  addEventListener('visite3d:espace', e => { if (mode === 'visite' && e.detail) allerVers(stationDe(e.detail.espace)); });
  addEventListener('visite3d:perdu', () => toast('La maquette 3D se recharge…'));
  function signalerEchec(raison) {
    if (etat3D !== 'attente') return;
    window.VISITE3D = { ok: false };
    window.dispatchEvent(new CustomEvent('visite3d:echec', { detail: { raison } }));
  }
  // sécurité : le script de la maquette ne s'est pas lancé, ou plus rien n'avance
  addEventListener('load', () => { setTimeout(() => { if (!window.VISITE3D_CHARGEMENT && !window.VISITE3D) signalerEchec('script'); }, 0); });
  const garde = setInterval(() => {
    if (etat3D !== 'attente') { clearInterval(garde); return; }
    if (performance.now() - dernierSigne > 45000) { clearInterval(garde); signalerEchec('délai'); }
  }, 3000);

  /* Pétales de bougainvillier qui se détachent et tombent (accueil) */
  const SVGNS = 'http://www.w3.org/2000/svg';
  const rP = alea(97);
  let petalesActif = false, petalesAppel = null, vivants = 0;
  function petale(sec, fl, r, fin) {
    const sr = sec.getBoundingClientRect(), fr = fl.getBoundingClientRect();
    const droite = fl.classList.contains('fleur--tr');
    const x0 = fr.left - sr.left + fr.width * (droite ? .3 + r() * .6 : .1 + r() * .6);
    const y0 = fr.top - sr.top + fr.height * (.25 + r() * .4);
    const el = document.createElementNS(SVGNS, 'svg');
    el.setAttribute('class', 'petale');
    el.setAttribute('viewBox', '-10 -11 20 22');
    el.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(SVGNS, 'path');
    p.setAttribute('d', 'M0 10C-6 8-8.5 0-5.5-5.5C-3.5-8.5-1.2-10 0-10C1.2-10 3.5-8.5 5.5-5.5C8.5 0 6 8 0 10Z');
    p.setAttribute('fill', 'hsl(' + Math.round(318 + r() * 16) + ',' + Math.round(70 + r() * 18) + '%,' + Math.round(42 + r() * 18) + '%)');
    el.appendChild(p);
    sec.appendChild(el);
    const dur = 6 + r() * 3, dx = (r() - .5) * 160, dy = 260 + r() * 300;
    gsap.set(el, { x: x0, y: y0, rotation: r() * 360, scale: .6 + r() * .5, autoAlpha: 0 });
    gsap.timeline({ onComplete: () => { el.remove(); fin(); } })
      .to(el, { autoAlpha: 1, duration: .6 }, 0)
      .to(el, { y: y0 + dy, duration: dur, ease: 'none' }, 0)
      .to(el, { x: x0 + dx, duration: dur, ease: 'sine.inOut' }, 0)
      .to(el, { rotation: '+=' + Math.round(180 + r() * 360), duration: dur, ease: 'none' }, 0)
      .to(el, { scaleX: .25, duration: .9 + r() * .6, yoyo: true, repeat: Math.floor(dur), ease: 'sine.inOut' }, 0)
      .to(el, { autoAlpha: 0, duration: 1.2 }, dur - 1.2);
  }
  function planifierPetales() {
    if (!ANIM || !heroFleurs.length) return;
    petalesActif = true;
    if (petalesAppel) petalesAppel.kill();
    const suivant = () => {
      petalesAppel = gsap.delayedCall(1.2 + rP() * 2.2, () => {
        if (!petalesActif) return;
        if (vivants < 4) { vivants++; petale(hero, heroFleurs[Math.floor(rP() * heroFleurs.length)], rP, () => { vivants--; }); }
        suivant();
      });
    };
    suivant();
  }
  function arreterPetales() { petalesActif = false; if (petalesAppel) petalesAppel.kill(); }

  function demarrer() {
    root.classList.remove('is-loading');
    mode = 'accueil';
    majInert();
    majEntrer();
    majChrome();
    planifierPetales();
    if (veutEntrer && has3D()) { const v = veutEntrer; entrer(v.n, v.o); }
  }

  majInert();
  majChrome();
  majCommandes(0);

  /* ---------------------------------------------------------------
     Sans GSAP : version simple mais complète
     --------------------------------------------------------------- */
  if (!hasGSAP) {
    root.classList.add('no-gsap');
    donnerFeu();
    const pre = $('.preloader');
    if (pre) pre.remove();
    preparerFleurs();
    demarrer();
    return;
  }

  /* =================================================================
     Avec GSAP : préchargement, ouverture en arche, accueil
     ================================================================= */
  gsap.registerPlugin(SplitText, CustomEase);
  // images lentes (petits appareils) : le temps reste réel, les vols de caméra gardent leur durée
  gsap.ticker.lagSmoothing(1200, 33);
  CustomEase.create('mc', '0.7,0,0.2,1');
  CustomEase.create('mcOut', '0.16,1,0.3,1');
  if (REDUCE) root.classList.add('reduce-motion');

  const pre = $('.preloader');
  const shape = pre && $('.preloader__shape', pre);
  const lineFill = pre && $('.preloader__line > span', pre);
  const pctEl = pre && $('.preloader__pct b', pre);
  const etapeEl = pre && $('.preloader__etape', pre);
  root.classList.add('is-loading');

  /* Rideau : rectangle plein percé d'une arche (règle de remplissage evenodd) */
  const arch = { w: 0, h: 0 };
  function drawArch() {
    if (!shape || !shape.isConnected) return;
    const w = innerWidth, h = innerHeight;
    const r = arch.w / 2, cx = w / 2;
    const B = h + r + 20;
    const cy = h - arch.h + r;
    let d = 'M0 0H' + w + 'V' + B + 'H0Z';
    if (arch.w > .5 && arch.h > .5) d += 'M' + (cx - r) + ' ' + B + 'V' + cy + 'A' + r + ' ' + r + ' 0 0 1 ' + (cx + r) + ' ' + cy + 'V' + B + 'Z';
    shape.setAttribute('d', d);
  }
  drawArch();
  addEventListener('resize', drawArch);

  const fontsReady = Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), wait(2500)]);
  const heroImg = $('.hero__photo img');
  const imgReady = Promise.race([(heroImg.decode ? heroImg.decode() : Promise.resolve()).catch(() => {}), wait(6000)]);
  let okPolices = 0, okImage = 0, okFleurs = 0;
  fontsReady.then(() => { okPolices = 1; });
  imgReady.then(() => { okImage = 1; });

  // compteur : la maquette pèse l'essentiel du chargement
  const compteur = { v: 0 };
  const cibleCompteur = () => Math.round(100 * (.08 * okPolices + .12 * okImage + .08 * okFleurs + .72 * (etat3D === 'attente' ? p3d : 1)));
  const tickCompteur = () => {
    const c = cibleCompteur();
    compteur.v += (c - compteur.v) * .12;
    if (c - compteur.v < .5) compteur.v = c;
    if (pctEl) pctEl.textContent = String(Math.floor(compteur.v));
    if (etapeEl) etapeEl.textContent = etat3D === 'attente' ? (p3d < .7 ? 'Construction de la maquette' : 'Mise en lumière') : 'Préparation de la visite';
    if (lineFill) gsap.set(lineFill, { scaleY: .06 + .94 * compteur.v / 100 });
  };
  gsap.ticker.add(tickCompteur);

  let preChars = { caps: [], script: [], sides: [] };
  function preloaderIn() {
    const tl = gsap.timeline();
    if (!pre) return tl;
    const caps = SplitText.create($$('.preloader__caps span', pre), { type: 'words,chars' }).chars;
    const script = SplitText.create($('.preloader__script', pre), { type: 'words,chars' }).chars;
    const left = SplitText.create($('.preloader__side--l', pre), { type: 'words,chars' }).chars;
    const right = SplitText.create($('.preloader__side--r', pre), { type: 'words,chars' }).chars;
    preChars = { caps, script, sides: left.concat(right) };
    if (REDUCE) { pre.classList.add('is-ready'); return tl; }
    gsap.set(caps, { opacity: 0, filter: 'blur(12px)', yPercent: 14 });
    gsap.set(script, { opacity: 0, filter: 'blur(8px)', x: -10 });
    gsap.set(preChars.sides, { opacity: 0, filter: 'blur(6px)' });
    gsap.set(['.preloader__mark', '.preloader__foot', '.preloader__line', '.preloader__pct'], { opacity: 0 });
    pre.classList.add('is-ready');
    tl.to('.preloader__mark', { opacity: 1, duration: 1, ease: 'power2.out' }, 0)
      .fromTo('.preloader__mark svg', { rotation: -60, scale: .6 }, { rotation: 0, scale: 1, duration: 1.8, ease: 'expo.out' }, 0)
      .to(caps, { opacity: 1, filter: 'blur(0px)', yPercent: 0, duration: 1.1, stagger: .05, ease: 'power3.out' }, .2)
      .to(script, { opacity: 1, filter: 'blur(0px)', x: 0, duration: .9, stagger: .05, ease: 'power2.out' }, .6)
      .to(left, { opacity: 1, filter: 'blur(0px)', duration: .5, stagger: .08, ease: 'power1.out' }, .25)
      .to(right, { opacity: 1, filter: 'blur(0px)', duration: .5, stagger: .05, ease: 'power1.out' }, .25)
      .to(['.preloader__foot', '.preloader__line', '.preloader__pct'], { opacity: 1, duration: 1, ease: 'power2.out' }, .8)
      .to('.preloader__watermark', { opacity: .05, duration: 2.6, ease: 'power1.out' }, .4);
    return tl;
  }

  const fleursPretes = preparerFleurs().then(() => { okFleurs = 1; });
  fontsReady.then(() => {
    const intro = preloaderIn();
    // la maquette se construit une fois les lettres posées : l'introduction reste fluide
    if (REDUCE || !pre) donnerFeu(); else intro.call(donnerFeu, [], 1.9);
    // la maquette est attendue quelques secondes ; au-delà, l'accueil s'ouvre
    // et le bouton « Entrer » affiche la fin de sa préparation
    const attente3D = Promise.race([pret3D, wait(12000)]);
    Promise.all([imgReady, fleursPretes, attente3D, wait(REDUCE ? 0 : 2800)]).then(() => {
      const go = () => {
        gsap.ticker.remove(tickCompteur);
        try { build(); } catch (err) { console.error(err); }
        leave();
      };
      const reste = { v: compteur.v };
      const fin = etat3D === 'attente' ? Math.max(compteur.v, cibleCompteur()) : 100;
      if (!REDUCE && pctEl) gsap.to(reste, { v: fin, duration: .6, ease: 'power2.inOut', onUpdate: () => { pctEl.textContent = String(Math.floor(reste.v)); if (lineFill) gsap.set(lineFill, { scaleY: .06 + .94 * reste.v / 100 }); }, onComplete: go });
      else go();
    });
  });

  /* Sortie : l'arche monte puis s'ouvre en plein écran sur l'accueil */
  function leave() {
    // maquette encore en construction : elle attend la fin de l'ouverture
    if (etat3D === 'attente') suspendre3D(REDUCE ? 400 : 3300);
    if (!pre || REDUCE) {
      if (pre) gsap.to(pre, { autoAlpha: 0, duration: .4, onComplete: () => pre.remove() });
      heroIntro();
      demarrer();
      return;
    }
    const w = innerWidth, h = innerHeight;
    const w1 = w < 700 ? w * .52 : Math.min(w * .24, 380);
    const h1 = h * (w < 700 ? .58 : .64);
    gsap.timeline({ onComplete: () => { pre.remove(); demarrer(); } })
      .to(preChars.caps.concat(preChars.script), { opacity: 0, filter: 'blur(10px)', yPercent: -16, duration: .6, stagger: .015, ease: 'power2.in' }, 0)
      .to(['.preloader__line', '.preloader__foot', '.preloader__pct'], { opacity: 0, duration: .45 }, 0)
      .to('.preloader__watermark', { opacity: 0, duration: .9 }, 0)
      .to(arch, { w: w1, h: h1, duration: 1.25, ease: 'expo.inOut', onUpdate: drawArch }, .3)
      .to('.preloader__mark', { opacity: 0, duration: .6 }, 1.1)
      .to(arch, { w: Math.max(w, h) * 2.4, h: h * 2, duration: 1.45, ease: 'expo.inOut', onUpdate: drawArch }, 1.5)
      .to(preChars.sides, { opacity: 0, filter: 'blur(6px)', duration: .45, stagger: .015 }, 1.55)
      .add(heroIntro(), 1.45);
  }

  /* Accueil : états de départ, fleurs qui se balancent, emblème qui tourne */
  function build() {
    heroChars = SplitText.create($$('.hero__title .line'), { type: 'words,chars', charsClass: 'char' }).chars;
    scriptChars = SplitText.create('.hero__script', { type: 'words,chars', charsClass: 'char' }).chars;
    titresChars = panneaux.map(p => {
      const h = $('.station__titre', p);
      return h ? SplitText.create(h, { type: 'words,chars', wordsClass: 'mot', charsClass: 'char' }).chars : [];
    });
    gsap.set(heroChars, { transformOrigin: '50% 0%' });
    if (!ANIM) return;
    gsap.set(heroChars, { opacity: 0, scaleY: 1.9, yPercent: -14, filter: 'blur(8px)' });
    gsap.set(scriptChars, { opacity: 0, x: -12, filter: 'blur(6px)' });
    gsap.set($$('.hero__reveal'), { yPercent: 115 });
    gsap.set($$('.hero__fade'), { autoAlpha: 0 });
    gsap.set(header, { autoAlpha: 0 });
    gsap.set(heroFleurs, { autoAlpha: 0, scale: .8 });
    gsap.to('.emblem__rot', { rotation: 360, duration: 52, ease: 'none', repeat: -1, svgOrigin: '50 50' });
    heroFleurs.forEach(el => {
      const s = $('.fleur__sway', el);
      if (s) balancements.push(gsap.fromTo(s, { rotation: -1.1 }, { rotation: 1.1, duration: 3.8 + Math.random() * 1.6, ease: 'sine.inOut', yoyo: true, repeat: -1 }));
    });
  }

  /* Entrée de l'accueil : lettres étirées qui se posent */
  function heroIntro() {
    const tl = gsap.timeline();
    if (!ANIM) return tl;
    tl.fromTo('.hero__photo .media__inner', { scale: 1.12 }, { scale: 1, duration: 2.6, ease: 'expo.out' }, 0)
      .to(heroChars, { opacity: 1, scaleY: 1, yPercent: 0, filter: 'blur(0px)', duration: 1.5, stagger: .045, ease: 'expo.out' }, .15)
      .to(scriptChars, { opacity: 1, x: 0, filter: 'blur(0px)', duration: 1, stagger: .03, ease: 'power2.out' }, .6)
      .to($$('.hero__reveal'), { yPercent: 0, duration: 1.1, stagger: .07, ease: 'mcOut' }, .45)
      .to(heroFleurs, { autoAlpha: 1, scale: 1, duration: 1.8, stagger: .15, ease: 'expo.out' }, .3)
      .to($$('.hero__fade'), { autoAlpha: 1, duration: .9, stagger: .08, ease: 'power2.out' }, .9)
      .to(header, { autoAlpha: 1, duration: 1, ease: 'power2.out' }, 1.1);
    return tl;
  }
})();
