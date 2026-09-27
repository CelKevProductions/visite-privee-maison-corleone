/* =================================================================
   Visite 3D — moteur
   Scène et lumière, stations de la visite (caméra animée par GSAP),
   points sur les meubles, vue « pièce seule » (studio), jour / soir.
   ================================================================= */
const evt = (nom, detail) => window.dispatchEvent(new CustomEvent(nom, { detail }));
const attendre = () => new Promise(r => requestAnimationFrame(() => r()));
// entre deux étapes de construction : une image passe, et la page peut suspendre la maquette
// (pendant l'ouverture du préchargement, par exemple)
const ceder = async () => { await attendre(); if (window.MC_ATTENTE_3D) await window.MC_ATTENTE_3D(); };
const ETAT = window.MC_ETAT || { choix: {}, retenu: {} };
const REDUIT = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TACTILE = matchMedia('(pointer: coarse)').matches;
const MOBILE = TACTILE || Math.min(innerWidth, innerHeight) < 700;
const QUAL = Object.assign(MOBILE ? { dpr: 1.35, ombre: 1024 } : { dpr: 1.6, ombre: 2048 }, { dprMin: .8 }, window.MC_QUALITE || {});
const GS = window.gsap || null;
const SUSPENDUS = ['Suspension', 'Lustre', 'Applique', 'Plafonnier'];
const estSuspendu = p => SUSPENDUS.includes(p.cat) || ['suspension', 'lustre', 'applique', 'plafonnier'].includes(p.fam);

function echec3D(err) {
  console.warn('Visite 3D indisponible :', err);
  window.VISITE3D = { ok: false };
  evt('visite3d:echec', { raison: String((err && err.message) || err) });
}

