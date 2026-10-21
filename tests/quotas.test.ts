import { describe, expect, it } from "vitest";
import { enforceLimits, estimateCostMicros, getQuotaConfig, MICROS_PER_CENT } from "@/server/quotas/limits";
import { createMemoryUsage } from "./helpers/memory-usage";

const config = { perMinute: 10, globalBudgetCents: 500, priceInputPerMTok: 0.1, priceOutputPerMTok: 0.5 };

describe("estimateCostMicros", () => {
  it("calcula el coste con los precios de Haiku 5.5", () => {
    // 1.000.000 tokens de entrada = 0,10 $ y 1.000.000 de salida = 0,50 $.
    expect(estimateCostMicros(1_000_000, 0, config)).toBe(100_000);
    expect(estimateCostMicros(0, 1_000_000, config)).toBe(500_000);
    // Un turno típico: ~4.000 tokens de entrada y ~100 de salida = ~0,00045 $.
    expect(estimateCostMicros(4000, 100, config)).toBe(450);
  });
});

describe("getQuotaConfig", () => {
  it("usa valores por defecto razonables y respeta las variables de entorno", () => {
    delete process.env.LIMIT_CHAT_REQUESTS_PER_MINUTE;
    expect(getQuotaConfig().perMinute).toBe(10);
    process.env.LIMIT_CHAT_REQUESTS_PER_MINUTE = "3";
    expect(getQuotaConfig().perMinute).toBe(3);
    process.env.LIMIT_CHAT_REQUESTS_PER_MINUTE = "no-es-un-numero";
    expect(getQuotaConfig().perMinute).toBe(10);
    delete process.env.LIMIT_CHAT_REQUESTS_PER_MINUTE;
  });
});

describe("enforceLimits", () => {
  it("deja pasar mientras no se supere ningún límite", async () => {
    const { usage, state } = createMemoryUsage({ quota: 2 });
    await enforceLimits("u1", usage, config);
    await enforceLimits("u1", usage, config);
    expect(state.used).toBe(2);
  });

  it("al llegar al límite diario lanza daily_limit", async () => {
    const { usage } = createMemoryUsage({ quota: 1 });
    await enforceLimits("u1", usage, config);
    await expect(enforceLimits("u1", usage, config)).rejects.toMatchObject({ code: "daily_limit" });
  });

  it("el ritmo por minuto se comprueba antes y no consume cuota", async () => {
    const { usage, state } = createMemoryUsage();
    state.recent = config.perMinute;
    await expect(enforceLimits("u1", usage, config)).rejects.toMatchObject({ code: "too_fast" });
    expect(state.used).toBe(0);
  });

  it("el freno global salta justo al llegar al tope", async () => {
    const { usage, state } = createMemoryUsage();
    state.globalCostMicros = 500 * MICROS_PER_CENT - 1;
    await enforceLimits("u1", usage, config);
    state.globalCostMicros = 500 * MICROS_PER_CENT;
    await expect(enforceLimits("u1", usage, config)).rejects.toMatchObject({ code: "budget" });
  });
});
