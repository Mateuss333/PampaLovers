import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2";
import {
  fetchNdviFromEos,
  getPlotLocation,
} from "../fetch-plot-ndvi/index.ts";
import {
  fetchWeatherFromEos,
} from "../fetch-plot-weather/index.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
} as const;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const UPDATABLE_FIELDS = [
  "ndvi_index",
  "soil_moisture_percent",
  "temperature_c",
  "rainfall_mm",
  "humidity_percent",
] as const;

type UpdatableField = typeof UPDATABLE_FIELDS[number];
type PlotPatch = Partial<Record<UpdatableField, number>>;

interface RequestPayload {
  plotId: string;
  dateFrom: string;
  dateTo: string;
}

interface AppConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
}

interface PlotRow extends Record<string, unknown> {
  id: string;
  ndvi_index?: number | string | null;
  soil_moisture_percent?: number | string | null;
  temperature_c?: number | string | null;
  rainfall_mm?: number | string | null;
  humidity_percent?: number | string | null;
}

interface FetchPlotNdviResponse {
  ndvi?: {
    avg?: number | string | null;
  };
}

interface FetchPlotWeatherResponse {
  weather?: {
    soil_moisture_percent?: number | string | null;
    temperature_c?: number | string | null;
    rainfall_mm?: number | string | null;
    humidity_percent?: number | string | null;
  };
}

type EosData = Record<UpdatableField, number | null>;

class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

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
    const config = getConfig();
    const supabase = createSupabaseAdminClient(config);

    console.log("[sync-plot-eos-data] Incoming request", payload);

    const currentPlot = await getPlotById(supabase, payload.plotId);
    const eosData = await fetchEosData(supabase, payload);
    const patch = getValidPatchFromEosData(eosData);
    const updatedFields = Object.keys(patch) as UpdatableField[];

    const updatedPlot = updatedFields.length > 0
      ? await updatePlotWithPatch(supabase, payload.plotId, patch)
      : currentPlot;

    console.log("[sync-plot-eos-data] Sync completed", {
      plotId: payload.plotId,
      updatedFields,
    });

    return jsonResponse(200, {
      plotId: payload.plotId,
      dateFrom: payload.dateFrom,
      dateTo: payload.dateTo,
      eosData,
      updatedFields,
      updatedPlot: buildPlotSummary(updatedPlot),
    });
  } catch (error) {
    const maybeStatus = getErrorStatus(error);

    if (maybeStatus != null) {
      const message = error instanceof Error ? error.message : "Request failed.";

      console.error("[sync-plot-eos-data] Request failed", {
        status: maybeStatus,
        message,
      });

      return jsonResponse(maybeStatus, {
        error: message,
      });
    }

    console.error("[sync-plot-eos-data] Unexpected error", error);

    return jsonResponse(500, {
      error: "Internal server error.",
    });
  }
});

function getConfig(): AppConfig {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  // Validate EOS_API_KEY here as required runtime configuration. The downstream
  // EOS helpers also depend on this secret.
  requireEnv("EOS_API_KEY");

  return {
    supabaseUrl,
    serviceRoleKey,
  };
}

