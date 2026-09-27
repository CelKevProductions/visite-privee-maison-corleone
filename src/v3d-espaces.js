/* =================================================================
   Visite 3D — les six espaces (maquettes génériques)
   Coordonnées locales en mètres, origine au centre de l'espace, sol à y = 0.
   ================================================================= */

/* ---------- briques communes ---------- */
function nouvelEspace(id, x, z) {
  const g = groupe('espace-' + id);
  g.position.set(x, 0, z);
  return { id, g, murs: [], interieur: [], lampes: [], emplacements: {}, vues: {}, bornes: null, surChoix: [] };
}
function uvEchelle(geo, sx, sy) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
  return geo;
}
function socle(E, w, d, marge = .3, forme = 'rect') {
  if (forme === 'rond') { cyl(E.g, w / 2 + marge, w / 2 + marge + .04, .36, M('socle'), 0, -.36, 0, 64); return; }
  bloc(E.g, w + marge * 2, .36, d + marge * 2, M('socle'), 0, -.36, 0, .02);
}
function sol(E, w, d, cle, rx = 1, ry = 1, x = 0, z = 0) {
  const p = mesh(uvEchelle(new THREE.PlaneGeometry(w, d), rx, ry), M(cle), false);
  p.rotation.x = -Math.PI / 2; p.position.set(x, .002, z);
  E.g.add(p);
  return p;
}
function plafond(E, w, d, h, x = 0, z = 0, spots = []) {
  const p = mesh(new THREE.PlaneGeometry(w, d), M('plafond'), false);
  p.rotation.x = Math.PI / 2; p.position.set(x, h, z);
  p.userData.nonCuit = true;
  E.g.add(p); E.interieur.push(p);
  spots.forEach(([sx, sz]) => {
    const s = mesh(new THREE.CircleGeometry(.05, 16), M('opale:#FFF1DA'), false);
    s.rotation.x = Math.PI / 2; s.position.set(sx, h - .005, sz); s.userData.nonCuit = true;
    E.g.add(s); E.interieur.push(s);
  });
}
/* Murs : définis dans le sens horaire vu de dessus, pour que l'extrusion
   parte vers l'extérieur. Ouvertures : { c, w, y, h, type } avec c = abscisse
   (x pour les murs N/S, z pour E/O) du centre, en coordonnées de la pièce. */
