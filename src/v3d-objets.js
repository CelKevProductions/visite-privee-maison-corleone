/* =================================================================
   Visite 3D — objets : un modèle générique par produit du catalogue
   Origine au sol, centrée, face avant vers +z.
   Objets muraux : origine sur le mur. Suspensions : origine au plafond.
   ================================================================= */

const ANIMS = [];   // fonctions (t, dt) appelées à chaque image (eau, flammes...)

/* ---------- petits utilitaires de forme ---------- */
// Arc de tore horizontal centré vers l'arrière (-z) : dossiers enveloppants
function arcDos(parent, Rr, r, arc, m, y, z = 0, x = 0) {
  const g = new THREE.Group();
  const t = mesh(new THREE.TorusGeometry(Rr, r, 12, 40, arc), m);
  t.rotation.z = Math.PI / 2 - arc / 2;
  g.add(t);
  g.rotation.x = -Math.PI / 2;
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}
// Forme plane extrudée vers le haut (plan x-z) : assises courbes
function plat(parent, shape, h, m, y = 0, biseau = .03) {
  const me = extrude(parent, shape, h, m, biseau);
  me.rotation.x = -Math.PI / 2;
  me.position.y = y + biseau;
  return me;
}
// Coquille ouverte à l'avant (tour partiel) : fauteuils enveloppants
function coque(parent, profil, m, ouverture = .5, seg = 36) {
  const phiL = TAU * (1 - ouverture / 2);
  const g = new THREE.LatheGeometry(profil.map(p => new THREE.Vector2(p[0], p[1])), seg, Math.PI * ouverture / 2 + 0.0001, phiL);
  const mm = m.clone(); mm.side = THREE.DoubleSide;
  const me = mesh(g, mm);
  parent.add(me);
  return me;
}
function capsule(parent, r, long, m, x, y, z, rx = 0, ry = 0, rz = 0) {
  return place(parent, mesh(new THREE.CapsuleGeometry(r, long, 6, 14), m), x, y, z, ry, rx, rz);
}
function pied(parent, r, h, m, x, z, y = 0) { return cyl(parent, r, r, h, m, x, y, z, 10); }
function tissu(look, mat) {
  const c = look.tete || look.couleur;
  return M((mat || 'velours') + ':' + c);
}

/* =================================================================
   LITS
   ================================================================= */
