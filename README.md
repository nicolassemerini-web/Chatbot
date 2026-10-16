# Plataforma de compañía virtual con IA

Plataforma web, pensada sobre todo para móviles, donde los usuarios conversan con **personajes ficticios** impulsados por inteligencia artificial. Cada personaje tiene una personalidad propia y coherente, recuerda la información relevante de cada usuario y puede retomar temas pendientes.

> **Estado actual: Fase 0, documentación y arquitectura.** Todavía no hay código de aplicación. Esta carpeta contiene solo la propuesta técnica, la hoja de ruta y la estimación de costes.

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
| Interfaz y servidor | Next.js (App Router), React, TypeScript estricto | Fase 1 |
| Estilos | Tailwind CSS | Fase 1 |
| Base de datos | Supabase (PostgreSQL) con RLS | Fase 1 |
| Autenticación | Supabase Auth (enlace mágico por correo y/o contraseña) | Fase 1 |
| Validación | Zod | Fase 1 |
| IA | Adaptador propio; primer proveedor recomendado: Anthropic (Claude) | Fase 2 |
| Alojamiento | Vercel (plan Pro si es uso comercial) | Fase 3 |
| Pagos | Stripe | **Pospuesto** (Fase 5) |
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

## Comandos

Se añadirán en la Fase 1, cuando exista el proyecto de Next.js.