function murs(E, b, spec = {}) {
  const { x0, x1, z0, z1, h } = b, ep = b.ep || .14;
  E.bornes = { x0, x1, z0, z1, h };
  const cotes = {
    N: { a: [x1, z0], b: [x0, z0], n: V3(0, 0, -1), u: c => x1 - c },
    O: { a: [x0, z0], b: [x0, z1], n: V3(-1, 0, 0), u: c => c - z0 },
    S: { a: [x0, z1], b: [x1, z1], n: V3(0, 0, 1), u: c => c - x0 },
    E: { a: [x1, z1], b: [x1, z0], n: V3(1, 0, 0), u: c => z1 - c }
  };
  Object.keys(cotes).forEach(k => {
    if (spec[k] === false) return;
    const c = cotes[k], L = Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1]);
    const ouv = (spec[k] || []).map(o => Object.assign({ u: c.u(o.c) }, o));
    const sh = new THREE.Shape();
    sh.moveTo(0, 0); sh.lineTo(L + ep, 0); sh.lineTo(L + ep, h); sh.lineTo(0, h); sh.closePath();
    ouv.forEach(o => { const t = new THREE.Path(); t.moveTo(o.u - o.w / 2, o.y); t.lineTo(o.u + o.w / 2, o.y); t.lineTo(o.u + o.w / 2, o.y + o.h); t.lineTo(o.u - o.w / 2, o.y + o.h); t.closePath(); sh.holes.push(t); });
    const geo = new THREE.ExtrudeGeometry(sh, { depth: ep, bevelEnabled: false });
    const mat = M(spec.mat || 'mur').clone(); mat.transparent = true;
    const me = mesh(geo, mat);
    const d = V3(c.b[0] - c.a[0], 0, c.b[1] - c.a[1]).normalize();
    const mx = new THREE.Matrix4().makeBasis(d, V3(0, 1, 0), c.n);
    me.applyMatrix4(mx);
    me.position.set(c.a[0], 0, c.a[1]);
    me.userData.nonCuit = true;
    E.g.add(me);
    const capM = M('poche').clone(); capM.transparent = true;
    const cap = mesh(new THREE.BoxGeometry(L + ep, .035, ep + .006), capM, false);
    cap.applyMatrix4(mx);
    cap.position.set(c.a[0], 0, c.a[1]).add(d.clone().multiplyScalar((L + ep) / 2)).add(c.n.clone().multiplyScalar(ep / 2));
    cap.position.y = h + .017;
    cap.userData.nonCuit = true;
    E.g.add(cap);
    const centre = V3((c.a[0] + c.b[0]) / 2, h / 2, (c.a[1] + c.b[1]) / 2);
    E.murs.push({ me, cap, n: c.n.clone(), centre, op: 1 });
    ouv.forEach(o => ouverture(E, c, d, o, ep));
  });
}
function ouverture(E, c, d, o, ep) {
  const base = V3(c.a[0], 0, c.a[1]).add(d.clone().multiplyScalar(o.u));
  const ry = Math.atan2(c.n.x, c.n.z);
  const cadre = new THREE.Group(); cadre.position.copy(base); cadre.rotation.y = ry; E.g.add(cadre);
  // dans le repère du cadre : x le long du mur (sens inverse de d), z vers l'extérieur
  const noir = M('noir');
  if (o.type === 'passage') {
    bloc(cadre, o.w + .08, .06, ep + .02, M('noyer'), 0, o.y + o.h, ep / 2);
    [-1, 1].forEach(k => bloc(cadre, .06, o.h, ep + .02, M('noyer'), k * (o.w / 2 + .02), o.y, ep / 2));
    return;
  }
  if (o.type === 'porte') {
    bloc(cadre, o.w + .08, .05, ep + .02, M('chene'), 0, o.y + o.h, ep / 2);
    [-1, 1].forEach(k => bloc(cadre, .05, o.h, ep + .02, M('chene'), k * (o.w / 2 + .015), o.y, ep / 2));
    bloc(cadre, o.w - .02, o.h - .02, .04, M('laque:#8C6A4A'), 0, o.y, ep * .7);
    return;
  }
  // fenêtre ou baie vitrée
  [-1, 1].forEach(k => bloc(cadre, .04, o.h, .06, noir, k * (o.w / 2 - .02), o.y, ep / 2));
  bloc(cadre, o.w, .04, .06, noir, 0, o.y, ep / 2);
  bloc(cadre, o.w, .04, .06, noir, 0, o.y + o.h - .04, ep / 2);
  const nb = Math.max(1, Math.round(o.w / 1.2));
  for (let i = 1; i < nb; i++) bloc(cadre, .035, o.h, .05, noir, -o.w / 2 + i * o.w / nb, o.y, ep / 2);
  const vitre = mesh(new THREE.PlaneGeometry(o.w - .06, o.h - .06), M('verre'), false);
  vitre.position.set(0, o.y + o.h / 2, ep / 2); vitre.userData.nonCuit = true; vitre.renderOrder = 4;
  cadre.add(vitre);
  if (o.vue !== false) {
    const fond = mesh(new THREE.PlaneGeometry(o.w * 1.8, o.h * 1.5), M('fenetre'), false);
    fond.position.set(0, o.y + o.h / 2, ep + 1.2); fond.rotation.y = Math.PI; fond.userData.nonCuit = true;
    cadre.add(fond); E.interieur.push(fond);
  }
}
// Rideau plissé (plan ondulé) : largeur w, hauteur h, posé face +z
function rideau(parent, w, h, m, x, y, z, ry = 0, plis = 8, amp = .045) {
  const geo = new THREE.PlaneGeometry(w, h, plis * 6, 1), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) / w * plis * TAU) * amp);
  geo.computeVertexNormals();
  const me = mesh(geo, m); me.position.set(x, y + h / 2, z); me.rotation.y = ry;
  parent.add(me);
  return me;
}
function lattes(parent, longueur, h, x, z, ry, led = null) {
  // panneau de lattes de chêne sur fond sombre (face +z du repère local)
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; parent.add(g);
  bloc(g, longueur, h, .02, M('laque:#5B412D'), 0, 0, .01);
  const l = []; for (let u = -longueur / 2 + .03; u < longueur / 2; u += .072) l.push([u, h / 2, .042, 0, 0, 0, 1]);
  instances(g, new THREE.BoxGeometry(.036, h - .04, .044), M('chene'), l, false);
  if (led) {
    const pts = []; for (let i = 0; i <= 60; i++) { const u = -longueur / 2 + i / 60 * longueur; pts.push([u, led.y + led.a * Math.sin(u * led.f + led.p), .07]); }
    const t = tube(g, pts, .011, M('led'), false, 160, 5); t.castShadow = false; t.userData.nonCuit = true;
    bloc(g, longueur, .012, .03, M('led'), 0, h - .03, .05).userData.nonCuit = true;
  }
  return g;
}
function vasePlante(parent, x, y, z, h = .35, sec = false) {
  cyl(parent, .06, .045, h * .45, M('laque:#2E2A28'), x, y, z, 16);
  const r = alea(Math.round(x * 97 + z * 13));
  for (let i = 0; i < 6; i++) sphere(parent, .05 + r() * .03, M(sec ? 'plante:#BFA67E' : 'plante:#6E7F4F'), x + (r() - .5) * .12, y + h * .45 + .05 + r() * h * .45, z + (r() - .5) * .12, 1, 1, 1, 8);
}
function tapis(parent, w, d, cle, x, z, rond = false) {
  const m = M(cle);
  if (rond) return cyl(parent, w / 2, w / 2, .012, m, x, 0, z, 48);
  return bloc(parent, w, .012, d, m, x, 0, z);
}
function tableBasse(parent, r, x, z, cle = 'travertin', h = .38) {
  cyl(parent, r, r, .05, M(cle), x, h - .05, z, 40);
  cyl(parent, r * .55, r * .7, h - .05, M(cle), x, 0, z, 32);
  ombreSol(parent, r * 2.6, r * 2.6, x, z);
}
function lampe(E, x, y, z) { E.lampes.push(V3(x, y, z)); }
function emplacement(E, id, poses, o = {}) { E.emplacements[id] = Object.assign({ poses }, o); }
const cap = (x, z, cx, cz) => Math.atan2(cx - x, cz - z);   // orientation vers un point

