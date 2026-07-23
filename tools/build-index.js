#!/usr/bin/env node
'use strict';

/**
 * build-index.js — genera el indice compacto que consume la funcion serverless.
 *
 * Toma el indice completo que produce clon_mentor.py (con embeddings de 1536
 * dimensiones en doble precision) y escribe una version reducida con SOLO los
 * campos que /api/ask necesita, con los floats recortados a 5 decimales.
 *
 * Uso:
 *   node tools/build-index.js
 *   node tools/build-index.js <indice-origen.json> [--out <destino.json>] [--decimals 5]
 *
 * Sin dependencias. Node 18+.
 */

var fs = require('fs');
var path = require('path');

var ORIGEN_POR_DEFECTO =
  'C:\\Users\\Usuario\\desktop\\clon-mentor-24-7\\demo\\data\\doc3v.json';
var DESTINO_POR_DEFECTO = path.join(__dirname, '..', 'api', '_index.json');
var GATE_THRESHOLD = 0.28; // mismo umbral que clon_mentor.py
var TOP_K = 4; // mismo k que answer()

// ---------------------------------------------------------------- argumentos

function parseArgs(argv) {
  var opts = { origen: ORIGEN_POR_DEFECTO, destino: DESTINO_POR_DEFECTO, decimals: 5 };
  var posicionales = [];
  for (var i = 0; i < argv.length; i++) {
    var a = argv[i];
    if (a === '--out' || a === '-o') opts.destino = path.resolve(argv[++i]);
    else if (a === '--decimals' || a === '-d') opts.decimals = parseInt(argv[++i], 10);
    else if (a === '--help' || a === '-h') opts.help = true;
    else posicionales.push(a);
  }
  if (posicionales.length) opts.origen = path.resolve(posicionales[0]);
  return opts;
}

// ------------------------------------------------------------------ helpers

function redondear(valor, decimales) {
  var f = Math.pow(10, decimales);
  var r = Math.round(valor * f) / f;
  return r === 0 ? 0 : r; // evita el -0, que no aporta nada y confunde
}

