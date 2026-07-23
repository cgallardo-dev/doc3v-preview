/* api/ask.js — Vercel Function (runtime Node.js por defecto, CommonJS, CERO dependencias).
 *
 * Port fiel de answer() de clon_mentor.py: embebe la pregunta, busca por coseno
 * en el índice, aplica el FRENO ANTI-INVENTO (gate) y, si pasa, pide la respuesta
 * al modelo y ancla la cita al minuto exacto con cite_time().
 *
 * Contrato de salida (idéntico al Python):
 *   gate true  -> { gate:true,  score, text }                  (sin cite)
 *   gate false -> { gate:false, score, text, cite:{title,time,url,thumb} }
 *
 * Cualquier respuesta que NO sea 200 es la señal para que el frontend caiga al
 * set de respuestas curadas sin mostrar un error. Por eso los errores nunca
 * exponen detalle: solo un código corto que el cliente pueda leer.
 */

'use strict';

// ---------------------------------------------------------------------------
// Índice: se carga UNA vez por instancia (cold start), no en cada request.
// require() estático es a propósito: el tracer de Vercel lo detecta y empaqueta
// el JSON solo, sin necesidad de tocar el filesystem en runtime.
// ---------------------------------------------------------------------------
var INDEX = null;
try {
  INDEX = require('./_index.json');
} catch (e) {
  try {
    // Respaldo por si el índice se deja en la ruta del motor Python.
    INDEX = require('../data/doc3v.json');
  } catch (e2) {
    INDEX = null;
  }
}

// --- constantes: mismas que clon_mentor.py -------------------------------
var EMBED_MODEL = 'text-embedding-3-small';
var ANSWER_MODEL = 'gpt-4o-mini';   // NO cambiar: gpt-5-nano rechaza temperature y factura reasoning tokens
var GATE_THRESHOLD = 0.28;          // por debajo de esto NO se llama al LLM (ahorra dinero y evita inventos)
var TOP_K = 4;
var MAX_TOKENS = 200;               // acota el peor caso: sin esto una sola request puede costar 55x
// OpenAI renombró max_tokens -> max_completion_tokens (sep-2024). gpt-4o-mini
// acepta los dos, pero el viejo está deprecado y los modelos nuevos lo rechazan
// con 400. Se intenta el nombre nuevo y, solo ante un 400, se reintenta con el
// viejo: el tope NUNCA se manda vacío, que es lo que dispara el costo de 55x.
var TOKEN_CAP_KEYS = ['max_completion_tokens', 'max_tokens'];
var OPENAI = 'https://api.openai.com/v1';

// --- límites anti-abuso ---------------------------------------------------
var MAX_QUESTION_CHARS = 300;
var MAX_BODY_BYTES = 2048;
var OPENAI_TIMEOUT_MS = 8000;       // por llamada; el cliente aborta antes y cae al set curado
var RATE_WINDOW_MS = 60000;
var RATE_MAX = 20;                  // por IP y por instancia (ver nota en rateLimited)
var CACHE_MAX = 60;

// ===========================================================================
// Utilidades portadas 1:1 del Python
// ===========================================================================

// mmss(): Python hace int(sec) -> trunca hacia cero, no redondea.
function mmss(sec) {
  var s = Math.trunc(Number(sec) || 0);
  var ss = s % 60;
  return Math.trunc(s / 60) + ':' + (ss < 10 ? '0' + ss : '' + ss);
}

// to_seconds(): parsea "m:ss". Se aplica sobre mmss(start), así que el enlace
// hereda la MISMA precisión (segundos enteros) que muestra el UI.
function toSeconds(t) {
  var p = String(t || '').split(':');
  if (p.length !== 2) return 0;
  var m = parseInt(p[0], 10), s = parseInt(p[1], 10);
  if (isNaN(m) || isNaN(s)) return 0;
  return m * 60 + s;
}

