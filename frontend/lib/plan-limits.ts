export type UserPlan = "free" | "premium" | "pro"

export interface PlanLimits {
  label: string
  maxPlots: number
  maxFarms: number
  maxHectares: number
  priceUsd: number
}

export const PLAN_LIMITS: Record<UserPlan, PlanLimits> = {
  free: {
    label: "Free",
    maxPlots: 5,
    maxFarms: 1,
    maxHectares: 50,
    priceUsd: 0,
  },
  premium: {
    label: "Premium",
    maxPlots: 25,
    maxFarms: 3,
    maxHectares: 500,
    priceUsd: 20,
  },
  pro: {
    label: "Pro",
    maxPlots: Infinity,
    maxFarms: 10,
    maxHectares: 5000,
    priceUsd: 50,
  },
}

export function getPlanLimits(plan: UserPlan): PlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free
}

export function formatLimit(value: number): string {
  return Number.isFinite(value) ? String(value) : "Ilimitado"
}
