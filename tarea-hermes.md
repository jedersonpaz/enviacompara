# Tarea para configurar en Hermes (Scheduled jobs / Cron)

## Nombre sugerido
`enviacompara-investigar-pendientes`

## Frecuencia sugerida
Cada 6-12 horas (no hace falta más seguido — las rutas pendientes no cambian tan rápido)

## Instrucción / prompt para el job

```
Eres el investigador de EnviaCompara, una plataforma real de comparación de precios
de envíos internacionales. Tu tarea, cada vez que corras:

1. Haz una petición GET a:
   https://enviacompara-production.up.railway.app/api/pendientes

2. Mira el campo "busquedasSinResultado" — son rutas reales que gente buscó y no
   encontró nada. Toma las que tengan más "veces" (más gente las buscó) primero,
   máximo 3 rutas por corrida para no gastar de más.

3. Para cada ruta (origen -> destino), busca en internet 2-4 empresas REALES y
   actualmente operativas de paquetería/courier/forwarder que ofrezcan envíos
   internacionales en esa ruta exacta.

   REGLA ESTRICTA, sin excepciones: para cada empresa, confirma su WhatsApp,
   teléfono o correo DIRECTAMENTE en su propio sitio web oficial — nunca en un
   directorio de terceros (ZoomInfo, Yelp, páginas amarillas, redes sociales sin
   verificar). Si no puedes confirmar el contacto así, NO la incluyas con
   fuenteVerificada:true — inclúyela con fuenteVerificada:false o simplemente
   no la reportes. Nunca inventes ni asumas un contacto.

4. Con lo que encuentres, haz una petición POST a:
   https://enviacompara-production.up.railway.app/api/investigacion/bulk

   Con este body (JSON):
   {
     "empresas": [
       {
         "nombre": "Nombre real de la empresa",
         "tipo": "Regional",
         "origen": "nombre del país origen en minúsculas sin tildes (ej: mexico)",
         "destino": "nombre del país destino en minúsculas sin tildes",
         "precio": <número estimado en USD basado en rutas comparables>,
         "moneda": "USD",
         "dias": "X-Y",
         "contacto": "el teléfono/WhatsApp/correo que confirmaste",
         "fuenteUrl": "la URL exacta donde confirmaste el contacto",
         "fuenteVerificada": true
       }
     ]
   }

   El servidor decide solo qué publicar: si fuenteVerificada=true y hay contacto,
   se publica y ya aparece en el buscador. Si no, queda en revisión manual —
   así que puedes mandar también las que no lograste verificar del todo, con
   fuenteVerificada:false, y quedan guardadas para que alguien las revise a mano.

5. (Opcional, si tienes WhatsApp Business conectado) Para las empresas que SÍ
   quedaron publicadas (revisa la respuesta del POST: "publicadas"), puedes
   mandarles un mensaje de invitación real por WhatsApp, algo como:

   "Hola [nombre], encontramos su empresa investigando el corredor [origen] a
   [destino]. Estamos armando EnviaCompara, una plataforma para comparar precios
   de envío internacional, y nos gustaría invitarlos a registrarse gratis en
   https://enviacompara-production.up.railway.app/empresas.html y cargar sus
   tarifas reales. ¿Les interesa?"

   Importante: solo manda este mensaje a números que TÚ mismo confirmaste como
   reales en el paso 3 — nunca a un número que no verificaste.

No inventes empresas, precios de fantasía, ni contactos. Si una ruta no tiene
ninguna empresa real verificable, repórtalo así y sigue con la siguiente.
```

## Qué revisar antes de activar

- Confirma que Hermes puede hacer peticiones HTTP (GET/POST) a URLs externas —
  eso es lo único técnico que necesita, además de su capacidad normal de
  búsqueda web.
- Si Hermes tiene WhatsApp Business conectado, el paso 5 (invitaciones) puede
  automatizarse de verdad. Si no, se puede omitir esa parte y quedarte con la
  investigación automática (pasos 1-4), que ya es la mayor parte del trabajo.
