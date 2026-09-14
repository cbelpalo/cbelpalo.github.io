// CARTELES — el botón de la cabecera (21-10). En la web LOCAL sale siempre; en la PUBLICADA viene
// oculto y solo se destapa con `?carteles` en la URL (cualquier valor: lo usa el CM). Hasta que se
// pulsa no se carga nada de carteles: ni el módulo, ni su CSS, ni la letra, ni los fondos.
(() => {
  const boton = document.getElementById('carteles-abrir');
  if (!boton) return;
  if (boton.hidden && !new URLSearchParams(window.location.search).has('carteles')) return;
  boton.hidden = false;
  boton.addEventListener('click', () => {
    boton.setAttribute('aria-busy', 'true');
    import('./carteles/cliente.mjs')
      .then((m) => m.abrir())
      .catch((error) => window.alert(`No se han podido abrir los carteles: ${error.message}`))
      .finally(() => boton.removeAttribute('aria-busy'));
  });
})();
