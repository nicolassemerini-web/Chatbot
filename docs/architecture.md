# Arquitectura

## 1. Visión general

Se propone un **monolito modular** sobre Next.js (App Router) desplegado en Vercel, con Supabase como base de datos y sistema de autenticación. Un monolito bien separado por módulos es la opción más sencilla y económica para un equipo pequeño, y cada módulo se puede extraer a un servicio independiente más adelante si hiciera falta.

```
Navegador (móvil)
   │  HTTPS: solo HTML/JS y la clave pública "anon" de Supabase
   ▼
Next.js en Vercel ─────────────────────────────────────────────────────────┐
│  1. Interfaz web           app/ (Server + Client Components)            │
│  2. Autenticación          server/auth      ──► Supabase Auth           │
│  3. Personajes             server/characters                            │
│  4. Motor de conversación  server/conversation                          │
│        │                                                                │
│        ├─► 6. Memoria      server/memory    ──► PostgreSQL (Supabase)   │
│        ├─► 7. Límites      server/quotas    ──► PostgreSQL (Supabase)   │
│        └─► 5. Proveedor IA server/ai        ──► API del proveedor (IA)  │
│  8. Suscripciones          server/billing   ──► Stripe (Fase 6)         │
│  9. Administración         server/admin     ──► PostgreSQL (Supabase)   │
└──────────────────────────────────────────────────────────────────────────┘
```

Toda la lógica de negocio vive en `src/server/` y solo se ejecuta en el servidor (se marca con `import "server-only"`). La interfaz llama a esa lógica mediante **Server Actions** o **Route Handlers**; nunca habla directamente con el proveedor de IA.

## 2. Decisiones tecnológicas

| Decisión | Elección | Motivo | Alternativa |
| --- | --- | --- | --- |
| Framework | Next.js con App Router y TypeScript estricto | Servidor y cliente en un único proyecto, streaming de respuestas, buen encaje con Vercel | Remix, SvelteKit |
| Estilos | Tailwind CSS | Diseño adaptado a móvil rápido y consistente, sin hojas de estilo dispersas | CSS Modules |
| Base de datos | Supabase (PostgreSQL) | RLS nativo para aislar usuarios, Auth incluido, capa gratuita para empezar | Neon + Auth.js |
| Autenticación | Supabase Auth: enlace mágico y contraseña | Sin gestión propia de contraseñas; se integra con RLS (`auth.uid()`) | Clerk, Auth.js |
| Validación | Zod | Un único esquema valida entradas en el servidor y tipa el código | Valibot |
| IA | Interfaz propia + adaptador de Anthropic | Se puede cambiar de proveedor sin tocar el motor | OpenAI, Google, Mistral |
| Límites de consumo | Contadores en PostgreSQL | Sin servicio adicional; suficiente para el volumen inicial | Upstash Redis si el volumen crece |
| Despliegue | Vercel | Integración directa con Next.js | Netlify, Railway, Fly.io |
| Pagos | Stripe (Fase 6) | Estándar del mercado, suscripciones y facturación | Lemon Squeezy, Paddle (actúan como vendedor y gestionan el IVA) |

> **Aviso sobre Next.js.** Las versiones recientes (16.x) incluyen cambios incompatibles con versiones anteriores; por ejemplo, el antiguo `middleware.ts` se llama ahora `proxy.ts`. Antes de escribir código se consultará la documentación incluida en `node_modules/next/dist/docs/` de la versión instalada.

## 3. Estructura de carpetas prevista

