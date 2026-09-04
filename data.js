// Las transportadoras grandes (DHL/FedEx/UPS) quedan como referencia estática porque
// son las mismas en casi cualquier ruta y no cambian — enlazan a su sitio oficial real.
// Todo lo demás (empresas regionales identificadas por investigación, y las que se
// registran solas en el panel) vive en la base de datos (server.js), no aquí, para que
// el catálogo crezca solo con el tiempo en vez de que alguien edite este archivo a mano.
const RUTAS = [
  {
    origen: "mexico",
    destino: "colombia",
    empresas: [
      { nombre: "DHL Express", tipo: "Global", precio: 68, moneda: "USD", dias: "3-5", rating: 4.4, resenas: 1820, sitioOficial: "https://www.dhl.com/mx-es/home.html" },
      { nombre: "FedEx International", tipo: "Global", precio: 74, moneda: "USD", dias: "3-6", rating: 4.3, resenas: 1540, sitioOficial: "https://www.fedex.com/es-mx/home.html" },
      { nombre: "UPS Worldwide", tipo: "Global", precio: 71, moneda: "USD", dias: "4-6", rating: 4.2, resenas: 1290, sitioOficial: "https://www.ups.com/mx/es/home.html" }
    ]
  },
  {
    origen: "mexico",
    destino: "peru",
    empresas: [
      { nombre: "DHL Express", tipo: "Global", precio: 79, moneda: "USD", dias: "4-6", rating: 4.4, resenas: 1820, sitioOficial: "https://www.dhl.com/pe-es/home.html" },
      { nombre: "FedEx International", tipo: "Global", precio: 83, moneda: "USD", dias: "4-7", rating: 4.3, resenas: 1540 }
    ]
  },
  {
    origen: "turquia",
    destino: "mexico",
    empresas: [
      { nombre: "DHL Express", tipo: "Global", precio: 112, moneda: "USD", dias: "5-8", rating: 4.4, resenas: 1820 },
      { nombre: "UPS Worldwide", tipo: "Global", precio: 118, moneda: "USD", dias: "5-9", rating: 4.2, resenas: 1290 }
    ]
  },
  {
    origen: "mexico",
    destino: "espana",
    empresas: [
      { nombre: "DHL Express", tipo: "Global", precio: 64, moneda: "USD", dias: "3-5", rating: 4.4, resenas: 1820, sitioOficial: "https://www.dhl.com/es-es/home.html" },
      { nombre: "FedEx International", tipo: "Global", precio: 69, moneda: "USD", dias: "3-6", rating: 4.3, resenas: 1540, sitioOficial: "https://www.fedex.com/es-es/home.html" },
      { nombre: "UPS Worldwide", tipo: "Global", precio: 66, moneda: "USD", dias: "4-6", rating: 4.2, resenas: 1290, sitioOficial: "https://www.ups.com/es/es/home.html" }
    ]
  },
  {
    origen: "colombia",
    destino: "peru",
    empresas: [
      { nombre: "DHL Express", tipo: "Global", precio: 47, moneda: "USD", dias: "2-4", rating: 4.4, resenas: 1820, sitioOficial: "https://www.dhl.com/pe-es/home.html" }
    ]
  }
];

// Tasas de referencia aproximadas contra USD, SOLO para poder ordenar por precio
// cuando hay rutas en distintas monedas. No son tasas en vivo — para producción
// se necesita una API de tipo de cambio real (ej. exchangerate.host, Open Exchange Rates).
const TASAS_REFERENCIA_USD = {
  USD: 1,
  EUR: 1.08,
  MXN: 0.054,
  COP: 0.00025,
  PEN: 0.27,
  ARS: 0.001,
  CLP: 0.0010,
  TRY: 0.029
};

function convertirAUSD(precio, moneda) {
  const tasa = TASAS_REFERENCIA_USD[moneda];
  return tasa ? precio * tasa : precio;
}

function convertirDesdeUSD(precioUSD, monedaDestino) {
  const tasa = TASAS_REFERENCIA_USD[monedaDestino];
  return tasa ? precioUSD / tasa : precioUSD;
}

// Convierte un precio de una moneda a otra, pasando por USD como puente.
function convertirMoneda(precio, monedaOrigen, monedaDestino) {
  if (monedaOrigen === monedaDestino) return precio;
  return convertirDesdeUSD(convertirAUSD(precio, monedaOrigen), monedaDestino);
}

// Normaliza texto: minúsculas, sin tildes, sin espacios extra
function normaliza(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

// Alias comunes para que "méxico", "mexico", "cdmx" etc. resuelvan a la misma ruta
const ALIAS = {
  "mexico": "mexico",
  "méxico": "mexico",
  "cdmx": "mexico",
  "colombia": "colombia",
  "bogota": "colombia",
  "bogotá": "colombia",
  "pasto": "colombia",
  "peru": "peru",
  "perú": "peru",
  "lima": "peru",
  "turquia": "turquia",
  "turquía": "turquia",
  "estambul": "turquia",
  "istanbul": "turquia",
  "españa": "espana",
  "espana": "espana",
  "madrid": "espana",
  "argentina": "argentina",
  "buenos aires": "argentina",
  "chile": "chile",
  "santiago": "chile",
  "ecuador": "ecuador",
  "quito": "ecuador",
  "guayaquil": "ecuador",
  "venezuela": "venezuela",
  "caracas": "venezuela",
  "brasil": "brasil",
  "brazil": "brasil",
  "sao paulo": "brasil",
  "são paulo": "brasil",
  "rio de janeiro": "brasil"
};

function resolverPais(texto) {
  const n = normaliza(texto);
  return ALIAS[n] || n;
}

// Busca una ruta: combina los datos de ejemplo (RUTAS) con las empresas reales
// cargadas en el backend compartido (base de datos, visible para cualquier usuario).
async function buscarRuta(origenTexto, destinoTexto) {
  const origen = resolverPais(origenTexto);
  const destino = resolverPais(destinoTexto);

  const rutaEjemplo = RUTAS.find(r => r.origen === origen && r.destino === destino);
  const empresasReales = await buscarEmpresasRegistradas(origen, destino);

  const empresas = [...(rutaEjemplo ? rutaEjemplo.empresas : []), ...empresasReales];
  if (!empresas.length) return null;

  return { origen, destino, empresas };
}

// Consulta al backend las empresas reales (cargadas desde el panel de autoservicio)
// que cubren la ruta buscada.
async function buscarEmpresasRegistradas(origen, destino) {
  try {
    const resp = await fetch(`/api/buscar?origen=${encodeURIComponent(origen)}&destino=${encodeURIComponent(destino)}`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.empresas || []).map(e => ({
      nombre: e.nombre,
      tipo: e.tipo,
      precio: e.precio,
      moneda: e.moneda || "USD",
      dias: e.dias,
      rating: 0,
      resenas: 0,
      // "registro_propio" = se registró sola en el panel -> cotización real.
      // "investigacion" = la encontramos e identificamos, contacto verificado
      // en su sitio propio, pero no se ha unido -> botón de invitación, no cotización.
      real: e.origen_dato === "registro_propio",
      identificada: e.origen_dato === "investigacion",
      contacto: e.contacto,
      fuenteUrl: e.fuente_url
    }));
  } catch (err) {
    // Si el backend no está disponible, el comparador sigue funcionando solo con datos de ejemplo.
    console.warn("No se pudo conectar con el backend:", err.message);
    return [];
  }
}