/* =================================================================
   01. Chambre Deluxe — calée sur la photo de la proposition
   ================================================================= */
function espaceDeluxe() {
  const E = nouvelEspace('deluxe', -13.5, -7);
  const b = { x0: -2.1, x1: 2.1, z0: -3, z1: 3, h: 2.7 };
  socle(E, 4.2, 6);
  sol(E, 4.2, 6, 'moquette', 2.2, 3.1);
  murs(E, b, {
    mat: 'murChaud',
    N: [{ c: -.35, w: 2.3, y: .32, h: 2.16, type: 'fenetre' }],
    S: [{ c: 1.45, w: .9, y: 0, h: 2.1, type: 'porte' }]
  });
  plafond(E, 4.2, 6, 2.7, 0, 0, [[-.8, -1.8], [.9, -1.6], [-.8, 1], [.9, 1.2]]);
  const g = E.g;
  // lattes et LED ondulées : tête de lit et mur TV (comme la photo)
  lattes(g, 6, 2.7, -2.1, 0, Math.PI / 2, { y: 1.62, a: .2, f: 1.15, p: .6 });
  lattes(g, 4.2, 2.7, 2.1, .9, -Math.PI / 2, { y: 1.08, a: .22, f: 1.3, p: 2.2 });
  // fenêtre : voilage, rideaux bicolores, tringle
  rideau(g, 2.3, 2.3, M('voilage'), -.35, .05, -2.9, 0, 14, .03);
  [[-1.72], [1.02]].forEach(([x]) => {
    rideau(g, .62, 1.62, M('tissu:#B7A286'), x, .78, -2.83, 0, 5, .05);
    rideau(g, .62, .78, M('tissu:#A2462A'), x, 0, -2.83, 0, 5, .05);
  });
  cyl(g, .012, .012, 3.1, M('noir'), -.35, 2.56, -2.83, 8).rotation.z = Math.PI / 2;
  // bureau, lampe champignon, tableau
  const bx = 2.1 - .3;
  bloc(g, .56, .035, 1.3, M('chene'), bx, .72, -2.1, .005);
  [-.62, .62].forEach(dz => { bloc(g, .5, .03, .03, M('noir'), bx, .69, -2.1 + dz); bloc(g, .03, .7, .03, M('noir'), bx - .24, 0, -2.1 + dz); bloc(g, .5, .03, .03, M('noir'), bx, 0, -2.1 + dz); });
  cyl(g, .06, .07, .02, M('noir'), bx + .05, .755, -2.62, 20);
  cyl(g, .008, .008, .3, M('noir'), bx + .05, .775, -2.62, 6);
  place(g, mesh(new THREE.SphereGeometry(.12, 20, 10, 0, TAU, 0, Math.PI / 2), M('noir')), bx + .05, 1.04, -2.62);
  sphere(g, .03, M('opale'), bx + .05, 1.02, -2.62);
  bloc(g, .2, .05, .26, M('laque:#E8E1D4'), bx, .755, -1.92, .005);
  vasePlante(g, bx, .755, -1.55, .32);
  const tb = new THREE.Group(); tb.position.set(2.1 - .02, 1.62, -2.1); tb.rotation.y = -Math.PI / 2; g.add(tb);
  bloc(tb, .66, .86, .03, M('noir'), 0, -.43, 0);
  const oe = mesh(new THREE.PlaneGeometry(.6, .8), M('oeuvre'), false); oe.position.set(0, 0, .018); tb.add(oe);
  // TV et console flottante éclairée
  const tv = new THREE.Group(); tv.position.set(2.1 - .12, 0, .55); tv.rotation.y = -Math.PI / 2; g.add(tv);
  bloc(tv, 1.46, .84, .05, M('noir'), 0, 1.06, 0, .005);
  const ecran = mesh(new THREE.PlaneGeometry(1.4, .78), M('laque:#141318'), false); ecran.position.set(0, 1.48, .026); tv.add(ecran);
  const cs = new THREE.Group(); cs.position.set(2.1 - .22, 0, .55); cs.rotation.y = -Math.PI / 2; g.add(cs);
  bloc(cs, 3.1, .34, .42, M('laque:#CFC4B1'), .25, .27, 0, .02);
  for (let i = 0; i < 5; i++) bloc(cs, .004, .3, .005, M('laque:#A89C88'), -1.3 + .62 * (i + 1), .29, .212);
  const lcs = bloc(cs, 3.0, .01, .36, M('led'), .25, .255, 0); lcs.castShadow = false; lcs.userData.nonCuit = true;
  const hl = mesh(new THREE.PlaneGeometry(3.6, 1.1), M('halo'), false); hl.rotation.x = -Math.PI / 2; hl.position.set(.25, .006, .15); hl.userData.nonCuit = true; cs.add(hl);
  cyl(cs, .08, .06, .42, M('laque:#1E1C1F'), 1.45, .61, 0, 18);
  for (let i = 0; i < 9; i++) cyl(cs, .006, .006, .45, M('laque:#B89E75'), 1.45 + Math.sin(i) * .05, 1.0, Math.cos(i * 1.7) * .05, 5);
  bloc(cs, .3, .05, .22, M('laque:#E9E2D5'), .85, .61, 0); bloc(cs, .12, .08, .08, M('noir'), .85, .66, 0, .01);
  // chevet séparé (pour les lits sans chevets intégrés) + petit vase
  const chevet = new THREE.Group(); chevet.userData.nonCuit = true; g.add(chevet);
  bloc(chevet, .46, .56, .42, M('noyer'), -1.84, .04, -1.66, .02);
  vasePlante(chevet, -1.84, .6, -1.66, .3);
  E.surChoix.push((slot, p, prod) => {
    if (slot !== 'lit') return;
    chevet.visible = !(p.look ? ['vague', 'signature', 'executive'].includes(p.look.style) : p.chevets);
    // lit plus large : le chevet s'écarte (le lit est tourné, sa largeur suit l'axe z)
    const zmin = prod.boite.min.z - E.g.position.z;
    chevet.position.z = clamp(zmin - .25 + 1.66, -.6, 0);
  });
  // emplacements des produits
  emplacement(E, 'lit', [[-2.1 + .12 + 1.05, 0, -.4, Math.PI / 2]], { opts: { W: 1.8, L: 2.1, accent: '#B4532F' }, dos: 1.17 });
  emplacement(E, 'suspension', [[-1.84, 2.7, -1.66, 0]], { opts: { h: 1.02, hMax: 1.45 }, ancre: 'bas' });
  emplacement(E, 'fauteuil', [[1.12, 0, -2.08, Math.PI / 2 - .12]]);
  emplacement(E, 'applique', [[2.1, 2.28, -2.1, -Math.PI / 2]], { ancre: 'centre' });
  lampe(E, -1.84, 1.55, -1.66); lampe(E, 1.85, 1.0, -2.6); lampe(E, 1.6, .3, .5);
  E.vues = {
    maquette: { pos: [5.2, 7.6, 7.4], cible: [-.1, .4, -.5], fov: 38 },
    oeil: { pos: [1.28, 1.36, 2.95], cible: [-.62, 1.1, -3], fov: 58 },
    explore: { cible: [0, .9, -.5], depart: [1.28, 1.5, 2.9], dist: [1.8, 12], polar: [.1, .49] }
  };
  return E;
}

