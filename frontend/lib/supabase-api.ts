import type { SupabaseClient, User } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/client"
import { type UserPlan, getPlanLimits } from "@/lib/plan-limits"

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
  /** ISO yyyy-mm-dd desde columna `date` en Postgres */
  sowing_date: string | null
  created_at: string
  updated_at: string
  group: number
  /** jsonb: [[lon, lat], ...] contorno guardado en BD */
  polygon?: unknown | null
  /** GeoJSON Polygon (type + coordinates); columna en BD: "geoJSON" */
  geoJSON?: unknown | null
}

type DbPlotWithFarm = DbPlot & {
  farms?: { id: string; name: string } | { id: string; name: string }[] | null
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

/** Fila en plot_previous_yields: position 1 = cosecha más reciente. */
export interface DbPlotPreviousYield {
  position: number
  yield_value: number
  yield_unit: "kg_ha" | "tn_ha"
}

// ──────────────────────────────────────────────
// Frontend-facing types (mapped from DB rows)
// ──────────────────────────────────────────────

/** Contorno [longitud, latitud] desde columna `polygon` o aproximado por centroide. */
export type LotPolygon = [number, number][]

export interface Lot {
  id: string
  farmId: string
  farmName: string
  plotGroup: number
  name: string
  crop: string
  area: number
  status: "Sembrado" | "Crecimiento" | "Cosechado" | "Barbecho"
  ndvi: number
  predictedYield: number | null
  lastUpdated: string
  polygon?: LotPolygon
  /** true si no hay `polygon` en BD y se usó cuadrado por ubicación + superficie (lotes viejos). */
  polygonApproximated?: boolean
}

export interface UserProfile {
  name: string
  email: string
  plan: UserPlan
  createdAt: string
}

export interface UserUsage {
  farms: number
  plots: number
  hectares: number
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

/** Rendimiento agregado por cultivo para el dashboard (t/ha). */
export interface YieldByCrop {
  crop: string
  actual: number | null
  prediction: number | null
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

const METERS_PER_DEG_LAT = 111_320

function metersToLatDelta(m: number): number {
  return m / METERS_PER_DEG_LAT
}

function metersToLonDelta(m: number, latDeg: number): number {
  const cos = Math.cos((latDeg * Math.PI) / 180)
  const denom = METERS_PER_DEG_LAT * (Math.abs(cos) < 1e-6 ? 1e-6 : cos)
  return m / denom
}

/**
 * Cuadrado alineado N-S / E-O en torno a `latitude`/`longitude`.
 * Lado ≈ √área si hay `area_ha`; si no, ~90 m de lado (solo referencia visual en mapa).
 */
function parsePlotPolygon(raw: unknown): LotPolygon | undefined {
  if (!Array.isArray(raw) || raw.length < 3) return undefined
  const out: LotPolygon = []
  for (const item of raw) {
    if (!Array.isArray(item) || item.length < 2) return undefined
    const lon = Number(item[0])
    const lat = Number(item[1])
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return undefined
    out.push([lon, lat])
  }
  return out
}

function lotPolygonFromCentroidAndArea(
  lat: number,
  lon: number,
  areaHa: number | null,
): LotPolygon {
  const areaM2 =
    areaHa != null && Number.isFinite(areaHa) && areaHa > 0 ? areaHa * 10_000 : 0
  const sideM = areaM2 > 0 ? Math.sqrt(areaM2) : 0
  let halfSideM = sideM > 0 ? sideM / 2 : 45
  halfSideM = Math.min(400, Math.max(20, halfSideM))
  const dLat = metersToLatDelta(halfSideM)
  const dLon = metersToLonDelta(halfSideM, lat)
  return [
    [lon - dLon, lat - dLat],
    [lon + dLon, lat - dLat],
    [lon + dLon, lat + dLat],
    [lon - dLon, lat + dLat],
  ]
}

function mapPlotToLot(plot: DbPlotWithFarm): Lot {
  const farmEmbed = plot.farms
  const farmRow = Array.isArray(farmEmbed) ? farmEmbed[0] : farmEmbed
  const lat =
    plot.latitude != null && Number.isFinite(Number(plot.latitude))
      ? Number(plot.latitude)
      : null
  const lon =
    plot.longitude != null && Number.isFinite(Number(plot.longitude))
      ? Number(plot.longitude)
      : null
  const stored = parsePlotPolygon(plot.polygon)
  let polygon: LotPolygon | undefined
  let polygonApproximated = false
  if (stored && stored.length >= 3) {
    polygon = stored
  } else if (lat != null && lon != null) {
    polygon = lotPolygonFromCentroidAndArea(lat, lon, plot.area_ha)
    polygonApproximated = true
  }
  return {
    id: plot.id,
    farmId: plot.farm_id,
    farmName: farmRow?.name ?? "",
    plotGroup: Number.isFinite(plot.group) ? plot.group : 1,
    name: plot.name,
    crop: plot.crop_type ?? "Sin cultivo",
    area: Number(plot.area_ha) || 0,
    status: plot.status,
    ndvi: Number(plot.ndvi_index) || 0,
    predictedYield: null,
    lastUpdated: plot.updated_at,
    ...(polygon
      ? {
          polygon,
          ...(polygonApproximated ? { polygonApproximated: true } : {}),
        }
      : {}),
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

const PREFERRED_CROP_ORDER = ["Soja", "Maíz", "Trigo", "Girasol"] as const

function yieldToTnHa(value: number, unit: string): number | null {
  if (!Number.isFinite(value) || value <= 0) return null
  if (unit === "tn_ha") return value
  if (unit === "kg_ha") return value / 1000
  return null
}

/** H = sum((1/p) * y_p) / sum(1/p); p más alto = más antiguo, menos peso. */
function weightedHistoricalTnHa(
  rows: DbPlotPreviousYield[],
): number | null {
  let sumWY = 0
  let sumW = 0
  for (const r of rows) {
    const p = r.position
    if (p < 1 || p > 10) continue
    const y = yieldToTnHa(Number(r.yield_value), r.yield_unit)
    if (y == null) continue
    const w = 1 / p
    sumWY += w * y
    sumW += w
  }
  if (sumW === 0) return null
  return sumWY / sumW
}

function lastHarvestTnHa(rows: DbPlotPreviousYield[]): number | null {
  const row = rows.find((r) => r.position === 1)
  if (!row) return null
  return yieldToTnHa(Number(row.yield_value), row.yield_unit)
}

function blendMlAndHistorical(
  mlTnHa: number | null,
  historicalHTnHa: number | null,
): number | null {
  const hasMl = mlTnHa != null && Number.isFinite(mlTnHa)
  const hasH =
    historicalHTnHa != null && Number.isFinite(historicalHTnHa)
  if (hasMl && hasH) return 0.7 * mlTnHa! + 0.3 * historicalHTnHa!
  if (hasMl) return mlTnHa!
  if (hasH) return historicalHTnHa!
  return null
}

function parseMlPredicted(
  embed:
    | { ml_predicted_tn_ha: number | string | null }
    | { ml_predicted_tn_ha: number | string | null }[]
    | null
    | undefined,
): number | null {
  if (embed == null) return null
  const row = Array.isArray(embed) ? embed[0] : embed
  if (!row || row.ml_predicted_tn_ha == null) return null
  const v = Number(row.ml_predicted_tn_ha)
  return Number.isFinite(v) && v >= 0 ? v : null
}

function sortCropLabels(crops: string[]): string[] {
  const remaining = new Set(crops)
  const ordered: string[] = []
  for (const c of PREFERRED_CROP_ORDER) {
    if (remaining.has(c)) {
      ordered.push(c)
      remaining.delete(c)
    }
  }
  const rest = [...remaining].sort((a, b) => a.localeCompare(b, "es"))
  return [...ordered, ...rest]
}

// ──────────────────────────────────────────────
// LOTS
// ──────────────────────────────────────────────

/** IDs de granjas del usuario autenticado (RLS en farms ya filtra; esto asegura el alcance en el cliente). */
async function getUserFarmIds(
  supabase: SupabaseClient,
): Promise<string[] | null> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return null

  const { data, error } = await supabase
    .from("farms")
    .select("id")
    .eq("user_id", user.id)

  if (error) throw error
  return (data ?? []).map((row: { id: string }) => row.id)
}

export async function fetchLots(): Promise<Lot[]> {
  const supabase = createClient()
  const farmIds = await getUserFarmIds(supabase)
  if (!farmIds || farmIds.length === 0) return []

  const { data, error } = await supabase
    .from("plots")
    .select("*, farms(name)")
    .in("farm_id", farmIds)
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => mapPlotToLot(row as DbPlotWithFarm))
}

export async function getLotById(id: string): Promise<Lot | null> {
  const supabase = createClient()
  const farmIds = await getUserFarmIds(supabase)
  if (!farmIds || farmIds.length === 0) return null

  const { data, error } = await supabase
    .from("plots")
    .select("*, farms(name)")
    .eq("id", id)
    .in("farm_id", farmIds)
    .maybeSingle()

  if (error) return null
  return mapPlotToLot(data)
}

/** Fila completa de `plots` solo si el lote pertenece a una granja del usuario. */
export async function getPlotRow(id: string): Promise<DbPlot | null> {
  const supabase = createClient()
  const farmIds = await getUserFarmIds(supabase)
  if (!farmIds || farmIds.length === 0) return null

  const { data, error } = await supabase
    .from("plots")
    .select("*")
    .eq("id", id)
    .in("farm_id", farmIds)
    .maybeSingle()

  if (error || !data) return null
  return data as DbPlot
}

export interface UpdatePlotInput {
  name?: string
  crop_type?: string | null
  area_ha?: number | null
  status?: DbPlot["status"]
  description?: string | null
  notes?: string | null
  group?: number
}

export async function updatePlot(
  id: string,
  updates: UpdatePlotInput,
): Promise<DbPlot> {
  const supabase = createClient()
  const farmIds = await getUserFarmIds(supabase)
  if (!farmIds || farmIds.length === 0) throw new Error("No autenticado")

  const patch: Record<string, unknown> = {}
  if (updates.name !== undefined) patch.name = updates.name
  if (updates.crop_type !== undefined) patch.crop_type = updates.crop_type
  if (updates.area_ha !== undefined) patch.area_ha = updates.area_ha
  if (updates.status !== undefined) patch.status = updates.status
  if (updates.description !== undefined) patch.description = updates.description
  if (updates.notes !== undefined) patch.notes = updates.notes
  if (updates.group !== undefined) patch.group = updates.group

  if (Object.keys(patch).length === 0) {
    const row = await getPlotRow(id)
    if (!row) throw new Error("Lote no encontrado")
    return row
  }

  const { data, error } = await supabase
    .from("plots")
    .update(patch)
    .eq("id", id)
    .in("farm_id", farmIds)
    .select()
    .single()

  if (error) throw error
  if (!data) throw new Error("Lote no encontrado")
  return data as DbPlot
}

export interface CreatePlotInput {
  farm_id: string
  name: string
  group: number
  crop_type?: string
  area_ha?: number
  status?: string
  latitude?: number
  longitude?: number
  /** Vértices [lon, lat]; se guardan en `plots.polygon` (jsonb). */
  polygon?: LotPolygon
  description?: string
  soil_ph?: number
  irrigation_type?: string
  fertilizer_type?: string
  pesticide_usage_ml?: number
  crop_disease_status?: string
  /** yyyy-mm-dd (input type=date) */
  sowing_date?: string
}

function roundGeographicCoord(value: number, decimals: number): number {
  const f = 10 ** decimals
  return Math.round(value * f) / f
}

/**
 * Convierte vértices [lon, lat] (como en el mapa del form) a GeoJSON Polygon RFC 7946.
 * Cierra el anillo exterior si hace falta; misma precisión que lat/lon del insert.
 */
function lotPolygonToGeoJsonPolygon(
  parsed: LotPolygon,
): { type: "Polygon"; coordinates: number[][][] } | null {
  if (parsed.length < 3) return null
  const ring = parsed.map(([lon, lat]) => [
    roundGeographicCoord(lon, 6),
    roundGeographicCoord(lat, 6),
  ])
  const first = ring[0]
  const last = ring[ring.length - 1]
  const closed =
    first[0] === last[0] && first[1] === last[1]
      ? ring
      : [...ring, [first[0], first[1]]]
  return {
    type: "Polygon",
    coordinates: [closed],
  }
}

export async function createPlot(input: CreatePlotInput): Promise<DbPlot> {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) throw new Error("No autenticado")

  await ensureUserProfile(supabase, user)
  await checkPlanLimit(supabase, user.id, "plot")

  const row: {
    farm_id: string
    name: string
    group: number
    status: string
    crop_type?: string
    description?: string | null
    area_ha?: number
    latitude?: number
    longitude?: number
    polygon?: LotPolygon
    geoJSON?: { type: "Polygon"; coordinates: number[][][] }
    soil_ph?: number
    irrigation_type?: string
    fertilizer_type?: string
    pesticide_usage_ml?: number
    crop_disease_status?: string
    sowing_date?: string
  } = {
    farm_id: input.farm_id,
    name: input.name,
    group: input.group,
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
  if (input.polygon && input.polygon.length >= 3) {
    const parsed = parsePlotPolygon(input.polygon)
    if (parsed) {
      row.polygon = parsed
      const gj = lotPolygonToGeoJsonPolygon(parsed)
      if (gj) row.geoJSON = gj
    }
  }
  if (input.soil_ph != null && Number.isFinite(input.soil_ph)) {
    row.soil_ph = input.soil_ph
  }
  if (input.irrigation_type) row.irrigation_type = input.irrigation_type
  if (input.fertilizer_type) row.fertilizer_type = input.fertilizer_type
  if (input.pesticide_usage_ml != null && Number.isFinite(input.pesticide_usage_ml)) {
    row.pesticide_usage_ml = input.pesticide_usage_ml
  }
  if (input.crop_disease_status) row.crop_disease_status = input.crop_disease_status
  const sd = input.sowing_date?.trim()
  if (sd) row.sowing_date = sd

  const { data: ownedFarm, error: farmCheckErr } = await supabase
    .from("farms")
    .select("id")
    .eq("id", input.farm_id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (farmCheckErr) throw new Error(farmCheckErr.message)
  if (!ownedFarm) {
    throw new Error("La granja no existe o no pertenece a tu cuenta")
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
  const farmIds = await getUserFarmIds(supabase)
  if (!farmIds || farmIds.length === 0) throw new Error("No autenticado")

  const { error } = await supabase
    .from("plots")
    .delete()
    .eq("id", id)
    .in("farm_id", farmIds)

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
    plan: (data.plan as UserPlan) ?? "free",
    createdAt: data.created_at ?? new Date().toISOString(),
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
// USAGE & PLAN LIMITS
// ──────────────────────────────────────────────

export async function getUserUsage(): Promise<UserUsage> {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) throw new Error("No autenticado")

  const { data: farms, error: farmsErr } = await supabase
    .from("farms")
    .select("id")
    .eq("user_id", user.id)

  if (farmsErr) throw new Error(farmsErr.message)

  const farmIds = (farms ?? []).map((f) => f.id)
  if (farmIds.length === 0) {
    return { farms: 0, plots: 0, hectares: 0 }
  }

  const { data: plots, error: plotsErr } = await supabase
    .from("plots")
    .select("area_ha")
    .in("farm_id", farmIds)

  if (plotsErr) throw new Error(plotsErr.message)

  const hectares = (plots ?? []).reduce(
    (sum, p) => sum + (Number(p.area_ha) || 0),
    0,
  )

  return {
    farms: farmIds.length,
    plots: (plots ?? []).length,
    hectares,
  }
}

async function checkPlanLimit(
  supabase: SupabaseClient,
  userId: string,
  action: "farm" | "plot",
): Promise<void> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .single()

  const plan: UserPlan = (profile?.plan as UserPlan) ?? "free"
  const limits = getPlanLimits(plan)

  const { data: farms } = await supabase
    .from("farms")
    .select("id")
    .eq("user_id", userId)

  const farmIds = (farms ?? []).map((f) => f.id)

  if (action === "farm") {
    if (farmIds.length >= limits.maxFarms) {
      throw new Error(
        `Tu plan ${limits.label} permite un máximo de ${limits.maxFarms} granja(s). Mejorá tu plan para continuar.`,
      )
    }
    return
  }

  if (farmIds.length === 0) return

  const { data: plots } = await supabase
    .from("plots")
    .select("area_ha")
    .in("farm_id", farmIds)

  const plotCount = (plots ?? []).length
  if (plotCount >= limits.maxPlots) {
    throw new Error(
      `Tu plan ${limits.label} permite un máximo de ${Number.isFinite(limits.maxPlots) ? limits.maxPlots : "ilimitados"} lotes. Mejorá tu plan para continuar.`,
    )
  }

  const totalHa = (plots ?? []).reduce(
    (sum, p) => sum + (Number(p.area_ha) || 0),
    0,
  )
  if (totalHa >= limits.maxHectares) {
    throw new Error(
      `Tu plan ${limits.label} permite un máximo de ${limits.maxHectares} hectáreas totales. Mejorá tu plan para continuar.`,
    )
  }
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
  await checkPlanLimit(supabase, user.id, "farm")

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
// YIELD BY CROP (plots + plot_previous_yields + plot_prediction)
// ──────────────────────────────────────────────

export async function getYieldComparisonByCrop(): Promise<YieldByCrop[]> {
  const supabase = createClient()
  const farmIds = await getUserFarmIds(supabase)
  if (!farmIds || farmIds.length === 0) return []

  // `plot_prediction` se consulta aparte: el embed desde plots puede fallar si PostgREST no tiene la relación inversa.
  const { data: plots, error } = await supabase
    .from("plots")
    .select(
      `
    id,
    crop_type,
    area_ha,
    plot_previous_yields ( position, yield_value, yield_unit )
  `,
    )
    .in("farm_id", farmIds)

  if (error) throw new Error(error.message)

  type PlotRow = {
    id: string
    crop_type: string | null
    area_ha: number | null
    plot_previous_yields: DbPlotPreviousYield[] | null
  }

  const rows = (plots ?? []) as PlotRow[]

  const predByPlotId = new Map<string, { ml_predicted_tn_ha: number | null }>()
  if (rows.length > 0) {
    const ids = rows.map((r) => r.id)
    const { data: preds, error: predErr } = await supabase
      .from("plot_prediction")
      .select("plot_id, ml_predicted_tn_ha")
      .in("plot_id", ids)

    if (!predErr && preds) {
      for (const row of preds) {
        predByPlotId.set(row.plot_id, {
          ml_predicted_tn_ha: row.ml_predicted_tn_ha,
        })
      }
    }
  }

  const byCrop = new Map<
    string,
    { actualNum: number; actualDen: number; predNum: number; predDen: number }
  >()

  for (const plot of rows) {
    const crop = plot.crop_type?.trim()
    if (!crop) continue

    const area = Number(plot.area_ha)
    const weight = Number.isFinite(area) && area > 0 ? area : 1

    const prevRows = plot.plot_previous_yields ?? []
    const H = weightedHistoricalTnHa(prevRows)
    const actualOne = lastHarvestTnHa(prevRows)
    const ml = parseMlPredicted(predByPlotId.get(plot.id) ?? null)
    const prediction = blendMlAndHistorical(ml, H)

    let acc = byCrop.get(crop)
    if (!acc) {
      acc = { actualNum: 0, actualDen: 0, predNum: 0, predDen: 0 }
      byCrop.set(crop, acc)
    }
    if (actualOne != null) {
      acc.actualNum += actualOne * weight
      acc.actualDen += weight
    }
    if (prediction != null) {
      acc.predNum += prediction * weight
      acc.predDen += weight
    }
  }

  const labels = sortCropLabels([...byCrop.keys()])
  return labels.map((crop) => {
    const acc = byCrop.get(crop)!
    return {
      crop,
      actual: acc.actualDen > 0 ? acc.actualNum / acc.actualDen : null,
      prediction: acc.predDen > 0 ? acc.predNum / acc.predDen : null,
    }
  })
}

// ──────────────────────────────────────────────
// DASHBOARD METRICS (computed from plots)
// ──────────────────────────────────────────────

export async function getDashboardMetrics(): Promise<DashboardMetric[]> {
  const supabase = createClient()
  const farmIds = await getUserFarmIds(supabase)
  const empty: DashboardMetric[] = [
    { id: "area", title: "Área Total", value: "0", unit: "hectáreas", change: "—", changeType: "neutral" },
    { id: "lots", title: "Lotes Activos", value: "0", unit: "lotes", change: "—", changeType: "neutral" },
    { id: "yield", title: "NDVI Promedio", value: "0.00", unit: "", change: "—", changeType: "neutral" },
  ]

  if (!farmIds || farmIds.length === 0) return empty

  const { data: plots, error } = await supabase
    .from("plots")
    .select("area_ha, ndvi_index")
    .in("farm_id", farmIds)

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
  const farmIds = await getUserFarmIds(supabase)
  if (!farmIds || farmIds.length === 0) return []

  const { data, error } = await supabase
    .from("plots")
    .select(
      "soil_ph, soil_moisture_percent, temperature_c, rainfall_mm, humidity_percent, ndvi_index",
    )
    .eq("id", plotId)
    .in("farm_id", farmIds)
    .maybeSingle()

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
