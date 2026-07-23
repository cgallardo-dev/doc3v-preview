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

  /* ───────────────────────── tutor 24/7 (chat en vivo) ─────────────────────────
     Habla con /api/ask (función serverless en el mismo origen → sin CORS y sin
     exponer la llave de OpenAI). Contrato de respuesta, idéntico a answer() del
     motor en Python:
         { gate: bool, score: num, text: "…", cite: { title, time, url, thumb } }

     Dos reglas que mandan sobre todo lo demás:
       1) gate === true  → el bot NO inventa: muestra su mensaje de derivación y
          NO pinta cita. Eso no es una falla, es el argumento de venta.
       2) Si la API falla, tarda o devuelve algo raro → caemos al set curado de
          abajo. Nunca se muestra un error técnico: este demo se enseña en vivo
          delante de un cliente y no puede verse roto ni un segundo.
     ──────────────────────────────────────────────────────────────────────────── */
  var log = document.getElementById('log'), chipsBox = document.getElementById('chips');
  if (log && chipsBox) {
    var API_URL = '/api/ask';
    var API_TIMEOUT = 12000;   // el cliente corta ANTES que la función, para que el respaldo alcance a entrar
    var MAX_LEN = 200;         // pregunta corta = prompt corto = gasto acotado

    /* ── Tope del plan GRATIS ──────────────────────────────────────────────────
       Es una palanca de PRODUCTO, no de seguridad: muestra que la versión gratis
       es una PROBADA y empuja al curso. Vive en el navegador (localStorage), así
       que un usuario técnico lo resetea borrando datos o pegándole directo a la
       API — y está bien, para eso está el tope DURO de gasto en OpenAI, que es lo
       que de verdad blinda la plata. Aquí lo que importa es la conversión.
       Para re-demostrar sin borrar datos: abrir la página con #reset al final. */
    var FREE_LIMIT = 10;                      // preguntas gratis antes del muro
    var FREE_KEY = 'doc3v_free_q';
    var freeMem = 0;                          // respaldo si localStorage está bloqueado (modo privado)
    if (/(^|[#?&])reset\b/i.test(location.hash + location.search)) {
      try { localStorage.removeItem(FREE_KEY); } catch (e) {}
    }
    function freeUsed() {
      try { var v = parseInt(localStorage.getItem(FREE_KEY) || '', 10); return isNaN(v) ? freeMem : v; }
      catch (e) { return freeMem; }
    }
    function freeBump() {
      var n = freeUsed() + 1; freeMem = n;
      try { localStorage.setItem(FREE_KEY, String(n)); } catch (e) {}
      return n;
    }

    /* Set curado: son respuestas reales, con el video y el segundo exactos.
       Sirven para dos cosas: sugerencias (chips) y respaldo si la API no está. */
    var QA = [
      { q: "¿Qué acordes lleva Dueles?", a: "Cuatro: <b>Si menor, Re, La y Sol</b>. En el precoro entra un <b>Mi menor</b>, y en el coro un <b>Fa# menor</b>.", v: "Dueles — Jesse y Joy", id: "GaNwd74lfu4", t: 8 },
      { q: "¿Cómo es el rasgueo del intro de Dueles?", a: "Sobre Si menor: <b>bajo, golpe, bloqueo y golpe</b>. Doc lo desglosa cuerda por cuerda.", v: "Dueles — Jesse y Joy", id: "GaNwd74lfu4", t: 22 },
      { q: "¿Qué acordes lleva Las Mañanitas?", a: "Solo <b>tres</b>: <b>La, Mi y Re</b>. Por eso es de las mejores para arrancar.", v: "Las Mañanitas", id: "uH4hbW4HKbw", t: 9 },
      { q: "¿Y el rasgueo de Las Mañanitas?", a: "Dos: en la primera parte <b>bajo, rasgueo y bajo</b>; en la segunda, una <b>ranchera balanceada</b> (bajo y dos golpes).", v: "Las Mañanitas", id: "uH4hbW4HKbw", t: 42 },
      { q: "¿El triste lleva cejilla?", a: "Lleva <b>puente (cejilla) en el tercer traste</b>. Los acordes: La menor, Re menor 7, Sol 7, Do maj7 y Mi 7.", v: "El triste — José José", id: "WZ0WMiwEyPE", t: 10 },
      { q: "¿Qué opciones de mano derecha tiene El triste?", a: "<b>Tres</b>: un <b>arpegio</b>, un <b>pulsado</b> (dos veces + bloqueo) y un <b>rasgueo</b> (abajo · abajo-arriba-abajo).", v: "El triste — José José", id: "WZ0WMiwEyPE", t: 31 }
    ];
    var OFFLINE_TEXT = "Ahora mismo no puedo revisar los videos de Doc. Vuelve a intentarlo en unos segundos o toca una de las preguntas de abajo.";

    var askForm = document.getElementById('askForm'),
      askInput = document.getElementById('askInput'),
      askSend = document.getElementById('askSend'),
      freeHint = document.getElementById('freeHint'),
      busy = false;

    /* Pinta cuántas preguntas gratis quedan. Se muestra recién cuando el usuario
       ya empezó a preguntar (para no asustar con un "quedan 5" de entrada). */
    function renderFree() {
      if (!freeHint) return;
      var quedan = Math.max(0, FREE_LIMIT - freeUsed());
      if (freeUsed() === 0) { freeHint.hidden = true; return; }
      freeHint.hidden = false;
      freeHint.textContent = quedan > 0
        ? 'Te ' + (quedan === 1 ? 'queda 1 pregunta gratis' : 'quedan ' + quedan + ' preguntas gratis')
        : 'Llegaste al final de la versión gratis';
    }

    /* Una vez agotada la prueba, se cierra el input y se apagan los chips: el
       único camino hacia adelante es el curso. (Product, no seguridad.) */
    var freeLocked = false;
    function lockFree() {
      freeLocked = true;
      if (askInput) { askInput.readOnly = true; askInput.placeholder = 'Prueba gratis terminada — mira el curso ↓'; }
      var cs = chipsBox.querySelectorAll('.chip');
      for (var i = 0; i < cs.length; i++) { cs[i].disabled = true; cs[i].setAttribute('aria-disabled', 'true'); }
      syncSend();
    }

    /* ── Cómo trato el HTML al pintar ──────────────────────────────────────────
       El usuario ahora ESCRIBE LIBRE, así que su texto jamás toca innerHTML: va
       por textContent y punto. Imposible inyectar nada.
       La respuesta del bot sí necesita <b> (el set curado lo usa y el modelo
       puede devolverlo), así que aplico lista blanca: escapo TODO y después
       revivo solo los tokens exactos "<b>" y "</b>". Con eso, <script>,
       <img src=x onerror=…> e incluso <b onclick="…"> se quedan escapados como
       texto plano, porque ninguno coincide con los dos tokens permitidos: no hay
       forma de colar un atributo ni otra etiqueta.
       El enlace de la cita lo construyo con el DOM (createElement + href), nunca
       concatenando HTML, y solo si la URL es http(s) — así un "javascript:" que
       llegara desde la API no se convierte en un enlace ejecutable. */
    function escapeHTML(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
      });
    }
    function richText(s) { return escapeHTML(s).replace(/&lt;(\/?)b&gt;/g, '<$1b>'); }

    function scrollLog() { log.scrollTop = log.scrollHeight; }

    function addUser(text) {
      var u = document.createElement('div');
      u.className = 'msg user';
      u.textContent = text;                       // texto del usuario: SIEMPRE textContent
      log.appendChild(u); scrollLog();
    }

    function addBot(text, cite) {
      var b = document.createElement('div');
      b.className = 'msg bot';
      b.innerHTML = richText(text);
      if (cite && cite.url && /^https?:\/\//i.test(cite.url)) {
        var a = document.createElement('a');
        a.className = 'cite';
        a.href = cite.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.title = 'Abre el video de YouTube en el minuto exacto';
        var play = document.createElement('span');
        play.className = 'play'; play.setAttribute('aria-hidden', 'true'); play.textContent = '▶';
        a.appendChild(play);
        a.appendChild(document.createTextNode(' Ver en “' + (cite.title || 'el video de Doc') + '”' + (cite.time ? ' · ' + cite.time : '')));
        b.appendChild(a);
      }
      log.appendChild(b); scrollLog();
    }

    function showTyping() {
      var t = document.createElement('div');
      t.className = 'typing';
      t.setAttribute('aria-hidden', 'true');     // el punteo no se le lee a un lector de pantalla
      t.innerHTML = '<i></i><i></i><i></i>';
      log.appendChild(t); scrollLog();
      return t;
    }

    /* ── Respaldo curado ──────────────────────────────────────────────────────
       Parecido por palabras: normalizo (sin tildes, sin ñ, sin signos), me quedo
       con las palabras de 4+ letras que no sean muletillas y mido cuántas de la
       pregunta curada aparecen en la del usuario. Con la mitad o más, contesto
       esa; si no, un mensaje amable. Es tosco a propósito: solo corre cuando la
       API ya falló, y ahí lo que importa es no quedarse mudo. */
    var STOP = { que: 1, cual: 1, cuales: 1, como: 1, para: 1, con: 1, los: 1, las: 1, del: 1, una: 1, por: 1, este: 1, esta: 1, sobre: 1, tiene: 1, lleva: 1, donde: 1, cuando: 1, porque: 1, quiero: 1, puedo: 1, dime: 1, explica: 1, favor: 1 };
    function words(s) {
      var norm = String(s || '').toLowerCase()
        .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
        .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
        .replace(/[^a-z0-9]+/g, ' ');
      var raw = norm.split(' '), out = [];
      for (var i = 0; i < raw.length; i++) {
        if (raw[i].length >= 4 && !STOP[raw[i]] && out.indexOf(raw[i]) < 0) out.push(raw[i]);
      }
      return out;
    }
    function curatedRes(item) {
      var mm = Math.floor(item.t / 60), ss = item.t % 60;
      return {
        gate: false, text: item.a,
        cite: {
          title: item.v,
          time: mm + ':' + (ss < 10 ? '0' : '') + ss,
          url: 'https://www.youtube.com/watch?v=' + item.id + '&t=' + item.t + 's'
        }
      };
    }
    /* Respaldo sin conexión. El parecido se mide con Jaccard (intersección sobre
       UNIÓN), no con "qué fracción de la pregunta curada aparece en la del
       usuario". Ese cálculo viejo era peligroso: para "¿qué acordes lleva El
       triste?" el mejor match salía "¿Qué acordes lleva Dueles?" con 2 de 3
       palabras (0.67) y devolvía la respuesta de Dueles CON su cita al minuto.
       O sea, contestaba otra canción con una cita segura de sí misma: justo lo
       contrario de lo que vendemos. Con Jaccard ese caso da 0.5 y se rechaza.
       El umbral es alto a propósito: aquí más vale decir "no disponible" que
       acertarle a la pregunta equivocada. */
    function curatedFor(question) {
      var qw = words(question), best = null, bestScore = 0;
      for (var i = 0; i < QA.length && qw.length; i++) {
        var cw = words(QA[i].q), hit = 0, k;
        for (k = 0; k < cw.length; k++) if (qw.indexOf(cw[k]) >= 0) hit++;
        var union = qw.length + cw.length - hit;          // |A ∪ B| = |A| + |B| − |A ∩ B|
        var score = union ? hit / union : 0;
        if (score > bestScore) { bestScore = score; best = QA[i]; }
      }
      return bestScore >= 0.6 ? curatedRes(best) : { gate: true, text: OFFLINE_TEXT };
    }

    /* ── Llamada a la API. Nunca lanza: devuelve la respuesta o null. ───────── */
    function fetchAnswer(question, done) {
      if (!window.fetch || !window.AbortController) { done(null); return; }
      var ctrl = new AbortController(), settled = false;
      var timer = setTimeout(function () { ctrl.abort(); }, API_TIMEOUT);
      function finish(res) { if (settled) return; settled = true; clearTimeout(timer); done(res); }
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        /* "question" es la clave del contrato (la misma que lee el motor en Python).
           Mando también "q" por si la función serverless usa ese nombre: no cuesta
           nada y evita que el demo se caiga por un desajuste de nombres. */
        body: JSON.stringify({ question: question, q: question }),
        signal: ctrl.signal
      }).then(function (r) {
        if (!r.ok) throw new Error('http ' + r.status);
        return r.json();
      }).then(function (data) {
        if (!data || typeof data.text !== 'string' || !data.text) throw new Error('respuesta vacía');
        finish(data);
      }).catch(function () { finish(null); });   // el porqué queda en la consola del navegador, no en pantalla
    }

    function syncSend() {
      if (!askSend) return;
      var empty = !askInput || !askInput.value.replace(/^\s+|\s+$/g, '');
      if (busy && document.activeElement === askSend && askInput) askInput.focus();  // no dejar el foco huérfano
      askSend.disabled = busy || empty || freeLocked;
    }
    function setBusy(on) {
      busy = on;
      log.setAttribute('aria-busy', on ? 'true' : 'false');
      if (askInput) askInput.readOnly = on;        // readOnly y no disabled: el foco no se pierde
      chipsBox.classList[on ? 'add' : 'remove']('is-busy');
      var cs = chipsBox.querySelectorAll('.chip');
      for (var i = 0; i < cs.length; i++) cs[i].setAttribute('aria-disabled', on ? 'true' : 'false');
      syncSend();
    }

    /* El muro del plan gratis: un mensaje del bot, en su misma voz, que empuja al
       curso. Lleva un enlace real a la sección de precio (#precio), igual que el
       resto del sitio. NO llama a la API -> no gasta. */
    function addPaywall() {
      var b = document.createElement('div');
      b.className = 'msg bot';
      b.innerHTML = richText('¡Llegaste al final de tu prueba gratis! Con estas preguntas ya viste cómo enseño. '
        + 'Para aprender TODAS las canciones paso a paso —y preguntarme lo que quieras sin límite— llévate el curso completo.');
      var a = document.createElement('a');
      a.className = 'cite';
      a.href = '#precio';
      var play = document.createElement('span');
      play.className = 'play'; play.setAttribute('aria-hidden', 'true'); play.textContent = '★';
      a.appendChild(play);
      a.appendChild(document.createTextNode(' Ver el curso completo de Doc'));
      a.addEventListener('click', function () { setTimeout(syncSend, 400); });
      b.appendChild(a);
      log.appendChild(b); scrollLog();
    }

    function send(question, fallback) {
      if (busy || freeLocked) return;
      question = String(question || '').replace(/^\s+|\s+$/g, '').slice(0, MAX_LEN);
      if (!question) return;

      addUser(question);
      if (askInput) askInput.value = '';

      // Seguro extra: si ya estaba agotado, muro al curso SIN llamar a la API.
      if (freeUsed() >= FREE_LIMIT) { addPaywall(); lockFree(); renderFree(); return; }
      freeBump();
      renderFree();

      setBusy(true);

      var typing = null;
      var typingTimer = setTimeout(function () { typing = showTyping(); }, 160);
      var started = Date.now(), minWait = reduce ? 250 : 700;   // que el “escribiendo…” no parpadee

      fetchAnswer(question, function (res) {
        setTimeout(function () {
          clearTimeout(typingTimer);
          if (typing && typing.parentNode) typing.parentNode.removeChild(typing);
          var out = res || fallback || curatedFor(question);
          addBot(out.text, out.gate ? null : out.cite);   // con gate NO va cita: el bot no inventa
          setBusy(false);
          // Si esa era la última gratis, el muro aparece solo, sin esperar otro intento.
          if (freeUsed() >= FREE_LIMIT) { addPaywall(); lockFree(); }
        }, Math.max(0, minWait - (Date.now() - started)));
      });
    }

    /* chips = sugerencias. Pasan por la MISMA ruta (API primero); si falla, su
       respaldo es su propia respuesta curada, que siempre es buena. */
    QA.forEach(function (item) {
      var c = document.createElement('button');
      c.className = 'chip'; c.type = 'button'; c.textContent = item.q;
      c.addEventListener('click', function () { send(item.q, curatedRes(item)); });
      chipsBox.appendChild(c);
    });

    if (askForm && askInput) {
      askForm.addEventListener('submit', function (ev) { ev.preventDefault(); send(askInput.value); });
      askInput.addEventListener('input', syncSend);
    }
    syncSend();
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
