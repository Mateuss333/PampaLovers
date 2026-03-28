const EOS_STATS_TASK_URL = "https://api-connect.eos.com/api/gdw/api"
const EOS_SEARCH_URL = "https://api-connect.eos.com/api/lms/search/v2"
const EOS_RENDER_BASE_URL = "https://api-connect.eos.com/api/render"
const EOS_WEATHER_HISTORY_URL = "https://api-connect.eos.com/weather/forecast-history"
const EOS_STATS_SENSORS = ["sentinel2"] as const
const EOS_POINT_SEARCH_SATELLITES = ["sentinel2l2a"] as const
const EOS_SOIL_MOISTURE_SENSOR = ["soilmoisture"] as const
const EOS_POLL_INTERVAL_MS = 2_500
const EOS_POLL_MAX_ATTEMPTS = 12
const EOS_SEARCH_PAGE_SIZE = 100
const EOS_MAX_SEARCH_PAGES = 5
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

type Coordinate = [number, number]
type LotPolygon = Coordinate[]

interface PolygonGeoJson {
  type: "Polygon"
  coordinates: Coordinate[][]
}

interface PointGeoJson {
  type: "Point"
  coordinates: Coordinate
}

type EosGeometry = PolygonGeoJson | PointGeoJson

interface PolygonLocation {
  kind: "polygon"
  polygon: PolygonGeoJson
  centroid: {
    latitude: number
    longitude: number
  }
}

interface PointLocation {
  kind: "point"
  latitude: number
  longitude: number
}

type PlotLocation = PolygonLocation | PointLocation

interface EosTaskResponse {
  status?: string
  task_id?: string
  result?: unknown
}

interface EosStatsScene {
  view_id?: string
  satellite?: string
  indexes?: Record<string, { average?: number | string | null }>
}

interface EosSearchScene {
  view_id?: string
  satellite?: string
}

interface EosSearchResponse {
  results?: EosSearchScene[]
  meta?: {
    found?: number
  }
}

interface EosHistoricalWeatherDay {
  temperature_c?: number | string | null
  temperature_min?: number | string | null
  temperature_max?: number | string | null
  rainfall?: number | string | null
  humidity?: number | string | null
  relative_humidity?: number | string | null
  vapour_pressure?: number | string | null
}

interface EosSoilMoistureScene {
  average?: number | string | null
}

interface AggregatedWeather {
  soil_moisture_percent: number
  temperature_c: number
  rainfall_mm: number
  humidity_percent: number
}

export interface PlotExternalMetrics {
  ndvi_index?: number
  soil_moisture_percent?: number
  temperature_c?: number
  rainfall_mm?: number
  humidity_percent?: number
}

export interface PlotExternalDataResult {
  dateFrom: string | null
  dateTo: string | null
  metrics: PlotExternalMetrics
  warnings: string[]
}

export interface CollectPlotExternalDataInput {
  polygon?: unknown
  latitude?: number | null
  longitude?: number | null
  sowingDate: string
}

export function parseLotPolygon(raw: unknown): LotPolygon | undefined {
  if (!Array.isArray(raw) || raw.length < 3) return undefined

  const points: LotPolygon = []
  for (const item of raw) {
    if (!Array.isArray(item) || item.length < 2) return undefined
    const lon = Number(item[0])
    const lat = Number(item[1])
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return undefined
    points.push([lon, lat])
  }

  return points
}

export function polygonToGeoJson(polygon: LotPolygon): PolygonGeoJson | null {
  if (polygon.length < 3) return null

  const ring = polygon.map(([lon, lat]) => [
    roundGeographicCoord(lon, 6),
    roundGeographicCoord(lat, 6),
  ] as Coordinate)

  const closedRing = ensureClosedRing(ring)
  if (countDistinctVertices(closedRing) < 3 || closedRing.length < 4) return null

  return {
    type: "Polygon",
    coordinates: [closedRing],
  }
}

export function centroidFromPolygon(polygon: LotPolygon): {
  latitude: number
  longitude: number
} | null {
  const geoJson = polygonToGeoJson(polygon)
  if (!geoJson) return null
  return calculateCentroidFromPolygon(geoJson)
}

