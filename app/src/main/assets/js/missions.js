// Arriba — misiones para apagar la alarma
'use strict';

const LEVEL = { facil: 0, normal: 1, dificil: 2 };
const lv = (d, arr) => arr[LEVEL[d] ?? 1];

const PHRASES = [
  ['Hoy me levanto con ganas', 'Arriba que el día no espera', 'Ya estoy despierto y de pie'],
  ['Hoy me levanto con ganas y no vuelvo a la cama', 'El que madruga tiene el día entero para hacer lo que quiere', 'Me lavo la cara, tomo agua y arranco el día'],
  ['Hoy no vuelvo a la cama porque tengo un montón de cosas lindas para hacer', 'Cada mañana es una oportunidad nueva y no la voy a desperdiciar durmiendo', 'Me levanto, abro la ventana, tomo un vaso de agua y empiezo el día con todo'],
];

const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]/g, '').replace(/\s+/g, ' ').trim();

function header(el, m, extra = '') {
  el.innerHTML = `<div class="mhead"><div class="badge">${icon(m.icon)}</div><div><h3>${m.name}</h3><p>${extra || m.desc}</p></div></div><div class="mbody" style="flex:1;display:flex;flex-direction:column"></div>`;
  return $('.mbody', el);
}

function counterUI(body, target, unit, hint) {
  body.innerHTML = `<div class="big-count"><span class="n">${target}</span><small>${unit}</small></div>
    <div class="bar"><i></i></div><div class="hint">${hint}</div>`;
  const n = $('.n', body), bar = $('.bar i', body);
  return done => { n.textContent = Math.max(0, target - done); bar.style.width = Math.min(100, done / target * 100) + '%'; };
}

