# Hoja de ruta

Cada fase termina con una revisión y **no se empieza la siguiente sin aprobación expresa**.

## Fase 0: Entorno, arquitectura y documentación ✅

- Inspección del entorno y de las herramientas disponibles.
- Arquitectura, servicios necesarios, costes y hoja de ruta.
- Archivos: `README.md`, `docs/architecture.md`, `docs/roadmap.md`, `docs/costs-and-services.md`, `.gitignore`, `.env.example`.

Arquitectura aprobada.

## Fase 1: Esqueleto e interfaz (sin IA real) ✅

Objetivo: una aplicación navegable en el móvil, con un chat que responde con el proveedor falso. El inicio de sesión llega en la Fase 2.

1. Crear el proyecto Next.js con TypeScript estricto, Tailwind y ESLint (`create-next-app`), y revisar la documentación de la versión instalada.
2. Pantallas mobile-first: inicio, catálogo de personajes, chat y cuenta (con datos de prueba).
3. Proveedor de IA falso (`mock`) detrás de la interfaz `AiProvider`, con streaming simulado.
4. Configuración de Vitest y primeras pruebas.

**Necesita del propietario:** nada externo. Se puede hacer sin cuentas.
**Terminado cuando:** `npm run lint`, `npm run build` y las pruebas pasan, y el chat funciona en local con el proveedor falso.

**Notas de la implementación:**

- En esta fase el historial de la conversación vive en el navegador y se envía en cada petición (validado y limitado en el servidor). En la Fase 2 se guardará en la base de datos y el cliente solo enviará el mensaje nuevo.
- Una dirección de personaje inexistente (`/chat/xyz`) muestra la página "no encontrado", pero con código HTTP 200 en lugar de 404, por el renderizado parcial de Next.js. Se revisará cuando los personajes vengan de la base de datos.

## Fase 2: Supabase, autenticación y datos ✅

1. Migraciones SQL: tablas, índices y **políticas RLS**.
2. Supabase Auth con enlace mágico, confirmación de 18+ y aceptación de términos.
3. Contenido editable en la base de datos, preparado para el panel de administración:
   - personajes (`characters`, con `seed.sql` para los 3 actuales);
   - textos de la web (`site_content`), con los textos actuales como valores por defecto;
   - planes, límites y ajustes de IA (`plans`, `app_settings`).
4. Rol de administrador (`profiles.role = 'admin'`) y políticas RLS: solo un administrador puede modificar el contenido editable.
5. Conversaciones y mensajes persistentes.
6. Pruebas de aislamiento con dos usuarios y de que un usuario normal no puede editar contenido.

**Necesita del propietario:** cuenta de Supabase y un proyecto creado (región de la UE).
**Terminado cuando:** dos usuarios distintos no pueden ver ni modificar nada del otro, y solo el administrador puede cambiar el contenido (comprobado con pruebas).

**Notas de la implementación:**

- Acceso con correo y contraseña, o con enlace por correo (sin contraseña). Tras el primer acceso, la bienvenida pide un nombre visible, la confirmación de 18+ y la aceptación de los términos.
- El historial ya no viaja desde el navegador: el servidor lo lee de la base de datos. Los mensajes los escribe solo el servidor; el usuario puede leer y borrar sus conversaciones.
- Ni siquiera un administrador puede leer las conversaciones de los usuarios.
- `supabase/tests/comprobar_seguridad.sql` verifica el aislamiento (perfiles, conversaciones, mensajes, rol y plan, contenido editable, visitantes sin sesión). Se ha probado contra PostgreSQL y contra el esquema de autenticación real de Supabase, y se ha comprobado que detecta fallos introducidos a propósito.
- Probado de extremo a extremo en un navegador móvil simulado, contra un Supabase local (PostgreSQL, servidor de autenticación y PostgREST): registro, bienvenida, chat guardado, historial al recargar, aislamiento entre dos usuarios, borrado de conversación, cierre de sesión, error de contraseña y bloqueo de redirecciones externas.
- Sin probar de extremo a extremo: el **enlace por correo**, porque necesita un servidor de correo. Se probará con el proyecto real de Supabase.
- Los textos legales son **borradores** que necesitan revisión profesional antes del lanzamiento.

## Fase 3: Panel de administración (sin código)

Objetivo: que el propietario pueda cambiar personajes, textos, límites y modelo de IA desde la propia web, con formularios, también desde el móvil.