export async function collectPlotExternalData(
  input: CollectPlotExternalDataInput,
): Promise<PlotExternalDataResult> {
  const warnings: string[] = []
  const resolvedRange = resolveDateRangeFromSowingDate(input.sowingDate)

  if (!resolvedRange.ok) {
    warnings.push(resolvedRange.message)
    return {
      dateFrom: null,
      dateTo: null,
      metrics: {},
      warnings,
    }
  }

  const location = buildPlotLocation(input)
  if (!location.ok) {
    warnings.push(location.message)
    return {
      dateFrom: resolvedRange.dateFrom,
      dateTo: resolvedRange.dateTo,
      metrics: {},
      warnings,
    }
  }

  const eosApiKey = process.env.EOS_API_KEY?.trim()
  if (!eosApiKey) {
    warnings.push(
      "No se configuro EOS_API_KEY en el frontend server, asi que el lote se guardo sin datos automaticos.",
    )
    return {
      dateFrom: resolvedRange.dateFrom,
      dateTo: resolvedRange.dateTo,
      metrics: {},
      warnings,
    }
  }

  const [ndviResult, weatherResult] = await Promise.allSettled([
    fetchNdviFromEos(location.value, resolvedRange.dateFrom, resolvedRange.dateTo, eosApiKey),
    fetchWeatherFromEos(location.value, resolvedRange.dateFrom, resolvedRange.dateTo, eosApiKey),
  ])

  const metrics: PlotExternalMetrics = {}

  if (ndviResult.status === "fulfilled") {
    metrics.ndvi_index = ndviResult.value.avg
  } else {
    warnings.push(
      `No se pudo obtener NDVI automaticamente: ${formatUnknownError(ndviResult.reason)}`,
    )
  }

  if (weatherResult.status === "fulfilled") {
    Object.assign(metrics, weatherResult.value)
  } else {
    warnings.push(
      `No se pudieron obtener metricas climaticas automaticamente: ${formatUnknownError(weatherResult.reason)}`,
    )
  }

  return {
    dateFrom: resolvedRange.dateFrom,
    dateTo: resolvedRange.dateTo,
    metrics,
    warnings,
  }
}

function resolveDateRangeFromSowingDate(
  sowingDate: string,
): { ok: true; dateFrom: string; dateTo: string } | { ok: false; message: string } {
  const dateFrom = sowingDate.trim()
  const dateTo = getTodayDateString()

  if (!DATE_REGEX.test(dateFrom) || !isValidDateString(dateFrom)) {
    return {
      ok: false,
      message: "La fecha de siembra no tiene un formato valido (YYYY-MM-DD).",
    }
  }

  if (dateFrom > dateTo) {
    return {
      ok: false,
      message:
        "La fecha de siembra es futura respecto de hoy, por eso no se consultaron metricas automaticas.",
    }
  }

  return {
    ok: true,
    dateFrom,
    dateTo,
  }
}

function buildPlotLocation(
  input: CollectPlotExternalDataInput,
): { ok: true; value: PlotLocation } | { ok: false; message: string } {
  const polygon = parseLotPolygon(input.polygon)
  if (polygon) {
    const geoJson = polygonToGeoJson(polygon)
    const centroid = centroidFromPolygon(polygon)
    if (geoJson && centroid) {
      return {
        ok: true,
        value: {
          kind: "polygon",
          polygon: geoJson,
          centroid,
        },
      }
    }
  }

  const latitude = normalizeNumber(input.latitude)
  const longitude = normalizeNumber(input.longitude)
  if (isValidLatitude(latitude) && isValidLongitude(longitude)) {
    return {
      ok: true,
      value: {
        kind: "point",
        latitude,
        longitude,
      },
    }
  }

  return {
    ok: false,
    message:
      "El formulario no trae un poligono valido ni coordenadas suficientes para consultar la API externa.",
  }
}

async function fetchNdviFromEos(
  location: PlotLocation,
  dateFrom: string,
  dateTo: string,
  eosApiKey: string,
): Promise<{ avg: number }> {
  if (location.kind === "polygon") {
    const statsResult = await fetchNdviStatsForPolygon(
      location.polygon,
      dateFrom,
      dateTo,
      eosApiKey,
    )
    return {
      avg: extractAverageNdvi(statsResult),
    }
  }

  const pointValues = await fetchNdviSamplesForPoint(
    location.latitude,
    location.longitude,
    dateFrom,
    dateTo,
    eosApiKey,
  )

  return {
    avg: extractAverageNdvi(pointValues),
  }
}