function createSupabaseAdminClient(config: AppConfig): SupabaseClient {
  return createClient(config.supabaseUrl, config.serviceRoleKey, {
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

async function getPlotById(
  supabase: SupabaseClient,
  plotId: string,
): Promise<PlotRow> {
  console.log("[sync-plot-eos-data] Loading current plot", { plotId });

  const { data, error } = await supabase
    .from("plots")
    .select(
      "id, ndvi_index, soil_moisture_percent, temperature_c, rainfall_mm, humidity_percent",
    )
    .eq("id", plotId)
    .maybeSingle();

  if (error) {
    console.error("[sync-plot-eos-data] Supabase query failed", error);
    throw new HttpError(500, `Failed to fetch plot ${plotId}.`);
  }

  if (!data) {
    throw new HttpError(404, `Plot ${plotId} was not found.`);
  }

  return data as PlotRow;
}

async function fetchEosData(
  supabase: SupabaseClient,
  payload: RequestPayload,
): Promise<EosData> {
  const location = await getPlotLocation(supabase, payload.plotId);

  const [ndviResponse, weatherResponse] = await Promise.all([
    fetchNdviFromEos(location, payload.dateFrom, payload.dateTo)
      .then((ndvi) => ({ ndvi }) satisfies FetchPlotNdviResponse),
    fetchWeatherFromEos(location, payload.dateFrom, payload.dateTo)
      .then((weather) => ({ weather }) satisfies FetchPlotWeatherResponse),
  ]);

  return {
    ndvi_index: normalizeFieldValue("ndvi_index", ndviResponse.ndvi?.avg),
    soil_moisture_percent: normalizeFieldValue(
      "soil_moisture_percent",
      weatherResponse.weather?.soil_moisture_percent,
    ),
    temperature_c: normalizeFieldValue(
      "temperature_c",
      weatherResponse.weather?.temperature_c,
    ),
    rainfall_mm: normalizeFieldValue(
      "rainfall_mm",
      weatherResponse.weather?.rainfall_mm,
    ),
    humidity_percent: normalizeFieldValue(
      "humidity_percent",
      weatherResponse.weather?.humidity_percent,
    ),
  };
}

function getValidPatchFromEosData(eosData: EosData): PlotPatch {
  const patch: PlotPatch = {};

  for (const field of UPDATABLE_FIELDS) {
    const value = eosData[field];
    if (isValidNumericValue(field, value)) {
      patch[field] = value;
    }
  }

  return patch;
}

async function updatePlotWithPatch(
  supabase: SupabaseClient,
  plotId: string,
  patch: PlotPatch,
): Promise<PlotRow> {
  console.log("[sync-plot-eos-data] Updating plot with patch", {
    plotId,
    patch,
  });

  const { data, error } = await supabase
    .from("plots")
    .update(patch)
    .eq("id", plotId)
    .select(
      "id, ndvi_index, soil_moisture_percent, temperature_c, rainfall_mm, humidity_percent",
    )
    .maybeSingle();

  if (error) {
    console.error("[sync-plot-eos-data] Supabase update failed", error);
    throw new HttpError(500, `Failed to update plot ${plotId}.`);
  }

  if (!data) {
    throw new HttpError(404, `Plot ${plotId} was not found during update.`);
  }

  return data as PlotRow;
}

function buildPlotSummary(plot: PlotRow): EosData {
  return {
    ndvi_index: normalizeFieldValue("ndvi_index", plot.ndvi_index),
    soil_moisture_percent: normalizeFieldValue(
      "soil_moisture_percent",
      plot.soil_moisture_percent,
    ),
    temperature_c: normalizeFieldValue("temperature_c", plot.temperature_c),
    rainfall_mm: normalizeFieldValue("rainfall_mm", plot.rainfall_mm),
    humidity_percent: normalizeFieldValue("humidity_percent", plot.humidity_percent),
  };
}

function normalizeFieldValue(
  field: UpdatableField,
  value: unknown,
): number | null {
  const numericValue = normalizeNumber(value);

  if (numericValue == null || !isValidNumericValue(field, numericValue)) {
    return null;
  }

  switch (field) {
    case "ndvi_index":
      return roundTo4Decimals(numericValue);
    case "soil_moisture_percent":
    case "temperature_c":
    case "rainfall_mm":
    case "humidity_percent":
      return roundTo2Decimals(numericValue);
    default:
      return null;
  }
}

function isValidNumericValue(
  field: UpdatableField,
  value: number | null,
): value is number {
  if (value == null || !Number.isFinite(value)) {
    return false;
  }

  switch (field) {
    case "ndvi_index":
      return value >= -1 && value <= 1;
    case "soil_moisture_percent":
    case "humidity_percent":
      return value >= 0 && value <= 100;
    case "rainfall_mm":
      return value >= 0;
    case "temperature_c":
      return true;
    default:
      return false;
  }
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

function getErrorStatus(error: unknown): number | null {
  if (error instanceof HttpError) {
    return error.status;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
  ) {
    return (error as { status: number }).status;
  }

  return null;
}

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: CORS_HEADERS,
  });
}
