/**
 * Colores disponibles para los avatares. La base de datos guarda solo la clave
 * (p. ej. "amber"); las clases completas tienen que estar escritas aquí para
 * que Tailwind las incluya en el CSS final.
 */
export const ACCENTS = {
  amber: "from-amber-400 to-rose-500",
  sky: "from-sky-400 to-indigo-500",
  emerald: "from-emerald-400 to-teal-600",
  rose: "from-rose-400 to-fuchsia-500",
  violet: "from-violet-400 to-purple-600",
  slate: "from-slate-400 to-slate-600",
} as const;

export type AccentKey = keyof typeof ACCENTS;

export function isAccentKey(value: string): value is AccentKey {
  return Object.hasOwn(ACCENTS, value);
}

export function accentClasses(key: string): string {
  return isAccentKey(key) ? ACCENTS[key] : ACCENTS.rose;
}
