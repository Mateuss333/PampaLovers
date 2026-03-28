// ==============================================
// MOCK API SERVICE LAYER
// ==============================================
// This file simulates API calls with realistic delays.
// Replace these functions with actual REST API calls when ready.
// Each function returns a Promise that resolves after a simulated delay.

const SIMULATED_DELAY = 500 // ms

function delay<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), SIMULATED_DELAY))
}

// ==============================================
// TYPES
// ==============================================

export interface DashboardMetric {
  id: string
  title: string
  value: string
  unit: string
  change: string
  changeType: "positive" | "negative" | "neutral"
}

export interface YieldComparison {
  crop: string
  estimated: number
  actual: number
  predicted: number
}

export interface Activity {
  id: number
  message: string
  time: string
  type: "success" | "warning" | "info"
}

export interface MLStatus {
  imagesProcessed: number
  imagesToday: number
  accuracy: number
  accuracyChange: number
  nextUpdate: string
  source: string
}

export interface Lot {
  id: string
  name: string
  crop: string
  area: number
  status: "Sembrado" | "Crecimiento" | "Cosechado" | "Barbecho"
  ndvi: number
  predictedYield: number | null
  lastUpdated: string
}

export interface LotYieldRecord {
  year: number
  season: string
  crop: string
  actualYield: number
  area: number
  totalProduction: number
  predictedYield: number | null
  accuracy: number | null
}

export interface SatelliteLayer {
  id: string
  name: string
  type: "ndvi" | "evi" | "moisture" | "thermal"
}

