import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
} as const;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// TODO: replace with the exact EOS endpoint/version used by your account if it differs.
const EOS_STATS_TASK_URL = "https://api-connect.eos.com/api/gdw/api";
// TODO: replace with the exact EOS endpoint/version used by your account if it differs.
const EOS_WEATHER_HISTORY_URL = "https://api-connect.eos.com/weather/forecast-history";
const EOS_SOIL_MOISTURE_SENSOR = ["soilmoisture"];
const EOS_POLL_INTERVAL_MS = 2_500;
const EOS_POLL_MAX_ATTEMPTS = 12;

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonValue[];

interface JsonObject {
  [key: string]: JsonValue;
}

interface RequestPayload {
  plotId: string;
  dateFrom: string;
  dateTo: string;
}

type Coordinate = [number, number];

interface PolygonGeoJson {
  type: "Polygon";
  coordinates: Coordinate[][];
}

interface PointGeoJson {
  type: "Point";
  coordinates: Coordinate;
}

type EosGeometry = PolygonGeoJson | PointGeoJson;

interface PlotRecord extends Record<string, unknown> {
  id: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  geoJson?: JsonValue;
  geojson?: JsonValue;
  geoJSON?: JsonValue;
}

interface PolygonLocation {
  kind: "polygon";
  plotId: string;
  polygon: PolygonGeoJson;
  centroid: {
    latitude: number;
    longitude: number;
  };
  source: {
    usedGeoJson: true;
    usedLatLonFallback: false;
  };
}

interface PointLocation {
  kind: "point";
  plotId: string;
  latitude: number;
  longitude: number;
  source: {
    usedGeoJson: false;
    usedLatLonFallback: true;
  };
}

type PlotLocation = PolygonLocation | PointLocation;

interface EosTaskResponse {
  status?: string;
  task_id?: string;
  req_id?: string;
  task_timeout?: number;
  result?: unknown;
  errors?: unknown;
}

interface EosSoilMoistureScene {
  date?: string;
  average?: number | string | null;
  ctime_10?: number | string | null;
}

interface EosHistoricalWeatherDay {
  date?: string;
  temperature_min?: number | string | null;
  temperature_max?: number | string | null;
  rainfall?: number | string | null;
  humidity?: number | string | null;
  relative_humidity?: number | string | null;
  vapour_pressure?: number | string | null;
}

export interface AggregatedWeather {
  soil_moisture_percent: number;
  temperature_c: number;
  rainfall_mm: number;
  humidity_percent: number;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

if (import.meta.main) {
  Deno.serve(async (request) => {
    if (request.method === "OPTIONS") {
      return new Response("ok", { status: 200, headers: CORS_HEADERS });
    }

    if (request.method !== "POST") {
      return jsonResponse(405, {
        error: "Method not allowed. Use POST.",
      });
    }

    try {
      const payload = await parseRequestPayload(request);
      const supabase = createSupabaseAdminClient();

      console.log("[fetch-plot-weather] Incoming request", payload);

      const location = await getPlotLocation(supabase, payload.plotId);
      const weather = await fetchWeatherFromEos(location, payload.dateFrom, payload.dateTo);

      return jsonResponse(200, {
        plotId: payload.plotId,
        dateFrom: payload.dateFrom,
        dateTo: payload.dateTo,
        source: location.source,
        weather,
      });
    } catch (error) {
      if (error instanceof HttpError) {
        console.error("[fetch-plot-weather] Request failed", {
          status: error.status,
          message: error.message,
        });

        return jsonResponse(error.status, {
          error: error.message,
        });
      }

      console.error("[fetch-plot-weather] Unexpected error", error);

      return jsonResponse(500, {
        error: "Internal server error.",
      });
    }
  });
}

function createSupabaseAdminClient(): SupabaseClient {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function parseRequestPayload(request: Request): Promise<RequestPayload> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }

  const { plotId, dateFrom, dateTo } = body as Partial<RequestPayload>;

  if (
    typeof plotId !== "string" ||
    typeof dateFrom !== "string" ||
    typeof dateTo !== "string" ||
    !plotId ||
    !dateFrom ||
    !dateTo
  ) {
    throw new HttpError(
      400,
      "Missing required parameters: plotId, dateFrom, dateTo.",
    );
  }

