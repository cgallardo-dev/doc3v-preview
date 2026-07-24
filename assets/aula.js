/* Doc 3V — El Aula (app del estudiante).
   Prototipo client-side: sin backend todavía. La sesión, el progreso y la racha
   viven en localStorage. Aquí es donde luego enchufan: (1) el checkout/pago que crea
   la cuenta, (2) el login real, (3) los videos reales de cada lección.
   Un ingeniero centraliza los datos del curso en UN sitio; abajo está el índice completo. */

'use strict';

/* ============================ DATOS DEL CURSO ============================ */
/* 19 lecciones (las del curso real de Doc), agrupadas en 6 módulos.
   Cambiar aquí = cambia toda la app. `v` = id/embed del video (pendiente: reales). */
const CURSO = {
  titulo: 'Tutoriales de Doc 3V',
  modulos: [
  {
    t: 'Para empezar — pocos acordes',
    k: 'Tus primeras canciones, con 3 o 4 acordes',
    lecciones: [
      {
        id: 't01',
        t: 'Las Mañanitas',
        dur: '1:34',
        vid: 'uH4hbW4HKbw',
        desc: 'Acordes, ritmo y el paso a paso para tocar «Las Mañanitas» con Doc, al minuto exacto.'
      },
      {
        id: 't02',
        t: 'El mamut chiquitito',
        dur: '1:29',
        vid: '4lKg4KQzLk8',
        desc: 'Acordes, ritmo y el paso a paso para tocar «El mamut chiquitito» con Doc, al minuto exacto.'
      },
      {
        id: 't03',
        t: 'Reto: sacar la intro de oído',
        dur: '13:28',
        vid: 'AfO67ZKjbOE',
        desc: 'Acordes, ritmo y el paso a paso para tocar «Reto: sacar la intro de oído» con Doc, al minuto exacto.'
      }
    ]
  },
  {
    t: 'Boleros y clásicos',
    k: 'Julio Jaramillo, José José y los eternos',
    lecciones: [
      {
        id: 't04',
        t: 'Ayer y hoy — Julio Jaramillo',
        dur: '2:45',
        vid: 'urLTAdGyFO0',
        desc: 'Acordes, ritmo y el paso a paso para tocar «Ayer y hoy» con Doc, al minuto exacto.'
      },
      {
        id: 't05',
        t: 'Nuestro juramento — Julio Jaramillo',
        dur: '3:00',
        vid: 'p9Qb7VqC6Jw',
        desc: 'Acordes, ritmo y el paso a paso para tocar «Nuestro juramento» con Doc, al minuto exacto.'
      },
      {
        id: 't06',
        t: 'Ódiame — Julio Jaramillo',
        dur: '1:33',
        vid: 'vwRCcklPtwo',
        desc: 'Acordes, ritmo y el paso a paso para tocar «Ódiame» con Doc, al minuto exacto.'
      },
      {
        id: 't07',
        t: 'Para ti madrecita — Julio Jaramillo',
        dur: '1:06',
        vid: 'NErC68jVoi8',
        desc: 'Acordes, ritmo y el paso a paso para tocar «Para ti madrecita» con Doc, al minuto exacto.'
      },
      {
        id: 't08',
        t: 'Reloj ingrato — José y el Toro',
        dur: '2:11',
        vid: 'BxvuXdhvRhw',
        desc: 'Acordes, ritmo y el paso a paso para tocar «Reloj ingrato» con Doc, al minuto exacto.'
      },
      {
        id: 't09',
        t: 'El triste — José José',
        dur: '2:31',
        vid: 'WZ0WMiwEyPE',
        desc: 'Acordes, ritmo y el paso a paso para tocar «El triste» con Doc, al minuto exacto.'
      },
      {
        id: 't10',
        t: 'Cien años — Pedro Infante',
        dur: '2:09',
        vid: 'FRX92i8fGI0',
        desc: 'Acordes, ritmo y el paso a paso para tocar «Cien años» con Doc, al minuto exacto.'
      },
      {
        id: 't11',
        t: 'Me dijeron que te vieron drogada en Brasil — Ozcar Horna',
        dur: '1:14',
        vid: 'fjVHQL5u3Wg',
        desc: 'Acordes, ritmo y el paso a paso para tocar «Me dijeron que te vieron drogada en Brasil» con Doc, al minuto exacto.'
      }
    ]
  },
  {
    t: 'Baladas y pop',
    k: 'De Jesse y Joy a Soda Stereo',
    lecciones: [
      {
        id: 't12',
        t: 'Dueles — Jesse y Joy',
        dur: '1:46',
        vid: 'GaNwd74lfu4',
        desc: 'Acordes, ritmo y el paso a paso para tocar «Dueles» con Doc, al minuto exacto.'
      },
      {
        id: 't13',
        t: 'Beso — Josean Log',
        dur: '1:31',
        vid: 'ornii9BTQB8',
        desc: 'Acordes, ritmo y el paso a paso para tocar «Beso» con Doc, al minuto exacto.'
      },
      {
        id: 't14',
        t: 'Traición — Alex Ponce',
        dur: '1:31',
        vid: 'qTqg1Bpo94Q',
        desc: 'Acordes, ritmo y el paso a paso para tocar «Traición» con Doc, al minuto exacto.'
      },
      {
        id: 't15',
        t: 'Coqueta — Heredero',
        dur: '1:16',
        vid: 'cz5CBL8N9xg',
        desc: 'Acordes, ritmo y el paso a paso para tocar «Coqueta» con Doc, al minuto exacto.'
      },
      {
        id: 't16',
        t: 'First Love',
        dur: '1:27',
        vid: 'KRdxNVlGQeg',
        desc: 'Acordes, ritmo y el paso a paso para tocar «First Love» con Doc, al minuto exacto.'
      },
      {
        id: 't17',
        t: 'Besos en guerra — Morat x Juanes',
        dur: '1:48',
        vid: '0LlwPa_SRsg',
        desc: 'Acordes, ritmo y el paso a paso para tocar «Besos en guerra» con Doc, al minuto exacto.'
      },
      {
        id: 't18',
        t: 'De música ligera — Soda Stereo',
        dur: '1:48',
        vid: 'g9QHumKdifs',
        desc: 'Acordes, ritmo y el paso a paso para tocar «De música ligera» con Doc, al minuto exacto.'
      },
      {
        id: 't19',
        t: 'Cama y mesa — Roberto Carlos',
        dur: '1:59',
        vid: '0A6fts5ylQc',
        desc: 'Acordes, ritmo y el paso a paso para tocar «Cama y mesa» con Doc, al minuto exacto.'
      },
      {
        id: 't20',
        t: 'Te amo y más — The Book of Life',
        dur: '3:04',
        vid: 'becfgrd2fPI',
        desc: 'Acordes, ritmo y el paso a paso para tocar «Te amo y más» con Doc, al minuto exacto.'
      }
    ]
  },
  {
    t: 'Ranchera y regional',
    k: 'Vicente, mariachi y sabor mexicano',
    lecciones: [
      {
        id: 't21',
        t: 'Amor Salvaje — Chaqueño Palavecino',
        dur: '1:31',
        vid: 'ftvKCq87W8I',
        desc: 'Acordes, ritmo y el paso a paso para tocar «Amor Salvaje» con Doc, al minuto exacto.'
      },
      {
        id: 't22',
        t: 'Cuando cuando — José y el Toro',
        dur: '2:00',
        vid: 'Nu1LGNtUjTE',
        desc: 'Acordes, ritmo y el paso a paso para tocar «Cuando cuando» con Doc, al minuto exacto.'
      },
      {
        id: 't23',
        t: 'A la sombra de mi madre — Leo Dan',
        dur: '1:08',
        vid: 'p9-WpOjEAfw',
        desc: 'Acordes, ritmo y el paso a paso para tocar «A la sombra de mi madre» con Doc, al minuto exacto.'
      },
      {
        id: 't24',
        t: 'Cuando quería ser grande — Vicente Fernández',
        dur: '1:30',
        vid: 'gq6HxXRQAzs',
        desc: 'Acordes, ritmo y el paso a paso para tocar «Cuando quería ser grande» con Doc, al minuto exacto.'
      },
      {
        id: 't25',
        t: 'Canción del Mariachi (Desperado) — Antonio Banderas',
        dur: '1:33',
        vid: 'tx4cDSsBnuA',
        desc: 'Acordes, ritmo y el paso a paso para tocar «Canción del Mariachi (Desperado)» con Doc, al minuto exacto.'
      },
      {
        id: 't26',
        t: 'El Malo — Manuel Lizarazo',
        dur: '1:12',
        vid: 'JieHqBO0jZc',
        desc: 'Acordes, ritmo y el paso a paso para tocar «El Malo» con Doc, al minuto exacto.'
      },
      {
        id: 't27',
        t: 'Juyayay — Jayac',
        dur: '2:00',
        vid: 'DVx5rqjUDWg',
        desc: 'Acordes, ritmo y el paso a paso para tocar «Juyayay» con Doc, al minuto exacto.'
      }
    ]
  }
],
};

