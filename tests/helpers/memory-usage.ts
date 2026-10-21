import type { UsageStore } from "@/server/quotas/limits";

/** Contadores en memoria con la misma interfaz que el almacén de Supabase. */
export function createMemoryUsage(options: { quota?: number; globalCostMicros?: number } = {}) {
  const quota = options.quota ?? 30;
  const state = {
    used: 0,
    recent: 0,
    globalCostMicros: options.globalCostMicros ?? 0,
    records: [] as { userId: string; tokensIn: number; tokensOut: number; costMicros: number }[],
  };
  const usage: UsageStore = {
    async consumeDailyMessage() {
      if (state.used >= quota) return { allowed: false, used: state.used, quota };
      state.used += 1;
      return { allowed: true, used: state.used, quota };
    },
    async countRecentUserMessages() {
      return state.recent;
    },
    async globalCostMicrosToday() {
      return state.globalCostMicros;
    },
    async recordUsage(userId, tokensIn, tokensOut, costMicros) {
      state.records.push({ userId, tokensIn, tokensOut, costMicros });
    },
  };
  return { usage, state };
}
