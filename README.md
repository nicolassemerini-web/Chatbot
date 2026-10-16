# Plataforma de compañía virtual con IA

Plataforma web, pensada sobre todo para móviles, donde los usuarios conversan con **personajes ficticios** impulsados por inteligencia artificial. Cada personaje tiene una personalidad propia y coherente, recuerda la información relevante de cada usuario y puede retomar temas pendientes.

> **Estado actual: Fase 1, esqueleto e interfaz.** La aplicación funciona en local con un proveedor de IA **simulado**: sin cuentas, sin claves y sin coste. Todavía no hay inicio de sesión, base de datos ni IA real (Fases 2 y 4).

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
| Base de datos | Supabase (PostgreSQL) con RLS | Fase 2 |
| Autenticación | Supabase Auth (enlace mágico por correo y/o contraseña) | Fase 2 |
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

Opcionales:

- **Supabase CLI** (`npx supabase ...`): para aplicar migraciones desde la terminal. No hace falta instalarla de forma global.
- **Docker**: solo si se quiere ejecutar Supabase en local (`npx supabase start`). No es obligatorio, se puede trabajar contra un proyecto en la nube.

## Variables de entorno

Copia `.env.example` como `.env.local` y rellena los valores. **`.env.local` no se sube nunca al repositorio.** Las variables sin el prefijo `NEXT_PUBLIC_` solo existen en el servidor; las claves privadas (IA, `service_role` de Supabase) no deben llevar ese prefijo jamás.

## Ejecutar en local

```bash
npm install
npm run dev      # http://localhost:3000
```

No hace falta crear `.env.local` todavía: por defecto se usa el proveedor simulado (`AI_PROVIDER=mock`). Para verlo como en un móvil, abre las herramientas de desarrollo del navegador y activa la vista de dispositivo, o entra desde el móvil a la IP de tu ordenador en la misma red.

## Comandos

```bash
npm run dev        # servidor de desarrollo
npm run build      # compilación de producción
npm run start      # servidor de producción (tras compilar)
npm run lint       # ESLint
npm run typecheck  # comprobación de tipos de TypeScript
npm test           # pruebas unitarias y de integración (Vitest)
```

## Estructura

```
src/
  app/
    page.tsx                 # inicio
    personajes/page.tsx      # catálogo de personajes
    chat/[slug]/             # conversación (página + ChatWindow, componente de cliente)
    cuenta/page.tsx          # cuenta (secciones previstas, todavía inactivas)
    api/chat/route.ts        # POST: valida y devuelve la respuesta en streaming
  components/                # cabecera, avatar, aviso de IA
  lib/validation/            # esquemas Zod y límites compartidos
  server/                    # lógica de negocio, solo servidor
    ai/                      # interfaz AiProvider, proveedor simulado y selector
    characters/              # catálogo provisional de personajes
    conversation/            # reglas de seguridad, constructor del prompt y motor
tests/                       # pruebas con Vitest
docs/                        # arquitectura, hoja de ruta y costes
```
