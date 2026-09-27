/* =================================================================
   Visite 3D — maquettes génériques du catalogue complet
   Chaque pièce de la boutique est modélisée grossièrement d'après sa
   famille, son style, ses dimensions (m), ses couleurs et sa matière,
   déduits de sa fiche Shopify (outils/catalogue.py).
   Mêmes conventions que les maquettes détaillées : origine au sol,
   centrée, face avant vers +z ; appliques : origine au mur ;
   suspensions : origine au plafond.
   ================================================================= */

/* ---------- matières et couleurs ---------- */
const TEINTE_DEF = { velours: '#B9A68A', cuir: '#8B5A34', boucle: '#E9E1D1', tissu: '#CFC6B6', fourrure: '#EFEAE0', corde: '#C8B89A', laque: '#E8E3DA', bois: '#CFC6B6' };
const coul = (p, i = 0) => (p.cols && p.cols[i]) || (i ? null : TEINTE_DEF[p.mat] || '#CFC6B6');
// assombrit (k < 1) ou éclaircit (k > 1) une couleur
function teinte(hex, k) {
  const c = new THREE.Color(hex);
  if (k > 1) c.lerp(new THREE.Color('#FFFFFF'), Math.min(1, k - 1)); else c.multiplyScalar(k);
  return '#' + c.getHexString();
}
function mTissu(p, i = 0) {
  const c = coul(p, i) || coul(p, 0);
  switch (p.mat) {
    case 'velours': return M('velours:' + c);
    case 'cuir': return M('cuir:' + c);
    case 'boucle': case 'fourrure': return M('boucle:' + c);
    case 'laque': return M('laque:' + c);
    case 'corde': return p.cols && p.cols[i] ? M('tissu:' + c) : M('corde');
    default: return M('tissu:' + c);
  }
}
const mAccent = p => (p.cols && p.cols[1] ? mTissu(p, 1) : mTissu(p, 0));
const mMetal = p => M(p.metal === 'laiton' ? 'laiton' : p.metal === 'chrome' ? 'chrome' : 'noir');
const mBois = p => (p.bois === 'chene' ? M('chene') : p.bois === 'teck' ? M('bois:#9C6B42') : M('noyer'));
// verre des luminaires
function mVerre(p) {
  switch (p.verre) {
    case 'fume': return M('fume');
    case 'ambre': return M('ambre');
    case 'cristal': return M('cristal');
    case 'clair': return M('cristal');
    default: return M('opale:' + (p.mat === 'albatre' ? '#FFD8A8' : '#FFE3BC'));
  }
}
const aTitre = (p, re) => re.test((p.titre || '').toLowerCase());

// boîte des éléments opaques d'un groupe (pour cadrer ou ajuster l'échelle)
function boiteOpaque(g) {
  const b = new THREE.Box3();
  g.updateMatrixWorld(true);
  g.traverse(o => { if (o.isMesh && !o.material.transparent && !(o.material.userData && o.material.userData.halo)) b.expandByObject(o); });
  if (b.isEmpty()) g.traverse(o => { if (o.isMesh) b.expandByObject(o); });
  return b;
}
// ramène un modèle à la largeur voulue (et sous une hauteur maximale)
function ajuster(g, largeur, hMax) {
  const b = boiteOpaque(g), s = b.getSize(V3());
  let k = largeur / Math.max(.05, s.x, s.z);
  if (hMax && s.y * k > hMax) k = hMax / s.y;
  k = clamp(k, .2, 3);
  const porteur = groupe(g.name);
  g.scale.setScalar(k);
  porteur.add(g);
  return porteur;
}

/* =================================================================
   LITS
   ================================================================= */
function litCat(p, o = {}) {
  const g = groupe('lit');
  const [Wt, Lt, Ht0] = p.dim, st = p.st, ch = p.chevets;
  const cw = p.couchage ? p.couchage[0] : clamp(ch ? Wt - 1.05 : Wt - .28, 1.4, 2.0);
  const W = cw + .08, L = clamp(p.couchage ? p.couchage[1] + .12 : Lt - .1, 2.0, 2.3);
  const Ht = clamp(Ht0, .85, 1.6), zt = -L / 2;
  const c0 = coul(p, 0), mT = mTissu(p, 0), mA = mAccent(p);
  const accent = o.accent === undefined ? '#B4532F' : o.accent;
  if (st === 'rond') return litRond(g, p, Wt, Ht, mT, mA, accent);
  const Wh = ch ? Math.max(Wt, W + .9) : clamp(Wt, W + .1, W + .5);
  const dos = (e = .12, r = .05, h = Ht) => bloc(g, Wh, h - .04, e, mT, 0, .04, zt - e / 2 - .01, r);
  switch (st) {
    case 'capitonne': case 'chesterfield': {
      dos(.13, .06);
      const bt = [], pas = .19;
      for (let r0 = 0, y = .42; y < Ht - .1; r0++, y += pas * .78) for (let x = -Wh / 2 + .12 + (r0 % 2) * pas / 2; x < Wh / 2 - .08; x += pas) bt.push([x, y, zt + .002, 0, 0, 0, 1]);
      instances(g, new THREE.SphereGeometry(.017, 8, 6), M('tissu:' + teinte(c0, .5)), bt);
      if (st === 'chesterfield') [-1, 1].forEach(k => { const a = bloc(g, .2, Ht - .14, .5, mT, k * (Wh / 2 + .06), .06, zt + .14, .08); a.rotation.y = k * .35; });
      break;
    }
    case 'matelasse': {
      dos(.1, .03);
      const q = [], pas = clamp(Ht / 5, .2, .3);
      for (let x = -Wh / 2 + pas / 2 + .02; x < Wh / 2 - .02; x += pas) for (let y = .2 + pas / 2; y < Ht - .03; y += pas) q.push([x, y - pas / 2, zt + .01, 0, 0, 0, 1]);
      instances(g, new RoundedBoxGeometry(pas - .02, pas - .02, .07, 2, .025), mT, q, true);
      break;
    }
    case 'cannele': {
      dos(.08, .03);
      const fl = []; for (let x = -Wh / 2 + .05; x <= Wh / 2 - .04; x += .08) fl.push([x, .3 + (Ht - .4) / 2, zt + .01, 0, 0, 0, 1]);
      instances(g, new THREE.CapsuleGeometry(.038, Ht - .48, 4, 10), mT, fl, true);
      break;
    }
    case 'galbe': {
      const Rr = Wh * .95, a = Math.asin(Math.min(.98, (Wh / 2) / Rr)), cz = zt + Rr - .02;
      const arc = couronne(g, Rr, Rr + .13, Math.PI / 2 - a, Math.PI / 2 + a, Ht, mT, 0, .06);
      arc.position.z = cz;
      for (let i = -6; i <= 6; i++) { const aa = Math.PI / 2 + i / 6 * a * .92; bloc(g, .006, Ht - .25, .01, M('tissu:' + teinte(c0, .7)), Math.cos(aa) * (Rr - .01), .15, cz - Math.sin(aa) * (Rr - .01), 0, aa - Math.PI / 2); }
      break;
    }
    case 'ailes': {
      dos(.12, .05);
      const fl = []; for (let x = -Wh / 2 + .05; x <= Wh / 2 - .04; x += .09) fl.push([x, .25 + (Ht - .3) / 2, zt + .015, 0, 0, 0, 1]);
      instances(g, new THREE.CapsuleGeometry(.04, Ht - .42, 4, 10), mT, fl, true);
      [-1, 1].forEach(k => { const a = bloc(g, .14, Ht * .9, .55, mT, k * (Wh / 2 + .05), .06, zt + .2, .06); a.rotation.y = k * .25; });
      break;
    }
    case 'nuage': {
      const sh = new THREE.Shape(), n = 60, asym = aTitre(p, /asym|arche/);
      sh.moveTo(-Wh / 2, 0); sh.lineTo(Wh / 2, 0);
      for (let i = 0; i <= n; i++) {
        const u = i / n, x = Wh / 2 - u * Wh;
        const base = asym ? Ht * (.55 + .45 * Math.sin(Math.min(1, u * 1.25) * Math.PI / 2)) : Ht * (.8 + .2 * Math.sin(u * Math.PI));
        sh.lineTo(x, base - .07 + .07 * Math.abs(Math.sin(u * Math.PI * (asym ? 2 : 3))));
      }
      sh.closePath();
      const t = extrude(g, sh, .1, mT, .05); t.position.z = zt - .14;
      break;
    }
    case 'tubes': {
      const n = Math.round((Wh + .1) / .2);
      for (let i = 0; i < n; i++) capsule(g, .095, Ht - .5, mT, -((n - 1) * .2) / 2 + i * .2, Ht / 2 + .05, zt - .03);
      capsule(g, .11, L - .12, mT, -(W / 2 + .09), .34, 0, Math.PI / 2);
      capsule(g, .11, L - .12, mT, W / 2 + .09, .34, 0, Math.PI / 2);
      break;
    }
    case 'bois': {
      bloc(g, Wh, Ht - .04, .06, mBois(p), 0, .04, zt - .04, .01);
      const l = []; for (let x = -Wh / 2 + .04; x < Wh / 2; x += .07) l.push([x, (Ht + .04) / 2, zt + .005, 0, 0, 0, 1]);
      instances(g, new THREE.BoxGeometry(.035, Ht - .12, .02), M('bois:' + teinte('#5E3F2B', .8)), l);
      bloc(g, W - .1, Ht * .55, .08, mT, 0, .45, zt + .04, .03);
      break;
    }
    default:
      dos(.1, .04);
      bloc(g, Wh - .14, Ht * .62, .04, mA, 0, Ht * .3, zt + .01, .015);
  }
  // chevets intégrés
  if (ch) {
    const mc = p.bois ? mBois(p) : M('laque:' + (p.cols && p.cols[1] ? p.cols[1] : '#D9CCB6'));
    [-1, 1].forEach(k => {
      const x = k * (W / 2 + .06 + .26);
      bloc(g, .48, .2, .4, mc, x, .3, zt + .21, .02);
      sphere(g, .05, M('opale'), x + k * .1, .58, zt + .18);
      cyl(g, .006, .006, .08, M('laiton'), x + k * .1, .5, zt + .18, 6);
    });
  }
  // sommier et pieds
  const yb = .1;
  bloc(g, W + .08, .28, L, mT, 0, yb, 0, .06);
  const mp = p.bois ? mBois(p) : mMetal(p);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => cyl(g, .018, .018, yb + .01, mp, a * (W / 2 - .06), 0, b * (L / 2 - .08), 8));
  literie(g, W, L, yb + .28, accent);
  if (p.led) {
    const led = bloc(g, W - .1, .012, L - .12, M('led'), 0, yb - .02, 0);
    led.castShadow = false;
    const hl = new THREE.Mesh(new THREE.PlaneGeometry(W + .9, L + .9), M('halo'));
    hl.rotation.x = -Math.PI / 2; hl.position.y = .006; hl.userData.nonCuit = true; g.add(hl);
  }
  ombreSol(g, Wh + .7, L + .5, 0, 0);
  return g;
}
function litRond(g, p, Wt, Ht, mT, mA, accent) {
  const Rr = clamp(Wt / 2, .95, 1.3);
  cyl(g, Rr, Rr, .3, mT, 0, .06, 0, 48);
  cyl(g, Rr - .07, Rr - .07, .22, M('drap'), 0, .36, 0, 48);
  cyl(g, Rr - .02, Rr - .02, .06, M('tissu:#EFEBE3'), 0, .56, Rr * .25, 48).scale.set(1, 1, .75);
  const tete = couronne(g, Rr + .02, Rr + .16, Math.PI / 2 - 1.05, Math.PI / 2 + 1.05, Ht, mT, 0, .05);
  tete.position.z = 0;
  [-1, 1].forEach(k => { const a = sphere(g, .55, mA, k * Rr * .72, Ht * .55, -Rr * .55, .9, 1, .14, 24); a.rotation.y = k * .7; });
  [-.3, .3].forEach(x => { const o = bloc(g, .55, .16, .36, M('drap'), x, .58, -Rr * .55, .07); o.rotation.x = -.35; });
  if (accent) [-.25, .25].forEach(x => { const c = bloc(g, .42, .4, .12, M('velours:' + accent), x, .6, -Rr * .38, .05); c.rotation.x = -.42; });
  cyl(g, Rr * .9, Rr * .9, .06, M('noir'), 0, 0, 0, 40);
  ombreSol(g, Rr * 2.6, Rr * 2.6);
  return g;
}

