/* =================================================================
   Visite 3D — socle : rendu, outils de modélisation, matériaux, textures
   Maquettes génériques en attendant la 3D réelle des chambres (Marble).
   ================================================================= */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const DATA = window.MC_DATA;
const TAU = Math.PI * 2;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------------------------------------------------------------
   Aléatoire reproductible (même maquette à chaque visite)
   --------------------------------------------------------------- */
function alea(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
let R = alea(7);

/* ---------------------------------------------------------------
   Outils de modélisation : chaque objet a son origine au sol,
   centré, face avant vers +z
   --------------------------------------------------------------- */
function mesh(geo, m, ombre = true) {
  const me = new THREE.Mesh(geo, m);
  me.castShadow = ombre;
  me.receiveShadow = true;
  return me;
}
function place(parent, obj, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
  obj.position.set(x, y, z);
  if (ry || rx || rz) obj.rotation.set(rx, ry, rz);
  parent.add(obj);
  return obj;
}
// Boîte posée : (x, y, z) = centre de la face inférieure
function bloc(parent, w, h, d, m, x = 0, y = 0, z = 0, r = 0, ry = 0) {
  const rr = Math.min(r, Math.min(w, h, d) / 2 - 0.0005);
  const g = rr > 0.002 ? new RoundedBoxGeometry(w, h, d, 3, rr) : new THREE.BoxGeometry(w, h, d);
  return place(parent, mesh(g, m), x, y + h / 2, z, ry);
}
function cyl(parent, rt, rb, h, m, x = 0, y = 0, z = 0, seg = 24, ouvert = false) {
  return place(parent, mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, ouvert), m), x, y + h / 2, z);
}
function sphere(parent, r, m, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, seg = 20) {
  const s = place(parent, mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.6 | 0)), m), x, y, z);
  s.scale.set(sx, sy, sz);
  return s;
}
function tore(parent, R0, r, m, x = 0, y = 0, z = 0, rx = Math.PI / 2, arc = TAU, seg = 48) {
  return place(parent, mesh(new THREE.TorusGeometry(R0, r, 8, seg, arc), m), x, y, z, 0, rx);
}
function tour(parent, pts, m, x = 0, y = 0, z = 0, seg = 40) {
  return place(parent, mesh(new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg), m), x, y, z);
}
function tube(parent, points, r, m, ferme = false, seg = 64, radial = 8) {
  const courbe = new THREE.CatmullRomCurve3(points.map(p => V3(p[0], p[1], p[2])), ferme, 'catmullrom', 0.5);
  return place(parent, mesh(new THREE.TubeGeometry(courbe, seg, r, radial, ferme), m));
}
function extrude(parent, shape, prof, m, biseau = 0) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: prof, bevelEnabled: biseau > 0, bevelThickness: biseau, bevelSize: biseau, bevelSegments: 3, curveSegments: 24 });
  return place(parent, mesh(g, m));
}
// Arc de couronne (plateau courbe) : rayons ri..re, angle a0..a1, extrudé sur h (vers le haut)
function arcPlein(ri, re, a0, a1) {
  const s = new THREE.Shape();
  s.absarc(0, 0, re, a0, a1, false);
  s.absarc(0, 0, ri, a1, a0, true);
  s.closePath();
  return s;
}
function couronne(parent, ri, re, a0, a1, h, m, y = 0, biseau = 0.02) {
  const me = extrude(parent, arcPlein(ri, re, a0, a1), h, m, biseau);
  me.rotation.x = -Math.PI / 2;
  me.position.y = y;
  return me;
}
function groupe(nom) { const g = new THREE.Group(); if (nom) g.name = nom; return g; }
// Instances (boutons de capitonnage, lattes, cristaux...)
function instances(parent, geo, m, liste, ombre = false) {
  const im = new THREE.InstancedMesh(geo, m, liste.length);
  const o = new THREE.Object3D();
  liste.forEach((t, i) => {
    o.position.set(t[0], t[1], t[2]);
    o.rotation.set(t[3] || 0, t[4] || 0, t[5] || 0);
    const s = t[6] || 1;
    o.scale.set(t[7] !== undefined ? t[7] : s, t[8] !== undefined ? t[8] : s, t[9] !== undefined ? t[9] : s);
    o.updateMatrix();
    im.setMatrixAt(i, o.matrix);
  });
  im.castShadow = ombre;
  im.receiveShadow = true;
  parent.add(im);
  return im;
}