function videoId(url) {
  var m = /(?:[?&]v=|youtu\.be\/|\/shorts\/|\/embed\/)([\w-]{6,})/.exec(url || '');
  return m ? m[1] : '';
}

// _words(): set de palabras de más de 3 letras, en minúsculas.
function words(t) {
  var found = String(t || '').toLowerCase().match(/[a-záéíóúñü0-9]+/g) || [];
  var out = Object.create(null);
  for (var i = 0; i < found.length; i++) if (found[i].length > 3) out[found[i]] = true;
  return out;
}

function cosine(a, b) {
  if (!a || !b) return 0;
  var n = Math.min(a.length, b.length), dot = 0, na = 0, nb = 0;
  for (var i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  na = Math.sqrt(na); nb = Math.sqrt(nb);
  return (na && nb) ? dot / (na * nb) : 0;
}

function round3(x) { return Math.round(x * 1000) / 1000; }

// cite_time(), paso 1: elige el FRAGMENTO más parecido a la RESPUESTA (no a la
// pregunta). Ahí está la ganancia: la cita apunta a donde el creador dice
// exactamente eso, no a donde la pregunta "suena" parecido.
function pickChunk(answerEmb, top) {
  // max() de Python devuelve el PRIMER máximo -> comparación estricta ">".
  var best = top[0], bestScore = cosine(answerEmb, top[0].emb);
  for (var i = 1; i < top.length; i++) {
    var s = cosine(answerEmb, top[i].emb);
    if (s > bestScore) { bestScore = s; best = top[i]; }
  }
  return best;
}

function segsOf(chunk) {
  return (chunk.segs && chunk.segs.length) ? chunk.segs : [{ start: chunk.start, text: chunk.text }];
}

function overlapCount(aw, text) {
  var w = words(text), n = 0;
  for (var k in w) if (aw[k]) n++;
  return n;
}

// cite_time(), paso 2: dentro del fragmento elegido, el segmento con más
// palabras en común con la respuesta, PREFIRIENDO start >= 3s para no citar
// siempre el intro (0:00). Réplica exacta del Python, incluido el desempate por
// -start (a igual solape gana el segmento MÁS TEMPRANO) y el primer máximo.
function pickSegment(segs, answerText) {
  var aw = words(answerText);
  var overlap = [], i;
  for (i = 0; i < segs.length; i++) if (overlapCount(aw, segs[i].text) > 0) overlap.push(segs[i]);

  var pool = overlap.filter(function (s) { return Number(s.start) >= 3; });
  if (!pool.length) pool = overlap;
  if (!pool.length) pool = segs.filter(function (s) { return Number(s.start) >= 3; });
  if (!pool.length) pool = segs;

  var chosen = pool[0];
  var bestOv = overlapCount(aw, chosen.text), bestNegStart = -Number(chosen.start);
  for (i = 1; i < pool.length; i++) {
    var ov = overlapCount(aw, pool[i].text), ns = -Number(pool[i].start);
    if (ov > bestOv || (ov === bestOv && ns > bestNegStart)) {
      bestOv = ov; bestNegStart = ns; chosen = pool[i];
    }
  }
  return Number(chosen.start) || 0;
}

// ===========================================================================
// Llamadas a OpenAI (fetch nativo de Node 18+, sin SDK)
// ===========================================================================

function openai(path, payload, key) {
  var ctrl = new AbortController();
  // Timeout defensivo: sin esto la función puede quedarse colgada hasta el
  // maxDuration mientras el cliente ya se dio por vencido.
  var t = setTimeout(function () { ctrl.abort(); }, OPENAI_TIMEOUT_MS);
  return fetch(OPENAI + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify(payload),
    signal: ctrl.signal
  }).then(function (r) {
    clearTimeout(t);
    if (!r.ok) throw new Error('upstream_' + r.status);
    return r.json();
  }, function (err) {
    clearTimeout(t);
    throw err;
  });
}