/* =================================================================
   02. Junior Suite
   ================================================================= */
function espaceJunior() {
  const E = nouvelEspace('junior', -4.6, -7.2);
  const b = { x0: -3.25, x1: 3.25, z0: -3.5, z1: 3.5, h: 2.8 };
  socle(E, 6.5, 7);
  sol(E, 6.5, 7, 'parquet', 2.6, 2.8);
  murs(E, b, {
    N: [{ c: 1.75, w: 2.3, y: .3, h: 2.25, type: 'fenetre' }],
    E: [{ c: -.2, w: 1.7, y: .5, h: 1.9, type: 'fenetre' }],
    S: [{ c: -2.35, w: .9, y: 0, h: 2.1, type: 'porte' }],
    O: [{ c: 2.3, w: .85, y: 0, h: 2.1, type: 'porte' }]
  });
  plafond(E, 6.5, 7, 2.8, 0, 0, [[-1.3, -2.3], [1.6, 1.8], [-1.5, 1.5], [1.8, -1.6]]);
  const g = E.g;
  rideau(g, 2.3, 2.4, M('voilage'), 1.75, .05, -3.4, 0, 14, .03);
  rideau(g, 1.7, 2.1, M('voilage'), 3.15, .3, -.2, -Math.PI / 2, 10, .03);
  // panneau mural derrière le lit
  bloc(g, 3.4, 2.8, .04, M('laque:#E3D6C3'), -1.3, 0, -3.48);
  // chevets et lampes
  const chevets = [-1, 1].map(k => {
    const c = new THREE.Group(); c.userData.nonCuit = true; g.add(c);
    bloc(c, .5, .5, .42, M('noyer'), -1.3 + k * 1.28, 0, -3.18, .02); vasePlante(c, -1.3 + k * 1.28, .5, -3.2, .28, k > 0);
    return c;
  });
  E.surChoix.push((slot, p, prod) => {
    if (slot !== 'lit') return;
    const integres = p.look ? ['vague', 'signature', 'executive'].includes(p.look.style) : p.chevets;
    const demi = (prod.boite.max.x - prod.boite.min.x) / 2;
    chevets.forEach((c, i) => { c.visible = !integres; c.position.x = (i ? 1 : -1) * clamp(demi + .29 - 1.28, 0, .45); });
  });
  // salon : tapis, table basse
  tapis(g, 3.2, 3.2, 'tissu:#E5DDCD', 1.55, 1.8, true);
  tableBasse(g, .48, 1.55, 1.75);
  vasePlante(g, 1.55, .38, 1.75, .3, true);
  // meuble média et TV sur le mur ouest
  bloc(g, .46, .48, 1.7, M('noyer'), -3.02, 0, .4, .02);
  const tv = bloc(g, .05, .78, 1.36, M('noir'), -3.2, .95, .4, .005);
  // plantes
  plante(g, -2.85, -1.3, 1.6, 'olivier', .35);
  cyl(g, .2, .16, .35, M('laque:#E9E3D8'), -2.85, 0, -1.3, 20);
  emplacement(E, 'lit', [[-1.3, 0, -3.5 + .12 + 1.05, 0]], { opts: { W: 1.8, L: 2.1, accent: '#8F9B7F' }, dos: 1.17 });
  emplacement(E, 'canape', [[1.58, 0, 3.02, Math.PI]], { dos: .48 });
  emplacement(E, 'fauteuil', [[2.45, 0, .55, cap(2.45, .55, 1.55, 1.9)]]);
  emplacement(E, 'suspension', [[1.55, 2.8, 1.75, .6]], { opts: { h: 1.05, hMax: 1.7 }, ancre: 'bas' });
  emplacement(E, 'lampadaire', [[2.95, 0, -2.95, 0]]);
  lampe(E, 1.55, 1.7, 1.75); lampe(E, 2.95, 1.6, -2.95); lampe(E, -1.3, 1.2, -2.6);
  E.vues = {
    maquette: { pos: [6.4, 9.2, 8.6], cible: [0, .3, -.2], fov: 40 },
    oeil: { pos: [-2.75, 1.6, 2.7], cible: [1.2, 1.0, -1.4], fov: 60 },
    explore: { cible: [0, .9, 0], depart: [2.9, 1.6, 3.0], dist: [2, 14], polar: [.1, .49] }
  };
  return E;
}