/* =================================================================
   FAUTEUILS
   ================================================================= */
function piedsCat(g, type, l, pr, hp, mp) {
  const x = l / 2 - .07, z = pr / 2 - .07, coins = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  if (type === 'metal' || type === 'bois') coins.forEach(([a, b]) => cyl(g, .01, .018, hp, mp, a * x, 0, b * z, 8));
  else if (type === 'boule') coins.forEach(([a, b]) => sphere(g, .035, mp, a * x, .035, b * z, 1, 1, 1, 12));
  else if (type === 'etoile') {
    for (let i = 0; i < 4; i++) { const b = bloc(g, Math.min(l, pr) * .8, .03, .05, mp, 0, 0, 0, .01); b.rotation.y = i * Math.PI / 4 + Math.PI / 8; }
    cyl(g, .04, .05, hp, mp, 0, .02, 0, 12);
  } else if (type === 'disque') {
    cyl(g, Math.min(l, pr) * .34, Math.min(l, pr) * .36, .03, mp, 0, 0, 0, 32);
    cyl(g, .045, .045, hp, mp, 0, .02, 0, 12);
  } else if (type === 'luge') {
    [-1, 1].forEach(k => tube(g, [[k * x, .02, z + .03], [k * x, .02, -z], [k * x, hp + .06, -z - .02]], .016, mp, false, 16, 6));
  } else if (type === 'bascule') {
    [-1, 1].forEach(k => {
      const pts = []; for (let i = 0; i <= 16; i++) { const u = i / 16 - .5; pts.push([k * x, .03 + u * u * .5, u * (pr + .25)]); }
      tube(g, pts, .022, mp, false, 24, 6);
      [-.25, .25].forEach(dz => cyl(g, .018, .018, hp, mp, k * x, .05, dz * pr, 6));
    });
  } else if (type === 'croix') {
    [-1, 1].forEach(k => { const b = bloc(g, .04, .04, Math.hypot(l, pr) * .75, mp, 0, hp * .5, 0, .01); b.rotation.set(0, k * Math.atan2(l, pr), 0); });
    coins.forEach(([a, b]) => cyl(g, .018, .018, hp, mp, a * x * .9, 0, b * z * .9, 6));
  }
}
// fauteuil « boîte » : caisse, coussins, dossier, accoudoirs
function fauteuilBoite(g, p, l, pr, h, sh, o) {
  const m = mTissu(p, 0), m2 = o.m2 || mAccent(p);
  const bw = o.bras === 'aucun' ? 0 : o.bras === 'fin' ? .08 : clamp(l * .16, .1, .19);
  const hp = o.pieds === 'plein' ? 0 : o.pieds === 'boule' ? .07 : o.pieds === 'bascule' ? .16 : o.hp || .14;
  const e = clamp(pr * .2, .13, .2), zd = -pr / 2 + e / 2;
  const caisse = o.caisse === false ? null : bloc(g, l, Math.max(.06, sh - hp - .13), pr, o.mc || m, 0, hp, 0, .05);
  bloc(g, l - 2 * bw - .02, .14, pr - e - .02, m2, 0, sh - .14, e / 2, .06);
  const hd = Math.max(.25, h - sh + .12);
  const d = bloc(g, l - .02, hd, e, m, 0, sh - .12, zd, .07);
  d.rotation.x = o.incline != null ? o.incline : -.12;
  if (o.coussinDos) { const c = bloc(g, l - 2 * bw - .1, hd * .6, .12, m2, 0, sh + .02, zd + e / 2 + .04, .05); c.rotation.x = -.18; }
  if (bw) [-1, 1].forEach(k => {
    if (o.bras === 'rond') capsule(g, bw * .5, pr - .22, m, k * (l / 2 - bw / 2), sh + .1, .03, Math.PI / 2);
    else if (o.bras === 'bois') { bloc(g, bw * .7, .04, pr - .04, mBois(p), k * (l / 2 - bw / 2), sh + .12, .01, .01); bloc(g, .04, sh + .12 - hp, .04, mBois(p), k * (l / 2 - bw / 2), hp, pr / 2 - .08); }
    else bloc(g, bw, (o.bras === 'fin' ? .14 : .24), pr - .03, m, k * (l / 2 - bw / 2), sh - .14, .015, .05);
  });
  if (o.ailes) [-1, 1].forEach(k => { const w = bloc(g, .12, hd * .58, pr * .42, m, k * (l / 2 - .05), sh - .12 + hd * .42, zd + pr * .17, .05); w.rotation.y = k * .22; });
  if (o.boutons) {
    const bt = [];
    for (let r0 = 0; r0 < 4; r0++) for (let x = -l / 2 + .16 + (r0 % 2) * .08; x <= l / 2 - .14; x += .16) bt.push([x, sh + .1 + r0 * (hd - .2) / 4, zd + e / 2 + .005, 0, 0, 0, 1]);
    const bb = instances(g, new THREE.SphereGeometry(.014, 8, 6), M('tissu:' + teinte(coul(p, 0), .5)), bt);
    bb.rotation.x = -.12 * .5;
  }
  piedsCat(g, o.pieds, l, pr, hp, o.mp || mMetal(p));
  return caisse;
}
function fauteuilCat(p) {
  const g = groupe('fauteuil');
  const l = clamp(p.dim[0], .45, 1.7), pr = clamp(p.dim[1], .4, 1.5), h = clamp(p.dim[2], .4, 2.1);
  const m = mTissu(p, 0), m2 = mAccent(p), met = mMetal(p);
  const sh = clamp(h * .5, .34, .46), st = p.st, R = Math.min(l, pr) / 2;
  const sansPied = aTitre(p, /sans pi[eè]tement|pi[eè]tement plein|directement au sol/);
  const piedBois = !!p.bois || aTitre(p, /bois/);
  const sx = l / Math.min(l, pr), sz = pr / Math.min(l, pr);
  const rond = () => { const s = groupe(); s.scale.set(sx, 1, sz); g.add(s); return s; };
  switch (st) {
    case 'club':
      fauteuilBoite(g, p, l, pr, Math.min(h, .85), sh, { bras: 'rond', pieds: 'boule', mp: M('laiton'), boutons: aTitre(p, /chester|capiton/), incline: -.08 });
      break;
    case 'bergere':
      fauteuilBoite(g, p, l, pr, h, sh, { bras: 'fin', pieds: piedBois ? 'bois' : 'metal', mp: piedBois ? mBois(p) : M('or'), hp: .18, boutons: true, incline: -.05 });
      break;
    case 'haut':
      fauteuilBoite(g, p, l, pr, h, sh, { bras: 'bloc', pieds: sansPied ? 'plein' : 'metal', ailes: true, boutons: aTitre(p, /capiton/), incline: -.06 });
      break;
    case 'bois':
      fauteuilBoite(g, p, l, pr, h, sh, { bras: 'bois', pieds: 'bois', mp: mBois(p), caisse: false, coussinDos: true, incline: -.2, hp: sh - .14 });
      bloc(g, l - .04, .05, pr - .06, mBois(p), 0, sh - .19, 0, .01);
      break;
    case 'tubulaire': case 'corde': {
      const mt = st === 'corde' && !p.cols.length ? M('corde') : m;
      const x = l / 2 - .04, z = pr / 2 - .05;
      [-1, 1].forEach(k => tube(g, [[k * x, 0, z], [k * x, sh + .16, z - .02], [k * x, sh + .18, -z + .1], [k * x, h, -z - .02], [k * x, 0, -z]], .02, met, false, 40, 8));
      bloc(g, l - .1, .12, pr - .12, mt, 0, sh - .12, .02, .05);
      const d = bloc(g, l - .1, h - sh - .02, .1, mt, 0, sh - .02, -pr / 2 + .08, .05); d.rotation.x = -.2;
      break;
    }
    case 'relax':
      fauteuilBoite(g, p, l, pr, h, sh, { bras: piedBois ? 'bois' : 'bloc', pieds: piedBois ? 'bois' : 'etoile', mp: piedBois ? mBois(p) : met, incline: -.32, caisse: !piedBois, coussinDos: true });
      bloc(g, l * .7, sh * .85, .48, m, 0, .06, pr / 2 + .38, .07);
      break;
    case 'bascule':
      fauteuilBoite(g, p, l, pr, h, sh, { bras: 'bois', pieds: 'bascule', mp: mBois(p), caisse: false, coussinDos: true, incline: -.25 });
      bloc(g, l - .06, .04, pr - .08, mBois(p), 0, sh - .18, 0, .01);
      break;
    case 'pivotant': {
      const s = rond(), r = R;
      coque(s, [[r * .78, sh - .04], [r * .98, sh], [r * 1.02, sh + (h - sh) * .45], [r * .92, h], [r * .82, h - .02], [r * .84, sh + .1]], m, .62);
      cyl(s, r * .86, r * .86, .14, m2, 0, sh - .14, 0, 32);
      cyl(s, r * .8, r * .75, .12, m, 0, sh - .26, 0, 32);
      piedsCat(g, aTitre(p, /base bois|bois/) ? 'disque' : 'etoile', l, pr, sh - .26, aTitre(p, /bois/) ? mBois(p) : met);
      break;
    }
    case 'coque': {
      const s = rond(), r = R;
      coque(s, [[r * .72, sh - .08], [r * .96, sh - .04], [r * 1.02, sh + (h - sh) * .5], [r * .95, h], [r * .86, h - .02], [r * .86, sh + .08]], m, .58);
      cyl(s, r * .85, r * .82, .12, m2, 0, sh - .14, 0, 32);
      piedsCat(g, 'metal', l * .8, pr * .8, sh - .12, met);
      break;
    }
    case 'cocon': case 'fourrure': {
      const s = rond(), r = R;
      coque(s, [[r * .6, 0], [r * .95, .04], [r * 1.02, sh], [r * .98, h * .82], [r * .88, h], [r * .78, h * .96], [r * .82, sh + .05]], m, st === 'fourrure' ? .5 : .46);
      cyl(s, r * .84, r * .9, sh - .02, m, 0, 0, 0, 32);
      cyl(s, r * .82, r * .82, .12, m2, 0, sh - .06, 0, 32);
      if (st === 'fourrure' || p.mat === 'fourrure') {
        const r2 = alea(p.id.length * 7), fl = [];
        for (let i = 0; i < 70; i++) { const a = Math.PI * .3 + r2() * Math.PI * 1.4, y = r2() * h; fl.push([Math.sin(a) * r * 1.02, y, Math.cos(a) * r * 1.02, r2(), r2(), r2(), .7 + r2() * .6]); }
        instances(s, new THREE.IcosahedronGeometry(.06, 0), m, fl);
      }
      if (!sansPied && aTitre(p, /pi[eè]tement/)) piedsCat(g, 'metal', l * .8, pr * .8, .05, met);
      break;
    }
    case 'petales': {
      const s = rond(), r = R;
      cyl(s, r * .82, r * .9, sh - .02, m2, 0, 0, 0, 32);
      cyl(s, r * .8, r * .8, .12, m2, 0, sh - .08, 0, 32);
      const n = 7;
      for (let i = 0; i < n; i++) {
        const a = Math.PI * .42 + i / (n - 1) * Math.PI * 1.16;
        const pe = sphere(s, 1, m, Math.sin(a) * r * .78, sh + (h - sh) * .42, Math.cos(a) * r * .78, r * .42, (h - sh) * .62 + .08, .09, 20);
        pe.rotation.y = a; pe.rotation.x = .12;
      }
      if (aTitre(p, /pivotant/)) piedsCat(g, 'disque', l, pr, .06, met);
      break;
    }
    case 'pouf': {
      if (aTitre(p, /torique|anneau|boa/)) {
        const t = tore(g, R * .66, R * .34, m, 0, R * .34, 0, Math.PI / 2, TAU, 40);
        t.scale.set(sx, sz, h / (R * .68));
      } else {
        sphere(g, 1, m, 0, h / 2, 0, l / 2, h / 2, pr / 2, 28);
        if (aTitre(p, /ours|bunny|lapin|rabbit/)) [-1, 1].forEach(k => sphere(g, 1, m, k * l * .22, h * .98, -pr * .1, l * .1, h * .22, pr * .06, 14));
      }
      break;
    }
    case 'sculptural': {
      bloc(g, l, sh - .12, pr, m, 0, 0, 0, .1);
      bloc(g, l * .78, .14, pr * .7, m2, 0, sh - .14, pr * .1, .07);
      const n = 3, r = R;
      for (let i = 0; i < n; i++) {
        const t = arcDos(g, r * (.95 - i * .08), clamp((h - sh) / 5, .07, .14), Math.PI * 1.25, m, sh + i * (h - sh) / (n + .3), -.02);
        t.scale.x = sx;
      }
      break;
    }
    case 'suspendu': {
      // pied en arc : il part de l'arrière du socle et passe derrière la nacelle
      const hb = Math.min(h, 2), yN = Math.max(.25, hb - 1.3);
      cyl(g, .34, .36, .04, met, 0, 0, 0, 32);
      tube(g, [[0, .03, -.3], [0, hb * .45, -.66], [0, hb - .12, -.42], [0, hb, .02]], .03, met, false, 30, 8);
      cyl(g, .006, .006, hb - yN - .86, met, 0, yN + .86, .05, 6);
      const s = groupe(); s.position.set(0, yN, .05); g.add(s);
      coque(s, [[.05, 0], [.3, .06], [.42, .3], [.4, .6], [.3, .78], [.1, .86]], m, .55);
      cyl(s, .3, .3, .1, m2, 0, .08, 0, 24);
      break;
    }
    default: {
      // lounge : caisse, accoudoirs pleins, piètement fin ou plein
      const pieds = sansPied ? 'plein' : aTitre(p, /4 branches|pivotant/) ? 'etoile' : aTitre(p, /croise/) ? 'croix' : piedBois ? 'bois' : 'metal';
      fauteuilBoite(g, p, l, pr, h, sh, { bras: aTitre(p, /sans accoudoirs/) ? 'aucun' : 'bloc', pieds, mp: piedBois ? mBois(p) : met, incline: -.14, boutons: aTitre(p, /capiton/) });
    }
  }
  ombreSol(g, l + .35, pr + .35);
  return g;
}