function literie(g, W, L, yMat, accent) {
  const zt = -L / 2;
  bloc(g, W - .04, .22, L - .1, M('drap'), 0, yMat, .02, .06);
  const yh = yMat + .22;
  // couette et retombées
  const lc = L * .66;
  bloc(g, W + .06, .07, lc, M('tissu:#EFEBE3'), 0, yh - .01, L / 2 - lc / 2 - .02, .03);
  bloc(g, .025, .3, lc, M('tissu:#EDE9E1'), -(W / 2 + .04), yh - .28, L / 2 - lc / 2 - .02, .01);
  bloc(g, .025, .3, lc, M('tissu:#EDE9E1'), W / 2 + .04, yh - .28, L / 2 - lc / 2 - .02, .01);
  bloc(g, W + .08, .3, .025, M('tissu:#EDE9E1'), 0, yh - .28, L / 2 - .03, .01);
  // plaid au pied du lit
  if (accent) bloc(g, W + .1, .075, .42, M('tissu:' + accent), 0, yh + .02, L / 2 - .38, .03);
  // oreillers
  const n = W > 1.9 ? 3 : 2, ow = (W - .16) / n;
  for (let i = 0; i < n; i++) {
    const o = bloc(g, ow - .04, .16, .4, M('drap'), -W / 2 + .08 + ow * (i + .5), yh, zt + .34, .07);
    o.rotation.x = -.35;
  }
  // coussins déco
  if (accent) {
    [-.28, .28].forEach(x => { const c = bloc(g, .46, .44, .13, M('velours:' + accent), x * (W / 1.8), yh + .02, zt + .6, .06); c.rotation.x = -.42; });
    const c = bloc(g, .4, .28, .1, M('velours:#D9CCB6'), 0, yh + .02, zt + .74, .05); c.rotation.x = -.35;
  }
  return yh;
}
function lit(look, o = {}) {
  const g = groupe('lit');
  const W = o.W || 1.8, L = o.L || 2.1, zt = -L / 2;
  const accent = o.accent === undefined ? '#B4532F' : o.accent;
  const s = look.style;
  let yb = .12, hb = .3;
  const mBase = M((s === 'vague' || s === 'panneaux' || s === 'signature' ? 'cuir' : s === 'tubes' ? 'boucle' : s === 'executive' ? 'tissu' : 'velours') + ':' + (look.base || look.tete));
  const mTete = M((s === 'vague' || s === 'panneaux' || s === 'signature' ? 'cuir' : s === 'tubes' ? 'boucle' : s === 'executive' ? 'tissu' : 'velours') + ':' + look.tete);

  if (s === 'vague') {
    // tête de lit ondulée + chevets intégrés + croix en laiton
    const Wt = W + 1.2, H = 1.12, sh = new THREE.Shape();
    sh.moveTo(-Wt / 2, 0); sh.lineTo(Wt / 2, 0); sh.lineTo(Wt / 2, H * .72);
    for (let i = 0; i <= 48; i++) { const u = i / 48, x = Wt / 2 - u * Wt; sh.lineTo(x, H * (.78 + .16 * Math.sin(u * Math.PI)) + .045 * Math.sin(u * TAU * 3)); }
    sh.lineTo(-Wt / 2, 0);
    const t = extrude(g, sh, .1, mTete, .02); t.position.z = zt - .12;
    const lignes = []; for (let x = -Wt / 2 + .1; x < Wt / 2 - .05; x += .12) lignes.push([x, .5, zt + .005, 0, 0, 0, 1, 1, 1, 1]);
    instances(g, new THREE.BoxGeometry(.007, .9, .01), M('laque:#7A391F'), lignes);
    [-1, 1].forEach(k => {
      bloc(g, .52, .4, .42, M('laque:' + (look.chevets || '#D9CCB6')), k * (W / 2 + .33), .2, zt + .21, .03);
      bloc(g, .46, .006, .01, M('laiton'), k * (W / 2 + .33), .42, zt + .425);
    });
    bloc(g, 1.3, .05, .09, M('laiton'), 0, .02, 0, .01);
    bloc(g, .09, .05, 1.5, M('laiton'), 0, .02, 0, .01);
    yb = .1;
  } else if (s === 'panneaux') {
    [-1, 1].forEach(k => bloc(g, W / 2 - .02, 1.02, .11, mTete, k * (W / 4 + .005), .08, zt - .05, .05));
    for (let x = -W / 2 + .12; x < W / 2; x += .15) bloc(g, .006, .86, .012, M('laque:#5E5046'), x, .16, zt + .012);
    yb = .12;
  } else if (s === 'ailes') {
    const fl = []; for (let x = -W / 2 - .02; x <= W / 2 + .02; x += .075) fl.push([x, .72, zt - .02, 0, 0, 0, 1]);
    instances(g, new THREE.CapsuleGeometry(.037, 1.1, 4, 10), mTete, fl, true);
    bloc(g, W + .14, 1.26, .08, mTete, 0, .06, zt - .08, .03);
    [-1, 1].forEach(k => {
      const a = bloc(g, .14, 1.16, .52, mTete, k * (W / 2 + .1), .06, zt + .18, .06); a.rotation.y = k * .22;
      const bras = tube(g, [[k * (W / 2 + .12), 1.1, zt + .3], [k * (W / 2 + .05), 1.18, zt + .42], [k * (W / 2 - .06), 1.12, zt + .5]], .008, M('or'), false, 12, 6);
      cyl(g, .025, .05, .07, M('or'), k * (W / 2 - .07), 1.06, zt + .5);
      sphere(g, .02, M('opale'), k * (W / 2 - .07), 1.06, zt + .5);
    });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => pied(g, .025, .1, M('or'), a * (W / 2 - .08), b * (L / 2 - .1)));
    yb = .1;
  } else if (s === 'duo') {
    bloc(g, W + .16, 1.06, .12, mBase, 0, .06, zt - .06, .06);
    bloc(g, W - .32, .8, .08, M('velours:' + look.tete), 0, .22, zt + .03, .04);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => pied(g, .012, .2, M('noir'), a * (W / 2 - .06), b * (L / 2 - .06)));
    yb = .2;
  } else if (s === 'galbe') {
    const Rr = W * .95, a = Math.asin((W / 2 + .12) / Rr), cz = zt + Rr - .02;
    const arc = couronne(g, Rr, Rr + .14, Math.PI / 2 - a, Math.PI / 2 + a, 1.05, mTete, .06);
    arc.position.z = cz;
    for (let i = -6; i <= 6; i++) { const aa = Math.PI / 2 + i / 6 * a * .92; bloc(g, .006, .9, .01, M('laque:#9C8A6E'), Math.cos(aa) * (Rr - .01), .12, cz - Math.sin(aa) * (Rr - .01), 0, aa - Math.PI / 2); }
    const pdl = place(g, mesh(new THREE.CylinderGeometry(.17, .17, W + .08, 32), mBase), 0, .3, L / 2 - .12, 0, 0, Math.PI / 2);
    for (let x = -W / 2; x <= W / 2; x += .12) tore(g, .172, .012, mBase, x, .3, L / 2 - .12, 0, TAU, 24).rotation.y = Math.PI / 2;
    yb = .1;
  } else if (s === 'tubes') {
    const n = Math.round((W + .3) / .19);
    for (let i = 0; i < n; i++) capsule(g, .09, .72, mTete, -((n - 1) * .19) / 2 + i * .19, .66, zt - .02);
    capsule(g, .12, L - .1, mBase, -(W / 2 + .1), .34, 0, Math.PI / 2);
    capsule(g, .12, L - .1, mBase, W / 2 + .1, .34, 0, Math.PI / 2);
    capsule(g, .12, W, mBase, 0, .34, L / 2 + .05, 0, 0, Math.PI / 2);
    yb = .08;
  } else if (s === 'signature' || s === 'executive') {
    const sig = s === 'signature', Wt = W + (sig ? 1.7 : 1.4), H = sig ? 1.45 : 1.25;
    bloc(g, Wt, H, .1, mTete, 0, .04, zt - .06, .04);
    const q = [], pas = sig ? .21 : .24;
    for (let x = -Wt / 2 + pas / 2; x < Wt / 2; x += pas) for (let y = .16; y < H - .05; y += pas) q.push([x, y, zt + .005, 0, 0, 0, 1]);
    instances(g, new RoundedBoxGeometry(pas - .02, pas - .02, .045, 2, .02), mTete, q);
    [-1, 1].forEach(k => {
      const x = k * (W / 2 + .38);
      if (sig) {
        bloc(g, .56, .06, .38, M('noyer'), x, .52, zt + .19, .01);
        bloc(g, .5, .012, .34, M('verre'), x, .3, zt + .17);
        tube(g, [[x + k * .2, .75, zt + .02], [x + k * .2, .95, zt + .1], [x + k * .12, 1.02, zt + .18]], .008, M('chrome'), false, 10, 6);
        cyl(g, .085, .12, .15, M('opale:#FFE9C8'), x + k * .1, .92, zt + .2, 20, true).material.side = THREE.DoubleSide;
      } else {
        bloc(g, .5, .16, .38, M('noyer'), x, .38, zt + .19, .01);
        bloc(g, .5, .02, .38, M('marbreBlanc'), x, .54, zt + .19, .005);
        tube(g, [[x - k * .15, .56, zt + .05], [x - k * .15, .82, zt + .08], [x - k * .05, .9, zt + .16]], .007, M('chrome'), false, 10, 6);
        sphere(g, .025, M('opale'), x - k * .04, .88, zt + .17);
      }
    });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => pied(g, .014, .12, M('chrome'), a * (W / 2 - .08), b * (L / 2 - .08)));
    yb = .12;
  } else if (s === 'chesterfield') {
    bloc(g, W + .22, 1.4, .16, mTete, 0, .06, zt - .08, .07);
    const bt = [];
    for (let r0 = 0; r0 < 6; r0++) for (let x = -W / 2 + (r0 % 2 ? .12 : .02); x < W / 2 + .05; x += .2) bt.push([x, .45 + r0 * .15, zt + .005, 0, 0, 0, 1]);
    instances(g, new THREE.SphereGeometry(.018, 8, 6), M('velours:#5A3216'), bt);
    [-1, 1].forEach(k => { const a = bloc(g, .2, 1.26, .5, mTete, k * (W / 2 + .14), .06, zt + .16, .08); a.rotation.y = k * .35; });
    yb = .12;
  }

  // sommier
  if (s !== 'tubes') bloc(g, W + .08, hb, L, mBase, 0, yb, 0, .06);
  else bloc(g, W, .26, L - .06, M('chene'), 0, yb, 0, .02);
  const yMat = yb + (s === 'tubes' ? .26 : hb);
  literie(g, W, L, yMat, accent);

  // LED sous le sommier (effet flottant)
  if (look.led) {
    const led = bloc(g, W - .1, .012, L - .12, M('led'), 0, yb - .02, 0);
    led.castShadow = false;
    const hl = new THREE.Mesh(new THREE.PlaneGeometry(W + .9, L + .9), M('halo'));
    hl.rotation.x = -Math.PI / 2; hl.position.y = .006; hl.userData.nonCuit = true; g.add(hl);
  }
  ombreSol(g, W + .7, L + .5, 0, 0);
  return g;
}

/* =================================================================
   LUMINAIRES SUSPENDUS (origine au plafond)
   ================================================================= */
function cable(g, long, m = M('noir'), x = 0, z = 0, y0 = 0) {
  return cyl(g, .004, .004, long, m, x, y0 - long, z, 6);
}
function rosace(g, r = .06, m = M('blanc')) { return cyl(g, r, r, .025, m, 0, -.025, 0, 20); }