  if (!UUID_REGEX.test(plotId)) {
    throw new HttpError(400, "plotId must be a valid UUID.");
  }

  if (!isValidDateString(dateFrom) || !isValidDateString(dateTo)) {
    throw new HttpError(400, "dateFrom and dateTo must use YYYY-MM-DD format.");
  }

  if (dateFrom > dateTo) {
    throw new HttpError(400, "dateFrom must be less than or equal to dateTo.");
  }

  return { plotId, dateFrom, dateTo };
}

async function getPlotLocation(
  supabase: SupabaseClient,
  plotId: string,
): Promise<PlotLocation> {
  console.log("[fetch-plot-weather] Loading plot", { plotId });

  const { data, error } = await supabase
    .from("plots")
    .select("*")
    .eq("id", plotId)
    .maybeSingle();

  if (error) {
    console.error("[fetch-plot-weather] Supabase query failed", error);
    throw new HttpError(500, `Failed to fetch plot ${plotId}.`);
  }

  if (!data) {
    throw new HttpError(404, `Plot ${plotId} was not found.`);
  }

  const plot = data as PlotRecord;
  const geoJsonCandidate = plot.geoJson ?? plot.geojson ?? plot.geoJSON ?? null;

  if (geoJsonCandidate != null) {
    const polygon = validateGeoJsonPolygon(geoJsonCandidate);

    if (polygon) {
      const centroid = calculateCentroidFromPolygon(polygon);

      console.log("[fetch-plot-weather] Using plot geoJson polygon", {
        plotId,
        centroid,
      });

      return {
        kind: "polygon",
        plotId,
        polygon,
        centroid,
        source: {
          usedGeoJson: true,
          usedLatLonFallback: false,
        },
      };
    }

    console.error("[fetch-plot-weather] Plot geoJson is present but invalid", {
      plotId,
    });
  }

  const latitude = normalizeNumber(plot.latitude);
  const longitude = normalizeNumber(plot.longitude);

  if (isValidLatitude(latitude) && isValidLongitude(longitude)) {
    console.log("[fetch-plot-weather] Using latitude/longitude fallback", {
      plotId,
      latitude,
      longitude,
    });

    return {
      kind: "point",
      plotId,
      latitude,
      longitude,
      source: {
        usedGeoJson: false,
        usedLatLonFallback: true,
      },
    };
  }

  throw new HttpError(
    422,
    "Plot does not have a valid Polygon geoJson or latitude/longitude fallback.",
  );
}

function validateGeoJsonPolygon(geoJson: unknown): PolygonGeoJson | null {
  const parsed = parseGeoJsonInput(geoJson);

  if (!parsed || parsed.type !== "Polygon" || !Array.isArray(parsed.coordinates)) {
    return null;
  }

  if (parsed.coordinates.length === 0) {
    return null;
  }

  const normalizedRings: Coordinate[][] = [];

  for (const ringCandidate of parsed.coordinates) {
    if (!Array.isArray(ringCandidate) || ringCandidate.length < 3) {
      return null;
    }

    const ring: Coordinate[] = [];

    for (const coordinateCandidate of ringCandidate) {
      if (!Array.isArray(coordinateCandidate) || coordinateCandidate.length < 2) {
        return null;
      }

      const longitude = normalizeNumber(coordinateCandidate[0]);
      const latitude = normalizeNumber(coordinateCandidate[1]);

      if (!isValidLongitude(longitude) || !isValidLatitude(latitude)) {
        return null;
      }

      ring.push([longitude, latitude]);
    }

    const closedRing = ensureClosedRing(ring);
    if (countDistinctVertices(closedRing) < 3 || closedRing.length < 4) {
      return null;
    }

    normalizedRings.push(closedRing);
  }

  return {
    type: "Polygon",
    coordinates: normalizedRings,
  };
}

