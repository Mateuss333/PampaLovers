import type { SupabaseClient, User } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/client"

/** Asegura fila en profiles: farms.user_id referencia profiles(id), no auth.users. */
async function ensureUserProfile(supabase: SupabaseClient, user: User) {
  const { data, error: selErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle()

  if (selErr) throw new Error(selErr.message)
  if (data) return

  const meta = user.user_metadata as Record<string, unknown> | undefined
  const fromMeta =
    (typeof meta?.name === "string" && meta.name) ||
    (typeof meta?.full_name === "string" && meta.full_name) ||
    null

  const { error: insErr } = await supabase.from("profiles").insert({
    id: user.id,
    email: user.email ?? null,
    name: fromMeta,
  })

  // Carrera con el trigger on_auth_user_created
  if (insErr && insErr.code !== "23505") throw new Error(insErr.message)
}

// ──────────────────────────────────────────────
// Database row types
// ──────────────────────────────────────────────

export interface DbPlot {
  id: string
  farm_id: string
  name: string
  description: string | null
  area_ha: number | null
  status: "Sembrado" | "Crecimiento" | "Cosechado" | "Barbecho"
  latitude: number | null
  longitude: number | null
  crop_type: string | null
  soil_moisture_percent: number | null
  soil_ph: number | null
  temperature_c: number | null
  rainfall_mm: number | null
  humidity_percent: number | null
  sunlight_hours: number | null
  irrigation_type: string | null
  fertilizer_type: string | null
  pesticide_usage_ml: number | null
  total_days: number | null
  ndvi_index: number | null
  crop_disease_status: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DbFarm {
  id: string
  user_id: string
  name: string
  description: string | null
  location_name: string | null
  size_ha: number | null
  timezone: string | null
  currency: string | null
  created_at: string
  updated_at: string
}

// ──────────────────────────────────────────────
// Frontend-facing types (mapped from DB rows)
// ──────────────────────────────────────────────

/** Contorno en GeoJSON [longitud, latitud] cuando exista en backend. */
export type LotPolygon = [number, number][]

export interface Lot {
  id: string
  name: string
  crop: string
  area: number
  status: "Sembrado" | "Crecimiento" | "Cosechado" | "Barbecho"
  ndvi: number
  predictedYield: number | null
  lastUpdated: string
  polygon?: LotPolygon
}

export interface UserProfile {
  name: string
  email: string
}

export interface FarmSettings {
  id: string
  name: string
  size: number
  location: string
  timezone: string
  currency: string
}

export interface DashboardMetric {
  id: string
  title: string
  value: string
  unit: string
  change: string
  changeType: "positive" | "negative" | "neutral"
}

export interface SoilMetric {
  id: string
  title: string
  value: string
  unit: string
  status: "Óptimo" | "Normal" | "Alto" | "Ideal" | "Moderado" | "Bajo"
  description: string
  trend: string
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function mapPlotToLot(plot: DbPlot): Lot {
  return {
    id: plot.id,
    name: plot.name,
    crop: plot.crop_type ?? "Sin cultivo",
    area: Number(plot.area_ha) || 0,
    status: plot.status,
    ndvi: Number(plot.ndvi_index) || 0,
    predictedYield: null,
    lastUpdated: plot.updated_at,
  }
}

function soilStatus(
  value: number,
  min: number,
  max: number,
): "Óptimo" | "Normal" | "Alto" | "Bajo" {
  if (value < min) return "Bajo"
  if (value > max) return "Alto"
  return "Óptimo"
}

// ──────────────────────────────────────────────
// LOTS
// ──────────────────────────────────────────────

export async function fetchLots(): Promise<Lot[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("plots")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data ?? []).map(mapPlotToLot)
}

export async function getLotById(id: string): Promise<Lot | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("plots")
    .select("*")
    .eq("id", id)
    .single()

  if (error) return null
  return mapPlotToLot(data)
}

export interface CreatePlotInput {
  farm_id: string
  name: string
  crop_type?: string
  area_ha?: number
  status?: string
  latitude?: number
  longitude?: number
  description?: string
}

function roundGeographicCoord(value: number, decimals: number): number {
  const f = 10 ** decimals
  return Math.round(value * f) / f
}

export async function createPlot(input: CreatePlotInput): Promise<DbPlot> {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) throw new Error("No autenticado")

  await ensureUserProfile(supabase, user)

  const row: {
    farm_id: string
    name: string
    status: string
    crop_type?: string
    description?: string | null
    area_ha?: number
    latitude?: number
    longitude?: number
  } = {
    farm_id: input.farm_id,
    name: input.name,
    status: input.status ?? "Sembrado",
  }

  if (input.crop_type) row.crop_type = input.crop_type
  if (input.description) row.description = input.description
  if (
    input.area_ha != null &&
    Number.isFinite(input.area_ha) &&
    input.area_ha > 0
  ) {
    row.area_ha = input.area_ha
  }
  if (input.latitude != null && Number.isFinite(input.latitude)) {
    row.latitude = roundGeographicCoord(input.latitude, 6)
  }
  if (input.longitude != null && Number.isFinite(input.longitude)) {
    row.longitude = roundGeographicCoord(input.longitude, 6)
  }

  const { data, error } = await supabase
    .from("plots")
    .insert(row)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deletePlot(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("plots").delete().eq("id", id)
  if (error) throw error
}

// ──────────────────────────────────────────────
// USER PROFILE
// ──────────────────────────────────────────────

export async function getUserProfile(): Promise<UserProfile> {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) throw new Error("No autenticado")

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (error) throw error
  return {
    name: data.name ?? "",
    email: data.email ?? user.email ?? "",
  }
}