async function fetchWeatherFromEos(
  location: PlotLocation,
  dateFrom: string,
  dateTo: string,
  eosApiKey: string,
): Promise<AggregatedWeather> {
  const geometry = buildEosGeometry(location)

  const [weatherSeries, soilMoistureSeries] = await Promise.all([
    fetchHistoricalWeatherFromEos(geometry, dateFrom, dateTo, eosApiKey),
    fetchSoilMoistureFromEos(geometry, dateFrom, dateTo, eosApiKey),
  ])

  return aggregateWeatherData(weatherSeries, soilMoistureSeries)
}

function buildEosGeometry(location: PlotLocation): EosGeometry {
  if (location.kind === "polygon") {
    return location.polygon
  }

  return {
    type: "Point",
    coordinates: [location.longitude, location.latitude],
  }
}

async function fetchHistoricalWeatherFromEos(
  geometry: EosGeometry,
  dateFrom: string,
  dateTo: string,
  eosApiKey: string,
): Promise<EosHistoricalWeatherDay[]> {
  const requestUrl = new URL(EOS_WEATHER_HISTORY_URL)
  requestUrl.searchParams.set("api_key", eosApiKey)

  const response = await fetch(requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": eosApiKey,
    },
    body: JSON.stringify({
      geometry,
      start_date: dateFrom,
      end_date: dateTo,
    }),
  })

  if (!response.ok) {
    throw new Error(`EOS weather history devolvio HTTP ${response.status}.`)
  }

  const payload = (await response.json()) as unknown
  if (!Array.isArray(payload)) {
    throw new Error("EOS weather history devolvio un payload invalido.")
  }

  return payload as EosHistoricalWeatherDay[]
}

async function fetchSoilMoistureFromEos(
  geometry: EosGeometry,
  dateFrom: string,
  dateTo: string,
  eosApiKey: string,
): Promise<EosSoilMoistureScene[]> {
  const createTaskUrl = new URL(EOS_STATS_TASK_URL)
  createTaskUrl.searchParams.set("api_key", eosApiKey)

  const createResponse = await fetch(createTaskUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": eosApiKey,
    },
    body: JSON.stringify({
      type: "mt_stats",
      params: {
        bm_type: "soilmoisture",
        date_start: dateFrom,
        date_end: dateTo,
        geometry,
        sensors: EOS_SOIL_MOISTURE_SENSOR,
        reference: `plot_weather_${crypto.randomUUID()}`,
        limit: 200,
      },
    }),
  })

  if (!createResponse.ok) {
    throw new Error(`EOS soil moisture task devolvio HTTP ${createResponse.status}.`)
  }

  const createTaskResult = (await createResponse.json()) as EosTaskResponse
  const taskId = createTaskResult.task_id
  if (!taskId) {
    throw new Error("EOS soil moisture no devolvio task_id.")
  }

  for (let attempt = 1; attempt <= EOS_POLL_MAX_ATTEMPTS; attempt += 1) {
    await delay(EOS_POLL_INTERVAL_MS)

    const taskStatusUrl = new URL(`${EOS_STATS_TASK_URL}/${taskId}`)
    taskStatusUrl.searchParams.set("api_key", eosApiKey)

    const statusResponse = await fetch(taskStatusUrl, {
      method: "GET",
      headers: {
        "x-api-key": eosApiKey,
      },
    })

    if (!statusResponse.ok) {
      throw new Error(
        `Fallo el polling de soil moisture en EOS con HTTP ${statusResponse.status}.`,
      )
    }

    const taskStatus = (await statusResponse.json()) as EosTaskResponse
    if (Array.isArray(taskStatus.result)) {
      return taskStatus.result as EosSoilMoistureScene[]
    }

    if (taskStatus.status === "failed" || taskStatus.status === "error") {
      throw new Error("EOS marco la tarea de soil moisture como fallida.")
    }
  }

  throw new Error("EOS no completo la tarea de soil moisture dentro del tiempo esperado.")
}

