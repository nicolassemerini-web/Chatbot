# Hoja de ruta

Cada fase termina con una revisión y **no se empieza la siguiente sin aprobación expresa**.

## Fase 0: Entorno, arquitectura y documentación ✅ (esta fase)

- Inspección del entorno y de las herramientas disponibles.
- Arquitectura, servicios necesarios, costes y hoja de ruta.
- Archivos: `README.md`, `docs/architecture.md`, `docs/roadmap.md`, `docs/costs-and-services.md`, `.gitignore`, `.env.example`.

**Pendiente de decisión del propietario:** aceptar la arquitectura.

## Fase 1: Esqueleto e interfaz (sin IA real)

Objetivo: una aplicación navegable en el móvil, con inicio de sesión y un chat que responde con el proveedor falso.

1. Crear el proyecto Next.js con TypeScript estricto, Tailwind y ESLint (`create-next-app`), y revisar la documentación de la versión instalada.
2. Pantallas mobile-first: inicio, catálogo de personajes, chat y cuenta (con datos de prueba).
3. Proveedor de IA falso (`mock`) detrás de la interfaz `AiProvider`, con streaming simulado.
4. Configuración de Vitest y primeras pruebas.

**Necesita del propietario:** nada externo. Se puede hacer sin cuentas.
**Terminado cuando:** `npm run lint`, `npm run build` y las pruebas pasan, y el chat funciona en local con el proveedor falso.

## Fase 2: Supabase, autenticación y datos

1. Migraciones SQL: tablas, índices y **políticas RLS**.
2. Supabase Auth con enlace mágico, confirmación de 18+ y aceptación de términos.
3. Personajes cargados desde la base de datos (`seed.sql` con 2 o 3 personajes).
4. Conversaciones y mensajes persistentes.
5. Pruebas de aislamiento con dos usuarios.

**Necesita del propietario:** cuenta de Supabase y un proyecto creado (región de la UE).
**Terminado cuando:** dos usuarios distintos no pueden ver ni modificar nada del otro (comprobado con pruebas).

## Fase 3: Motor de conversación con IA real

1. Adaptador del proveedor real (Anthropic), con streaming y caché de prompts.
2. Constructor de prompts con reglas comunes y ficha del personaje.
3. Límites de consumo: anti-abuso, cuota diaria y freno global de gasto.
4. Registro de tokens y coste por mensaje.
5. Conjunto de conversaciones de evaluación (identidad de IA, intentos de saltarse las reglas).

**Necesita del propietario:** cuenta en el proveedor de IA, clave API y límite de gasto configurado en su consola.
**Terminado cuando:** conversación real en streaming, límites comprobados con pruebas y coste por mensaje medido (no estimado).

## Fase 4: Memoria e iniciativa

1. Extracción de recuerdos con modelo económico y salida JSON validada.
2. Filtro de datos sensibles (instrucciones + filtro determinista) con pruebas.
3. Resúmenes periódicos de la relación.
4. Temas pendientes y saludo con iniciativa controlada.
5. Pantalla "Cuenta → Memoria" para ver y borrar recuerdos.

**Terminado cuando:** el personaje recuerda y retoma temas entre sesiones, y no guarda datos sensibles en las pruebas de evaluación.

## Fase 5: Privacidad, despliegue y preparación comercial

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
- Panel de administración visual para crear personajes (al principio se crean con SQL).