export async function updateProfile(updates: {
  name?: string
  email?: string
}): Promise<void> {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) throw new Error("No autenticado")

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)

  if (error) throw error
}

// ──────────────────────────────────────────────
// FARM
// ──────────────────────────────────────────────

export async function getUserFarm(): Promise<DbFarm | null> {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return null

  const { data, error } = await supabase
    .from("farms")
    .select("*")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle()

  if (error) return null
  return data
}

export async function getFarmSettings(): Promise<FarmSettings | null> {
  const farm = await getUserFarm()
  if (!farm) return null
  return {
    id: farm.id,
    name: farm.name,
    size: Number(farm.size_ha) || 0,
    location: farm.location_name ?? "",
    timezone: farm.timezone ?? "america-buenos-aires",
    currency: farm.currency ?? "ars",
  }
}

export interface CreateFarmInput {
  name: string
  description?: string
  location_name?: string
  size_ha?: number
}

export async function createFarm(input: CreateFarmInput): Promise<DbFarm> {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) throw new Error("No autenticado")

  await ensureUserProfile(supabase, user)

  // Solo columnas de la migración base (001). Incluir size_ha en el INSERT rompe
  // con 400 si en Supabase remoto no corriste 202603280002 (columna inexistente).
  const row: {
    user_id: string
    name: string
    description?: string | null
    location_name?: string | null
  } = {
    user_id: user.id,
    name: input.name,
  }
  if (input.description) row.description = input.description
  if (input.location_name) row.location_name = input.location_name

  const { data, error } = await supabase.from("farms").insert(row).select().single()

  if (error) throw new Error(error.message)

  if (input.size_ha != null && !Number.isNaN(input.size_ha) && input.size_ha > 0) {
    const { error: sizeErr } = await supabase
      .from("farms")
      .update({ size_ha: input.size_ha })
      .eq("id", data.id)
    // Sin migración 002: ignorar fallo por columna ausente
    if (
      sizeErr &&
      !/size_ha|column|schema cache/i.test(sizeErr.message)
    ) {
      throw new Error(sizeErr.message)
    }
  }

  return data
}

export async function updateFarm(
  farmId: string,
  updates: {
    name?: string
    location_name?: string
    size_ha?: number
    timezone?: string
    currency?: string
  },
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("farms")
    .update(updates)
    .eq("id", farmId)

  if (error) throw error
}

