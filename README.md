# Bueno Bonito Barato

Demo PWA para cargar mercadería, revisar las prendas y sumar sus unidades al stock de una sucursal. Está escrita en HTML, CSS y JavaScript y se sirve como un sitio estático.

## Probar la demo

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Abrí [la demo local](http://127.0.0.1:4173/) y seguí este recorrido.

1. Tocá **Usar ejemplo** y después **Continuar**.
2. Revisá la reposición de la remera y el alta del pantalón. Podés cambiar la foto, los talles y las cantidades.
3. Tocá **Confirmar ingreso**. Con los datos del ejemplo, el resumen muestra 2 productos y 18 unidades.
4. Entrá al **Catálogo** y elegí **Sucursal Centro**. La remera talle M pasa de 5 a 17 unidades en el primer ingreso.

Para probarla desde un Android, serví `index.html`, `styles.css`, `app.js`, `inventory.js`, `media.js`, `manifest.webmanifest`, `sw.js` y `assets/` juntos desde un sitio HTTPS. Abrí el enlace en Chrome y usá la opción de instalación del menú del navegador. Después de la primera carga, la app puede abrir sin conexión. **Compartir** abre el menú del dispositivo cuando está disponible. En otros navegadores abre opciones para enviar el texto por WhatsApp o descargar las fotos y copiar el texto para otras redes.

El ejemplo trae sugerencias simuladas. Con una foto o un video propio, se arma una ficha manual y se puede elegir un ajuste básico de luz y contraste. Las capturas se procesan en el dispositivo. El catálogo, el stock y los ingresos confirmados se guardan en el navegador donde se hizo la prueba. Los borradores duran lo que dura la sesión de la página.

## Sistema de diseño

[styles.css](styles.css) contiene la base compartida de la interfaz.

- **Color.** Violeta para la acción principal, gris lavanda para el fondo y blanco para las tarjetas. Verde y rojo indican éxito y error, acompañados por texto.
- **Tipografía.** DM Sans local, con texto base de 16 px y títulos que se ajustan al ancho de pantalla.
- **Componentes.** `.button` para las acciones, `.field` para los campos, `.card` para agrupar datos, `.notice` para mensajes y `.steps` para el progreso. Los controles de acción y los campos tienen un alto mínimo de 44 px.
- **Composición.** En el celular las tarjetas se apilan y los botones tienen etiquetas visibles. En escritorio, la navegación queda a la izquierda y el contenido de apoyo acompaña el formulario.

## Fotos del ejemplo

La foto se generó con imagegen y se guardó como [ejemplo.webp](assets/ejemplo.webp). [remera.webp](assets/remera.webp) y [pantalon.webp](assets/pantalon.webp) son recortes de esa imagen.

> Product-mockup, photorealistic editorial retail photography for an Argentine clothing shop app, wide 3:2. Overhead flat lay, one warm muted rose short sleeve crewneck cotton tshirt fully visible on LEFT half, one folded khaki beige casual chino pants fully visible on RIGHT half, over pale warm off-white linen. Each garment wholly within its own half and center separated by visible space, so each half can be cropped independently. Soft directional daylight with delicate fabric shadows. Minimal simple clean mercadería catalogue sample. No writing, no labels, no other objects.
