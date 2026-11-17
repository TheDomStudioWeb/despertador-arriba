// Arriba — pantalla principal
'use strict';

let alarms = J(A.getAlarms()) || [];
let refs = J(A.getRefs()) || [];
const settings = J(A.getSettings()) || {};
const saveSettings = () => A.saveSettings(JSON.stringify(settings));
const saveRefs = () => A.saveRefs(JSON.stringify(refs));
let tab = 'alarms';

const SOUNDS = [['clasico', 'Clásico'], ['digital', 'Digital'], ['sirena', 'Sirena'], ['campanas', 'Campanas'], ['sistema', 'Del teléfono']];
const DIFF = [['facil', 'Fácil'], ['normal', 'Normal'], ['dificil', 'Difícil']];

function saveAlarms() {
  const r = J(A.saveAlarms(JSON.stringify(alarms)));
  renderNext(r);
}

// ---------- Próxima alarma ----------
function untilText(ms) {
  const m = Math.max(1, Math.round(ms / 60000));
  const h = Math.floor(m / 60), mm = m % 60;
  return h ? `${h} h ${mm} min` : `${mm} min`;
}
function renderNext(r) {
  r = r || J(A.nextAlarm());
  $('#next').innerHTML = r && r.time ? `Próxima en<b>${untilText(r.time - Date.now())}</b>` : '';
}

// ---------- Pestañas ----------
const TABS = { alarms: ['alarm-clock', 'Alarmas'], objects: ['box', 'Objetos'], missions: ['target', 'Misiones'], settings: ['settings', 'Ajustes'] };
$$('.tab').forEach(b => {
  const [ic, txt] = TABS[b.dataset.tab];
  b.innerHTML = icon(ic) + txt;
  b.onclick = () => go(b.dataset.tab);
});
function go(t) {
  tab = t;
  $$('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  $$('section[data-view]').forEach(s => s.classList.toggle('hidden', s.dataset.view !== t));
  $('#fab').classList.toggle('hidden', t !== 'alarms');
  render();
  window.scrollTo(0, 0);
}
$('#fab').innerHTML = icon('plus');
$('#fab').onclick = () => openEditor(null);

// ---------- Lista de alarmas ----------
function renderAlarms() {
  const el = $('#alarmList');
  if (!alarms.length) {
    el.innerHTML = `<div class="empty">${icon('alarm-clock')}<div>Todavía no hay alarmas.<br>Tocá <b class="gold">+</b> para crear la primera.</div></div>`;
    return;
  }
  const sorted = [...alarms].sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute));
  el.innerHTML = sorted.map(a => `
    <div class="alarm ${a.enabled ? '' : 'off'}" data-id="${a.id}">
      <div class="time">${pad(a.hour)}:${pad(a.minute)}</div>
      <button class="switch ${a.enabled ? 'on' : ''}" data-sw="${a.id}" aria-label="Activar"></button>
      <div class="meta">
        <div>
          ${a.days && a.days.length ? `<div class="days">${DAYS.map((d, i) => `<span class="${a.days.includes(i + 1) ? 'on' : ''}">${d}</span>`).join('')}</div>` : '<div class="lbl">Una sola vez</div>'}
          ${a.label ? `<div class="lbl">${esc(a.label)}</div>` : ''}
        </div>
        <div class="mini-missions">${(a.missions || []).slice(0, 5).map(m => icon(MISSIONS[m]?.icon || 'target')).join('')}</div>
      </div>
    </div>`).join('');
  $$('.alarm', el).forEach(c => c.onclick = e => {
    const sw = e.target.closest('[data-sw]');
    const a = alarms.find(x => x.id == c.dataset.id);
    if (sw) {
      a.enabled = !a.enabled; saveAlarms(); renderAlarms();
      if (a.enabled) toast(`Suena en ${untilText(nextTime(a) - Date.now())}`);
      return;
    }
    openEditor(a);
  });
}

