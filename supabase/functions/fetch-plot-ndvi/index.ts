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
const EOS_SEARCH_URL = "https://api-connect.eos.com/api/lms/search/v2";
// TODO: replace with the exact EOS endpoint/version used by your account if it differs.
const EOS_RENDER_BASE_URL = "https://api-connect.eos.com/api/render";
const EOS_STATS_SENSORS = ["sentinel2"];
const EOS_POINT_SEARCH_SATELLITES = ["sentinel2l2a"];
const EOS_POLL_INTERVAL_MS = 2_500;
const EOS_POLL_MAX_ATTEMPTS = 12;
const EOS_SEARCH_PAGE_SIZE = 100;
const EOS_MAX_SEARCH_PAGES = 5;

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

interface EosStatsScene {
  date?: string;
  view_id?: string;
  scene_id?: string;
  indexes?: Record<string, { average?: number | string | null }>;
}

interface EosSearchResponse {
  results?: EosSearchScene[];
  meta?: {
    found?: number;
    page?: number;
    limit?: number;
  };
}

interface EosSearchScene {
  view_id?: string;
  satellite?: string;
  date?: string;
  cloudCoverage?: number;
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

      console.log("[fetch-plot-ndvi] Incoming request", {
        plotId: payload.plotId,
        dateFrom: payload.dateFrom,
        dateTo: payload.dateTo,
      });

      const location = await getPlotLocation(supabase, payload.plotId);
      const { avg } = await fetchNdviFromEos(location, payload.dateFrom, payload.dateTo);

      return jsonResponse(200, {
        plotId: payload.plotId,
        dateFrom: payload.dateFrom,
        dateTo: payload.dateTo,
        source: location.source,
        ndvi: {
          avg,
        },
      });
    } catch (error) {
      if (error instanceof HttpError) {
        console.error("[fetch-plot-ndvi] Request failed", {
          status: error.status,
          message: error.message,
        });

        return jsonResponse(error.status, {
          error: error.message,
        });
      }

      console.error("[fetch-plot-ndvi] Unexpected error", error);

      return jsonResponse(500, {
        error: "Internal server error.",
      });
    }
  });
}

