import { NextResponse } from "next/server"

import {
  createEnrichedPlot,
  type CreatePlotRequestBody,
} from "@/lib/server/create-enriched-plot"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request) {
  let body: CreatePlotRequestBody

  try {
    body = (await request.json()) as CreatePlotRequestBody
  } catch {
    return jsonError(400, "El body debe ser JSON valido.")
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError(400, "El body debe ser un objeto JSON.")
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return jsonError(401, "No autenticado.")
  }

  try {
    const result = await createEnrichedPlot(supabase, user, body)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return jsonError(400, error instanceof Error ? error.message : "No se pudo crear el lote.")
  }
}

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status })
}