/* Lista plana para anterior/siguiente y progreso. */
const LECCIONES = CURSO.modulos.flatMap(m => m.lecciones);
const TOTAL = LECCIONES.length;
const idx = id => LECCIONES.findIndex(l => l.id === id);
const moduloDe = id => CURSO.modulos.find(m => m.lecciones.some(l => l.id === id));

/* ============================ ESTADO (localStorage) ============================ */
/* A prueba de webviews: el navegador interno de Instagram y el modo incógnito pueden
   bloquear localStorage. Si falla, todo vive en memoria: el progreso no persiste,
   pero el aula FUNCIONA — jamás una pantalla negra por un setter que revienta. */
const storage = (() => {
  try {
    const t = '__doc3v_test';
    localStorage.setItem(t, '1'); localStorage.removeItem(t);
    return localStorage;
  } catch (e) {
    const mem = {};
    return {
      getItem: k => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: k => { delete mem[k]; },
    };
  }
})();
const LS = {
  session: 'doc3v_session',
  done: 'doc3v_progress',
  streak: 'doc3v_streak',
};
const store = {
  get session() { try { return JSON.parse(storage.getItem(LS.session)); } catch { return null; } },
  set session(v) { storage.setItem(LS.session, JSON.stringify(v)); },
  clearSession() { storage.removeItem(LS.session); },

  get done() { try { return new Set(JSON.parse(storage.getItem(LS.done)) || []); } catch { return new Set(); } },
  set done(set) { storage.setItem(LS.done, JSON.stringify([...set])); },

  get streak() { try { return JSON.parse(storage.getItem(LS.streak)) || { n:0, last:null }; } catch { return { n:0, last:null }; } },
  set streak(v) { storage.setItem(LS.streak, JSON.stringify(v)); },
};