async function fetchNdviStatsForPolygon(
  polygon: PolygonGeoJson,
  dateFrom: string,
  dateTo: string,
  eosApiKey: string,
): Promise<EosStatsScene[]> {
  const createTaskUrl = new URL(EOS_STATS_TASK_URL)
  createTaskUrl.searchParams.set("api_key", eosApiKey)

  const createResponse = await fetch(createTaskUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "mt_stats",
      params: {
        bm_type: ["NDVI"],
        date_start: dateFrom,
        date_end: dateTo,
        geometry: polygon,
        sensors: EOS_STATS_SENSORS,
        reference: `plot_ndvi_${crypto.randomUUID()}`,
      },
    }),
  })

  if (!createResponse.ok) {
    throw new Error(`EOS NDVI task devolvio HTTP ${createResponse.status}.`)
  }

  const createTaskResult = (await createResponse.json()) as EosTaskResponse
  const taskId = createTaskResult.task_id
  if (!taskId) {
    throw new Error("EOS NDVI no devolvio task_id.")
  }

  for (let attempt = 1; attempt <= EOS_POLL_MAX_ATTEMPTS; attempt += 1) {
    await delay(EOS_POLL_INTERVAL_MS)

    const taskStatusUrl = new URL(`${EOS_STATS_TASK_URL}/${taskId}`)
    taskStatusUrl.searchParams.set("api_key", eosApiKey)

    const statusResponse = await fetch(taskStatusUrl, {
      method: "GET",
      headers: {
        "x-api-key": eosApiKey,
      },
    })

    if (!statusResponse.ok) {
      throw new Error(`Fallo el polling de NDVI en EOS con HTTP ${statusResponse.status}.`)
    }

    const taskStatus = (await statusResponse.json()) as EosTaskResponse
    if (Array.isArray(taskStatus.result)) {
      return taskStatus.result as EosStatsScene[]
    }

    if (taskStatus.status === "failed" || taskStatus.status === "error") {
      throw new Error("EOS marco la tarea de NDVI como fallida.")
    }
  }

  throw new Error("EOS no completo la tarea de NDVI dentro del tiempo esperado.")
}

async function fetchNdviSamplesForPoint(
  latitude: number,
  longitude: number,
  dateFrom: string,
  dateTo: string,
  eosApiKey: string,
): Promise<number[]> {
  const scenes = await searchScenesForPoint(latitude, longitude, dateFrom, dateTo, eosApiKey)
  if (scenes.length === 0) {
    throw new Error("EOS no devolvio escenas para el punto consultado.")
  }

  const values: number[] = []

  for (const scene of scenes) {
    const scenePath = buildScenePath(scene.view_id)
    if (!scenePath) continue

    const sensorCode = getRenderSensorCode(scene.view_id, scene.satellite)
    if (!sensorCode) continue

    const pointUrl = new URL(
      `${EOS_RENDER_BASE_URL}/${sensorCode}/point/${scenePath}/NDVI/${latitude}/${longitude}`,
    )
    pointUrl.searchParams.set("CALIBRATE", "1")
    pointUrl.searchParams.set("api_key", eosApiKey)

    const pointResponse = await fetch(pointUrl, {
      method: "GET",
      headers: {
        "x-api-key": eosApiKey,
      },
    })

    if (!pointResponse.ok) continue

    const pointData = (await pointResponse.json()) as { index_value?: number | string | null }
    const indexValue = normalizeNumber(pointData.index_value)
    if (isValidNdvi(indexValue)) {
      values.push(indexValue)
    }
  }

  if (values.length === 0) {
    throw new Error("EOS no devolvio valores NDVI numericos para el punto consultado.")
  }

  return values
}