/* =================================================================
   CANAPÉS
   ================================================================= */
// une rangée d'assises : caisse, coussins, dossier, accoudoirs (bras : [gauche, droite])
function rangee(g, p, x, z, l, d, h, bras, o = {}) {
  const m = mTissu(p, 0), m2 = mAccent(p);
  const sh = o.sh || .42, hp = o.pieds ? .1 : 0, bw = .2, e = .22;
  const r = groupe(); r.position.set(x, 0, z); if (o.ry) r.rotation.y = o.ry; g.add(r);
  bloc(r, l, sh - hp - .12, d, m, 0, hp, 0, .06);
  const l0 = l - (bras[0] ? bw : 0) - (bras[1] ? bw : 0), x0 = -l / 2 + (bras[0] ? bw : 0);
  const n = Math.max(1, Math.round(l0 / .75)), lc = l0 / n;
  for (let i = 0; i < n; i++) bloc(r, lc - .02, .14, d - (o.dos === false ? .04 : e + .02), m2, x0 + lc * (i + .5), sh - .14, o.dos === false ? 0 : e / 2, .06);
  if (o.dos !== false) {
    bloc(r, l, h - sh + .12, e, m, 0, sh - .12, -d / 2 + e / 2, .08);
    for (let i = 0; i < n; i++) { const c = bloc(r, lc - .06, (h - sh) * .75, .14, m2, x0 + lc * (i + .5), sh - .02, -d / 2 + e + .06, .06); c.rotation.x = -.16; }
  }
  bras.forEach((b, i) => { if (b) bloc(r, bw, sh + .14 - hp, d, m, (i ? 1 : -1) * (l / 2 - bw / 2), hp, 0, .07); });
  if (o.pieds) [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => cyl(r, .015, .015, hp, o.pieds, a * (l / 2 - .08), 0, b * (d / 2 - .08), 8));
  return r;
}
function canapeCat(p) {
  const g = groupe('canape');
  const l = clamp(p.dim[0], 1.2, 5), pr = clamp(p.dim[1], .6, 3.4), h = clamp(p.dim[2], .35, 1.1);
  const m = mTissu(p, 0), m2 = mAccent(p);
  const pieds = aTitre(p, /pi[eè]tement|pieds/) ? mMetal(p) : null;
  const bas = h < .52;
  switch (p.st) {
    case 'cercle': {
      const Rr = clamp(l / 2, 1.3, 2.4);
      for (let i = 0; i < 4; i++) {
        const a0 = i * Math.PI / 2 + .1, a1 = (i + 1) * Math.PI / 2 - .1;
        couronne(g, Rr - .8, Rr - .02, a0, a1, .42, m, 0, .05);
        couronne(g, Rr - .26, Rr, a0, a1, h, m, 0, .06);
      }
      cyl(g, (Rr - .8) * .7, (Rr - .8) * .7, .36, M('travertin'), 0, 0, 0, 40);
      ombreSol(g, Rr * 2.4, Rr * 2.4);
      return g;
    }
    case 'courbe': {
      if (bas) { vagues(g, p, l, pr, h); break; }
      const Rr = l * .9, a = Math.asin(Math.min(.95, (l / 2) / Rr)), d = Math.min(pr, 1.05), cz = Rr + .02 - pr / 2;
      const assise = couronne(g, Rr - d, Rr, Math.PI / 2 - a, Math.PI / 2 + a, .42, m, 0, .05); assise.position.z = cz;
      const dos = couronne(g, Rr - .22, Rr + .02, Math.PI / 2 - a - .02, Math.PI / 2 + a + .02, h, m2, 0, .07); dos.position.z = cz;
      if (!aTitre(p, /asym|chaise longue/)) [-1, 1].forEach(k => { const b = bloc(g, .24, .6, d, m, k * Math.sin(a) * (Rr - d / 2), 0, cz - Math.cos(a) * (Rr - d / 2), .1); b.rotation.y = -k * a; });
      else { const c = bloc(g, .9, .42, Math.min(1.6, pr + .5), m, l / 2 - .5, 0, .2, .12); c.rotation.y = -.25; }
      break;
    }
    case 'modules': {
      if (bas) { vagues(g, p, l, pr, h); break; }
      const d = Math.min(pr, 1.0), n = Math.max(2, Math.round(l / .95)), lm = l / n, galets = aTitre(p, /galet|nuage|cloud/);
      for (let i = 0; i < n; i++) {
        const x = -l / 2 + lm * (i + .5);
        if (galets) { const t = tour(g, [[0, 0], [.42, 0], [.5, .08], [.5, .3], [.44, .4], [0, .41]], m, x, 0, -pr / 2 + d / 2, 32); t.scale.set(lm / 1.0, 1, d / 1.0); sphere(g, .26, m2, x, .62, -pr / 2 + .2, lm * 1.2, 1, .7, 20); }
        else rangee(g, p, x, -pr / 2 + d / 2, lm - .02, d, h, [i === 0, i === n - 1], { dos: true });
      }
      if (pr > 1.5) rangee(g, p, l / 2 - .5, -pr / 2 + d + (pr - d) / 2, .98, pr - d, h, [false, true], { dos: false });
      break;
    }
    case 'angle': {
      const d = Math.min(pr, 1.02);
      rangee(g, p, -.02 - (pr > 1.3 ? .48 : 0), -pr / 2 + d / 2, l - (pr > 1.3 ? .98 : 0), d, h, [true, pr <= 1.3], { pieds });
      if (pr > 1.3) {
        rangee(g, p, l / 2 - .49, -pr / 2 + d / 2, .98, d, h, [false, true], { pieds });
        rangee(g, p, l / 2 - .49, -pr / 2 + d + (pr - d) / 2, .98, pr - d, h, [false, true], { dos: false, pieds });
        if (aTitre(p, / en u/)) rangee(g, p, -l / 2 + .49, -pr / 2 + d + (pr - d) / 2, .98, pr - d, h, [true, false], { dos: false, pieds });
      }
      break;
    }
    default:
      if (bas) { vagues(g, p, l, pr, h); break; }
      rangee(g, p, 0, 0, l, Math.min(pr, 1.1), h, [true, true], { pieds });
  }
  ombreSol(g, l + .4, pr + .4);
  return g;
}
// canapé bas sans dossier : boudins arrondis côte à côte
function vagues(g, p, l, pr, h) {
  const n = Math.max(3, Math.round(l / .29)), w = l / n, m = mTissu(p, 0), m2 = mAccent(p);
  for (let i = 0; i < n; i++) capsule(g, Math.min(w * .5, h * .5), Math.max(.05, pr - h), i % 2 && p.cols.length > 1 ? m2 : m, -l / 2 + w * (i + .5), h / 2, 0, Math.PI / 2);
}

