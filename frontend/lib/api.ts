// ==============================================
// MOCK API SERVICE LAYER (funciones sin backing DB)
// ==============================================
// Las funciones con datos reales fueron migradas a supabase-api.ts.
// Este archivo conserva solo mocks para ML, satellite, yields historicos
// y actividades, que aun no tienen tablas en la base de datos.

const SIMULATED_DELAY = 500 // ms

function delay<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), SIMULATED_DELAY))
}

// ==============================================
// TYPES
// ==============================================

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

export interface NDVITrend {
  month: string
  ndvi: number
  optimal: number
}

// ==============================================
// DASHBOARD API (mock)
// ==============================================

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
// LOT YIELD HISTORY (mock — schema lacks year/season/crop)
// ==============================================

export async function getLotYieldHistory(lotId: string): Promise<LotYieldRecord[]> {
  const mockHistories: Record<string, LotYieldRecord[]> = {
    "A1": [
      { year: 2023, season: "2022/2023", crop: "Soja", actualYield: 3.1, area: 85, totalProduction: 263.5, predictedYield: 3.0, accuracy: 96.7 },
      { year: 2024, season: "2023/2024", crop: "Maíz", actualYield: 9.2, area: 85, totalProduction: 782, predictedYield: 9.0, accuracy: 97.8 },
      { year: 2025, season: "2024/2025", crop: "Trigo", actualYield: 4.0, area: 85, totalProduction: 340, predictedYield: 3.8, accuracy: 95.0 },
      { year: 2026, season: "2025/2026", crop: "Soja", actualYield: 0, area: 85, totalProduction: 0, predictedYield: 3.4, accuracy: null },
    ],
  }
  void lotId
  return delay(mockHistories[lotId] || [])
}

// ==============================================
// SATELLITE API (mock)
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
// ANALYTICS API (mock)
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