export interface HistoricalYield {
  year: string
  soja: number | null
  maiz: number | null
  trigo: number | null
  predicted: number | null
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

export interface NDVITrend {
  month: string
  ndvi: number
  optimal: number
}

// ==============================================
// DASHBOARD API
// ==============================================

export async function getDashboardMetrics(): Promise<DashboardMetric[]> {
  return delay([
    {
      id: "area",
      title: "Área Total",
      value: "1,250",
      unit: "hectáreas",
      change: "+12%",
      changeType: "positive",
    },
    {
      id: "lots",
      title: "Lotes Activos",
      value: "24",
      unit: "lotes",
      change: "+3",
      changeType: "positive",
    },
    {
      id: "yield",
      title: "Rendimiento Promedio",
      value: "4.2",
      unit: "ton/ha",
      change: "+8%",
      changeType: "positive",
    },
  ])
}

export async function getYieldComparison(): Promise<YieldComparison[]> {
  return delay([
    { crop: "Soja", estimated: 3.2, actual: 3.0, predicted: 3.4 },
    { crop: "Maíz", estimated: 9.5, actual: 8.8, predicted: 9.8 },
    { crop: "Trigo", estimated: 4.1, actual: 3.9, predicted: 4.3 },
    { crop: "Girasol", estimated: 2.4, actual: 2.2, predicted: 2.5 },
  ])
}

export async function getRecentActivities(): Promise<Activity[]> {
  return delay([
    { id: 1, message: "Análisis ML completado para Lote A1", time: "Hace 2 min", type: "success" },
    { id: 2, message: "Alerta de estrés hídrico en Lote B2", time: "Hace 15 min", type: "warning" },
    { id: 3, message: "Nueva imagen satelital procesada", time: "Hace 1 hora", type: "info" },
    { id: 4, message: "Siembra completada en Lote C3", time: "Hace 3 horas", type: "success" },
    { id: 5, message: "Predicción actualizada para Zona Norte", time: "Hace 5 horas", type: "info" },
  ])
}

export async function getMLStatus(): Promise<MLStatus> {
  return delay({
    imagesProcessed: 147,
    imagesToday: 23,
    accuracy: 94.2,
    accuracyChange: 1.2,
    nextUpdate: "2h 34m",
    source: "Sentinel-2",
  })
}

// ==============================================
// LOTS API
// ==============================================

export async function fetchLots(): Promise<Lot[]> {
  return delay([
    { id: "A1", name: "Lote A1", crop: "Soja", area: 85, status: "Sembrado", ndvi: 0.78, predictedYield: 3.4, lastUpdated: "2026-03-26" },
    { id: "A2", name: "Lote A2", crop: "Maíz", area: 120, status: "Crecimiento", ndvi: 0.82, predictedYield: 9.8, lastUpdated: "2026-03-26" },
    { id: "B1", name: "Lote B1", crop: "Trigo", area: 95, status: "Cosechado", ndvi: 0.15, predictedYield: 4.1, lastUpdated: "2026-03-25" },
    { id: "B2", name: "Lote B2", crop: "Soja", area: 110, status: "Sembrado", ndvi: 0.65, predictedYield: 3.1, lastUpdated: "2026-03-26" },
    { id: "C1", name: "Lote C1", crop: "Girasol", area: 75, status: "Barbecho", ndvi: 0.22, predictedYield: null, lastUpdated: "2026-03-24" },
    { id: "C2", name: "Lote C2", crop: "Maíz", area: 140, status: "Crecimiento", ndvi: 0.88, predictedYield: 10.2, lastUpdated: "2026-03-26" },
    { id: "D1", name: "Lote D1", crop: "Soja", area: 90, status: "Sembrado", ndvi: 0.71, predictedYield: 3.2, lastUpdated: "2026-03-26" },
    { id: "D2", name: "Lote D2", crop: "Trigo", area: 105, status: "Crecimiento", ndvi: 0.75, predictedYield: 4.5, lastUpdated: "2026-03-26" },
  ])
}

export async function getLotById(id: string): Promise<Lot | null> {
  const lots = await fetchLots()
  return lots.find((lot) => lot.id === id) || null
}

export async function getLotYieldHistory(lotId: string): Promise<LotYieldRecord[]> {
  // Mock yield history data per lot
  const mockHistories: Record<string, LotYieldRecord[]> = {
    "A1": [
      { year: 2023, season: "2022/2023", crop: "Soja", actualYield: 3.1, area: 85, totalProduction: 263.5, predictedYield: 3.0, accuracy: 96.7 },
      { year: 2024, season: "2023/2024", crop: "Maíz", actualYield: 9.2, area: 85, totalProduction: 782, predictedYield: 9.0, accuracy: 97.8 },
      { year: 2025, season: "2024/2025", crop: "Trigo", actualYield: 4.0, area: 85, totalProduction: 340, predictedYield: 3.8, accuracy: 95.0 },
      { year: 2026, season: "2025/2026", crop: "Soja", actualYield: 0, area: 85, totalProduction: 0, predictedYield: 3.4, accuracy: null },
    ],
    "A2": [
      { year: 2023, season: "2022/2023", crop: "Maíz", actualYield: 8.8, area: 120, totalProduction: 1056, predictedYield: 8.5, accuracy: 96.6 },
      { year: 2024, season: "2023/2024", crop: "Soja", actualYield: 3.2, area: 120, totalProduction: 384, predictedYield: 3.1, accuracy: 96.9 },
      { year: 2025, season: "2024/2025", crop: "Maíz", actualYield: 9.5, area: 120, totalProduction: 1140, predictedYield: 9.2, accuracy: 96.8 },
      { year: 2026, season: "2025/2026", crop: "Maíz", actualYield: 0, area: 120, totalProduction: 0, predictedYield: 9.8, accuracy: null },
    ],
    "B1": [
      { year: 2023, season: "2022/2023", crop: "Trigo", actualYield: 3.8, area: 95, totalProduction: 361, predictedYield: 3.6, accuracy: 94.7 },
      { year: 2024, season: "2023/2024", crop: "Soja", actualYield: 2.9, area: 95, totalProduction: 275.5, predictedYield: 3.0, accuracy: 96.7 },
      { year: 2025, season: "2024/2025", crop: "Trigo", actualYield: 4.1, area: 95, totalProduction: 389.5, predictedYield: 4.0, accuracy: 97.6 },
    ],
    "B2": [
      { year: 2023, season: "2022/2023", crop: "Soja", actualYield: 2.8, area: 110, totalProduction: 308, predictedYield: 2.9, accuracy: 96.6 },
      { year: 2024, season: "2023/2024", crop: "Maíz", actualYield: 8.5, area: 110, totalProduction: 935, predictedYield: 8.2, accuracy: 96.5 },
      { year: 2025, season: "2024/2025", crop: "Soja", actualYield: 3.0, area: 110, totalProduction: 330, predictedYield: 2.9, accuracy: 96.7 },
      { year: 2026, season: "2025/2026", crop: "Soja", actualYield: 0, area: 110, totalProduction: 0, predictedYield: 3.1, accuracy: null },
    ],
    "C1": [
      { year: 2023, season: "2022/2023", crop: "Girasol", actualYield: 2.1, area: 75, totalProduction: 157.5, predictedYield: 2.0, accuracy: 95.2 },
      { year: 2024, season: "2023/2024", crop: "Soja", actualYield: 2.7, area: 75, totalProduction: 202.5, predictedYield: 2.8, accuracy: 96.4 },
      { year: 2025, season: "2024/2025", crop: "Girasol", actualYield: 2.3, area: 75, totalProduction: 172.5, predictedYield: 2.2, accuracy: 95.7 },
    ],
    "C2": [
      { year: 2023, season: "2022/2023", crop: "Maíz", actualYield: 9.0, area: 140, totalProduction: 1260, predictedYield: 8.8, accuracy: 97.7 },
      { year: 2024, season: "2023/2024", crop: "Trigo", actualYield: 4.2, area: 140, totalProduction: 588, predictedYield: 4.0, accuracy: 95.2 },
      { year: 2025, season: "2024/2025", crop: "Maíz", actualYield: 9.8, area: 140, totalProduction: 1372, predictedYield: 9.5, accuracy: 96.9 },
      { year: 2026, season: "2025/2026", crop: "Maíz", actualYield: 0, area: 140, totalProduction: 0, predictedYield: 10.2, accuracy: null },
    ],
    "D1": [
      { year: 2023, season: "2022/2023", crop: "Soja", actualYield: 3.0, area: 90, totalProduction: 270, predictedYield: 2.9, accuracy: 96.6 },
      { year: 2024, season: "2023/2024", crop: "Maíz", actualYield: 8.9, area: 90, totalProduction: 801, predictedYield: 8.7, accuracy: 97.7 },
      { year: 2025, season: "2024/2025", crop: "Soja", actualYield: 3.1, area: 90, totalProduction: 279, predictedYield: 3.0, accuracy: 96.8 },
      { year: 2026, season: "2025/2026", crop: "Soja", actualYield: 0, area: 90, totalProduction: 0, predictedYield: 3.2, accuracy: null },
    ],
    "D2": [
      { year: 2023, season: "2022/2023", crop: "Trigo", actualYield: 3.9, area: 105, totalProduction: 409.5, predictedYield: 3.7, accuracy: 94.9 },
      { year: 2024, season: "2023/2024", crop: "Soja", actualYield: 3.1, area: 105, totalProduction: 325.5, predictedYield: 3.0, accuracy: 96.8 },
      { year: 2025, season: "2024/2025", crop: "Trigo", actualYield: 4.3, area: 105, totalProduction: 451.5, predictedYield: 4.1, accuracy: 95.3 },
      { year: 2026, season: "2025/2026", crop: "Trigo", actualYield: 0, area: 105, totalProduction: 0, predictedYield: 4.5, accuracy: null },
    ],
  }
  
  return delay(mockHistories[lotId] || [])
}

// ==============================================
// SATELLITE API
// ==============================================

export async function getSatelliteLayers(): Promise<SatelliteLayer[]> {
  return delay([
    { id: "ndvi", name: "NDVI", type: "ndvi" },
    { id: "evi", name: "EVI", type: "evi" },
    { id: "moisture", name: "Humedad", type: "moisture" },
    { id: "thermal", name: "Térmico", type: "thermal" },
  ])
}

export async function getMLAnalysisProgress(): Promise<{ status: string; progress: number }> {
  return delay({ status: "Procesando", progress: 78 })
}

// ==============================================
// ANALYTICS API
// ==============================================

export async function getHistoricalYields(): Promise<HistoricalYield[]> {
  return delay([
    { year: "2021", soja: 2.8, maiz: 8.2, trigo: 3.6, predicted: null },
    { year: "2022", soja: 3.0, maiz: 8.8, trigo: 3.9, predicted: null },
    { year: "2023", soja: 2.9, maiz: 9.1, trigo: 4.0, predicted: null },
    { year: "2024", soja: 3.2, maiz: 9.4, trigo: 4.1, predicted: null },
    { year: "2025", soja: 3.1, maiz: 9.6, trigo: 4.2, predicted: null },
    { year: "2026", soja: null, maiz: null, trigo: null, predicted: 3.4 },
  ])
}

export async function getSoilMetrics(lotId: string): Promise<SoilMetric[]> {
  // In production, lotId would be used to fetch specific lot data
  void lotId
  return delay([
    { id: "ph", title: "pH del Suelo", value: "6.8", unit: "", status: "Óptimo", description: "Rango ideal: 6.0 - 7.5", trend: "+0.2 vs temporada anterior" },
    { id: "moisture", title: "Humedad", value: "42", unit: "%", status: "Normal", description: "Capacidad de campo", trend: "Estable" },
    { id: "nitrogen", title: "Nitrógeno", value: "85", unit: "ppm", status: "Alto", description: "Nivel de N disponible", trend: "+12 ppm este mes" },
    { id: "temp", title: "Temperatura Suelo", value: "22", unit: "°C", status: "Ideal", description: "A 10cm de profundidad", trend: "+3°C vs mes anterior" },
    { id: "phosphorus", title: "Fósforo", value: "28", unit: "ppm", status: "Moderado", description: "Nivel de P disponible", trend: "-5 ppm (aplicar)" },
    { id: "potassium", title: "Potasio", value: "156", unit: "ppm", status: "Óptimo", description: "Nivel de K disponible", trend: "Estable" },
  ])
}

export async function getNDVITrend(): Promise<NDVITrend[]> {
  return delay([
    { month: "Ene", ndvi: 0.45, optimal: 0.75 },
    { month: "Feb", ndvi: 0.52, optimal: 0.78 },
    { month: "Mar", ndvi: 0.68, optimal: 0.80 },
    { month: "Abr", ndvi: 0.75, optimal: 0.82 },
    { month: "May", ndvi: 0.78, optimal: 0.80 },
    { month: "Jun", ndvi: 0.72, optimal: 0.75 },
    { month: "Jul", ndvi: 0.65, optimal: 0.70 },
    { month: "Ago", ndvi: 0.55, optimal: 0.65 },
    { month: "Sep", ndvi: 0.48, optimal: 0.60 },
    { month: "Oct", ndvi: 0.42, optimal: 0.55 },
    { month: "Nov", ndvi: 0.50, optimal: 0.65 },
    { month: "Dic", ndvi: 0.58, optimal: 0.72 },
  ])
}

// ==============================================
// SETTINGS API
// ==============================================

export interface UserProfile {
  firstName: string
  lastName: string
  email: string
  avatar: string | null
}

export interface FarmSettings {
  name: string
  size: number
  location: string
  timezone: string
  currency: string
}

export async function getUserProfile(): Promise<UserProfile> {
  return delay({
    firstName: "Juan",
    lastName: "Martinez",
    email: "juan@agrosmart.com",
    avatar: null,
  })
}

export async function getFarmSettings(): Promise<FarmSettings> {
  return delay({
    name: "Estancia La Esperanza",
    size: 1250,
    location: "Pergamino, Buenos Aires, Argentina",
    timezone: "america-buenos-aires",
    currency: "ars",
  })
}