// ---------- Catálogo ----------
const MISSIONS = {

  // 1) Foto de un objeto registrado
  photo: {
    name: 'Foto de un objeto', icon: 'camera', desc: 'Sacale una foto al objeto que registraste (lejos de la cama).',
    needs: ctx => ctx.refs.some(r => r.type === 'photo') ? null : 'Registrá al menos un objeto en la pestaña Objetos',
    run(el, o) {
      const pool = o.refs.filter(r => r.type === 'photo');
      const targets = [];
      const n = Math.min(pool.length, o.difficulty === 'dificil' ? 2 : 1);
      const bag = [...pool].sort(() => Math.random() - .5);
      for (let i = 0; i < n; i++) targets.push(bag[i]);
      let idx = 0, stopCam = null, busy = false;
      const thr = SENS[o.settings.photoSens || 'normal'];

      const show = () => {
        const t = targets[idx];
        const body = header(el, this, `Andá a: <b class="gold">${esc(t.name)}</b>${targets.length > 1 ? ` (${idx + 1} de ${targets.length})` : ''}`);
        body.innerHTML = `<div class="cam"><video></video><div class="frame"></div><img class="ref" src="${t.shots[0].thumb}"></div>
          <div class="result"></div><button class="btn primary shoot">${icon('camera')} Sacar foto</button>
          <div class="hint">Encuadrá el objeto igual que en la foto de referencia.</div>`;
        const video = $('video', body), res = $('.result', body);
        startCamera(video).then(s => stopCam = s).catch(() => { res.className = 'result bad'; res.textContent = 'No se pudo abrir la cámara'; });
        $('.shoot', body).onclick = async () => {
          if (busy || !video.videoWidth) return;
          busy = true; o.ping(); res.className = 'result'; res.textContent = 'Comparando…';
          const c = grab(video, 640);
          const fp = fingerprint(c);
          fp.labels = await nativeAsync('labelImage', c.toDataURL('image/jpeg', .85));
          const best = Math.max(...t.shots.map(s => photoScore(fp, s).score));
          busy = false;
          if (best >= thr) {
            res.className = 'result ok'; res.textContent = '¡Es ese! ✓'; A.vibrate(120);
            stopCam && stopCam(); stopCam = null;
            idx++;
            setTimeout(() => idx >= targets.length ? o.onDone() : show(), 700);
          } else {
            res.className = 'result bad';
            res.textContent = best > thr - .1 ? 'Casi… acercate y encuadrá igual que la referencia' : 'No coincide con el objeto registrado';
            A.vibrate(300);
          }
        };
      };
      show();
      return () => stopCam && stopCam();
    },
  },

  // 2) Escanear un código de barras / QR registrado
  barcode: {
    name: 'Escanear un código', icon: 'scan-barcode', desc: 'Escaneá el código de barras o QR que registraste.',
    needs: ctx => ctx.refs.some(r => r.type === 'code') ? null : 'Registrá un código (por ejemplo, el de la pasta dental)',
    run(el, o) {
      const pool = o.refs.filter(r => r.type === 'code').sort(() => Math.random() - .5);
      const targets = pool.slice(0, o.difficulty === 'dificil' ? 2 : 1);
      let idx = 0, stopCam = null, timer = null, alive = true;
      const show = () => {
        const t = targets[idx];
        const body = header(el, this, `Buscá: <b class="gold">${esc(t.name)}</b>${targets.length > 1 ? ` (${idx + 1} de ${targets.length})` : ''}`);
        body.innerHTML = `<div class="cam"><video></video><div class="frame"></div><div class="scanline"></div></div>
          <div class="result"></div><div class="hint">Apuntá la cámara al código. Se lee solo.</div>`;
        const video = $('video', body), res = $('.result', body);
        startCamera(video).then(s => { stopCam = s; loop(); }).catch(() => { res.className = 'result bad'; res.textContent = 'No se pudo abrir la cámara'; });
        const loop = async () => {
          if (!alive) return;
          if (video.videoWidth) {
            const codes = await nativeAsync('scanBarcode', grab(video, 900).toDataURL('image/jpeg', .85));
            if (!alive) return;
            if (codes.includes(t.code)) {
              res.className = 'result ok'; res.textContent = '¡Código correcto! ✓'; A.vibrate(120);
              stopCam && stopCam(); stopCam = null; idx++;
              setTimeout(() => idx >= targets.length ? o.onDone() : show(), 700);
              return;
            } else if (codes.length) { res.className = 'result bad'; res.textContent = 'Ese no es el código registrado'; o.ping(); }
          }
          timer = setTimeout(loop, 400);
        };
      };
      show();
      return () => { alive = false; clearTimeout(timer); stopCam && stopCam(); };
    },
  },

  // 3) Buscar algo de un color
  color: {
    name: 'Cazá un color', icon: 'palette', desc: 'Sacale una foto a algo del color que te toque.',
    needs: () => null,
    run(el, o) {
      const thr = lv(o.difficulty, [.16, .24, .32]);
      const n = o.difficulty === 'dificil' ? 2 : 1;
      const avoid = (o.settings.lastColor || '');
      const list = COLORS.filter(c => c.id !== avoid).sort(() => Math.random() - .5).slice(0, n);
      let idx = 0, stopCam = null;
      const show = () => {
        const col = list[idx];
        const body = header(el, this, `Buscá algo <b style="color:${col.css}">${col.name}</b> y que ocupe buena parte del marco${n > 1 ? ` (${idx + 1} de ${n})` : ''}`);
        body.innerHTML = `<div class="cam"><video></video><div class="frame" style="border-color:${col.css}"></div><div class="colorswatch" style="background:${col.css}">${col.name}</div></div>
          <div class="result"></div><button class="btn primary shoot">${icon('camera')} Sacar foto</button>`;
        const video = $('video', body), res = $('.result', body);
        startCamera(video).then(s => stopCam = s).catch(() => { res.className = 'result bad'; res.textContent = 'No se pudo abrir la cámara'; });
        $('.shoot', body).onclick = () => {
          if (!video.videoWidth) return;
          o.ping();
          const f = colorFraction(grab(video, 480), col);
          if (f >= thr) {
            res.className = 'result ok'; res.textContent = '¡Bien ahí! ✓'; A.vibrate(120);
            stopCam && stopCam(); stopCam = null; idx++;
            setTimeout(() => idx >= n ? o.onDone() : show(), 700);
          } else {
            res.className = 'result bad';
            res.textContent = f > thr * .5 ? 'Acercate más, que el color llene el marco' : `Eso no es ${col.name.toLowerCase()}`;
            A.vibrate(300);
          }
        };
      };
      o.settings.lastColor = list[0].id; o.saveSettings && o.saveSettings();
      show();
      return () => stopCam && stopCam();
    },
  },

  // 4) Sacudir
  shake: {
    name: 'Sacudí el teléfono', icon: 'vibrate', desc: 'Agarralo fuerte y sacudilo con ganas.',
    needs: () => null,
    run(el, o) {
      const target = lv(o.difficulty, [30, 50, 80]) + rnd(0, 10);
      const body = header(el, this);
      const upd = counterUI(body, target, 'sacudidas', 'Agarralo firme. Los movimientos suaves no cuentan.');
      let count = 0, last = 0;
      const off = onSensor((k, data) => {
        if (k !== 'accel') return;
        for (const [x, y, z, t] of data) {
          const dyn = Math.abs(Math.sqrt(x * x + y * y + z * z) - 9.81);
          if (dyn > 9 && t - last > 180) {
            last = t; count++; o.ping(); upd(count);
            if (count >= target) { A.stopSensors(); off(); A.vibrate(150); setTimeout(o.onDone, 400); return; }
          }
        }
      });
      A.startSensor('accel');
      return () => { off(); A.stopSensors(); };
    },
  },

  // 5) Caminar
  steps: {
    name: 'Caminá', icon: 'footprints', desc: 'Levantate y caminá con el teléfono en la mano.',
    needs: () => null,
    run(el, o) {
      const target = lv(o.difficulty, [20, 40, 70]) + rnd(0, 10);
      const body = header(el, this);
      const upd = counterUI(body, target, 'pasos', 'Caminá por la casa. Sacudir el teléfono no cuenta como pasos.');
      let count = 0, lastShake = 0, now = 0;
      const native = A.hasStepSensor();
      // Respaldo por acelerómetro
      let ema = 9.81, rising = false, prev = 9.81, lastStep = 0, armed = true;
      const step = () => {
        count++; o.ping(); upd(count);
        if (count >= target) { A.stopSensors(); off(); A.vibrate(150); setTimeout(o.onDone, 400); }
      };
      const off = onSensor((k, data) => {
        if (k === 'accel') {
          for (const [x, y, z, t] of data) {
            now = t;
            const mag = Math.sqrt(x * x + y * y + z * z);
            if (Math.abs(mag - 9.81) > 14) lastShake = t; // eso es sacudir, no caminar
            if (native) continue;
            ema = ema * .75 + mag * .25;
            if (ema < 9.5) armed = true;
            if (ema > prev) rising = true;
            else if (rising && prev > 11 && armed && t - lastStep > 300 && t - lastShake > 600) {
              lastStep = t; armed = false; rising = false; step();
            } else rising = false;
            prev = ema;
          }
        } else if (k === 'step') {
          if (now - lastShake > 800) step();
        }
      });
      A.startSensor('accel');
      if (native) A.startSensor('steps');
      return () => { off(); A.stopSensors(); };
    },
  },

  // 6) Sentadillas
  squats: {
    name: 'Sentadillas', icon: 'person-standing', desc: 'Con el teléfono contra el pecho, bajá y subí.',
    needs: () => null,
    run(el, o) {
      const target = lv(o.difficulty, [8, 12, 20]) + rnd(0, 3);
      const body = header(el, this);
      const upd = counterUI(body, target, 'sentadillas', 'Sostené el teléfono contra el pecho y bajá bien. Despacio también cuenta.');
      let g = null, v = 0, phases = 0, state = 0, lastPhase = 0, count = 0;
      const off = onSensor((k, data) => {
        if (k !== 'accel') return;
        for (const [x, y, z, t] of data) {
          if (!g) { g = [x, y, z]; continue; }
          g = [g[0] * .96 + x * .04, g[1] * .96 + y * .04, g[2] * .96 + z * .04];
          const gm = Math.hypot(...g) || 9.81;
          const vert = (x * g[0] + y * g[1] + z * g[2]) / gm - gm; // aceleración vertical sin gravedad
          const raw = Math.abs(Math.hypot(x, y, z) - 9.81);
          if (raw > 12) continue; // sacudón: no cuenta
          v = v * .8 + vert * .2;
          // Cada sentadilla tiene 2 fases (bajar y subir); cada fase = un pico + y un pico − (en cualquier orden)
          if (state === 0 && Math.abs(v) > 1.3) state = Math.sign(v);
          else if (state !== 0 && Math.sign(v) === -state && Math.abs(v) > 1.3) {
            if (t - lastPhase > 350) {
              phases++; lastPhase = t; o.ping();
              const c = Math.floor(phases / 2);
              if (c !== count) {
                count = c; upd(count); A.vibrate(40);
                if (count >= target) { A.stopSensors(); off(); setTimeout(o.onDone, 400); return; }
              }
            }
            state = 0;
          }
        }
      });
      A.startSensor('accel');
      return () => { off(); A.stopSensors(); };
    },
  },

  // 7) Cuentas
  math: {
    name: 'Cuentas', icon: 'calculator', desc: 'Resolvé las cuentas para despertar la cabeza.',
    needs: () => null,
    run(el, o) {
      const total = lv(o.difficulty, [3, 4, 5]);
      const make = () => {
        const d = o.difficulty;
        const type = d === 'facil' ? pick(['+', '+', '-']) : d === 'normal' ? pick(['+', '-', 'x']) : pick(['x+', 'x-', 'xx']);
        let a, b, c, q, r;
        if (type === '+') { a = rnd(12, 69); b = rnd(12, 39); q = `${a} + ${b}`; r = a + b; }
        else if (type === '-') { a = rnd(40, 99); b = rnd(11, a - 5); q = `${a} − ${b}`; r = a - b; }
        else if (type === 'x') { a = rnd(3, 9); b = rnd(12, 29); q = `${a} × ${b}`; r = a * b; }
        else if (type === 'x+') { a = rnd(6, 13); b = rnd(6, 13); c = rnd(11, 59); q = `${a} × ${b} + ${c}`; r = a * b + c; }
        else if (type === 'x-') { a = rnd(6, 13); b = rnd(6, 13); c = rnd(5, 30); q = `${a} × ${b} − ${c}`; r = a * b - c; }
        else { a = rnd(11, 19); b = rnd(11, 19); q = `${a} × ${b}`; r = a * b; }
        return { q, r };
      };
      let done = 0, cur = make(), val = '';
      const body = header(el, this);
      body.innerHTML = `<div class="step-of"></div><div class="problem"></div><div class="answer"></div><div class="result"></div>
        <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('')}<button data-k="del">⌫</button><button data-k="0">0</button><button class="k-ok" data-k="ok">OK</button></div>`;
      const render = () => { $('.step-of', body).textContent = `Cuenta ${done + 1} de ${total}`; $('.problem', body).textContent = cur.q + ' ='; $('.answer', body).textContent = val; };
      render();
      $('.keypad', body).onclick = e => {
        const k = e.target.closest('button')?.dataset.k; if (!k) return;
        o.ping();
        const res = $('.result', body);
        if (k === 'del') val = val.slice(0, -1);
        else if (k === 'ok') {
          if (+val === cur.r && val !== '') {
            done++; A.vibrate(60); res.className = 'result ok'; res.textContent = '✓';
            if (done >= total) return setTimeout(o.onDone, 300);
            cur = make();
          } else { res.className = 'result bad'; res.textContent = 'Incorrecto, otra'; A.vibrate(300); cur = make(); }
          val = '';
        } else if (val.length < 5) val += k;
        render();
      };
      return () => {};
    },
  },

  // 8) Memoria (secuencia de luces)
  memory: {
    name: 'Memoria', icon: 'brain', desc: 'Mirá la secuencia de luces y repetila.',
    needs: () => null,
    run(el, o) {
      const goal = lv(o.difficulty, [4, 6, 8]);
      const body = header(el, this);
      body.innerHTML = `<div class="step-of"></div><div class="simon">${Array.from({ length: 9 }, (_, i) => `<button data-i="${i}"></button>`).join('')}</div><div class="result"></div>`;
      const btns = $$('.simon button', body), res = $('.result', body);
      let seq = [], pos = 0, showing = false, alive = true;
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const play = async () => {
        showing = true; pos = 0;
        $('.step-of', body).textContent = `Secuencia de ${seq.length} · objetivo ${goal}`;
        res.className = 'result'; res.textContent = 'Mirá…';
        await wait(600);
        for (const i of seq) { if (!alive) return; btns[i].classList.add('lit'); await wait(480); btns[i].classList.remove('lit'); await wait(180); }
        res.textContent = 'Tu turno'; showing = false;
      };
      const start = () => { seq = Array.from({ length: 3 }, () => rnd(0, 8)); play(); };
      body.querySelector('.simon').onclick = async e => {
        const b = e.target.closest('button'); if (!b || showing) return;
        o.ping();
        const i = +b.dataset.i;
        b.classList.add('lit'); setTimeout(() => b.classList.remove('lit'), 160);
        if (i !== seq[pos]) {
          b.classList.add('err'); setTimeout(() => b.classList.remove('err'), 400);
          res.className = 'result bad'; res.textContent = 'Error, volvemos a empezar'; A.vibrate(300);
          showing = true; await wait(900); start(); return;
        }
        pos++;
        if (pos >= seq.length) {
          if (seq.length >= goal) { res.className = 'result ok'; res.textContent = '¡Perfecto! ✓'; return setTimeout(o.onDone, 500); }
          seq.push(rnd(0, 8)); showing = true; await wait(500); play();
        }
      };
      start();
      return () => { alive = false; };
    },
  },

  // 9) Escribir una frase
  typing: {
    name: 'Escribí la frase', icon: 'keyboard', desc: 'Copiá la frase exacta (sin pegar).',
    needs: () => null,
    run(el, o) {
      const total = o.difficulty === 'dificil' ? 2 : 1;
      let done = 0;
      const body = header(el, this);
      const show = () => {
        const phrase = pick(lv(o.difficulty, PHRASES));
        body.innerHTML = `<div class="step-of">${total > 1 ? `Frase ${done + 1} de ${total}` : ''}</div><div class="phrase"></div>
          <textarea class="typing" autocapitalize="sentences" autocomplete="off" spellcheck="false" placeholder="Escribí acá…"></textarea>`;
        const ph = $('.phrase', body), ta = $('textarea', body);
        const target = norm(phrase);
        const words = phrase.split(' ');
        const paint = () => {
          const typed = norm(ta.value);
          const tw = typed ? typed.split(' ') : [];
          ph.innerHTML = words.map((w, i) => {
            const nw = norm(w);
            let cls = '';
            if (i < tw.length - 1 || (i === tw.length - 1 && tw[i] === nw)) cls = tw[i] === nw ? 'done' : 'wrong';
            else if (i === tw.length - 1 && !nw.startsWith(tw[i])) cls = 'wrong';
            return cls ? `<span class="${cls}">${esc(w)}</span>` : esc(w);
          }).join(' ');
          if (typed === target) {
            A.vibrate(100); done++; ta.blur();
            setTimeout(() => done >= total ? o.onDone() : show(), 400);
          }
        };
        ta.addEventListener('paste', e => e.preventDefault());
        ta.addEventListener('input', () => { o.ping(); paint(); });
        paint();
        setTimeout(() => ta.focus(), 300);
      };
      show();
      return () => {};
    },
  },

  // 10) Luz
  light: {
    name: 'Prendé la luz', icon: 'lightbulb', desc: 'Prendé la luz o abrí la cortina y apuntá el teléfono a la luz.',
    needs: () => A.hasLightSensor() ? null : 'Este teléfono no tiene sensor de luz',
    run(el, o) {
      const thr = lv(o.difficulty, [60, 120, 250]);
      const hold = 4000;
      const body = header(el, this);
      body.innerHTML = `<div class="sunviz"></div><div class="big-count" style="font-size:60px"><span class="n">0</span><small>lux · necesitás ${thr}</small></div>
        <div class="bar"><i></i></div><div class="hint">Mantené la luz ${hold / 1000} segundos seguidos. La pantalla del teléfono no alcanza: tiene que ser luz de verdad.</div>`;
      const n = $('.n', body), bar = $('.bar i', body), sun = $('.sunviz', body);
      let since = 0, fired = false;
      const off = onSensor((k, lux) => {
        if (k !== 'light' || fired) return;
        n.textContent = Math.round(lux);
        sun.style.opacity = Math.min(1, .15 + lux / thr * .85);
        const t = Date.now();
        if (lux >= thr) { if (!since) since = t; o.ping(); } else since = 0;
        const p = since ? Math.min(1, (t - since) / hold) : 0;
        bar.style.width = p * 100 + '%';
        if (p >= 1) { fired = true; A.stopSensors(); off(); A.vibrate(150); setTimeout(o.onDone, 300); }
      });
      A.startSensor('light');
      return () => { off(); A.stopSensors(); };
    },
  },
};

