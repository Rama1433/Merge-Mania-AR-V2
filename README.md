# Merge Mania V3.0.1 — Tablero más grande + Analytics

Esta entrega conserva el motor y las reglas de Merge Mania V3 (basadas en V2.1 Fix Esferas). **No incluye** Merge Fever, ruleta, skins ni comodín.

## Cambios puntuales

- Interfaz móvil compacta: objetivo, monedas, poderes, barra de puntajes y estado ocupan menos alto. El tablero usa todo el espacio disponible, **sin cambiar la geometría de físicas 400×548**.
- Quitado el texto inferior «Apuntá y soltá» y el botón inferior «Reiniciar». Para reiniciar, tocá **Pausa → Empezar de nuevo** (o la tecla R en PC).
- Añadido Web Analytics para HTML estático de Vercel: `/_vercel/insights/script.js`. **Tenés que tener Web Analytics habilitado dentro del mismo proyecto de Vercel**; al estar publicado, puede empezar a registrar visitas (no se ven al abrir localmente).
- Nueva caché PWA V3.0.1 y preferencia de red para archivos HTML/CSS/JS para evitar mostrar versiones anteriores después de publicar.
- Conservados el récord (clave `merge_mania_best_v1`), monedas (`merge_mania_coins_v3`), inventario (`merge_mania_inventory_v3`) y preferencias de sonido.
- Se mantienen objetivos continuos, cuatro poderes, precios, fusiones, combos, efectos y físicas.

## Subida desde GitHub sin instalar Node.js

1. Abrí el repositorio de **Merge Mania**, no Sand Mania, en GitHub y asegurate de estar en `main`.
2. Descomprimí el ZIP y subí **su contenido** desde `Add file → Upload files`, reemplazando los archivos existentes del proyecto.
3. Confirmá el commit en la rama `main` y mirá en Vercel → el proyecto correcto → Deployments, para que la publicación sea `Ready · Production`.
4. Habilitá Web Analytics si todavía no está activo en el **proyecto correcto** de Vercel.
5. Si tenés instalada la PWA, cerrala y abrila nuevamente tras publicar (nueva versión del service worker).

No reemplaces el proyecto de Sand Mania ni el de Barber Manager.
