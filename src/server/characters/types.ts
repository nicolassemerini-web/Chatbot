/** Datos públicos de un personaje: lo que puede llegar al navegador. */
export type CharacterSummary = {
  slug: string;
  name: string;
  age: number;
  tagline: string;
  shortBio: string;
  interests: string[];
  /** Color de acento para el avatar (gradiente CSS). */
  accent: string;
};

export type InitiativeLevel = "low" | "medium" | "high";

/**
 * Ficha completa del personaje. Solo se usa en el servidor para construir el
 * contexto del modelo; nunca se envía al navegador.
 */
export type Character = CharacterSummary & {
  persona: string;
  styleRules: string[];
  boundaries: string[];
  initiativeLevel: InitiativeLevel;
  promptVersion: number;
  /** Respuestas de ejemplo que usa el proveedor simulado (`mock`). */
  mockLines: {
    greeting: string;
    replies: string[];
  };
};