async function searchScenesForPoint(
  latitude: number,
  longitude: number,
  dateFrom: string,
  dateTo: string,
  eosApiKey: string,
): Promise<EosStatsScene[]> {
  const scenes: EosStatsScene[] = []

  for (let page = 1; page <= EOS_MAX_SEARCH_PAGES; page += 1) {
    const searchUrl = new URL(EOS_SEARCH_URL)
    searchUrl.searchParams.set("api_key", eosApiKey)

    const response = await fetch(searchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": eosApiKey,
      },
      body: JSON.stringify({
        limit: EOS_SEARCH_PAGE_SIZE,
        page,
        search: {
          satellites: EOS_POINT_SEARCH_SATELLITES,
          date: {
            from: dateFrom,
            to: dateTo,
          },
          shape: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`EOS scene search devolvio HTTP ${response.status}.`)
    }

    const payload = (await response.json()) as EosSearchResponse
    const pageResults = Array.isArray(payload.results) ? payload.results : []
    scenes.push(...pageResults)

    const found = payload.meta?.found ?? pageResults.length
    const totalPages = Math.max(1, Math.ceil(found / EOS_SEARCH_PAGE_SIZE))
    if (page >= totalPages || pageResults.length === 0) {
      break
    }
  }

  const deduplicated = new Map<string, EosStatsScene>()
  for (const scene of scenes) {
    if (scene.view_id) {
      deduplicated.set(scene.view_id, scene)
    }
  }

  return Array.from(deduplicated.values())
}

function aggregateWeatherData(
  weatherDays: EosHistoricalWeatherDay[],
  soilMoistureScenes: EosSoilMoistureScene[],
): AggregatedWeather {
  if (weatherDays.length === 0) {
    throw new Error("EOS no devolvio dias de clima para el rango pedido.")
  }

  if (soilMoistureScenes.length === 0) {
    throw new Error("EOS no devolvio humedad de suelo para el rango pedido.")
  }

  const soilMoistureValues = soilMoistureScenes
    .map((scene) => normalizeNumber(scene.average))
    .filter(isNonNullNumber)

  const temperatureValues = weatherDays
    .map((day) => extractDailyMeanTemperature(day))
    .filter(isNonNullNumber)

  const rainfallValues = weatherDays
    .map((day) => normalizeNumber(day.rainfall) ?? 0)
    .filter((value) => Number.isFinite(value))

  const humidityValues = weatherDays
    .map((day) => extractDailyHumidity(day))
    .filter(isNonNullNumber)

  if (soilMoistureValues.length === 0) {
    throw new Error("EOS no devolvio promedios numericos de humedad de suelo.")
  }

  if (temperatureValues.length === 0) {
    throw new Error("EOS no devolvio temperaturas numericas.")
  }

  if (humidityValues.length === 0) {
    throw new Error("EOS no devolvio humedad suficiente para calcular el promedio.")
  }

  return {
    soil_moisture_percent: roundTo2Decimals(average(soilMoistureValues)),
    temperature_c: roundTo2Decimals(average(temperatureValues)),
    rainfall_mm: roundTo2Decimals(sum(rainfallValues)),
    humidity_percent: roundTo2Decimals(average(humidityValues)),
  }
}

function extractAverageNdvi(input: EosStatsScene[] | number[]): number {
  const values =
    Array.isArray(input) && input.length > 0 && typeof input[0] === "number"
      ? (input as number[])
      : extractSceneAverages(input as EosStatsScene[])

  if (values.length === 0) {
    throw new Error("EOS no devolvio valores NDVI para el rango pedido.")
  }

  return roundTo4Decimals(sum(values) / values.length)
}

function extractSceneAverages(scenes: EosStatsScene[]): number[] {
  const values: number[] = []

  for (const scene of scenes) {
    const ndviAverage = normalizeNumber(scene.indexes?.NDVI?.average)
    if (isValidNdvi(ndviAverage)) {
      values.push(ndviAverage)
    }
  }

  return values
}

function extractDailyMeanTemperature(day: EosHistoricalWeatherDay): number | null {
  const explicitTemperature = normalizeNumber(day.temperature_c)
  if (explicitTemperature != null) {
    return explicitTemperature
  }

  const minTemperature = normalizeNumber(day.temperature_min)
  const maxTemperature = normalizeNumber(day.temperature_max)

  if (minTemperature == null || maxTemperature == null) {
    return null
  }

  return (minTemperature + maxTemperature) / 2
}

function extractDailyHumidity(day: EosHistoricalWeatherDay): number | null {
  const directHumidity =
    normalizeNumber(day.humidity) ?? normalizeNumber(day.relative_humidity)

  if (directHumidity != null) {
    return clampPercentage(directHumidity)
  }

  const vapourPressure = normalizeNumber(day.vapour_pressure)
  const meanTemperature = extractDailyMeanTemperature(day)

  if (vapourPressure == null || meanTemperature == null) {
    return null
  }

  return estimateHumidityFromVapourPressure(vapourPressure, meanTemperature)
}

function estimateHumidityFromVapourPressure(
  vapourPressure: number,
  temperatureC: number,
): number | null {
  const saturationVapourPressureKpa =
    0.6108 * Math.exp((17.27 * temperatureC) / (temperatureC + 237.3))

  if (!Number.isFinite(saturationVapourPressureKpa) || saturationVapourPressureKpa <= 0) {
    return null
  }

  const actualVapourPressureKpa = vapourPressure > 2 ? vapourPressure / 10 : vapourPressure
  const humidity = (actualVapourPressureKpa / saturationVapourPressureKpa) * 100

  if (!Number.isFinite(humidity)) {
    return null
  }

  return clampPercentage(humidity)
}

function calculateCentroidFromPolygon(polygon: PolygonGeoJson): {
  latitude: number
  longitude: number
} {
  const ring = ensureClosedRing(polygon.coordinates[0])

  let twiceSignedArea = 0
  let centroidX = 0
  let centroidY = 0

  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x1, y1] = ring[index]
    const [x2, y2] = ring[index + 1]
    const cross = x1 * y2 - x2 * y1

    twiceSignedArea += cross
    centroidX += (x1 + x2) * cross
    centroidY += (y1 + y2) * cross
  }

  if (Math.abs(twiceSignedArea) < Number.EPSILON) {
    const uniqueVertices = ring.slice(0, -1)
    return {
      longitude: uniqueVertices.reduce((sum, [value]) => sum + value, 0) / uniqueVertices.length,
      latitude: uniqueVertices.reduce((sum, [, value]) => sum + value, 0) / uniqueVertices.length,
    }
  }

  const factor = 1 / (3 * twiceSignedArea)

  return {
    latitude: centroidY * factor,
    longitude: centroidX * factor,
  }
}

