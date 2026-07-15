/* Doc 3V — JS compartido. Cada bloque se activa solo si su elemento existe en la página. */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* año en el footer */
  var yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();

  /* scroll reveal */
  var revs = document.querySelectorAll('.reveal');
  if (revs.length) {
    if (!reduce && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { threshold: .12, rootMargin: '0px 0px -50px 0px' });
      revs.forEach(function (el) { io.observe(el); });
    } else { revs.forEach(function (el) { el.classList.add('in'); }); }
  }

  /* diagramas de acordes (posiciones reales) */
  var cg = document.getElementById('chordGrid');
  if (cg) {
    var CHORDS = [
      { name: 'Em', tab: '0 2 2 0 0 0', frets: [0, 2, 2, 0, 0, 0] },
      { name: 'Am', tab: 'x 0 2 2 1 0', frets: [-1, 0, 2, 2, 1, 0] },
      { name: 'C', tab: 'x 3 2 0 1 0', frets: [-1, 3, 2, 0, 1, 0] },
      { name: 'G', tab: '3 2 0 0 0 3', frets: [3, 2, 0, 0, 0, 3] }
    ];
    var chordSVG = function (frets) {
      var W = 96, H = 120, L = 14, R = 82, T = 24, B = 104, strings = 6, fretsN = 4, xs = [], sw = (R - L) / (strings - 1);
      for (var s = 0; s < strings; s++) xs.push(L + s * sw);
      var fh = (B - T) / fretsN, svg = '<rect x="' + L + '" y="' + T + '" width="' + (R - L) + '" height="6" fill="#F9F5EE"/>';
      for (var f = 1; f <= fretsN; f++) { var y = T + f * fh; svg += '<line x1="' + L + '" y1="' + y + '" x2="' + R + '" y2="' + y + '" stroke="rgba(249,245,238,.28)" stroke-width="1"/>'; }
      for (var s2 = 0; s2 < strings; s2++) svg += '<line x1="' + xs[s2] + '" y1="' + T + '" x2="' + xs[s2] + '" y2="' + B + '" stroke="rgba(249,245,238,.35)" stroke-width="1"/>';
      for (var i = 0; i < strings; i++) {
        var fr = frets[i], x = xs[i];
        if (fr > 0) { var cy = T + (fr - 0.5) * fh; svg += '<circle cx="' + x + '" cy="' + cy + '" r="6.5" fill="#C8882A"/>'; }
        else if (fr === 0) svg += '<circle cx="' + x + '" cy="' + (T - 9) + '" r="4" fill="none" stroke="#F9F5EE" stroke-width="1.4"/>';
        else svg += '<text x="' + x + '" y="' + (T - 5) + '" fill="rgba(249,245,238,.5)" font-size="11" text-anchor="middle" font-family="monospace">×</text>';
      }
      return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Diagrama del acorde">' + svg + '</svg>';
    };
    CHORDS.forEach(function (c) {
      var el = document.createElement('div'); el.className = 'chord';
      el.innerHTML = chordSVG(c.frets) + '<b>' + c.name + '</b><span>' + c.tab + '</span>';
      cg.appendChild(el);
    });
  }

  /* metrónomo (Web Audio) */
  var playBtn = document.getElementById('play');
  if (playBtn) {
    var ac = null, next = 0, timer = null, beat = 0, running = false, bpm = 100, beatsPer = 4;
    var bpmEl = document.getElementById('bpm'), bpmVal = document.getElementById('bpmVal'),
      beatsBox = document.getElementById('beats'), tapBtn = document.getElementById('tap'),
      presetsBox = document.getElementById('presets'), sigsBox = document.getElementById('sigs');
    var PRESETS = [['Balada', 70], ['Pop', 100], ['Rock', 120], ['Cumbia', 130], ['Salsa', 185]];
    var SIGS = [['4/4', 4], ['3/4', 3], ['6/8', 6], ['2/4', 2]];
    PRESETS.forEach(function (p) { var b = document.createElement('button'); b.className = 'pill'; b.type = 'button'; b.textContent = p[0] + ' · ' + p[1]; b.onclick = function () { setBpm(p[1]); }; presetsBox.appendChild(b); });
    SIGS.forEach(function (sg, i) { var b = document.createElement('button'); b.className = 'pill' + (i === 0 ? ' sel' : ''); b.type = 'button'; b.textContent = sg[0]; b.onclick = function () { beatsPer = sg[1]; beat = 0; [].forEach.call(sigsBox.children, function (x) { x.classList.remove('sel'); }); b.classList.add('sel'); renderBeats(); }; sigsBox.appendChild(b); });
    function renderBeats() { beatsBox.innerHTML = ''; for (var i = 0; i < beatsPer; i++) { var d = document.createElement('span'); d.className = 'beat' + (i === 0 ? ' acc' : ''); beatsBox.appendChild(d); } }
    function setBpm(v) { bpm = Math.max(40, Math.min(220, v)); bpmEl.value = bpm; bpmVal.textContent = bpm; }
    bpmEl.addEventListener('input', function () { setBpm(+bpmEl.value); });
    function clk(time, acc) { var o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = acc ? 1500 : 900; o.connect(g); g.connect(ac.destination); g.gain.setValueAtTime(acc ? 0.5 : 0.28, time); g.gain.exponentialRampToValueAtTime(0.0001, time + 0.05); o.start(time); o.stop(time + 0.06); }
    function schedule() {
      while (next < ac.currentTime + 0.1) {
        var acc = (beat % beatsPer) === 0; clk(next, acc);
        (function (idx) { var when = (next - ac.currentTime) * 1000; setTimeout(function () { flash(idx); }, Math.max(0, when)); })(beat % beatsPer);
        next += 60 / bpm; beat++;
      }
      timer = setTimeout(schedule, 25);
    }
    function flash(i) { var k = beatsBox.children; for (var j = 0; j < k.length; j++) k[j].classList.remove('on'); if (k[i]) k[i].classList.add('on'); }
    function start() { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); running = true; beat = 0; next = ac.currentTime + 0.05; schedule(); playBtn.textContent = '■ Detener'; }
    function stop() { running = false; clearTimeout(timer); playBtn.textContent = '▶ Iniciar'; [].forEach.call(beatsBox.children, function (x) { x.classList.remove('on'); }); }
    playBtn.addEventListener('click', function () { running ? stop() : start(); });
    var taps = [];
    tapBtn.addEventListener('click', function () { var now = performance.now(); taps.push(now); taps = taps.filter(function (t) { return now - t < 3000; }); if (taps.length >= 2) { var iv = []; for (var i = 1; i < taps.length; i++) iv.push(taps[i] - taps[i - 1]); setBpm(Math.round(60000 / (iv.reduce(function (a, b) { return a + b; }, 0) / iv.length))); } });
    renderBeats(); setBpm(100);
  }

  /* tutor demo */
  var log = document.getElementById('log'), chipsBox = document.getElementById('chips');
  if (log && chipsBox) {
    var QA = [
      { q: "¿Cómo cambio de Do a Sol sin frenar?", a: "El error clásico es levantar toda la mano. El truco es el <b>dedo ancla</b>: tu dedo 3 casi no se mueve entre Do y Sol. Úsalo de guía y los otros caen solos, sin cortar la canción.", v: "Cambios rápidos de acordes", t: "4:32" },
      { q: "Se me traba la cejilla (Fa)", a: "Fa no se gana con fuerza, se gana con posición. Gira un poco el codo hacia adentro y apoya el <b>hueso</b> del dedo, no la yema blanda. Si te duele, estás empujando de más.", v: "Domina la cejilla sin dolor", t: "7:15" },
      { q: "¿Qué canción fácil aprendo primero?", a: "Una de 4 acordes: <b>Do, Sol, La menor y Fa</b>. Con esos cuatro ya tocas cientos de canciones. Te dejo mi recomendación para tu primera semana, con la tablatura lista.", v: "Tu primera canción en 4 acordes", t: "2:08" },
      { q: "Se me cansa la mano al rasguear", a: "El rasgueo sale de la <b>muñeca</b>, no del brazo. Si mueves todo el antebrazo te agotas en un minuto. Suéltala como cuando sacudes agua de la mano, y el ritmo fluye solo.", v: "Rasgueo suelto y sin cansancio", t: "5:47" },
      { q: "¿Cuánto debo practicar al día?", a: "15 minutos enfocados le ganan a 2 horas distraídas. Mejor un rato corto <b>todos los días</b> que un maratón el domingo. Te armo una rutina de 15 minutos que sí vas a sostener.", v: "Rutina diaria de 15 minutos", t: "3:20" }
    ];
    QA.forEach(function (item) { var c = document.createElement('button'); c.className = 'chip'; c.type = 'button'; c.textContent = item.q; c.addEventListener('click', function () { ask(item, c); }); chipsBox.appendChild(c); });
    function scrollLog() { log.scrollTop = log.scrollHeight; }
    function ask(item, chip) {
      chip.disabled = true;
      var u = document.createElement('div'); u.className = 'msg user'; u.textContent = item.q; log.appendChild(u); scrollLog();
      var think = reduce ? 250 : 850;
      var typing = document.createElement('div'); typing.className = 'typing'; typing.setAttribute('aria-hidden', 'true'); typing.innerHTML = '<i></i><i></i><i></i>';
      setTimeout(function () { log.appendChild(typing); scrollLog(); }, 180);
      setTimeout(function () {
        if (typing.parentNode) typing.remove();
        var b = document.createElement('div'); b.className = 'msg bot';
        b.innerHTML = item.a + '<span class="cite" role="button" tabindex="0" title="Abre el video en el minuto exacto"><span class="play" aria-hidden="true">▶</span> Ver en “' + item.v + '” · ' + item.t + '</span>';
        log.appendChild(b); scrollLog();
      }, think + 350);
    }
  }

  /* form de contratar (demo, no envía) */
  var lead = document.getElementById('lead');
  if (lead) {
    lead.addEventListener('submit', function (ev) {
      ev.preventDefault();
      lead.style.display = 'none';
      var done = document.getElementById('done');
      if (done) { done.style.display = 'flex'; done.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); }
    });
  }
})();
