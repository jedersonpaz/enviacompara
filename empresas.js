// Panel de autoservicio para empresas — conectado al backend real (server.js).
// localStorage solo guarda "qué empresa soy" (un id), no los datos —
// los datos (rutas, precios) viven en la base de datos compartida.

const CLAVE_SESION = "enviaCompara_empresaActualId";

const formEmpresa = document.getElementById("form-empresa");
const formRuta = document.getElementById("form-ruta");
const pasoRegistro = document.getElementById("paso-registro");
const pasoPanel = document.getElementById("paso-panel");
const pitchEmpresa = document.getElementById("pitch-empresa");
const saludoEmpresa = document.getElementById("saludo-empresa");
const listaRutasEmpresa = document.getElementById("lista-rutas-empresa");
const sinRutas = document.getElementById("sin-rutas");
const btnSalir = document.getElementById("btn-salir");

let empresaEnPanel = null;
let rutasEnPanel = [];

async function apiJSON(url, opciones) {
  const resp = await fetch(url, opciones);
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "error de red");
  return data;
}

function mostrarPanel(empresa, rutas, contactos) {
  empresaEnPanel = empresa;
  rutasEnPanel = rutas;
  pasoRegistro.hidden = true;
  pasoPanel.hidden = false;
  pitchEmpresa.hidden = true;
  saludoEmpresa.textContent = `${t("saludo_hola")} ${empresa.nombre}`;
  renderRutas();
  renderContadorContactos(contactos || 0);
}

function renderContadorContactos(contactos) {
  ultimoConteoContactos = contactos || 0;
  const el = document.getElementById("contador-contactos");
  if (!contactos) { el.hidden = true; return; }
  el.hidden = false;
  el.textContent = `📈 ${contactos} ${contactos === 1 ? t("contacto_recibido_singular") : t("contactos_recibidos_plural")}`;
}

function renderRutas() {
  if (!rutasEnPanel.length) {
    sinRutas.hidden = false;
    listaRutasEmpresa.innerHTML = "";
    return;
  }
  sinRutas.hidden = true;
  listaRutasEmpresa.innerHTML = rutasEnPanel.map(r => `
    <div class="fila-ruta">
      <div class="ruta-nombre">${capitaliza(r.origen)} → ${capitaliza(r.destino)}</div>
      <div class="ruta-precio">${r.precio} ${r.moneda || "USD"}</div>
      <div class="ruta-dias">${r.dias} ${t("dias_entrega")}</div>
      <button class="btn-quitar" data-id="${r.id}">${t("btn_quitar")}</button>
    </div>
  `).join("");

  listaRutasEmpresa.querySelectorAll(".btn-quitar").forEach(btn => {
    btn.addEventListener("click", async function () {
      const rutaId = this.dataset.id;
      const data = await apiJSON(`/api/empresas/${empresaEnPanel.id}/rutas/${rutaId}`, { method: "DELETE" });
      rutasEnPanel = data.rutas;
      renderRutas();
    });
  });
}

let ultimoConteoContactos = 0;

document.addEventListener("idioma-cambiado", function () {
  if (empresaEnPanel) {
    saludoEmpresa.textContent = `${t("saludo_hola")} ${empresaEnPanel.nombre}`;
    renderRutas();
    renderContadorContactos(ultimoConteoContactos);
  }
});

function capitaliza(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

formEmpresa.addEventListener("submit", async function (e) {
  e.preventDefault();
  const nombre = document.getElementById("nombre-empresa").value.trim();
  const tipo = document.getElementById("tipo-empresa").value;
  const contacto = document.getElementById("contacto-empresa").value.trim();
  if (!nombre || !contacto) return;

  try {
    const data = await apiJSON("/api/empresas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, tipo, contacto })
    });
    localStorage.setItem(CLAVE_SESION, data.empresa.id);
    mostrarPanel(data.empresa, data.rutas, data.contactos);
  } catch (err) {
    alert("No se pudo registrar la empresa: " + err.message);
  }
});