async function lancer3D() {
  const canvas = document.getElementById('scene3d');
  if (!canvas) return;
  const CHRONO = [];
  const chrono = nom => { if (QUAL.debug) CHRONO.push([nom, Math.round(performance.now())]); };
  // la page donne le départ une fois l'introduction du préchargement jouée
  if (window.MC_FEU_3D) await window.MC_FEU_3D;
  chrono('début');
  let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    if (!renderer.capabilities.isWebGL2) throw new Error('WebGL 2 indisponible');
  } catch (err) { echec3D(err); return; }

  let dpr = Math.min(window.devicePixelRatio || 1, QUAL.dpr);
  renderer.setPixelRatio(dpr);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = MOBILE ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); evt('visite3d:perdu', {}); });
  canvas.addEventListener('webglcontextrestored', () => { renderer.shadowMap.needsUpdate = true; evt('visite3d:retrouve', {}); });

  /* ---------------------------------------------------------------
     Scène, lumières, environnement
     --------------------------------------------------------------- */
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, .05, 260);
  chrono('renderer');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  chrono('environnement');
  scene.environment = envTex;
  scene.environmentIntensity = .6;
  const FOND = { jour: new THREE.Color('#E6E1D5'), soir: new THREE.Color('#1B1116') };
  scene.background = FOND.jour.clone();
  scene.fog = new THREE.Fog(FOND.jour.clone(), 70, 150);
  const hemi = new THREE.HemisphereLight('#FFF6EA', '#C8BBA8', 1.15);
  const soleil = new THREE.DirectionalLight('#FFF0DC', 2.6);
  soleil.castShadow = true;
  soleil.shadow.mapSize.set(QUAL.ombre, QUAL.ombre);
  soleil.shadow.bias = -.0004;
  soleil.shadow.normalBias = .02;
  soleil.shadow.radius = 3;
  scene.add(hemi, soleil, soleil.target);
  const lampes = [0, 1, 2].map(() => { const l = new THREE.PointLight('#FFB877', 0, 8, 2); scene.add(l); return l; });
  const solMaquette = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), M('sol'));
  solMaquette.rotation.x = -Math.PI / 2; solMaquette.position.y = -.36; solMaquette.receiveShadow = true;
  scene.add(solMaquette);

  /* ---------------------------------------------------------------
     Choix de la sélection (partagés avec la page)
     --------------------------------------------------------------- */
  const DEF = {};
  DATA.ESPACES.forEach(e => { DEF[e.id] = e; });
  const choixDe = (eid, sid) => (ETAT.choix[eid] && ETAT.choix[eid][sid]) || DEF[eid].emplacements.find(s => s.id === sid).choix[0];
  const retenuDe = (eid, sid) => !(ETAT.retenu[eid] && ETAT.retenu[eid][sid] === false);

  /* ---------------------------------------------------------------
     Construction des espaces et des produits
     --------------------------------------------------------------- */
  const ESP = {};
  const tmpBox = new THREE.Box3(), tmpV = new THREE.Vector3();
  function boiteUtile(g) {
    tmpBox.makeEmpty();
    g.updateMatrixWorld(true);
    g.traverse(o => {
      if (!o.isMesh || o.material.transparent || o.material.userData.halo) return;
      tmpBox.expandByObject(o);
    });
    if (tmpBox.isEmpty()) g.traverse(o => { if (o.isMesh) tmpBox.expandByObject(o); });
    return tmpBox.clone();
  }
  function calculerAncre(E, sid) {
    const empl = E.emplacements[sid], p = E.prod[sid];
    const g = p.groupes[Math.min(p.groupes.length - 1, empl.ancreIndex || 0)];
    const b = boiteUtile(g), c = b.getCenter(new THREE.Vector3());
    if (empl.ancre === 'bas') c.y = b.min.y - .06;
    else if (empl.ancre === 'centre') { /* centre de la boîte */ }
    else c.y = Math.min(b.max.y + .12, b.min.y + 3.2);
    p.ancre = c;
    p.boite = b;
  }
  function appliquerRetenu(E, sid) {
    const on = retenuDe(E.id, sid);
    E.prod[sid].groupes.forEach(g => g.traverse(o => {
      if (o.isSprite || o.isPoints || (o.material && o.material.userData && o.material.userData.halo)) { o.visible = on; return; }
      if (!o.isMesh) return;
      if (o.userData.matOrig === undefined) { o.userData.matOrig = o.material; o.userData.ombreOrig = o.castShadow; }
      o.material = on ? o.userData.matOrig : M('fantome');
      o.castShadow = on ? o.userData.ombreOrig : false;
    }));
    renderer.shadowMap.needsUpdate = true;
  }
  function construireEmplacement(E, sid) {
    const empl = E.emplacements[sid];
    if (!empl) return;
    const old = E.prod[sid];
    if (old) old.groupes.forEach(g => E.g.remove(g));
    const sku = choixDe(E.id, sid);
    R = alea(sku.length * 31 + 5);
    const modele = construireProduit(sku, empl.opts || {});
    cuire(modele);
    // meuble adossé (lit, canapé) : son dos vient contre le mur, quelle que soit sa profondeur
    let base = modele;
    if (empl.dos) {
      const b = boiteUtile(modele);
      const dz = -empl.dos + .01 - b.min.z;
      if (Math.abs(dz) > .02) { base = new THREE.Group(); base.add(modele); modele.position.z = dz; base.userData.sku = sku; }
    }
    const groupes = empl.poses.map((p, i) => {
      const g = i ? base.clone() : base;
      g.position.set(p[0], p[1], p[2]);
      g.rotation.y = p[3] || 0;
      g.traverse(o => { o.userData.emplacement = sid; o.userData.espace = E.id; });
      E.g.add(g);
      return g;
    });
    E.prod[sid] = { sku, groupes };
    appliquerRetenu(E, sid);
    calculerAncre(E, sid);
    E.surChoix.forEach(f => f(sid, DATA.PRODUITS[sku], E.prod[sid]));
    renderer.shadowMap.needsUpdate = true;
  }
  // parcours en pointillés entre les espaces
  function parcours() {
    const pts = [[-13.5, -2.9], [-9.4, -2.3], [-4.6, -2.7], [0, -2.2], [7.5, -2.3], [12.6, -1.6], [13.2, 2.8], [12.3, 7.4], [9, 14.6], [2, 14.8], [-3.4, 13.4], [-9.5, 13]];
    const c = new THREE.CatmullRomCurve3(pts.map(p => V3(p[0], -.345, p[1])));
    const L = c.getLength(), n = Math.floor(L / .55), l = [];
    for (let i = 0; i < n; i++) { const u = i / n, p = c.getPointAt(u), t = c.getTangentAt(u); l.push([p.x, p.y, p.z, 0, Math.atan2(t.x, t.z), 0, 1]); }
    instances(scene, new THREE.BoxGeometry(.06, .01, .28), M('laque:#A79E90'), l);
  }

  /* ---------------------------------------------------------------
     Monde 3D réel (Marble / Spark), si la version l'inclut
     --------------------------------------------------------------- */
  let spark = null;
  function chargerMonde(E) {
    const m = E.def.monde;
    if (!m || !m.spz) return;
    if (typeof SPARK === 'undefined') { console.warn('Monde 3D prévu pour', E.id, ': ajouter Spark à la version pour l’afficher.'); return; }
    try {
      if (!spark) { spark = new SPARK.SparkRenderer({ renderer }); scene.add(spark); }
      const splat = new SPARK.SplatMesh({ url: m.spz });
      const e = m.echelle || { metric_scale_factor: 1, ground_plane_offset: 0 };
      splat.scale.setScalar(e.metric_scale_factor);
      splat.position.y = -e.ground_plane_offset;
      const repere = new THREE.Group();
      repere.rotation.x = Math.PI;
      repere.add(splat);
      E.g.add(repere);
      E.g.children.forEach(o => { if (o !== repere) o.visible = false; });
      E.murs.forEach(w => { w.me.visible = w.cap.visible = false; w.off = true; });
    } catch (err) { console.warn('Monde 3D non chargé pour', E.id, err); }
  }

  /* ---------------------------------------------------------------
     Points sur les meubles, étiquettes des espaces
     --------------------------------------------------------------- */
  const couche = document.querySelector('.hs-couche');
  const POINTS = [], ETIQ = [];
  function creerPoints() {
    if (!couche) return;
    DATA.ESPACES.forEach((e, ie) => {
      e.emplacements.forEach((s, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'hs';
        b.dataset.espace = e.id; b.dataset.slot = s.id;
        b.innerHTML = '<span class="hs__pt" aria-hidden="true"></span><span class="hs__lbl"><em>(' + String(i + 1).padStart(2, '0') + ')</em> <span class="hs__cat"></span> <b class="hs__nom"></b> <span class="hs__prix" data-prix></span></span>';
        b.addEventListener('click', ev => { ev.stopPropagation(); evt('visite3d:point', { espace: e.id, slot: s.id, x: ev.clientX, y: ev.clientY }); });
        couche.appendChild(b);
        POINTS.push({ el: b, espace: e.id, slot: s.id, vis: false, occ: false });
      });
      const t = document.createElement('button');
      t.type = 'button'; t.className = 'hs-espace';
      t.innerHTML = '<em>(' + String(ie + 1).padStart(2, '0') + ')</em> <span>' + e.nom + '</span>';
      t.setAttribute('aria-label', e.nom);
      t.addEventListener('click', ev => { ev.stopPropagation(); evt('visite3d:espace', { espace: e.id }); });
      couche.appendChild(t);
      ETIQ.push({ el: t, espace: e.id, vis: false });
    });
    majLibelles();
  }
  const fmt = v => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: Math.abs(v - Math.round(v)) < .001 ? 0 : 2, minimumFractionDigits: Math.abs(v - Math.round(v)) < .001 ? 0 : 2 }).format(v);
  function majLibelles() {
    POINTS.forEach(h => {
      const p = DATA.PRODUITS[choixDe(h.espace, h.slot)];
      if (!p) return;
      h.el.querySelector('.hs__cat').textContent = p.cat;
      h.el.querySelector('.hs__nom').textContent = p.nom;
      h.el.querySelector('.hs__prix').textContent = p.prix > 0 ? fmt(p.prix) : 'sur devis';
      h.el.setAttribute('aria-label', p.cat + ' ' + p.nom + ', voir la pièce seule');
      h.el.classList.toggle('is-off', !retenuDe(h.espace, h.slot));
    });
  }

  /* ---------------------------------------------------------------
     Caméra : une pose animée par GSAP, plus un léger orbite au glisser
     --------------------------------------------------------------- */
  const cam = { px: 5, py: 42, pz: 44, tx: 6, ty: 0, tz: 1.5, fov: 34 };
  const orb = { yaw: 0, pitch: 0, cy: 0, cp: 0, max: .8, maxP: .2, actif: false };
  const souris = { x: 0, y: 0, sx: 0, sy: 0 };
  addEventListener('pointermove', e => { souris.x = e.clientX / innerWidth * 2 - 1; souris.y = e.clientY / innerHeight * 2 - 1; }, { passive: true });
  let tweenCam = null;

  function monde(E, p) { return V3(p[0], p[1], p[2]).add(E.g.position); }
  function pose(eid, vue) {
    if (eid === 'ensemble') return { px: 3, py: 40, pz: 46, tx: 6.5, ty: -1, tz: 2, fov: 34 };
    const E = ESP[eid];
    if (!E) return null;
    const v = E.vues[vue] || E.vues.maquette;
    const a = monde(E, v.pos), b = monde(E, v.cible);
    return { px: a.x, py: a.y, pz: a.z, tx: b.x, ty: b.y, tz: b.z, fov: v.fov };
  }
  // écran vertical : on recule pour les vues aériennes, on élargit le champ partout
  function poseEcran(p) {
    const a = innerWidth / innerHeight;
    if (a >= 1) return Object.assign({}, p);
    const k = 1 - a, haut = p.py - p.ty;
    const d = 1 + k * (haut > 20 ? 2 : haut > 4 ? .8 : 0);
    return { px: p.tx + (p.px - p.tx) * d, py: p.ty + (p.py - p.ty) * d, pz: p.tz + (p.pz - p.tz) * d, tx: p.tx, ty: p.ty, tz: p.tz, fov: Math.min(74, p.fov + k * 26) };
  }
  function placer(p, brut) { if (tweenCam) { tweenCam.kill(); tweenCam = null; } Object.assign(cam, brut ? p : poseEcran(p)); }
  function allerA(p, o = {}) {
    const dest = o.brut ? p : poseEcran(p);
    if (tweenCam) { tweenCam.kill(); tweenCam = null; }
    const from = Object.assign({}, cam);
    const d = Math.hypot(dest.px - from.px, dest.py - from.py, dest.pz - from.pz);
    const arc = o.arc !== false && d > 10;
    const ctrl = arc ? { px: (from.px + dest.px) / 2, py: Math.max(from.py, dest.py) + Math.min(16, d * .32), pz: (from.pz + dest.pz) / 2 } : null;
    let duree = o.duree != null ? o.duree : (arc ? Math.min(3.2, 1.3 + d / 18) : 1.6);
    if (REDUIT || !GS) duree = 0;
    const etat = { t: 0 };
    const maj = () => {
      const t = etat.t, u = 1 - t;
      if (ctrl) {
        cam.px = u * u * from.px + 2 * u * t * ctrl.px + t * t * dest.px;
        cam.py = u * u * from.py + 2 * u * t * ctrl.py + t * t * dest.py;
        cam.pz = u * u * from.pz + 2 * u * t * ctrl.pz + t * t * dest.pz;
      } else { cam.px = lerp(from.px, dest.px, t); cam.py = lerp(from.py, dest.py, t); cam.pz = lerp(from.pz, dest.pz, t); }
      cam.tx = lerp(from.tx, dest.tx, t); cam.ty = lerp(from.ty, dest.ty, t); cam.tz = lerp(from.tz, dest.tz, t);
      cam.fov = lerp(from.fov, dest.fov, t);
    };
    if (!duree) { etat.t = 1; maj(); if (o.fin) o.fin(); return null; }
    tweenCam = GS.to(etat, { t: 1, duration: duree, ease: o.ease || 'power3.inOut', onUpdate: maj, onComplete: () => { tweenCam = null; if (o.fin) o.fin(); } });
    return tweenCam;
  }
  function resetOrbite(duree = .9) {
    if (!GS || REDUIT || !duree) { orb.cy = orb.cp = 0; return; }
    GS.to(orb, { cy: 0, cp: 0, duration: duree, ease: 'power2.inOut', overwrite: true });
  }
  const off = new THREE.Vector3(), sph = new THREE.Spherical();
  function appliquerCamera(dt) {
    orb.yaw += (orb.cy - orb.yaw) * Math.min(1, dt * 7);
    orb.pitch += (orb.cp - orb.pitch) * Math.min(1, dt * 7);
    souris.sx += (souris.x - souris.sx) * Math.min(1, dt * 2.5);
    souris.sy += (souris.y - souris.sy) * Math.min(1, dt * 2.5);
    off.set(cam.px - cam.tx, cam.py - cam.ty, cam.pz - cam.tz);
    const parallaxe = REDUIT || TACTILE ? 0 : .045;
    const yaw = orb.yaw + souris.sx * parallaxe, pitch = orb.pitch - souris.sy * parallaxe * .5;
    if (yaw || pitch) {
      sph.setFromVector3(off);
      sph.theta -= yaw;
      sph.phi = clamp(sph.phi + pitch, .08, 1.54);
      off.setFromSpherical(sph);
    }
    camera.position.set(cam.tx + off.x, cam.ty + off.y, cam.tz + off.z);
    camera.lookAt(cam.tx, cam.ty, cam.tz);
    // plan proche proportionnel à la distance : la précision de profondeur suit la caméra
    // (sinon, vus de loin, les sols des pièces et le socle se confondent et scintillent)
    const proche = clamp(off.length() * .02, .05, 2.5);
    if (Math.abs(camera.fov - cam.fov) > .01 || Math.abs(camera.near - proche) > proche * .04) {
      camera.fov = cam.fov; camera.near = proche; camera.updateProjectionMatrix();
    }
  }
  // pose qui cadre un produit dans sa pièce (bouton « Voir dans la pièce »)
  function poseProduit(eid, sid) {
    const E = ESP[eid];
    if (!E || !E.prod[sid]) return null;
    const b = E.prod[sid].boite, c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
    const r = Math.max(.45, Math.max(s.x, s.y, s.z) * .62);
    const ref = monde(E, E.vues.explore.depart);
    const dir = ref.sub(c); dir.y = 0;
    if (dir.lengthSq() < .01) dir.set(1, 0, 1);
    dir.normalize();
    const dist = clamp(r * 2.9, 1.3, 16);
    const p = c.clone().add(dir.multiplyScalar(dist * .92)); p.y = c.y + dist * .42;
    return { px: p.x, py: p.y, pz: p.z, tx: c.x, ty: c.y, tz: c.z, fov: 48 };
  }

  /* ---------------------------------------------------------------
     Décalage optique : la maquette laisse la place aux panneaux
     --------------------------------------------------------------- */
  const dec = { x: 0, y: 0, cx: 0, cy: 0 };
  const decApplique = new Map();
  function majDecalage(dt, cible) {
    const k = Math.min(1, dt * 3.2);
    dec.x += (dec.cx - dec.x) * k; dec.y += (dec.cy - dec.y) * k;
    if (Math.abs(dec.cx - dec.x) < 2e-4) dec.x = dec.cx;
    if (Math.abs(dec.cy - dec.y) < 2e-4) dec.y = dec.cy;
    const cle = dec.x.toFixed(4) + ',' + dec.y.toFixed(4) + ',' + innerWidth + ',' + innerHeight;
    if (decApplique.get(cible) === cle) return;
    decApplique.set(cible, cle);
    const W = innerWidth, H = innerHeight;
    if (dec.x === 0 && dec.y === 0) cible.clearViewOffset();
    else cible.setViewOffset(W, H, -dec.x * W, dec.y * H, W, H);
  }

  /* ---------------------------------------------------------------
     Espace « au point » : ombres et lampes suivent l'espace regardé
     --------------------------------------------------------------- */
  let focusId = undefined;
  function setFocus(eid) {
    if (eid === focusId) return;
    focusId = eid;
    const E = eid ? ESP[eid] : null;
    const c = E ? E.g.position : V3(6, 0, 3);
    const r = !E ? 30 : eid === 'jardin' ? 11 : eid === 'lobby' || eid === 'presidentielle' ? 9.5 : eid === 'bar' ? 8 : 6.5;
    soleil.position.set(c.x + 16, 26, c.z + 12);
    soleil.target.position.set(c.x, 0, c.z);
    soleil.target.updateMatrixWorld();
    const sc = soleil.shadow.camera;
    sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 1; sc.far = 80;
    sc.updateProjectionMatrix();
    lampes.forEach((l, i) => { const p = E && E.lampes[i]; if (p) l.position.copy(p).add(E.g.position); else l.position.set(0, -50, 0); });
    renderer.shadowMap.needsUpdate = true;
  }

  /* ---------------------------------------------------------------
     Murs qui s'effacent côté caméra (effet maison de poupée)
     --------------------------------------------------------------- */
  const camLocal = new THREE.Vector3();
  function majMurs(dt, cam = camera) {
    const k = Math.min(1, dt * 7);
    for (const id in ESP) {
      const E = ESP[id];
      camLocal.copy(cam.position).sub(E.g.position);
      const b = E.bornes;
      let dedans = false;
      if (b) dedans = b.rond ? (camLocal.x ** 2 + camLocal.z ** 2 < b.rond * b.rond && camLocal.y < b.h) : (camLocal.x > b.x0 && camLocal.x < b.x1 && camLocal.z > b.z0 && camLocal.z < b.z1 && camLocal.y < b.h + .05);
      E.interieur.forEach(o => { o.visible = dedans; });
      E.murs.forEach(w => {
        if (w.off) return;
        const d = tmpV.copy(camLocal).sub(w.centre).dot(w.n);
        const cible = d > .02 ? 0 : 1;
        if (Math.abs(w.op - cible) < .002) return;
        const avant = w.op > .03;
        w.op += (cible - w.op) * k;
        if (Math.abs(w.op - cible) < .01) w.op = cible;
        w.me.material.opacity = w.cap.material.opacity = w.op;
        const vis = w.op > .03;
        w.me.visible = w.cap.visible = vis;
        w.me.material.depthWrite = w.op > .98;
        if (vis !== avant) renderer.shadowMap.needsUpdate = true;
      });
    }
  }

  /* ---------------------------------------------------------------
     Points : position à l'écran, visibilité, occlusion
     --------------------------------------------------------------- */
  const ray = new THREE.Raycaster();
  let frame = 0, espaceCourant = null, avecPoints = false, avecEtiquettes = false;
  function occulte(h, E, ancre) {
    const dir = tmpV.copy(ancre).sub(camera.position);
    const dist = dir.length();
    ray.set(camera.position, dir.normalize());
    ray.camera = camera;
    ray.far = dist - .15;
    const hits = ray.intersectObject(E.g, true);
    for (const hit of hits) {
      const o = hit.object;
      if (!o.visible || o.isSprite || o.isPoints) continue;
      if (o.material && o.material.transparent && o.material.opacity < .5) continue;
      if (o.material && (o.material.depthWrite === false || o.material.userData.halo)) continue;
      if (o.userData.emplacement === h.slot) continue;
      return true;
    }
    return false;
  }
  function majPoints() {
    if (!couche) return;
    frame++;
    const W = innerWidth, H = innerHeight, bouge = !!tweenCam || studio.actif;
    POINTS.forEach((h, i) => {
      const E = ESP[h.espace];
      let vis = false;
      if (!bouge && avecPoints && h.espace === espaceCourant && E.prod[h.slot]) {
        const a = E.prod[h.slot].ancre;
        tmpV.copy(a).project(camera);
        if (tmpV.z < 1 && Math.abs(tmpV.x) < 1.02 && Math.abs(tmpV.y) < 1.02) {
          h.el.style.transform = 'translate3d(' + ((tmpV.x * .5 + .5) * W).toFixed(1) + 'px,' + ((-tmpV.y * .5 + .5) * H).toFixed(1) + 'px,0)';
          if (!h.vis || (frame + i) % 6 === 0) h.occ = occulte(h, E, a);
          vis = !h.occ;
        }
      }
      if (vis !== h.vis) { h.vis = vis; h.el.classList.toggle('is-visible', vis); h.el.tabIndex = vis ? 0 : -1; }
    });
    ETIQ.forEach(t => {
      let vis = false;
      if (!bouge && avecEtiquettes) {
        const E = ESP[t.espace];
        tmpV.copy(E.g.position); tmpV.y = (E.bornes ? E.bornes.h : 3) + .8;
        tmpV.project(camera);
        if (tmpV.z < 1 && Math.abs(tmpV.x) < 1 && Math.abs(tmpV.y) < 1) {
          t.el.style.transform = 'translate3d(' + ((tmpV.x * .5 + .5) * W).toFixed(1) + 'px,' + ((-tmpV.y * .5 + .5) * H).toFixed(1) + 'px,0)';
          vis = true;
        }
      }
      if (vis !== t.vis) { t.vis = vis; t.el.classList.toggle('is-visible', vis); t.el.tabIndex = vis ? 0 : -1; }
    });
  }

  /* ---------------------------------------------------------------
     Ambiance jour / soir (animée par GSAP)
     --------------------------------------------------------------- */
  const amb = { v: 0 };
  let ambCible = 0;
  function appliquerAmbiance(a) {
    hemi.intensity = lerp(1.15, .1, a);
    soleil.intensity = lerp(2.6, .06, a);
    scene.environmentIntensity = lerp(.6, .1, a);
    scene.background.copy(FOND.jour).lerp(FOND.soir, a);
    scene.fog.color.copy(scene.background);
    lampes.forEach(l => { l.intensity = lerp(.35, 6.5, a * a); });
    LUMINEUX.forEach(e => {
      const v = lerp(e.jour, e.soir, a);
      if (e.champ === 'couleur') e.m.color.copy(e.m.userData.base).multiplyScalar(v);
      else if (e.champ === 'opacite') e.m.opacity = v;
      else e.m.emissiveIntensity = v;
    });
    renderer.toneMappingExposure = lerp(1, 1.12, a);
  }
  function setAmbiance(v, duree = 1.6) {
    ambCible = v;
    if (!GS || REDUIT || !duree) { if (GS) GS.killTweensOf(amb); amb.v = v; appliquerAmbiance(v); return; }
    GS.to(amb, { v, duration: duree, ease: 'power2.inOut', overwrite: true, onUpdate: () => appliquerAmbiance(amb.v) });
  }

  /* ---------------------------------------------------------------
     Studio : la pièce seule, sur un socle, qui tourne lentement
     --------------------------------------------------------------- */
  const studio = (() => {
    const sc = new THREE.Scene();
    sc.background = new THREE.Color('#ECE7DC');
    sc.environment = envTex;
    sc.environmentIntensity = .8;
    const cam2 = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, .05, 300);
    sc.add(new THREE.HemisphereLight('#FFF8EE', '#D2C6B5', 1.1));
    const cle = new THREE.DirectionalLight('#FFF3E2', 2.2); cle.position.set(3, 6, 5); sc.add(cle);
    const contre = new THREE.DirectionalLight('#E2E8F0', .75); contre.position.set(-4, 3, -4); sc.add(contre);
    const pivot = new THREE.Group(); sc.add(pivot);
    const socle = new THREE.Group(); sc.add(socle);
    cyl(socle, 1, 1.02, .06, M('laque:#DCD3C3'), 0, -.06, 0, 72);
    ombreSol(socle, 2.3, 2.3, 0, 0, .003, .8);
    const e = { actif: false, cible: V3(), dist: 4, r: 1, zoom: 1, zone: { fx: 1, fy: 1 }, modele: null, auto: null, pause: 0 };
    function jeter(m) { if (!m) return; pivot.remove(m); m.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    // distance pour que la pièce tienne dans la zone laissée libre par la fiche
    function distance() {
      const t = Math.tan(THREE.MathUtils.degToRad(cam2.fov / 2));
      const a = Math.atan(t * Math.min(e.zone.fy, cam2.aspect * e.zone.fx));
      return e.r / Math.sin(a) * 1.04;
    }
    function cadrer() {
      const d = e.dist * e.zoom;
      cam2.near = Math.max(.01, d / 60); cam2.far = d * 30; cam2.updateProjectionMatrix();
      cam2.position.set(0, e.cible.y + d * .3, d); cam2.lookAt(e.cible);
    }
    function construire(eid, sid, sku) {
      const E = ESP[eid], empl = E ? E.emplacements[sid] : null;
      R = alea(sku.length * 31 + 5);
      const m = construireProduit(sku, (empl && empl.opts) || {});
      const p = DATA.PRODUITS[sku] || {};
      const suspendu = estSuspendu(p);
      const b = boiteUtile(m), c = b.getCenter(V3()), s = b.getSize(V3());
      m.position.set(-c.x, suspendu ? -c.y + s.y / 2 + .1 : -b.min.y, -c.z);
      const porteur = new THREE.Group(); porteur.add(m);
      socle.visible = !suspendu;
      const rs = Math.max(s.x, s.z) * .66 + .2;
      socle.scale.set(rs, 1, rs);
      e.r = Math.max(.3, s.length() / 2);
      e.cible.set(0, suspendu ? s.y / 2 + .1 : s.y * .46, 0);
      e.dist = distance();
      e.zoom = 1;
      cadrer();
      return porteur;
    }
    function tourner() {
      if (e.auto) e.auto.kill();
      if (!GS || REDUIT) return;
      e.auto = GS.to(pivot.rotation, { y: '+=' + TAU, duration: 26, ease: 'none', repeat: -1 });
    }
    return {
      scene: sc, cam: cam2,
      get actif() { return e.actif; },
      ouvrir(eid, sid, sku) {
        if (GS) GS.killTweensOf(pivot.rotation);
        if (e.auto) { e.auto.kill(); e.auto = null; }
        jeter(e.modele);
        e.modele = construire(eid, sid, sku);
        pivot.add(e.modele);
        pivot.rotation.y = -.55;
        e.actif = true;
        if (GS && !REDUIT) {
          GS.fromTo(e.modele.scale, { x: .82, y: .82, z: .82 }, { x: 1, y: 1, z: 1, duration: 1.1, ease: 'expo.out' });
          GS.fromTo(pivot.rotation, { y: -1.2 }, { y: -.35, duration: 1.6, ease: 'expo.out', onComplete: tourner });
        } else tourner();
      },
      changer(eid, sid, sku) {
        if (!e.actif) return;
        const ancien = e.modele;
        const suite = () => {
          jeter(ancien);
          e.modele = construire(eid, sid, sku);
          pivot.add(e.modele);
          if (GS && !REDUIT) GS.fromTo(e.modele.scale, { x: .7, y: .7, z: .7 }, { x: 1, y: 1, z: 1, duration: .9, ease: 'expo.out' });
        };
        if (ancien && GS && !REDUIT) GS.to(ancien.scale, { x: .6, y: .6, z: .6, duration: .28, ease: 'power2.in', onComplete: suite });
        else suite();
      },
      fermer() {
        e.actif = false;
        if (GS) GS.killTweensOf(pivot.rotation);
        if (e.auto) { e.auto.kill(); e.auto = null; }
        jeter(e.modele); e.modele = null;
      },
      glisser(dx) {
        pivot.rotation.y += dx * .012;
        if (e.auto) { e.auto.pause(); clearTimeout(e.pause); e.pause = setTimeout(() => { if (e.auto) e.auto.resume(); }, 2200); }
      },
      zoom(f) { e.zoom = clamp(e.zoom * f, .4, 2.6); cadrer(); },
      zone(fx, fy) { e.zone.fx = fx; e.zone.fy = fy; if (e.actif) { e.dist = distance(); cadrer(); } },
      redimensionner() { cam2.aspect = innerWidth / innerHeight; cam2.updateProjectionMatrix(); decApplique.delete(cam2); if (e.actif) { e.dist = distance(); cadrer(); } }
    };
  })();

  /* ---------------------------------------------------------------
     Capture d'une vue de la maquette (image JPEG), pour le rendu réaliste :
     la vue « intérieur » de l'espace, sans les panneaux ni les points
     --------------------------------------------------------------- */
  function capture(eid, o = {}) {
    const E = ESP[eid];
    if (!E) return null;
    const w = o.largeur || 1536, h = o.hauteur || 1024;
    const p = o.pose || pose(eid, o.vue || 'oeil');
    const cam = new THREE.PerspectiveCamera(p.fov, w / h, .05, 260);
    cam.position.set(p.px, p.py, p.pz);
    cam.lookAt(p.tx, p.ty, p.tz);
    cam.updateMatrixWorld();
    const avant = { dpr: renderer.getPixelRatio(), taille: renderer.getSize(new THREE.Vector2()), focus: focusId };
    // murs et pièces vus depuis la caméra de capture, ombres de l'espace
    majMurs(1, cam);
    setFocus(eid);
    renderer.shadowMap.needsUpdate = true;
    const ambAvant = amb.v;
    if (o.ambiance != null) appliquerAmbiance(o.ambiance);
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    renderer.render(scene, cam);
    // lu dans la même tâche que le rendu : le tampon est encore là
    const url = canvas.toDataURL('image/jpeg', o.qualite || .88);
    renderer.setPixelRatio(avant.dpr);
    renderer.setSize(avant.taille.x, avant.taille.y, false);
    if (o.ambiance != null) appliquerAmbiance(ambAvant);
    setFocus(avant.focus);
    majMurs(1);
    renderer.shadowMap.needsUpdate = true;
    decApplique.clear();
    if (actif) boucle(); else renderer.render(scene, camera);
    return url;
  }

  /* ---------------------------------------------------------------
     Pointeur : glisser pour tourner, cliquer sur un meuble
     --------------------------------------------------------------- */
  let glisse = null;
  canvas.addEventListener('pointerdown', e => {
    if (!actif || (!orb.actif && !studio.actif)) return;
    glisse = { x: e.clientX, y: e.clientY, bouge: 0 };
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* rien */ }
    canvas.classList.add('is-glisse');
  });
  canvas.addEventListener('pointermove', e => {
    if (!glisse) { survol(e); return; }
    const dx = e.clientX - glisse.x, dy = e.clientY - glisse.y;
    glisse.x = e.clientX; glisse.y = e.clientY; glisse.bouge += Math.abs(dx) + Math.abs(dy);
    if (studio.actif) { studio.glisser(dx); return; }
    orb.cy = clamp(orb.cy + dx * .006, -orb.max, orb.max);
    if (e.pointerType !== 'touch') orb.cp = clamp(orb.cp - dy * .004, -orb.maxP, orb.maxP);
  });
  canvas.addEventListener('pointerup', e => {
    if (!glisse) return;
    const clic = glisse.bouge < 6;
    glisse = null;
    canvas.classList.remove('is-glisse');
    if (clic && !studio.actif) cliquer(e);
  });
  canvas.addEventListener('pointercancel', () => { glisse = null; canvas.classList.remove('is-glisse'); });
  canvas.addEventListener('wheel', e => { if (studio.actif) { e.preventDefault(); e.stopPropagation(); studio.zoom(e.deltaY > 0 ? 1.08 : .92); } }, { passive: false });
  function viser(e) {
    const E = ESP[espaceCourant];
    if (!E || !avecPoints) return null;
    const v = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(v, camera); ray.far = 80;
    const h = ray.intersectObject(E.g, true).find(x => x.object.visible && !x.object.isSprite && !(x.object.material && x.object.material.depthWrite === false));
    return h && h.object.userData.emplacement ? h.object.userData.emplacement : null;
  }
  function cliquer(e) {
    const sid = viser(e);
    if (sid) evt('visite3d:point', { espace: espaceCourant, slot: sid, x: e.clientX, y: e.clientY });
  }
  function survol(e) {
    if (!actif || studio.actif || (frame & 3) !== 0) return;
    canvas.style.cursor = viser(e) ? 'pointer' : '';
  }

  /* ---------------------------------------------------------------
     Boucle de rendu (sur le ticker de GSAP, seulement quand la 3D est visible)
     --------------------------------------------------------------- */
  let actif = false, dernier = performance.now(), temps = 0;
  const perf = { n: 0, somme: 0 };
  function adapter(dt) {
    perf.n++; perf.somme += dt;
    if (perf.n < 90) return;
    const moy = perf.somme / perf.n;
    perf.n = 0; perf.somme = 0;
    const max = Math.min(window.devicePixelRatio || 1, QUAL.dpr);
    let nd = dpr;
    if (moy > .03 && dpr > QUAL.dprMin) nd = Math.max(QUAL.dprMin, dpr - .2);
    else if (moy < .014 && dpr < max) nd = Math.min(max, dpr + .2);
    if (nd !== dpr) { dpr = nd; renderer.setPixelRatio(dpr); redimensionner(); }
  }
  function boucle() {
    const t = performance.now(), dt = Math.min(.05, (t - dernier) / 1000);
    dernier = t; temps += dt;
    ANIMS.forEach(f => f(temps, dt));
    if (studio.actif) {
      majDecalage(dt, studio.cam);
      renderer.render(studio.scene, studio.cam);
    } else {
      appliquerCamera(dt);
      majDecalage(dt, camera);
      setFocus(espaceCourant);
      majMurs(dt);
      majPoints();
      renderer.render(scene, camera);
    }
    adapter(dt);
  }
  function setActif(v) {
    if (v === actif) return;
    actif = v;
    dernier = performance.now();
    if (GS) { if (v) GS.ticker.add(boucle); else GS.ticker.remove(boucle); }
    else renderer.setAnimationLoop(v ? boucle : null);
    if (couche) couche.classList.toggle('is-actif', v);
  }
  if (QUAL.debug) window.__mc3d = {
    renderer, actif: () => actif,
    pause() { if (GS) GS.ticker.remove(boucle); else renderer.setAnimationLoop(null); },
    reprise() { if (actif) { if (GS) GS.ticker.add(boucle); else renderer.setAnimationLoop(boucle); } },
    // essais : une planche de pièces du catalogue, rendue dans la scène du studio
    galerie(skus, colonnes = 6, pas = 2.6) {
      const sc = studio.scene, planche = new THREE.Group(); planche.name = 'galerie';
      const ancienne = sc.getObjectByName('galerie'); if (ancienne) sc.remove(ancienne);
      sc.children.forEach(o => { if (o.isGroup && o.name !== 'galerie') o.visible = false; });
      skus.forEach((sku, i) => {
        R = alea(sku.length * 31 + 5);
        const p = DATA.PRODUITS[sku] || {};
        const m = construireProduit(sku, { h: .5, hMax: 1.6 });
        const b = boiteUtile(m), c = b.getCenter(V3());
        const x = (i % colonnes) * pas, z = Math.floor(i / colonnes) * pas;
        m.position.set(x - c.x, estSuspendu(p) ? 2.2 : -b.min.y, z - c.z);
        planche.add(m);
      });
      sc.add(planche);
      const lignes = Math.ceil(skus.length / colonnes), cx = (colonnes - 1) * pas / 2, cz = (lignes - 1) * pas / 2;
      const cam2 = studio.cam, d = Math.max(colonnes, lignes * 1.5) * pas * 1.05;
      cam2.aspect = innerWidth / innerHeight; cam2.fov = 30; cam2.near = .1; cam2.far = d * 4; cam2.updateProjectionMatrix();
      cam2.clearViewOffset();
      cam2.position.set(cx, d * .55, cz + d * .95); cam2.lookAt(cx, .4, cz);
      renderer.render(sc, cam2);
      return skus.length;
    }
  };
  function redimensionner() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
    studio.redimensionner();
    decApplique.clear();
    renderer.shadowMap.needsUpdate = true;
  }
  let rz = 0;
  addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(redimensionner, 120); });

  /* ---------------------------------------------------------------
     Construction progressive (le préchargement affiche l'avancement)
     --------------------------------------------------------------- */
  evt('visite3d:progres', { p: .05 });
  await ceder();
  parcours();
  const ids = DATA.ESPACES.map(e => e.id);
  // construction par petites étapes : une pièce, puis ses produits deux par deux
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    R = alea(i * 101 + 3);
    const E = CONSTRUCTEURS[id]();
    E.def = DEF[id];
    cuire(E.g);
    E.prod = {};
    scene.add(E.g);
    ESP[id] = E;
    chrono(id + ' : pièce');
    await ceder();
    const empl = E.def.emplacements;
    for (let j = 0; j < empl.length; j++) {
      construireEmplacement(E, empl[j].id);
      if (j % 2 === 1 && j < empl.length - 1) await ceder();
    }
    chrono(id + ' : produits');
    evt('visite3d:progres', { p: .06 + .5 * (i + 1) / ids.length });
    await ceder();
  }
  creerPoints();
  appliquerAmbiance(0);

  // compilation des shaders espace par espace, dans une petite image hors écran :
  // sans l'extension de compilation parallèle, un seul premier rendu figerait la page
  const mini = new THREE.WebGLRenderTarget(64, 64);
  const camChauffe = new THREE.PerspectiveCamera(40, 1, .5, 260);
  const parallele = !!renderer.extensions.get('KHR_parallel_shader_compile');
  const chauffer = async (sc, cm) => {
    try {
      if (parallele && renderer.compileAsync) await Promise.race([renderer.compileAsync(sc, cm), new Promise(r => setTimeout(r, 4000))]);
      renderer.setRenderTarget(mini);
      renderer.render(sc, cm);
    } catch (_) { /* la compilation se fera au premier affichage */ }
    renderer.setRenderTarget(null);
  };
  for (let i = 0; i < ids.length; i++) {
    for (const id in ESP) ESP[id].g.visible = id === ids[i];
    const p = pose(ids[i], 'maquette');
    camChauffe.position.set(p.px, p.py, p.pz);
    camChauffe.lookAt(p.tx, p.ty, p.tz);
    camChauffe.updateMatrixWorld();
    setFocus(ids[i]);
    renderer.shadowMap.needsUpdate = true;
    await chauffer(scene, camChauffe);
    chrono('compilation ' + ids[i]);
    evt('visite3d:progres', { p: .56 + .32 * (i + 1) / ids.length });
    await ceder();
  }
  for (const id in ESP) ESP[id].g.visible = true;
  studio.ouvrir('deluxe', 'lit', choixDe('deluxe', 'lit'));
  await chauffer(studio.scene, studio.cam);
  studio.fermer();
  chrono('compilation studio');
  mini.dispose();
  evt('visite3d:progres', { p: .94 });
  await ceder();
  setFocus(null);
  placer(pose('deluxe', 'oeil'), true);
  appliquerCamera(0);
  renderer.shadowMap.needsUpdate = true;
  renderer.render(scene, camera);
  chrono('premier rendu');
  if (QUAL.debug) window.__chrono = CHRONO;
  DATA.ESPACES.forEach(e => { if (e.monde) chargerMonde(ESP[e.id]); });

  window.VISITE3D = {
    ok: true,
    mobile: MOBILE,
    pose, poseEcran, placer, allerA, poseProduit,
    enMouvement: () => !!tweenCam,
    setEspace(eid, o = {}) { espaceCourant = eid; avecPoints = !!o.points; avecEtiquettes = !!o.etiquettes; },
    setOrbite(v, lim) { orb.actif = v; if (lim) { orb.max = lim.yaw; orb.maxP = lim.pitch; } if (!v) resetOrbite(.6); },
    resetOrbite,
    setActif,
    estActif: () => actif,
    setAmbiance,
    getAmbiance: () => ambCible,
    setDecalage(x, y, instant) { dec.cx = x || 0; dec.cy = y || 0; if (instant || REDUIT) { dec.x = dec.cx; dec.y = dec.cy; } },
    setChoix(eid, sid, sku) {
      ETAT.choix[eid] = ETAT.choix[eid] || {};
      ETAT.choix[eid][sid] = sku;
      construireEmplacement(ESP[eid], sid);
      majLibelles();
    },
    setRetenu(eid, sid, on) {
      ETAT.retenu[eid] = ETAT.retenu[eid] || {};
      ETAT.retenu[eid][sid] = on;
      appliquerRetenu(ESP[eid], sid);
      majLibelles();
    },
    majLibelles,
    studio: {
      ouvrir: (eid, sid, sku) => studio.ouvrir(eid, sid, sku),
      changer: (eid, sid, sku) => studio.changer(eid, sid, sku),
      fermer: () => studio.fermer(),
      zone: (fx, fy) => studio.zone(fx, fy),
      actif: () => studio.actif
    },
    rendreUneFois() { appliquerCamera(1); majMurs(1); renderer.render(scene, camera); },
    capture
  };
  evt('visite3d:progres', { p: 1 });
  evt('visite3d:pret', {});
}

window.VISITE3D_CHARGEMENT = lancer3D().catch(err => echec3D(err));
