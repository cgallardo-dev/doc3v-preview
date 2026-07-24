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
  titulo: 'Aprende Guitarra con Doc 3V',
  modulos: [
    {
      t: 'Fundamentos — Empieza aquí',
      k: 'Lo que nadie te explica el primer día',
      lecciones: [
        { id:'l01', t:'Bienvenida: cómo aprovechar el curso', dur:'4:20', desc:'Cómo está armado el método y por qué, para adultos, el orden importa más que las horas. Tu única tarea hoy: terminar esta lección y agendar tus 15 minutos diarios.' },
        { id:'l02', t:'Partes de la guitarra y cómo sostenerla', dur:'7:05', desc:'Postura, mano izquierda y derecha. La mayoría de los dolores y los “no me sale” de las primeras semanas nacen aquí. Lo arreglamos desde el principio.' },
        { id:'l03', t:'Cómo afinar (y por qué se desafina)', dur:'6:12', desc:'Afinar de oído y con afinador. Una guitarra desafinada te hace creer que tocas mal cuando no es así.' },
        { id:'l04', t:'Leer un diagrama de acordes', dur:'5:40', desc:'El “mapa” que vas a usar todo el curso. Cuando lo lees de un vistazo, cualquier acorde nuevo deja de darte miedo.' },
      ],
    },
    {
      t: 'Tus primeros acordes',
      k: 'De cero a hacer sonar tu primera progresión',
      lecciones: [
        { id:'l05', t:'Mi menor (Em): tu primer acorde', dur:'6:30', desc:'El más fácil y el que mejor suena de entrada. Salimos de esta lección con un acorde limpio.' },
        { id:'l06', t:'Do (C) y Sol (G)', dur:'8:15', desc:'Dos pilares. Aquí empieza el verdadero trabajo de dedos: te muestro el truco del dedo ancla para que los cambios no te maten.' },
        { id:'l07', t:'La progresión mágica: Am · F · C · G', dur:'9:02', desc:'Con estos cuatro, en este orden, ya suenan cientos de canciones. Es lo primero que un alumno toca “de verdad”.' },
        { id:'l08', t:'Cambios de acorde sin cortar el ritmo', dur:'7:48', desc:'El muro donde casi todos abandonan. La solución no es fuerza: es anticipación. Ejercicio de 15 minutos incluido.' },
      ],
    },
    {
      t: 'El ritmo — la mano derecha',
      k: 'Lo que separa “sé acordes” de “toco canciones”',
      lecciones: [
        { id:'l09', t:'Tu primer rasgueo', dur:'6:55', desc:'Abajo-abajo-arriba. Simple, pero es la base de casi todo lo popular.' },
        { id:'l10', t:'Rasgueos para cientos de canciones', dur:'8:40', desc:'Tres patrones que cubren la mayoría de lo que quieres tocar. Cuándo usar cada uno.' },
        { id:'l11', t:'Tocar con el metrónomo', dur:'7:20', desc:'Mantener el tiempo es lo que hace que suenes “bien” aunque toques poco. Usamos el metrónomo del sitio.' },
      ],
    },
    {
      t: 'Tu primera canción',
      k: 'El momento en que todo hace clic',
      lecciones: [
        { id:'l12', t:'Elegir tu primera canción', dur:'5:15', desc:'Cómo saber si una canción está a tu nivel hoy, y dónde encontrar los acordes sin perderte.' },
        { id:'l13', t:'Cejilla y capo: toca en cualquier tono', dur:'8:05', desc:'El capo es el atajo que te deja tocar canciones “difíciles” desde ya. La cejilla, paso a paso, sin frustrarte.' },
        { id:'l14', t:'Tocar y cantar al mismo tiempo', dur:'9:30', desc:'El otro gran “no puedo”. Sí puedes: es cuestión de separar las dos tareas y volverlas a juntar, en orden.' },
      ],
    },
    {
      t: 'Suena mejor',
      k: 'Del “se entiende” al “qué bonito”',
      lecciones: [
        { id:'l15', t:'Limpieza: que no zumben las cuerdas', dur:'6:48', desc:'Por qué zumban y cómo se arregla, cuerda por cuerda. Detalle que cambia por completo cómo te oyes.' },
        { id:'l16', t:'Dinámica y expresión', dur:'7:10', desc:'Fuerte, suave, pausa. Lo que convierte una secuencia de acordes en música.' },
        { id:'l17', t:'Del papel a tocar de memoria', dur:'6:25', desc:'Cómo memorizar una canción de verdad, para tocarla sin mirar los acordes.' },
      ],
    },
    {
      t: 'Sigue creciendo',
      k: 'Para que esto no se quede en un curso más',
      lecciones: [
        { id:'l18', t:'Tu rutina de práctica de 15 minutos', dur:'6:00', desc:'La rutina exacta que te mantiene avanzando sin quemarte. Es el hábito, no el talento, lo que te hace tocar.' },
        { id:'l19', t:'Qué aprender después + comunidad', dur:'5:35', desc:'Tu mapa para los próximos meses y cómo seguir acompañado para no abandonar.' },
      ],
    },
  ],
};

