/* assets/bot.js — Tutor flotante de Doc 3V.
 *
 * Botón flotante que NO molesta (arranca cerrado). Al abrirlo, es el bot REAL:
 * habla con /api/ask, responde con el contenido de Doc y CITA el minuto exacto
 * del video. Mismo motor y contrato que el chat del landing.
 *
 * Degradación: si la API falla o no está desplegada, cae a respuestas curadas
 * SIN mostrar un error feo. El texto del usuario nunca toca innerHTML (va por
 * textContent) → sin XSS.
 *
 * API pública: window.docBotOpen({ lesson: 'título' }) — el aula lo abre con el
 * contexto de la lección en la que está el alumno.
 */
(function () {
  'use strict';
  if (window.__docbot) return;           // no montar dos veces
  window.__docbot = true;

  var API_URL = '/api/ask';
  var API_TIMEOUT = 12000;
  var MAX_LEN = 300;
  var AVATAR = 'assets/img/joy.jpg';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Sugerencias + respaldo si la API no responde. Respuestas reales de Doc.
  var QA = [
    { q: '¿Qué acordes lleva Dueles?', a: 'Cuatro: <b>Si menor, Re, La y Sol</b>. En el precoro entra un <b>Mi menor</b>, y en el coro un <b>Fa# menor</b>.', v: 'Dueles — Jesse y Joy', id: 'GaNwd74lfu4', t: 8 },
    { q: '¿Cómo es el rasgueo del intro de Dueles?', a: 'Sobre Si menor: <b>bajo, golpe, bloqueo y golpe</b>. Doc lo desglosa cuerda por cuerda.', v: 'Dueles — Jesse y Joy', id: 'GaNwd74lfu4', t: 22 },
    { q: '¿Qué acordes lleva Las Mañanitas?', a: 'Solo <b>tres</b>: <b>La, Mi y Re</b>. Por eso es de las mejores para arrancar.', v: 'Las Mañanitas', id: 'uH4hbW4HKbw', t: 9 },
    { q: '¿El triste lleva cejilla?', a: 'Lleva <b>cejilla en el tercer traste</b>. Los acordes: La menor, Re menor 7, Sol 7, Do maj7 y Mi 7.', v: 'El triste — José José', id: 'WZ0WMiwEyPE', t: 10 }
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  // Solo <b> se revive; todo lo demás queda escapado (mismo criterio del landing).
  function rich(s) { return esc(s).replace(/&lt;(\/?)b&gt;/g, '<$1b>'); }

  function words(s) {
    var n = String(s || '').toLowerCase()
      .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
      .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
      .replace(/[^a-z0-9]+/g, ' ').split(' ');
    var o = [];
    for (var i = 0; i < n.length; i++) if (n[i].length >= 4 && o.indexOf(n[i]) < 0) o.push(n[i]);
    return o;
  }
  function curatedRes(item) {
    var mm = Math.floor(item.t / 60), ss = item.t % 60;
    return { gate: false, text: item.a, cite: { title: item.v, time: mm + ':' + (ss < 10 ? '0' : '') + ss, url: 'https://www.youtube.com/watch?v=' + item.id + '&t=' + item.t + 's' } };
  }
  // Jaccard (intersección/unión): evita contestar la canción equivocada con cita.
  function curatedFor(q) {
    var qw = words(q), best = null, bs = 0;
    for (var i = 0; i < QA.length && qw.length; i++) {
      var cw = words(QA[i].q), hit = 0;
      for (var j = 0; j < cw.length; j++) if (qw.indexOf(cw[j]) >= 0) hit++;
      var uni = qw.length + cw.length - hit;
      var sc = uni ? hit / uni : 0;
      if (sc > bs) { bs = sc; best = QA[i]; }
    }
    return bs >= 0.6 ? curatedRes(best) : { gate: true, text: 'Ahora mismo no puedo revisar los videos de Doc. Inténtalo de nuevo en unos segundos o toca una de las preguntas de abajo.' };
  }

  // ---- markup ----------------------------------------------------------------
  var root = document.createElement('div');
  root.className = 'docbot';
  root.innerHTML =
    '<button class="docbot-fab" type="button" aria-label="Abrir el tutor de Doc" aria-expanded="false">' +
      '<img src="' + AVATAR + '" alt="" width="60" height="60">' +
      '<span class="docbot-dot" aria-hidden="true"></span>' +
    '</button>' +
    '<div class="docbot-nudge" hidden>¿Se te traba algo? Pregúntame 🎸</div>' +
    '<section class="docbot-panel" role="dialog" aria-label="Tutor de Doc 3V" hidden>' +
      '<header class="docbot-head">' +
        '<span class="docbot-hav"><img src="' + AVATAR + '" alt="" width="38" height="38"></span>' +
        '<div class="docbot-who"><b>Tutor de Doc 3V</b><span>● En línea · cita el minuto exacto</span></div>' +
        '<button class="docbot-x" type="button" aria-label="Cerrar el tutor">✕</button>' +
      '</header>' +
      '<div class="docbot-log" id="docbotLog" aria-live="polite"></div>' +
      '<div class="docbot-chips" id="docbotChips"></div>' +
      '<form class="docbot-ask" id="docbotForm" autocomplete="off">' +
        '<input class="docbot-input" id="docbotInput" type="text" maxlength="' + MAX_LEN + '" placeholder="Pregúntale al tutor de Doc…" enterkeyhint="send">' +
        '<button class="docbot-send" id="docbotSend" type="submit" aria-label="Enviar">↑</button>' +
      '</form>' +
    '</section>';
  document.body.appendChild(root);

  var fab = root.querySelector('.docbot-fab');
  var panel = root.querySelector('.docbot-panel');
  var nudge = root.querySelector('.docbot-nudge');
  var whoSub = root.querySelector('.docbot-who span');
  var log = root.querySelector('#docbotLog');
  var chipsBox = root.querySelector('#docbotChips');
  var form = root.querySelector('#docbotForm');
  var input = root.querySelector('#docbotInput');
  var sendBtn = root.querySelector('#docbotSend');
  var busy = false, greeted = false;
  var scopeVideo = '';   // si está en modo tutorial, solo pregunta sobre ese video

  // Preguntas genéricas para el modo tutorial (no dependen de la canción).
  var SCOPED_CHIPS = ['¿Qué acordes lleva?', '¿Cómo es el rasgueo?', '¿Lleva cejilla?', '¿Por dónde empiezo?'];

  function scrollLog() { log.scrollTop = log.scrollHeight; }
  function addUser(t) { var d = document.createElement('div'); d.className = 'dm user'; d.textContent = t; log.appendChild(d); scrollLog(); }
  function addBot(text, cite) {
    var b = document.createElement('div'); b.className = 'dm bot'; b.innerHTML = rich(text);
    if (cite && cite.url && /^https?:\/\//i.test(cite.url)) {
      var a = document.createElement('a'); a.className = 'dm-cite'; a.href = cite.url; a.target = '_blank'; a.rel = 'noopener';
      var p = document.createElement('span'); p.setAttribute('aria-hidden', 'true'); p.textContent = '▶';
      a.appendChild(p);
      a.appendChild(document.createTextNode(' Ver en “' + (cite.title || 'el video de Doc') + '”' + (cite.time ? ' · ' + cite.time : '')));
      b.appendChild(a);
    }
    log.appendChild(b); scrollLog();
  }
  function showTyping() { var t = document.createElement('div'); t.className = 'dm typing'; t.setAttribute('aria-hidden', 'true'); t.innerHTML = '<i></i><i></i><i></i>'; log.appendChild(t); scrollLog(); return t; }

  function fetchAnswer(q, done) {
    if (!window.fetch || !window.AbortController) { done(null); return; }
    var ctrl = new AbortController(), settled = false;
    var timer = setTimeout(function () { ctrl.abort(); }, API_TIMEOUT);
    function fin(r) { if (settled) return; settled = true; clearTimeout(timer); done(r); }
    var payload = scopeVideo ? { question: q, q: q, video: scopeVideo } : { question: q, q: q };
    fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ctrl.signal })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (d) { if (!d || typeof d.text !== 'string' || !d.text) throw 0; fin(d); })
      .catch(function () { fin(null); });
  }

  function syncSend() { sendBtn.disabled = busy || !input.value.replace(/^\s+|\s+$/g, ''); }
  function setBusy(on) { busy = on; input.readOnly = on; syncSend(); }

  function send(q, fallback) {
    if (busy) return;
    q = String(q || '').replace(/^\s+|\s+$/g, '').slice(0, MAX_LEN);
    if (!q) return;
    addUser(q); input.value = ''; syncSend();
    setBusy(true);
    var tp = null, tt = setTimeout(function () { tp = showTyping(); }, 150);
    var t0 = Date.now(), minw = reduce ? 200 : 650;
    fetchAnswer(q, function (res) {
      setTimeout(function () {
        clearTimeout(tt); if (tp && tp.parentNode) tp.parentNode.removeChild(tp);
        // En modo tutorial NO se usa el curado general (respondería otra canción):
        // si la API no está, se dice que no está disponible.
        var out = res || fallback || (scopeVideo
          ? { gate: true, text: 'Ahora mismo no puedo revisar este tutorial. Inténtalo de nuevo en unos segundos.' }
          : curatedFor(q));
        addBot(out.text, out.gate ? null : out.cite);
        setBusy(false);
      }, Math.max(0, minw - (Date.now() - t0)));
    });
  }

  function renderChips() {
    chipsBox.innerHTML = '';
    if (scopeVideo) {                         // modo tutorial: preguntas genéricas de la canción
      SCOPED_CHIPS.forEach(function (qtext) {
        var c = document.createElement('button'); c.className = 'dm-chip'; c.type = 'button'; c.textContent = qtext;
        c.addEventListener('click', function () { send(qtext); });
        chipsBox.appendChild(c);
      });
    } else {                                  // modo general: ejemplos con canciones reales
      QA.forEach(function (item) {
        var c = document.createElement('button'); c.className = 'dm-chip'; c.type = 'button'; c.textContent = item.q;
        c.addEventListener('click', function () { send(item.q, curatedRes(item)); });
        chipsBox.appendChild(c);
      });
    }
  }

  function greet(title) {
    if (greeted) return; greeted = true;
    if (scopeVideo) {
      var song = title ? '“' + esc(String(title).split(' — ')[0]) + '”' : 'este tutorial';
      addBot('¡Hola! Soy el tutor de ' + song + '. Pregúntame lo que se te trabe de esta canción y te llevo al minuto exacto donde Doc lo explica. 🎸 (Solo respondo sobre este tutorial.)', null);
    } else {
      addBot('¡Hola! Soy el tutor de Doc. Pregúntame lo que se te trabe de cualquier canción y te llevo al minuto exacto donde él lo explica. 🎸', null);
    }
    renderChips();
  }

  function open(ctx) {
    ctx = ctx || {};
    var newScope = ctx.video || '';
    // Si cambió el scope (o es la primera vez), reinicia la conversación.
    if (newScope !== scopeVideo || !greeted) { scopeVideo = newScope; greeted = false; log.innerHTML = ''; }
    panel.hidden = false; fab.setAttribute('aria-expanded', 'true'); root.classList.add('is-open'); nudge.hidden = true;
    if (whoSub) whoSub.textContent = scopeVideo ? '● Solo sobre este tutorial' : '● En línea · cita el minuto exacto';
    greet(ctx.title);
    setTimeout(function () { input.focus(); }, reduce ? 0 : 180);
  }
  function close() { panel.hidden = true; fab.setAttribute('aria-expanded', 'false'); root.classList.remove('is-open'); }

  fab.addEventListener('click', function () { panel.hidden ? open() : close(); });
  root.querySelector('.docbot-x').addEventListener('click', close);
  form.addEventListener('submit', function (e) { e.preventDefault(); send(input.value); });
  input.addEventListener('input', syncSend);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) close(); });

  // El aula abre el bot con el contexto de la lección.
  window.docBotOpen = function (ctx) { open(ctx || {}); };

  // Un solo empujoncito sutil, y se va solo. No molesta.
  setTimeout(function () { if (panel.hidden && !greeted) { nudge.hidden = false; setTimeout(function () { nudge.hidden = true; }, 6000); } }, 3500);

  syncSend();
})();