/* =================================================================
   LUMINAIRES
   ================================================================= */
// place le corps d'une suspension : descente du câble, hauteur disponible
function geometrieSuspension(p, o) {
  const hMax = o.hMax || 1.7;
  const hb = clamp(Math.min(p.dim[2], hMax - .25), .1, 2.4);
  const d = clamp(Math.min(o.h || .9, hMax - hb), .12, 3.5);
  return { hb, d, l: clamp(p.dim[0], .12, 3), pr: clamp(p.dim[1], .06, 3) };
}
function suspensionCat(p, o = {}) {
  const g = groupe('suspension');
  const { hb, d, l, pr } = geometrieSuspension(p, o);
  const met = mMetal(p), mv = mVerre(p), r = alea(p.id.length * 13 + 1);
  const yc = -d - hb / 2;
  const cables = (pts) => pts.forEach(([x, z, y0]) => cable(g, (y0 != null ? -y0 : d), met, x, z));
  rosace(g, .05, met);
  switch (p.st) {
    case 'cylindre': {
      if (l > .8 && pr < .5) {           // arche horizontale en tissu plissé
        cables([[-l * .28, 0], [l * .28, 0]]);
        const a = place(g, mesh(new THREE.CylinderGeometry(pr * .7, pr * .7, l, 32, 1, true, 0, Math.PI), M('fibres')), 0, -d - .04, 0, 0, 0, Math.PI / 2);
        a.rotation.set(0, 0, Math.PI / 2); a.material.side = THREE.DoubleSide;
        bloc(g, l - .04, .025, .05, met, 0, -d - .06, 0, .01);
      } else {
        cables([[0, 0]]);
        const rr = l / 2, mt = p.mat === 'tissu' ? M('soie:' + coul(p, 0)) : mv;
        const c = cyl(g, rr, rr, hb, mt, 0, -d - hb, 0, 32, true); c.material.side = THREE.DoubleSide;
        tore(g, rr, .007, met, 0, -d, 0); tore(g, rr, .007, met, 0, -d - hb, 0);
        sphere(g, .04, M('opale'), 0, -d - hb * .8, 0);
      }
      break;
    }
    case 'empile': {
      if (l > .5) {                      // trois diffuseurs sur une armature
        cables([[0, 0]]);
        [[0, -.05], [2.1, -.18], [4.2, -.3]].forEach(([a, dy]) => {
          const x = Math.cos(a) * l * .28, z = Math.sin(a) * pr * .28;
          tube(g, [[0, -d + .05, 0], [x * .6, -d - .05, z * .6], [x, -d + dy - hb * .3, z]], .006, met, false, 8, 5);
          cyl(g, .17, .17, .012, mv, x, -d + dy - hb * .3 - .06, z, 32);
        });
      } else {
        cables([[0, 0]]);
        for (let i = 0; i < 3; i++) sphere(g, l / 2, mv, 0, -d - l * .3 - i * hb / 3, 0, 1, .55, 1, 24);
      }
      break;
    }
    case 'grappe': {
      cables([[0, 0]]);
      if (p.metal !== 'noir' || aTitre(p, /armature|structure/)) sphere(g, .05, met, 0, yc + hb * .4, 0);
      const n = clamp(Math.round(l * 30), 10, 40), rr = l / 2;
      const liste = [];
      for (let i = 0; i < n; i++) { const a = r() * TAU, k = Math.sqrt(r()) * rr * .85; liste.push([Math.cos(a) * k, yc + (r() - .5) * hb * .8, Math.sin(a) * k * (pr / l), 0, 0, 0, .7 + r() * .5]); }
      instances(g, new THREE.SphereGeometry(clamp(l * .09, .04, .09), 14, 10), mv, liste);
      if (aTitre(p, /petales|nuage/)) instances(g, new THREE.SphereGeometry(.09, 10, 6), M('fume'), liste.slice(0, 10).map(t => [t[0], t[1] + .03, t[2], r() * 3, 0, r() * 3, 1, 1, .2, 1]));
      break;
    }
    case 'cristal': {
      cables([[0, 0]]);
      const feuilles = aTitre(p, /feuille|lotus|corail/), n = feuilles ? 26 : 60, liste = [];
      for (let i = 0; i < n; i++) {
        const u = i / n, a = u * TAU * (feuilles ? 2.2 : 4), rr = (l / 2) * (feuilles ? .5 + r() * .5 : 1 - u * .7);
        liste.push([Math.cos(a) * rr, -d - u * hb, Math.sin(a) * rr * (pr / l), r() * .6, a, r() * .6, 1]);
      }
      if (feuilles) instances(g, new THREE.SphereGeometry(.09, 10, 6), p.metal === 'laiton' ? M('laiton') : mv, liste.map(t => t.concat([1, 1.4, .25])));
      else instances(g, new THREE.CylinderGeometry(.012, .012, .14, 6), M('cristal'), liste);
      sphere(g, .05, M('opale'), 0, yc, 0);
      break;
    }
    case 'sputnik': {
      cables([[0, 0]]);
      sphere(g, .06, met, 0, yc, 0);
      const n = 18, liste = [], bouts = [];
      for (let i = 0; i < n; i++) {
        const v = V3(r() - .5, (r() - .5) * .8, r() - .5).normalize(), L = l / 2 * (.7 + r() * .3);
        const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), v), e = new THREE.Euler().setFromQuaternion(q);
        liste.push([v.x * L / 2, yc + v.y * L / 2, v.z * L / 2, e.x, e.y, e.z, 1, 1, L / .1, 1]);
        bouts.push([v.x * L, yc + v.y * L, v.z * L, 0, 0, 0, 1]);
      }
      instances(g, new THREE.CylinderGeometry(.005, .005, .1, 5), met, liste);
      instances(g, aTitre(p, /cylindre/) ? new THREE.CylinderGeometry(.025, .025, .09, 10) : new THREE.SphereGeometry(.035, 10, 8), aTitre(p, /multicolore/) ? M('laque:#D9543E') : M('opale'), bouts);
      break;
    }
    case 'anneau': {
      const vertical = pr < l * .5;
      if (vertical) {                     // anneaux vus de face
        cables([[-l * .3, 0], [l * .3, 0]]);
        const n = aTitre(p, /double/) ? 2 : 1;
        for (let i = 0; i < n; i++) { const t = tore(g, l / 2 - i * .12, .015, met, i * .1, yc, 0, 0); t.rotation.set(0, 0, 0); }
        if (aTitre(p, /globe|sph[eè]re|perles|beads/)) for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * .45; sphere(g, .07, mv, Math.cos(a) * l * .45, yc + Math.sin(a) * l * .45, 0); }
        else tore(g, l / 2, .01, M('led:#FFE1B0'), 0, yc, .012, 0);
      } else {                            // anneaux horizontaux superposés
        cables([[0, 0]]);
        const n = aTitre(p, /superpos|layers/) ? 3 : aTitre(p, /double/) ? 2 : 1;
        for (let i = 0; i < n; i++) { const rr = l / 2 * (1 - i * .18), y = -d - i * hb / Math.max(1, n); tore(g, rr, .02, met, 0, y, 0); tore(g, rr, .01, M('led:#FFE1B0'), 0, y - .018, 0); [0, 2.1, 4.2].forEach(a => cable(g, d + i * hb / Math.max(1, n), met, Math.cos(a) * rr, Math.sin(a) * rr)); }
        if (aTitre(p, /globe|sph[eè]re|perles|beads|cluster/)) for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; sphere(g, .06, mv, Math.cos(a) * l * .3, -d - hb * .6 - (i % 3) * .06, Math.sin(a) * l * .3); }
        if (aTitre(p, /disque/)) cyl(g, l * .3, l * .3, .02, M('opale'), 0, -d - .02, 0, 32);
      }
      break;
    }
    case 'lineaire': {
      cables([[-l * .4, 0], [l * .4, 0]]);
      if (aTitre(p, /ruban|ribbon/)) {
        const pts = []; for (let i = 0; i <= 40; i++) { const u = i / 40 - .5; pts.push([u * l, yc + Math.sin(u * TAU * 1.5) * hb * .35, Math.cos(u * TAU) * pr * .3]); }
        tube(g, pts, .02, p.mat === 'acrylique' ? M('opale') : met, false, 80, 6);
        tube(g, pts.map(q => [q[0], q[1] - .03, q[2]]), .012, M('led:#FFE9C8'), false, 80, 5);
      } else if (aTitre(p, /etag[eè]re|shelf/)) {
        bloc(g, l, .03, pr, M('laque:' + coul(p, 0)), 0, -d - .03, 0, .01);
        bloc(g, l - .04, .008, pr - .04, M('led:#FFE9C8'), 0, -d - .04, 0);
      } else {
        bloc(g, l, .02, .03, met, 0, -d, 0);
        const n = Math.max(3, Math.round(l / .16)), liste = [];
        for (let i = 0; i < n; i++) liste.push([-l / 2 + l * (i + .5) / n, -d - .05 - r() * hb * .8, (r() - .5) * pr * .6, 0, 0, 0, .8 + r() * .5]);
        const cylindres = aTitre(p, /cylindr|modules/);
        instances(g, cylindres ? new THREE.CylinderGeometry(.03, .03, .12, 12) : new THREE.SphereGeometry(.05, 12, 8), cylindres ? M('laiton') : mv, liste);
        if (aTitre(p, /crois|lignes/)) { const b = bloc(g, l * .8, .015, .02, met, 0, -d - hb * .5, 0); b.rotation.y = .5; }
      }
      break;
    }
    case 'tresse': {
      cables([[0, 0]]);
      if (aTitre(p, /tubes/) && !aTitre(p, /spheri/)) {
        const n = 14, liste = [];
        for (let i = 0; i < n; i++) { const a = r() * TAU, k = r() * l / 2; liste.push([Math.cos(a) * k, -d - hb * (.2 + r() * .6), Math.sin(a) * k * (pr / l), 0, 0, 0, 1, 1, .8 + r() * 1.2, 1]); }
        instances(g, new THREE.CylinderGeometry(.02, .02, .3, 10), aTitre(p, /laiton|dor/) ? M('laiton') : M('opale'), liste);
        if (aTitre(p, /rouge/)) tube(g, liste.slice(0, 8).map(t => [t[0], t[1] + .1, t[2]]), .006, M('laque:#B8262B'), false, 40, 5);
      } else {
        const k = new THREE.TorusKnotGeometry(l * .32, .018, 120, 8, 3, 5);
        const t = place(g, mesh(k, M('led:#FFDDB0')), 0, yc, 0);
        t.scale.set(1, hb / (l * .8), 1);
        if (aTitre(p, /spheres|trois/)) { const t2 = place(g, mesh(new THREE.TorusKnotGeometry(l * .2, .014, 90, 6, 2, 3), M('led:#FFDDB0')), l * .3, yc - hb * .4, 0); t2.rotation.y = .6; }
      }
      break;
    }
    default: {                          // globe(s)
      if (l > .8 && pr < .6) {            // arc de globes
        cables([[-l * .4, 0], [l * .4, 0]]);
        const pts = []; for (let i = 0; i <= 20; i++) { const u = i / 20 - .5; pts.push([u * l, -d - Math.cos(u * Math.PI) * hb * .5, 0]); }
        tube(g, pts, .012, met, false, 40, 6);
        [-.3, 0, .3].forEach(u => sphere(g, .09, mv, u * l, -d - Math.cos(u * Math.PI) * hb * .5 - .08, 0));
      } else {
        cables([[0, 0]]);
        sphere(g, Math.min(l, hb) / 2, mv, 0, yc, 0, 1, 1, pr / l, 28);
      }
    }
  }
  halo(g, clamp(l * 1.8, .9, 3), 0, yc, 0);
  return g;
}
function lustreCat(p, o = {}) {
  const hMax = o.hMax || 2.2, l = clamp(p.dim[0], .4, 3.2);
  if (p.st === 'cascade') {
    const g = groupe('lustre');
    const pr = clamp(p.dim[1], .3, 2), hb = clamp(Math.min(p.dim[2], hMax - .1), .3, 2), d = Math.min(o.h || .2, .3);
    bloc(g, l, .04, pr, mMetal(p), 0, -.04 - d, 0, .01);
    if (d > .02) [[-1, -1], [1, 1]].forEach(([a, b]) => cable(g, d, mMetal(p), a * l * .4, b * pr * .4));
    const liste = [], r = alea(5);
    for (let x = -l / 2 + .04; x < l / 2; x += .06) for (let z = -pr / 2 + .04; z < pr / 2; z += .08) liste.push([x, -d - .04 - hb * (.5 + r() * .45) / 2, z, 0, 0, 0, 1, 1, hb * (.5 + r() * .45) / .2, 1]);
    instances(g, new THREE.CylinderGeometry(.008, .008, .2, 6), M('cristal'), liste);
    halo(g, l * 1.8, 0, -d - hb / 2, 0);
    return g;
  }
  const style = { matrice: 'matrice', floral: 'floral', infini: 'infini', spirale: 'spirale', ondes: 'ondes' }[p.st];
  if (!style) return suspensionCat(Object.assign({}, p, { st: 'anneau' }), o);
  return ajuster(lustre({ style }, { h: o.h || .3 }), l, hMax);
}
function appliqueCat(p) {
  const g = groupe('applique');
  const l = clamp(p.dim[0], .06, .8), h = clamp(p.dim[2], .15, 1.1), pr = clamp(p.dim[1], .05, .3);
  const met = mMetal(p), mv = mVerre(p);
  switch (p.st) {
    case 'tube': {
      const n = aTitre(p, /double|dual|duo/) ? 2 : 1;
      bloc(g, Math.max(.05, l * .6), .05, .02, met, 0, -.025, .01, .005);
      for (let i = 0; i < n; i++) { const x = n > 1 ? (i - .5) * Math.max(.05, l * .6) : 0; capsule(g, Math.min(.05, pr * .4), h - .1, aTitre(p, /ambr/) ? M('ambre') : mv, x, 0, pr * .6); cyl(g, .008, .008, h, met, x, -h / 2, pr * .6, 6); }
      break;
    }
    case 'vasques': {
      bloc(g, .05, h, .012, met, 0, -h / 2, .006, .004);
      for (let i = 0; i < 3; i++) { const y = -h / 2 + h * (i + .5) / 3; bloc(g, .03, .02, pr * .6, met, 0, y - .01, pr * .3); sphere(g, l / 2 - i * .01, mv, 0, y, pr * .7, 1.1, .42, .75, 18); }
      break;
    }
    case 'cadre': {
      bloc(g, l, h, .03, met, 0, -h / 2, .015, .005);
      bloc(g, l - .05, h - .05, .012, aTitre(p, /strie|lames/) ? M('cristal') : M('opale'), 0, -h / 2 + .025, .035);
      break;
    }
    case 'grille': {
      const nx = Math.max(1, Math.round(l / .2)), ny = Math.max(1, Math.round(h / .2)), liste = [];
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) liste.push([-l / 2 + l * (i + .5) / nx, -h / 2 + h * (j + .5) / ny, .04, 0, 0, 0, 1]);
      bloc(g, l, h, .02, met, 0, -h / 2, .01, .004);
      instances(g, new RoundedBoxGeometry(l / nx - .02, h / ny - .02, .05, 2, .02), M('opale'), liste);
      break;
    }
    default: {
      const bois = aTitre(p, /bois/);
      const pl = place(g, mesh(new THREE.CylinderGeometry(l / 2, l / 2, .02, 32), bois ? mBois(p) : met), 0, 0, .01, 0, Math.PI / 2);
      pl.scale.set(1, 1, h / l);
      bloc(g, .04, .03, .1, met, 0, -.015, .05);
      sphere(g, Math.min(l, h) * .42, mv, 0, 0, .1 + Math.min(l, h) * .3);
    }
  }
  halo(g, clamp(h * 1.8, .6, 1.6), 0, 0, .15);
  return g;
}
function lampadaireCat(p) {
  const g = groupe('lampadaire');
  const h = clamp(p.dim[2], .9, 2.2), met = mMetal(p);
  cyl(g, .16, .18, .03, met, 0, 0, 0, 24);
  cyl(g, .012, .012, h - .3, met, 0, .03, 0, 8);
  const c = cyl(g, .12, .22, .3, M('soie:' + coul(p, 0)), 0, h - .3, 0, 28, true); c.material.side = THREE.DoubleSide;
  halo(g, 1.4, 0, h - .2, 0);
  ombreSol(g, .7, .7);
  return g;
}
function plafonnierCat(p) {
  const g = groupe('plafonnier');
  const l = clamp(p.dim[0], .2, 1.2);
  tore(g, l / 2, .03, aTitre(p, /bois/) ? mBois(p) : mMetal(p), 0, -.08, 0);
  sphere(g, l * .3, M('opale'), 0, -.1, 0);
  halo(g, l * 2.4, 0, -.15, 0);
  return g;
}