function nextTime(a) {
  const now = new Date(), t = new Date(now);
  t.setHours(a.hour, a.minute, 0, 0);
  if (t <= now) t.setDate(t.getDate() + 1);
  if (a.days && a.days.length) for (let i = 0; i < 8; i++) { const d = (t.getDay() + 6) % 7 + 1; if (a.days.includes(d)) break; t.setDate(t.getDate() + 1); }
  return t.getTime();
}

// ---------- Permisos ----------
const PERMS = [
  ['notifications', 'Notificaciones', 'Para mostrar la alarma', true],
  ['fullscreen', 'Pantalla completa', 'Que la misión aparezca con el teléfono bloqueado', true],
  ['overlay', 'Mostrar sobre otras apps', 'Que la alarma vuelva si te vas a otra app', true],
  ['exact', 'Alarmas exactas', 'Que suene justo a la hora', true],
  ['battery', 'Sin ahorro de batería', 'Que el teléfono no la cierre de noche', true],
  ['camera', 'Cámara', 'Misiones de foto, color y código', false],
  ['activity', 'Actividad física', 'Contar pasos con el sensor del teléfono', false],
];
function renderPerms() {
  const p = J(A.permissions()) || {};
  $('#perms').innerHTML = PERMS.map(([k, t, d]) => `
    <div class="perm"><div class="dot ${p[k] ? 'ok' : 'bad'}">${p[k] ? '✓' : '✕'}</div>
      <div class="grow"><b>${t}</b><span>${d}</span></div>
      ${p[k] ? '' : `<button class="btn small" data-perm="${k}">Activar</button>`}</div>`).join('');
  $$('[data-perm]').forEach(b => b.onclick = () => A.requestPermission(b.dataset.perm));
  const missing = PERMS.filter(([k, , , crit]) => crit && !p[k]);
  $('#permBanner').innerHTML = missing.length ? `<div class="banner">${icon('bell-ring')}<div><b>Faltan ${missing.length} permiso${missing.length > 1 ? 's' : ''}</b> para que la alarma no falle. <button class="gold" style="font-weight:700" id="goPerms">Revisar</button></div></div>` : '';
  const gp = $('#goPerms'); if (gp) gp.onclick = () => go('settings');
}