// ──────────────────────────────────────────────
// DASHBOARD METRICS (computed from plots)
// ──────────────────────────────────────────────

export async function getDashboardMetrics(): Promise<DashboardMetric[]> {
  const supabase = createClient()
  const { data: plots, error } = await supabase
    .from("plots")
    .select("area_ha, ndvi_index")

  const empty: DashboardMetric[] = [
    { id: "area", title: "Área Total", value: "0", unit: "hectáreas", change: "—", changeType: "neutral" },
    { id: "lots", title: "Lotes Activos", value: "0", unit: "lotes", change: "—", changeType: "neutral" },
    { id: "yield", title: "NDVI Promedio", value: "0.00", unit: "", change: "—", changeType: "neutral" },
  ]

  if (error || !plots || plots.length === 0) return empty

  const totalArea = plots.reduce((sum, p) => sum + (Number(p.area_ha) || 0), 0)
  const lotCount = plots.length
  const avgNdvi =
    plots.reduce((sum, p) => sum + (Number(p.ndvi_index) || 0), 0) / lotCount

  return [
    {
      id: "area",
      title: "Área Total",
      value: totalArea.toLocaleString("es-AR", { maximumFractionDigits: 0 }),
      unit: "hectáreas",
      change: "—",
      changeType: "neutral",
    },
    {
      id: "lots",
      title: "Lotes Activos",
      value: String(lotCount),
      unit: "lotes",
      change: "—",
      changeType: "neutral",
    },
    {
      id: "yield",
      title: "NDVI Promedio",
      value: avgNdvi.toFixed(2),
      unit: "",
      change: "—",
      changeType: "neutral",
    },
  ]
}

// ──────────────────────────────────────────────
// SOIL METRICS (read from a specific plot row)
// ──────────────────────────────────────────────

export async function getSoilMetrics(plotId: string): Promise<SoilMetric[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("plots")
    .select(
      "soil_ph, soil_moisture_percent, temperature_c, rainfall_mm, humidity_percent, ndvi_index",
    )
    .eq("id", plotId)
    .single()

  if (error || !data) return []

  const metrics: SoilMetric[] = []

  if (data.soil_ph != null) {
    metrics.push({
      id: "ph",
      title: "pH del Suelo",
      value: String(data.soil_ph),
      unit: "",
      status: soilStatus(Number(data.soil_ph), 6.0, 7.5),
      description: "Rango ideal: 6.0 - 7.5",
      trend: "",
    })
  }

  if (data.soil_moisture_percent != null) {
    metrics.push({
      id: "moisture",
      title: "Humedad del Suelo",
      value: String(data.soil_moisture_percent),
      unit: "%",
      status: soilStatus(Number(data.soil_moisture_percent), 30, 60),
      description: "Capacidad de campo",
      trend: "",
    })
  }

  if (data.temperature_c != null) {
    metrics.push({
      id: "temp",
      title: "Temperatura Suelo",
      value: String(data.temperature_c),
      unit: "°C",
      status: soilStatus(Number(data.temperature_c), 15, 30),
      description: "A 10cm de profundidad",
      trend: "",
    })
  }

  if (data.humidity_percent != null) {
    metrics.push({
      id: "humidity",
      title: "Humedad Ambiente",
      value: String(data.humidity_percent),
      unit: "%",
      status: soilStatus(Number(data.humidity_percent), 40, 70),
      description: "Humedad relativa del aire",
      trend: "",
    })
  }

  if (data.rainfall_mm != null) {
    metrics.push({
      id: "rainfall",
      title: "Precipitaciones",
      value: String(data.rainfall_mm),
      unit: "mm",
      status: "Normal",
      description: "Acumulado del período",
      trend: "",
    })
  }

  if (data.ndvi_index != null) {
    metrics.push({
      id: "ndvi",
      title: "NDVI",
      value: String(data.ndvi_index),
      unit: "",
      status: soilStatus(Number(data.ndvi_index), 0.4, 1.0),
      description: "Índice de vegetación normalizado",
      trend: "",
    })
  }

  return metrics
}
