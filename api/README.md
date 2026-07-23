# `/api/ask` — el bot que cita el minuto exacto

Función serverless de Vercel (runtime Node.js, CommonJS, **cero dependencias npm**).
Es el port fiel de `answer()` de `clon-mentor-24-7/demo/clon_mentor.py`.

```
POST /api/ask
Content-Type: application/json
{ "q": "¿Qué acordes lleva Dueles?" }
```

Respuesta (mismo contrato que el motor Python):

```jsonc
// pasó el freno anti-invento
{ "gate": false, "score": 0.612, "text": "...",
  "cite": { "title": "Dueles — Jesse y Joy", "time": "0:08",
            "url": "https://www.youtube.com/watch?v=GaNwd74lfu4&t=8s",
            "thumb": "https://img.youtube.com/vi/GaNwd74lfu4/hqdefault.jpg" } }

// no hay material -> NO inventa (y ni siquiera llama al modelo)
{ "gate": true, "score": 0.11, "text": "Sobre eso no tengo nada en el contenido de Doc 3V..." }
```

**Cualquier respuesta que no sea 200 significa "cae al modo curado".** El cuerpo es
siempre `{ "ok": false, "reason": "..." }` sin detalle del error: el frontend solo
necesita saber que debe usar el set de respuestas escritas a mano.

| Código | `reason`            | Cuándo |
|--------|---------------------|--------|
| 405    | `method_not_allowed`| no es POST |
| 415    | `bad_content_type`  | falta `application/json` |
| 413    | `too_large`         | body de más de 2 KB |
| 403    | `forbidden`         | `Origin` fuera de la allowlist |
| 429    | `slow_down`         | más de 20 preguntas/minuto desde la misma IP |
| 400    | `bad_json` · `empty_query` · `too_long` | pregunta vacía o de más de 300 caracteres |
| 503    | `disabled`          | `BOT_ENABLED=false` |
| 503    | `unavailable`       | falta `OPENAI_API_KEY` o falta el índice |
| 502    | `upstream`          | OpenAI falló, se agotó el saldo, o tardó más de 8 s |

## Archivos

```
api/ask.js         la función
api/_index.json    el índice compacto (transcripciones + embeddings). NO se commitea a mano:
                   lo genera el script de indexado desde clon-mentor-24-7/demo/data/doc3v.json
vercel.json        maxDuration 20 s + empaquetado del índice
```

Si `api/_index.json` no existe, la función busca `../data/doc3v.json` como respaldo.
Si tampoco está, responde 503 y el sitio sigue funcionando con el set curado.

## Variables de entorno

En Vercel: **Project → Settings → Environment Variables**.

| Variable | Obligatoria | Valor |
|----------|-------------|-------|
| `OPENAI_API_KEY` | sí | la clave del proyecto `doc3v-demo` de OpenAI |
| `BOT_ENABLED` | no | `false`, `0`, `no` u `off` apagan el bot (se ignoran espacios sobrantes). Cualquier otro valor, o ausente, lo deja encendido |
| `ALLOWED_ORIGINS` | no | dominios separados por coma, ej. `doc3v-preview.vercel.app,*.vercel.app`. **Si se deja vacía NO queda abierto**: cae al mismo dominio del deployment (cabecera `Host`), así que un `curl` sin `Origin` recibe 403. Solo hace falta configurarla si el sitio se sirve desde OTRO dominio distinto al de la función |

> **Ojo con el comodín:** `*.vercel.app` autoriza a *cualquier* proyecto alojado en
> Vercel, no solo al tuyo. Si vas a poner la variable, lista tu dominio exacto.

> **Trampa que cuesta una demo:** cambiar una variable de entorno **no afecta a los
> deployments ya creados**. Después de agregarla o modificarla hay que hacer
> **Redeploy** (Deployments → ⋯ → Redeploy) o empujar un commit nuevo.

La clave **nunca** llega al navegador: vive solo en `process.env` dentro de `/api`,
que se ejecuta en el servidor.

## Desplegar

1. `vercel.com/signup` → **Continue with GitHub** (la cuenta `cgallardo-dev` que ya existe).
   Al autorizar la app, elegir *Only select repositories* y marcar `doc3v-preview`.
2. Dashboard → **Add New… → Project** → importar `cgallardo-dev/doc3v-preview`.
3. Configuración:
   - **Framework Preset: Other**
   - **Root Directory:** `./`
   - **Build Command:** activar *Override* y dejarlo **vacío** (el sitio es estático, no hay build)
   - **Environment Variables:** agregar ahí mismo `OPENAI_API_KEY`
4. **Deploy.** Cada push a la rama de producción vuelve a desplegar.

**Al cliente se le manda SIEMPRE la URL de producción**, nunca una de preview: en el
plan Hobby las preview pueden quedar detrás de la pantalla de login de Vercel.