function suspension(look, o = {}) {
  const g = groupe('suspension');
  const d = o.h || .9;           // hauteur de descente
  const s = look.style;
  if (s === 'albatre') {
    rosace(g, .045, M('noir')); cable(g, d, M('noir'));
    for (let i = 0; i < 3; i++) sphere(g, .085, M('opale:#FFD8A8'), 0, -d - .02 - i * .105, 0, 1, .55, 1, 24);
    halo(g, .9, 0, -d - .12, 0);
  } else if (s === 'cylindre') {
    rosace(g, .05, M('noir')); cable(g, d, M('noir'));
    cyl(g, .14, .14, .38, M('soie:' + (look.couleur || '#B7603B')), 0, -d - .38, 0, 32, true).material.side = THREE.DoubleSide;
    tore(g, .142, .008, M('noir'), 0, -d, 0); tore(g, .142, .008, M('noir'), 0, -d - .38, 0);
    sphere(g, .05, M('opale:#FFB070'), 0, -d - .32, 0);
    halo(g, 1.1, 0, -d - .2, 0);
  } else if (s === 'tripode') {
    rosace(g, .05, M('noir')); cable(g, d - .2, M('noir'));
    [[.0, -.05], [2.1, -.18], [4.2, -.3]].forEach(([a, dy], i) => {
      const x = Math.cos(a) * .22, z = Math.sin(a) * .22;
      tube(g, [[0, -d + .2, 0], [x * .6, -d + .05, z * .6], [x, -d + dy, z]], .006, M('noir'), false, 8, 5);
      cyl(g, .17, .17, .012, M('opale'), x, -d + dy - .06, z, 32);
      tore(g, .06, .006, M('laiton'), x, -d + dy - .05, z);
    });
    halo(g, 1.2, 0, -d - .1, 0);
  } else if (s === 'arche') {
    [-.35, .35].forEach((x, i) => cable(g, d - (i ? .1 : 0), M('noir'), x, 0));
    const a = place(g, mesh(new THREE.CylinderGeometry(.19, .19, 1.3, 32, 1, true, 0, Math.PI), M('fibres')), 0, -d - .05, 0, 0, 0, Math.PI / 2);
    a.rotation.set(0, 0, Math.PI / 2); a.material.side = THREE.DoubleSide;
    const pl = []; for (let x = -.62; x <= .62; x += .05) pl.push([x, -d - .05, 0, 0, 0, 0, 1]);
    instances(g, new THREE.TorusGeometry(.19, .006, 4, 16, Math.PI), M('fibres'), pl.map(p => [p[0], p[1], p[2], 0, Math.PI / 2, 0, 1]));
    bloc(g, 1.26, .03, .06, M('noir'), 0, -d - .08, 0, .01);
    halo(g, 1.6, 0, -d - .2, 0);
  } else if (s === 'grappe') {
    rosace(g, .05, M('laiton')); cable(g, d - .25, M('laiton'));
    const c = cyl(g, .06, .24, .24, M('laiton'), 0, -d - .24, 0, 32, true); c.material = M('laiton').clone(); c.material.side = THREE.DoubleSide;
    const r = alea(42);
    for (let i = 0; i < 14; i++) { const a = r() * TAU, rr = r() * .17; sphere(g, .045 + r() * .025, M('opale'), Math.cos(a) * rr, -d - .06 - r() * .38, Math.sin(a) * rr, 1, 1, 1, 14); }
    halo(g, 1.2, 0, -d - .25, 0);
  } else if (s === 'noeud') {
    rosace(g, .04, M('laiton')); cable(g, d - .1, M('laiton'));
    const pts = []; for (let i = 0; i < 80; i++) { const u = i / 80 * TAU; pts.push([Math.cos(2 * u) * (.3 + .1 * Math.cos(3 * u)) * 1.3, -d - .1 + .08 * Math.sin(3 * u), Math.sin(2 * u) * (.3 + .1 * Math.cos(3 * u)) * .7]); }
    tube(g, pts, .012, M('laiton'), true, 160, 6);
    [[-.4, 0], [0, .1], [.4, 0]].forEach(([x, z]) => sphere(g, .07, M('opale'), x, -d - .14, z));
    halo(g, 1.3, 0, -d - .15, 0);
  } else if (s === 'galaxie') {
    rosace(g, .06, M('chrome')); cable(g, d - .3, M('chrome'));
    const ico = new THREE.IcosahedronGeometry(.3, 1), p = ico.attributes.position, vus = new Set(), l = [];
    for (let i = 0; i < p.count; i++) { const k = p.getX(i).toFixed(3) + p.getY(i).toFixed(3) + p.getZ(i).toFixed(3); if (vus.has(k)) continue; vus.add(k); l.push([p.getX(i), -d - .3 + p.getY(i), p.getZ(i), 0, 0, 0, 1]); }
    instances(g, new THREE.SphereGeometry(.055, 14, 10), M('verre'), l);
    instances(g, new THREE.SphereGeometry(.014, 6, 5), M('opale:#FFB566'), l.map(t => [t[0] * .92, t[1], t[2] * .92, 0, 0, 0, 1]));
    sphere(g, .1, M('chrome'), 0, -d - .3, 0);
    halo(g, 1.4, 0, -d - .3, 0);
  } else if (s === 'lineaire') {
    [-.4, .4].forEach(x => cable(g, d - .15, M('chrome'), x, 0));
    bloc(g, .95, .02, .03, M('chrome'), 0, -d + .13, 0);
    const r = alea(9), l1 = [], l2 = [];
    for (let i = 0; i < 28; i++) { const t = [(r() - .5) * .9, -d + .05 - r() * .3, (r() - .5) * .12, 0, 0, 0, .7 + r() * .6]; (i % 2 ? l1 : l2).push(t); }
    instances(g, new THREE.SphereGeometry(.05, 12, 8), M('fume'), l1);
    instances(g, new THREE.SphereGeometry(.05, 12, 8), M('verre'), l2);
    instances(g, new THREE.SphereGeometry(.012, 6, 4), M('opale:#FFB566'), l1.concat(l2).map(t => [t[0], t[1], t[2], 0, 0, 0, 1]));
    halo(g, 1.4, 0, -d - .05, 0);
  } else {
    return lustre(look, o);
  }
  return g;
}