function embed(text, key) {
  return openai('/embeddings', { model: EMBED_MODEL, input: text }, key)
    .then(function (d) { return d.data[0].embedding; });
}

// ===========================================================================
// Cache y freno por IP (ambos en memoria del contenedor)
// ===========================================================================

// El cache SÍ es válido en memoria: un fallo de cache es inofensivo (falla
// CERRADO, simplemente recalcula). En una demo con preguntas repetidas tumba
// el costo casi a cero.
var CACHE = new Map();

function cacheKey(q) { return q.toLowerCase().replace(/\s+/g, ' ').trim(); }

function cacheGet(q) { return CACHE.get(cacheKey(q)) || null; }

function cachePut(q, val) {
  if (CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value);
  CACHE.set(cacheKey(q), val);
}

// OJO: esto NO es un rate limit de verdad. Cada invocación puede caer en un
// contenedor distinto, así que falla ABIERTO. Es un tope de velocidad contra
// bucles accidentales y bots tontos que golpean una instancia caliente.
// El freno real es la regla de Rate Limit del WAF de Vercel (ver api/README.md).
var HITS = new Map();

// Purga por VENCIMIENTO. Antes se hacía HITS.clear(), que borraba también el
// contador del abusador: bastaba con inundar de IPs distintas para que la IP
// castigada volviera a cero.
function purgeHits(now) {
  HITS.forEach(function (v, k) { if (now - v.since > RATE_WINDOW_MS) HITS.delete(k); });
}

function rateLimited(ip) {
  var now = Date.now();
  purgeHits(now);
  // Sin IP identificable todos caen en el MISMO cubo: se sigue limitando en vez
  // de dejar pasar. No se bloquea de plano para no romper el demo si la
  // cabecera llegara a faltar.
  var key = ip || '_sin_ip';
  // Si tras purgar el mapa sigue desbordado, no se admite tráfico nuevo:
  // fallar CERRADO. Un 429 de más cuesta $0; una respuesta de más cuesta plata.
  if (HITS.size > 500 && !HITS.has(key)) return true;
  var rec = HITS.get(key);
  if (!rec || now - rec.since > RATE_WINDOW_MS) rec = { since: now, n: 0 };
  rec.n++;                       // la PRIMERA petición ya cuenta (antes salía gratis)
  HITS.set(key, rec);
  return rec.n > RATE_MAX;
}

function clientIp(req) {
  var xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return req.headers['x-real-ip'] || '';
}

// Cedazo, no puerta: el header Origin lo controla el cliente y se falsifica con
// un curl. Sirve para cortar el abuso desde otro sitio web y los bots que ni lo
// mandan. La puerta de verdad son el rate limit del WAF y el max_tokens.
function originAllowed(req) {
  var raw = process.env.ALLOWED_ORIGINS;
  var list = [];
  if (raw) {
    list = raw.split(',').map(function (s) { return s.trim().toLowerCase(); })
      .filter(function (s) { return s; });
  }
  // Sin allowlist configurada NO se abre la puerta. Se cae al MISMO origen del
  // deployment, que se deduce de la cabecera Host. Así un curl pelado (sin
  // Origin ni Referer) queda fuera POR DEFECTO, sin depender de que el dueño se
  // acuerde de configurar una variable de entorno.
  if (!list.length) {
    var self = String(req.headers.host || '').toLowerCase().replace(/:\d+$/, '');
    if (self) list = [self];
  }
  if (!list.length) return false;

  var origin = req.headers.origin || '';
  var host = '';
  try {
    host = origin ? new URL(origin).hostname.toLowerCase()
      : (req.headers.referer ? new URL(req.headers.referer).hostname.toLowerCase() : '');
  } catch (e) { host = ''; }
  if (!host) return false;

  for (var i = 0; i < list.length; i++) {
    var entry = list[i].replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (entry.indexOf('*.') === 0) {
      if (host === entry.slice(2) || host.slice(-(entry.length - 1)) === entry.slice(1)) return true;
    } else if (host === entry) return true;
  }
  return false;
}