```
src/
  app/                         # 1. Interfaz web (rutas)
    (public)/                  #    inicio, legal, inicio de sesión
    (app)/                     #    zona autenticada
      personajes/              #    catálogo de personajes
      chat/[characterId]/      #    conversación
      cuenta/                  #    perfil, exportar y borrar datos, memoria
    admin/                     # 9. panel de administración (solo administradores)
    api/chat/route.ts          #    respuesta del personaje en streaming
  components/                  # componentes de interfaz reutilizables
  server/                      # lógica de negocio, SOLO servidor
    auth/                      # 2. sesión, usuario actual, comprobación de edad
    characters/                # 3. catálogo, carga de la ficha de personalidad
    conversation/              # 4. motor: orquesta prompt, IA, memoria y límites
      prompt-builder.ts        #    construye el contexto enviado al modelo
      engine.ts                #    flujo completo de un turno
      initiative.ts            #    reglas de iniciativa conversacional
      safety.ts                #    reglas comunes a todos los personajes
    ai/                        # 5. proveedor de IA
      types.ts                 #    interfaz AiProvider (neutral)
      anthropic.ts             #    adaptador de Anthropic
      mock.ts                  #    proveedor falso para desarrollo y pruebas
      index.ts                 #    selecciona el proveedor según AI_PROVIDER
    memory/                    # 6. extracción, filtrado, recuperación y caducidad
    quotas/                    # 7. límites de peticiones, mensajes y gasto
    billing/                   # 8. suscripciones (vacío hasta la Fase 6)
    admin/                     # 9. comprobación de rol, cambios de contenido y registro
    content/                   #    textos de la web y ajustes leídos de la base de datos
    privacy/                   #    exportación y borrado de datos
  lib/
    supabase/                  # clientes de Supabase (navegador, servidor, admin)
    validation/                # esquemas Zod compartidos
  proxy.ts                     # refresco de sesión (sustituye a middleware.ts)
supabase/
  migrations/                  # esquema SQL versionado, incluidas las políticas RLS
  seed.sql                     # personajes iniciales
tests/                         # pruebas unitarias y de integración
```

## 4. Módulos

### 4.1 Interfaz web

- Diseño **mobile-first**: una columna, área de escritura fija abajo, objetivos táctiles de 44 px como mínimo y soporte del teclado virtual (`dvh`).
- Las respuestas llegan en **streaming** (el texto aparece a medida que se genera).
- Un aviso visible, permanente y discreto, indica que el personaje es una IA ficticia.
- Sin lógica de negocio en el cliente: el navegador solo envía el texto y muestra la respuesta.
- Accesibilidad básica: contraste suficiente, etiquetas ARIA y tamaño de letra ajustable.

### 4.2 Autenticación

- Supabase Auth con **enlace mágico** por correo (sin contraseña que recordar) y, opcionalmente, contraseña.
- En el primer acceso: confirmación de **mayoría de edad (18+)** y aceptación de términos y privacidad, guardadas con fecha en `profiles`.
- `proxy.ts` refresca la sesión; **cada Server Action y Route Handler vuelve a comprobar el usuario** con `supabase.auth.getUser()`. No basta con que la ruta esté protegida en la interfaz.
- Inicio de sesión con Google y otros proveedores, opcional más adelante.

### 4.3 Gestión de personajes

Un personaje es **datos, no código**. Añadir un personaje nuevo consiste en rellenar un formulario en el panel de administración (4.9), sin desplegar nada.

Ficha de personaje (`characters`):

- `slug`, `name`, `avatar_url`, `short_bio` (visible en el catálogo).
- `persona`: rasgos de personalidad, historia de fondo ficticia, intereses, forma de hablar y muletillas, valores.
- `style_rules`: longitud típica de las respuestas, uso de emojis, nivel de formalidad.
- `boundaries`: temas que el personaje evita o redirige.
- `initiative_level`: con qué frecuencia propone temas (bajo, medio o alto).
- `prompt_version`: versión de la ficha, para poder comparar cambios.
- `is_active`: publicado u oculto.

El motor siempre añade unas **reglas comunes no negociables** (`conversation/safety.ts`) que ninguna ficha puede anular: identificarse como IA ficticia si se pregunta, no afirmar ser humana, no pedir datos sensibles, no fomentar el aislamiento ni la dependencia, y derivar a recursos de ayuda si el usuario expresa una crisis.

### 4.4 Motor de conversación

Flujo de un turno (`conversation/engine.ts`):