/* ---------- lustres ---------- */
function lustre(look, o = {}) {
  const g = groupe('lustre');
  const d = o.h || .6, s = look.style, r = alea(s.length * 7);
  if (s === 'spirale') {
    rosace(g, .12, M('chrome'));
    const cr = [];
    for (let i = 0; i < 7; i++) {
      const Rr = .78 - i * .075, y = -d - i * .19, cx = .1 * Math.cos(i * .9), cz = .1 * Math.sin(i * .9);
      tore(g, Rr, .012, M('chrome'), cx, y, cz);
      tore(g, Rr, .006, M('led:#FFE1B0'), cx, y + .012, cz);
      const n = Math.round(TAU * Rr / .045);
      for (let k = 0; k < n; k++) { const a = k / n * TAU; cr.push([cx + Math.cos(a) * Rr, y - .085, cz + Math.sin(a) * Rr, 0, 0, 0, 1, 1, .9 + r() * .3, 1]); }
      if (i === 0) [0, 2.1, 4.2].forEach(a => cable(g, d, M('chrome'), Math.cos(a) * Rr * .98, Math.sin(a) * Rr * .98));
    }
    instances(g, new THREE.CylinderGeometry(.011, .011, .16, 6), M('cristal'), cr);
    halo(g, 3, 0, -d - .6, 0);
  } else if (s === 'floral') {
    const rs = cyl(g, .45, .45, .04, M('blanc'), 0, -.04, 0, 40);
    for (let i = 0; i < 26; i++) {
      const a = r() * TAU, rr = .15 + r() * .32, y = -d + r() * .14, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      cyl(g, .004, .004, -y - .04, M('or'), x, y, z, 5);
      for (let p = 0; p < 5; p++) { const b = p / 5 * TAU; sphere(g, .04, M('opale'), x + Math.cos(b) * .035, y, z + Math.sin(b) * .035, 1, .35, 1, 10); }
    }
    const pm = []; for (let i = 0; i < 90; i++) { const a = r() * TAU, rr = r() * .42; pm.push([Math.cos(a) * rr, -d - .15 - r() * .75, Math.sin(a) * rr, 0, r() * 3, 0, 1, 1, .8 + r() * .8, 1]); }
    instances(g, new THREE.BoxGeometry(.015, .1, .015), M('cristal'), pm);
    halo(g, 2.4, 0, -d - .3, 0);
  } else if (s === 'anneaux') {
    rosace(g, .1, M('or'));
    const cr = [];
    [.62, .5, .38, .26].forEach((Rr, i) => {
      const y = -d - i * .17;
      tore(g, Rr, .014, M('or'), 0, y, 0);
      tore(g, Rr, .006, M('led:#FFD9A0'), 0, y - .01, 0);
      const n = Math.round(TAU * Rr / .035);
      for (let k = 0; k < n; k++) { const a = k / n * TAU; cr.push([Math.cos(a) * Rr, y - .05, Math.sin(a) * Rr, 0, -a, 0, 1]); }
      [0, 2.1, 4.2].forEach(a => cable(g, d + i * .17, M('or'), Math.cos(a) * Rr, Math.sin(a) * Rr));
    });
    instances(g, new THREE.BoxGeometry(.025, .07, .02), M('cristal'), cr);
    halo(g, 2.2, 0, -d - .3, 0);
  } else if (s === 'matrice') {
    const cu = [], ca = [];
    for (let i = 0; i < 9; i++) for (let k = 0; k < 9; k++) {
      const x = -1.3 + i * .325, z = -1.3 + k * .325;
      const ymin = -d - .2 - r() * 2.2;
      ca.push([x, ymin / 2, z, 0, 0, 0, 1, 1, -ymin, 1]);
      const nb = 1 + (r() * 3 | 0);
      for (let c = 0; c < nb; c++) { const t = .1 + r() * .14; cu.push([x, ymin + c * .3, z, 0, r() * 3, 0, 1, t / .2, t / .2, t / .2]); }
    }
    instances(g, new THREE.CylinderGeometry(.002, .002, 1, 4), M('chrome'), ca);
    instances(g, new THREE.BoxGeometry(.2, .2, .2), M('cristal'), cu);
    bloc(g, 2.8, .04, 2.8, M('chrome'), 0, -.04, 0);
    halo(g, 4.5, 0, -d - 1.2, 0);
  } else if (s === 'ondes') {
    for (let i = 0; i < 8; i++) {
      const Rr = 1.5 - i * .13, y = -d - i * .24, pts = [];
      for (let k = 0; k < 90; k++) { const a = k / 90 * TAU; pts.push([Math.cos(a) * Rr, y + .07 * Math.sin(a * 5 + i), Math.sin(a) * Rr]); }
      tube(g, pts, .02, M('led:#FFF0D8'), true, 180, 6);
      tube(g, pts.map(p => [p[0], p[1] + .03, p[2]]), .014, M('chene'), true, 180, 5);
      if (i === 0) [0, 1.6, 3.2, 4.7].forEach(a => cable(g, d, M('chrome'), Math.cos(a) * Rr, Math.sin(a) * Rr));
    }
    halo(g, 5, 0, -d - .9, 0);
  } else if (s === 'infini') {
    [1.25, 1.02, .8, .6, .42].forEach((Rr, i) => {
      const t = tore(g, Rr, .03, M('alu'), 0, -d - i * .32, 0);
      t.rotation.x = Math.PI / 2 + (i % 2 ? .12 : -.1);
      const l = tore(g, Rr, .012, M('led:#F4F7FF'), 0, -d - i * .32 - .03, 0);
      l.rotation.x = t.rotation.x;
      cable(g, d + i * .32, M('chrome'), Rr * .7, 0);
    });
    halo(g, 4.2, 0, -d - .7, 0);
  }
  return g;
}

/* =================================================================
   APPLIQUES (origine sur le mur, face +z)
   ================================================================= */
function applique(look) {
  const g = groupe('applique');
  if (look.style === 'orbe') {
    const p = place(g, mesh(new THREE.CylinderGeometry(.1, .1, .02, 32), M('noyer')), 0, 0, .01, 0, Math.PI / 2);
    p.scale.set(.75, 1, 1.9);
    bloc(g, .05, .03, .1, M('noir'), 0, -.015, .05);
    sphere(g, .075, M('opale'), 0, 0, .12);
    cyl(g, .045, .06, .03, M('noir'), 0, .07, .12, 16); cyl(g, .06, .045, .03, M('noir'), 0, -.1, .12, 16);
    halo(g, .8, 0, 0, .18);
  } else if (look.style === 'capsule') {
    cyl(g, .05, .05, .015, M('laiton'), 0, -.007, .007, 20).rotation.x = Math.PI / 2;
    bloc(g, .02, .02, .08, M('laiton'), 0, -.01, .05);
    cyl(g, .01, .01, .4, M('laiton'), 0, -.2, .1, 8);
    tour(g, [[0, -.19], [.05, -.17], [.075, -.08], [.06, 0], [.08, .08], [.05, .17], [0, .19]], M('ambre'), 0, 0, .1, 28);
    halo(g, .9, 0, 0, .16);
  } else {
    bloc(g, .05, .72, .012, M('laiton'), 0, -.36, .006, .005);
    [-.24, 0, .24].forEach((y, i) => { bloc(g, .03, .02, .08, M('laiton'), 0, y - .01, .045); sphere(g, .11 - i * .01, M('opale:#FFE0B8'), (i - 1) * .015, y, .12, 1.1, .45, .8, 18); });
    halo(g, 1, 0, 0, .18);
  }
  return g;
}

/* =================================================================
   LAMPADAIRE
   ================================================================= */
function lampadaire(look) {
  const g = groupe('lampadaire');
  const r = alea(5);
  tube(g, [[0, .02, 0], [.03, .5, .02], [-.02, 1.0, -.01], [.02, 1.45, .01], [0, 1.6, 0]], .025, M('or'), false, 30, 8);
  [0, 1.6, 3.2, 4.7].forEach(a => tube(g, [[0, .15, 0], [Math.cos(a) * .12, .05, Math.sin(a) * .12], [Math.cos(a) * .22, .015, Math.sin(a) * .22]], .014, M('or'), false, 10, 6));
  const pl = [];
  for (let i = 0; i < 34; i++) { const a = i / 34 * TAU + r() * .2, inc = .5 + r() * .5; pl.push([Math.cos(a) * .22, 1.6 + Math.cos(inc) * .05, Math.sin(a) * .22, 0, -a, inc - .25, 1, 1.4, .12, .55]); }
  instances(g, new THREE.SphereGeometry(.18, 10, 6), M('plumes'), pl);
  sphere(g, .05, M('opale'), 0, 1.58, 0);
  halo(g, 1.6, 0, 1.6, 0);
  ombreSol(g, .8, .8);
  return g;
}

/* =================================================================
   FAUTEUILS ET TABOURETS
   ================================================================= */
