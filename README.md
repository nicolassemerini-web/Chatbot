# Plataforma de compañía virtual con IA

Plataforma web, pensada sobre todo para móviles, donde los usuarios conversan con **personajes ficticios** impulsados por inteligencia artificial. Cada personaje tiene una personalidad propia y coherente, recuerda la información relevante de cada usuario y puede retomar temas pendientes.

> **Estado actual: Fase 2, cuentas y base de datos.** Hay registro e inicio de sesión, bienvenida con confirmación de mayoría de edad y conversaciones guardadas en Supabase, aisladas por usuario. Las respuestas siguen siendo **simuladas**: la IA real llega en la Fase 4.

## Principios del producto

- **Los personajes son ficticios.** Se identifican siempre como personajes de IA y nunca afirman ser personas reales, ni siquiera si el usuario insiste.
- **Multiusuario desde el primer día.** Cada conversación y cada recuerdo pertenecen a un único usuario, con aislamiento a nivel de base de datos (RLS).
- **Memoria persistente y mínima.** Se guarda lo útil para la conversación (gustos, temas pendientes, hechos cotidianos), no datos sensibles.
- **IA solo en el servidor.** Las claves privadas no llegan nunca al navegador.
- **Proveedor de IA intercambiable.** Toda la lógica habla con una interfaz propia, no directamente con un proveedor concreto.
- **Solo para mayores de edad.** El acceso requiere declarar que se tiene 18 años o más.

## Tecnologías previstas

| Capa | Tecnología | Estado |
| --- | --- | --- |
| Interfaz y servidor | Next.js (App Router), React, TypeScript estricto | ✅ Fase 1 |
| Estilos | Tailwind CSS | ✅ Fase 1 |
| Validación | Zod | ✅ Fase 1 |
| Base de datos | Supabase (PostgreSQL) con RLS | ✅ Fase 2 |
| Autenticación | Supabase Auth (enlace por correo o contraseña) | ✅ Fase 2 |
| Panel de administración | Sección `/admin` para gestionar personajes, textos, límites y modelo de IA sin código | Fase 3 |
| IA | Adaptador propio; primer proveedor recomendado: Anthropic (Claude) | Fase 4 |
| Alojamiento | Vercel (plan Pro si es uso comercial) | Fase 6 |
| Pagos | Stripe | **Pospuesto** (Fase 6) |
| Mensajería (WhatsApp, Telegram) | — | **Fuera de alcance** |

## Documentación

- [docs/architecture.md](docs/architecture.md): arquitectura, módulos, modelo de datos, seguridad y privacidad.
- [docs/roadmap.md](docs/roadmap.md): fases de desarrollo y criterios de finalización.
- [docs/costs-and-services.md](docs/costs-and-services.md): servicios externos, cuentas necesarias y costes previsibles.
- [.env.example](.env.example): variables de entorno previstas (sin valores reales).

## Requisitos de desarrollo

- Node.js 20 o superior (se recomienda la versión LTS actual)
- npm 10 o superior
- Git

```bash
node --version
npm --version
git --version
```

Además hace falta un proyecto de **Supabase** (el plan gratuito sirve). Los pasos están en la sección siguiente.

## Configurar Supabase (una sola vez)

