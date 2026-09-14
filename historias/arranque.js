// HISTORIAS — el enlace de la cabecera a historias.html (25-11). En la web LOCAL sale siempre; en la
// PUBLICADA viene oculto y solo lo destapa `?historias` en la URL (25-11, Luismi), cualquier valor.
(() => {
  const enlace = document.getElementById('historias-abrir');
  if (enlace?.hidden && new URLSearchParams(window.location.search).has('historias')) enlace.hidden = false;
})();