function calculateCentroidFromPolygon(polygon: PolygonGeoJson): {
  latitude: number;
  longitude: number;
} {
  const ring = ensureClosedRing(polygon.coordinates[0]);

  let twiceSignedArea = 0;
  let centroidX = 0;
  let centroidY = 0;

  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[index + 1];
    const cross = (x1 * y2) - (x2 * y1);

    twiceSignedArea += cross;
    centroidX += (x1 + x2) * cross;
    centroidY += (y1 + y2) * cross;
  }

  if (Math.abs(twiceSignedArea) < Number.EPSILON) {
    const uniqueVertices = ring.slice(0, -1);
    const longitude =
      uniqueVertices.reduce((sum, [value]) => sum + value, 0) / uniqueVertices.length;
    const latitude =
      uniqueVertices.reduce((sum, [, value]) => sum + value, 0) / uniqueVertices.length;

    return { latitude, longitude };
  }

  const factor = 1 / (3 * twiceSignedArea);

  return {
    latitude: centroidY * factor,
    longitude: centroidX * factor,
  };
}

export async function fetchWeatherFromEos(
  location: PlotLocation,
  dateFrom: string,
  dateTo: string,
): Promise<AggregatedWeather> {
  const eosApiKey = requireEnv("EOS_API_KEY");
  const geometry = buildEosGeometry(location);

  const [weatherSeries, soilMoistureSeries] = await Promise.all([
    fetchHistoricalWeatherFromEos(geometry, location, dateFrom, dateTo, eosApiKey),
    fetchSoilMoistureFromEos(geometry, location, dateFrom, dateTo, eosApiKey),
  ]);

  return aggregateWeatherData(weatherSeries, soilMoistureSeries);
}

function buildEosGeometry(location: PlotLocation): EosGeometry {
  if (location.kind === "polygon") {
    return location.polygon;
  }

  return {
    type: "Point",
    coordinates: [location.longitude, location.latitude],
  };
}

async function fetchHistoricalWeatherFromEos(
  geometry: EosGeometry,
  location: PlotLocation,
  dateFrom: string,
  dateTo: string,
  eosApiKey: string,
): Promise<EosHistoricalWeatherDay[]> {
  const requestUrl = new URL(EOS_WEATHER_HISTORY_URL);
  requestUrl.searchParams.set("api_key", eosApiKey);

  const requestBody = {
    geometry,
    start_date: dateFrom,
    end_date: dateTo,
    // TODO: if your EOS weather plan requires point coordinates instead of
    // generic GeoJSON geometry, use the centroid for polygon plots here.
  };

  console.log("[fetch-plot-weather] Requesting EOS weather history", {
    plotId: location.plotId,
    geometryType: geometry.type,
    dateFrom,
    dateTo,
  });

  const response = await fetch(requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": eosApiKey,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await safeReadResponseText(response);
    console.error("[fetch-plot-weather] EOS weather history request failed", {
      status: response.status,
      errorText,
    });
    throw new HttpError(500, "Failed to fetch weather history from EOS.");
  }

  const payload = await response.json() as unknown;

  if (!Array.isArray(payload)) {
    console.error("[fetch-plot-weather] EOS weather history returned invalid payload", {
      payload,
    });
    throw new HttpError(500, "EOS weather history returned an invalid response.");
  }

  console.log("[fetch-plot-weather] EOS weather history loaded", {
    plotId: location.plotId,
    days: payload.length,
  });

  return payload as EosHistoricalWeatherDay[];
}

