// Ретро-компас из 21 детали: собран на первом экране и разлетается на части при скролле.
// Вся геометрия строится процедурно, без внешних моделей.
import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- Текстуры ----------

function noiseCanvas(size, base, spread, seed = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = base + (rnd() - 0.5) * spread;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // Лёгкие царапины: делают металл живым.
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 160; i++) {
    ctx.lineWidth = rnd() * 1.2;
    ctx.beginPath();
    const x = rnd() * size, y = rnd() * size, a = rnd() * TAU, l = 10 + rnd() * 60;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  return c;
}

function drawDial(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const C = size / 2, R = size / 2;

  const g = ctx.createRadialGradient(C, C * 0.85, R * 0.1, C, C, R);
  g.addColorStop(0, '#f8efd9');
  g.addColorStop(0.7, '#efe1bf');
  g.addColorStop(1, '#cdb281');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // Пятна старой бумаги.
  for (let i = 0; i < 9000; i++) {
    const r = Math.random() * R, a = Math.random() * TAU;
    ctx.fillStyle = `rgba(120,85,30,${Math.random() * 0.06})`;
    ctx.fillRect(C + Math.cos(a) * r, C + Math.sin(a) * r, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * size, y = Math.random() * size, r = 30 + Math.random() * 90;
    const sg = ctx.createRadialGradient(x, y, 0, x, y, r);
    sg.addColorStop(0, 'rgba(150,105,40,0.07)');
    sg.addColorStop(1, 'rgba(150,105,40,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  const ink = '#2a1f14', gold = '#a8822f', deep = '#6f4710';
  const ring = (r, w, col = ink) => {
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.arc(C, C, r, 0, TAU); ctx.stroke();
  };
  ring(R * 0.975, size * 0.004);
  ring(R * 0.955, size * 0.0015);
  ring(R * 0.865, size * 0.0015);
  ring(R * 0.73, size * 0.003);
  ring(R * 0.715, size * 0.001, gold);

  // Шкала градусов.
  ctx.strokeStyle = ink;
  for (let d = 0; d < 360; d += 2) {
    const a = (d - 90) * Math.PI / 180;
    const major = d % 10 === 0, mid = d % 30 === 0;
    const r1 = R * 0.952, r2 = R * (mid ? 0.875 : major ? 0.9 : 0.925);
    ctx.lineWidth = size * (mid ? 0.003 : major ? 0.002 : 0.0012);
    ctx.beginPath();
    ctx.moveTo(C + Math.cos(a) * r1, C + Math.sin(a) * r1);
    ctx.lineTo(C + Math.cos(a) * r2, C + Math.sin(a) * r2);
    ctx.stroke();
  }

  // Цифры и стороны света.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let d = 0; d < 360; d += 30) {
    const a = (d - 90) * Math.PI / 180;
    const card = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[d];
    ctx.save();
    ctx.translate(C + Math.cos(a) * R * 0.795, C + Math.sin(a) * R * 0.795);
    ctx.rotate(a + Math.PI / 2);
    if (card) {
      ctx.fillStyle = card === 'N' ? '#8f3a28' : ink;
      ctx.font = `600 ${size * 0.085}px "Playfair Display", Georgia, serif`;
      ctx.fillText(card, 0, 0);
    } else {
      ctx.fillStyle = ink;
      ctx.font = `500 ${size * 0.034}px "Playfair Display", Georgia, serif`;
      ctx.fillText(String(d), 0, 0);
    }
    ctx.restore();
  }

  // Роза ветров: 16 лучей, каждый из светлой и тёмной половинок.
  const point = (deg, len, wid, dark, light) => {
    const a = (deg - 90) * Math.PI / 180;
    const tip = [C + Math.cos(a) * len, C + Math.sin(a) * len];
    const l = [C + Math.cos(a - Math.PI / 2) * wid, C + Math.sin(a - Math.PI / 2) * wid];
    const r = [C + Math.cos(a + Math.PI / 2) * wid, C + Math.sin(a + Math.PI / 2) * wid];
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.moveTo(C, C); ctx.lineTo(...tip); ctx.lineTo(...l); ctx.closePath(); ctx.fill();
    ctx.fillStyle = light;
    ctx.beginPath(); ctx.moveTo(C, C); ctx.lineTo(...tip); ctx.lineTo(...r); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = size * 0.0012;
    ctx.beginPath(); ctx.moveTo(...l); ctx.lineTo(...tip); ctx.lineTo(...r); ctx.stroke();
  };
  for (let d = 11.25; d < 360; d += 22.5) point(d, R * 0.38, R * 0.035, '#8a6a33', '#ead7a8');
  for (let d = 45; d < 360; d += 90) point(d, R * 0.52, R * 0.06, deep, '#e3c98d');
  ring(R * 0.3, size * 0.0015, gold);
  for (let d = 0; d < 360; d += 90) point(d, R * 0.7, R * 0.085, ink, '#d9b866');

  ctx.fillStyle = gold;
  ctx.beginPath(); ctx.arc(C, C, R * 0.05, 0, TAU); ctx.fill();

  // Подпись внизу циферблата.
  ctx.fillStyle = 'rgba(42,31,20,0.75)';
  ctx.font = `600 ${size * 0.024}px "Bodoni Moda", "Playfair Display", serif`;
  ctx.fillText('M I K O V A', C, C + R * 0.57);
  ctx.font = `italic ${size * 0.02}px "Playfair Display", serif`;
  ctx.fillText('21 день · одна цель', C, C + R * 0.62);
  return c;
}

function drawGuilloche(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const C = size / 2;
  ctx.fillStyle = '#9a9a9a';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.2;
  for (let k = 0; k < 48; k++) {
    ctx.beginPath();
    for (let i = 0; i <= 720; i++) {
      const a = (i / 720) * TAU;
      const r = C * 0.12 + k * C * 0.018 + Math.sin(a * 18 + k * 0.4) * C * 0.012;
      const x = C + Math.cos(a) * r, y = C + Math.sin(a) * r;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  for (let k = 0; k < 40; k++) {
    ctx.beginPath();
    ctx.arc(C, C, C * 0.14 + k * C * 0.021, 0, TAU);
    ctx.stroke();
  }
  return c;
}

// ---------- Геометрия ----------

function lathe(points, segs = 128) {
  const g = new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segs);
  g.rotateX(Math.PI / 2);
  return g;
}

function gearShape(teeth, rOuter, rRoot, holeR, spokes) {
  const s = new THREE.Shape();
  const step = TAU / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts = [
      [rRoot, a], [rRoot, a + step * 0.12], [rOuter, a + step * 0.3],
      [rOuter, a + step * 0.55], [rRoot, a + step * 0.73],
    ];
    pts.forEach(([r, t], j) => {
      const x = Math.cos(t) * r, y = Math.sin(t) * r;
      i === 0 && j === 0 ? s.moveTo(x, y) : s.lineTo(x, y);
    });
  }
  s.closePath();
  const hub = new THREE.Path();
  hub.absarc(0, 0, holeR, 0, TAU, true);
  s.holes.push(hub);
  if (spokes) {
    // Окна между спицами.
    const rin = holeR * 2.2, rout = rRoot * 0.78, gap = 0.22;
    for (let i = 0; i < spokes; i++) {
      const a0 = (i / spokes) * TAU + gap, a1 = ((i + 1) / spokes) * TAU - gap;
      const p = new THREE.Path();
      p.absarc(0, 0, rout, a0, a1, false);
      p.absarc(0, 0, rin, a1, a0, true);
      p.closePath();
      s.holes.push(p);
    }
  }
  return s;
}

class Helix extends THREE.Curve {
  constructor(r, len, turns) { super(); this.r = r; this.len = len; this.turns = turns; }
  getPoint(t, target = new THREE.Vector3()) {
    const a = t * this.turns * TAU;
    return target.set(t * this.len - this.len / 2, Math.cos(a) * this.r, Math.sin(a) * this.r);
  }
}

// ---------- Сцена ----------

export function createCompass(canvas, { onReady } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 10.5);

  const key = new THREE.DirectionalLight(0xffe2b0, 2.4);
  key.position.set(-4, 5, 6);
  const rim = new THREE.DirectionalLight(0xfff4dd, 1.4);
  rim.position.set(5, -2, -4);
  scene.add(key, rim, new THREE.AmbientLight(0xfff1d6, 0.25));

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const rough = new THREE.CanvasTexture(noiseCanvas(256, 120, 70, 7));
  rough.wrapS = rough.wrapT = THREE.RepeatWrapping;
  rough.repeat.set(3, 3);

  const metal = (color, roughness = 0.28, extra = {}) => new THREE.MeshPhysicalMaterial({
    color, metalness: 1, roughness, roughnessMap: rough, clearcoat: 0.35, clearcoatRoughness: 0.2,
    envMapIntensity: 1.25, ...extra,
  });
  const M = {
    gold: metal(0xd9ab55, 0.24),
    oldGold: metal(0xb98a36, 0.32),
    brass: metal(0xc9a05a, 0.38),
    rose: metal(0xd29a6f, 0.3),
    steel: metal(0xb8bcc2, 0.3, { clearcoat: 0.1 }),
    blued: metal(0x26304d, 0.22),
    red: new THREE.MeshPhysicalMaterial({ color: 0x9c2f1e, metalness: 0.45, roughness: 0.3, clearcoat: 0.8 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1a1510, metalness: 0.4, roughness: 0.6 }),
    ruby: new THREE.MeshPhysicalMaterial({ color: 0xc0182c, metalness: 0, roughness: 0.05, transmission: 0.4, thickness: 0.2, ior: 1.77, clearcoat: 1 }),
  };

  const root = new THREE.Group();
  scene.add(root);
  const parts = [];
  // home: собранное положение, off: смещение при разлёте, rot: поворот при разлёте.
  const add = (obj, off, rot = [0, 0, 0], delay = 0) => {
    Object.assign(obj.userData, { home: obj.position.clone(), homeRot: obj.rotation.clone(), off: new THREE.Vector3(...off), rot, delay });
    root.add(obj);
    parts.push(obj);
    return obj;
  };
  const mesh = (geo, mat) => new THREE.Mesh(geo, mat);

  // 1. Задняя крышка корпуса.
  const back = mesh(lathe([[0, -0.3], [1.3, -0.3], [1.5, -0.28], [1.6, -0.22], [1.65, -0.14], [1.66, -0.08]]),
    metal(0xc69a47, 0.3, { side: THREE.DoubleSide }));
  add(back, [0, 0, -2.7], [0.25, 0, 0], 0);

  // 2. Платина механизма с гильошированием.
  const guil = new THREE.CanvasTexture(drawGuilloche(512));
  guil.anisotropy = maxAniso;
  const plate = new THREE.Group();
  plate.add(mesh(new THREE.CircleGeometry(1.5, 96), metal(0xd0a75e, 0.42, { roughnessMap: guil, bumpMap: guil, bumpScale: 0.6 })));
  const plateEdge = mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.04, 96, 1, true), M.oldGold);
  plateEdge.rotation.x = Math.PI / 2;
  plateEdge.position.z = -0.02;
  plate.add(plateEdge);
  plate.position.z = -0.2;
  add(plate, [0, 0, -2.0], [0, 0, 0.3], 0.03);

  // 3–6. Шестерёнки.
  const gear = (teeth, ro, rr, hole, spokes, depth, mat, pos, off, rot, delay) => {
    const g = mesh(new THREE.ExtrudeGeometry(gearShape(teeth, ro, rr, hole, spokes), {
      depth, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 6,
    }), mat);
    g.geometry.center();
    const axle = mesh(new THREE.CylinderGeometry(hole * 0.95, hole * 0.95, depth * 3.2, 24), M.steel);
    axle.rotation.x = Math.PI / 2;
    g.add(axle);
    g.position.set(...pos);
    add(g, off, rot, delay);
    g.userData.spin = ((teeth / 2) % 2 ? 1 : -1) / teeth;
    return g;
  };
  const gears = [
    gear(28, 0.62, 0.56, 0.06, 5, 0.05, M.gold, [-0.55, 0.35, -0.14], [-1.35, 1.0, -1.3], [0.4, 0.7, 0], 0.08),
    gear(18, 0.42, 0.37, 0.05, 4, 0.05, M.rose, [0.5, 0.48, -0.12], [1.3, 1.1, -0.95], [-0.5, 0.4, 0], 0.1),
    gear(22, 0.38, 0.33, 0.05, 3, 0.04, M.steel, [0.32, -0.55, -0.13], [1.25, -1.15, -1.45], [0.6, -0.5, 0], 0.12),
    gear(12, 0.24, 0.2, 0.04, 0, 0.06, M.brass, [-0.62, -0.58, -0.1], [-1.45, -1.2, -0.8], [-0.3, -0.8, 0], 0.14),
  ];

  // 7–8. Пружины.
  const spring = (pos, off, rot, delay) => {
    const s = mesh(new THREE.TubeGeometry(new Helix(0.07, 0.55, 9), 220, 0.012, 8), M.steel);
    s.position.set(...pos);
    s.rotation.z = Math.atan2(pos[1], pos[0]) + Math.PI / 2;
    return add(s, off, rot, delay);
  };
  spring([-1.05, -0.05, -0.12], [-1.5, 0.15, -0.4], [0.8, 1.2, 0.6], 0.16);
  spring([1.05, -0.1, -0.12], [1.55, -0.2, -0.3], [-0.6, 0.9, -0.8], 0.18);

  // 9–12. Винты.
  const screwGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.035, 24);
  const shankGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.2, 12);
  const slotGeo = new THREE.BoxGeometry(0.11, 0.012, 0.02);
  [45, 135, 225, 315].forEach((deg, i) => {
    const a = deg * Math.PI / 180;
    const s = new THREE.Group();
    const head = mesh(screwGeo, M.blued); head.rotation.x = Math.PI / 2;
    const shank = mesh(shankGeo, M.steel); shank.rotation.x = Math.PI / 2; shank.position.z = -0.11;
    const slot = mesh(slotGeo, M.dark); slot.position.z = 0.012; slot.rotation.z = a;
    s.add(head, shank, slot);
    s.position.set(Math.cos(a) * 1.28, Math.sin(a) * 1.28, -0.16);
    add(s, [Math.cos(a) * 1.0, Math.sin(a) * 1.0, -0.2 + i * 0.25], [1.4 + i, 0.9, 0], 0.2 + i * 0.015);
  });

  // 13. Рубиновый камень.
  const jewel = mesh(new THREE.OctahedronGeometry(0.075, 0), M.ruby);
  jewel.position.z = -0.08;
  add(jewel, [0, 0.35, -0.55], [1, 1.5, 0], 0.22);

  // 14. Циферблат.
  const dialTex = new THREE.CanvasTexture(drawDial(2048));
  dialTex.colorSpace = THREE.SRGBColorSpace;
  dialTex.anisotropy = maxAniso;
  const dial = new THREE.Group();
  dial.add(mesh(new THREE.CircleGeometry(1.46, 128),
    new THREE.MeshPhysicalMaterial({ map: dialTex, roughness: 0.55, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.4 })));
  const dialEdge = mesh(new THREE.CylinderGeometry(1.46, 1.46, 0.03, 128, 1, true), M.oldGold);
  dialEdge.rotation.x = Math.PI / 2;
  dialEdge.position.z = -0.015;
  dial.add(dialEdge);
  dial.position.z = 0.0;
  add(dial, [0, 0, 0.25], [0, 0, 0], 0.26);

  // 15. Внутреннее кольцо циферблата.
  const chapter = mesh(new THREE.TorusGeometry(1.45, 0.028, 16, 160), M.gold);
  chapter.position.z = 0.02;
  add(chapter, [0, 0, 0.75], [0, 0, 0], 0.3);

  // 16. Стрелка.
  const needle = new THREE.Group();
  const half = (sign, mat) => {
    const s = new THREE.Shape();
    s.moveTo(0, sign * 1.12); s.lineTo(0.1, 0); s.lineTo(-0.1, 0); s.closePath();
    const m = mesh(new THREE.ExtrudeGeometry(s, { depth: 0.015, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.012, bevelSegments: 2 }), mat);
    return m;
  };
  needle.add(half(1, M.red), half(-1, M.blued));
  const ringN = mesh(new THREE.TorusGeometry(0.075, 0.022, 12, 40), M.gold);
  ringN.position.z = 0.015;
  needle.add(ringN);
  needle.position.z = 0.06;
  add(needle, [0, 0, 1.25], [0, 0, 0.9], 0.34);

  // 17. Колпачок оси.
  const cap = new THREE.Group();
  const capDome = mesh(new THREE.SphereGeometry(0.06, 32, 16, 0, TAU, 0, Math.PI / 2), M.gold);
  capDome.rotation.x = Math.PI / 2;
  cap.add(capDome);
  cap.position.z = 0.09;
  add(cap, [0, 0, 1.7], [0, 0, 0], 0.38);

  // 18. Выпуклое стекло.
  const Rs = 5, theta = Math.asin(1.5 / Rs);
  const glassGeo = new THREE.SphereGeometry(Rs, 96, 12, 0, TAU, 0, theta);
  glassGeo.rotateX(Math.PI / 2);
  glassGeo.translate(0, 0, -Rs * Math.cos(theta) + 0.14);
  const glass = mesh(glassGeo, new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.16,
    clearcoat: 1, envMapIntensity: 2.6, depthWrite: false,
  }));
  glass.renderOrder = 2;
  add(glass, [0, 0, 2.2], [0, 0.15, 0], 0.42);

  // 19. Безель с насечкой по краю.
  const bezel = new THREE.Group();
  bezel.add(mesh(lathe([[1.42, 0.09], [1.64, 0.09], [1.7, 0.13], [1.7, 0.18], [1.64, 0.23], [1.52, 0.25], [1.45, 0.23], [1.42, 0.18], [1.42, 0.09]]), M.gold));
  const knurl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.03, 0.08), M.oldGold, 150);
  const tmp = new THREE.Object3D();
  for (let i = 0; i < 150; i++) {
    const a = (i / 150) * TAU;
    tmp.position.set(Math.cos(a) * 1.7, Math.sin(a) * 1.7, 0.155);
    tmp.rotation.set(0, 0, a);
    tmp.updateMatrix();
    knurl.setMatrixAt(i, tmp.matrix);
  }
  bezel.add(knurl);
  add(bezel, [0, 0, 2.75], [0, 0, -0.4], 0.46);

  // 20. Средняя часть корпуса.
  const middle = mesh(lathe([[1.5, -0.12], [1.66, -0.12], [1.72, -0.04], [1.72, 0.04], [1.66, 0.1], [1.5, 0.1], [1.5, -0.12]]), M.gold);
  add(middle, [0, 0, -0.5], [0, 0, 0], 0.05);

  // 21. Заводная головка с ушком.
  const crown = new THREE.Group();
  const stem = mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.24, 24), M.oldGold);
  stem.position.y = 1.82;
  const knob = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.18, 40), M.gold);
  knob.position.y = 2.02;
  const ridges = new THREE.InstancedMesh(new THREE.BoxGeometry(0.025, 0.17, 0.025), M.oldGold, 28);
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * TAU;
    tmp.position.set(Math.cos(a) * 0.16, 2.02, Math.sin(a) * 0.16);
    tmp.rotation.set(0, -a, 0);
    tmp.updateMatrix();
    ridges.setMatrixAt(i, tmp.matrix);
  }
  const bow = mesh(new THREE.TorusGeometry(0.3, 0.05, 20, 64), M.gold);
  bow.position.y = 2.38;
  crown.add(stem, knob, ridges, bow);
  add(crown, [0, 0.45, 0.3], [0, 0.8, 0], 0.5);

  // ---------- Тень и тёплый свет лампы ----------

  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 256;
  {
    const sx = shadowCanvas.getContext('2d');
    const g = sx.createRadialGradient(128, 128, 20, 128, 128, 128);
    g.addColorStop(0, 'rgba(70,45,15,0.55)');
    g.addColorStop(0.55, 'rgba(70,45,15,0.22)');
    g.addColorStop(1, 'rgba(70,45,15,0)');
    sx.fillStyle = g;
    sx.fillRect(0, 0, 256, 256);
  }
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false, toneMapped: false }));
  shadow.renderOrder = -1;
  scene.add(shadow);

  const lamp = new THREE.PointLight(0xffb066, 55, 0, 2);
  scene.add(lamp);

  // ---------- Маршрут: детали выстраиваются в 21 точку, как дни челленджа ----------

  const box = new THREE.Box3(), sphere = new THREE.Sphere();
  scene.updateMatrixWorld(true);
  for (const p of parts) {
    box.setFromObject(p).getBoundingSphere(sphere);
    p.userData.radius = Math.max(0.05, sphere.radius);
    // Центр детали относительно её точки привязки: без этого головка с ушком съезжает с маршрута.
    p.userData.center = sphere.center.clone().sub(p.position);
  }
  // Порядок на маршруте: от задней крышки к стеклу, как собирали.
  const routeOrder = [...parts].sort((a, b) => a.userData.home.z - b.userData.home.z);
  routeOrder.forEach((p, i) => { p.userData.routeIdx = i; });
  const routePts = [];
  let routeR = 0.1;
  // Пунктирная тропа между деталями, как маршрут на сайте Оксаны.
  const routeLine = new THREE.Line(new THREE.BufferGeometry(),
    new THREE.LineDashedMaterial({ color: 0xb47a28, dashSize: 0.09, gapSize: 0.08, transparent: true, opacity: 0 }));
  scene.add(routeLine);

  function layoutRoute() {
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const halfW = halfH * camera.aspect;
    routePts.length = 0;
    if (portrait) {
      // Змейка из трёх рядов по 7: три недели.
      const w = halfW * 0.78, rowH = halfH * 0.2;
      for (let i = 0; i < 21; i++) {
        const row = Math.floor(i / 7), col = i % 7;
        const x = -w + (row % 2 ? 6 - col : col) * (2 * w / 6);
        routePts.push(new THREE.Vector3(x, halfH * 0.3 - row * rowH + Math.sin(col * 0.9) * 0.08, 0));
      }
      routeR = (2 * w / 6) * 0.36;
    } else {
      const w = halfW * 0.82;
      for (let i = 0; i < 21; i++) {
        const t = i / 20;
        routePts.push(new THREE.Vector3(-w + t * 2 * w, halfH * 0.02 + Math.sin(t * Math.PI * 3) * halfH * 0.16, 0));
      }
      routeR = (2 * w / 20) * 0.38;
    }
    const curve = new THREE.CatmullRomCurve3(routePts.map((v) => v.clone().setZ(-0.3)));
    routeLine.geometry.setFromPoints(curve.getPoints(400));
    routeLine.computeLineDistances();
  }

  // ---------- Анимация ----------

  let explode = 0, target = 0, route = 0, routeTarget = 0, portrait = false;
  const pointer = { x: 0, y: 0, sx: 0, sy: 0, moved: false };
  const tilt = { gamma: null };
  const needleSpring = { a: 0, v: 0 };
  let visible = true, raf = 0;
  const clock = new THREE.Clock();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tmpV = new THREE.Vector3();

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    portrait = w / h < 0.9;
    camera.position.z = portrait ? 15 : 10.5;
    camera.updateProjectionMatrix();
    layoutRoute();
  }

  // Куда смотрит стрелка: на курсор, а на телефоне по наклону.
  function needleTarget(time) {
    if (tilt.gamma !== null) return THREE.MathUtils.degToRad(Math.max(-60, Math.min(60, tilt.gamma))) * -1.4;
    if (pointer.moved) {
      tmpV.setFromMatrixPosition(root.matrixWorld).project(camera);
      const dx = pointer.x - tmpV.x, dy = -pointer.y - tmpV.y;
      return -Math.atan2(dx * camera.aspect, dy);
    }
    return reduce ? 0 : Math.sin(time * 1.3) * 0.05 + Math.sin(time * 0.37) * 0.04;
  }

  function update(time) {
    const k = reduce ? 1 : 0.12;
    explode += (target - explode) * k;
    route += (routeTarget - route) * k;
    const e = explode;
    const maxDelay = 0.5;
    for (const p of parts) {
      const { home, homeRot, off, rot, delay, radius, center, routeIdx } = p.userData;
      const t = ease(clamp01((e * (1 + maxDelay) - delay)));
      const r = ease(clamp01(route * 1.4 - (routeIdx / 20) * 0.4));
      const rp = routePts[routeIdx] || home;
      const sc = routeR / radius;
      p.position.set(
        lerp(home.x + off.x * t, rp.x - center.x * sc, r),
        lerp(home.y + off.y * t, rp.y - center.y * sc, r),
        lerp(home.z + off.z * t, rp.z - center.z * sc, r),
      );
      p.rotation.set(
        lerp(homeRot.x + rot[0] * t, 0, r),
        lerp(homeRot.y + rot[1] * t, 0, r),
        homeRot.z + rot[2] * t,
      );
      p.scale.setScalar(lerp(1, sc, r));
    }
    // Шестерёнки крутятся, пока компас открыт.
    gears.forEach((g) => { g.userData.homeRot.z += g.userData.spin * 0.6 * Math.max(e, route); });
    // Стрелка как у настоящего компаса: тянется к цели с лёгким перелётом.
    const goal = needleTarget(time);
    let diff = goal - needleSpring.a;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    needleSpring.v = (needleSpring.v + diff * 0.03) * 0.9;
    needleSpring.a += needleSpring.v;
    needle.userData.homeRot.z = needleSpring.a;

    pointer.sx += (pointer.x - pointer.sx) * 0.05;
    pointer.sy += (pointer.y - pointer.sy) * 0.05;
    const idle = reduce ? 0 : Math.sin(time * 0.5) * 0.04;
    const se = ease(clamp01(e));
    const sr = ease(clamp01(route));
    if (portrait) {
      root.rotation.set(-0.25 - se * 0.95 + pointer.sy * 0.15, 0.25 - se * 0.15 + pointer.sx * 0.25 + idle, se * 0.15);
      root.position.set(0, lerp(1.45, 1.3, se), 0);
      root.scale.setScalar(lerp(0.68, 0.62, se));
    } else {
      root.rotation.set(-0.3 + se * 0.12 + pointer.sy * 0.15, -0.35 + se * 1.25 + pointer.sx * 0.25 + idle, se * 0.12);
      root.position.set(lerp(1.85, 0.75, se), lerp(-0.25, -0.2, se), 0);
      root.scale.setScalar(lerp(0.92, 0.8, se));
    }
    // На маршруте корпус встаёт ровно к экрану, чтобы точки легли в линию.
    if (sr > 0) {
      root.rotation.set(lerp(root.rotation.x, 0, sr), lerp(root.rotation.y, 0, sr), lerp(root.rotation.z, 0, sr));
      root.position.lerp(tmpV.set(0, 0, 0), sr);
      root.scale.setScalar(lerp(root.scale.x, 1, sr));
    }
    root.updateMatrixWorld();
    routeLine.material.opacity = ease(clamp01(route * 1.6 - 0.5)) * 0.85;
    glass.material.opacity = lerp(0.16, 0.55, sr);

    // Мягкая тень позади компаса, исчезает, когда он разлетается.
    shadow.position.set(root.position.x + 0.35 * root.scale.x, root.position.y - 0.45 * root.scale.x, -1.4);
    shadow.scale.setScalar(root.scale.x * 1.05);
    shadow.material.opacity = (1 - se) * 0.9;

    // Тёплая лампа медленно ходит перед компасом и даёт бегущие блики.
    const la = reduce ? 0.6 : time * 0.35;
    lamp.position.set(root.position.x + Math.cos(la) * 2.6, root.position.y + 1.6 + Math.sin(la * 1.3) * 0.8, 3.2);
  }

  function frame() {
    raf = 0;
    if (!visible) return;
    const time = clock.getElapsedTime();
    update(time);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  window.addEventListener('pointermove', (ev) => {
    if (ev.pointerType !== 'mouse') return;
    pointer.x = (ev.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (ev.clientY / window.innerHeight) * 2 - 1;
    pointer.moved = true;
  }, { passive: true });

  // Наклон телефона. На iPhone браузер спрашивает разрешение после первого касания.
  const onTilt = (ev) => { if (ev.gamma !== null) tilt.gamma = ev.gamma; };
  if ('DeviceOrientationEvent' in window) {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      window.addEventListener('touchend', () => {
        DeviceOrientationEvent.requestPermission()
          .then((r) => { if (r === 'granted') window.addEventListener('deviceorientation', onTilt); })
          .catch(() => {});
      }, { once: true });
    } else {
      window.addEventListener('deviceorientation', onTilt);
    }
  }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(frame);
  }).observe(canvas);

  // Текстура циферблата рисуется шрифтом сайта, перерисуем, когда шрифты загрузятся.
  document.fonts?.ready.then(() => {
    dialTex.image = drawDial(2048);
    dialTex.needsUpdate = true;
  });

  raf = requestAnimationFrame(frame);
  onReady?.();

  return {
    setProgress(v, r = 0) { target = clamp01(v); routeTarget = clamp01(r); },
    partsCount: parts.length,
  };
}