/* =================================================================
   BAIGNOIRES (axe long selon x)
   ================================================================= */
function baignoireCat(p) {
  const g = groupe('baignoire');
  const l = clamp(p.dim[0], 1.1, 2.1), pr = clamp(p.dim[1], .6, 1.6), h = clamp(p.dim[2], .45, .9);
  const noir = p.fc === 'sombre';
  const mExt = M('laque:' + (noir ? '#1F1D22' : '#F4F2EC')), mInt = M('blanc');
  const st = p.st;
  if (st === 'rect' || st === 'balneo') {
    bloc(g, l, h, pr, mExt, 0, 0, 0, .07);
    bloc(g, l - .14, .012, pr - .14, M('laque:#E3E1DB'), 0, h - .006, 0, .005);
    if (st === 'balneo') {
      const n = 6; for (let i = 0; i < n; i++) cyl(g, .018, .018, .008, M('chrome'), -l / 2 + .25 + i * (l - .5) / (n - 1), h + .004, (i % 2 ? 1 : -1) * (pr / 2 - .1), 10);
      capsule(g, .05, .22, M('noir'), -l / 2 + .12, h + .03, 0, 0, 0, Math.PI / 2);
      if (aTitre(p, /double|2 appuie|deux/)) capsule(g, .05, .22, M('noir'), l / 2 - .12, h + .03, 0, 0, 0, Math.PI / 2);
      bloc(g, .12, .02, .08, M('noir'), l / 2 - .2, h, pr / 2 - .06, .005);
      if (p.led) { const led = bloc(g, l - .1, .012, .012, M('led:#8FD3FF'), 0, .05, pr / 2 + .002); led.castShadow = false; }
    }
    ombreSol(g, l + .5, pr + .4);
    return g;
  }
  if (st === 'angle') {
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(l, 0); s.absarc(0, 0, l, 0, Math.PI / 2, false); s.lineTo(0, 0);
    const e = extrude(g, s, h, mExt, .03); e.rotation.x = -Math.PI / 2; e.position.set(-l / 2, 0, pr / 2);
    ombreSol(g, l + .4, l + .4);
    return g;
  }
  // ovale, cannelée, griffe, slipper : coque tournée puis étirée
  const pied = st === 'griffe' ? .12 : 0;
  const e = tour(g, [[0, 0], [.36, 0], [.44, .1], [.48, .72], [.5, .97], [.485, 1]], mExt, 0, pied, 0, 48);
  const i = tour(g, [[.485, 1], [.45, .75], [.38, .2], [0, .16]], mInt, 0, pied, 0, 48);
  [e, i].forEach(m => { m.scale.set(l, h - pied, pr); m.material = m.material.clone(); m.material.side = THREE.DoubleSide; });
  if (st === 'griffe' || st === 'slipper') {
    const dos = sphere(g, .5, mExt, -l * .36, h * .92, 0, l * .45, h * .45, pr * 1.02, 24);
    dos.scale.set(l * .28, h * .5, pr * 1.02);
  }
  if (st === 'griffe') [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { sphere(g, .045, M('or'), a * l * .34, .05, b * pr * .3); cyl(g, .02, .035, .09, M('or'), a * l * .34, .06, b * pr * .3); });
  if (st === 'cannelee') {
    const fl = []; for (let k = 0; k < 64; k++) { const a = k / 64 * TAU; fl.push([Math.cos(a) * l * .485, h * .5, Math.sin(a) * pr * .485, 0, -a, 0, 1]); }
    instances(g, new THREE.CapsuleGeometry(.018, h * .75, 4, 6), mExt, fl);
  }
  bloc(g, .06, .04, .05, M('chrome'), -l / 2 + .02, h - .12, 0, .01);
  ombreSol(g, l + .5, pr + .5);
  return g;
}

