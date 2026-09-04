// Backend real de EnviaCompara. Sin dependencias externas —
// usa el módulo node:sqlite y node:http que ya vienen con Node.js.
// Arrancar con: node server.js

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const PUERTO = process.env.PORT || 8642;
const RAIZ = __dirname;
// DB_PATH permite apuntar a un volumen persistente en producción (ej. Railway) —
// sin esto, cada redeploy borraría la base de datos porque el disco no persiste.
const RUTA_DB = process.env.DB_PATH || path.join(RAIZ, "enviacompara.db");

const db = new DatabaseSync(RUTA_DB);

db.exec(`
  CREATE TABLE IF NOT EXISTS empresas (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL,
    contacto TEXT NOT NULL UNIQUE,
    creado_en TEXT NOT NULL,
    origen_dato TEXT NOT NULL DEFAULT 'registro_propio',
    fuente_verificada INTEGER NOT NULL DEFAULT 0,
    fuente_url TEXT
  );

  CREATE TABLE IF NOT EXISTS rutas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id TEXT NOT NULL,
    origen TEXT NOT NULL,
    destino TEXT NOT NULL,
    precio REAL NOT NULL,
    moneda TEXT NOT NULL DEFAULT 'USD',
    dias TEXT NOT NULL,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id)
  );

  CREATE INDEX IF NOT EXISTS idx_rutas_busqueda ON rutas(origen, destino);

  -- Rutas pendientes: cada búsqueda de un usuario que no encontró nada.
  -- Esto le dice al equipo qué corredor investigar después — demanda real,
  -- no una suposición de qué corredor podría interesar.
  CREATE TABLE IF NOT EXISTS busquedas_sin_resultado (
    origen TEXT NOT NULL,
    destino TEXT NOT NULL,
    veces INTEGER NOT NULL DEFAULT 1,
    primera_vez TEXT NOT NULL,
    ultima_vez TEXT NOT NULL,
    PRIMARY KEY (origen, destino)
  );

  -- Empresas encontradas por investigación pero SIN contacto confirmado en su
  -- propio sitio oficial — no se publican solas, esperan revisión manual.
  CREATE TABLE IF NOT EXISTS pendientes_revision (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL,
    origen TEXT NOT NULL,
    destino TEXT NOT NULL,
    precio REAL,
    moneda TEXT DEFAULT 'USD',
    dias TEXT,
    contacto TEXT,
    fuente_url TEXT,
    motivo TEXT,
    creado_en TEXT NOT NULL
  );
`);

// ---------- Tasas de cambio reales (open.er-api.com, gratis, sin API key) ----------
// Se refrescan cada 12h y quedan en memoria — si la API externa falla, seguimos
// usando la última tasa real que sí funcionó (o la tabla de respaldo si el
// servidor recién arrancó y todavía no logró la primera consulta).
const TASAS_RESPALDO = { USD: 1, EUR: 0.86, MXN: 17, COP: 3900, PEN: 3.7, ARS: 1450, CLP: 970, TRY: 41 };
let cacheTasas = { base: "USD", rates: TASAS_RESPALDO, actualizado: null, fuente: "respaldo (sin conexión aún)" };

async function actualizarTasas() {
  try {
    const resp = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!resp.ok) throw new Error("respuesta no OK");
    const data = await resp.json();
    if (data.result !== "success" || !data.rates) throw new Error("formato inesperado");
    cacheTasas = { base: "USD", rates: data.rates, actualizado: new Date().toISOString(), fuente: "open.er-api.com" };
    console.log("Tasas de cambio actualizadas:", cacheTasas.actualizado);
  } catch (err) {
    console.warn("No se pudieron actualizar las tasas de cambio, se sigue usando la última conocida:", err.message);
  }
}

actualizarTasas();
setInterval(actualizarTasas, 12 * 60 * 60 * 1000); // cada 12 horas

// ---------- Helpers ----------

function normaliza(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function enviarJSON(res, status, data) {
  const cuerpo = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(cuerpo)
  });
  res.end(cuerpo);
}

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    let datos = "";
    req.on("data", chunk => {
      datos += chunk;
      if (datos.length > 2_000_000) req.destroy(); // límite de seguridad simple, 2MB
    });
    req.on("end", () => {
      if (!datos) return resolve({});
      try {
        resolve(JSON.parse(datos));
      } catch (e) {
        reject(new Error("JSON inválido"));
      }
    });
    req.on("error", reject);
  });
}

const TIPOS_MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon"
};

