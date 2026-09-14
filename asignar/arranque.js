// ASIGNAR PISTAS — el enlace de la cabecera a asignar.html (27-11). En la web LOCAL sale siempre; en la
// PUBLICADA viene oculto y solo lo destapa `?asignar` en la URL (como `?historias`), cualquier valor.
(() => {
  const enlace = document.getElementById('asignar-abrir');
  if (enlace?.hidden && new URLSearchParams(window.location.search).has('asignar')) enlace.hidden = false;
})();