formRuta.addEventListener("submit", async function (e) {
  e.preventDefault();
  if (!empresaEnPanel) return;

  const origen = document.getElementById("ruta-origen").value.trim();
  const destino = document.getElementById("ruta-destino").value.trim();
  const precio = document.getElementById("ruta-precio").value;
  const moneda = document.getElementById("ruta-moneda").value;
  const dias = document.getElementById("ruta-dias").value.trim();
  if (!origen || !destino || !precio || !dias) return;

  try {
    const data = await apiJSON(`/api/empresas/${empresaEnPanel.id}/rutas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origen, destino, precio, moneda, dias })
    });
    rutasEnPanel = data.rutas;
    renderRutas();
    formRuta.reset();
  } catch (err) {
    alert("No se pudo agregar la ruta: " + err.message);
  }
});

btnSalir.addEventListener("click", function () {
  localStorage.removeItem(CLAVE_SESION);
  empresaEnPanel = null;
  rutasEnPanel = [];
  pasoPanel.hidden = true;
  pasoRegistro.hidden = false;
  pitchEmpresa.hidden = false;
  formEmpresa.reset();
});

// ---- Carga masiva desde archivo (Excel / CSV) ----

const btnPlantilla = document.getElementById("btn-plantilla");
const inputArchivo = document.getElementById("input-archivo");
const resultadoCarga = document.getElementById("resultado-carga");

const COLUMNAS_ESPERADAS = ["origen", "destino", "precio", "moneda", "dias"];

btnPlantilla.addEventListener("click", function () {
  const filas = [
    COLUMNAS_ESPERADAS.join(","),
    "México,Colombia,45,USD,5-8",
    "México,Perú,52,USD,7-10"
  ];
  const csv = filas.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantilla-rutas-enviacompara.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

inputArchivo.addEventListener("change", function (e) {
  const archivo = e.target.files[0];
  if (!archivo) return;
  if (!empresaEnPanel) return;

  const esCSV = /\.csv$/i.test(archivo.name);
  const lector = new FileReader();

  lector.onload = async function (ev) {
    let filas;
    try {
      if (esCSV) {
        // CSV: parseo manual como texto plano (UTF-8), sin adivinar tipos de dato —
        // así "8-12" no se confunde con una fecha y los acentos no se corrompen.
        filas = parsearCSV(ev.target.result);
      } else {
        // .xlsx / .xls reales: sí necesitan la librería para leer el formato binario.
        const datos = new Uint8Array(ev.target.result);
        const libro = XLSX.read(datos, { type: "array" });
        const hoja = libro.Sheets[libro.SheetNames[0]];
        filas = XLSX.utils.sheet_to_json(hoja, { defval: "", raw: false });
      }
    } catch (err) {
      mostrarResultadoCarga(false, t("carga_error_leer"));
      return;
    }

    try {
      const data = await apiJSON(`/api/empresas/${empresaEnPanel.id}/rutas/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rutas: filas.map(normalizarClaves) })
      });
      rutasEnPanel = data.rutas;
      renderRutas();

      const mensaje = `${data.agregadas} ${t("carga_rutas_agregadas")}` +
        (data.errores.length ? ` ${data.errores.length} ${t("carga_filas_error")}` : "");
      mostrarResultadoCarga(data.errores.length === 0, mensaje, data.errores);
    } catch (err) {
      mostrarResultadoCarga(false, err.message);
    }

    inputArchivo.value = "";
  };

  if (esCSV) {
    lector.readAsText(archivo, "utf-8");
  } else {
    lector.readAsArrayBuffer(archivo);
  }
});

// Parser de CSV simple: separa por comas, respeta comillas básicas, todo como texto.
function parsearCSV(texto) {
  const lineas = texto.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (!lineas.length) return [];

  const encabezados = dividirLineaCSV(lineas[0]);
  return lineas.slice(1).map(linea => {
    const valores = dividirLineaCSV(linea);
    const fila = {};
    encabezados.forEach((encabezado, i) => {
      fila[encabezado] = valores[i] !== undefined ? valores[i] : "";
    });
    return fila;
  });
}

function dividirLineaCSV(linea) {
  return linea.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
}

// Acepta encabezados en distinto orden, mayúsculas o con acentos (ej. "Días", "PRECIO")
function normalizarClaves(fila) {
  const resultado = {};
  Object.keys(fila).forEach(clave => {
    const claveNormalizada = normaliza(clave);
    resultado[claveNormalizada] = fila[clave];
  });
  return resultado;
}

function mostrarResultadoCarga(ok, mensaje, errores) {
  resultadoCarga.hidden = false;
  resultadoCarga.className = "resultado-carga " + (ok ? "ok" : "error");
  resultadoCarga.innerHTML = `<div>${mensaje}</div>` +
    (errores && errores.length ? `<ul>${errores.slice(0, 8).map(e => `<li>${e}</li>`).join("")}</ul>` : "");
}

// ---- Al cargar la página, si ya hay una sesión de empresa activa, va directo al panel ----

(async function iniciar() {
  const id = localStorage.getItem(CLAVE_SESION);
  if (!id) return;
  try {
    const data = await apiJSON(`/api/empresas/${id}`);
    mostrarPanel(data.empresa, data.rutas, data.contactos);
  } catch (err) {
    localStorage.removeItem(CLAVE_SESION);
  }
})();