/* =================================================================
   ASSISES D'APPOINT, SCULPTURES, EXTÉRIEUR
   ================================================================= */
function tabouretCat(p) {
  const g = groupe('tabouret');
  const h = clamp(p.dim[2], .4, 1.15), sh = h > .9 ? h * .68 : h, met = mMetal(p), m = mTissu(p, 0);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => cyl(g, .012, .016, sh - .06, met, a * .16, 0, b * .16, 8));
  if (sh > .55) tore(g, .19, .009, M('laiton'), 0, sh * .35, 0);
  cyl(g, .21, .2, .09, m, 0, sh - .06, 0, 28);
  if (h > .9) { const d = bloc(g, .4, h - sh, .06, m, 0, sh, -.18, .03); d.rotation.x = -.1; }
  ombreSol(g, .6, .6);
  return g;
}
function bancCat(p) {
  const g = groupe('banc');
  const l = clamp(p.dim[0], .6, 2.6), pr = clamp(p.dim[1], .3, 1.1), m = mTissu(p, 0);
  const vache = aTitre(p, /vache/);
  const assise = bloc(g, l, .16, pr, vache ? M('cuir:#F2EEE6') : m, 0, .3, 0, .06);
  if (vache) {
    const r = alea(9), t = [];
    for (let i = 0; i < 9; i++) t.push([(r() - .5) * (l - .3), .463, (r() - .5) * (pr - .2), 0, r() * 3, 0, 1, .12 + r() * .12, .01, .08 + r() * .1]);
    instances(g, new THREE.SphereGeometry(1, 14, 6), M('cuir:#5E3A22'), t);
  }
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => cyl(g, .018, .022, .3, mMetal(p), a * (l / 2 - .08), 0, b * (pr / 2 - .08), 8));
  ombreSol(g, l + .4, pr + .4);
  return g;
}
function poufCat(p) {
  const g = groupe('pouf');
  const l = clamp(p.dim[0], .3, 1.2), h = clamp(p.dim[2], .2, .6);
  tour(g, [[0, 0], [l * .42, 0], [l * .5, h * .35], [l * .47, h * .8], [l * .3, h], [0, h]], mTissu(p, 0), 0, 0, 0, 32);
  ombreSol(g, l + .3, l + .3);
  return g;
}
function sculptureCat(p) {
  const g = groupe('sculpture');
  const l = clamp(p.dim[0], .3, 2), pr = clamp(p.dim[1], .2, 1.5), h = clamp(p.dim[2], .4, 2.6);
  if (p.st === 'arbre') {
    bloc(g, l, .4, pr, M('noirMat'), 0, 0, 0, .02);
    bloc(g, l - .06, .03, pr - .06, M('plante:#5F7A3E'), 0, .38, 0, .01);
    plante(g, 0, 0, h - .3, 'olivier', .4);
  } else if (p.st === 'cactus') {
    const m = M('laque:' + (p.cols[0] || '#5E9B4C'));
    bloc(g, l * .5, .12, pr * .6, M('noirMat'), 0, 0, 0, .02);
    capsule(g, l * .16, h * .7, m, 0, h * .45, 0);
    capsule(g, l * .1, h * .28, m, -l * .28, h * .6, 0); tube(g, [[-l * .28, h * .45, 0], [-l * .2, h * .38, 0], [-l * .06, h * .4, 0]], l * .08, m, false, 10, 8);
    capsule(g, l * .1, h * .22, m, l * .28, h * .5, 0); tube(g, [[l * .28, h * .38, 0], [l * .2, h * .32, 0], [l * .06, h * .34, 0]], l * .08, m, false, 10, 8);
  } else {
    return sculpture({ style: 'marcheur' });
  }
  ombreSol(g, l + .4, pr + .4);
  return g;
}
function meridienneCat(p) {
  if (p.st !== 'daybed') return meridienne();
  const g = groupe('meridienne');
  const l = clamp(p.dim[0], 1.5, 2.3), pr = clamp(p.dim[1], .6, 1.2), mb = mBois(p);
  bloc(g, l, .18, pr, mb, 0, .08, 0, .02);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => bloc(g, .06, .1, .06, mb, a * (l / 2 - .06), 0, b * (pr / 2 - .06)));
  bloc(g, l - .08, .12, pr - .08, M('tissu:' + (p.cols[0] || '#ECE4D3')), 0, .26, 0, .05);
  const c = bloc(g, .5, .35, .12, M('tissu:#D9D2C4'), -l / 2 + .2, .38, 0, .05); c.rotation.set(0, Math.PI / 2, -.3);
  ombreSol(g, l + .5, pr + .5);
  return g;
}
function salonCat(p) {
  const l = clamp(p.dim[0], 1.2, 4.6), pr = clamp(p.dim[1], .6, 4.6);
  const coussins = p.cols[0] && p.fc !== 'sombre' ? p.cols[0] : '#55575A';
  if (p.st === 'feu' && l >= 3.5) return salonFeu();
  const g = groupe('salon-jardin');
  const cadre = p.mat === 'corde' ? M('corde') : M('laque:' + (p.fc === 'sombre' ? '#2A292C' : '#CFC3AE'));
  const mc = M((p.mat === 'boucle' ? 'boucle:' : 'tissu:') + (p.mat === 'boucle' ? coul(p, 0) : coussins));
  if (p.st === 'rond') {
    const Rr = clamp(l / 2, 1.1, 2), a = .8;
    couronne(g, Rr - .85, Rr, Math.PI / 2 - a, Math.PI / 2 + a, .38, cadre, 0, .05);
    couronne(g, Rr - .8, Rr - .05, Math.PI / 2 - a + .03, Math.PI / 2 + a - .03, .1, mc, .38, .04);
    couronne(g, Rr - .2, Rr, Math.PI / 2 - a, Math.PI / 2 + a, .7, cadre, 0, .06);
    cyl(g, .45, .45, .34, M('travertin'), 0, 0, Rr * .15, 32);
    [-1, 1].forEach(k => cyl(g, .3, .32, .38, mc, k * 1.2, 0, Rr * .5, 24));
    ombreSol(g, Rr * 2.4, Rr * 2);
    return g;
  }
  // salon droit : canapé, deux fauteuils, table basse (ou table feu)
  const ls = clamp(l, 1.6, 3);
  const piece = (w, x, z, ry) => {
    const q = groupe(); q.position.set(x, 0, z); q.rotation.y = ry; g.add(q);
    bloc(q, w, .36, .82, cadre, 0, 0, 0, .05);
    bloc(q, w - .14, .14, .68, mc, 0, .36, .04, .05);
    bloc(q, w, .42, .12, cadre, 0, .36, -.35, .04);
    for (let i = 0; i < Math.round(w / .6); i++) { const c = bloc(q, .5, .4, .14, mc, -w / 2 + .35 + i * .6, .46, -.24, .05); c.rotation.x = -.18; }
    [-1, 1].forEach(k => bloc(q, .1, .55, .82, cadre, k * (w / 2 - .05), 0, 0, .04));
  };
  piece(ls, 0, -1.05, 0);
  piece(.86, -ls / 2 - .45, .35, Math.PI / 2);
  piece(.86, ls / 2 + .45, .35, -Math.PI / 2);
  if (p.st === 'feu') { cyl(g, .5, .5, .38, M('noirMat'), 0, 0, .25, 32); cyl(g, .3, .3, .06, M('verre'), 0, .38, .25, 24); const f = place(g, mesh(new THREE.ConeGeometry(.1, .3, 10), M('flamme'), false), 0, .55, .25); f.userData.nonCuit = true; }
  else { bloc(g, 1.1, .34, .62, cadre, 0, 0, .25, .03); bloc(g, 1.1, .03, .62, M('pierre'), 0, .34, .25); }
  ombreSol(g, ls + 2.2, 3.2);
  return g;
}
function tableCat(p) {
  const g = groupe('table');
  const l = clamp(p.dim[0], .35, 3), pr = clamp(p.dim[1], .35, 1.5), h = clamp(p.dim[2], .3, 1.1);
  const plateau = aTitre(p, /marbre/) ? M('marbreBlanc') : aTitre(p, /travertin/) ? M('travertin') : p.bois ? mBois(p) : M('laque:' + (p.cols[0] || '#3A3836'));
  if (p.st === 'ronde') { cyl(g, l / 2, l / 2, .04, plateau, 0, h - .04, 0, 40); cyl(g, l * .12, l * .3, h - .04, plateau, 0, 0, 0, 24); }
  else { bloc(g, l, .05, pr, plateau, 0, h - .05, 0, .01); [-1, 1].forEach(k => bloc(g, .12, h - .05, pr * .6, p.bois ? mBois(p) : M('noir'), k * (l / 2 - .3), 0, 0, .03)); }
  ombreSol(g, l + .5, pr + .5);
  return g;
}
function meubleCat(p) {
  const g = groupe('meuble');
  const l = clamp(p.dim[0], .5, 2.6), pr = clamp(p.dim[1], .25, .7), h = clamp(p.dim[2], .4, 1.5);
  const m = M('laque:' + (p.cols[0] || '#1F1E22'));
  bloc(g, l, h - .16, pr, m, 0, .16, 0, .02);
  const n = Math.max(2, Math.round(l / .45));
  for (let i = 1; i < n; i++) bloc(g, .006, h - .22, .006, M('laiton'), -l / 2 + l * i / n, .19, pr / 2);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => cyl(g, .014, .02, .16, M('laiton'), a * (l / 2 - .06), 0, b * (pr / 2 - .05), 8));
  ombreSol(g, l + .3, pr + .3);
  return g;
}
function panneauMural(p) {
  const g = groupe('mural');
  const l = clamp(p.dim[0], .3, 2.2), h = clamp(p.dim[2], .3, 2.2);
  bloc(g, l, h, .04, p.fam === 'miroir' ? M('chrome') : M('tissu:' + (p.cols[0] || '#6B6358')), 0, -h / 2, .02, .02);
  return g;
}

/* ---------------------------------------------------------------
   Aiguillage : pièce du catalogue -> maquette générique
   --------------------------------------------------------------- */
const CAT_GENERIQUE = {
  lit: litCat, fauteuil: fauteuilCat, canape: canapeCat, suspension: suspensionCat, lustre: lustreCat, applique: appliqueCat,
  lampadaire: lampadaireCat, lampe: lampadaireCat, plafonnier: plafonnierCat, baignoire: baignoireCat, tabouret: tabouretCat,
  banc: bancCat, pouf: poufCat, sculpture: sculptureCat, meridienne: meridienneCat, 'salon-jardin': salonCat,
  jardiniere: () => jardiniere(), balancelle: () => balancelles(), table: tableCat, meuble: meubleCat, miroir: panneauMural, tapis: panneauMural
};
function construireCatalogue(p, o = {}) {
  const f = CAT_GENERIQUE[p.fam];
  if (!f || !p.dim) return groupe('vide');
  return f(p, o);
}