/* =================================================================
   03. Suite Présidentielle + terrasse et bulle privative
   ================================================================= */
function espacePresidentielle() {
  const E = nouvelEspace('presidentielle', 5.4, -7.2);
  const b = { x0: -5, x1: 5, z0: -4, z1: 4, h: 3.2 };
  socle(E, 14, 8, .3);
  E.g.children[E.g.children.length - 1].position.x = 2;
  sol(E, 10, 8, 'marbre', 2.5, 2);
  sol(E, 4, 8, 'terrasse', 1.6, 3.2, 7, 0);
  murs(E, b, {
    N: [{ c: 2.8, w: 2.2, y: .4, h: 2.3, type: 'fenetre' }],
    S: [{ c: -2.6, w: 1.8, y: .5, h: 2.0, type: 'fenetre' }],
    O: [{ c: 2.9, w: 1.0, y: 0, h: 2.3, type: 'porte' }],
    E: [{ c: 0, w: 6.4, y: .02, h: 2.85, type: 'baie', vue: false }]
  });
  plafond(E, 10, 8, 3.2, 0, 0, [[-3.5, -2.8], [0, -2.8], [3, -2.5], [-3.5, 2.5], [2.8, 2.6]]);
  const g = E.g;
  rideau(g, 2.2, 2.6, M('voilage'), 2.8, .1, -3.9, 0, 12, .03);
  // garde-corps vitré de la terrasse
  [[9, 0, 8, Math.PI / 2], [7, -4, 4, 0], [7, 4, 4, 0]].forEach(([x, z, l, ry]) => {
    const p = mesh(new THREE.PlaneGeometry(l, 1), M('verre'), false); p.position.set(x, .5, z); p.rotation.y = ry; p.userData.nonCuit = true; g.add(p);
    const main = bloc(g, ry ? .05 : l, .04, ry ? l : .05, M('alu'), x, 1, z);
  });
  // salon : tapis, table basse, plante
  tapis(g, 3.4, 2.8, 'tissu:#DCD2C2', -2.4, 1.7);
  tableBasse(g, .55, -2.3, 1.75, 'marbreBlanc', .36);
  vasePlante(g, -2.3, .36, 1.75, .34);
  plante(g, -4.4, -.2, 1.9, 'olivier'); cyl(g, .24, .2, .4, M('laque:#1E1C1F'), -4.4, 0, -.2, 20);
  // coin bain : tapis et tablette
  tapis(g, 2.4, 1.4, 'tissu:#EEE9E0', 2.9, -2.5);
  cyl(g, .2, .2, .5, M('travertin'), 4.1, 0, -2.4, 24);
  // bureau
  bloc(g, 1.5, .04, .6, M('noyer'), 1.4, .74, 3.6, .01);
  [-.68, .68].forEach(dx => bloc(g, .04, .74, .5, M('laiton'), 1.4 + dx, 0, 3.6));
  // terrasse : jardinières
  [[8.4, -3.4], [8.4, 3.4]].forEach(([x, z]) => { cyl(g, .32, .26, .5, M('laque:#EEEAE2'), x, 0, z, 24); plante(g, x, z, 1.5, 'olivier', .5); });
  // intérieur de la bulle
  [[6.5, -.45], [6.5, .45]].forEach(([x, z]) => { bloc(g, .7, .3, .8, M('boucle:#EDE6D8'), x, 0, z, .12); bloc(g, .7, .4, .14, M('boucle:#EDE6D8'), x - .35, .3, z, .06).rotation.y = Math.PI / 2; });
  cyl(g, .25, .25, .4, M('travertin'), 7.4, 0, 0, 20);
  emplacement(E, 'lit', [[-2.2, 0, -4 + .12 + 1.05, 0]], { opts: { W: 2.0, L: 2.1, accent: '#27408B' }, dos: 1.17 });
  emplacement(E, 'lustre', [[-2.3, 3.2, 1.75, 0]], { opts: { h: .35, hMax: 1.9 }, ancre: 'centre' });
  emplacement(E, 'baignoire', [[2.9, 0, -2.5, 0]]);
  emplacement(E, 'canape', [[-4.35, 0, 1.75, Math.PI / 2]], { dos: .65 });
  emplacement(E, 'fauteuil', [[-.55, 0, 1.35, cap(-.55, 1.35, -2.3, 1.75)]]);
  emplacement(E, 'bulle', [[7, 0, 0, -Math.PI / 2]]);
  lampe(E, -2.3, 2.2, 1.75); lampe(E, -2.2, 1.2, -3); lampe(E, 7, 1.4, 0);
  E.vues = {
    maquette: { pos: [9.5, 11.5, 10.5], cible: [1.2, .2, 0], fov: 40 },
    oeil: { pos: [4.3, 1.75, 3.3], cible: [-1.2, 1.1, -2.6], fov: 62 },
    explore: { cible: [1, 1.1, 0], depart: [4, 1.8, 3.4], dist: [2.5, 20], polar: [.08, .49] }
  };
  return E;
}

