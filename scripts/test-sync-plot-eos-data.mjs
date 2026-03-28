import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const CANDIDATE_ENV_FILES = [
  ".env",
  path.join("backend", ".env"),
  path.join("frontend", ".env.local"),
];

for (const candidate of CANDIDATE_ENV_FILES) {
  const fullPath = path.resolve(candidate);
  if (fs.existsSync(fullPath)) {
    loadSimpleEnvFile(fullPath);
  }
}

const {
  SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_FUNCTIONS_AUTH_TOKEN,
  TEST_PLOT_ID,
  TEST_DATE_FROM,
  TEST_DATE_TO,
} = process.env;

const supabaseUrl = SUPABASE_URL ?? NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = SUPABASE_SERVICE_ROLE_KEY;
const functionsAuthToken = SUPABASE_FUNCTIONS_AUTH_TOKEN ?? serviceRoleKey;

if (!supabaseUrl) {
  fail(
    "Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL. Set one before running the smoke test.",
  );
}

if (!serviceRoleKey) {
  fail(
    "Missing SUPABASE_SERVICE_ROLE_KEY. Export it in your terminal before running the smoke test.",
  );
}

if (!functionsAuthToken) {
  fail(
    "Missing SUPABASE_FUNCTIONS_AUTH_TOKEN or SUPABASE_SERVICE_ROLE_KEY for function invocation.",
  );
}

const plotIdArg = process.argv[2] ?? TEST_PLOT_ID ?? null;
const dateFrom = process.argv[3] ?? TEST_DATE_FROM ?? null;
const dateTo = process.argv[4] ?? TEST_DATE_TO ?? null;

const TRACKED_FIELDS = [
  "ndvi_index",
  "soil_moisture_percent",
  "temperature_c",
  "rainfall_mm",
  "humidity_percent",
];

const TEMP_TEST_PLOT = {
  latitude: -35.1657,
  longitude: -60.494,
  name: "Smoke Test Plot",
};

let createdPlotId = null;

async function main() {
  try {
    console.log("Running sync-plot-eos-data smoke test...");
    console.log(
      dateFrom || dateTo
        ? `Date range override: ${dateFrom ?? "<from plot.sowing_date>"} -> ${dateTo ?? "<today>"}`
        : "Date range mode: derive dateFrom from plot.sowing_date and dateTo from today",
    );

    const plot = plotIdArg
      ? await getPlotById(plotIdArg)
      : await findTestablePlot({ requiresSowingDate: dateFrom == null });

    console.log(`Using plot: ${plot.id}`);
    console.log(`Location source: ${getGeoJsonLike(plot) ? "geoJson" : "lat/lon fallback"}`);

    const before = pickTrackedFields(plot);
    console.log("Before:", before);

    const validationCheck = await invokeFunction({
      dateFrom,
      dateTo,
    });

    if (validationCheck.status !== 400) {
      fail(
        `Validation check failed. Expected HTTP 400 for missing plotId, got ${validationCheck.status}.`,
      );
    }

    console.log("Validation check: OK (missing plotId returns 400)");

    const syncResult = await invokeFunction({
      plotId: plot.id,
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
    });

    if (syncResult.status !== 200) {
      fail(
        `Function call failed with HTTP ${syncResult.status}: ${JSON.stringify(syncResult.body, null, 2)}`,
      );
    }

    const afterPlot = await getPlotById(plot.id);
    const after = pickTrackedFields(afterPlot);
    const updatedFields = Array.isArray(syncResult.body?.updatedFields)
      ? syncResult.body.updatedFields
      : [];

    const changedFields = TRACKED_FIELDS.filter((field) => {
      return before[field] !== after[field];
    });

    console.log("Function response eosData:", syncResult.body?.eosData ?? null);
    console.log("Function response updatedFields:", updatedFields);
    console.log("After:", after);
    console.log("Detected DB changes:", changedFields);

    const mismatchedReportedFields = updatedFields.filter((field) => !changedFields.includes(field));
    const missingReportedFields = changedFields.filter((field) => !updatedFields.includes(field));

    if (mismatchedReportedFields.length > 0 || missingReportedFields.length > 0) {
      fail(
        [
          "updatedFields does not match the actual database diff.",
          `Extra reported fields: ${JSON.stringify(mismatchedReportedFields)}`,
          `Missing reported fields: ${JSON.stringify(missingReportedFields)}`,
        ].join("\n"),
      );
    }

    const responsePlot = syncResult.body?.updatedPlot ?? null;
    if (responsePlot) {
      for (const field of TRACKED_FIELDS) {
        const responseValue = responsePlot[field] ?? null;
        if ((after[field] ?? null) !== responseValue) {
          fail(
            `Response updatedPlot.${field} does not match the database state. Response=${responseValue} DB=${after[field] ?? null}`,
          );
        }
      }
    }

    console.log("Smoke test passed.");
  } finally {
    if (createdPlotId) {
      console.log(`Cleaning up temporary plot: ${createdPlotId}`);
      await deletePlot(createdPlotId);
    }
  }
}