1. **Validar** la entrada con Zod: longitud máxima, texto no vacío, `characterId` válido.
2. **Autorizar**: usuario autenticado y con la confirmación de edad hecha; la conversación le pertenece.
3. **Comprobar límites** (módulo 7). Si se superan, se devuelve un mensaje amable sin llamar a la IA.
4. **Guardar** el mensaje del usuario.
5. **Construir el contexto** (`prompt-builder.ts`), de lo más estable a lo más variable para aprovechar la caché de prompts del proveedor:
   1. Reglas comunes de seguridad (fijas).
   2. Ficha del personaje (fija por personaje).
   3. Resumen acumulado de la relación con este usuario.
   4. Recuerdos relevantes (los N más importantes o recientes) y temas pendientes.
   5. Últimos mensajes de la conversación (ventana deslizante, por ejemplo los 20 últimos).
   6. Mensaje actual.
6. **Llamar al proveedor** de IA en streaming, con tiempo máximo de espera y reintentos limitados.
7. **Guardar** la respuesta y **registrar el consumo** (tokens de entrada y salida, coste estimado).
8. **Tras responder** (sin hacer esperar al usuario): extraer recuerdos nuevos y, cada cierto número de mensajes, actualizar el resumen. Ambas tareas usan un modelo económico.

**Iniciativa conversacional controlada** (`conversation/initiative.ts`):

- El personaje **no envía mensajes por su cuenta** en esta etapa: no hay notificaciones push, correos ni mensajes programados.
- La iniciativa ocurre **solo cuando el usuario abre o continúa una conversación**: al volver tras una pausa, el personaje puede saludar recordando un tema pendiente ("¿qué tal fue la entrevista?").
- Reglas: como máximo un tema pendiente por saludo, solo si tiene una antigüedad razonable, no repetir el mismo tema dos veces seguidas, y marcarlo como "retomado" o "cerrado" según la respuesta.
- La frecuencia depende de `initiative_level` y el usuario puede desactivarla en sus ajustes.

### 4.5 Proveedor de IA

El resto de la aplicación solo conoce esta interfaz (simplificada):

```ts
interface AiProvider {
  streamChat(input: ChatRequest): AsyncIterable<ChatChunk>; // respuesta del personaje
  extractJson<T>(input: JsonRequest<T>): Promise<T>;        // recuerdos, resúmenes
}

type ChatRequest = {
  system: string[];            // bloques estables (reglas, ficha, resumen, recuerdos)
  messages: { role: "user" | "assistant"; content: string }[];
  model: string;
  maxOutputTokens: number;
};
// ChatChunk incluye el texto parcial y, al final, el uso de tokens y el motivo de parada.
```

- **Adaptadores**: `anthropic.ts` (primero) y `mock.ts` (desarrollo y pruebas sin coste). Añadir otro proveedor consiste en crear un archivo más e implementar la misma interfaz.
- Los nombres de modelo se configuran con variables de entorno (`AI_CHAT_MODEL`, `AI_UTILITY_MODEL`).
- El adaptador traduce errores propios del proveedor (límite de peticiones, sobrecarga, rechazo de contenido) a errores neutrales (`AiRateLimited`, `AiUnavailable`, `AiRefused`) que el motor sabe tratar.
- Las claves del proveedor solo se leen en el servidor.

**Proveedor recomendado: Anthropic (Claude)**, por la calidad de la conversación en español, la coherencia de personaje y la caché de prompts, que abarata mucho repetir la ficha y las reglas en cada mensaje. Modelo de chat sugerido: Claude Sonnet 5.5; modelo para tareas internas: Claude Haiku 5.5 (ver costes). **Importante:** cada proveedor tiene su propia política de uso. Antes de lanzar hay que revisar que el tipo de relación y de contenido previstos (personajes de compañía, tono romántico, prohibición de contenido sexual explícito, solo adultos) cumple la política del proveedor elegido.

### 4.6 Memoria persistente

La memoria **no depende del historial enviado al modelo**: se guarda en tablas propias y el motor selecciona qué incluir en cada turno.

Tres niveles:

| Nivel | Tabla | Contenido | Vida |
| --- | --- | --- | --- |
| Mensajes | `messages` | Texto completo de la conversación | Caducan según `RETENTION_MESSAGES_DAYS` |
| Recuerdos | `memories` | Hechos breves y estructurados: "le gusta el senderismo", "tiene un gato llamado Miso" | Hasta que el usuario los borre o caduquen |
| Resumen | `conversation_summaries` | Resumen narrativo de la relación, actualizado periódicamente | Se reescribe, no se acumula |