/* =================================================================
   04. Lobby et lounge, double hauteur
   ================================================================= */
function espaceLobby() {
  const E = nouvelEspace('lobby', -9.5, 7.5);
  const b = { x0: -5.5, x1: 5.5, z0: -4.5, z1: 4.5, h: 5.2 };
  socle(E, 11, 9);
  sol(E, 11, 9, 'dallage', 5.5, 4.5);
  murs(E, b, {
    O: [{ c: -2.5, w: 1.6, y: .6, h: 3.8, type: 'fenetre' }, { c: .5, w: 1.6, y: .6, h: 3.8, type: 'fenetre' }, { c: 3.3, w: 1.2, y: .6, h: 3.8, type: 'fenetre' }],
    S: [{ c: 0, w: 3.2, y: 0, h: 3.2, type: 'baie' }],
    E: [{ c: -1, w: 3, y: 0, h: 3.4, type: 'passage' }]
  });
  plafond(E, 11, 9, 5.2);
  const g = E.g;
  // comptoir d'accueil courbe en travertin + panneau mural
  const R0 = 2.4, cz = -3.3 - R0;
  const cpt = couronne(g, R0 - .45, R0, -Math.PI / 2 - .62, -Math.PI / 2 + .62, 1.08, M('travertin'), 0, .02); cpt.position.z = cz;
  const nerv = []; for (let a = -Math.PI / 2 - .6; a <= -Math.PI / 2 + .6; a += .035) nerv.push([Math.cos(a) * (R0 + .01), .54, cz - Math.sin(a) * (R0 + .01), 0, 0, 0, 1]);
  instances(g, new THREE.CapsuleGeometry(.022, .92, 3, 6), M('laque:#CDBB9D'), nerv);
  bloc(g, 7, 3.2, .06, M('noyer'), 0, 0, -4.46);
  for (let i = 0; i < 24; i++) bloc(g, .1, 3.2, .04, M('chene'), -3.45 + i * .3, 0, -4.4);
  // table basse du salon de fauteuils
  tapis(g, 3.4, 3.4, 'tissu:#D8CDBB', -3.4, 2.7, true);
  tableBasse(g, .5, -3.4, 2.7, 'marbreBlanc', .4);
  // grands oliviers
  [[-4.9, -3.9], [4.9, -3.9], [-4.95, -1.05]].forEach(([x, z]) => { cyl(g, .45, .38, .6, M('laque:#1E1C1F'), x, 0, z, 24); plante(g, x, z, 2.6, 'olivier', .6); });
  emplacement(E, 'lustre', [[0, 5.2, .2, 0]], { opts: { h: .25, hMax: 2.8 }, ancre: 'centre' });
  emplacement(E, 'canape', [[0, 0, .2, 0]]);
  const fx = -3.4, fz = 2.7;
  emplacement(E, 'fauteuils', [[-4.35, 1.85], [-2.45, 1.85], [-4.35, 3.55], [-2.45, 3.55]].map(([x, z]) => [x, 0, z, cap(x, z, fx, fz)]));
  emplacement(E, 'banc', [[4.3, 0, 2.2, -Math.PI / 2]]);
  emplacement(E, 'sculpture', [[3.7, 0, -2.4, -.5]]);
  lampe(E, 0, 3.4, .2); lampe(E, -3.4, 1.8, 2.7); lampe(E, 3.7, 1, -2.2);
  E.vues = {
    maquette: { pos: [9.5, 13.5, 12], cible: [0, 1, .2], fov: 40 },
    oeil: { pos: [5.0, 2.0, 4.0], cible: [-1.2, 2.3, -1.2], fov: 60 },
    lustre: { pos: [3.1, 1.2, 3.4], cible: [0, 3.7, .2], fov: 55 },
    explore: { cible: [0, 1.8, 0], depart: [4, 2, 4.2], dist: [2.5, 24], polar: [.08, .49] }
  };
  return E;
}

