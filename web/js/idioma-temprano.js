// Detección de idioma, lo primero que se ejecuta de la página.
//
// Va en un script clásico y no en un módulo porque los módulos son diferidos
// por definición: se ejecutan después de pintar, y en un dispositivo en inglés
// se vería un instante el texto en español, que es el idioma en que está
// escrito el HTML.
//
// Aquí solo se decide el idioma y se escribe en <html lang>. Traducir es cosa
// de i18n.js, que lee ese valor: así la regla vive en un único sitio.

(function () {
  var DISPONIBLES = ['es', 'en'];

  // ?idioma=en lo fuerza. Sirve para probar el otro idioma sin cambiar el del
  // sistema, que en un móvil obliga a reiniciar media configuración.
  var pedido = new URLSearchParams(location.search).get('idioma');
  var preferidos = pedido
    ? [pedido]
    : (navigator.languages && navigator.languages.length
        ? navigator.languages
        : [navigator.language || 'es']);

  // Cualquier idioma que no tengamos se atiende en inglés, no en español: es lo
  // que más gente entiende de los que no hablan el nuestro.
  var elegido = 'en';
  for (var i = 0; i < preferidos.length; i++) {
    var corto = String(preferidos[i]).slice(0, 2).toLowerCase();
    if (DISPONIBLES.indexOf(corto) !== -1) { elegido = corto; break; }
  }
  document.documentElement.lang = elegido;

  // Con el idioma fuente no hay nada que esperar. Con otro se oculta el
  // contenido hasta la primera traducción, con un plazo de seguridad: si
  // i18n.js fallara, más vale la consola en español que una pantalla en blanco.
  if (elegido !== 'es') {
    document.documentElement.className += ' i18n-pendiente';
    setTimeout(function () {
      document.documentElement.classList.remove('i18n-pendiente');
    }, 1000);
  }
})();