Tipos de recuerdo (`memories.kind`): `preference`, `fact`, `event` (con fecha), `pending_topic` (tema por retomar, con estado `open`, `followed_up` o `closed`) y `relationship` (bromas internas, apodos).

**Extracción**: tras cada respuesta (o cada pocos mensajes), un modelo económico recibe los últimos mensajes y los recuerdos existentes y devuelve en JSON validado con Zod los recuerdos que hay que añadir, actualizar o cerrar.

**Filtro de datos sensibles** (obligatorio, en dos capas):

1. Las instrucciones de extracción prohíben guardar categorías especiales: salud, orientación sexual, religión, ideología, datos biométricos, situación legal, datos económicos detallados, documentos de identidad, direcciones exactas, teléfonos, contraseñas o datos de terceros identificables.
2. Un filtro determinista en el servidor (expresiones regulares para correos, teléfonos, IBAN, tarjetas o DNI) descarta los recuerdos que se cuelen.

**Recuperación** (MVP): los recuerdos se ordenan por importancia y uso reciente, más los temas pendientes abiertos, con un límite de tokens. Más adelante, si el volumen lo justifica, se añadirá búsqueda semántica con `pgvector` (requiere un servicio de *embeddings*; Anthropic no lo ofrece directamente y habría que usar otro, por ejemplo Voyage AI u OpenAI).

**Control del usuario**: en "Cuenta → Memoria" el usuario ve lo que cada personaje recuerda de él y puede borrar recuerdos sueltos o toda la memoria de un personaje.

### 4.7 Límites de consumo

Tres capas, todas comprobadas en el servidor antes de llamar a la IA:

1. **Anti-abuso**: X peticiones por minuto y usuario (`LIMIT_CHAT_REQUESTS_PER_MINUTE`), longitud máxima del mensaje, y una única respuesta en curso por conversación.
2. **Cuota del plan**: mensajes por día según el plan (`free` por ahora). Se cuentan en `usage_counters` con una actualización atómica en PostgreSQL.
3. **Freno global de gasto**: si el coste estimado del día supera `LIMIT_GLOBAL_AI_DAILY_BUDGET_CENTS`, se pausan las respuestas de IA para todos. Protege frente a un ataque o un error que dispare la factura.

Además se fija un `max_tokens` por respuesta y se limita el tamaño del contexto, de modo que el coste máximo por mensaje queda acotado. Conviene configurar también un **límite de gasto mensual en la consola del proveedor de IA** como última barrera.

### 4.8 Futuras suscripciones

Se diseñan ahora, pero no se implementan:

- `profiles.plan` (`free` por defecto) es la única fuente que consultan los límites. Las cuotas por plan están en una tabla `plans`, no en el código.
- En la Fase 6, un webhook de Stripe actualizará `subscriptions` y `profiles.plan`. El resto de la aplicación no cambia.
- No se guardan datos de tarjeta: Stripe los gestiona por completo.

### 4.9 Panel de administración

Objetivo: que el propietario cambie el contenido y la configuración **sin tocar código**, desde una sección `/admin` de la propia web.

| Sección | Qué se puede cambiar |
| --- | --- |
| Personajes | Crear, editar, ocultar o publicar; ficha completa (4.3), avatar (Supabase Storage) y modelo de IA propio opcional. Chat de prueba antes de publicar e historial de versiones |
| Textos de la web | Títulos, descripciones, avisos y páginas legales (tabla `site_content`), con vista previa |
| Límites y planes | Cuotas por plan, longitud máxima de mensaje, peticiones por minuto, tope global de gasto (tablas `plans` y `app_settings`) |
| Modelo de IA | Modelo por defecto, por plan o por personaje, elegido de una lista cerrada de modelos válidos |
| Resumen | Usuarios, mensajes del día y gasto estimado |

Funcionamiento:

- **Acceso:** solo usuarios con `profiles.role = 'admin'`. El primer administrador se asigna una sola vez desde el panel de Supabase; después todo se hace desde `/admin`.
- **Doble protección:** cada Server Action del panel comprueba el rol en el servidor, y además las políticas RLS impiden que un usuario no administrador modifique esas tablas aunque llame a la base de datos directamente.
- **Validación:** todos los formularios se validan con Zod en el servidor (longitudes, valores permitidos, modelos de la lista cerrada).
- **Efecto inmediato:** al guardar se invalida la caché de las páginas afectadas, sin redesplegar.
- **Trazabilidad:** cada cambio se guarda en `admin_audit_log` (quién, qué, cuándo, valor anterior) y los personajes guardan versiones para poder deshacer.
- **Valores por defecto:** si la base de datos no tiene un texto o ajuste, se usa el valor por defecto del código, para que la web nunca se quede en blanco.

Quedan **fuera del panel a propósito**:

- Las claves API y demás secretos, que siguen en variables de entorno.
- Las reglas de seguridad comunes (4.3), para que ningún cambio de contenido pueda desactivarlas.

## 5. Modelo de datos (borrador)

| Tabla | Campos principales | Acceso del usuario (RLS) |
| --- | --- | --- |
| `profiles` | `id` (= `auth.users.id`), `display_name`, `birth_year_confirmed_adult_at`, `terms_accepted_at`, `plan`, `role` (`user` o `admin`), `initiative_enabled`, `created_at` | Leer y editar solo la propia fila (excepto `plan` y `role`) |
| `characters` | ficha descrita en 4.3, más `model` (opcional) y `avatar_url` | Leer los activos; solo los administradores escriben |
| `character_versions` | `character_id`, `version`, `data` (ficha completa), `created_by`, `created_at` | Solo administradores |
| `conversations` | `id`, `user_id`, `character_id`, `last_message_at` | Solo las propias |
| `messages` | `id`, `conversation_id`, `user_id`, `role`, `content`, `tokens_in`, `tokens_out`, `created_at` | Leer las propias; la escritura la hace el servidor |
| `memories` | `id`, `user_id`, `character_id`, `kind`, `content`, `importance`, `status`, `due_at`, `expires_at`, `source_message_id` | Leer y borrar las propias |
| `conversation_summaries` | `conversation_id`, `user_id`, `summary`, `updated_at` | Leer las propias |
| `usage_counters` | `user_id`, `day`, `messages`, `tokens_in`, `tokens_out`, `cost_micros` | Leer los propios |
| `plans` | `id`, `name`, `daily_messages`, `max_output_tokens`, `model` | Leer todos; solo los administradores escriben |
| `site_content` | `key`, `value`, `updated_at`, `updated_by` | Leer todos; solo los administradores escriben |
| `app_settings` | `key`, `value` (JSON), `updated_at`, `updated_by` | Solo el servidor y los administradores |
| `admin_audit_log` | `id`, `admin_id`, `entity`, `entity_id`, `before`, `after`, `created_at` | Solo administradores (lectura); lo escribe el servidor |
| `subscriptions` | (Fase 6) | Leer las propias |

Notas:

- Todas las tablas con datos de usuario llevan `user_id` (aunque esté implícito por la conversación) para que las políticas RLS sean simples, rápidas e imposibles de saltar por error.
- Claves foráneas con `on delete cascade` hacia `auth.users`: al borrar la cuenta desaparece todo.
- Índices en `(user_id, character_id)` y `(conversation_id, created_at)`.

## 6. Seguridad