/* =================================================================
   05. Le grand bar sous véranda bulle
   ================================================================= */
function espaceBar() {
  const E = nouvelEspace('bar', 4.2, 7.8);
  E.bornes = { x0: -5, x1: 5, z0: -5, z1: 5, h: 5, rond: 5 };
  socle(E, 13, 13, .1, 'rond');
  const deck = mesh(uvEchelle(new THREE.CircleGeometry(6.5, 64), 3.2, 3.2), M('terrasse'), false);
  deck.rotation.x = -Math.PI / 2; deck.position.y = .002; E.g.add(deck);
  const g = E.g;
  // comptoir courbe au fond de la bulle
  const R0 = 2.85, a0 = Math.PI / 2 - .95, a1 = Math.PI / 2 + .95;
  couronne(g, R0 - .55, R0, a0, a1, 1.06, M('travertin'), 0, .02);
  const nerv = []; for (let a = a0 + .02; a <= a1; a += .035) nerv.push([Math.cos(a) * (R0 - .56), .52, -Math.sin(a) * (R0 - .56), 0, a + Math.PI / 2, 0, 1]);
  instances(g, new THREE.CapsuleGeometry(.025, .9, 3, 6), M('noyer'), nerv);
  const lb = couronne(g, R0 - .6, R0 - .54, a0, a1, .02, M('led'), .05, 0); lb.userData.nonCuit = true;
  // étagères à bouteilles
  couronne(g, 3.55, 3.85, a0 + .1, a1 - .1, 2.2, M('noyer'), 0, .01);
  for (let k = 0; k < 3; k++) couronne(g, 3.2, 3.55, a0 + .12, a1 - .12, .03, M('laiton'), .9 + k * .45, 0);
  const bt = [], r = alea(12);
  for (let k = 0; k < 3; k++) for (let a = a0 + .16; a < a1 - .14; a += .07) bt.push([Math.cos(a) * 3.38, .93 + k * .45, -Math.sin(a) * 3.38, 0, 0, 0, 1, 1, .8 + r() * .5, 1]);
  instances(g, new THREE.CylinderGeometry(.035, .035, .3, 8), M('ambre'), bt);
  emplacement(E, 'bulle', [[0, 0, 0, 0]], { opts: { R: 5 }, ancre: 'haut' });
  const tb = []; for (let i = 0; i < 6; i++) { const a = Math.PI / 2 - .7 + i * .28, rr = R0 - .95; tb.push([Math.cos(a) * rr, 0, -Math.sin(a) * rr, Math.atan2(Math.cos(a), -Math.sin(a))]); }
  emplacement(E, 'tabourets', tb);
  emplacement(E, 'suspensions', [-.45, 0, .45].map(d => { const a = Math.PI / 2 + d; return [Math.cos(a) * 2.6, 4.05, -Math.sin(a) * 2.6, 0]; }), { opts: { h: 1.35, hMax: 1.95 }, ancre: 'bas' });
  emplacement(E, 'salon', [[0, 0, 2.35, 0]]);
  emplacement(E, 'jardinieres', [[-5.7, 3.2], [5.7, 3.2], [-5.9, -2], [5.9, -2]].map(([x, z]) => [x, 0, z, 0]));
  lampe(E, 0, 2.6, -2.6); lampe(E, 0, .7, 2.35); lampe(E, 2, 2.6, -1.6);
  E.vues = {
    maquette: { pos: [10, 12, 12.5], cible: [0, 1, .3], fov: 40 },
    oeil: { pos: [1.9, 1.6, 3.6], cible: [-.4, 1.9, -2.2], fov: 64 },
    bulle: { pos: [-9.5, 3.4, 9.5], cible: [0, 2.2, 0], fov: 42 },
    explore: { cible: [0, 1.5, 0], depart: [2.0, 1.7, 3.7], dist: [2.5, 22], polar: [.08, .49] }
  };
  return E;
}

