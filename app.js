const form = document.getElementById("search-form");
const resultadosSection = document.getElementById("resultados-section");
const sinResultados = document.getElementById("sin-resultados");
const listaResultados = document.getElementById("lista-resultados");
const resultadosTitulo = document.getElementById("resultados-titulo");
const ordenSelect = document.getElementById("orden-select");
const monedaSelect = document.getElementById("moneda-select");
const trayectoriaEl = document.getElementById("trayectoria");
const btnIntercambiar = document.getElementById("btn-intercambiar");
const statsCobertura = document.getElementById("stats-cobertura");

let empresasActuales = [];

// Cifras reales de cobertura (nunca inventadas) — se piden una vez al cargar.
async function cargarEstadisticas() {
  try {
    const resp = await fetch("/api/estadisticas");
    if (!resp.ok) return;
    const stats = await resp.json();
    if (!stats.empresas) return; // nada que mostrar todavía, no inventamos un cero bonito
    statsCobertura.textContent = `🏢 ${stats.empresas} ${t("stats_empresas")} · 🌎 ${stats.corredores} ${t("stats_corredores")}`;
    statsCobertura.hidden = false;
  } catch (err) {
    // si falla, simplemente no se muestra la barra de estadísticas
  }
}
cargarEstadisticas();

btnIntercambiar.addEventListener("click", function () {
  const origenInput = document.getElementById("origen");
  const destinoInput = document.getElementById("destino");
  const temp = origenInput.value;
  origenInput.value = destinoInput.value;
  destinoInput.value = temp;
});

// Visual decorativo del corredor (bandera origen -- línea -- bandera destino).
// No es tracking real de ningún envío, solo ilustra la ruta que se buscó.
function renderTrayectoria(origen, destino, diasMinGlobal, diasMaxGlobal) {
  const o = infoPais(origen);
  const d = infoPais(destino);
  const rango = diasMinGlobal === diasMaxGlobal ? `${diasMinGlobal}` : `${diasMinGlobal}-${diasMaxGlobal}`;
  trayectoriaEl.innerHTML = `
    <div class="trayectoria-punto">
      <div class="trayectoria-badge" style="background:${o.color}">${o.codigo}</div>
      <div class="trayectoria-nombre">${o.nombre}</div>
    </div>
    <div class="trayectoria-linea">
      <div class="trayectoria-riel"></div>
      <div class="trayectoria-paquete">📦</div>
      <div class="trayectoria-dias">${rango} ${t("dias_entrega")}</div>
    </div>
    <div class="trayectoria-punto">
      <div class="trayectoria-badge" style="background:${d.color}">${d.codigo}</div>
      <div class="trayectoria-nombre">${d.nombre}</div>
    </div>
  `;
}

function rangoDiasGlobal(empresas) {
  let min = Infinity, max = -Infinity;
  empresas.forEach(e => {
    const partes = e.dias.split("-").map(n => parseInt(n, 10)).filter(n => !isNaN(n));
    if (partes.length) {
      min = Math.min(min, ...partes);
      max = Math.max(max, ...partes);
    }
  });
  return { min: isFinite(min) ? min : 0, max: isFinite(max) ? max : 0 };
}

function estrellas(rating) {
  const llenas = Math.round(rating);
  return "★".repeat(llenas) + "☆".repeat(5 - llenas);
}

const SIMBOLOS_MONEDA = {
  USD: "$", EUR: "€", MXN: "$", COP: "$", PEN: "S/", ARS: "$", CLP: "$", TRY: "₺"
};

function ordenar(empresas, criterio) {
  const copia = [...empresas];
  if (criterio === "precio") {
    copia.sort((a, b) => convertirAUSD(a.precio, a.moneda) - convertirAUSD(b.precio, b.moneda));
  } else if (criterio === "rating") {
    copia.sort((a, b) => b.rating - a.rating);
  } else if (criterio === "tiempo") {
    copia.sort((a, b) => diasMin(a.dias) - diasMin(b.dias));
  }
  return copia;
}

function diasMin(rango) {
  return parseInt(rango.split("-")[0], 10);
}

