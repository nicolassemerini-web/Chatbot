/**
 * Límites de consumo. Se comprueban en el servidor ANTES de llamar a la IA.
 *
 * 1. Anti-abuso: peticiones por minuto y usuario.
 * 2. Cuota diaria: mensajes por día según el plan del usuario (tabla `plans`).
 * 3. Freno global: si el gasto estimado de hoy supera el tope, se pausa la IA.
 */

export type QuotaConfig = {
  perMinute: number;
  /** Tope global de gasto diario, en céntimos (estimación en dólares). */
  globalBudgetCents: number;
  /** Precio por millón de tokens, en dólares. */
  priceInputPerMTok: number;
  priceOutputPerMTok: number;
};

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 && process.env[name] !== "" ? value : fallback;
}

export function getQuotaConfig(): QuotaConfig {
  return {
    perMinute: envNumber("LIMIT_CHAT_REQUESTS_PER_MINUTE", 10),
    globalBudgetCents: envNumber("LIMIT_GLOBAL_AI_DAILY_BUDGET_CENTS", 500),
    // Precios de Claude Haiku 5.5 (prompts de hasta 100.000 tokens).
    priceInputPerMTok: envNumber("AI_PRICE_INPUT_PER_MTOK_USD", 0.1),
    priceOutputPerMTok: envNumber("AI_PRICE_OUTPUT_PER_MTOK_USD", 0.5),
  };
}

export type QuotaErrorCode = "too_fast" | "daily_limit" | "budget";

const MESSAGES: Record<QuotaErrorCode, string> = {
  too_fast: "Vas muy rápido. Espera unos segundos y vuelve a escribir.",
  daily_limit: "Has llegado al límite de mensajes de hoy. Mañana podrás seguir charlando.",
  budget: "El servicio está pausado temporalmente por hoy. Inténtalo más tarde.",
};

export class QuotaError extends Error {
  constructor(readonly code: QuotaErrorCode) {
    super(MESSAGES[code]);
    this.name = "QuotaError";
  }
}

/** Acceso a los contadores. Hay una versión de Supabase y otra en memoria (pruebas). */
export interface UsageStore {
  /** Cuenta un mensaje del día si no se supera el límite del plan (atómico). */
  consumeDailyMessage(userId: string): Promise<{ allowed: boolean; used: number; quota: number }>;
  countRecentUserMessages(userId: string, sinceIso: string): Promise<number>;
  globalCostMicrosToday(): Promise<number>;
  recordUsage(userId: string, tokensIn: number, tokensOut: number, costMicros: number): Promise<void>;
}

/** Coste estimado en micro-dólares (1 micro-dólar = 0,000001 $). */
export function estimateCostMicros(
  tokensIn: number,
  tokensOut: number,
  config: Pick<QuotaConfig, "priceInputPerMTok" | "priceOutputPerMTok">,
): number {
  // precio por millón de tokens en $ == micro-dólares por token.
  return Math.round(tokensIn * config.priceInputPerMTok + tokensOut * config.priceOutputPerMTok);
}

/** 1 céntimo = 10.000 micro-dólares. */
export const MICROS_PER_CENT = 10_000;

/**
 * Lanza QuotaError si el usuario no puede enviar otro mensaje. El orden importa:
 * lo más barato primero y la cuota diaria al final, porque ESA sí consume un
 * mensaje del día.
 */
export async function enforceLimits(
  userId: string,
  store: UsageStore,
  config: QuotaConfig,
  now: Date = new Date(),
): Promise<void> {
  const since = new Date(now.getTime() - 60_000).toISOString();
  if ((await store.countRecentUserMessages(userId, since)) >= config.perMinute) {
    throw new QuotaError("too_fast");
  }
  if ((await store.globalCostMicrosToday()) >= config.globalBudgetCents * MICROS_PER_CENT) {
    throw new QuotaError("budget");
  }
  if (!(await store.consumeDailyMessage(userId)).allowed) {
    throw new QuotaError("daily_limit");
  }
}