export function createSupabaseAdminClient(): SupabaseClient {
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

export async function getPlotLocation(
  supabase: SupabaseClient,
  plotId: string,
): Promise<PlotLocation> {
  console.log("[fetch-plot-ndvi] Loading plot", { plotId });

  const { data, error } = await supabase
    .from("plots")
    .select("*")
    .eq("id", plotId)
    .maybeSingle();

  if (error) {
    console.error("[fetch-plot-ndvi] Supabase query failed", error);
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

      console.log("[fetch-plot-ndvi] Using plot geoJson polygon", {
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

    console.error("[fetch-plot-ndvi] Plot geoJson is present but invalid", {
      plotId,
    });
  }

  const latitude = normalizeNumber(plot.latitude);
  const longitude = normalizeNumber(plot.longitude);

  if (isValidLatitude(latitude) && isValidLongitude(longitude)) {
    console.log("[fetch-plot-ndvi] Using latitude/longitude fallback", {
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

export async function fetchNdviFromEos(
  location: PlotLocation,
  dateFrom: string,
  dateTo: string,
): Promise<{ avg: number }> {
  const eosApiKey = requireEnv("EOS_API_KEY");

  if (location.kind === "polygon") {
    const statsResult = await fetchNdviStatsForPolygon(
      location.polygon,
      dateFrom,
      dateTo,
      eosApiKey,
    );

    return {
      avg: extractAverageNdvi(statsResult),
    };
  }

  const pointValues = await fetchNdviSamplesForPoint(
    location.latitude,
    location.longitude,
    dateFrom,
    dateTo,
    eosApiKey,
  );

  return {
    avg: extractAverageNdvi(pointValues),
  };
}

async function fetchNdviStatsForPolygon(
  polygon: PolygonGeoJson,
  dateFrom: string,
  dateTo: string,
  eosApiKey: string,
): Promise<EosStatsScene[]> {
  const createTaskUrl = new URL(EOS_STATS_TASK_URL);
  createTaskUrl.searchParams.set("api_key", eosApiKey);

  const taskPayload = {
    type: "mt_stats",
    params: {
      bm_type: ["NDVI"],
      date_start: dateFrom,
      date_end: dateTo,
      geometry: polygon,
      sensors: EOS_STATS_SENSORS,
      reference: `plot_ndvi_${crypto.randomUUID()}`,
      // TODO: replace sensors or add EOS-specific params if your account uses
      // datasets other than Sentinel-2 or requires extra cloud filtering.
    },
  };

  console.log("[fetch-plot-ndvi] Creating EOS mt_stats task", {
    dateFrom,
    dateTo,
    sensors: EOS_STATS_SENSORS,
  });

  const createResponse = await fetch(createTaskUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(taskPayload),
  });

  if (!createResponse.ok) {
    const errorText = await safeReadResponseText(createResponse);
    console.error("[fetch-plot-ndvi] EOS mt_stats task creation failed", {
      status: createResponse.status,
      errorText,
    });
    throw new HttpError(500, "Failed to create EOS NDVI statistics task.");
  }

  const createTaskResult = await createResponse.json() as EosTaskResponse;
  const taskId = createTaskResult.task_id;

  if (!taskId) {
    console.error("[fetch-plot-ndvi] EOS mt_stats response missing task_id", {
      createTaskResult,
    });
    throw new HttpError(500, "EOS NDVI statistics task did not return a task_id.");
  }

  console.log("[fetch-plot-ndvi] EOS task created", {
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
      console.error("[fetch-plot-ndvi] EOS mt_stats polling failed", {
        taskId,
        attempt,
        status: statusResponse.status,
        errorText,
      });
      throw new HttpError(500, "Failed while polling EOS NDVI statistics task.");
    }

    const taskStatus = await statusResponse.json() as EosTaskResponse;
    const result = taskStatus.result;

    if (Array.isArray(result)) {
      console.log("[fetch-plot-ndvi] EOS mt_stats task completed", {
        taskId,
        attempt,
        sceneCount: result.length,
      });

      return result as EosStatsScene[];
    }

    const status = taskStatus.status ?? "pending";

    if (status === "failed" || status === "error") {
      console.error("[fetch-plot-ndvi] EOS mt_stats task failed", {
        taskId,
        attempt,
        taskStatus,
      });
      throw new HttpError(500, "EOS NDVI statistics task failed.");
    }

    console.log("[fetch-plot-ndvi] EOS mt_stats task still processing", {
      taskId,
      attempt,
      status,
    });
  }

  throw new HttpError(500, "Timed out while waiting for EOS NDVI statistics task.");
}

async function fetchNdviSamplesForPoint(
  latitude: number,
  longitude: number,
  dateFrom: string,
  dateTo: string,
  eosApiKey: string,
): Promise<number[]> {
  const scenes = await searchScenesForPoint(latitude, longitude, dateFrom, dateTo, eosApiKey);

  if (scenes.length === 0) {
    throw new HttpError(500, "EOS did not return scenes for the point fallback.");
  }

  console.log("[fetch-plot-ndvi] Fetching EOS point NDVI values", {
    latitude,
    longitude,
    sceneCount: scenes.length,
  });

  const values: number[] = [];

  for (const scene of scenes) {
    const scenePath = buildScenePath(scene.view_id);
    if (!scenePath) {
      console.error("[fetch-plot-ndvi] Skipping EOS scene without valid view_id", scene);
      continue;
    }

    const sensorCode = getRenderSensorCode(scene.view_id, scene.satellite);
    if (!sensorCode) {
      console.error("[fetch-plot-ndvi] Skipping EOS scene with unsupported satellite", scene);
      continue;
    }

    const pointUrl = new URL(
      `${EOS_RENDER_BASE_URL}/${sensorCode}/point/${scenePath}/NDVI/${latitude}/${longitude}`,
    );
    pointUrl.searchParams.set("CALIBRATE", "1");
    pointUrl.searchParams.set("api_key", eosApiKey);

    // TODO: replace NDVI alias with an explicit expression if your EOS account
    // expects a sensor-specific formula such as (B08-B04)/(B08+B04).
    const pointResponse = await fetch(pointUrl, {
      method: "GET",
      headers: {
        "x-api-key": eosApiKey,
      },
    });

    if (!pointResponse.ok) {
      const errorText = await safeReadResponseText(pointResponse);
      console.error("[fetch-plot-ndvi] EOS point value request failed", {
        status: pointResponse.status,
        scene,
        errorText,
      });
      continue;
    }

    const pointData = await pointResponse.json() as { index_value?: number | string | null };
    const indexValue = normalizeNumber(pointData.index_value);

    if (isValidNdvi(indexValue)) {
      values.push(indexValue);
    }
  }

  if (values.length === 0) {
    throw new HttpError(500, "EOS point fallback did not return numeric NDVI values.");
  }

  return values;
}

async function searchScenesForPoint(
  latitude: number,
  longitude: number,
  dateFrom: string,
  dateTo: string,
  eosApiKey: string,
): Promise<EosSearchScene[]> {
  const scenes: EosSearchScene[] = [];

  for (let page = 1; page <= EOS_MAX_SEARCH_PAGES; page += 1) {
    const searchUrl = new URL(EOS_SEARCH_URL);
    searchUrl.searchParams.set("api_key", eosApiKey);

    const searchPayload = {
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
      // TODO: if your EOS plan needs additional filters, add them here
      // (for example cloudCoverage or onAmazon).
    };

    const response = await fetch(searchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": eosApiKey,
      },
      body: JSON.stringify(searchPayload),
    });

    if (!response.ok) {
      const errorText = await safeReadResponseText(response);
      console.error("[fetch-plot-ndvi] EOS search request failed", {
        page,
        status: response.status,
        errorText,
      });
      throw new HttpError(500, "Failed to search EOS scenes for the point fallback.");
    }

    const payload = await response.json() as EosSearchResponse;
    const pageResults = Array.isArray(payload.results) ? payload.results : [];

    scenes.push(...pageResults);

    const found = payload.meta?.found ?? pageResults.length;
    const totalPages = Math.max(1, Math.ceil(found / EOS_SEARCH_PAGE_SIZE));

    console.log("[fetch-plot-ndvi] EOS scene search page loaded", {
      page,
      pageResults: pageResults.length,
      found,
    });

    if (page >= totalPages || pageResults.length === 0) {
      break;
    }
  }

  const deduplicated = new Map<string, EosSearchScene>();
  for (const scene of scenes) {
    if (scene.view_id) {
      deduplicated.set(scene.view_id, scene);
    }
  }

  return Array.from(deduplicated.values());
}

function extractAverageNdvi(input: EosStatsScene[] | number[]): number {
  const values = Array.isArray(input) && input.length > 0 && typeof input[0] === "number"
    ? input as number[]
    : extractSceneAverages(input as EosStatsScene[]);

  if (values.length === 0) {
    throw new HttpError(500, "EOS returned no NDVI values for the requested range.");
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  const average = total / values.length;

  return roundTo4Decimals(average);
}

function extractSceneAverages(scenes: EosStatsScene[]): number[] {
  const values: number[] = [];

  for (const scene of scenes) {
    const ndviAverage = normalizeNumber(scene.indexes?.NDVI?.average);
    if (isValidNdvi(ndviAverage)) {
      values.push(ndviAverage);
    }
  }

  return values;
}

function buildScenePath(viewId: string | undefined): string | null {
  if (!viewId || !viewId.includes("/")) {
    return null;
  }

  const segments = viewId.split("/");
  if (segments.length < 2) {
    return null;
  }

  return segments.slice(1).map(encodeURIComponent).join("/");
}

function getRenderSensorCode(
  viewId: string | undefined,
  satellite: string | undefined,
): string | null {
  const viewSensorCode = viewId?.split("/")[0] ?? null;
  if (viewSensorCode === "S2" || viewSensorCode === "L8" || viewSensorCode === "L9") {
    return viewSensorCode;
  }

  return mapSceneToRenderSensor(satellite);
}

function mapSceneToRenderSensor(satellite: string | undefined): string | null {
  switch (satellite) {
    case "sentinel2":
    case "sentinel2l1c":
    case "sentinel2l2a":
      return "S2";
    case "landsat8":
    case "landsat8c2l1":
    case "landsat8c2l2":
      return "L8";
    case "landsat9":
    case "landsat9c2l1":
    case "landsat9c2l2":
      return "L9";
    default:
      return null;
  }
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

function isValidNdvi(value: number | null): value is number {
  return value != null && value >= -1 && value <= 1;
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

function roundTo4Decimals(value: number): number {
  return Number(value.toFixed(4));
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