function fauteuil(look) {
  const g = groupe('fauteuil');
  const s = look.style, c = look.couleur;
  if (s === 'bourrelets') {
    const m = M('velours:' + c);
    bloc(g, .82, .2, .78, m, 0, 0, 0, .09);
    bloc(g, .62, .16, .56, m, 0, .2, .08, .07);
    [[.36, .4, .1], [.33, .55, .095], [.29, .7, .09]].forEach(([Rr, y, r]) => arcDos(g, Rr, r, Math.PI * 1.25, m, y, -.02));
  } else if (s === 'tub') {
    const m = M('cuir:' + c);
    coque(g, [[.3, 0], [.4, 0], [.43, .3], [.41, .66], [.36, .68], [.33, .4]], m, .55);
    cyl(g, .34, .36, .38, m, 0, 0, .02, 32);
    bloc(g, .55, .12, .5, m, 0, .38, .05, .06);
    bloc(g, .42, .22, .1, m, 0, .5, -.22, .05);
    bloc(g, .012, .3, .2, M('or'), .42, .3, -.1, .004);
  } else if (s === 'terra') {
    const m = M('velours:' + c);
    [-1, 1].forEach(k => bloc(g, .15, .62, .8, m, k * .34, 0, 0, .06));
    bloc(g, .54, .22, .72, m, 0, 0, 0, .04);
    bloc(g, .54, .15, .64, m, 0, .22, .06, .06);
    const d = bloc(g, .54, .46, .15, m, 0, .35, -.3, .06); d.rotation.x = -.12;
  } else if (s === 'cocon') {
    const m = M('pinceau');
    tour(g, [[0, .1], [.4, .1], [.47, .32], [.46, .6], [.41, .72], [.36, .7], [.37, .45], [.3, .32], [0, .32]], m, 0, 0, 0, 40);
    cyl(g, .3, .34, .1, M('noirMat'), 0, 0, 0, 24);
    [-.2, 0, .2].forEach((x, i) => { const cu = bloc(g, .3, .3, .09, M('boucle:#E4DCCD'), x, .38, -.2 + Math.abs(x) * .3, .04); cu.rotation.set(-.3, -x * 1.5, 0); });
  } else if (s === 'luge') {
    const m = M('boucle:' + c), bois = M('noirMat');
    [-1, 1].forEach(k => tube(g, [[k * .34, .02, .38], [k * .34, .02, -.36], [k * .34, .3, -.4], [k * .34, .55, -.28], [k * .34, .52, .1], [k * .34, .46, .34]], .025, bois, false, 40, 8));
    bloc(g, .62, .14, .6, m, 0, .28, .03, .06);
    const d = bloc(g, .62, .44, .14, m, 0, .38, -.3, .06); d.rotation.x = -.2;
  } else if (s === 'bergere') {
    const m = M('velours:' + c);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => pied(g, .012, .16, M('or'), a * .3, b * .28));
    bloc(g, .74, .26, .68, m, 0, .16, 0, .06);
    bloc(g, .74, .78, .18, m, 0, .38, -.3, .09);
    [-1, 1].forEach(k => bloc(g, .13, .26, .62, m, k * .31, .42, .02, .06));
    const bt = []; for (let r0 = 0; r0 < 4; r0++) for (let x = -.24 + (r0 % 2) * .08; x <= .25; x += .16) bt.push([x, .62 + r0 * .13, -.205, 0, 0, 0, 1]);
    instances(g, new THREE.SphereGeometry(.014, 8, 6), M('velours:#172755'), bt);
  } else if (s === 'pivotant') {
    const m = M('cuir:' + c);
    [0, 1, 2, 3].forEach(i => { const b = bloc(g, .6, .03, .05, M('chrome'), 0, 0, 0, .01); b.rotation.y = i * Math.PI / 4 + Math.PI / 8; });
    cyl(g, .04, .05, .3, M('chrome'), 0, .02, 0, 12);
    cyl(g, .34, .34, .16, m, 0, .32, 0, 32);
    coque(g, [[.33, .4], [.4, .42], [.42, .8], [.38, 1.1], [.33, 1.12], [.34, .8]], m, .7);
  } else if (s === 'coquille') {
    const m = M('cuir:' + c);
    coque(g, [[.3, 0], [.4, 0], [.43, .3], [.42, .74], [.36, .76], [.33, .45]], m, .7);
    const fl = []; for (let i = 0; i < 16; i++) { const a = Math.PI * .35 + i / 15 * Math.PI * 1.3; fl.push([Math.sin(a) * .43, .38, Math.cos(a) * .43, 0, a, 0, 1]); }
    instances(g, new THREE.CapsuleGeometry(.035, .62, 4, 8), m, fl);
    bloc(g, .56, .14, .56, m, 0, .28, .05, .06);
    cyl(g, .34, .36, .28, m, 0, 0, 0, 28);
  } else if (s === 'wingback') {
    const m = M('cuir:' + c);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => sphere(g, .03, M('laiton'), a * .3, .03, b * .3));
    bloc(g, .76, .3, .72, m, 0, .06, 0, .05);
    bloc(g, .6, .14, .6, m, 0, .36, .05, .06);
    bloc(g, .76, .82, .17, m, 0, .36, -.3, .07);
    [-1, 1].forEach(k => { capsule(g, .09, .5, m, k * .34, .56, .05, Math.PI / 2); const w = bloc(g, .13, .5, .34, m, k * .34, .66, -.18, .05); w.rotation.y = k * .3; });
    const bt = []; for (let r0 = 0; r0 < 4; r0++) for (let x = -.24 + (r0 % 2) * .08; x <= .25; x += .16) bt.push([x, .6 + r0 * .13, -.21, 0, 0, 0, 1]);
    instances(g, new THREE.SphereGeometry(.013, 8, 6), M('cuir:#5A2E12'), bt);
  }
  ombreSol(g, 1.1, 1.1);
  return g;
}
function tabouret(look) {
  const g = groupe('tabouret');
  if (look.style === 'fleur') {
    const m = M('velours:' + look.couleur);
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; sphere(g, .12, m, Math.cos(a) * .11, .78, Math.sin(a) * .11, 1, .38, 1, 16); }
    sphere(g, .1, m, 0, .79, 0, 1, .4, 1, 16);
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + .78; tube(g, [[Math.cos(a) * .2, 0, Math.sin(a) * .2], [Math.cos(a) * .13, .74, Math.sin(a) * .13]], .011, M('chrome'), false, 4, 6); }
    tore(g, .18, .01, M('chrome'), 0, .3, 0);
  } else {
    const m = M('cuir:#EFE5D3');
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => pied(g, .014, .72, M('noir'), a * .18, b * .17));
    bloc(g, .46, .1, .44, m, 0, .72, 0, .04);
    bloc(g, .46, .42, .07, m, 0, .8, -.2, .03);
    bloc(g, .3, .28, .01, M('cuir:' + look.couleur), 0, .88, -.163, .005);
    bloc(g, .4, .015, .4, M('laiton'), 0, .28, 0, .005);
  }
  ombreSol(g, .6, .6);
  return g;
}

/* =================================================================
   CANAPÉS ET BANC
   ================================================================= */