// ---------- Editor de alarma ----------
let draft = null;
function openEditor(a) {
  const isNew = !a;
  draft = a ? JSON.parse(JSON.stringify(a)) : {
    id: (alarms.reduce((m, x) => Math.max(m, x.id), 0) || 0) + 1,
    hour: 7, minute: 0, days: [1, 2, 3, 4, 5], enabled: true, label: '',
    missions: ['steps', 'squats', 'color', 'math', 'memory', 'shake'].filter(m => !MISSIONS[m].needs({ refs })),
    count: 2, difficulty: 'normal', snoozeMax: 1, snoozeMin: 5, sound: 'clasico', vibrate: true,
  };
  if (isNew && refs.some(r => r.type === 'photo')) draft.missions.unshift('photo');
  if (isNew && refs.some(r => r.type === 'code')) draft.missions.unshift('barcode');
  const ed = $('#editor');
  ed.innerHTML = `
    <div class="sheet-head"><button class="icon-btn" id="edClose">${icon('chevron-left')}</button><h2>${isNew ? 'Nueva alarma' : 'Editar alarma'}</h2><button class="btn small primary" id="edSave">Guardar</button></div>
    <div class="timepick">
      <div class="wheel"><button data-t="h+">▲</button><div class="v" id="vh"></div><button data-t="h-">▼</button></div>
      <div class="colon">:</div>
      <div class="wheel"><button data-t="m+">▲</button><div class="v" id="vm"></div><button data-t="m-">▼</button></div>
    </div>
    <input type="time" id="nativeTime" style="position:absolute;opacity:0;pointer-events:none;height:0">
    <div class="in-label" id="inLabel"></div>

    <div class="field"><label>Días</label>
      <div class="daychips">${DAYS.map((d, i) => `<button class="chip" data-day="${i + 1}">${d}</button>`).join('')}</div>
      <div class="links"><button data-preset="all">Todos los días</button><button data-preset="week">Lunes a viernes</button><button data-preset="none">Una sola vez</button></div>
    </div>
    <div class="field"><label>Nombre (opcional)</label><input type="text" id="edLabel" maxlength="40" placeholder="Ej: Colegio"></div>

    <div class="field"><label>Misiones posibles (sale una al azar)</label>
      <div class="mission-grid" id="edMissions"></div>
    </div>
    <div class="field"><label>Misiones para apagarla</label><div class="seg" id="edCount"><button data-v="1">1</button><button data-v="2">2</button><button data-v="3">3</button></div></div>
    <div class="field"><label>Dificultad</label><div class="seg" id="edDiff">${DIFF.map(([v, t]) => `<button data-v="${v}">${t}</button>`).join('')}</div></div>
    <div class="field"><label>Posponer</label>
      <div class="seg" id="edSnooze"><button data-v="0">Nunca</button><button data-v="1">1 vez</button><button data-v="2">2 veces</button><button data-v="3">3 veces</button></div>
      <div class="seg" id="edSnoozeMin" style="margin-top:8px"><button data-v="3">3 min</button><button data-v="5">5 min</button><button data-v="10">10 min</button></div>
    </div>
    <div class="field"><label>Sonido</label>
      <div class="chips" id="edSound">${SOUNDS.map(([v, t]) => `<button class="chip" data-v="${v}">${t}</button>`).join('')}</div>
      <div class="links"><button id="edVibrate"></button></div>
    </div>
    <button class="btn" id="edTest" style="margin-top:6px">${icon('play')} Probar alarma (suena en 10 segundos)</button>
    ${isNew ? '' : `<button class="btn danger" id="edDelete" style="margin-top:10px">${icon('trash-2')} Borrar alarma</button>`}
  `;
  const R = () => renderEditor();
  $('#edClose').onclick = closeEditor;
  $('#edSave').onclick = () => {
    draft.label = $('#edLabel').value.trim();
    draft.enabled = true;
    const i = alarms.findIndex(x => x.id === draft.id);
    if (i >= 0) alarms[i] = draft; else alarms.push(draft);
    saveAlarms(); closeEditor(); renderAlarms();
    toast(`Suena en ${untilText(nextTime(draft) - Date.now())}`);
  };
  // Hora: flechas (mantener apretado acelera) o tocar el número
  $$('[data-t]', ed).forEach(b => {
    let h = null;
    const step = () => {
      const t = b.dataset.t;
      if (t === 'h+') draft.hour = (draft.hour + 1) % 24;
      if (t === 'h-') draft.hour = (draft.hour + 23) % 24;
      if (t === 'm+') draft.minute = (draft.minute + 1) % 60;
      if (t === 'm-') draft.minute = (draft.minute + 59) % 60;
      R();
    };
    b.addEventListener('pointerdown', e => { e.preventDefault(); step(); let d = 380; const rep = () => { step(); d = Math.max(60, d * .8); h = setTimeout(rep, d); }; h = setTimeout(rep, d); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => clearTimeout(h)));
  });
  const nt = $('#nativeTime');
  [$('#vh'), $('#vm')].forEach(v => v.onclick = () => { nt.value = `${pad(draft.hour)}:${pad(draft.minute)}`; try { nt.showPicker(); } catch (e) { nt.focus(); } });
  nt.onchange = () => { const [h, m] = nt.value.split(':').map(Number); if (!isNaN(h)) { draft.hour = h; draft.minute = m; R(); } };

  $$('[data-day]', ed).forEach(b => b.onclick = () => {
    const d = +b.dataset.day;
    draft.days = draft.days.includes(d) ? draft.days.filter(x => x !== d) : [...draft.days, d].sort();
    R();
  });
  $$('[data-preset]', ed).forEach(b => b.onclick = () => {
    draft.days = { all: [1, 2, 3, 4, 5, 6, 7], week: [1, 2, 3, 4, 5], none: [] }[b.dataset.preset]; R();
  });
  $('#edLabel').value = draft.label || '';
  $('#edCount').onclick = e => { const v = e.target.dataset.v; if (v) { draft.count = +v; R(); } };
  $('#edDiff').onclick = e => { const v = e.target.dataset.v; if (v) { draft.difficulty = v; R(); } };
  $('#edSnooze').onclick = e => { const v = e.target.dataset.v; if (v) { draft.snoozeMax = +v; R(); } };
  $('#edSnoozeMin').onclick = e => { const v = e.target.dataset.v; if (v) { draft.snoozeMin = +v; R(); } };
  $('#edSound').onclick = e => { const v = e.target.dataset.v; if (v) { draft.sound = v; A.previewSound(v); R(); } };
  $('#edVibrate').onclick = () => { draft.vibrate = !draft.vibrate; R(); };
  $('#edTest').onclick = () => {
    draft.label = $('#edLabel').value.trim();
    const i = alarms.findIndex(x => x.id === draft.id);
    if (i >= 0) alarms[i] = draft; else { draft.enabled = true; alarms.push(draft); }
    saveAlarms(); renderAlarms();
    A.testAlarm(draft.id, 10);
    toast('Guardada. Suena en 10 segundos: probá bloquear el teléfono', 3500);
  };
  const del = $('#edDelete');
  if (del) del.onclick = () => {
    if (del.dataset.sure) { alarms = alarms.filter(x => x.id !== draft.id); saveAlarms(); closeEditor(); renderAlarms(); }
    else { del.dataset.sure = 1; del.textContent = 'Tocá de nuevo para confirmar'; }
  };
  R();
  ed.scrollTop = 0;
  requestAnimationFrame(() => ed.classList.add('open'));
}