/* Lista plana para anterior/siguiente y progreso. */
const LECCIONES = CURSO.modulos.flatMap(m => m.lecciones);
const TOTAL = LECCIONES.length;
const idx = id => LECCIONES.findIndex(l => l.id === id);
const moduloDe = id => CURSO.modulos.find(m => m.lecciones.some(l => l.id === id));

/* ============================ ESTADO (localStorage) ============================ */
const LS = {
  session: 'doc3v_session',
  done: 'doc3v_progress',
  streak: 'doc3v_streak',
};
const store = {
  get session() { try { return JSON.parse(localStorage.getItem(LS.session)); } catch { return null; } },
  set session(v) { localStorage.setItem(LS.session, JSON.stringify(v)); },
  clearSession() { localStorage.removeItem(LS.session); },

  get done() { try { return new Set(JSON.parse(localStorage.getItem(LS.done)) || []); } catch { return new Set(); } },
  set done(set) { localStorage.setItem(LS.done, JSON.stringify([...set])); },

  get streak() { try { return JSON.parse(localStorage.getItem(LS.streak)) || { n:0, last:null }; } catch { return { n:0, last:null }; } },
  set streak(v) { localStorage.setItem(LS.streak, JSON.stringify(v)); },
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
  const m = location.hash.match(/^#\/l\/(l\d+)/);
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

      <div class="l-video" role="img" aria-label="Video de la lección: ${esc(l.t)}">
        <div class="lv-inner">
          <button class="lv-play" type="button" aria-label="Reproducir (video de ejemplo)"><span>▶</span></button>
          <p class="lv-note">Video de la lección · ${l.dur}</p>
        </div>
        <span class="lv-badge">Ejemplo — aquí va el video real del curso</span>
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
            <p class="lt-txt">¿Se te traba algo de esta lección? Pregúntale al tutor y te lleva al minuto exacto donde Doc lo explica.</p>
            <button class="btn btn-line btn-sm" id="tutorBtn" type="button">Preguntarle al tutor</button>
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
  $('#tutorBtn').addEventListener('click', () => { if (window.docBotOpen) window.docBotOpen({ lesson: l.t }); });
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
      localStorage.removeItem(LS.done); localStorage.removeItem(LS.streak);
      renderStreak(); route();
    }
  });
}

/* ============================ ARRANQUE ============================ */
/* El aula vive DETRÁS del portón: sin sesión, de vuelta a acceso.html (patrón NotorAI). */
window.addEventListener('hashchange', () => { if (!$('#app').hidden) route(); });
document.addEventListener('DOMContentLoaded', () => {
  if (!store.session) { location.replace('acceso.html'); return; }
  $('#app').hidden = false;
  bootApp();
});
