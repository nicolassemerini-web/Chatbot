import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/chat/route";

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

describe("POST /api/chat", () => {
  it("responde en streaming con el texto del personaje", async () => {
    const res = await post({ characterSlug: "noa", messages: [{ role: "user", content: "¿Eres humana?" }] });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(await res.text()).toContain("Soy Noa, un personaje ficticio");
  });

  it("devuelve 404 si el personaje no existe", async () => {
    const res = await post({ characterSlug: "nadie", messages: [{ role: "user", content: "Hola" }] });
    expect(res.status).toBe(404);
  });

  it("devuelve 400 con JSON mal formado", async () => {
    const res = await post("{no es json");
    expect(res.status).toBe(400);
  });

  it("devuelve 400 si la petición no pasa la validación", async () => {
    const res = await post({ characterSlug: "lucia", messages: [] });
    expect(res.status).toBe(400);
  });
});