function renderEditor() {
  const ed = $('#editor');
  $('#vh').textContent = pad(draft.hour);
  $('#vm').textContent = pad(draft.minute);
  $('#inLabel').textContent = `Suena en ${untilText(nextTime(draft) - Date.now())}` + (draft.days.length ? '' : ' · una sola vez');
  $$('[data-day]', ed).forEach(b => b.classList.toggle('on', draft.days.includes(+b.dataset.day)));
  const ctx = { refs };
  $('#edMissions').innerHTML = MISSION_ORDER.map(id => {
    const m = MISSIONS[id], na = m.needs(ctx), on = draft.missions.includes(id);
    return `<button class="mcard ${on ? 'on' : ''} ${na ? 'na' : ''}" data-m="${id}">${icon(m.icon)}<div><b>${m.name}</b><span>${na ? 'Falta registrar' : SHORT_DESC[id]}</span></div></button>`;
  }).join('');
  $$('[data-m]', ed).forEach(b => b.onclick = () => {
    const id = b.dataset.m, na = MISSIONS[id].needs(ctx);
    if (na) return toast(na);
    draft.missions = draft.missions.includes(id) ? draft.missions.filter(x => x !== id) : [...draft.missions, id];
    if (!draft.missions.length) { draft.missions = [id]; toast('Tiene que haber al menos una misión'); }
    renderEditor();
  });
  const seg = (sel, val) => $$(sel + ' button', ed).forEach(b => b.classList.toggle('on', b.dataset.v == val));
  seg('#edCount', draft.count); seg('#edDiff', draft.difficulty); seg('#edSnooze', draft.snoozeMax); seg('#edSnoozeMin', draft.snoozeMin);
  $('#edSnoozeMin').classList.toggle('hidden', !draft.snoozeMax);
  $$('#edSound .chip', ed).forEach(b => b.classList.toggle('on', b.dataset.v === draft.sound));
  $('#edVibrate').textContent = draft.vibrate ? 'Vibración: sí' : 'Vibración: no';
}
function closeEditor() { $('#editor').classList.remove('open'); A.stopPreview(); }

