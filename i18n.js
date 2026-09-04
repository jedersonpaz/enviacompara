// Sistema simple de idiomas (ES/EN). Guarda la preferencia en localStorage.

const CLAVE_IDIOMA = "enviaCompara_idioma";

const TRADUCCIONES = {
  es: {
    tagline_buscador: "Compara empresas de envío internacional en segundos",
    tagline_empresas: "Panel para empresas de envío — carga tus rutas y precios",
    link_empresas: "¿Tienes una empresa de envíos? Regístrate gratis →",
    link_buscador: "Ir al buscador de usuarios",
    label_origen: "Origen",
    label_destino: "Destino",
    label_peso: "Peso aprox. (kg)",
    placeholder_origen: "Ej. México",
    placeholder_destino: "Ej. Colombia",
    btn_buscar: "Buscar empresas",
    demo_note: "⚠️ Plataforma en construcción — las empresas mostradas son <strong>reales</strong> (identificadas por investigación) pero <strong>ninguna se ha unido todavía</strong>, así que el precio es una estimación nuestra, no su tarifa confirmada. Las transportadoras grandes llevan a su sitio oficial.",
    moneda_vista_label: "Mostrar precios en",
    moneda_vista_nota: "Conversión con tasa de cambio real (actualizada cada 12h) — el precio en la moneda original de cada empresa es el dato que cuenta.",
    precio_original: "precio original:",
    precio_no_confirmado: "estimado, no confirmado por la empresa",
    orden_label: "Ordenar por",
    orden_precio: "Precio: menor a mayor",
    orden_rating: "Mejor calificación",
    orden_tiempo: "Más rápido",
    sin_resultados_1: "No encontramos empresas registradas para esa ruta todavía.",
    sin_resultados_2: "Estamos agregando corredores cada semana — prueba con: México → Colombia, Colombia → Perú, Argentina → Chile, Ecuador → Colombia, o Brasil → Argentina.",
    btn_cotizar: "Cotizar por WhatsApp",
    btn_invitar: "Invitar a unirse",
    btn_sitio_oficial: "Cotizar en su sitio oficial",
    tooltip_identificada: "Empresa real identificada por investigación — aún no se ha registrado en EnviaCompara. Este botón le manda una invitación real, no una cotización.",
    solo_ejemplo: "Solo ejemplo",
    ejemplo_sin_contacto: "Dato de ejemplo — esta empresa no está registrada de verdad, no tiene contacto real.",
    asunto_correo: "Cotización de envío",
    asunto_invitacion: "Invitación a EnviaCompara",
    mensaje_whatsapp: "Hola, vi tu empresa en EnviaCompara y quiero cotizar un envío de {origen} a {destino}.",
    mensaje_invitacion: "Hola, encontramos su empresa investigando el corredor {origen} → {destino}. Estamos armando EnviaCompara, una plataforma para comparar precios de envío internacional, y nos gustaría invitarlos a registrarse gratis y cargar sus tarifas reales. ¿Les interesa?",
    footer_buscador: "EnviaCompara — prototipo de validación · datos de ejemplo",
    footer_empresas: "EnviaCompara — panel para empresas",
    resultados_encontradas: "empresas encontradas",
    mejor_precio: "Mejor precio",
    nuevo_sin_resenas: "Nuevo · sin reseñas",
    dias_entrega: "días",
    entrega_estimada: "entrega estimada",
    pitch_titulo: "¿Cotizas por WhatsApp y se te pierden los clientes en el chat?",
    pitch_subtitulo: "Cuando alguien busca una empresa para enviar un paquete a otro país, hoy no te encuentra. No porque seas más cara — es que no apareces en ningún lado.",
    pitch_dolor_titulo: "¿Te suena familiar?",
    pitch_dolor_1: "Cotizas uno por uno por WhatsApp y se te pierde el hilo",
    pitch_dolor_2: "No apareces cuando alguien busca envíos en tu ruta",
    pitch_dolor_3: "Competir contra las paqueterías grandes se siente imposible",
    pitch_beneficio_titulo: "Con EnviaCompara consigues",
    pitch_beneficio_1: "Aparecer cuando alguien busca justo tu ruta",
    pitch_beneficio_2: "Todas tus rutas y precios organizados en un panel, no en el chat",
    pitch_beneficio_3: "Cargar decenas de rutas de una vez con un Excel, no una por una",
    pitch_honesto: "Estamos empezando: hoy te registras gratis y ayudas a construir esto desde el inicio, en vez de llegar tarde cuando ya esté lleno de competencia.",
    registra_titulo: "Registra tu empresa",
    registra_ayuda: "Gratis. Cargas las rutas que cubres y tus precios, y apareces en las búsquedas de los usuarios.",
    label_nombre_empresa: "Nombre de la empresa",
    label_tipo_empresa: "Tipo",
    opcion_regional: "Regional / Consolidador",
    opcion_global: "Transportista global",
    label_contacto: "WhatsApp o correo de contacto",
    btn_entrar_panel: "Entrar al panel",
    saludo_hola: "Hola,",
    panel_ayuda: "Agrega cada ruta que cubres con tu precio y tiempo de entrega.",
    btn_salir: "Salir",
    label_precio: "Precio",
    label_moneda: "Moneda",
    label_dias: "Días entrega",
    btn_agregar_ruta: "Agregar ruta",
    tus_rutas: "Tus rutas activas",
    sin_rutas: "Todavía no has agregado ninguna ruta.",
    btn_quitar: "Quitar",
    carga_masiva_titulo: "Carga masiva desde archivo",
    carga_masiva_ayuda: "¿Manejas muchas rutas? Sube un Excel o CSV en vez de cargarlas una por una.",
    btn_plantilla: "Descargar plantilla de ejemplo",
    btn_archivo: "Elegir archivo (.xlsx / .csv)",
    carga_rutas_agregadas: "ruta(s) agregada(s).",
    carga_filas_error: "fila(s) con error.",
    carga_fila_invalida: "datos incompletos o precio inválido.",
    carga_fila_prefijo: "Fila",
    carga_error_leer: "No se pudo leer el archivo. Verifica que sea un .csv o .xlsx válido."
  },
  en: {
    tagline_buscador: "Compare international shipping companies in seconds",
    tagline_empresas: "Business panel — add your routes and prices",
    link_empresas: "Are you a shipping company? Register free →",
    link_buscador: "Go to the user search",
    label_origen: "Origin",
    label_destino: "Destination",
    label_peso: "Approx. weight (kg)",
    placeholder_origen: "E.g. Mexico",
    placeholder_destino: "E.g. Colombia",
    btn_buscar: "Search companies",
    demo_note: "⚠️ Platform under construction — the companies shown are <strong>real</strong> (identified through research), but <strong>none have joined yet</strong>, so the price is our estimate, not their confirmed rate. Big carriers link to their official site.",
    moneda_vista_label: "Show prices in",
    moneda_vista_nota: "Converted at a real exchange rate (refreshed every 12h) — the price in each company's original currency is what actually counts.",
    precio_original: "original price:",
    precio_no_confirmado: "estimated, not confirmed by the company",
    orden_label: "Sort by",
    orden_precio: "Price: low to high",
    orden_rating: "Best rated",
    orden_tiempo: "Fastest",
    sin_resultados_1: "We don't have registered companies for that route yet.",
    sin_resultados_2: "We're adding corridors every week — try: Mexico → Colombia, Colombia → Peru, Argentina → Chile, Ecuador → Colombia, or Brazil → Argentina.",
    btn_cotizar: "Get a quote on WhatsApp",
    btn_invitar: "Invite to join",
    btn_sitio_oficial: "Get a quote on their official site",
    tooltip_identificada: "Real company found through research — not registered on EnviaCompara yet. This button sends a real invitation, not a quote request.",
    solo_ejemplo: "Example only",
    ejemplo_sin_contacto: "Sample data — this company isn't actually registered, it has no real contact.",
    asunto_correo: "Shipping quote request",
    asunto_invitacion: "Invitation to EnviaCompara",
    mensaje_whatsapp: "Hi, I saw your company on EnviaCompara and I'd like a quote to ship from {origen} to {destino}.",
    mensaje_invitacion: "Hi, we found your company while researching the {origen} → {destino} corridor. We're building EnviaCompara, a platform to compare international shipping prices, and we'd like to invite you to register for free and list your real rates. Interested?",
    footer_buscador: "EnviaCompara — validation prototype · sample data",
    footer_empresas: "EnviaCompara — business panel",
    resultados_encontradas: "companies found",
    mejor_precio: "Best price",
    nuevo_sin_resenas: "New · no reviews",
    dias_entrega: "days",
    entrega_estimada: "estimated delivery",
    pitch_titulo: "Quoting over WhatsApp and losing customers in the chat?",
    pitch_subtitulo: "When someone looks for a company to ship a package abroad, they can't find you today. Not because you're pricier — you just don't show up anywhere.",
    pitch_dolor_titulo: "Sound familiar?",
    pitch_dolor_1: "You quote one by one over WhatsApp and lose the thread",
    pitch_dolor_2: "You don't show up when someone searches your route",
    pitch_dolor_3: "Competing against the big carriers feels impossible",
    pitch_beneficio_titulo: "With EnviaCompara you get",
    pitch_beneficio_1: "Show up when someone searches exactly your route",
    pitch_beneficio_2: "All your routes and prices organized in one panel, not in a chat",
    pitch_beneficio_3: "Upload dozens of routes at once with an Excel, not one by one",
    pitch_honesto: "We're just starting out: you register free today and help build this from the ground up, instead of arriving late once it's full of competition.",
    registra_titulo: "Register your company",
    registra_ayuda: "Free. Add the routes you cover and your prices, and show up in user searches.",
    label_nombre_empresa: "Company name",
    label_tipo_empresa: "Type",
    opcion_regional: "Regional / Consolidator",
    opcion_global: "Global carrier",
    label_contacto: "WhatsApp or contact email",
    btn_entrar_panel: "Enter panel",
    saludo_hola: "Hello,",
    panel_ayuda: "Add each route you cover with your price and delivery time.",
    btn_salir: "Log out",
    label_precio: "Price",
    label_moneda: "Currency",
    label_dias: "Delivery days",
    btn_agregar_ruta: "Add route",
    tus_rutas: "Your active routes",
    sin_rutas: "You haven't added any routes yet.",
    btn_quitar: "Remove",
    carga_masiva_titulo: "Bulk upload from file",
    carga_masiva_ayuda: "Managing many routes? Upload an Excel or CSV instead of adding them one by one.",
    btn_plantilla: "Download sample template",
    btn_archivo: "Choose file (.xlsx / .csv)",
    carga_rutas_agregadas: "route(s) added.",
    carga_filas_error: "row(s) with an error.",
    carga_fila_invalida: "incomplete data or invalid price.",
    carga_fila_prefijo: "Row",
    carga_error_leer: "Couldn't read the file. Check that it's a valid .csv or .xlsx."
  }
};

function idiomaActual() {
  return localStorage.getItem(CLAVE_IDIOMA) || "es";
}

function t(clave) {
  const idioma = idiomaActual();
  return (TRADUCCIONES[idioma] && TRADUCCIONES[idioma][clave]) || TRADUCCIONES.es[clave] || clave;
}

function aplicarIdioma(idioma) {
  localStorage.setItem(CLAVE_IDIOMA, idioma);
  document.documentElement.lang = idioma;

  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.innerHTML = t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
  });

  const selector = document.getElementById("selector-idioma");
  if (selector) selector.value = idioma;

  document.dispatchEvent(new Event("idioma-cambiado"));
}

document.addEventListener("DOMContentLoaded", function () {
  aplicarIdioma(idiomaActual());
  const selector = document.getElementById("selector-idioma");
  if (selector) {
    selector.addEventListener("change", function () {
      aplicarIdioma(this.value);
    });
  }
});