function buildScenePath(viewId: string | undefined): string | null {
  if (!viewId || !viewId.includes("/")) {
    return null
  }

  const segments = viewId.split("/")
  if (segments.length < 2) {
    return null
  }

  return segments.slice(1).map(encodeURIComponent).join("/")
}

function getRenderSensorCode(
  viewId: string | undefined,
  satellite: string | undefined,
): string | null {
  const viewSensorCode = viewId?.split("/")[0] ?? null
  if (viewSensorCode === "S2" || viewSensorCode === "L8" || viewSensorCode === "L9") {
    return viewSensorCode
  }

  switch (satellite) {
    case "sentinel2":
    case "sentinel2l1c":
    case "sentinel2l2a":
      return "S2"
    case "landsat8":
    case "landsat8c2l1":
    case "landsat8c2l2":
      return "L8"
    case "landsat9":
    case "landsat9c2l1":
    case "landsat9c2l2":
      return "L9"
    default:
      return null
  }
}

function average(values: number[]): number {
  return sum(values) / values.length
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function clampPercentage(value: number): number {
  if (value < 0) return 0
  if (value > 100) return 100
  return value
}

function ensureClosedRing(ring: Coordinate[]): Coordinate[] {
  if (ring.length === 0) return ring

  const [firstLongitude, firstLatitude] = ring[0]
  const [lastLongitude, lastLatitude] = ring[ring.length - 1]

  if (firstLongitude === lastLongitude && firstLatitude === lastLatitude) {
    return ring
  }

  return [...ring, ring[0]]
}

function countDistinctVertices(ring: Coordinate[]): number {
  return new Set(ring.slice(0, -1).map(([longitude, latitude]) => `${longitude},${latitude}`))
    .size
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function isNonNullNumber(value: number | null): value is number {
  return value != null && Number.isFinite(value)
}

function isValidNdvi(value: number | null): value is number {
  return value != null && value >= -1 && value <= 1
}

function isValidLatitude(value: number | null): value is number {
  return value != null && value >= -90 && value <= 90
}

function isValidLongitude(value: number | null): value is number {
  return value != null && value >= -180 && value <= 180
}

function roundTo2Decimals(value: number): number {
  return Number(value.toFixed(2))
}

function roundTo4Decimals(value: number): number {
  return Number(value.toFixed(4))
}

function roundGeographicCoord(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function getTodayDateString(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

function isValidDateString(value: string): boolean {
  if (!DATE_REGEX.test(value)) return false

  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return "error desconocido"
}