// ---------- Objetos y códigos ----------
function renderObjects() {
  const photos = refs.filter(r => r.type === 'photo'), codes = refs.filter(r => r.type === 'code');
  $('#photoList').innerHTML = photos.length ? photos.map(r => `
    <div class="list-item"><img src="${r.shots[0].thumb}"><div class="grow"><b>${esc(r.name)}</b><span>${r.shots.length} foto${r.shots.length > 1 ? 's' : ''} de referencia</span></div>
    <button class="icon-btn" data-test="${r.id}">${icon('play')}</button><button class="icon-btn" data-del="${r.id}">${icon('trash-2')}</button></div>`).join('')
    : '<p class="muted" style="font-size:13px;margin:0 4px 12px">Ninguno todavía.</p>';
  $('#codeList').innerHTML = codes.length ? codes.map(r => `
    <div class="list-item"><div class="thumbcode">${icon('scan-barcode')}</div><div class="grow"><b>${esc(r.name)}</b><span>${esc(r.code)}</span></div>
    <button class="icon-btn" data-del="${r.id}">${icon('trash-2')}</button></div>`).join('')
    : '<p class="muted" style="font-size:13px;margin:0 4px 12px">Ninguno todavía.</p>';
  $$('[data-del]').forEach(b => b.onclick = () => {
    if (!b.dataset.sure) { b.dataset.sure = 1; b.style.color = 'var(--bad)'; toast('Tocá de nuevo para borrar'); return; }
    refs = refs.filter(r => r.id !== b.dataset.del); saveRefs(); renderObjects();
  });
  $$('[data-test]').forEach(b => b.onclick = () => practice('photo', refs.filter(r => r.id === b.dataset.test)));
}

let sheetStop = null;
function openSheet(title, html) {
  const s = $('#sheet2');
  s.innerHTML = `<div class="sheet-head"><button class="icon-btn" id="shClose">${icon('chevron-left')}</button><h2>${title}</h2><div style="width:42px"></div></div>${html}`;
  $('#shClose').onclick = closeSheet;
  s.scrollTop = 0;
  requestAnimationFrame(() => s.classList.add('open'));
  return s;
}
function closeSheet() {
  sheetStop && sheetStop(); sheetStop = null;
  $('#sheet2').classList.remove('open');
  render();
}

