// Arriba — pantalla de la alarma sonando
'use strict';
(() => {
  const info = J(A.ringInfo()) || {};
  if (info.id === -1 || info.id === undefined) { A.missionDone(); return; }
  const alarm = info.alarm || {};
  const refs = J(A.getRefs()) || [];
  const settings = J(A.getSettings()) || {};
  const ctx = { refs };
  const saveSettings = () => A.saveSettings(JSON.stringify(settings));

  // Reloj
  const tick = () => {
    const d = new Date();
    $('#clock').textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
    const f = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    $('#date').textContent = f.charAt(0).toUpperCase() + f.slice(1);
  };
  tick(); setInterval(tick, 5000);
  if (alarm.label) $('#label').textContent = alarm.label;
  $('#pulse').innerHTML = icon('bell-ring');

  const plan = pickMissions(alarm, ctx, info.lastMission);
  A.setLastMission(plan[0]);
  $('#what').innerHTML = `Para apagarla: ${plan.length === 1 ? '1 misión' : plan.length + ' misiones'} sorpresa.`;

  // Posponer
  const max = alarm.snoozeMax || 0, left = max - (info.snoozes || 0);
  if (left > 0) {
    const b = $('#snooze');
    b.classList.remove('hidden');
    b.textContent = `Posponer ${alarm.snoozeMin || 5} min · te ${left === 1 ? 'queda 1' : 'quedan ' + left}`;
    b.onclick = () => { if (!A.snooze()) toast('No quedan posposiciones'); };
  }

  // Cualquier toque cuenta como "estoy haciendo la misión" (baja el volumen un rato)
  document.addEventListener('touchstart', () => A.ping(), { passive: true });

  let i = 0, stop = null, swaps = 0, swapTimer = null;
  const used = [...plan];

  const run = () => {
    stop && stop(); stop = null;
    clearTimeout(swapTimer);
    $('#swapbox').classList.add('hidden');
    const id = plan[i];
    const st = $('#stage');
    st.innerHTML = `<div class="step-of">Misión ${i + 1} de ${plan.length}</div><div class="mwrap" style="flex:1;display:flex;flex-direction:column"></div>`;
    stop = MISSIONS[id].run($('.mwrap', st), {
      difficulty: alarm.difficulty || 'normal', refs, settings, saveSettings,
      ping: () => A.ping(),
      onDone: () => { i++; i >= plan.length ? finish() : run(); },
    });
    // Si una misión no se puede hacer (ej. la cámara falla), a los 2 minutos se puede cambiar por otra (no por apagarla)
    if (swaps < 2) swapTimer = setTimeout(() => {
      $('#swapbox').classList.remove('hidden');
      $('#swap').textContent = `No puedo hacer esta misión → cambiar por otra (${2 - swaps})`;
    }, 120000);
  };

  $('#swap').onclick = () => {
    swaps++;
    const nid = swapMission(plan[i], used, ctx);
    used.push(nid); plan[i] = nid; run();
  };

  const finish = () => {
    stop && stop(); stop = null;
    clearTimeout(swapTimer);
    $('#swapbox').classList.add('hidden');
    const h = new Date().getHours();
    const saludo = h < 12 ? '¡Buen día!' : h < 20 ? '¡Buenas tardes!' : '¡Buenas noches!';
    $('#stage').innerHTML = `<div class="done-screen">${icon('sun-medium')}<h1>${saludo}</h1><p class="muted">Misión cumplida. Ya estás despierto.</p></div>`;
    A.vibrate(250);
    setTimeout(() => A.missionDone(), 1800);
  };

  $('#start').onclick = () => {
    A.ping();
    $('#intro').classList.add('hidden');
    $('#stage').classList.remove('hidden');
    run();
  };
})();