const todayKey = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

/* ============================ DOM helpers ============================ */
const $ = sel => document.querySelector(sel);
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

/* ============================ APP ============================ */
function bootApp() {
  const s = store.session;
  const name = (s && s.name) ? s.name : 'Alumno';
  $('#userName').textContent = name;
  $('#userAv').textContent = name.charAt(0).toUpperCase();

  buildNav();
  renderStreak();
  wireChrome();
  route();
}

/* ---- progreso ---- */
function pct() { return Math.round((store.done.size / TOTAL) * 100); }
function renderProgressTop() {
  const p = pct();
  $('#apFill').style.width = p + '%';
  $('#apPct').textContent = p + '%';
}
function toggleDone(id, value) {
  const done = store.done;
  if (value === undefined) value = !done.has(id);
  if (value) done.add(id); else done.delete(id);
  store.done = done;
  renderProgressTop();
  buildNav();
}

/* ---- racha de práctica ---- */
function renderStreak() { $('#streakN').textContent = store.streak.n; }
function practiceToday() {
  const st = store.streak;
  const today = todayKey();
  if (st.last === today) return st; // ya contó hoy
  if (st.last && daysBetween(st.last, today) === 1) st.n += 1; // día consecutivo
  else st.n = 1; // primer día o se cortó la racha
  st.last = today;
  store.streak = st;
  renderStreak();
  return st;
}

