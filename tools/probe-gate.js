/* tools/probe-gate.js — ¿el bot le va a mentir a Doc?
 *
 * Mide el FRENO ANTI-INVENTO (gate) contra preguntas adversarias: canciones que
 * Doc NO cubrió, temas de guitarra que no están en el índice, y preguntas de las
 * que SÍ están (control). Responde la única pregunta que importa antes de
 * enseñar el demo:
 *
 *   ¿Hay alguna pregunta que pase el umbral y cite la canción EQUIVOCADA?
 *
 * Por qué existe: los 3 videos arrancan con el mismo molde ("Hoy te voy a
 * enseñar X"), así que sus fragmentos se parecen mucho entre sí. Una pregunta
 * sobre una canción ajena puede "engancharse" a ese molde y superar el gate.
 *
 * COSTO: solo embeddings de las preguntas. ~$0.0000004 cada una. Correrlo entero
 * cuesta menos de una milésima de dólar. NO llama al modelo de chat.
 *
 * USO:
 *   node tools/probe-gate.js
 * La llave se lee de OPENAI_API_KEY, o del .env del motor Python
 * (clon-mentor-24-7/demo/.env), que es donde ya la tienes.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const GATE = 0.28;   // mismo umbral que api/ask.js y clon_mentor.py
const TOP_K = 4;
const EMBED_MODEL = 'text-embedding-3-small';

// --- llave: env o el .env que ya usa el motor Python -----------------------
function loadKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  const candidatos = [
    path.resolve(__dirname, '../../clon-mentor-24-7/demo/.env'),
    path.resolve(__dirname, '../../clon-mentor-24-7/.env'),
    path.resolve(__dirname, '../.env'),
  ];
  for (const f of candidatos) {
    try {
      for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
        const t = line.trim();
        if (t.startsWith('OPENAI_API_KEY=')) {
          return t.slice('OPENAI_API_KEY='.length).replace(/^["']|["']$/g, '').trim();
        }
      }
    } catch (e) { /* siguiente */ }
  }
  return '';
}

function cosine(a, b) {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return (na && nb) ? d / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

function mmss(s) { s = Math.trunc(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

// --- el banco de pruebas ---------------------------------------------------
// TRAMPA  = canción o tema que Doc NO cubrió. El bot DEBERÍA frenar (gate).
// CONTROL = está en los videos. El bot DEBERÍA responder.
const PRUEBAS = [
  ['TRAMPA', '¿Qué acordes lleva Despacito?'],
  ['TRAMPA', '¿Cómo toco Bésame mucho en guitarra?'],
  ['TRAMPA', '¿Qué acordes tiene La Bamba?'],
  ['TRAMPA', '¿Cómo es el rasgueo de Hotel California?'],
  ['TRAMPA', '¿Me enseñas Wonderwall?'],
  ['TRAMPA', '¿Qué acordes lleva La Cucaracha?'],
  ['TRAMPA', '¿Cómo afino la guitarra?'],
  ['TRAMPA', '¿Qué cuerdas me recomiendas comprar?'],
  ['TRAMPA', '¿Cómo hago un barre en el quinto traste?'],
  ['TRAMPA', '¿Cuánto cuesta el curso?'],
  ['CONTROL', '¿Qué acordes lleva Dueles?'],
  ['CONTROL', '¿Cómo es el rasgueo del intro de Dueles?'],
  ['CONTROL', '¿Qué acordes lleva Las Mañanitas?'],
  ['CONTROL', '¿El triste lleva cejilla?'],
  ['CONTROL', '¿Qué opciones de mano derecha tiene El triste?'],
];

(async () => {
  const key = loadKey();
  if (!key) {
    console.error('FALTA la llave. Ponla en el entorno:  set OPENAI_API_KEY=sk-...');
    console.error('o deja el .env en clon-mentor-24-7/demo/.env (donde ya la usa el motor Python).');
    process.exit(1);
  }

  const idx = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../api/_index.json'), 'utf8'));
  const chunks = idx.chunks || [];
  console.log(`Índice: ${(idx.videos || []).length} videos, ${chunks.length} fragmentos.`);
  console.log(`Videos: ${(idx.videos || []).map(v => v.title).join(' · ')}`);
  console.log(`Umbral del gate: ${GATE}\n`);

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({ model: EMBED_MODEL, input: PRUEBAS.map(p => p[1]) }),
  });
  if (!res.ok) {
    console.error('OpenAI respondió ' + res.status + ': ' + (await res.text()).slice(0, 300));
    process.exit(1);
  }
  const embs = (await res.json()).data.map(d => d.embedding);

  let fugas = 0, frenosMalos = 0;
  console.log('TIPO      PASA?  SCORE   PREGUNTA -> qué citaría');
  console.log('-'.repeat(96));

  PRUEBAS.forEach((p, i) => {
    const [tipo, q] = p;
    const scored = chunks.map(c => ({ c, s: cosine(embs[i], c.emb) })).sort((a, b) => b.s - a.s);
    const best = scored.length ? scored[0].s : 0;
    const pasa = best >= GATE;
    const cita = pasa ? `«${scored[0].c.title}» ~${mmss(scored[0].c.start)}` : '(frena, no responde)';

    let marca = '  ';
    if (tipo === 'TRAMPA' && pasa) { marca = '!!'; fugas++; }
    if (tipo === 'CONTROL' && !pasa) { marca = '??'; frenosMalos++; }

    console.log(
      `${marca} ${tipo.padEnd(8)} ${(pasa ? 'SI' : 'no').padEnd(5)} ${best.toFixed(3)}   ${q}  ->  ${cita}`
    );
  });

  console.log('-'.repeat(96));
  console.log(`\nFUGAS (preguntas ajenas que el bot respondería igual): ${fugas} de ${PRUEBAS.filter(p => p[0] === 'TRAMPA').length}`);
  console.log(`FRENOS MALOS (preguntas válidas que rechaza):          ${frenosMalos} de ${PRUEBAS.filter(p => p[0] === 'CONTROL').length}`);

  if (fugas > 0) {
    const trampas = PRUEBAS.map((p, i) => [p, i]).filter(([p]) => p[0] === 'TRAMPA')
      .map(([p, i]) => Math.max(...chunks.map(c => cosine(embs[i], c.emb))));
    const controles = PRUEBAS.map((p, i) => [p, i]).filter(([p]) => p[0] === 'CONTROL')
      .map(([p, i]) => Math.max(...chunks.map(c => cosine(embs[i], c.emb))));
    const maxTrampa = Math.max(...trampas), minControl = Math.min(...controles);
    console.log(`\n>> PELIGRO: el bot le respondería a Doc sobre canciones que él no enseñó, citando la equivocada.`);
    console.log(`   Trampa más alta: ${maxTrampa.toFixed(3)}  ·  Control más bajo: ${minControl.toFixed(3)}`);
    if (maxTrampa < minControl) {
      const sug = ((maxTrampa + minControl) / 2).toFixed(2);
      console.log(`   HAY separación limpia: sube GATE_THRESHOLD a ${sug} en api/ask.js y vuelve a correr esto.`);
    } else {
      console.log(`   NO hay separación limpia: subir el umbral también rechazaría preguntas buenas.`);
      console.log(`   La solución real es ingestar MÁS VIDEOS de Doc (más corpus = mejor discriminación).`);
    }
  } else {
    console.log('\n>> El gate aguanta: ninguna pregunta ajena se coló. Puedes enseñar el demo con confianza.');
  }
})();
