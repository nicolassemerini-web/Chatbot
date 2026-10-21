/**
 * Textos editables de la web y su valor por defecto. Si la tabla
 * `site_content` no tiene un texto, se usa el de aquí: la web nunca se queda
 * en blanco. Desde la Fase 3 se editan en el panel de administración.
 */
export const CONTENT_DEFAULTS = {
  "home.title": "Conversaciones con personajes que te recuerdan",
  "home.subtitle":
    "Charla con personajes ficticios con personalidad propia. Recuerdan lo que les cuentas y retoman los temas que dejasteis pendientes.",
  "home.cta": "Conocer a los personajes",
  "home.points": [
    "Los personajes son ficticios y funcionan con inteligencia artificial.",
    "Servicio exclusivo para mayores de 18 años.",
    "Tus conversaciones son privadas y puedes borrarlas cuando quieras.",
  ].join("\n"),
  "characters.title": "Personajes",
  "legal.terms": [
    "BORRADOR pendiente de revisión legal. No usar en producción tal cual.",
    "Este servicio ofrece conversaciones con personajes ficticios generados por inteligencia artificial. Los personajes no son personas reales y sus respuestas pueden contener errores.",
    "El servicio es exclusivo para personas mayores de 18 años.",
    "No está permitido usar el servicio para actividades ilegales, para acosar a terceros ni para intentar saltarse las medidas de seguridad.",
    "Las respuestas de los personajes no constituyen consejo médico, legal, financiero ni psicológico profesional. Si estás en peligro, llama al 112; si necesitas apoyo emocional, puedes llamar al 024.",
  ].join("\n\n"),
  "legal.privacy": [
    "BORRADOR pendiente de revisión legal. No usar en producción tal cual.",
    "Guardamos tu correo electrónico para que puedas iniciar sesión, tu nombre visible y tus conversaciones con los personajes para que puedan continuar donde las dejaste.",
    "Tus conversaciones son privadas: solo tú puedes verlas. Puedes borrar cualquier conversación cuando quieras.",
    "Para generar las respuestas, los mensajes se envían a un proveedor de inteligencia artificial que actúa como encargado del tratamiento.",
    "Puedes solicitar la exportación o el borrado completo de tus datos.",
  ].join("\n\n"),
} as const;

export type ContentKey = keyof typeof CONTENT_DEFAULTS;

export const CONTENT_KEYS = Object.keys(CONTENT_DEFAULTS) as ContentKey[];