Todo se hace desde el panel web de [supabase.com](https://supabase.com), sin instalar nada.

1. **Crea el proyecto:** New project → elige un nombre, una contraseña de base de datos (guárdala en un gestor de contraseñas) y una **región de la UE**.
2. **Crea las tablas:** en el menú lateral, abre **SQL Editor** → New query. Pega el contenido completo de cada uno de estos archivos, **en este orden**, y pulsa **Run** después de cada uno:
   1. `supabase/migrations/20261016130000_esquema_inicial.sql`
   2. `supabase/migrations/20261016130100_contenido_inicial.sql`
   3. `supabase/migrations/20261016143000_is_admin_privado.sql`
   4. `supabase/migrations/20261016150000_lucia_perfil_detallado.sql`

   Deberías ver "Success. No rows returned".
3. **Comprueba la seguridad (opcional, recomendado):** en una consulta nueva pega `supabase/tests/comprobar_seguridad.sql` y pulsa **Run**. Si ves "Success", todas las comprobaciones de aislamiento entre usuarios han pasado; si algo falla, verás un error que empieza por `FALLO:`. No deja datos: lo deshace todo al terminar.
4. **Configura las direcciones de acceso:** Authentication → URL Configuration:
   - **Site URL:** `http://localhost:3000`
   - **Redirect URLs:** añade `http://localhost:3000/**`
5. **Copia las claves:** Project Settings → API Keys. Crea en la carpeta del proyecto un archivo `.env.local` (copiando `.env.example`) y rellena:
   - `NEXT_PUBLIC_SUPABASE_URL`: la Project URL (botón **Connect** o Project Settings → Data API).
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: la *Publishable key* (`sb_publishable_…`).
   - `SUPABASE_SECRET_KEY`: la *Secret key* (`sb_secret_…`). **Es privada**: no la compartas ni la pegues en ningún chat.

   **`.env.local` no se sube nunca al repositorio.** Las variables sin el prefijo `NEXT_PUBLIC_` solo existen en el servidor.
6. **Reinicia** `npm run dev` para que lea las variables.

**Sobre los correos:** el correo que incluye Supabase de serie solo envía unos pocos mensajes por hora y, en proyectos nuevos, solo a las direcciones de los miembros de tu organización de Supabase. Para pruebas basta: crea tu cuenta con **tu propio correo**. Para usuarios reales hará falta un proveedor de correo propio (Fase 6). Si quieres probar sin confirmar el correo, puedes desactivar temporalmente *Authentication → Sign In / Providers → Email → Confirm email*.

Sin Supabase configurado, la web funciona en **modo demostración**: se ven el inicio y los personajes, pero no hay cuentas ni chat.

## Ejecutar en local

```bash
npm install
npm run dev      # http://localhost:3000
```

Para verlo como en un móvil, abre las herramientas de desarrollo del navegador y activa la vista de dispositivo, o entra desde el móvil a la IP de tu ordenador en la misma red.

## Comandos

```bash
npm run dev        # servidor de desarrollo
npm run build      # compilación de producción
npm run start      # servidor de producción (tras compilar)
npm run lint       # ESLint
npm run typecheck  # comprobación de tipos de TypeScript
npm test           # pruebas unitarias y de integración (Vitest)
npm run test:db    # migraciones + comprobación de seguridad contra un PostgreSQL local
                   # (necesita psql y TEST_DATABASE_URL; ver scripts/test-db.sh)
```

## Estructura

```
src/
  app/
    page.tsx                 # inicio
    personajes/page.tsx      # catálogo de personajes
    chat/[slug]/             # conversación (página + ChatWindow, componente de cliente)
    cuenta/                  # datos de la cuenta y cerrar sesión
    entrar/                  # entrar, crear cuenta o recibir enlace por correo
    bienvenida/              # nombre visible, 18+ y aceptación de términos
    auth/callback/           # destino de los enlaces de los correos de Supabase
    legal/                   # términos y privacidad (borradores editables)
    api/chat/route.ts        # POST: autoriza, valida, responde en streaming y guarda
  components/                # cabecera, avatar, aviso de IA, página legal
  lib/
    supabase/                # clientes de Supabase (sesión, público) y variables
    validation/              # esquemas Zod y límites compartidos
  proxy.ts                   # refresca la sesión de Supabase en cada petición
  server/                    # lógica de negocio, solo servidor
    ai/                      # interfaz AiProvider, proveedor simulado y selector
    auth/                    # usuario actual, perfil y exigencias de acceso
    characters/              # personajes desde la base de datos (con caché)
    content/                 # textos editables de la web y sus valores por defecto
    conversation/            # reglas, prompt, motor, historial y almacenamiento
    db/admin.ts              # cliente con clave secreta (solo servidor)
supabase/
  migrations/                # esquema SQL, políticas RLS y contenido inicial
  tests/                     # comprobación de seguridad (se puede pegar en SQL Editor)
tests/                       # pruebas con Vitest y utilidades para la base de datos
docs/                        # arquitectura, hoja de ruta y costes
```