$('#addPhoto').onclick = () => {
  const shots = [];
  const s = openSheet('Registrar objeto', `
    <div class="field"><label>¿Qué es?</label><input type="text" id="objName" maxlength="40" placeholder="Ej: Pileta del baño"></div>
    <div class="cam"><video></video><div class="frame"></div></div>
    <div class="result" id="objRes">Encuadralo bien, con buena luz. Podés sumar hasta 3 ángulos.</div>
    <div class="row"><button class="btn primary" id="objShot">${icon('camera')} Sacar foto</button></div>
    <div class="row" style="margin-top:10px"><button class="btn" id="objTest" disabled>Probar</button><button class="btn primary" id="objSave" disabled>${icon('check')} Guardar</button></div>
    <div id="objThumbs" style="display:flex;gap:8px;margin-top:12px"></div>`);
  const video = $('video', s), res = $('#objRes');
  startCamera(video).then(st => sheetStop = st).catch(() => { res.className = 'result bad'; res.textContent = 'No se pudo abrir la cámara. Revisá el permiso en Ajustes.'; });
  const snap = async () => {
    const c = grab(video, 640);
    const fp = fingerprint(c);
    fp.labels = await nativeAsync('labelImage', c.toDataURL('image/jpeg', .85));
    return { c, fp };
  };
  $('#objShot').onclick = async () => {
    if (!video.videoWidth) return;
    if (shots.length >= 3) return toast('Máximo 3 fotos');
    res.className = 'result'; res.textContent = 'Analizando…';
    const { c, fp } = await snap();
    const t = document.createElement('canvas'), k = 200 / Math.max(c.width, c.height);
    t.width = c.width * k; t.height = c.height * k; t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
    fp.thumb = t.toDataURL('image/jpeg', .7);
    fp.labels = fp.labels.slice(0, 8);
    shots.push(fp);
    $('#objThumbs').innerHTML = shots.map(x => `<img src="${x.thumb}" style="width:64px;height:64px;border-radius:10px;object-fit:cover;border:1px solid var(--line2)">`).join('');
    res.className = 'result ok'; res.textContent = `Foto ${shots.length} lista ✓ ${shots.length < 3 ? '· podés sumar otro ángulo' : ''}`;
    $('#objTest').disabled = $('#objSave').disabled = false;
    $('#objShot').innerHTML = icon('camera') + ' Otro ángulo';
  };
  $('#objTest').onclick = async () => {
    res.className = 'result'; res.textContent = 'Comparando…';
    const { fp } = await snap();
    const best = Math.max(...shots.map(x => photoScore(fp, x).score));
    const thr = SENS[settings.photoSens || 'normal'];
    res.className = 'result ' + (best >= thr ? 'ok' : 'bad');
    res.textContent = `${best >= thr ? 'La reconoce ✓' : 'No la reconoce ✕'} · parecido ${Math.round(best * 100)}% (necesita ${Math.round(thr * 100)}%)`;
  };
  $('#objSave').onclick = () => {
    const name = $('#objName').value.trim();
    if (!name) { toast('Ponele un nombre'); $('#objName').focus(); return; }
    refs.push({ id: 'p' + Date.now(), type: 'photo', name, shots });
    saveRefs(); closeSheet(); toast('Objeto guardado. Ya podés elegir la misión de foto.');
  };
};

$('#addCode').onclick = () => {
  let code = null, alive = true, timer = null;
  const s = openSheet('Registrar código', `
    <p class="muted" style="font-size:13px;margin:0 4px 12px">Usá el código de barras de algo que esté lejos de la cama (pasta dental, shampoo, un paquete de la cocina) o un QR pegado en el baño.</p>
    <div class="cam"><video></video><div class="frame"></div><div class="scanline"></div></div>
    <div class="result" id="codeRes">Apuntá al código…</div>
    <div class="field hidden" id="codeNameBox"><label>¿Dónde está?</label><input type="text" id="codeName" maxlength="40" placeholder="Ej: Pasta dental del baño"></div>
    <button class="btn primary hidden" id="codeSave">${icon('check')} Guardar</button>`);
  const video = $('video', s), res = $('#codeRes');
  const loop = async () => {
    if (!alive || code) return;
    if (video.videoWidth) {
      const codes = await nativeAsync('scanBarcode', grab(video, 900).toDataURL('image/jpeg', .85));
      if (codes.length && alive) {
        code = codes[0]; A.vibrate(100);
        res.className = 'result ok'; res.textContent = 'Código leído ✓ ' + code;
        $('#codeNameBox').classList.remove('hidden'); $('#codeSave').classList.remove('hidden');
        setTimeout(() => $('#codeName').focus(), 200);
        return;
      }
    }
    timer = setTimeout(loop, 400);
  };
  startCamera(video).then(st => { sheetStop = () => { alive = false; clearTimeout(timer); st(); }; loop(); })
    .catch(() => { res.className = 'result bad'; res.textContent = 'No se pudo abrir la cámara. Revisá el permiso en Ajustes.'; });
  $('#codeSave').onclick = () => {
    const name = $('#codeName').value.trim();
    if (!name) { toast('Ponele un nombre'); return; }
    if (refs.some(r => r.type === 'code' && r.code === code)) { toast('Ese código ya está registrado'); return; }
    refs.push({ id: 'c' + Date.now(), type: 'code', name, code });
    saveRefs(); closeSheet(); toast('Código guardado');
  };
};