async function fetchSoilMoistureFromEos(
  geometry: EosGeometry,
  location: PlotLocation,
  dateFrom: string,
  dateTo: string,
  eosApiKey: string,
): Promise<EosSoilMoistureScene[]> {
  const createTaskUrl = new URL(EOS_STATS_TASK_URL);
  createTaskUrl.searchParams.set("api_key", eosApiKey);

  const taskPayload = {
    type: "mt_stats",
    params: {
      bm_type: "soilmoisture",
      date_start: dateFrom,
      date_end: dateTo,
      geometry,
      sensors: EOS_SOIL_MOISTURE_SENSOR,
      reference: `plot_weather_${crypto.randomUUID()}`,
      limit: 200,
      // TODO: replace with the exact EOS soil moisture task params if your
      // account requires a stricter geometry type or different filters.
    },
  };

  console.log("[fetch-plot-weather] Creating EOS soil moisture task", {
    plotId: location.plotId,
    geometryType: geometry.type,
    dateFrom,
    dateTo,
  });

  const createResponse = await fetch(createTaskUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": eosApiKey,
    },
    body: JSON.stringify(taskPayload),
  });

  if (!createResponse.ok) {
    const errorText = await safeReadResponseText(createResponse);
    console.error("[fetch-plot-weather] EOS soil moisture task creation failed", {
      status: createResponse.status,
      errorText,
    });
    throw new HttpError(500, "Failed to create EOS soil moisture task.");
  }

  const createTaskResult = await createResponse.json() as EosTaskResponse;
  const taskId = createTaskResult.task_id;

  if (!taskId) {
    console.error("[fetch-plot-weather] EOS soil moisture response missing task_id", {
      createTaskResult,
    });
    throw new HttpError(500, "EOS soil moisture task did not return a task_id.");
  }

  console.log("[fetch-plot-weather] EOS soil moisture task created", {
    taskId,
    status: createTaskResult.status,
  });

  for (let attempt = 1; attempt <= EOS_POLL_MAX_ATTEMPTS; attempt += 1) {
    await delay(EOS_POLL_INTERVAL_MS);

    const taskStatusUrl = new URL(`${EOS_STATS_TASK_URL}/${taskId}`);
    taskStatusUrl.searchParams.set("api_key", eosApiKey);

    const statusResponse = await fetch(taskStatusUrl, {
      method: "GET",
      headers: {
        "x-api-key": eosApiKey,
      },
    });

    if (!statusResponse.ok) {
      const errorText = await safeReadResponseText(statusResponse);
      console.error("[fetch-plot-weather] EOS soil moisture polling failed", {
        taskId,
        attempt,
        status: statusResponse.status,
        errorText,
      });
      throw new HttpError(500, "Failed while polling EOS soil moisture task.");
    }

    const taskStatus = await statusResponse.json() as EosTaskResponse;
    const result = taskStatus.result;

    if (Array.isArray(result)) {
      console.log("[fetch-plot-weather] EOS soil moisture task completed", {
        taskId,
        attempt,
        sceneCount: result.length,
      });

      return result as EosSoilMoistureScene[];
    }

    const status = taskStatus.status ?? "pending";

    if (status === "failed" || status === "error") {
      console.error("[fetch-plot-weather] EOS soil moisture task failed", {
        taskId,
        attempt,
        taskStatus,
      });
      throw new HttpError(500, "EOS soil moisture task failed.");
    }

    console.log("[fetch-plot-weather] EOS soil moisture task still processing", {
      taskId,
      attempt,
      status,
    });
  }

  throw new HttpError(500, "Timed out while waiting for EOS soil moisture task.");
}

function aggregateWeatherData(
  weatherDays: EosHistoricalWeatherDay[],
  soilMoistureScenes: EosSoilMoistureScene[],
): AggregatedWeather {
  if (weatherDays.length === 0) {
    throw new HttpError(500, "EOS returned no weather data for the requested range.");
  }

  if (soilMoistureScenes.length === 0) {
    throw new HttpError(500, "EOS returned no soil moisture data for the requested range.");
  }

  const soilMoistureValues = soilMoistureScenes
    .map((scene) => normalizeNumber(scene.average))
    .filter(isNonNullNumber);

  const temperatureValues = weatherDays
    .map((day) => extractDailyMeanTemperature(day))
    .filter(isNonNullNumber);

  const rainfallValues = weatherDays
    .map((day) => normalizeNumber(day.rainfall) ?? 0)
    .filter((value) => Number.isFinite(value));

  const humidityValues = weatherDays
    .map((day) => extractDailyHumidity(day))
    .filter(isNonNullNumber);

  if (soilMoistureValues.length === 0) {
    throw new HttpError(500, "EOS soil moisture response did not include numeric averages.");
  }

  if (temperatureValues.length === 0) {
    throw new HttpError(500, "EOS weather response did not include numeric temperatures.");
  }

  if (humidityValues.length === 0) {
    throw new HttpError(
      500,
      "EOS weather response did not include humidity data or enough fields to estimate it.",
    );
  }

  return {
    soil_moisture_percent: roundTo2Decimals(average(soilMoistureValues)),
    temperature_c: roundTo2Decimals(average(temperatureValues)),
    rainfall_mm: roundTo2Decimals(sum(rainfallValues)),
    humidity_percent: roundTo2Decimals(average(humidityValues)),
  };
}