/* ============================ NAVEGACIÓN LATERAL ============================ */
function buildNav() {
  const done = store.done;
  const current = (location.hash.match(/^#\/l\/(l\d+)/) || [])[1];
  const nav = $('#nav');
  nav.innerHTML = '';

  const head = el('a', 'nav-home' + (!current ? ' is-active' : ''));
  head.href = '#/';
  head.innerHTML = `<span class="nh-ic">◈</span><span>Mi aula</span>`;
  nav.appendChild(head);

  CURSO.modulos.forEach((m, mi) => {
    const total = m.lecciones.length;
    const hechas = m.lecciones.filter(l => done.has(l.id)).length;
    const wrap = el('div', 'nav-mod');
    wrap.innerHTML = `
      <div class="nm-head">
        <span class="nm-n">Módulo ${mi + 1}</span>
        <span class="nm-count">${hechas}/${total}</span>
      </div>
      <p class="nm-title">${esc(m.t)}</p>`;
    const ul = el('div', 'nm-list');
    m.lecciones.forEach(l => {
      const on = current === l.id;
      const ok = done.has(l.id);
      const a = el('a', 'nm-item' + (on ? ' is-active' : '') + (ok ? ' is-done' : ''));
      a.href = `#/l/${l.id}`;
      a.innerHTML = `<span class="nm-check" aria-hidden="true">${ok ? '✓' : ''}</span>
        <span class="nm-lt">${esc(l.t)}</span>
        <span class="nm-dur">${l.dur}</span>`;
      ul.appendChild(a);
    });
    wrap.appendChild(ul);
    nav.appendChild(wrap);
  });
}

/* ============================ VISTAS ============================ */
function route() {
  const m = location.hash.match(/^#\/l\/([\w-]+)/);
  if (m && idx(m[1]) !== -1) viewLesson(m[1]);
  else viewDashboard();
  renderProgressTop();
  buildNav();
  $('#view').focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

/* ---- DASHBOARD ---- */
function viewDashboard() {
  const done = store.done;
  const p = pct();
  const next = LECCIONES.find(l => !done.has(l.id)) || LECCIONES[0];
  const nextMod = moduloDe(next.id);
  const finished = done.size === TOTAL;
  const name = (store.session && store.session.name) || 'Alumno';
  const st = store.streak;

  const view = $('#view');
  view.innerHTML = `
    <div class="dash">
      <div class="dash-hi">
        <p class="eyebrow">Tu aula</p>
        <h1>Hola, ${esc(name)}. ${finished ? '¡Terminaste el curso! 🎸' : 'Seguimos tocando.'}</h1>
        <p class="dash-sub">${finished
          ? 'Completaste las 19 lecciones. Vuelve a la que quieras repasar, o pasa a “Qué aprender después”.'
          : 'La guitarra no se aprende viendo: se aprende con los dedos, un poco cada día. Retoma justo donde lo dejaste.'}</p>
      </div>

      <div class="dash-grid">
        <article class="card card-continue">
          <span class="cc-ey">${done.has(next.id) ? 'Repasar' : (done.size ? 'Continuar donde lo dejaste' : 'Empezar por aquí')}</span>
          <h2>${esc(next.t)}</h2>
          <p class="cc-mod">${esc(nextMod.t)} · ${next.dur}</p>
          <a class="btn btn-gold" href="#/l/${next.id}">${done.size ? 'Continuar' : 'Empezar'} la lección →</a>
        </article>

        <article class="card card-prog">
          <span class="cc-ey">Tu avance</span>
          <div class="ring" style="--p:${p}">
            <div class="ring-num"><b>${p}%</b><small>${done.size}/${TOTAL} lecciones</small></div>
          </div>
          <div class="prog-line"><i style="width:${p}%"></i></div>
        </article>

        <article class="card card-streak">
          <span class="cc-ey">Práctica</span>
          <p class="cs-big">🔥 <b>${st.n}</b> ${st.n === 1 ? 'día' : 'días'}</p>
          <p class="cs-txt">${st.last === todayKey()
            ? '¡Hoy ya practicaste! Vuelve mañana para no cortar la racha.'
            : 'El hábito diario es lo que te hace tocar. ¿Ya agarraste la guitarra hoy?'}</p>
          <button class="btn ${st.last === todayKey() ? 'btn-line' : 'btn-gold'} btn-sm" id="practiceBtn" ${st.last === todayKey() ? 'disabled' : ''}>
            ${st.last === todayKey() ? '✓ Practicado hoy' : 'Practiqué hoy 🎸'}
          </button>
        </article>
      </div>

      <div class="dash-mods">
        <h3 class="dm-h">El curso completo</h3>
        ${CURSO.modulos.map((m, mi) => {
          const hechas = m.lecciones.filter(l => done.has(l.id)).length;
          return `
          <div class="dm-mod">
            <div class="dm-mhead">
              <div>
                <span class="dm-mn">Módulo ${mi + 1}</span>
                <p class="dm-mt">${esc(m.t)}</p>
                <p class="dm-mk">${esc(m.k)}</p>
              </div>
              <span class="dm-badge ${hechas === m.lecciones.length ? 'is-full' : ''}">${hechas}/${m.lecciones.length}</span>
            </div>
            <div class="dm-lessons">
              ${m.lecciones.map(l => `
                <a class="dm-les ${done.has(l.id) ? 'is-done' : ''}" href="#/l/${l.id}">
                  <span class="dm-ck" aria-hidden="true">${done.has(l.id) ? '✓' : '▶'}</span>
                  <span class="dm-lt">${esc(l.t)}</span>
                  <span class="dm-dur">${l.dur}</span>
                </a>`).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;

  const pb = $('#practiceBtn');
  if (pb) pb.addEventListener('click', () => { practiceToday(); viewDashboard(); });
}

/* ---- LECCIÓN ---- */
function viewLesson(id) {
  const l = LECCIONES[idx(id)];
  const mod = moduloDe(id);
  const i = idx(id);
  const prev = i > 0 ? LECCIONES[i - 1] : null;
  const next = i < TOTAL - 1 ? LECCIONES[i + 1] : null;
  const isDone = store.done.has(id);
  const num = i + 1;

  const view = $('#view');
  view.innerHTML = `
    <div class="lesson">
      <a class="l-back" href="#/">← Mi aula</a>
      <p class="l-crumb">${esc(mod.t)} · Lección ${num} de ${TOTAL}</p>
      <h1 class="l-title">${esc(l.t)}</h1>

      <div class="l-video" data-vid="${l.vid}">
        <img class="lv-thumb" src="https://img.youtube.com/vi/${l.vid}/hqdefault.jpg" alt="Tutorial de Doc: ${esc(l.t)}" loading="lazy">
        <button class="lv-play" type="button" aria-label="Reproducir el tutorial de Doc"><span>▶</span></button>
        <span class="lv-dur">${l.dur}</span>
      </div>

      <div class="l-body">
        <div class="l-main">
          <h2 class="l-sub">Sobre esta lección</h2>
          <p class="l-desc">${esc(l.desc)}</p>

          <div class="l-actions">
            <button class="btn ${isDone ? 'btn-line' : 'btn-gold'}" id="doneBtn">
              ${isDone ? '✓ Completada' : 'Marcar como completada'}
            </button>
            ${next ? `<a class="btn btn-line" href="#/l/${next.id}">Siguiente lección →</a>` : ''}
          </div>
        </div>

        <aside class="l-side">
          <div class="l-tutor">
            <div class="lt-head"><span class="lt-av"><img src="assets/img/joy.jpg" alt="" width="36" height="36"></span>
              <div><b>Tutor de Doc</b><span class="lt-on">● En línea 24/7</span></div>
            </div>
            <p class="lt-txt">¿Se te traba algo de <b>${esc(l.t.split(' — ')[0])}</b>? Pregúntale al tutor de este tutorial y te lleva al minuto exacto donde Doc lo explica.</p>
            <button class="btn btn-line btn-sm" id="tutorBtn" type="button">Preguntar sobre este tutorial</button>
          </div>

          <div class="l-practice">
            <p class="lp-h">Tu práctica de hoy</p>
            <p class="lp-txt">Después de ver la clase, agarra la guitarra 15 minutos. Eso es lo que de verdad te hace tocar.</p>
            <button class="btn btn-gold btn-sm" id="lpBtn">Practiqué hoy 🎸</button>
          </div>
        </aside>
      </div>

      <nav class="l-nav" aria-label="Navegación entre lecciones">
        ${prev ? `<a class="ln-prev" href="#/l/${prev.id}"><span>← Anterior</span><b>${esc(prev.t)}</b></a>` : '<span></span>'}
        ${next ? `<a class="ln-next" href="#/l/${next.id}"><span>Siguiente →</span><b>${esc(next.t)}</b></a>` : ''}
      </nav>
    </div>`;

  $('#doneBtn').addEventListener('click', () => {
    const willBeDone = !store.done.has(id);
    toggleDone(id, willBeDone);
    if (willBeDone && next) { location.hash = `#/l/${next.id}`; }
    else viewLesson(id);
  });
  // Click-to-play: carga el iframe de YouTube solo al tocar (rápido y liviano).
  const lv = $('.l-video');
  if (lv) lv.addEventListener('click', () => {
    lv.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${l.vid}?autoplay=1&rel=0&modestbranding=1" title="${esc(l.t)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
    lv.classList.add('is-playing');
  }, { once: true });

  // El bot del tutorial salta el video de ESTA página al minuto citado, sin abrir
  // YouTube aparte. Recarga el iframe con ?start= (simple y fiable).
  window.docBotSeek = (seconds) => {
    const box = $('.l-video'); if (!box) return false;
    const vid = box.getAttribute('data-vid') || l.vid;
    box.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${vid}?start=${Math.max(0, seconds | 0)}&autoplay=1&rel=0&modestbranding=1" title="${esc(l.t)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    box.classList.add('is-playing');
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  };

  // Tutor SCOPED: solo responde sobre ESTE tutorial (su video). El flotante global
  // (abajo-derecha) sigue respondiendo sobre todo.
  $('#tutorBtn').addEventListener('click', () => { if (window.docBotOpen) window.docBotOpen({ video: l.vid, title: l.t }); });
  $('#lpBtn').addEventListener('click', e => { practiceToday(); e.target.textContent = '✓ Práctica registrada'; e.target.disabled = true; e.target.classList.replace('btn-gold', 'btn-line'); });
}

/* ============================ CHROME (barra, menú) ============================ */
function wireChrome() {
  const btn = $('#userBtn'), drop = $('#userDrop');
  btn.addEventListener('click', () => {
    const open = drop.hidden;
    drop.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.au-menu')) { drop.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
  });
  $('#logoutBtn').addEventListener('click', () => { store.clearSession(); location.replace('acceso.html'); });
  $('#resetBtn').addEventListener('click', () => {
    if (confirm('¿Reiniciar tu progreso y tu racha? Esto no borra tu acceso.')) {
      storage.removeItem(LS.done); storage.removeItem(LS.streak);
      renderStreak(); route();
    }
  });
}

/* ============================ ARRANQUE ============================ */
/* El aula vive DETRÁS del portón: sin sesión, de vuelta a acceso.html (patrón NotorAI). */
window.addEventListener('hashchange', () => { if (!$('#app').hidden) route(); });
document.addEventListener('DOMContentLoaded', () => { try {
  const params = new URLSearchParams(location.search);
  const demoMode = params.has('demo');   // aula.html?demo[=<idLeccion>] -> abre-y-prueba

  // Link directo para MOSTRARLE a Doc: entra en modo invitado (sin registro) y
  // cae dentro de un tutorial con el tutor ya abierto. Sus primeros 5 segundos
  // son la magia, sin buscar nada.
  if (demoMode && !store.session) {
    store.session = { email: 'invitado@demo.doc3v', name: 'Invitado', via: 'demo-link', plan: 'free', ts: Date.now() };
  }

  // Si viene desde acceso.html pero la sesión no sobrevivió el salto (webview de
  // Instagram / incógnito), entra igual: jamás un rebote en bucle ni pantalla negra.
  const desdeAcceso = params.get('via') === 'acceso' || /acceso\.html/.test(document.referrer);
  if (!store.session && desdeAcceso) {
    store.session = { email: 'invitado@demo.doc3v', name: 'Alumno', via: 'acceso-sin-storage', plan: 'free', ts: Date.now() };
  }

  if (!store.session) { location.replace('acceso.html'); return; }
  $('#app').hidden = false;
  const bs = document.getElementById('bootSafe'); if (bs) bs.hidden = true;
  bootApp();

  if (demoMode) {
    const want = params.get('demo');
    const lesId = (want && idx(want) !== -1) ? want : LECCIONES[0].id;   // por defecto, el 1er tutorial
    const les = LECCIONES[idx(lesId)];
    location.hash = `#/l/${lesId}`;
    route();
    // abrir el tutor de ESE tutorial una vez pintada la lección
    setTimeout(() => { if (window.docBotOpen) window.docBotOpen({ video: les.vid, title: les.t }); }, 450);
  }
} catch (e) { if (window.__aulaBootFail) window.__aulaBootFail(e); } });
