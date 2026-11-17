// Arriba — utilidades comunes (puente con el teléfono, cámara, análisis de imagen)
'use strict';

// ---------- Puente con Android (con un simulador para probar en la compu) ----------
const A = window.Android || (() => {
  const ls = (k, d) => localStorage.getItem('arriba_' + k) || d;
  const set = (k, v) => localStorage.setItem('arriba_' + k, v);
  console.warn('Modo simulador: sin Android');
  return {
    getAlarms: () => ls('alarms', '[]'), saveAlarms: j => (set('alarms', j), '{"time":0,"id":-1}'),
    nextAlarm: () => '{"time":0,"id":-1}', testAlarm: () => {},
    getRefs: () => ls('refs', '[]'), saveRefs: j => set('refs', j),
    getSettings: () => ls('settings', '{}'), saveSettings: j => set('settings', j),
    history: () => '[]',
    ringInfo: () => JSON.stringify({ id: 1, alarm: JSON.parse(ls('alarms', '[]'))[0] || { missions: ['math', 'memory'], count: 2, difficulty: 'normal', snoozeMax: 1, snoozeMin: 5, label: 'Prueba' }, snoozes: 0, lastMission: '' }),
    setLastMission: () => {}, ping: () => {}, missionDone: () => alert('Misión cumplida: alarma apagada'), snooze: () => true,
    labelImage: (d, cb) => setTimeout(() => window.__cb(cb, [{ t: 'Prueba', c: .9 }]), 300),
    scanBarcode: (d, cb) => setTimeout(() => window.__cb(cb, []), 200),
    hasStepSensor: () => false, hasLightSensor: () => true,
    startSensor: () => true, stopSensors: () => {},
    previewSound: () => {}, stopPreview: () => {}, vibrate: () => {}, openUrl: u => window.open(u),
    permissions: () => '{"notifications":true,"fullscreen":true,"overlay":false,"exact":true,"battery":false,"camera":true,"activity":true}',
    requestPermission: () => {},
  };
})();

const cbs = {};
let cbSeq = 0;
window.__cb = (id, data) => { const f = cbs[id]; delete cbs[id]; if (f) f(typeof data === 'string' ? JSON.parse(data) : data); };
function nativeAsync(method, arg) {
  return new Promise(res => { const id = 'c' + (++cbSeq); cbs[id] = res; A[method](arg, id); });
}

// Sensores: los datos llegan desde Android a window.__sensor
const sensorSubs = new Set();
window.__sensor = (kind, data) => { sensorSubs.forEach(f => f(kind, data)); };
function onSensor(f) { sensorSubs.add(f); return () => sensorSubs.delete(f); }

const J = s => { try { return JSON.parse(s); } catch (e) { return null; } };
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const pad = n => String(n).padStart(2, '0');
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(msg, ms = 2200) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), ms);
}

// ---------- Cámara ----------
async function startCamera(video) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false,
  });
  video.srcObject = stream;
  video.setAttribute('playsinline', '');
  video.muted = true;
  await video.play();
  return () => stream.getTracks().forEach(t => t.stop());
}

/** Captura el cuadro actual de la cámara en un canvas (lado mayor = max). */
function grab(video, max = 640) {
  const w = video.videoWidth, h = video.videoHeight;
  const s = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * s); c.height = Math.round(h * s);
  c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
  return c;
}

// ---------- Análisis de imagen (para comparar fotos y colores) ----------
function rgb2hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, mx ? d / mx : 0, mx];
}