function renderResultados(empresas) {
  const monedaVista = monedaSelect.value;
  const preciosUSD = empresas.map(e => convertirAUSD(e.precio, e.moneda));
  const precioMinUSD = Math.min(...preciosUSD);
  const precioMaxUSD = Math.max(...preciosUSD);
  const hayAhorro = empresas.length > 1 && precioMaxUSD > precioMinUSD;
  const porcentajeAhorro = hayAhorro ? Math.round((1 - precioMinUSD / precioMaxUSD) * 100) : 0;
  const simboloVista = SIMBOLOS_MONEDA[monedaVista] || monedaVista + " ";

  listaResultados.innerHTML = empresas.map(e => {
    const precioUSD = convertirAUSD(e.precio, e.moneda);
    const esMejor = precioUSD === precioMinUSD;
    const precioEnVista = convertirMoneda(e.precio, e.moneda, monedaVista);
    const esConvertido = e.moneda !== monedaVista;
    const anchoBarra = precioMaxUSD > 0 ? Math.max(8, Math.round((precioUSD / precioMaxUSD) * 100)) : 100;

    return `
    <div class="oferta ${esMejor ? "mejor-precio" : ""}">
      <div class="oferta-empresa">
        <div class="oferta-avatar" style="background:${colorAvatar(e.nombre)}">${inicialesEmpresa(e.nombre)}</div>
        <div class="oferta-info">
          <div class="oferta-nombre">${e.nombre}</div>
          <div class="oferta-tipo">${e.tipo}</div>
          ${esMejor ? `<span class="badge-mejor">${t("mejor_precio")}${hayAhorro ? ` · ${t("ahorras")} ${porcentajeAhorro}%` : ""}</span>` : ""}
        </div>
      </div>
      <div class="oferta-rating">
        ${e.resenas > 0
          ? `<div class="estrellas">${estrellas(e.rating)}</div><div>${e.rating.toFixed(1)} (${e.resenas})</div>`
          : `<div class="badge-nuevo">${t("nuevo_sin_resenas")}</div>`
        }
      </div>
      <div class="oferta-tiempo">
        <div class="dias">${e.dias} ${t("dias_entrega")}</div>
        <div>${t("entrega_estimada")}</div>
      </div>
      <div class="oferta-precio">
        <div class="monto">${simboloVista}${precioEnVista.toFixed(precioEnVista >= 100 ? 0 : 2)}</div>
        <div class="moneda">${monedaVista}${esConvertido ? ` · ${t("precio_original")} ${SIMBOLOS_MONEDA[e.moneda] || e.moneda + " "}${e.precio} ${e.moneda}` : ""}</div>
        ${e.identificada ? `<div class="precio-estimado">${t("precio_no_confirmado")}</div>` : ""}
        <div class="barra-precio-fondo"><div class="barra-precio ${esMejor ? "barra-mejor" : ""}" style="width:${anchoBarra}%"></div></div>
      </div>
      <div class="oferta-accion">
        ${botonAccion(e, ultimaBusqueda)}
      </div>
    </div>
  `;
  }).join("");
}

// Tres estados reales, nunca simulados:
// 1. "real" = se registró de verdad en el panel -> botón de cotización directa.
// 2. "identificada" = la encontramos por investigación real, con su contacto público,
//    pero no se ha registrado -> botón de INVITACIÓN, no de cotización (no le prometemos
//    al usuario que esta empresa ya está esperando su mensaje de compra).
// 3. Transportista grande sin contacto personal -> link a su sitio oficial real.
// 4. Nada de lo anterior -> dato de ejemplo, sin botón.
function botonAccion(e, busqueda) {
  const contacto = (e.contacto || "").trim();

  if (e.real && contacto) {
    const mensaje = t("mensaje_whatsapp")
      .replace("{origen}", capitaliza(busqueda.origen))
      .replace("{destino}", capitaliza(busqueda.destino));
    const enlace = enlaceContacto(contacto, mensaje, t("asunto_correo"));
    return `<a class="btn-contactar" href="${enlace}" target="_blank" rel="noopener">${t("btn_cotizar")}</a>`;
  }

  if (e.identificada && contacto) {
    const mensaje = t("mensaje_invitacion")
      .replace("{origen}", capitaliza(busqueda.origen))
      .replace("{destino}", capitaliza(busqueda.destino));
    const enlace = enlaceContacto(contacto, mensaje, t("asunto_invitacion"));
    return `<a class="btn-invitar" href="${enlace}" target="_blank" rel="noopener" title="${t("tooltip_identificada")}">${t("btn_invitar")}</a>`;
  }

  if (e.sitioOficial) {
    return `<a class="btn-sitio-oficial" href="${e.sitioOficial}" target="_blank" rel="noopener">${t("btn_sitio_oficial")}</a>`;
  }

  return `<span class="badge-ejemplo" title="${t("ejemplo_sin_contacto")}">${t("solo_ejemplo")}</span>`;
}