## Apagar el bot

Dos maneras, según la urgencia:

- **Ahora mismo (segundos, sin redeploy):** Project → **Firewall** → *New Rule* →
  If `Request Path` equals `/api/ask` → Then **Deny**. Los cambios del firewall
  toman efecto de inmediato. El sitio sigue vivo y el chat cae al set curado.
- **Ordenado (≈1 min):** `BOT_ENABLED=false` en Environment Variables **y luego
  Redeploy**. Sin el redeploy la variable no hace nada.

En los dos casos el visitante no ve ningún error: ve respuestas curadas.

## Proteger el saldo de OpenAI

Antes de compartir la URL:

1. **Auto-recharge APAGADO** en OpenAI → Settings → Billing. Es el único tope duro
   real: no se puede gastar un saldo que no existe. El presupuesto mensual del
   proyecto solo manda correo, no corta.
2. **Clave acotada:** proyecto `doc3v-demo`, key *Restricted* con permiso Write solo
   en `/v1/chat/completions` y `/v1/embeddings`. El demo no transcribe nada: el
   índice ya está generado.
3. **Rate limit del WAF** (gratis en Hobby, 1 regla por proyecto): Project → Firewall →
   *New Rule* → If `Request Path` equals `/api/ask` → Then **Rate Limit**, ventana 60 s,
   límite 15, key **IP**, acción Deny. Corta en el edge, antes de invocar la función.

El freno por IP que trae `ask.js` es un tope de velocidad, no una garantía: vive en
la memoria del contenedor y falla abierto si la request cae en otra instancia. El
límite serio es el del WAF.

## Costo por pregunta

Medido con `tiktoken` sobre el índice real (5 fragmentos, `k=4`, o sea que en cada
pregunta viaja casi todo el corpus: ~702 tokens de entrada).

| Concepto | Tokens | Costo |
|---|---|---|
| entrada `gpt-4o-mini` ($0.15/1M) | 702 | $0.000105 |
| salida `gpt-4o-mini` ($0.60/1M) | 80 | $0.000048 |
| embedding de la pregunta ($0.02/1M) | 20 | $0.0000004 |
| embedding de la respuesta, para la cita | 80 | $0.0000016 |
| **total** | | **≈ $0.00016** |

Con **$6.72 de saldo alcanza para más de 40 000 preguntas**. Y cuando salta el freno
anti-invento solo se paga el embedding de la pregunta: **$0.0000004**, es decir que
las preguntas fuera de tema son gratis en la práctica.

El cache en memoria del contenedor (60 preguntas) hace que repetir una pregunta en la
misma demo cueste **$0**.

Lo único que muerde el saldo de verdad es **indexar videos nuevos**: `whisper-1` cobra
$0.006 por minuto de audio. Diez videos de 8 minutos = $0.48.

El tope de salida son 200 tokens. Se manda como `max_completion_tokens` y, solo si la
API lo rechaza con 400, se reintenta una vez con el viejo `max_tokens`. Nunca se manda
la petición sin tope: sin él, una sola pregunta manipulada puede pedir 16 000 tokens de
salida y costar 55 veces más.

## Dos cosas que NO se cambian

- **`whisper-1`** es el único modelo de transcripción que devuelve timestamps por
  segmento. `gpt-4o-mini-transcribe` cuesta la mitad y **rompe la cita al minuto**,
  que es el argumento de venta completo.
- **`gpt-4o-mini`** se queda. `gpt-5.4-nano` es 2.5× más caro pese al nombre, y
  `gpt-5-nano` rechaza `temperature` con 400 y factura reasoning tokens como salida.

## Probar el camino de respaldo antes de la demo

Es la prueba más importante de todas: hay que **ver** el sitio funcionando con la API
caída. En un deployment de preview, poner `OPENAI_API_KEY` con un valor inválido y
confirmar que el chat responde igual, con el set curado y sin ningún mensaje de error.

Local, con `vercel dev`:

```bash
vercel env pull                      # trae las variables a .env.local
vercel dev                           # levanta el sitio + /api/ask
curl -s http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d "{\"q\":\"¿Qué acordes lleva Dueles?\"}"
```

Los logs de runtime en Hobby se guardan **solo 1 hora**: si algo falla durante la
demo, hay que mirarlos en ese momento.

## Verificado contra el motor Python

Los helpers puros (`mmss`, `to_seconds`, `video_id`, `_words`, `cosine` y las dos
mitades de `cite_time`) se corrieron en paralelo contra `clon_mentor.py` sobre el
índice real: **20 casos de selección de cita y 5 grupos de utilidades, salida
idéntica**. Se exponen en `module.exports.__test` solo para esa comparación; Vercel
usa el `module.exports` principal, que sigue siendo la función.
