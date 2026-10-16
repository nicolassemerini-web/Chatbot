import { describe, expect, it } from "vitest";
import { mergeContent, toLines, toParagraphs } from "@/server/content/content";
import { CONTENT_DEFAULTS } from "@/server/content/defaults";
import { mapCharacterRow, toSummary, type CharacterRow } from "@/server/characters/mapping";

describe("contenido editable", () => {
  it("usa los valores por defecto si no hay nada guardado", () => {
    expect(mergeContent([])).toEqual(CONTENT_DEFAULTS);
  });

  it("los textos guardados sustituyen a los de por defecto", () => {
    const content = mergeContent([{ key: "home.title", value: "Nuevo título" }]);
    expect(content["home.title"]).toBe("Nuevo título");
    expect(content["home.cta"]).toBe(CONTENT_DEFAULTS["home.cta"]);
  });

  it("ignora claves desconocidas y textos vacíos", () => {
    const content = mergeContent([
      { key: "otra.cosa", value: "x" },
      { key: "home.title", value: "   " },
    ]);
    expect(content).toEqual(CONTENT_DEFAULTS);
  });

  it("divide en párrafos y líneas", () => {
    expect(toParagraphs("a\n\nb\n \n c")).toEqual(["a", "b", "c"]);
    expect(toLines("a\n\n b \n")).toEqual(["a", "b"]);
  });
});

describe("mapCharacterRow", () => {
  const row: CharacterRow = {
    id: "1",
    slug: "test",
    name: "Test",
    age: 30,
    tagline: "t",
    short_bio: "b",
    interests: null,
    accent: "color-inventado",
    persona: "p",
    style_rules: null,
    boundaries: null,
    initiative_level: "raro",
    prompt_version: 2,
    model: null,
    mock_greeting: "",
    mock_replies: [],
  };

  it("aplica valores seguros a datos incompletos o desconocidos", () => {
    const c = mapCharacterRow(row);
    expect(c.accent).toBe("rose");
    expect(c.initiativeLevel).toBe("medium");
    expect(c.interests).toEqual([]);
    expect(c.mockLines.greeting).toContain("Test");
    expect(c.mockLines.replies.length).toBeGreaterThan(0);
  });

  it("el resumen público no incluye la personalidad ni el modelo", () => {
    const summary = toSummary(mapCharacterRow(row));
    expect(summary).not.toHaveProperty("persona");
    expect(summary).not.toHaveProperty("model");
    expect(summary).not.toHaveProperty("id");
  });
});