// ---------- Practicar misiones ----------
function renderPractice() {
  const ctx = { refs };
  $('#practiceGrid').innerHTML = MISSION_ORDER.map(id => {
    const m = MISSIONS[id], na = m.needs(ctx);
    return `<button class="mcard ${na ? 'na' : ''}" data-p="${id}">${icon(m.icon)}<div><b>${m.name}</b><span>${na ? 'Falta registrar' : m.desc}</span></div></button>`;
  }).join('');
  $$('[data-p]').forEach(b => b.onclick = () => {
    const na = MISSIONS[b.dataset.p].needs(ctx);
    if (na) return toast(na);
    practice(b.dataset.p);
  });
}
function practice(id, onlyRefs) {
  let diff = 'normal';
  const s = openSheet('Práctica', `<div class="seg" id="pDiff" style="margin-bottom:16px">${DIFF.map(([v, t]) => `<button data-v="${v}">${t}</button>`).join('')}</div><div id="pStage" class="mission" style="min-height:70vh"></div>`);
  const start = () => {
    sheetStop && sheetStop();
    $$('#pDiff button', s).forEach(b => b.classList.toggle('on', b.dataset.v === diff));
    sheetStop = MISSIONS[id].run($('#pStage'), {
      difficulty: diff, refs: onlyRefs || refs, settings, saveSettings, ping: () => {},
      onDone: () => { toast('¡Misión superada! Así se apaga la alarma.'); A.vibrate(200); setTimeout(closeSheet, 900); },
    });
  };
  $('#pDiff').onclick = e => { if (e.target.dataset.v) { diff = e.target.dataset.v; start(); } };
  start();
}

// ---------- Ajustes ----------
function renderSettings() {
  renderPerms();
  $$('#photoSens button').forEach(b => {
    b.classList.toggle('on', b.dataset.v === (settings.photoSens || 'normal'));
    b.onclick = () => { settings.photoSens = b.dataset.v; saveSettings(); renderSettings(); };
  });
  const h = (J(A.history()) || []).slice(-10).reverse();
  $('#history').innerHTML = h.length ? h.map(e => {
    const d = new Date(e.t);
    return `<div class="perm"><div class="dot ${e.ok ? 'ok' : 'bad'}">${e.ok ? '✓' : '✕'}</div><div class="grow"><b>${DAY_NAMES[(d.getDay() + 6) % 7]} ${d.getDate()}/${d.getMonth() + 1} · ${pad(d.getHours())}:${pad(d.getMinutes())}</b><span>${e.ok ? 'Misión cumplida' : 'Cortada'}${e.snoozes ? ` · pospuesta ${e.snoozes} vez${e.snoozes > 1 ? 'es' : ''}` : ''}</span></div></div>`;
  }).join('') : '<div class="perm"><div class="grow"><span>Todavía no sonó ninguna alarma.</span></div></div>';
}
$('#domLink').onclick = () => A.openUrl('https://thedomstudioweb.github.io/');

// ---------- General ----------
function render() {
  renderNext();
  if (tab === 'alarms') { renderAlarms(); renderPerms(); }
  if (tab === 'objects') renderObjects();
  if (tab === 'missions') renderPractice();
  if (tab === 'settings') renderSettings();
}
window.onResumeApp = () => { if (tab === 'alarms' || tab === 'settings') render(); };
window.onBack = () => {
  if ($('#sheet2').classList.contains('open')) { closeSheet(); return true; }
  if ($('#editor').classList.contains('open')) { closeEditor(); return true; }
  if (tab !== 'alarms') { go('alarms'); return true; }
  return false;
};
setInterval(renderNext, 30000);
go('alarms');
