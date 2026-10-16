# Servicios externos y costes

> **Aviso sobre los precios.** Los precios de la IA de Anthropic son los publicados para su API en octubre de 2026. El resto son **aproximados**, según la información disponible al redactar este documento, y deben comprobarse en la web de cada proveedor antes de contratar. Los precios en dólares (USD) se facturan en esa moneda. Los costes de IA por mensaje son **estimaciones**: se medirán con datos reales en la Fase 3.

## 1. Servicios y cuándo hacen falta

| Servicio | Para qué | Cuándo | ¿Puede esperar? |
| --- | --- | --- | --- |
| **GitHub** | Repositorio del código | Ya disponible | — |
| **Supabase** | Base de datos, autenticación, tareas programadas | Fase 2 | Sí, la Fase 1 no lo necesita |
| **Proveedor de IA** (Anthropic recomendado) | Respuestas de los personajes y memoria | Fase 3 | Sí, hasta la Fase 3 se usa el proveedor falso |
| **Vercel** | Alojamiento | Fase 5 (o antes para enseñar demos) | Sí, se desarrolla en local |
| **Dominio** | Dirección web propia | Fase 5 | Sí |
| **Correo transaccional** (Resend u otro SMTP) | Enlaces mágicos de inicio de sesión en producción | Fase 5 | Sí, en desarrollo basta el correo incluido en Supabase |
| **Stripe** | Suscripciones | Fase 5, solo si se aprueba | **Sí, no se integra todavía** |
| Asesoría legal | Privacidad, términos, IA y RGPD | Antes del lanzamiento público | Sí, pero no se debe lanzar sin ella |
| Upstash Redis | Límites de peticiones a gran escala | Solo si PostgreSQL se queda corto | Sí, probablemente no haga falta |
| Servicio de *embeddings* | Búsqueda semántica en la memoria | Solo si se necesita | Sí, no está en el MVP |

## 2. Inteligencia artificial

### Precios de Anthropic (USD por millón de tokens)

| Modelo | Identificador | Entrada | Salida | Lectura de caché | Uso propuesto |
| --- | --- | --- | --- | --- | --- |
| Claude Opus 5.5 | `claude-opus-5-5` | 4,00 $ | 20,00 $ | 0,20 $ | Máxima calidad; probablemente innecesario para el chat |
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | 2,00 $ | 10,00 $ | 0,20 $ | **Chat de los personajes (recomendado)** |
| Claude Haiku 5.5 | `claude-haiku-5-5` | 0,10 $ | 0,50 $ | — | **Extracción de recuerdos y resúmenes**; alternativa económica para el chat |

Un token equivale aproximadamente a tres cuartos de una palabra. El precio de Haiku 5.5 es para prompts de hasta 100.000 tokens, muy por encima de lo que usará esta aplicación. La caché de prompts cobra la parte repetida del contexto (reglas y ficha del personaje) a una fracción del precio normal. El razonamiento interno del modelo se factura como tokens de salida, por lo que para el chat se usará un nivel de esfuerzo bajo.

### Estimación por mensaje

Supuestos para un turno de chat: 2.500 tokens estables en caché (reglas y ficha), unos 3.900 tokens variables (resumen, recuerdos, últimos 20 mensajes y el mensaje nuevo) y unos 350 tokens de salida (respuesta más razonamiento breve).

| Modelo de chat | Coste aproximado por mensaje |
| --- | --- |
| Opus 5.5 | ~0,023 $ |
| **Sonnet 5.5** | **~0,012 $** (puede bajar a ~0,006 $ si también se cachea el historial) |
| Haiku 5.5 | ~0,0008 $ |

La extracción de recuerdos con Haiku 5.5 añade unos 0,0003 $ por mensaje, una cantidad despreciable.

### Estimación por usuario y mes

| Perfil | Mensajes al mes | Con Sonnet 5.5 | Con Haiku 5.5 |
| --- | --- | --- | --- |
| Ocasional | 100 | ~1,2 $ | ~0,1 $ |
| Habitual | 300 | ~3,6 $ | ~0,25 $ |
| Intensivo | 1.500 | ~18 $ | ~1,2 $ |

**Conclusiones:**

- La IA es el **único coste que crece con el uso**, así que los límites de consumo son imprescindibles desde el principio.
- Un plan gratuito generoso con Sonnet 5.5 es caro. Opciones: limitar los mensajes diarios gratuitos, usar Haiku 5.5 en el plan gratuito y Sonnet 5.5 en el de pago, o ambas cosas. Se decidirá con mediciones reales en la Fase 3.
- El precio de una futura suscripción tendrá que cubrir el perfil intensivo con margen, más la comisión de Stripe y el IVA.

## 3. Infraestructura (precios aproximados)

| Servicio | Plan gratuito | Plan de pago | Observaciones |
| --- | --- | --- | --- |
| Supabase | 0 $: 500 MB de base de datos, autenticación incluida | Pro: ~25 $/mes | El plan gratuito **pausa el proyecto tras una semana sin actividad**: válido para desarrollo, no para producción |
| Vercel | Hobby: 0 $ | Pro: ~20 $/mes por miembro | **Hobby no permite uso comercial**: para lanzar el producto hace falta Pro |
| Correo (Resend) | ~3.000 correos al mes | ~20 $/mes | El correo incluido en Supabase tiene un límite muy bajo y no sirve en producción |
| Dominio | — | ~10-20 €/año | |
| Stripe | Sin cuota fija | Comisión por cobro (en Europa, aproximadamente 1,5 % + 0,25 € por tarjeta, más un pequeño porcentaje adicional por Billing) | Solo en la Fase 5 |
| GitHub | 0 $ | — | Suficiente |

## 4. Escenarios de coste mensual

| Escenario | Infraestructura | IA | Total aproximado |
| --- | --- | --- | --- |
| Desarrollo (Fases 1-2) | 0 $ (planes gratuitos) | 0 $ (proveedor falso) | **0 $** |
| Desarrollo con IA real (Fases 3-4) | 0 $ | 5-20 $ en pruebas | **5-20 $** |
| Beta privada, unos 50 usuarios | ~45 $ (Supabase Pro + Vercel Pro) + dominio | 50-200 $ | **~100-250 $** |
| Lanzamiento, unos 1.000 usuarios activos | ~65 $ + correo | 1.000-4.000 $ (según el modelo y los límites) | **Debe financiarse con suscripciones** |

Además hay un coste puntual de asesoría legal (textos legales y cumplimiento del RGPD y del Reglamento de IA), que varía según el profesional.

## 5. Cuentas que necesitarás (por orden)

1. **Supabase** (Fase 2): crear un proyecto en una región de la UE.
2. **Anthropic Console** (Fase 3): crear una clave API, añadir crédito prepago y **configurar un límite de gasto mensual**.
3. **Vercel** (Fase 5): conectar con GitHub.
4. **Proveedor de correo** y **dominio** (Fase 5).
5. **Stripe** (Fase 5, solo si se aprueba).

No pegues nunca las claves en un chat ni en el código: se guardan en `.env.local` en tu ordenador y en el panel de variables de entorno de Vercel.