/** Huella de una imagen: histograma de color + mapa de luces 8x8 (zona central) */
function fingerprint(canvas) {
  const S = 96;
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const cx = c.getContext('2d');
  // recorte cuadrado central (lo que está dentro del marco)
  const side = Math.min(canvas.width, canvas.height) * 0.8;
  cx.drawImage(canvas, (canvas.width - side) / 2, (canvas.height - side) / 2, side, side, 0, 0, S, S);
  const d = cx.getImageData(0, 0, S, S).data;
  const hist = new Array(12 * 3 * 3).fill(0);
  const grid = new Array(64).fill(0);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    const [h, s, v] = rgb2hsv(d[i], d[i + 1], d[i + 2]);
    const hb = Math.min(11, Math.floor(h / 30)), sb = Math.min(2, Math.floor(s * 3)), vb = Math.min(2, Math.floor(v * 3));
    hist[(sb === 0 ? 0 : hb) * 9 + sb * 3 + vb]++;
    grid[Math.floor(y / 12) * 8 + Math.floor(x / 12)] += (d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11);
  }
  const tot = S * S;
  return { hist: hist.map(v => +(v / tot).toFixed(4)), grid: grid.map(v => Math.round(v / 144)) };
}

function histSim(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += Math.min(a[i], b[i]); return s; }
function gridCorr(a, b) {
  const n = a.length, ma = a.reduce((x, y) => x + y) / n, mb = b.reduce((x, y) => x + y) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da && db ? num / Math.sqrt(da * db) : 0;
}
// Etiquetas demasiado genéricas: no sirven para distinguir un objeto de otro
const GENERIC = new Set(['Room', 'Wall', 'Darkness', 'Light', 'Pattern', 'Event', 'Fun', 'Selfie', 'Smile', 'Skin', 'Hand', 'Finger', 'Interior design', 'Sky', 'Bedroom', 'Ceiling', 'Night', 'Space', 'Moon', 'Flesh', 'Ear', 'Hair', 'Beard', 'Eyelash', 'Bangs']);
function labelSim(la, lb) {
  const A1 = new Map(la.filter(l => l.c >= .45 && !GENERIC.has(l.t)).map(l => [l.t, l.c]));
  let shared = 0;
  lb.forEach(l => { if (l.c >= .45 && A1.has(l.t)) shared++; });
  return shared >= 2 ? 1 : shared === 1 ? .6 : 0;
}
/** Puntaje 0..1 de qué tan parecida es la foto nueva a la registrada */
function photoScore(shot, ref) {
  const h = histSim(shot.hist, ref.hist), g = Math.max(0, gridCorr(shot.grid, ref.grid)), l = labelSim(shot.labels || [], ref.labels || []);
  return { score: .4 * h + .25 * g + .35 * l, h, g, l };
}
const SENS = { facil: .42, normal: .52, estricta: .62 };

/** Fracción de píxeles del centro que son del color pedido */
function colorFraction(canvas, color) {
  const S = 80, c = document.createElement('canvas'); c.width = S; c.height = S;
  const cx = c.getContext('2d');
  const side = Math.min(canvas.width, canvas.height) * 0.7;
  cx.drawImage(canvas, (canvas.width - side) / 2, (canvas.height - side) / 2, side, side, 0, 0, S, S);
  const d = cx.getImageData(0, 0, S, S).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    const [h, s, v] = rgb2hsv(d[i], d[i + 1], d[i + 2]);
    if (s < .38 || v < .22) continue;
    if (color.ranges.some(([a, b]) => h >= a && h < b)) n++;
  }
  return n / (S * S);
}
const COLORS = [
  { id: 'rojo', name: 'ROJO', css: '#e5484d', ranges: [[0, 14], [340, 360]] },
  { id: 'naranja', name: 'NARANJA', css: '#f08a24', ranges: [[14, 40]] },
  { id: 'amarillo', name: 'AMARILLO', css: '#f5d90a', ranges: [[40, 68]] },
  { id: 'verde', name: 'VERDE', css: '#46a758', ranges: [[68, 165]] },
  { id: 'azul', name: 'AZUL', css: '#3e63dd', ranges: [[190, 255]] },
  { id: 'violeta', name: 'VIOLETA o ROSA', css: '#b55bd6', ranges: [[255, 340]] },
];

// ---------- Días ----------
const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