// Lista legible de lo que el bot SÍ domina, derivada del índice (no hardcodeada:
// si mañana se ingestan más videos, el texto se actualiza solo).
function temasDisponibles() {
  var vs = (INDEX && INDEX.videos) || [];
  var t = vs.map(function (v) { return String(v.title || '').split(' - ')[0].trim(); })
    .filter(function (s) { return s; });
  if (!t.length) return '';
  if (t.length === 1) return t[0];
  return t.slice(0, -1).join(', ') + ' y ' + t[t.length - 1];
}

// Saludos y meta-preguntas. Se responden SIN gastar una sola llamada a OpenAI.
// Motivo: "hola" es lo primero que escribe cualquiera frente a un chat, y por el
// camino normal caía bajo el umbral del gate -> la primera impresión del demo
// era "sobre eso no tengo nada". Pésimo delante de un cliente.
var RE_SALUDO = /^\s*(hola|holi|buenas|buenos d[ií]as|buenas tardes|buenas noches|hey|qu[eé] tal|saludos|hi|hello)\b/i;
var RE_GRACIAS = /^\s*(gracias|muchas gracias|mil gracias|thanks|genial|perfecto|excelente|buen[íi]simo)\b/i;
var RE_META = /(qui[eé]n eres|qu[eé] eres|qu[eé] sabes hacer|qu[eé] puedes hacer|c[oó]mo funcionas?|para qu[eé] sirves|en qu[eé] me puedes ayudar)/i;

function respuestaRapida(q, creator) {
  var temas = temasDisponibles();
  var cola = temas ? ' Pregúntame por ' + temas + ' y te llevo al segundo exacto donde ' + creator + ' lo explica.' : '';
  if (RE_SALUDO.test(q)) return '¡Hola! Soy el tutor de ' + creator + '.' + cola;
  if (RE_GRACIAS.test(q)) return '¡Con gusto! Aquí sigo cuando quieras seguir practicando.' + cola;
  if (RE_META.test(q)) {
    return 'Respondo con lo que ' + creator + ' enseña en sus videos, y te muestro el minuto exacto para que lo veas tú mismo.' +
      (temas ? ' Ahora mismo domino ' + temas + '.' : '');
  }
  return '';
}

function fail(res, code, reason) {
  // Nunca se filtra el detalle del error: el frontend solo necesita saber que
  // debe caer al modo curado.
  return res.status(code).json({ ok: false, reason: reason });
}