function canape(look) {
  const g = groupe('canape');
  const s = look.style;
  if (s === 'siena') {
    const m = M('velours:' + look.couleur);
    bloc(g, 2.3, .42, .95, m, -.35, 0, 0, .14);
    bloc(g, .95, .42, 1.35, m, 1.25, 0, .68, .14);
    bloc(g, 2.9, .78, .24, m, 0, 0, -.36, .12);
    bloc(g, .24, .78, 1.9, m, 1.62, 0, .45, .12);
    bloc(g, .24, .6, .95, m, -1.52, 0, 0, .12);
    for (let i = 0; i < 3; i++) bloc(g, .7, .12, .7, m, -1.1 + i * .72, .42, .06, .06);
  } else if (s === 'galets') {
    const m = M('boucle:' + look.couleur), md = M('boucle:' + look.dossier);
    [-.95, 0, .95].forEach((x, i) => {
      const p = tour(g, [[0, 0], [.42, 0], [.5, .08], [.5, .3], [.44, .4], [0, .41]], m, x, 0, .05, 32);
      p.scale.set(1.08, 1, .92);
      sphere(g, .26, md, x, .62, -.34, 1.3, 1, .75, 20);
    });
  } else if (s === 'mineral' || s === 'tablettes') {
    const m = s === 'mineral' ? M('mineral') : M('boucle:' + look.couleur);
    const Rr = 3, a = .44, cz = 2.6;
    const assise = couronne(g, Rr - .95, Rr, Math.PI / 2 - a, Math.PI / 2 + a, .42, m, 0, .05); assise.position.z = cz;
    const dos = couronne(g, Rr - .22, Rr + .02, Math.PI / 2 - a - .03, Math.PI / 2 + a + .03, .8, m, 0, .07); dos.position.z = cz;
    if (s === 'tablettes') [-1, 1].forEach(k => cyl(g, .26, .26, .5, M('noyer'), k * Math.sin(a + .08) * (Rr - .45), 0, cz - Math.cos(a + .08) * (Rr - .45), 28));
    else [-1, 1].forEach(k => { const b = bloc(g, .28, .62, .7, m, k * Math.sin(a) * (Rr - .45), 0, cz - Math.cos(a) * (Rr - .45), .13); b.rotation.y = -k * a; });
  } else if (s === 'cercle') {
    const m = M('jungle');
    for (let i = 0; i < 4; i++) {
      const a0 = i * Math.PI / 2 + .1, a1 = (i + 1) * Math.PI / 2 - .1;
      couronne(g, 1.25, 2.02, a0, a1, .42, m, 0, .05);
      couronne(g, 1.8, 2.06, a0, a1, .82, m, 0, .06);
    }
    cyl(g, .72, .72, .36, M('travertin'), 0, 0, 0, 40);
    cyl(g, .25, .25, .2, M('plante:#3C5A36'), 0, .36, 0, 16);
  } else if (s === 'topo') {
    const b = bloc(g, 1.75, .44, .62, M('topo'), 0, 0, 0, .18);
    [-.42, .42].forEach(x => sphere(g, .34, M('laque:#4A2F60'), x, .44, 0, 1, .12, .7, 20));
  }
  ombreSol(g, 3.2, 2.2);
  return g;
}

/* =================================================================
   BAIGNOIRES (axe long selon x)
   ================================================================= */
function baignoire(look) {
  const g = groupe('baignoire');
  const ext = M(look.style === 'cannelee' ? 'laque:' + look.ext : 'laque:' + look.ext), int = M('blanc');
  const e = tour(g, [[0, 0], [.6, 0], [.74, .12], [.8, .45], [.82, .6], [.79, .62]], ext, 0, look.style === 'griffe' ? .12 : 0, 0, 48);
  const i = tour(g, [[.79, .62], [.75, .45], [.64, .16], [0, .12]], int, 0, look.style === 'griffe' ? .12 : 0, 0, 48);
  [e, i].forEach(o => { o.scale.set(1.04, 1, .5); o.material.side = THREE.DoubleSide; });
  if (look.style === 'griffe') {
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { sphere(g, .045, M('or'), a * .6, .05, b * .24); cyl(g, .02, .035, .08, M('or'), a * .6, .06, b * .24); });
    const dos = sphere(g, .32, ext, -.62, .62, 0, .7, .45, 1.1, 24); dos.scale.set(.5, .5, 1.1);
  }
  if (look.style === 'cannelee') {
    const fl = []; for (let k = 0; k < 64; k++) { const a = k / 64 * TAU; fl.push([Math.cos(a) * .8 * 1.04, .31, Math.sin(a) * .8 * .5, 0, 0, 0, 1]); }
    instances(g, new THREE.CapsuleGeometry(.018, .5, 4, 6), ext, fl);
  }
  bloc(g, .06, .04, .05, M('chrome'), -.82, .5, 0, .01);
  ombreSol(g, 2.2, 1.2);
  return g;
}

/* =================================================================
   SCULPTURES
   ================================================================= */
function silhouette(g, m, echelle = 1, pose = 'marche') {
  const s = echelle, h = new THREE.Group();
  if (pose === 'marche') {
    capsule(h, .045, .42, m, -.05, .3, .1, .35);
    capsule(h, .045, .42, m, .05, .3, -.1, -.3);
    capsule(h, .075, .32, m, 0, .78, 0, .08);
    sphere(h, .075, m, 0, 1.08, .03);
    capsule(h, .03, .34, m, -.14, .8, .1, -.6, 0, .2);
    capsule(h, .03, .34, m, .14, .8, -.08, .5, 0, -.2);
  } else {
    capsule(h, .05, .45, m, -.1, .32, .08, .1, 0, .15);
    capsule(h, .05, .45, m, .14, .3, -.05, -.25, 0, -.1);
    capsule(h, .08, .34, m, .02, .8, 0, .35, .4, .1);
    sphere(h, .08, m, .06, 1.1, .12);
    capsule(h, .035, .55, m, -.3, .95, -.1, .2, 0, 1.3);
    capsule(h, .035, .45, m, .3, .7, .1, -.4, 0, -.9);
    sphere(h, .07, m, -.62, 1.12, -.12, 1, .3, 1);
  }
  h.scale.setScalar(s);
  g.add(h);
  return h;
}
function sculpture(look) {
  const g = groupe('sculpture');
  if (look.style === 'marcheur') {
    bloc(g, .62, .12, .32, M('noirMat'), 0, 0, 0, .01);
    const h = silhouette(g, M('bronze'), 1, 'marche'); h.position.y = .12;
    tore(g, .46, .018, M('led:#FFC46A'), 0, .74, 0, 0);
    halo(g, 1.6, 0, .74, .1);
    ombreSol(g, 1, .7);
  } else {
    bloc(g, 1.1, .6, 1.1, M('travertin'), 0, 0, 0, .02);
    const h = silhouette(g, M('marbreBlanc'), 1.35, 'lancer'); h.position.y = .6;
    tore(g, 1.15, .045, M('led:#FFF1DA'), 0, 2.0, -.05, 0);
    tore(g, 1.15, .06, M('laque:#EDE7DC'), 0, 2.0, -.12, 0);
    [-1, 1].forEach(k => bloc(g, .08, .7, .08, M('laque:#EDE7DC'), k * .9, .6, -.12));
    halo(g, 3.2, 0, 2.0, .1);
    ombreSol(g, 2, 1.6);
  }
  return g;
}

/* =================================================================
   EXTÉRIEUR : bulles, fontaine, salons
   ================================================================= */