const MISSION_ORDER = ['photo', 'barcode', 'color', 'steps', 'squats', 'shake', 'light', 'math', 'memory', 'typing'];
const SHORT_DESC = {
  photo: 'Objeto registrado', barcode: 'Código registrado', color: 'Color al azar', steps: 'Contar pasos', squats: 'Ejercicio',
  shake: 'Movimiento', light: 'Sensor de luz', math: 'Cabeza', memory: 'Secuencia', typing: 'Teclado',
};

/**
 * Elige misiones al azar para esta alarma.
 * - solo entre las habilitadas que se pueden hacer en este teléfono
 * - evita repetir la misión con la que arrancó la última vez
 */
function pickMissions(alarm, ctx, lastMission) {
  let pool = (alarm.missions && alarm.missions.length ? alarm.missions : ['math', 'shake', 'memory'])
    .filter(id => MISSIONS[id] && !MISSIONS[id].needs(ctx));
  if (!pool.length) pool = ['math', 'memory', 'typing'];
  const count = Math.min(alarm.count || 1, pool.length);
  let order = [...pool].sort(() => Math.random() - .5);
  if (order.length > 1 && order[0] === lastMission) order.push(order.shift());
  return order.slice(0, count);
}

/** Otra misión distinta a las ya usadas (para "cambiar misión") */
function swapMission(current, used, ctx) {
  const opts = MISSION_ORDER.filter(id => id !== current && !used.includes(id) && !MISSIONS[id].needs(ctx) && !['photo', 'barcode', 'color'].includes(id));
  return pick(opts.length ? opts : ['math', 'typing']);
}