function servirArchivoEstatico(req, res, urlPath) {
  let rutaArchivo = urlPath === "/" ? "/index.html" : urlPath;
  rutaArchivo = path.join(RAIZ, path.normalize(rutaArchivo).replace(/^(\.\.[/\\])+/, ""));

  // No permitir servir la base de datos ni el propio servidor por la web.
  if (rutaArchivo === RUTA_DB || rutaArchivo === __filename) {
    res.writeHead(404);
    return res.end("No encontrado");
  }

  fs.readFile(rutaArchivo, (err, contenido) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("No encontrado");
    }
    const ext = path.extname(rutaArchivo);
    res.writeHead(200, { "Content-Type": TIPOS_MIME[ext] || "application/octet-stream" });
    res.end(contenido);
  });
}

// ---------- Rutas de la API ----------

function empresaAId(id) {
  return db.prepare("SELECT * FROM empresas WHERE id = ?").get(id);
}

function rutasDeEmpresa(id) {
  return db.prepare("SELECT * FROM rutas WHERE empresa_id = ? ORDER BY id DESC").all(id);
}

async function manejarAPI(req, res, urlObj) {
  const partes = urlObj.pathname.split("/").filter(Boolean); // ["api", ...]

  try {
    // POST /api/empresas  { nombre, tipo, contacto }
    if (req.method === "POST" && partes.length === 2 && partes[1] === "empresas") {
      const body = await leerCuerpo(req);
      const nombre = (body.nombre || "").trim();
      const tipo = (body.tipo || "Regional").trim();
      const contacto = (body.contacto || "").trim();
      if (!nombre || !contacto) {
        return enviarJSON(res, 400, { error: "nombre y contacto son obligatorios" });
      }

      let empresa = db.prepare("SELECT * FROM empresas WHERE contacto = ?").get(contacto);
      if (!empresa) {
        const id = "emp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
        db.prepare("INSERT INTO empresas (id, nombre, tipo, contacto, creado_en) VALUES (?, ?, ?, ?, ?)")
          .run(id, nombre, tipo, contacto, new Date().toISOString());
        empresa = empresaAId(id);
      }
      return enviarJSON(res, 200, { empresa, rutas: rutasDeEmpresa(empresa.id) });
    }

    // GET /api/empresas/:id
    if (req.method === "GET" && partes.length === 3 && partes[1] === "empresas") {
      const empresa = empresaAId(partes[2]);
      if (!empresa) return enviarJSON(res, 404, { error: "empresa no encontrada" });
      return enviarJSON(res, 200, { empresa, rutas: rutasDeEmpresa(empresa.id) });
    }

    // POST /api/empresas/:id/rutas   { origen, destino, precio, moneda, dias }
    if (req.method === "POST" && partes.length === 4 && partes[1] === "empresas" && partes[3] === "rutas") {
      const empresa = empresaAId(partes[2]);
      if (!empresa) return enviarJSON(res, 404, { error: "empresa no encontrada" });

      const body = await leerCuerpo(req);
      const r = validarRuta(body);
      if (!r.ok) return enviarJSON(res, 400, { error: r.error });

      db.prepare("INSERT INTO rutas (empresa_id, origen, destino, precio, moneda, dias) VALUES (?, ?, ?, ?, ?, ?)")
        .run(empresa.id, r.ruta.origen, r.ruta.destino, r.ruta.precio, r.ruta.moneda, r.ruta.dias);

      return enviarJSON(res, 200, { rutas: rutasDeEmpresa(empresa.id) });
    }

    // POST /api/empresas/:id/rutas/bulk   { rutas: [ {origen,destino,precio,moneda,dias}, ... ] }
    if (req.method === "POST" && partes.length === 5 && partes[1] === "empresas" && partes[3] === "rutas" && partes[4] === "bulk") {
      const empresa = empresaAId(partes[2]);
      if (!empresa) return enviarJSON(res, 404, { error: "empresa no encontrada" });

      const body = await leerCuerpo(req);
      const entrada = Array.isArray(body.rutas) ? body.rutas : [];
      const insertar = db.prepare("INSERT INTO rutas (empresa_id, origen, destino, precio, moneda, dias) VALUES (?, ?, ?, ?, ?, ?)");

      let agregadas = 0;
      const errores = [];
      entrada.forEach((fila, i) => {
        const r = validarRuta(fila);
        if (!r.ok) {
          errores.push(`Fila ${i + 2}: ${r.error}`);
          return;
        }
        insertar.run(empresa.id, r.ruta.origen, r.ruta.destino, r.ruta.precio, r.ruta.moneda, r.ruta.dias);
        agregadas++;
      });

      return enviarJSON(res, 200, { agregadas, errores, rutas: rutasDeEmpresa(empresa.id) });
    }

    // DELETE /api/empresas/:id/rutas/:rutaId
    if (req.method === "DELETE" && partes.length === 5 && partes[1] === "empresas" && partes[3] === "rutas") {
      const empresaId = partes[2];
      const rutaId = partes[4];
      db.prepare("DELETE FROM rutas WHERE id = ? AND empresa_id = ?").run(rutaId, empresaId);
      return enviarJSON(res, 200, { rutas: rutasDeEmpresa(empresaId) });
    }

    // GET /api/estadisticas — cifras reales de cobertura (nunca inventadas).
    if (req.method === "GET" && partes.length === 2 && partes[1] === "estadisticas") {
      const empresas = db.prepare("SELECT COUNT(DISTINCT empresa_id) AS n FROM rutas").get().n;
      const corredores = db.prepare("SELECT COUNT(DISTINCT origen || '>' || destino) AS n FROM rutas").get().n;
      const rutas = db.prepare("SELECT COUNT(*) AS n FROM rutas").get().n;
      return enviarJSON(res, 200, { empresas, corredores, rutas });
    }

    // GET /api/tasas — tasas de cambio reales, cacheadas (no se piden en cada visita)
    if (req.method === "GET" && partes.length === 2 && partes[1] === "tasas") {
      return enviarJSON(res, 200, cacheTasas);
    }

    // GET /api/buscar?origen=X&destino=Y
    if (req.method === "GET" && partes.length === 2 && partes[1] === "buscar") {
      const origen = normaliza(urlObj.searchParams.get("origen") || "");
      const destino = normaliza(urlObj.searchParams.get("destino") || "");
      if (!origen || !destino) return enviarJSON(res, 400, { error: "origen y destino son obligatorios" });

      const filas = db.prepare(`
        SELECT r.precio, r.moneda, r.dias, e.nombre, e.tipo, e.contacto, e.origen_dato, e.fuente_url
        FROM rutas r JOIN empresas e ON e.id = r.empresa_id
        WHERE r.origen = ? AND r.destino = ?
      `).all(origen, destino);

      if (filas.length === 0) {
        const ahora = new Date().toISOString();
        db.prepare(`
          INSERT INTO busquedas_sin_resultado (origen, destino, veces, primera_vez, ultima_vez)
          VALUES (?, ?, 1, ?, ?)
          ON CONFLICT(origen, destino) DO UPDATE SET veces = veces + 1, ultima_vez = excluded.ultima_vez
        `).run(origen, destino, ahora, ahora);
      }

      return enviarJSON(res, 200, { empresas: filas });
    }

    // POST /api/investigacion/bulk — resultados de investigación real (nunca inventados).
    // Solo se publican como "identificada" (visibles/invitables) si fuenteVerificada=true,
    // es decir, si el contacto se confirmó en el sitio propio de la empresa, no en un
    // directorio de terceros. Si no, quedan en pendientes_revision para revisión manual.
    if (req.method === "POST" && partes.length === 3 && partes[1] === "investigacion" && partes[2] === "bulk") {
      const body = await leerCuerpo(req);
      const entrada = Array.isArray(body.empresas) ? body.empresas : [];

      let publicadas = 0;
      let pendientes = 0;
      const errores = [];

      entrada.forEach((fila, i) => {
        const nombre = (fila.nombre || "").trim();
        const tipo = (fila.tipo || "Regional").trim();
        const contacto = (fila.contacto || "").trim();
        const fuenteUrl = (fila.fuenteUrl || "").trim();
        const fuenteVerificada = fila.fuenteVerificada === true;
        const r = validarRuta(fila);

        if (!nombre || !r.ok) {
          errores.push(`Fila ${i + 1}: ${r.ok ? "falta nombre" : r.error}`);
          return;
        }

        if (fuenteVerificada && contacto) {
          let empresa = db.prepare("SELECT * FROM empresas WHERE contacto = ?").get(contacto);
          if (!empresa) {
            const id = "inv_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
            db.prepare(`
              INSERT INTO empresas (id, nombre, tipo, contacto, creado_en, origen_dato, fuente_verificada, fuente_url)
              VALUES (?, ?, ?, ?, ?, 'investigacion', 1, ?)
            `).run(id, nombre, tipo, contacto, new Date().toISOString(), fuenteUrl);
            empresa = empresaAId(id);
          }
          db.prepare("INSERT INTO rutas (empresa_id, origen, destino, precio, moneda, dias) VALUES (?, ?, ?, ?, ?, ?)")
            .run(empresa.id, r.ruta.origen, r.ruta.destino, r.ruta.precio, r.ruta.moneda, r.ruta.dias);
          publicadas++;
        } else {
          db.prepare(`
            INSERT INTO pendientes_revision (nombre, tipo, origen, destino, precio, moneda, dias, contacto, fuente_url, motivo, creado_en)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(nombre, tipo, r.ruta.origen, r.ruta.destino, r.ruta.precio, r.ruta.moneda, r.ruta.dias, contacto, fuenteUrl,
                 fuenteVerificada ? "sin contacto" : "fuente no confirmada en sitio propio", new Date().toISOString());
          pendientes++;
        }
      });

      return enviarJSON(res, 200, { publicadas, pendientes, errores });
    }

    // GET /api/pendientes — qué investigar después (búsquedas reales sin resultado)
    // y qué revisar a mano (empresas encontradas sin fuente confirmada).
    if (req.method === "GET" && partes.length === 2 && partes[1] === "pendientes") {
      const busquedasSinResultado = db.prepare(`
        SELECT origen, destino, veces, primera_vez, ultima_vez
        FROM busquedas_sin_resultado ORDER BY veces DESC, ultima_vez DESC LIMIT 50
      `).all();
      const pendientesRevision = db.prepare(`
        SELECT * FROM pendientes_revision ORDER BY creado_en DESC LIMIT 100
      `).all();
      return enviarJSON(res, 200, { busquedasSinResultado, pendientesRevision });
    }

    // POST /api/pendientes/:id/aprobar | /descartar — decide una empresa pendiente de revisión manual
    if (req.method === "POST" && partes.length === 4 && partes[1] === "pendientes" && (partes[3] === "aprobar" || partes[3] === "descartar")) {
      const pendienteId = partes[2];
      const pendiente = db.prepare("SELECT * FROM pendientes_revision WHERE id = ?").get(pendienteId);
      if (!pendiente) return enviarJSON(res, 404, { error: "pendiente no encontrado" });

      if (partes[3] === "aprobar") {
        if (!pendiente.contacto) return enviarJSON(res, 400, { error: "no se puede aprobar sin contacto" });
        let empresa = db.prepare("SELECT * FROM empresas WHERE contacto = ?").get(pendiente.contacto);
        if (!empresa) {
          const id = "inv_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
          db.prepare(`
            INSERT INTO empresas (id, nombre, tipo, contacto, creado_en, origen_dato, fuente_verificada, fuente_url)
            VALUES (?, ?, ?, ?, ?, 'investigacion', 1, ?)
          `).run(id, pendiente.nombre, pendiente.tipo, pendiente.contacto, new Date().toISOString(), pendiente.fuente_url);
          empresa = empresaAId(id);
        }
        db.prepare("INSERT INTO rutas (empresa_id, origen, destino, precio, moneda, dias) VALUES (?, ?, ?, ?, ?, ?)")
          .run(empresa.id, pendiente.origen, pendiente.destino, pendiente.precio, pendiente.moneda, pendiente.dias);
      }

      db.prepare("DELETE FROM pendientes_revision WHERE id = ?").run(pendienteId);
      return enviarJSON(res, 200, { ok: true });
    }

    enviarJSON(res, 404, { error: "ruta de API no encontrada" });
  } catch (err) {
    enviarJSON(res, 500, { error: err.message || "error interno" });
  }
}

function validarRuta(body) {
  const origen = normaliza((body.origen || "").toString());
  const destino = normaliza((body.destino || "").toString());
  const precio = parseFloat(body.precio);
  const moneda = ((body.moneda || "USD").toString().trim().toUpperCase()) || "USD";
  const dias = (body.dias || "").toString().trim();

  if (!origen || !destino || !dias || isNaN(precio) || precio <= 0) {
    return { ok: false, error: "datos incompletos o precio inválido" };
  }
  return { ok: true, ruta: { origen, destino, precio, moneda, dias } };
}

// ---------- Servidor ----------

const servidor = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://localhost:${PUERTO}`);

  if (urlObj.pathname.startsWith("/api/")) {
    manejarAPI(req, res, urlObj);
    return;
  }

  if (req.method === "GET") {
    servirArchivoEstatico(req, res, urlObj.pathname);
    return;
  }

  res.writeHead(404);
  res.end("No encontrado");
});

servidor.listen(PUERTO, () => {
  console.log(`EnviaCompara corriendo en http://localhost:${PUERTO}`);
  console.log(`Base de datos: ${RUTA_DB}`);
});