async function findTestablePlot({ requiresSowingDate }) {
  const plots = await queryPlots(
    "select=*&limit=50",
  );

  const plot = plots.find((candidate) => {
    const hasGeoJson = getGeoJsonLike(candidate) != null;
    const hasLatLon = candidate.latitude != null && candidate.longitude != null;
    const hasSowingDate = candidate.sowing_date != null;
    return (hasGeoJson || hasLatLon) && (!requiresSowingDate || hasSowingDate);
  });

  if (!plot) {
    console.log("No existing plot with location found. Creating a temporary test plot...");
    return await createTemporaryPlot();
  }

  return plot;
}

async function getPlotById(plotId) {
  const rows = await queryPlots(
    `select=*&id=eq.${encodeURIComponent(plotId)}&limit=1`,
  );

  const data = rows[0] ?? null;

  if (!data) {
    fail(`Plot ${plotId} was not found.`);
  }

  return data;
}

async function queryPlots(queryString) {
  const response = await fetch(`${supabaseUrl}/rest/v1/plots?${queryString}`, {
    method: "GET",
    headers: buildRestHeaders(),
  });

  const text = await response.text();
  const body = tryParseJson(text);

  if (!response.ok) {
    fail(`Failed to query plots. HTTP ${response.status}: ${text}`);
  }

  if (!Array.isArray(body)) {
    fail(`Unexpected plots payload: ${text}`);
  }

  return body;
}

async function createTemporaryPlot() {
  const farmsResponse = await fetch(`${supabaseUrl}/rest/v1/farms?select=id&limit=1`, {
    method: "GET",
    headers: buildRestHeaders(),
  });

  const farmsText = await farmsResponse.text();
  const farmsBody = tryParseJson(farmsText);

  if (!farmsResponse.ok) {
    fail(`Failed to query farms. HTTP ${farmsResponse.status}: ${farmsText}`);
  }

  if (!Array.isArray(farmsBody) || farmsBody.length === 0 || !farmsBody[0]?.id) {
    fail("No farm was found. Create at least one farm before running the smoke test.");
  }

  const farmId = farmsBody[0].id;
  const response = await fetch(`${supabaseUrl}/rest/v1/plots`, {
    method: "POST",
    headers: {
      ...buildRestHeaders(),
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      farm_id: farmId,
      name: `${TEMP_TEST_PLOT.name} ${new Date().toISOString()}`,
      group: 1,
      latitude: TEMP_TEST_PLOT.latitude,
      longitude: TEMP_TEST_PLOT.longitude,
      sowing_date: getDateOffset(-30),
      description: "Temporary plot created by the sync-plot-eos-data smoke test.",
    }),
  });

  const text = await response.text();
  const body = tryParseJson(text);

  if (!response.ok) {
    fail(`Failed to create temporary plot. HTTP ${response.status}: ${text}`);
  }

  if (!Array.isArray(body) || body.length === 0 || !body[0]?.id) {
    fail(`Temporary plot creation returned an unexpected payload: ${text}`);
  }

  createdPlotId = body[0].id;
  return body[0];
}

async function deletePlot(plotId) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/plots?id=eq.${encodeURIComponent(plotId)}`,
    {
      method: "DELETE",
      headers: buildRestHeaders(),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    fail(`Failed to delete temporary plot ${plotId}. HTTP ${response.status}: ${text}`);
  }
}

async function invokeFunction(payload) {
  const response = await fetch(`${supabaseUrl}/functions/v1/sync-plot-eos-data`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${functionsAuthToken}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  const body = tryParseJson(text);

  return {
    status: response.status,
    body,
    raw: text,
  };
}

function pickTrackedFields(plot) {
  return Object.fromEntries(
    TRACKED_FIELDS.map((field) => [field, normalizeNumber(plot[field])]),
  );
}

function getGeoJsonLike(plot) {
  return plot.geoJson ?? plot.geojson ?? plot.geoJSON ?? null;
}

function normalizeNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function tryParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function buildRestHeaders() {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function loadSimpleEnvFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] != null) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function getDateOffset(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function fail(message) {
  throw new Error(`Smoke test failed: ${message}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
