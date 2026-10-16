import type { AccentKey } from "@/lib/accents";

/** Datos públicos de un personaje: lo que puede llegar al navegador. */
export type CharacterSummary = {
  slug: string;
  name: string;
  age: number;
  tagline: string;
  shortBio: string;
  interests: string[];
  /** Clave de color del avatar (ver src/lib/accents.ts). */
  accent: AccentKey;
};

export type InitiativeLevel = "low" | "medium" | "high";

/**
 * Ficha completa del personaje. Solo se usa en el servidor para construir el
 * contexto del modelo; nunca se envía al navegador.
 */
export type Character = CharacterSummary & {
  /** Identificador en la base de datos (null en el catálogo integrado). */
  id: string | null;
  persona: string;
  styleRules: string[];
  boundaries: string[];
  initiativeLevel: InitiativeLevel;
  promptVersion: number;
  /** Modelo de IA propio del personaje; null = el modelo por defecto. */
  model: string | null;
  /** Respuestas de ejemplo que usa el proveedor simulado (`mock`). */
  mockLines: {
    greeting: string;
    replies: string[];
  };
};