| Riesgo | Medida |
| --- | --- |
| Un usuario lee datos de otro | **RLS activado en todas las tablas**, con políticas `user_id = auth.uid()`; pruebas automáticas que lo verifican con dos usuarios |
| Un usuario normal intenta usar el panel | Rol comprobado en el servidor en cada acción de `/admin` y políticas RLS que solo permiten escribir contenido a administradores; pruebas automáticas que lo verifican |
| Escrituras manipuladas desde el navegador | Los mensajes, el consumo y el plan solo los escribe el servidor; las políticas no permiten `insert` ni `update` directos en esas columnas |
| Fuga de claves | Claves privadas solo en variables de entorno del servidor, sin `NEXT_PUBLIC_`; `import "server-only"` en los módulos sensibles; `.env*` en `.gitignore` |
| Uso indebido de `service_role` | Un único cliente "admin", usado solo en borrado de cuentas y tareas programadas, nunca en el flujo normal del chat |
| Entradas maliciosas | Validación con Zod en cada Server Action o ruta; límite de longitud; el texto se muestra escapado (sin `dangerouslySetInnerHTML`) |
| Manipulación del personaje (*prompt injection*) | Reglas de seguridad en el bloque de sistema, separadas del texto del usuario; los recuerdos extraídos se tratan como datos y pasan por el filtro antes de guardarse |
| Abuso y facturas disparadas | Límites del apartado 4.7, freno global de gasto y límite en la consola del proveedor |
| Errores | Mensajes genéricos al usuario; detalle solo en los registros del servidor, sin contenido de las conversaciones ni datos personales |
| Sesiones | Cookies `httpOnly` y `secure` gestionadas por `@supabase/ssr`; protección CSRF propia de las Server Actions |
| Cabeceras | CSP, `X-Content-Type-Options`, `Referrer-Policy` y `frame-ancestors 'none'` |

## 7. Privacidad y normativa

- **Minimización**: no se pide el nombre real ni la fecha de nacimiento completa (basta con la confirmación de 18+), y la memoria tiene el filtro de datos sensibles.
- **Exportar datos** (RGPD, art. 20): "Cuenta → Exportar" genera un JSON con el perfil, las conversaciones, los recuerdos y los resúmenes del usuario.
- **Borrar datos** (RGPD, art. 17): borrar una conversación, la memoria de un personaje o la cuenta completa (borrado en cascada, irreversible y con confirmación).
- **Conservación limitada**: un trabajo programado (Supabase Cron / `pg_cron`) borra los mensajes más antiguos que `RETENTION_MESSAGES_DAYS` y los recuerdos caducados. Las cuentas inactivas durante mucho tiempo se avisan y después se eliminan.
- **Transparencia sobre la IA**: el Reglamento europeo de IA obliga a informar de que se está hablando con una IA. Se cumple con el aviso permanente y con el comportamiento del personaje.
- **Encargados del tratamiento**: Supabase, Vercel y el proveedor de IA tratan datos personales. Hay que aceptar sus acuerdos de tratamiento de datos (DPA), elegir regiones de la UE cuando sea posible y revisar la política de conservación de datos del proveedor de IA.
- **Bienestar del usuario**: no se usan técnicas que fomenten la dependencia (mensajes de culpa, presión para volver); se ofrecen recursos de ayuda ante señales de crisis.
- Antes de abrir al público hacen falta una política de privacidad, términos de uso y, probablemente, una **revisión legal**. No forma parte del desarrollo, pero condiciona el lanzamiento.

## 8. Pruebas y calidad

- **Unitarias** (Vitest): constructor de prompts, filtro de datos sensibles, reglas de iniciativa, cálculo de límites.
- **Integración**: políticas RLS contra una base de datos de prueba con dos usuarios.
- **Proveedor falso** (`AI_PROVIDER=mock`): permite probar el flujo completo sin clave ni coste.
- **Evaluación de personajes**: un conjunto de conversaciones de prueba ("¿eres humana?", intentos de saltarse las reglas, peticiones de datos sensibles) que se repite cada vez que cambia una ficha o el modelo.
- Lint y comprobación de tipos en cada cambio; CI en GitHub Actions más adelante.

## 9. Decisiones abiertas

| Tema | Opciones | Recomendación |
| --- | --- | --- |
| Proveedor de IA | Anthropic, OpenAI, Google, Mistral | **Anthropic**, con el adaptador falso para desarrollar sin coste |
| Método de acceso | Enlace mágico, contraseña, Google | **Enlace mágico** para empezar; Google más adelante |
| Búsqueda semántica en la memoria | Sin *embeddings* o con `pgvector` | **Sin *embeddings*** en el MVP |
| Pagos | Stripe, o un vendedor registrado (Paddle, Lemon Squeezy) que gestiona el IVA | Decidir en la Fase 6 según la situación fiscal |
| Idioma | Solo español o multiidioma | **Español** en el MVP, con los textos centralizados para traducir después |