/* ---------------------------------------------------------------
   Textures procédurales (canvas)
   --------------------------------------------------------------- */
function canvasTex(w, h, dessin, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  dessin(x, w, h);
  const t = new THREE.CanvasTexture(c);
  if (opts.couleur !== false) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = opts.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (opts.rep) t.repeat.set(opts.rep[0], opts.rep[1]);
  return t;
}
const TEX = {};
function tex(nom) {
  if (TEX[nom]) return TEX[nom];
  const r = alea(nom.length * 131 + 17);
  const f = {
    moquette: () => canvasTex(512, 512, (x, w, h) => {
      x.fillStyle = '#5E4F47'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) {
        const v = r();
        x.fillStyle = v < .5 ? 'rgba(40,30,26,.35)' : v < .85 ? 'rgba(128,110,98,.28)' : 'rgba(170,150,132,.22)';
        x.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 2);
      }
      x.strokeStyle = 'rgba(150,130,112,.18)'; x.lineWidth = 2;
      for (let i = 0; i < 90; i++) { const px = r() * w, py = r() * h, s = 6 + r() * 14; x.strokeRect(px, py, s, s * .6); }
    }),
    parquet: () => canvasTex(512, 512, (x, w, h) => {
      const lames = 6, lh = h / lames;
      for (let i = 0; i < lames; i++) {
        let off = r() * w;
        for (let k = -1; k < 3; k++) {
          const l = w * (.55 + r() * .4);
          const t = 185 + r() * 25 | 0;
          x.fillStyle = `rgb(${t},${t - 38 | 0},${t - 82 | 0})`;
          x.fillRect(off + k * w * .7, i * lh, l, lh);
          x.strokeStyle = 'rgba(80,50,25,.35)'; x.lineWidth = 1.5;
          x.strokeRect(off + k * w * .7, i * lh, l, lh);
        }
        for (let g = 0; g < 26; g++) {
          x.strokeStyle = `rgba(110,72,38,${.05 + r() * .09})`; x.lineWidth = 1;
          x.beginPath(); const yy = i * lh + r() * lh; x.moveTo(0, yy); x.bezierCurveTo(w * .3, yy + r() * 6 - 3, w * .6, yy + r() * 6 - 3, w, yy); x.stroke();
        }
      }
    }),
    marbre: () => canvasTex(1024, 1024, (x, w, h) => {
      x.fillStyle = '#EEEAE3'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 16; i++) {
        x.strokeStyle = `rgba(${120 + r() * 40},${115 + r() * 30},${110 + r() * 30},${.15 + r() * .3})`;
        x.lineWidth = .6 + r() * 2.4;
        x.beginPath(); let px = r() * w, py = -20; x.moveTo(px, py);
        for (let s = 0; s < 8; s++) { const nx = px + (r() - .4) * 260, ny = py + 150 + r() * 60; x.quadraticCurveTo(px + (r() - .5) * 200, (py + ny) / 2, nx, ny); px = nx; py = ny; }
        x.stroke();
      }
      x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 3;
      for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(0, i * h / 4); x.lineTo(w, i * h / 4); x.moveTo(i * w / 4, 0); x.lineTo(i * w / 4, h); x.stroke(); }
    }),
    pierre: () => canvasTex(512, 512, (x, w, h) => {
      x.fillStyle = '#D8CFBF'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 5000; i++) { x.fillStyle = `rgba(${r() < .5 ? '120,105,85' : '250,245,235'},${.05 + r() * .08})`; x.fillRect(r() * w, r() * h, 2, 2); }
      x.strokeStyle = 'rgba(120,108,90,.5)'; x.lineWidth = 3;
      for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(0, i * h / 4); x.lineTo(w, i * h / 4); x.stroke(); }
      for (let i = 0; i < 4; i++) for (let k = 0; k <= 2; k++) { const xx = (k * w / 2 + (i % 2) * w / 4) % w; x.beginPath(); x.moveTo(xx, i * h / 4); x.lineTo(xx, (i + 1) * h / 4); x.stroke(); }
    }),
    dallage: () => canvasTex(512, 512, (x, w, h) => {
      for (let i = 0; i < 2; i++) for (let k = 0; k < 2; k++) {
        const t = (i + k) % 2 ? 226 : 236;
        x.fillStyle = `rgb(${t},${t - 6},${t - 14})`; x.fillRect(i * w / 2, k * h / 2, w / 2, h / 2);
      }
      for (let i = 0; i < 12; i++) { x.strokeStyle = `rgba(150,140,125,${.1 + r() * .15})`; x.lineWidth = 1 + r() * 2; x.beginPath(); x.moveTo(r() * w, r() * h); x.bezierCurveTo(r() * w, r() * h, r() * w, r() * h, r() * w, r() * h); x.stroke(); }
      x.strokeStyle = 'rgba(160,150,135,.6)'; x.lineWidth = 2; x.strokeRect(1, 1, w / 2 - 2, h / 2 - 2); x.strokeRect(w / 2 + 1, h / 2 + 1, w / 2 - 2, h / 2 - 2); x.strokeRect(w / 2 + 1, 1, w / 2 - 2, h / 2 - 2); x.strokeRect(1, h / 2 + 1, w / 2 - 2, h / 2 - 2);
    }),
    pelouse: () => canvasTex(512, 512, (x, w, h) => {
      x.fillStyle = '#7E9660'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 16000; i++) { const g = r(); x.fillStyle = g < .5 ? 'rgba(70,95,45,.3)' : 'rgba(170,190,120,.22)'; x.fillRect(r() * w, r() * h, 1, 2 + r() * 3); }
    }),
    terrasse: () => canvasTex(512, 512, (x, w, h) => {
      const n = 8, lw = w / n;
      for (let i = 0; i < n; i++) { const t = 150 + r() * 25 | 0; x.fillStyle = `rgb(${t},${t - 30 | 0},${t - 60 | 0})`; x.fillRect(i * lw, 0, lw - 3, h); }
      x.fillStyle = 'rgba(40,25,15,.6)'; for (let i = 0; i < n; i++) x.fillRect(i * lw + lw - 3, 0, 3, h);
    }),
    tache: () => canvasTex(128, 128, (x, w, h) => {
      const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(.55, 'rgba(0,0,0,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
    }, { clamp: true, couleur: false }),
    halo: () => canvasTex(128, 128, (x, w, h) => {
      const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,236,205,1)'); g.addColorStop(.25, 'rgba(255,200,140,.45)'); g.addColorStop(1, 'rgba(255,170,90,0)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
    }, { clamp: true }),
    ciel: () => canvasTex(512, 256, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#CFE0EA'); g.addColorStop(.55, '#EDE7DA'); g.addColorStop(1, '#D9CDBB');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(150,150,150,.25)';
      for (let i = 0; i < 40; i++) { const bw = 10 + r() * 40, bh = 20 + r() * 60; x.fillRect(r() * w, h * .72 - bh, bw, bh + h); }
    }, { clamp: true }),
    eau: () => {
      const n = 256, c = document.createElement('canvas'); c.width = c.height = n;
      const x = c.getContext('2d'), img = x.createImageData(n, n), hgt = new Float32Array(n * n);
      const ondes = []; for (let i = 0; i < 14; i++) ondes.push([1 + (r() * 6 | 0), 1 + (r() * 6 | 0), r() * TAU, .3 + r() * .7]);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { let v = 0; for (const o of ondes) v += Math.sin((i / n * o[0] + j / n * o[1]) * TAU + o[2]) * o[3]; hgt[j * n + i] = v; }
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const dx = hgt[j * n + (i + 1) % n] - hgt[j * n + (i - 1 + n) % n], dy = hgt[((j + 1) % n) * n + i] - hgt[((j - 1 + n) % n) * n + i];
        const nx = -dx * .9, ny = -dy * .9, nz = 1, l = Math.hypot(nx, ny, nz), k = (j * n + i) * 4;
        img.data[k] = (nx / l * .5 + .5) * 255; img.data[k + 1] = (ny / l * .5 + .5) * 255; img.data[k + 2] = (nz / l * .5 + .5) * 255; img.data[k + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
    },
    ruissellement: () => canvasTex(64, 256, (x, w, h) => {
      x.fillStyle = 'rgba(255,255,255,0)'; x.clearRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(235,245,250,${.15 + r() * .45})`; x.fillRect(r() * w, r() * h, 1 + r() * 2, 20 + r() * 90); }
    }, { couleur: false }),
    jungle: () => canvasTex(512, 256, (x, w, h) => {
      x.fillStyle = '#16201A'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) {
        const px = r() * w, py = r() * h, s = 10 + r() * 28;
        x.save(); x.translate(px, py); x.rotate(r() * TAU);
        x.fillStyle = ['#2F6B3A', '#3E8A47', '#1F4C2B', '#5E9B4C'][r() * 4 | 0];
        x.beginPath(); x.ellipse(0, 0, s, s * .38, 0, 0, TAU); x.fill(); x.restore();
      }
      for (let i = 0; i < 40; i++) { x.fillStyle = ['#C98A3A', '#E0B04F', '#B4532F'][r() * 3 | 0]; x.beginPath(); x.arc(r() * w, r() * h, 2 + r() * 4, 0, TAU); x.fill(); }
    }),
    mineral: () => canvasTex(512, 256, (x, w, h) => {
      x.fillStyle = '#3C3936'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 26; i++) {
        x.fillStyle = ['rgba(214,200,178,.55)', 'rgba(150,145,140,.45)', 'rgba(25,24,24,.5)'][r() * 3 | 0];
        x.beginPath(); const px = r() * w, py = r() * h; x.moveTo(px, py);
        for (let s = 0; s < 5; s++) x.quadraticCurveTo(px + (r() - .5) * 160, py + (r() - .5) * 90, px + (r() - .5) * 120, py + (r() - .5) * 70);
        x.fill();
      }
    }),
    pinceau: () => canvasTex(512, 256, (x, w, h) => {
      x.fillStyle = '#ECE4D6'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 18; i++) {
        x.strokeStyle = r() < .6 ? 'rgba(28,27,32,.8)' : 'rgba(120,118,115,.6)'; x.lineWidth = 3 + r() * 9; x.lineCap = 'round';
        x.beginPath(); const px = r() * w, py = r() * h; x.moveTo(px, py); x.bezierCurveTo(px + r() * 80, py - r() * 50, px + r() * 120, py + r() * 50, px + 60 + r() * 100, py + (r() - .5) * 40); x.stroke();
      }
    }),
    corde: () => canvasTex(128, 128, (x, w, h) => {
      x.fillStyle = '#C8B89A'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? 'rgba(120,100,70,.35)' : 'rgba(250,240,220,.3)'; x.fillRect(0, i * 8, w, 4); x.fillRect(i * 8, 0, 3, h); }
    }),
    cuirTopo: () => canvasTex(256, 256, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#8C6AA6'); g.addColorStop(1, '#4E3464'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { x.strokeStyle = `rgba(30,15,45,${.15 + r() * .2})`; x.lineWidth = 1 + r() * 2; x.beginPath(); const yy = r() * h; x.moveTo(0, yy); x.bezierCurveTo(w * .3, yy + (r() - .5) * 40, w * .7, yy + (r() - .5) * 40, w, yy + (r() - .5) * 20); x.stroke(); }
    }),
    fibres: () => canvasTex(128, 256, (x, w, h) => {
      x.fillStyle = '#F1EBDF'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 64; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,.5)' : 'rgba(170,150,120,.25)'; x.fillRect(i * 2, 0, 1, h); }
    }),
    oeuvre: () => canvasTex(256, 340, (x, w, h) => {
      x.fillStyle = '#EFE8DD'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#B4532F'; x.beginPath(); x.moveTo(w * .2, h * .2); x.lineTo(w * .8, h * .35); x.lineTo(w * .55, h * .75); x.closePath(); x.fill();
      x.fillStyle = '#1C1B20'; x.beginPath(); x.moveTo(w * .5, h * .3); x.lineTo(w * .78, h * .82); x.lineTo(w * .3, h * .7); x.closePath(); x.fill();
      x.fillStyle = '#D9C3A0'; x.fillRect(w * .15, h * .55, w * .3, h * .2);
    }, { clamp: true })
  };
  TEX[nom] = f[nom]();
  return TEX[nom];
}

/* ---------------------------------------------------------------
   Matériaux (cache par clé) + registre des matériaux lumineux
   --------------------------------------------------------------- */
const MATS = {};
const LUMINEUX = [];   // { m, jour, soir, champ } : intensité selon l'ambiance
function std(couleur, rough = .8, metal = 0, extra = {}) {
  return new THREE.MeshStandardMaterial(Object.assign({ color: new THREE.Color(couleur), roughness: rough, metalness: metal }, extra));
}
function M(cle) {
  if (MATS[cle]) return MATS[cle];
  const [type, arg] = cle.split(':');
  let m;
  switch (type) {
    case 'mur': m = std('#F3EFE7', .92); break;
    case 'murChaud': m = std('#EDE3D3', .9); break;
    case 'poche': m = std('#2A2226', .7); break;
    // socle et table : légèrement repoussés en profondeur, les sols posés dessus passent toujours devant
    case 'socle': m = std('#EAE4D8', .95); m.polygonOffset = true; m.polygonOffsetFactor = 1; m.polygonOffsetUnits = 2; break;
    case 'sol': m = std('#E6E0D3', 1); m.polygonOffset = true; m.polygonOffsetFactor = 1; m.polygonOffsetUnits = 2; break;
    case 'plafond': m = std('#F7F4EE', .95); break;
    case 'noir': m = std('#1D1B1F', .45, .6); break;
    case 'noirMat': m = std('#232126', .85); break;
    case 'laiton': m = std('#C8A15A', .32, 1); break;
    case 'or': m = std('#D4AF62', .25, 1); break;
    case 'bronze': m = std('#7A5530', .45, .85); break;
    case 'chrome': m = std('#DCDDE0', .12, 1); break;
    case 'alu': m = std('#2B2A2E', .4, .8); break;
    case 'chene': m = std('#C9A57A', .6); break;
    case 'noyer': m = std('#5E3F2B', .55); break;
    case 'travertin': m = std('#DCCDB4', .7); break;
    case 'marbreBlanc': m = std('#F0ECE5', .35); break;
    case 'blanc': m = std('#F6F4EF', .55); break;
    case 'drap': m = std('#F4F1EA', .9); break;
    case 'laque': m = std(arg || '#D9CCB6', .35); break;
    case 'cuir': m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(arg), roughness: .45, clearcoat: .25, clearcoatRoughness: .5 }); break;
    case 'velours': m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(arg), roughness: .85, sheen: 1, sheenRoughness: .45, sheenColor: new THREE.Color(arg).lerp(new THREE.Color('#ffffff'), .35) }); break;
    case 'boucle': m = std(arg, .98); break;
    case 'tissu': m = std(arg, .92); break;
    case 'plante': m = std(arg || '#4F6B3A', .85); break;
    case 'verre': m = new THREE.MeshPhysicalMaterial({ color: '#FFFFFF', roughness: .04, metalness: 0, transparent: true, opacity: .16, envMapIntensity: 1.6, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide }); break;
    case 'bulle': m = new THREE.MeshPhysicalMaterial({ color: '#F4FAFF', roughness: .02, metalness: 0, transparent: true, opacity: .1, envMapIntensity: 2.2, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide, emissive: new THREE.Color('#FFC27A'), emissiveIntensity: 0 }); LUMINEUX.push({ m, jour: 0, soir: .55 }); LUMINEUX.push({ m, jour: .1, soir: .19, champ: 'opacite' }); break;
    case 'fume': m = new THREE.MeshPhysicalMaterial({ color: '#5A5550', roughness: .08, transparent: true, opacity: .55, envMapIntensity: 1.4, clearcoat: 1 }); break;
    case 'cristal': m = new THREE.MeshPhysicalMaterial({ color: '#FFFFFF', roughness: .02, metalness: .1, transparent: true, opacity: .55, envMapIntensity: 2.4, clearcoat: 1, emissive: new THREE.Color('#FFE9C8'), emissiveIntensity: .12 }); LUMINEUX.push({ m, jour: .12, soir: .9 }); break;
    case 'opale': m = std('#FFFFFF', .6, 0, { emissive: new THREE.Color(arg || '#FFE3BC'), emissiveIntensity: .35 }); LUMINEUX.push({ m, jour: .35, soir: 2.2 }); break;
    case 'ambre': m = new THREE.MeshPhysicalMaterial({ color: '#D98A3A', roughness: .1, transparent: true, opacity: .8, emissive: new THREE.Color('#FF9A3C'), emissiveIntensity: .3, clearcoat: 1 }); LUMINEUX.push({ m, jour: .3, soir: 2 }); break;
    case 'led': m = new THREE.MeshBasicMaterial({ color: new THREE.Color(arg || '#FFB45E') }); m.userData.base = m.color.clone(); LUMINEUX.push({ m, jour: .9, soir: 3.2, champ: 'couleur' }); break;
    case 'fenetre': m = new THREE.MeshBasicMaterial({ map: tex('ciel'), toneMapped: true }); m.userData.base = new THREE.Color(1, 1, 1); LUMINEUX.push({ m, jour: 1.05, soir: .22, champ: 'couleur' }); break;
    case 'voilage': m = std('#FBF8F2', .95, 0, { transparent: true, opacity: .62, side: THREE.DoubleSide, emissive: new THREE.Color('#FFF6E6'), emissiveIntensity: .18 }); LUMINEUX.push({ m, jour: .35, soir: .05 }); break;
    case 'moquette': m = std('#FFFFFF', 1, 0, { map: tex('moquette') }); break;
    case 'parquet': m = std('#FFFFFF', .7, 0, { map: tex('parquet') }); break;
    case 'marbre': m = std('#FFFFFF', .28, 0, { map: tex('marbre') }); break;
    case 'dallage': m = std('#FFFFFF', .4, 0, { map: tex('dallage') }); break;
    case 'pierre': m = std('#FFFFFF', .9, 0, { map: tex('pierre') }); break;
    case 'pelouse': m = std('#FFFFFF', 1, 0, { map: tex('pelouse') }); m.polygonOffset = true; m.polygonOffsetFactor = 1; m.polygonOffsetUnits = 2; break;
    case 'terrasse': m = std('#FFFFFF', .85, 0, { map: tex('terrasse') }); break;
    case 'jungle': m = new THREE.MeshPhysicalMaterial({ map: tex('jungle'), roughness: .8, sheen: 1, sheenRoughness: .5, sheenColor: new THREE.Color('#5E7A5A') }); break;
    case 'mineral': m = new THREE.MeshPhysicalMaterial({ map: tex('mineral'), roughness: .75, sheen: 1, sheenRoughness: .4, sheenColor: new THREE.Color('#C9BFB0') }); break;
    case 'pinceau': m = std('#FFFFFF', .98, 0, { map: tex('pinceau') }); break;
    case 'corde': m = std('#FFFFFF', .95, 0, { map: tex('corde') }); break;
    case 'topo': m = std('#FFFFFF', .9, 0, { map: tex('cuirTopo') }); break;
    case 'oeuvre': m = std('#FFFFFF', .9, 0, { map: tex('oeuvre') }); break;
    case 'fibres': m = std('#FFFFFF', .9, 0, { map: tex('fibres'), emissive: new THREE.Color('#FFE2B0'), emissiveIntensity: .25, emissiveMap: tex('fibres') }); LUMINEUX.push({ m, jour: .25, soir: 1.6 }); break;
    case 'soie': m = std(arg || '#B7603B', .9, 0, { emissive: new THREE.Color(arg || '#B7603B'), emissiveIntensity: .25 }); LUMINEUX.push({ m, jour: .25, soir: 1.4 }); break;
    case 'plumes': m = std('#F1E8D8', .95, 0, { side: THREE.DoubleSide, emissive: new THREE.Color('#FFD9A6'), emissiveIntensity: .12 }); LUMINEUX.push({ m, jour: .12, soir: 1 }); break;
    case 'eau': {
      const n = tex('eau');
      m = new THREE.MeshPhysicalMaterial({ color: '#8DB4B8', roughness: .06, metalness: 0, transparent: true, opacity: .82, normalMap: n, normalScale: new THREE.Vector2(.35, .35), envMapIntensity: 1.8, clearcoat: 1 });
      break;
    }
    case 'cascade': m = new THREE.MeshBasicMaterial({ map: tex('ruissellement'), transparent: true, opacity: .55, depthWrite: false, side: THREE.DoubleSide, color: '#DDEFF4' }); break;
    case 'tache': m = new THREE.MeshBasicMaterial({ map: tex('tache'), transparent: true, depthWrite: false, opacity: .9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }); break;
    case 'halo': m = new THREE.MeshBasicMaterial({ map: tex('halo'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .25, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }); m.userData.halo = true; LUMINEUX.push({ m, jour: .18, soir: .95, champ: 'opacite' }); break;
    case 'flamme': m = new THREE.MeshBasicMaterial({ color: new THREE.Color('#FF9A3C'), transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false }); m.userData.base = m.color.clone(); LUMINEUX.push({ m, jour: .7, soir: 2.4, champ: 'couleur' }); break;
    case 'fantome': m = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: .9, transparent: true, opacity: .28, depthWrite: false }); break;
    default: m = std(arg || '#cccccc');
  }
  m.name = cle;
  MATS[cle] = m;
  return m;
}

/* ---------------------------------------------------------------
   Ombres de contact : tache douce sous un objet (effet maquette)
   --------------------------------------------------------------- */
function ombreSol(parent, w, d, x = 0, z = 0, y = 0.004, force = 1) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M('tache'));
  p.rotation.x = -Math.PI / 2;
  p.position.set(x, y, z);
  p.renderOrder = 1;
  if (force !== 1) { p.material = M('tache').clone(); p.material.opacity = .9 * force; }
  p.userData.nonCuit = true;
  parent.add(p);
  return p;
}
function halo(parent, taille, x, y, z) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex('halo'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .2 }));
  s.scale.set(taille, taille, 1);
  s.position.set(x, y, z);
  s.userData.nonCuit = true;
  s.userData.halo = true;
  LUMINEUX.push({ m: s.material, jour: .12, soir: .8, champ: 'opacite' });
  parent.add(s);
  return s;
}

/* ---------------------------------------------------------------
   Cuisson : fusionne les maillages statiques d'un groupe par matériau
   (beaucoup moins d'appels de dessin, surtout sur mobile)
   --------------------------------------------------------------- */
function cuire(racine) {
  racine.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(racine.matrixWorld).invert();
  const seaux = new Map();
  const aRetirer = [];
  racine.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.nonCuit || o.material.transparent || Array.isArray(o.material)) return;
    let p = o.parent, bloque = false;
    while (p && p !== racine) { if (p.userData.nonCuit) { bloque = true; break; } p = p.parent; }
    if (bloque) return;
    const cle = o.material.uuid + (o.castShadow ? 'c' : 'n');
    if (!seaux.has(cle)) seaux.set(cle, { m: o.material, ombre: o.castShadow, geos: [] });
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    seaux.get(cle).geos.push(g);
    aRetirer.push(o);
  });
  aRetirer.forEach(o => o.parent && o.parent.remove(o));
  for (const s of seaux.values()) {
    const fusion = mergeGeometries(s.geos, false);
    if (!fusion) continue;
    const me = new THREE.Mesh(fusion, s.m);
    me.castShadow = s.ombre;
    me.receiveShadow = true;
    racine.add(me);
  }
}

