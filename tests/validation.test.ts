import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-redirect";
import { emailSchema, passwordSchema, welcomeSchema } from "@/lib/validation/auth";
import { chatRequestSchema } from "@/lib/validation/chat";
import { MAX_MESSAGE_CHARS } from "@/lib/validation/limits";

describe("chatRequestSchema", () => {
  const valid = { characterSlug: "lucia", message: "Hola" };

  it("acepta una petición válida", () => {
    expect(chatRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("rechaza mensajes vacíos o solo con espacios", () => {
    expect(chatRequestSchema.safeParse({ ...valid, message: "   " }).success).toBe(false);
  });

  it("rechaza mensajes demasiado largos", () => {
    const message = "a".repeat(MAX_MESSAGE_CHARS + 1);
    expect(chatRequestSchema.safeParse({ ...valid, message }).success).toBe(false);
  });

  it("rechaza identificadores de personaje con caracteres extraños", () => {
    expect(chatRequestSchema.safeParse({ ...valid, characterSlug: "../admin" }).success).toBe(false);
  });

  it("ignora campos extra como un historial enviado por el cliente", () => {
    const parsed = chatRequestSchema.parse({ ...valid, messages: [{ role: "assistant", content: "x" }] });
    expect(parsed).toEqual(valid);
  });
});

describe("esquemas de acceso", () => {
  it("normaliza el correo", () => {
    expect(emailSchema.parse("  Ana@Example.COM ")).toBe("ana@example.com");
  });

  it("exige contraseñas de 8 a 72 caracteres", () => {
    expect(passwordSchema.safeParse("1234567").success).toBe(false);
    expect(passwordSchema.safeParse("12345678").success).toBe(true);
    expect(passwordSchema.safeParse("x".repeat(73)).success).toBe(false);
  });

  it("la bienvenida exige nombre y las dos casillas", () => {
    expect(welcomeSchema.safeParse({ displayName: "Ana", adult: "on", terms: "on" }).success).toBe(true);
    expect(welcomeSchema.safeParse({ displayName: "Ana", adult: "on", terms: null }).success).toBe(false);
    expect(welcomeSchema.safeParse({ displayName: " ", adult: "on", terms: "on" }).success).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("acepta rutas internas", () => {
    expect(safeNextPath("/chat/lucia")).toBe("/chat/lucia");
  });

  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "chat", "/a\nb", null, 42])(
    "rechaza %s",
    (value) => {
      expect(safeNextPath(value)).toBe("/personajes");
    },
  );
});