// ===========================================================================
// Handler
// ===========================================================================

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return fail(res, 405, 'method_not_allowed');
  }

  // Interruptor de apagado. Requiere Redeploy para tomar efecto (las env vars
  // no se aplican a deployments ya creados). Para apagar YA: regla Deny en el WAF.
  // .trim() a propósito: un espacio pegado al pegar el valor en el panel de
  // Vercel dejaba el bot ENCENDIDO y gastando, sin ninguna señal de que falló.
  var apagado = String(process.env.BOT_ENABLED || '').trim().toLowerCase();
  if (apagado === 'false' || apagado === '0' || apagado === 'no' || apagado === 'off') {
    return fail(res, 503, 'disabled');
  }

  // Cortar payloads grandes ANTES de parsear nada.
  var len = parseInt(req.headers['content-length'] || '0', 10);
  if (len > MAX_BODY_BYTES) return fail(res, 413, 'too_large');

  var ctype = String(req.headers['content-type'] || '').toLowerCase();
  if (ctype.indexOf('application/json') === -1) return fail(res, 415, 'bad_content_type');

  if (!originAllowed(req)) return fail(res, 403, 'forbidden');
  if (rateLimited(clientIp(req))) return fail(res, 429, 'slow_down');

  // req.body es un GETTER: si el JSON viene malformado, ACCEDER lanza excepción.
  // La lectura de los campos va DENTRO del mismo try para que ningún acceso
  // inesperado convierta un 400 limpio en un 500 feo.
  var q = '';
  try {
    var body = req.body;
    if (typeof body === 'string') body = JSON.parse(body || '{}');
    if (body && typeof body.q === 'string') q = body.q;
    else if (body && typeof body.question === 'string') q = body.question;
    q = q.trim();
  } catch (e) {
    return fail(res, 400, 'bad_json');
  }

  if (!q) return fail(res, 400, 'empty_query');
  if (q.length > MAX_QUESTION_CHARS) return fail(res, 400, 'too_long');

  if (!INDEX || !INDEX.chunks || !INDEX.chunks.length) return fail(res, 503, 'unavailable');

  var key = process.env.OPENAI_API_KEY;
  if (!key) return fail(res, 503, 'unavailable');

  var cached = cacheGet(q);
  if (cached) return res.status(200).json(cached);

  var creator = INDEX.creator || 'este creador';

  // Saludo / cortesía / "¿qué haces?" -> respuesta inmediata, CERO llamadas a
  // OpenAI. Va antes del embedding: es gratis y arregla la primera impresión.
  var rapida = respuestaRapida(q, creator);
  if (rapida) {
    var quick = { gate: false, score: 1, text: rapida };
    cachePut(q, quick);
    return res.status(200).json(quick);
  }

  try {
    // 1) embedding de la pregunta
    var qemb = await embed(q, key);

    // 2) coseno contra todos los fragmentos -> top K (orden estable, igual que
    //    el sorted() de Python: los empates conservan el orden original).
    var scored = INDEX.chunks.map(function (c) { return { c: c, s: cosine(qemb, c.emb) }; });
    scored.sort(function (a, b) { return b.s - a.s; });
    var top = scored.slice(0, TOP_K).map(function (x) { return x.c; });
    var best = top.length ? scored[0].s : 0;

    // 3) FRENO ANTI-INVENTO: por debajo del umbral NI SIQUIERA se llama al LLM.
    //    Es el argumento de venta (no inventa) y además hace gratis las preguntas
    //    fuera de tema: solo se pagó el embedding de la pregunta.
    if (best < GATE_THRESHOLD) {
      var gated = {
        gate: true,
        score: round3(best),
        // El "no sé" es ARGUMENTO DE VENTA (no inventa), así que se escribe con
        // dignidad y con salida concreta. Nada de "te paso con el equipo":
        // Doc es solista, no hay equipo al que pasar a nadie.
        text: 'Eso todavía no está en los videos que tengo de ' + creator + ', y prefiero no inventarte nada.' +
          (temasDisponibles() ? ' Lo que sí puedo enseñarte paso a paso es ' + temasDisponibles() + ' — pregúntame por cualquiera.' : '')
      };
      cachePut(q, gated);
      return res.status(200).json(gated);
    }

    // 4) contexto + mismo system prompt del Python, palabra por palabra.
    var context = top.map(function (c) { return '[' + mmss(c.start) + '] ' + c.text; }).join('\n\n');
    var system =
      'Eres el asistente de ' + creator + '. Usa SOLO los fragmentos (transcripción de ' + creator + '). ' +
      'Si los fragmentos tratan el tema aunque sea en parte, da la MEJOR respuesta posible basada en ellos: ' +
      'concreta, cálida y BREVE (2 o 3 frases, máximo ~55 palabras), con la voz del creador (SIN escribir el minuto, se muestra aparte). ' +
      'Solo si los fragmentos NO tienen NINGUNA relación con la pregunta, responde exactamente "NO_TENGO". ' +
      'Nunca inventes fuera de los fragmentos. Devuelve JSON {"answer":"..."}.';
    var user = 'FRAGMENTOS:\n' + context + '\n\nPREGUNTA DEL MIEMBRO: ' + q;

    var chat = null;
    for (var ki = 0; ki < TOKEN_CAP_KEYS.length; ki++) {
      var payload = {
        model: ANSWER_MODEL,
        response_format: { type: 'json_object' },
        temperature: 0.2,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      };
      // el límite de "~55 palabras" vivía SOLO en el prompt: el tope duro va aquí
      payload[TOKEN_CAP_KEYS[ki]] = MAX_TOKENS;
      try {
        chat = await openai('/chat/completions', payload, key);
        break;
      } catch (err) {
        var last = (ki === TOKEN_CAP_KEYS.length - 1);
        // Solo se reintenta si el rechazo es del nombre del parámetro (400).
        // Un timeout o un 429 por saldo agotado NO se reintentan: se cae al set curado.
        if (last || String(err && err.message).indexOf('upstream_400') === -1) throw err;
      }
    }

    var text = '';
    try {
      text = String(JSON.parse(chat.choices[0].message.content).answer || '').trim();
    } catch (e) {
      text = '';
    }
    if (!text) return fail(res, 502, 'upstream');

    // 5) mismas frases que delatan que el modelo no tiene material -> gate.
    var low = text.toLowerCase();
    if (text === 'NO_TENGO' || low.indexOf('no_tengo') !== -1 || low.indexOf('no lo tengo') !== -1 ||
      low.indexOf('no tengo nada') !== -1 || low.indexOf('te derivo') !== -1 ||
      low.indexOf('derivo al') !== -1 || low.indexOf('deriva al') !== -1 ||
      low.indexOf('no está en') !== -1 || low.indexOf('no aparece') !== -1 ||
      low.indexOf('no encuentro') !== -1) {
      var gated2 = {
        gate: true,
        score: round3(best),
        text: 'Eso no lo cubren los videos que tengo de ' + creator + ', y prefiero no inventarte nada.' +
          (temasDisponibles() ? ' Pregúntame por ' + temasDisponibles() + ' y te llevo al minuto exacto.' : '')
      };
      cachePut(q, gated2);
      return res.status(200).json(gated2);
    }

    // 6) cite_time: se embebe la RESPUESTA (no la pregunta) para anclar la cita.
    var aemb = await embed(text, key);
    var chunk = pickChunk(aemb, top);
    var cstart = pickSegment(segsOf(chunk), text);
    var cmin = mmss(cstart);

    // La cita hereda la procedencia del FRAGMENTO elegido (soporta multi-video).
    var title = chunk.title || INDEX.title || '';
    var src = chunk.source || INDEX.source || '';
    var vid = videoId(src);
    if (!vid && INDEX.videos) {
      for (var i = 0; i < INDEX.videos.length; i++) {
        if (INDEX.videos[i].source === src) { vid = INDEX.videos[i].videoId || ''; break; }
      }
    }
    var url = '';
    if (src.indexOf('http') === 0) {
      url = src + (src.indexOf('?') !== -1 ? '&' : '?') + 't=' + toSeconds(cmin) + 's';
    }

    var out = {
      gate: false,
      score: round3(best),
      text: text,
      cite: {
        title: title,
        time: cmin,
        url: url,
        thumb: vid ? 'https://img.youtube.com/vi/' + vid + '/hqdefault.jpg' : ''
      }
    };
    cachePut(q, out);
    return res.status(200).json(out);

  } catch (e) {
    // Timeout, 429 por saldo agotado, caída de OpenAI: todo termina igual, en
    // 502, y el frontend cae al set curado sin mostrar nada feo.
    return fail(res, 502, 'upstream');
  }
};

// Helpers puros expuestos SOLO para pruebas locales (comparación 1:1 contra el
// motor Python). Vercel solo usa el module.exports de arriba, que sigue siendo
// la función; esto es una propiedad extra e inerte.
module.exports.__test = {
  mmss: mmss, toSeconds: toSeconds, videoId: videoId, words: words,
  cosine: cosine, round3: round3, pickChunk: pickChunk, pickSegment: pickSegment, segsOf: segsOf
};
