import { isAccentKey } from "@/lib/accents";
import type { Character, CharacterSummary, InitiativeLevel } from "./types";

/** Columnas de `characters` que necesita la aplicación. */
export const CHARACTER_COLUMNS =
  "id, slug, name, age, tagline, short_bio, interests, accent, persona, style_rules, boundaries, initiative_level, prompt_version, model, mock_greeting, mock_replies";

export type CharacterRow = {
  id: string;
  slug: string;
  name: string;
  age: number;
  tagline: string;
  short_bio: string;
  interests: string[] | null;
  accent: string;
  persona: string;
  style_rules: string[] | null;
  boundaries: string[] | null;
  initiative_level: string;
  prompt_version: number;
  model: string | null;
  mock_greeting: string | null;
  mock_replies: string[] | null;
};

const INITIATIVE_LEVELS: InitiativeLevel[] = ["low", "medium", "high"];

export function mapCharacterRow(row: CharacterRow): Character {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    age: row.age,
    tagline: row.tagline,
    shortBio: row.short_bio,
    interests: row.interests ?? [],
    accent: isAccentKey(row.accent) ? row.accent : "rose",
    persona: row.persona,
    styleRules: row.style_rules ?? [],
    boundaries: row.boundaries ?? [],
    initiativeLevel: INITIATIVE_LEVELS.includes(row.initiative_level as InitiativeLevel)
      ? (row.initiative_level as InitiativeLevel)
      : "medium",
    promptVersion: row.prompt_version,
    model: row.model,
    mockLines: {
      greeting: row.mock_greeting || `¡Hola! Soy ${row.name}. ¿Qué tal estás?`,
      replies: row.mock_replies?.length ? row.mock_replies : ["Cuéntame más."],
    },
  };
}

export function toSummary(character: Character): CharacterSummary {
  const { slug, name, age, tagline, shortBio, interests, accent } = character;
  return { slug, name, age, tagline, shortBio, interests, accent };
}
