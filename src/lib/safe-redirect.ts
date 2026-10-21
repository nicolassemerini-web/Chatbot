/**
 * Devuelve una ruta interna segura para redirigir tras iniciar sesión. Evita
 * redirecciones abiertas a otros dominios (`//evil.com`, `https://…`, `/\evil`).
 */
export function safeNextPath(value: unknown, fallback = "/personajes"): string {
  if (typeof value !== "string" || value.length > 200) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\r\n\t]/.test(value)) return fallback;
  return value;
}