function bulle(look, o = {}) {
  const g = groupe('bulle');
  if (look.style === 'geodesique') {
    const Rr = o.R || 5;
    const ico = new THREE.IcosahedronGeometry(Rr, 3), p = ico.attributes.position;
    const aretes = new Map(), cle = v => v.x.toFixed(2) + ',' + v.y.toFixed(2) + ',' + v.z.toFixed(2);
    for (let i = 0; i < p.count; i += 3) {
      const t = [0, 1, 2].map(k => new THREE.Vector3(p.getX(i + k), p.getY(i + k), p.getZ(i + k)));
      [[0, 1], [1, 2], [2, 0]].forEach(([a, b]) => { if (t[a].y < -.01 || t[b].y < -.01) return; const k = [cle(t[a]), cle(t[b])].sort().join('|'); if (!aretes.has(k)) aretes.set(k, [t[a], t[b]]); });
    }
    const geos = [];
    aretes.forEach(([a, b]) => { const l = a.distanceTo(b), c = new THREE.CylinderGeometry(.028, .028, l, 5); c.translate(0, l / 2, 0); const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize()); c.applyQuaternion(q); c.translate(a.x, a.y, a.z); geos.push(c.toNonIndexed()); });
    const struts = mesh(mergeGeometries(geos), M('alu')); g.add(struts);
    const peau = mesh(new THREE.SphereGeometry(Rr - .02, 64, 24, 0, TAU, 0, Math.PI / 2), M('bulle'), false);
    peau.userData.nonCuit = true; peau.renderOrder = 5; g.add(peau);
    tore(g, Rr, .07, M('alu'), 0, .02, 0);
    const zp = Math.sqrt(Rr * Rr - 2.5 * 2.5) - .05;
    [-1, 1].forEach(k => bloc(g, .08, 2.4, .08, M('alu'), k * .6, 0, zp));
    bloc(g, 1.28, .08, .08, M('alu'), 0, 2.4, zp);
  } else {
    const Rr = (look.diametre || 3.6) / 2, H = Rr + .8, yc = H - Rr, th = Math.acos(-yc / Rr), rs = Rr * Math.sin(th);
    const peau = mesh(new THREE.SphereGeometry(Rr, 48, 24, 0, TAU, 0, th), M('bulle'), false);
    peau.position.y = yc; peau.userData.nonCuit = true; peau.renderOrder = 5; g.add(peau);
    for (let i = 0; i < 6; i++) {
      const t = mesh(new THREE.TorusGeometry(Rr, .025, 6, 48, 2 * th), M('alu'));
      t.rotation.z = Math.PI / 2 - th;
      const pv = new THREE.Group(); pv.position.y = yc; pv.rotation.y = i / 6 * Math.PI; pv.add(t); g.add(pv);
    }
    tore(g, rs, .045, M('alu'), 0, .03, 0);
    tore(g, Rr * .92, .02, M('alu'), 0, yc + Rr * .38, 0);
    cyl(g, .22, .22, .08, M('alu'), 0, H - .07, 0, 16);
    const zp = Math.sqrt(Math.max(.2, Rr * Rr - .2 - Math.pow(1.9 - yc, 2)));
    [-1, 1].forEach(k => bloc(g, .05, 1.9, .05, M('alu'), k * .45, 0, zp));
    bloc(g, .95, .05, .05, M('alu'), 0, 1.9, zp);
  }
  return g;
}

function fontaine() {
  const g = groupe('fontaine');
  const tr = M('travertin');
  // bassin de 7 m
  tour(g, [[3.18, 0], [3.5, 0], [3.52, .45], [3.46, .52], [3.2, .52], [3.16, .45], [3.14, .05]], tr, 0, 0, 0, 96);
  const eau = new THREE.Mesh(new THREE.CircleGeometry(3.16, 96), M('eau'));
  eau.rotation.x = -Math.PI / 2; eau.position.y = .38; eau.userData.nonCuit = true; g.add(eau);
  M('eau').normalMap.repeat.set(3, 3);
  cyl(g, 3.16, 3.16, .05, M('laque:#4F6E70'), 0, 0, 0, 64);
  // colonne et vasques étagées
  tour(g, [[.55, 0], [.45, .15], [.3, .3], [.26, 1.0], [.2, 1.8], [.16, 2.5], [.1, 2.7], [0, 2.72]], tr, 0, .05, 0, 32);
  const vasques = [[1.55, .95, .22], [.95, 1.7, .18], [.52, 2.35, .14]];
  const nappes = [];
  vasques.forEach(([Rr, y, h]) => {
    tour(g, [[0, 0], [Rr * .3, 0], [Rr * .85, h * .6], [Rr, h], [Rr * .96, h + .03], [Rr * .8, h * .8], [0, h * .5]], tr, 0, y, 0, 64);
    const e = new THREE.Mesh(new THREE.CircleGeometry(Rr * .88, 48), M('eau')); e.rotation.x = -Math.PI / 2; e.position.y = y + h * .78; e.userData.nonCuit = true; g.add(e);
    const n = new THREE.Mesh(new THREE.CylinderGeometry(Rr * 1.01, Rr * 1.08, y + h - .38, 48, 1, true), M('cascade'));
    n.position.y = .38 + (y + h - .38) / 2; n.userData.nonCuit = true; n.renderOrder = 6; g.add(n); nappes.push(n);
  });
  sphere(g, .14, tr, 0, 2.86, 0);
  // jets : particules sur trajectoires paraboliques (animées sur le processeur graphique)
  const N = 700, pos = new Float32Array(N * 3), graine = new Float32Array(N);
  const r = alea(3);
  for (let i = 0; i < N; i++) { graine[i] = r(); pos[i * 3] = r() * TAU; pos[i * 3 + 1] = r(); pos[i * 3 + 2] = .6 + r() * .4; }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pg.setAttribute('graine', new THREE.BufferAttribute(graine, 1));
  const pm = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { t: { value: 0 }, taille: { value: 26 } },
    vertexShader: `attribute float graine; uniform float t; uniform float taille; varying float vA;
      void main(){ float a = position.x; float ph = fract(position.y + t * (0.35 + 0.25 * position.z));
        float v = 1.35 * position.z; float d = ph * v * 1.1; float y = 2.9 + 1.2 * ph * position.z - 4.9 * ph * ph * 0.62;
        vec3 p = vec3(cos(a) * d, y, sin(a) * d); vA = (1.0 - ph) * smoothstep(0.0, 0.08, ph);
        if (y < 0.4) vA = 0.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = taille * (0.5 + graine) / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard; gl_FragColor = vec4(0.9, 0.96, 1.0, vA * (0.55 - d)); }`
  });
  const jets = new THREE.Points(pg, pm); jets.userData.nonCuit = true; jets.frustumCulled = false; g.add(jets);
  ANIMS.push((t) => {
    pm.uniforms.t.value = t;
    const nm = M('eau').normalMap; nm.offset.set(t * .015, t * .01);
    M('cascade').map.offset.y = -t * .6;
  });
  ombreSol(g, 8.5, 8.5, 0, 0, .004, .7);
  return g;
}

function salonFeu() {
  const g = groupe('salon-feu');
  const ecru = M('boucle:#E9E1D1'), anth = M('boucle:#46454A');
  for (let i = 0; i < 5; i++) {
    const a0 = -Math.PI / 2 + .55 + i * 1.05, a1 = a0 + .95, m = i < 3 ? ecru : anth;
    couronne(g, 1.25, 1.9, a0, a1, .4, m, 0, .05);
    couronne(g, 1.78, 1.98, a0, a1, .72, m, 0, .05);
    const la = []; for (let a = a0 + .05; a < a1; a += .09) la.push([Math.cos(a) * 2.0, .36, -Math.sin(a) * 2.0, 0, a, 0, 1]);
    instances(g, new THREE.BoxGeometry(.02, .7, .03), M('laiton'), la);
  }
  cyl(g, .62, .62, .32, M('noirMat'), 0, 0, 0, 40);
  cyl(g, .44, .44, .1, M('verre'), 0, .32, 0, 32);
  const fl = [];
  for (let i = 0; i < 5; i++) { const f = place(g, mesh(new THREE.ConeGeometry(.08 + (i % 2) * .04, .35, 10), M('flamme'), false), (i - 2) * .08, .5, (i % 2 - .5) * .1); f.userData.nonCuit = true; fl.push(f); }
  halo(g, 2.2, 0, .6, 0);
  ANIMS.push(t => fl.forEach((f, i) => { f.scale.y = .8 + .35 * Math.sin(t * 9 + i * 1.7) * Math.sin(t * 5.3 + i); f.scale.x = f.scale.z = .9 + .1 * Math.sin(t * 7 + i); }));
  ombreSol(g, 4.6, 4.6);
  return g;
}