/* =================================================================
   06. Le jardin : fontaine de 7 m, chambres bulle, Discobole
   ================================================================= */
function espaceJardin() {
  const E = nouvelEspace('jardin', 21.5, 6.5);
  E.bornes = { x0: -7.5, x1: 7.5, z0: -8, z1: 8, h: 6, dehors: true };
  socle(E, 15, 16, .2);
  const g = E.g;
  sol(E, 15, 16, 'pelouse', 4, 4.3);
  // allées en croix et anneau autour de la fontaine
  const pierre = M('pierre');
  [[0, -5.9, 2.2, 4.2], [0, 5.9, 2.2, 4.2], [-5.6, 0, 3.8, 2.2], [5.6, 0, 3.8, 2.2]].forEach(([x, z, w, d]) => { const p = mesh(uvEchelle(new THREE.PlaneGeometry(w, d), w / 3, d / 3), pierre, false); p.rotation.x = -Math.PI / 2; p.position.set(x, .006, z); g.add(p); });
  const an = mesh(uvEchelle(new THREE.RingGeometry(3.55, 5.3, 64, 1), 3, 3), pierre, false); an.rotation.x = -Math.PI / 2; an.position.y = .005; g.add(an);
  // haies basses et arbres
  [[0, -7.75, 15, .5], [0, 7.75, 15, .5], [-7.25, 0, .5, 16], [7.25, 0, .5, 16]].forEach(([x, z, w, d], i) => bloc(g, w - (i < 2 ? 0 : .6), .7, d - (i < 2 ? 0 : .6), M('plante:#4E6B3F'), x, 0, z, .2));
  [[-6.2, 1.8], [6.2, 1.8], [-2.6, -6.8], [2.6, -6.8], [-6.3, 6.6], [6.3, -2.2]].forEach(([x, z]) => plante(g, x, z, 2.4 + (x > 0 ? .3 : 0), 'olivier'));
  // lits dans les chambres bulle
  [[-4.9, -5.2], [4.9, -5.2]].forEach(([x, z]) => {
    bloc(g, 1.6, .32, 2, M('drap'), x, 0, z - .1, .08);
    bloc(g, 1.7, .9, .12, M('boucle:#E4DACB'), x, 0, z - 1.1, .05);
    [-.4, .4].forEach(dx => bloc(g, .6, .14, .36, M('drap'), x + dx, .32, z - .8, .06).rotation.x = -.3);
    halo(g, 3, x, 1.1, z);
  });
  emplacement(E, 'fontaine', [[0, 0, 0, 0]], { ancre: 'haut' });
  emplacement(E, 'bulles', [[-4.9, 0, -5.2, .35], [4.9, 0, -5.2, -.35]], { ancre: 'haut' });
  emplacement(E, 'sculpture', [[0, 0, -6.55, 0]]);
  emplacement(E, 'meridiennes', [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([sx, sz]) => { const x = sx * 3.2, z = sz * 3.2; return [x, 0, z, cap(x, z, 0, 0)]; }));
  emplacement(E, 'salon', [[-5.1, 0, 5.1, Math.PI / 2 + .3]]);
  emplacement(E, 'balancelles', [[5.2, 0, 5.3, Math.PI / 2]]);
  lampe(E, 0, 1.2, 0); lampe(E, -4.9, 1.2, -5.2); lampe(E, 4.9, 1.2, -5.2);
  E.vues = {
    maquette: { pos: [13, 15, 16], cible: [0, 0, .4], fov: 40 },
    oeil: { pos: [2.8, 1.6, 8.6], cible: [0, 2, 0], fov: 60 },
    fontaine: { pos: [-7.5, 5.2, 8.5], cible: [0, 1.4, 0], fov: 42 },
    sculpture: { pos: [2.6, 1.8, -1.6], cible: [0, 1.9, -6.5], fov: 50 },
    bulle: { pos: [-1.8, 1.7, -.6], cible: [-4.9, 1.2, -5.2], fov: 52 },
    explore: { cible: [0, 1.2, 0], depart: [3, 2.2, 9.5], dist: [3, 28], polar: [.08, .49] }
  };
  return E;
}

const CONSTRUCTEURS = { deluxe: espaceDeluxe, junior: espaceJunior, presidentielle: espacePresidentielle, lobby: espaceLobby, bar: espaceBar, jardin: espaceJardin };