function enlaceContacto(contacto, mensaje, asunto) {
  const esCorreo = contacto.includes("@");
  return esCorreo
    ? `mailto:${contacto}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensaje)}`
    : `https://wa.me/${contacto.replace(/[^\d]/g, "")}?text=${encodeURIComponent(mensaje)}`;
}

const btnBuscar = form.querySelector(".btn-buscar");

let idBusquedaActual = 0;

form.addEventListener("submit", async function (e) {
  e.preventDefault();
  const origen = document.getElementById("origen").value.trim();
  const destino = document.getElementById("destino").value.trim();
  if (!origen || !destino) return;

  const idEstaBusqueda = ++idBusquedaActual;
  btnBuscar.disabled = true;
  const ruta = await buscarRuta(origen, destino);
  btnBuscar.disabled = false;

  // Si mientras esperábamos la respuesta el usuario ya lanzó otra búsqueda,
  // esta respuesta llegó tarde — se descarta para no pisar el resultado nuevo.
  if (idEstaBusqueda !== idBusquedaActual) return;

  if (!ruta) {
    resultadosSection.hidden = true;
    sinResultados.hidden = false;
    return;
  }

  empresasActuales = ruta.empresas;
  ultimaBusqueda = { origen, destino };
  actualizarTituloResultados();
  const { min, max } = rangoDiasGlobal(empresasActuales);
  renderTrayectoria(ruta.origen, ruta.destino, min, max);
  sinResultados.hidden = true;
  resultadosSection.hidden = false;
  renderResultados(ordenar(empresasActuales, ordenSelect.value));
});

let ultimaBusqueda = null;

function actualizarTituloResultados() {
  if (!ultimaBusqueda) return;
  resultadosTitulo.textContent = `${capitaliza(ultimaBusqueda.origen)} → ${capitaliza(ultimaBusqueda.destino)}: ${empresasActuales.length} ${t("resultados_encontradas")}`;
}

ordenSelect.addEventListener("change", function () {
  if (empresasActuales.length) {
    renderResultados(ordenar(empresasActuales, ordenSelect.value));
  }
});

monedaSelect.addEventListener("change", function () {
  if (empresasActuales.length) {
    renderResultados(ordenar(empresasActuales, ordenSelect.value));
  }
});

document.addEventListener("idioma-cambiado", function () {
  actualizarTituloResultados();
  if (empresasActuales.length && ultimaBusqueda) {
    const { min, max } = rangoDiasGlobal(empresasActuales);
    renderTrayectoria(ultimaBusqueda.origen, ultimaBusqueda.destino, min, max);
    renderResultados(ordenar(empresasActuales, ordenSelect.value));
  }
  cargarEstadisticas();
});

function capitaliza(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function inicialesEmpresa(nombre) {
  const palabras = nombre.trim().split(/\s+/);
  return (palabras[0][0] + (palabras[1] ? palabras[1][0] : "")).toUpperCase();
}

const PALETA_AVATAR = ["#2563eb", "#7c3aed", "#0891b2", "#059669", "#d97706", "#dc2626", "#db2777"];

function colorAvatar(nombre) {
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
  return PALETA_AVATAR[Math.abs(hash) % PALETA_AVATAR.length];
}