function extractDailyMeanTemperature(day: EosHistoricalWeatherDay): number | null {
  const explicitTemperature = normalizeNumber((day as Record<string, unknown>).temperature_c);
  if (explicitTemperature != null) {
    return explicitTemperature;
  }

  const minTemperature = normalizeNumber(day.temperature_min);
  const maxTemperature = normalizeNumber(day.temperature_max);

  if (minTemperature == null || maxTemperature == null) {
    return null;
  }

  return (minTemperature + maxTemperature) / 2;
}

function extractDailyHumidity(day: EosHistoricalWeatherDay): number | null {
  const directHumidity =
    normalizeNumber(day.humidity) ??
    normalizeNumber(day.relative_humidity);

  if (directHumidity != null) {
    return clampPercentage(directHumidity);
  }

  const vapourPressure = normalizeNumber(day.vapour_pressure);
  const meanTemperature = extractDailyMeanTemperature(day);

  if (vapourPressure == null || meanTemperature == null) {
    return null;
  }

  return estimateHumidityFromVapourPressure(vapourPressure, meanTemperature);
}

function estimateHumidityFromVapourPressure(
  vapourPressure: number,
  temperatureC: number,
): number | null {
  const saturationVapourPressureKpa =
    0.6108 * Math.exp((17.27 * temperatureC) / (temperatureC + 237.3));

  if (!Number.isFinite(saturationVapourPressureKpa) || saturationVapourPressureKpa <= 0) {
    return null;
  }

  const actualVapourPressureKpa = vapourPressure > 2 ? vapourPressure / 10 : vapourPressure;
  const humidity = (actualVapourPressureKpa / saturationVapourPressureKpa) * 100;

  if (!Number.isFinite(humidity)) {
    return null;
  }

  // Inference from EOS historical weather docs: when humidity is not returned
  // directly, estimate it from vapour_pressure plus mean air temperature.
  return clampPercentage(humidity);
}

function average(values: number[]): number {
  return sum(values) / values.length;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function clampPercentage(value: number): number {
  if (value < 0) {
    return 0;
  }

  if (value > 100) {
    return 100;
  }

  return value;
}

function parseGeoJsonInput(value: unknown): { type?: unknown; coordinates?: unknown } | null {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
        ? parsed as { type?: unknown; coordinates?: unknown }
        : null;
    } catch {
      return null;
    }
  }

  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as { type?: unknown; coordinates?: unknown };
  }

  return null;
}

function ensureClosedRing(ring: Coordinate[]): Coordinate[] {
  if (ring.length === 0) {
    return ring;
  }

  const [firstLongitude, firstLatitude] = ring[0];
  const [lastLongitude, lastLatitude] = ring[ring.length - 1];

  if (firstLongitude === lastLongitude && firstLatitude === lastLatitude) {
    return ring;
  }

  return [...ring, ring[0]];
}

function countDistinctVertices(ring: Coordinate[]): number {
  const distinct = new Set(ring.slice(0, -1).map(([longitude, latitude]) => `${longitude},${latitude}`));
  return distinct.size;
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isNonNullNumber(value: number | null): value is number {
  return value != null && Number.isFinite(value);
}

function isValidLatitude(value: number | null): value is number {
  return value != null && value >= -90 && value <= 90;
}

function isValidLongitude(value: number | null): value is number {
  return value != null && value >= -180 && value <= 180;
}

function isValidDateString(value: string): boolean {
  if (!DATE_REGEX.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function roundTo2Decimals(value: number): number {
  return Number(value.toFixed(2));
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new HttpError(500, `Missing required environment variable: ${name}.`);
  }

  return value;
}

async function safeReadResponseText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "<unable to read response body>";
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: CORS_HEADERS,
  });
}
