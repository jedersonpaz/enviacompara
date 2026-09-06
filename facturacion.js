// Panel interno de facturación. No es un cobro automático — genera el mensaje
// de cobro y el total sugerido, pero el pago en sí lo gestionas tú directamente
// con cada empresa (WhatsApp, transferencia, factura). Ningún dato aquí es
// inventado: viene de /api/reportes/contactos, que cuenta clics reales.

const tarifaInput = document.getElementById("tarifa-input");
const tablaFacturacion = document.getElementById("tabla-facturacion");
const tablaCuerpo = document.getElementById("tabla-cuerpo");
const cargando = document.getElementById("cargando");
const sinDatos = document.getElementById("sin-datos");
const resumenTotal = document.getElementById("resumen-total");

let empresas = [];

async function cargarReporte() {
  try {
    const resp = await fetch("/api/reportes/contactos");
    const data = await resp.json();
    empresas = data.empresas || [];
  } catch (err) {
    cargando.textContent = "No se pudo cargar el reporte: " + err.message;
    return;
  }

  cargando.hidden = true;

  if (!empresas.length) {
    sinDatos.hidden = false;
    return;
  }

  tablaFacturacion.hidden = false;
  resumenTotal.hidden = false;
  render();
}

function render() {
  const tarifa = parseFloat(tarifaInput.value) || 0;
  let totalGeneral = 0;

  tablaCuerpo.innerHTML = empresas.map(e => {
    const total = e.total_contactos * tarifa;
    totalGeneral += total;
    const estado = e.origen_dato === "registro_propio" ? "Registrada" : "Identificada (sin unirse aún)";
    const fecha = e.ultimo_contacto ? new Date(e.ultimo_contacto).toLocaleDateString("es") : "—";
    const enlaceCobro = generarEnlaceCobro(e, total, tarifa);

    return `
      <tr>
        <td><strong>${e.nombre}</strong></td>
        <td><span class="badge-estado">${estado}</span></td>
        <td>${e.contacto}</td>
        <td class="centrado">${e.total_contactos}</td>
        <td>${fecha}</td>
        <td class="derecha"><strong>$${total.toFixed(2)}</strong></td>
        <td>${enlaceCobro ? `<a class="btn-cobrar" href="${enlaceCobro}" target="_blank" rel="noopener">Enviar cobro</a>` : `<span class="sin-cobro">correo, no WhatsApp</span>`}</td>
      </tr>
    `;
  }).join("");

  resumenTotal.textContent = `💰 Total sugerido a cobrar este período: $${totalGeneral.toFixed(2)} USD (${empresas.length} empresas, ${empresas.reduce((s, e) => s + e.total_contactos, 0)} leads totales)`;
}

function generarEnlaceCobro(empresa, total, tarifa) {
  const contacto = (empresa.contacto || "").trim();
  if (contacto.includes("@")) return null; // por ahora solo generamos el link para WhatsApp

  const mensaje = `Hola ${empresa.nombre}, te escribimos de EnviaCompara. ` +
    `Este período te enviamos ${empresa.total_contactos} cliente(s) real(es) interesado(s) en tu servicio de envíos. ` +
    `A la tarifa de $${tarifa.toFixed(2)} USD por cliente contactado, el total es de $${total.toFixed(2)} USD. ` +
    `¿Cómo prefieres realizar el pago?`;

  return `https://wa.me/${contacto.replace(/[^\d]/g, "")}?text=${encodeURIComponent(mensaje)}`;
}

tarifaInput.addEventListener("input", function () {
  if (empresas.length) render();
});

cargarReporte();