1. Sección `/admin`, solo accesible para administradores (comprobado en el servidor en cada acción, no solo en la interfaz).
2. **Personajes:** crear, editar, ocultar o publicar; nombre, edad, descripción, intereses, personalidad, estilo, límites, nivel de iniciativa y avatar (subida de imagen). Incluye **"Probar personaje"**, un chat de prueba antes de publicar, e historial de versiones para deshacer cambios.
3. **Textos de la web:** editar títulos, descripciones, avisos y páginas legales, con vista previa.
4. **Límites y planes:** mensajes gratuitos al día, longitud máxima de mensaje, peticiones por minuto, tope global de gasto diario y planes.
5. **Modelo de IA:** elegir el modelo por defecto y, si se quiere, uno distinto por personaje o plan, de una lista cerrada de modelos válidos para evitar errores. Hasta la Fase 4 solo estará disponible el proveedor simulado.
6. Registro de cambios: quién cambió qué y cuándo.
7. Resumen: usuarios, mensajes del día y gasto estimado.

**No editable desde el panel, a propósito:**
- Las **claves API** y secretos: siguen en variables de entorno, por seguridad.
- Las **reglas de seguridad comunes** a todos los personajes (identificarse como IA, sin contenido sexual explícito, etc.), para que ningún cambio de contenido pueda saltárselas.

**Terminado cuando:** el propietario crea un personaje nuevo, cambia un texto y un límite desde el panel, y los cambios se ven en la web sin desplegar código.

## Fase 4: Motor de conversación con IA real (en curso)

1. Adaptador del proveedor real (Anthropic), con streaming y caché de prompts.
2. Constructor de prompts con reglas comunes y ficha del personaje.
3. Límites de consumo: anti-abuso, cuota diaria y freno global de gasto (leídos de los ajustes del panel).
4. Registro de tokens y coste por mensaje.
5. Conjunto de conversaciones de evaluación (identidad de IA, intentos de saltarse las reglas).

**Implementado (pendiente de probar con una clave real):**

- Proveedor de Anthropic con Claude Haiku 5.5 (`src/server/ai/anthropic.ts`): streaming, sin razonamiento y con esfuerzo bajo para respuestas rápidas y baratas, sin `temperature`/`top_p` (el modelo los rechaza), y corte de la conexión si el usuario cierra el chat. Los errores del proveedor se traducen a errores neutrales y nunca llegan al usuario con detalles internos.
- Límites de consumo (`src/server/quotas/` y migración `20261016160000_limites_de_consumo.sql`): peticiones por minuto, cuota diaria según el plan (contador atómico en la base de datos, probado con 40 peticiones simultáneas) y freno global de gasto. Registro de tokens y coste estimado por usuario y día.
- Probado con un servidor de Anthropic simulado: parámetros enviados, streaming, rechazos y todos los códigos de error. **No se ha probado con la API real** (necesita la clave del propietario).

**Pendiente en esta fase:** medir el coste real por mensaje con la clave, y el conjunto de conversaciones de evaluación.

**Necesita del propietario:** cuenta en el proveedor de IA, clave API y límite de gasto configurado en su consola.
**Terminado cuando:** conversación real en streaming, límites comprobados con pruebas y coste por mensaje medido (no estimado).

## Fase 5: Memoria e iniciativa

1. Extracción de recuerdos con modelo económico y salida JSON validada.
2. Filtro de datos sensibles (instrucciones + filtro determinista) con pruebas.
3. Resúmenes periódicos de la relación.
4. Temas pendientes y saludo con iniciativa controlada.
5. Pantalla "Cuenta → Memoria" para ver y borrar recuerdos.

**Terminado cuando:** el personaje recuerda y retoma temas entre sesiones, y no guarda datos sensibles en las pruebas de evaluación.

## Fase 6: Privacidad, despliegue y preparación comercial

1. Exportación y borrado de datos; trabajo programado de conservación limitada.
2. Cabeceras de seguridad, páginas legales (contenido a revisar por un profesional).
3. Despliegue en Vercel con dominio propio.
4. Integración de Stripe (suscripciones), **solo si se aprueba en ese momento**.
5. Observabilidad básica: errores y consumo diario.

**Necesita del propietario:** cuenta de Vercel (Pro si es comercial), dominio, textos legales y, para los pagos, cuenta de Stripe verificada.

## Fuera de alcance por ahora

- WhatsApp, Telegram y otras mensajerías.
- Mensajes enviados por el personaje sin que el usuario abra la app (push o correo).
- Voz, imágenes generadas y aplicaciones nativas.
