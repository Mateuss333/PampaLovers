import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Missing authorization" }, 401);
  }

  const jwt = authHeader.slice("Bearer ".length).trim();
  if (!jwt) {
    return jsonResponse({ error: "Missing authorization" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !anonKey) {
    return jsonResponse({ error: "Server misconfiguration" }, 500);
  }
  if (!serviceRole) {
    console.error("[delete-account] SUPABASE_SERVICE_ROLE_KEY is not set");
    return jsonResponse(
      {
        error:
          "Cuenta no configurada para eliminación automática. Contactá al administrador.",
      },
      500,
    );
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser(jwt);

  if (userErr || !user) {
    return jsonResponse({ error: "Sesión inválida o expirada" }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: deleteErr } = await admin.auth.admin.deleteUser(user.id);

  if (deleteErr) {
    console.error("[delete-account] admin.deleteUser failed", deleteErr);
    return jsonResponse({ error: deleteErr.message }, 500);
  }

  return jsonResponse({ ok: true }, 200);
});
