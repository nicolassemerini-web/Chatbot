import "server-only";

import { createAdminClient } from "@/server/db/admin";
import type { UsageStore } from "./limits";

/** Contadores en Supabase. Usa la clave secreta: solo el servidor puede escribirlos. */
export function createSupabaseUsageStore(): UsageStore {
  const db = createAdminClient();

  return {
    async consumeDailyMessage(userId) {
      const { data, error } = await db.rpc("consume_message", { p_user: userId });
      if (error) throw new Error(`No se pudo comprobar la cuota diaria: ${error.message}`);
      const row = Array.isArray(data) ? data[0] : data;
      return {
        allowed: Boolean(row?.allowed),
        used: Number(row?.used ?? 0),
        quota: Number(row?.quota ?? 0),
      };
    },

    async countRecentUserMessages(userId, sinceIso) {
      const { count, error } = await db
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("role", "user")
        .gte("created_at", sinceIso);
      if (error) throw new Error(`No se pudo comprobar el ritmo de mensajes: ${error.message}`);
      return count ?? 0;
    },

    async globalCostMicrosToday() {
      const { data, error } = await db.rpc("global_cost_today");
      if (error) throw new Error(`No se pudo comprobar el gasto del día: ${error.message}`);
      return Number(data ?? 0);
    },

    async recordUsage(userId, tokensIn, tokensOut, costMicros) {
      const { error } = await db.rpc("record_usage", {
        p_user: userId,
        p_tokens_in: Math.round(tokensIn),
        p_tokens_out: Math.round(tokensOut),
        p_cost_micros: Math.round(costMicros),
      });
      // Un fallo al contar el gasto no debe romper la respuesta ya entregada.
      if (error) console.error("[consumo] no se pudo registrar el gasto:", error.message);
    },
  };
}