function coseno(a, b) {
  var dot = 0, na = 0, nb = 0;
  for (var i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function normalizar(v) {
  var n = 0;
  for (var i = 0; i < v.length; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  var out = new Array(v.length);
  for (var j = 0; j < v.length; j++) out[j] = v[j] / n;
  return out;
}

// PRNG determinista: el reporte de precision tiene que ser reproducible.
function mulberry32(semilla) {
  return function () {
    semilla |= 0;
    semilla = (semilla + 0x6d2b79f5) | 0;
    var t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussiano(rnd) {
  var u = 1 - rnd(), v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function kb(bytes) {
  return (bytes / 1024).toFixed(1) + ' KB';
}

// ------------------------------------------------------- construccion del indice

function construir(origen, decimales) {
  var compacto = {
    creator: origen.creator || '',
    videos: (origen.videos || []).map(function (v) {
      return { title: v.title, source: v.source, videoId: v.videoId };
    }),
    chunks: (origen.chunks || []).map(function (c) {
      return {
        // El start solo se usa para mmss() -> "m:ss" -> segundos enteros.
        // 2 decimales son de sobra y borran ruido como 47.70000076293945.
        start: redondear(c.start, 2),
        text: c.text,
        segs: (c.segs || []).map(function (s) {
          return { start: redondear(s.start, 2), text: s.text };
        }),
        emb: c.emb.map(function (x) {
          return redondear(x, decimales);
        }),
        title: c.title || origen.title || '',
        source: c.source || origen.source || ''
      };
    })
  };
  return compacto;
}

// --------------------------------------------- verificacion numerica del redondeo

/**
 * Mide el impacto REAL del redondeo sobre la similitud coseno.
 * No basta con "deberia ser despreciable": hay que comprobar que ni el ranking
 * del top-k ni la decision del gate (0.28) cambian.
 */
function verificarPrecision(chunksOrig, chunksComp) {
  var embOrig = chunksOrig.map(function (c) { return c.emb; });
  var embComp = chunksComp.map(function (c) { return c.emb; });
  var n = embOrig.length;

  var maxDelta = 0;
  var sumaDelta = 0;
  var muestras = 0;
  var cambiosConjunto = 0; // QUE fragmentos se le mandan al modelo  -> importa
  var cambiosTop1 = 0;     // cual manda el score del gate           -> importa
  var cambiosOrden = 0;    // en que orden se concatenan             -> cosmetico
  var flipsGate = 0;       // responder vs derivar                   -> importa
  var consultas = 0;

  function comparar(qOrig, qComp) {
    var sOrig = [], sComp = [];
    for (var i = 0; i < n; i++) {
      var a = coseno(qOrig, embOrig[i]);
      var b = coseno(qComp, embComp[i]);
      sOrig.push({ i: i, s: a });
      sComp.push({ i: i, s: b });
      var d = Math.abs(a - b);
      if (d > maxDelta) maxDelta = d;
      sumaDelta += d;
      muestras++;
    }
    sOrig.sort(function (x, y) { return y.s - x.s; });
    sComp.sort(function (x, y) { return y.s - x.s; });

    var k = Math.min(TOP_K, n);
    var idxOrig = sOrig.slice(0, k).map(function (o) { return o.i; });
    var idxComp = sComp.slice(0, k).map(function (o) { return o.i; });

    var setOrig = idxOrig.slice().sort().join(',');
    var setComp = idxComp.slice().sort().join(',');
    if (setOrig !== setComp) cambiosConjunto++;
    else if (idxOrig.join(',') !== idxComp.join(',')) cambiosOrden++;

    if (sOrig[0].i !== sComp[0].i) cambiosTop1++;

    var pasaOrig = sOrig[0].s >= GATE_THRESHOLD;
    var pasaComp = sComp[0].s >= GATE_THRESHOLD;
    if (pasaOrig !== pasaComp) flipsGate++;
    consultas++;
  }

  // Sonda 1: cada chunk como consulta (el caso "pregunta calcada al fragmento").
  for (var i = 0; i < n; i++) comparar(embOrig[i], embOrig[i]);

  // Sonda 2: consultas sinteticas realistas. Mezclamos el embedding de un chunk
  // con ruido para barrer similitudes de ~0.05 a ~0.95, cruzando el gate 0.28
  // muchas veces. Ahi es donde un error de redondeo si podria cambiar una decision.
  var rnd = mulberry32(20260723);
  var dim = embOrig[0].length;
  for (var q = 0; q < 4000; q++) {
    var base = embOrig[q % n];
    var alpha = 0.03 + (q % 100) * 0.0096; // 0.03 .. ~0.98
    var ruido = new Array(dim);
    for (var d2 = 0; d2 < dim; d2++) ruido[d2] = gaussiano(rnd);
    ruido = normalizar(ruido);
    var vec = new Array(dim);
    var beta = Math.sqrt(Math.max(0, 1 - alpha * alpha));
    for (var d3 = 0; d3 < dim; d3++) vec[d3] = alpha * base[d3] + beta * ruido[d3];
    vec = normalizar(vec);
    comparar(vec, vec); // misma consulta; solo cambia la precision del indice
  }

  return {
    consultas: consultas,
    comparaciones: muestras,
    maxDelta: maxDelta,
    mediaDelta: sumaDelta / muestras,
    cambiosConjunto: cambiosConjunto,
    cambiosTop1: cambiosTop1,
    cambiosOrden: cambiosOrden,
    flipsGate: flipsGate
  };
}

// ------------------------------------------------ diagnostico de calidad del indice

function diagnosticarCalidad(chunks) {
  var largos = chunks.map(function (c) { return c.text.length; });
  var total = largos.reduce(function (a, b) { return a + b; }, 0);

  // Similitud entre fragmentos: si todos se parecen mucho entre si,
  // el retrieval no puede discriminar por mas que afinemos el gate.
  var pares = [];
  for (var i = 0; i < chunks.length; i++) {
    for (var j = i + 1; j < chunks.length; j++) {
      pares.push({ a: i, b: j, s: coseno(chunks[i].emb, chunks[j].emb) });
    }
  }
  pares.sort(function (x, y) { return y.s - x.s; });

  // Re-chunking hipotetico a partir de los segs que YA existen (gratis, sin Whisper).
  function simularRechunk(maxChars) {
    var n = 0;
    chunks.forEach(function (c) {
      var cur = 0;
      (c.segs || []).forEach(function (s) {
        cur += s.text.length + 1;
        if (cur >= maxChars) { n++; cur = 0; }
      });
      if (cur > 0) n++;
    });
    return n;
  }

  return {
    nChunks: chunks.length,
    largos: largos,
    totalChars: total,
    mediaChars: Math.round(total / chunks.length),
    coberturaTopK: Math.min(TOP_K, chunks.length) / chunks.length,
    paresMasParecidos: pares.slice(0, 3),
    paresMenosParecidos: pares.slice(-3).reverse(),
    rechunk: [500, 300, 250, 200, 150].map(function (m) {
      return { maxChars: m, chunks: simularRechunk(m) };
    })
  };
}

// ---------------------------------------------------------------------- main

function main() {
  var opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log('uso: node tools/build-index.js [origen.json] [--out destino.json] [--decimals 5]');
    process.exit(0);
  }

  if (!fs.existsSync(opts.origen)) {
    console.error('ERROR: no existe el indice de origen: ' + opts.origen);
    process.exit(1);
  }

  var crudo = fs.readFileSync(opts.origen, 'utf8');
  var bytesAntes = Buffer.byteLength(crudo, 'utf8');
  var origen = JSON.parse(crudo);

  if (!origen.chunks || !origen.chunks.length) {
    console.error('ERROR: el indice de origen no tiene chunks.');
    process.exit(1);
  }
  origen.chunks.forEach(function (c, i) {
    if (!c.emb || !c.emb.length) {
      console.error('ERROR: el chunk ' + i + ' no tiene embedding. Vuelve a correr ingest.');
      process.exit(1);
    }
  });

  var compacto = construir(origen, opts.decimals);
  var salida = JSON.stringify(compacto);
  var bytesDespues = Buffer.byteLength(salida, 'utf8');

  fs.mkdirSync(path.dirname(opts.destino), { recursive: true });
  fs.writeFileSync(opts.destino, salida, 'utf8');

  // Releemos lo escrito: si no parsea, no sirve de nada el resto del reporte.
  var releido = JSON.parse(fs.readFileSync(opts.destino, 'utf8'));

  var prec = verificarPrecision(origen.chunks, releido.chunks);
  var cal = diagnosticarCalidad(releido.chunks);

  var ahorro = (1 - bytesDespues / bytesAntes) * 100;

  console.log('');
  console.log('  INDICE COMPACTO GENERADO');
  console.log('  origen  : ' + opts.origen);
  console.log('  destino : ' + opts.destino);
  console.log('');
  console.log('  creator : ' + releido.creator);
  console.log('  videos  : ' + releido.videos.length);
  console.log('  chunks  : ' + releido.chunks.length);
  console.log('  emb dim : ' + releido.chunks[0].emb.length + '  (' + opts.decimals + ' decimales)');
  console.log('');
  console.log('  TAMANO');
  console.log('    antes  : ' + kb(bytesAntes));
  console.log('    despues: ' + kb(bytesDespues) + '   (-' + ahorro.toFixed(1) + '%)');
  console.log('');
  console.log('  IMPACTO DEL REDONDEO EN LA SIMILITUD COSENO');
  console.log('    consultas probadas   : ' + prec.consultas + ' (' + prec.comparaciones + ' cosenos)');
  console.log('    delta maximo         : ' + prec.maxDelta.toExponential(3));
  console.log('    delta medio          : ' + prec.mediaDelta.toExponential(3));
  console.log('    conjunto top-' + TOP_K + ' distinto: ' + prec.cambiosConjunto + ' de ' + prec.consultas + '   (importa: cambia que se le manda al modelo)');
  console.log('    fragmento #1 distinto : ' + prec.cambiosTop1 + ' de ' + prec.consultas + '   (importa: define el score del gate)');
  console.log('    gate (' + GATE_THRESHOLD + ') cambiado  : ' + prec.flipsGate + ' de ' + prec.consultas + '   (importa: responder vs derivar)');
  console.log('    solo reordenado       : ' + prec.cambiosOrden + ' de ' + prec.consultas + '   (cosmetico: empates a ~1e-6)');
  console.log('    veredicto             : ' +
    (prec.cambiosConjunto === 0 && prec.cambiosTop1 === 0 && prec.flipsGate === 0 && prec.maxDelta < 1e-4
      ? 'DESPRECIABLE — ninguna decision cambia'
      : 'REVISAR — el redondeo altera decisiones'));
  console.log('');
  console.log('  CALIDAD DEL INDICE');
  console.log('    fragmentos           : ' + cal.nChunks);
  console.log('    caracteres por frag. : [' + cal.largos.join(', ') + ']  media ' + cal.mediaChars);
  console.log('    corpus total         : ' + cal.totalChars + ' caracteres (~' +
    Math.round(cal.totalChars / 4) + ' tokens)');
  console.log('    top-' + TOP_K + ' devuelve      : ' + (cal.coberturaTopK * 100).toFixed(0) + '% del corpus');
  console.log('    frags mas parecidos  : ' + cal.paresMasParecidos.map(function (p) {
    return '#' + p.a + '~#' + p.b + '=' + p.s.toFixed(3);
  }).join('  '));
  console.log('    frags menos parecidos: ' + cal.paresMenosParecidos.map(function (p) {
    return '#' + p.a + '~#' + p.b + '=' + p.s.toFixed(3);
  }).join('  '));
  console.log('    re-chunk hipotetico  : ' + cal.rechunk.map(function (r) {
    return r.maxChars + 'ch->' + r.chunks;
  }).join('  '));
  console.log('');
}

main();
