import { NextResponse } from "next/server"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError(400, "El body debe ser JSON válido.")
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError(400, "Solicitud inválida.")
  }

  const email = typeof (body as { email?: unknown }).email === "string"
    ? (body as { email: string }).email.trim()
    : ""
  const password =
    typeof (body as { password?: unknown }).password === "string"
      ? (body as { password: string }).password
      : ""

  if (!email || !EMAIL_RE.test(email)) {
    return jsonError(400, "Ingresá un email válido.")
  }
  if (password.length < 6) {
    return jsonError(400, "La contraseña debe tener al menos 6 caracteres.")
  }

  const admin = createSupabaseAdminClient()
  if (!admin) {
    return jsonError(
      503,
      "El registro no está configurado en el servidor. Agregá SUPABASE_SERVICE_ROLE_KEY en el entorno de Next.js (solo servidor, sin NEXT_PUBLIC_).",
    )
  }

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) {
    const msg = error.message.toLowerCase()
    if (
      msg.includes("already") ||
      msg.includes("registered") ||
      msg.includes("exists")
    ) {
      return jsonError(400, "Ya existe una cuenta con ese email.")
    }
    return jsonError(400, translateAdminError(error.message))
  }

  return NextResponse.json({ ok: true as const }, { status: 201 })
}

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status })
}

function translateAdminError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes("password")) {
    return "La contraseña no cumple los requisitos del servidor."
  }
  if (lower.includes("email")) {
    return "El email no es válido o no está permitido."
  }
  return "No se pudo crear la cuenta. Intentá de nuevo más tarde."
}