function plante(g, x, z, h = 1.4, type = 'olivier', y = 0) {
  const r = alea(Math.round(x * 131 + z * 37 + 11));
  if (type === 'palmier') {
    tube(g, [[x, y, z], [x + .05, y + h * .5, z], [x - .03, y + h, z + .02]], .05, M('laque:#8A7358'), false, 12, 6);
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + r(); const f = sphere(g, .45, M('plante:#5E7B42'), x + Math.cos(a) * .35, y + h - .05, z + Math.sin(a) * .35, 1, .08, .22, 10); f.rotation.y = -a; f.rotation.z = .5; }
    return;
  }
  tube(g, [[x, y, z], [x + .04, y + h * .45, z - .02], [x - .02, y + h * .7, z + .02]], .045, M('laque:#6E5A45'), false, 10, 6);
  const col = type === 'olivier' ? ['#7D8C62', '#6A7A52', '#8A9A6E'] : ['#4F6B3A', '#5C7A44', '#445E33'];
  for (let i = 0; i < 7; i++) sphere(g, h * (.16 + r() * .1), M('plante:' + col[i % 3]), x + (r() - .5) * h * .45, y + h * (.7 + r() * .3), z + (r() - .5) * h * .45, 1, .85, 1, 10);
}
function jardiniere() {
  const g = groupe('jardiniere');
  place(g, mesh(new THREE.SphereGeometry(.4, 28, 16, 0, TAU, .35, Math.PI * .55), M('laque:#F2F0EA')), 0, .32, 0);
  cyl(g, .32, .32, .02, M('laque:#5B4636'), 0, .56, 0, 20);
  plante(g, 0, 0, 1.7, 'olivier', .56);
  ombreSol(g, 1, 1);
  return g;
}
function salonCorde(look) {
  const g = groupe('salon-corde');
  const co = M('corde'), cu = M('tissu:' + look.coussins);
  const pieceS = (w, x, z, ry) => {
    const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
    bloc(p, w, .36, .82, co, 0, 0, 0, .05);
    bloc(p, w - .14, .14, .68, cu, 0, .36, .04, .05);
    bloc(p, w, .42, .12, co, 0, .36, -.35, .04);
    for (let i = 0; i < Math.round(w / .6); i++) { const c = bloc(p, .5, .4, .14, cu, -w / 2 + .35 + i * .6, .46, -.24, .05); c.rotation.x = -.18; }
    [-1, 1].forEach(k => bloc(p, .1, .55, .82, co, k * (w / 2 - .05), 0, 0, .04));
  };
  pieceS(2.1, 0, -1.1, 0);
  pieceS(.86, -1.55, .3, Math.PI / 2);
  pieceS(.86, 1.55, .3, -Math.PI / 2);
  bloc(g, 1.1, .34, .62, co, 0, 0, .25, .03);
  bloc(g, 1.1, .03, .62, M('pierre'), 0, .34, .25);
  ombreSol(g, 4, 3.4);
  return g;
}
function meridienne() {
  const g = groupe('meridienne');
  const sh = new THREE.Shape();
  sh.moveTo(-.95, .32); sh.quadraticCurveTo(-.2, .26, .35, .34); sh.quadraticCurveTo(.75, .45, .9, .82); sh.lineTo(.8, .86); sh.quadraticCurveTo(.62, .52, .3, .44); sh.quadraticCurveTo(-.2, .38, -.95, .42); sh.closePath();
  const b = extrude(g, sh, .68, M('corde'), .02); b.rotation.y = Math.PI / 2; b.position.x = -.34;
  const c = extrude(g, sh, .6, M('tissu:#CFCBC4'), .015); c.rotation.y = Math.PI / 2; c.position.set(-.3, .06, 0); c.scale.set(1, .95, 1);
  [[-.3, -.8], [.3, -.8], [-.3, .7], [.3, .7]].forEach(([x, z]) => pied(g, .012, .32, M('noir'), x, z));
  ombreSol(g, 1, 2.1);
  return g;
}
function balancelles() {
  const g = groupe('balancelles');
  const cadre = M('laque:#CBBDA5'), co = M('corde'), toile = M('tissu:#E8DFCC');
  [-1, 1].forEach(k => {
    const p = new THREE.Group(); p.position.z = k * 1.05; p.rotation.y = k > 0 ? Math.PI : 0; g.add(p);
    [-1, 1].forEach(s => { tube(p, [[s * .8, 0, -.35], [s * .8, 2.05, 0], [s * .8, 0, .35]], .025, cadre, false, 6, 6); });
    bloc(p, 1.7, .05, .05, cadre, 0, 2.02, 0, .01);
    const t = place(p, mesh(new THREE.CylinderGeometry(.9, .9, 1.74, 24, 1, true, -Math.PI / 2 - .6, 1.2), toile), 0, 1.55, .35, 0, 0, Math.PI / 2);
    t.material.side = THREE.DoubleSide;
    bloc(p, 1.3, .1, .52, co, 0, .45, .08, .03);
    bloc(p, 1.3, .5, .07, co, 0, .5, -.16, .03).rotation.x = -.15;
    bloc(p, 1.16, .1, .44, M('tissu:#D9CFBD'), 0, .55, .09, .04);
    [-.62, .62].forEach(x => cyl(p, .006, .006, 1.5, M('laque:#8A7B64'), x, .52, .1, 4));
  });
  cyl(g, .38, .38, .03, M('travertin'), 0, .62, 0, 28);
  cyl(g, .04, .08, .62, cadre, 0, 0, 0, 12);
  ombreSol(g, 2.4, 3.2);
  return g;
}

/* ---------------------------------------------------------------
   Aiguillage : produit (sku) -> modèle générique
   --------------------------------------------------------------- */
const CAT_BUILD = {
  'Lit': lit, 'Suspension': suspension, 'Lustre': lustre, 'Applique': applique, 'Lampadaire': lampadaire,
  'Fauteuil': fauteuil, 'Tabouret de bar': tabouret, 'Canapé': canape, 'Banc': canape, 'Baignoire îlot': baignoire,
  'Sculpture': sculpture, 'Véranda bulle': bulle, 'Chambre bulle': bulle, 'Fontaine': () => fontaine(),
  'Salon extérieur': () => salonFeu(), 'Jardinière': () => jardiniere(), 'Salon de jardin': salonCorde,
  'Méridienne': () => meridienne(), 'Balancelles': () => balancelles()
};
function construireProduit(sku, o = {}) {
  const p = DATA.PRODUITS[sku];
  if (!p) return groupe('vide');
  let g;
  // pièces choisies : maquette détaillée ; reste du catalogue : maquette générique (v3d-catalogue.js)
  if (p.look) { const f = CAT_BUILD[p.cat]; g = f ? f(p.look, o) : groupe('vide'); }
  else g = construireCatalogue(p, o);
  g.userData.sku = sku;
  return g;
}
