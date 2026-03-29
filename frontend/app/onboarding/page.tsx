"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createFarm } from "@/lib/supabase-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Leaf, Loader2, MapPin } from "lucide-react"

export default function OnboardingPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [location, setLocation] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError("El nombre del establecimiento es obligatorio.")
      return
    }

    setLoading(true)
    try {
      await createFarm({
        name: name.trim(),
        location_name: location.trim() || undefined,
        description: description.trim() || undefined,
      })
      router.push("/")
      router.refresh()
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : err &&
              typeof err === "object" &&
              "message" in err &&
              typeof (err as { message: unknown }).message === "string"
            ? (err as { message: string }).message
            : "Error al crear el establecimiento."
      setError(msg)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <Leaf className="h-8 w-8 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Bienvenido a AgroSmart
            </h1>
            <p className="text-sm text-muted-foreground">
              Configurá tu establecimiento para comenzar
            </p>
          </div>
        </div>

        <Card className="border-border/60">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Tu Establecimiento</CardTitle>
            <CardDescription>
              Ingresá los datos de tu campo o finca
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Nombre del Establecimiento{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="ej: Estancia La Esperanza"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Ubicación</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    id="location"
                    className="pl-10"
                    placeholder="ej: Pergamino, Buenos Aires"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción (opcional)</Label>
                <Input
                  id="description"
                  placeholder="ej: Campo agrícola mixto"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
            </CardContent>

            <CardFooter>
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={loading}
              >
                {loading && <Loader2 className="animate-spin" />}
                Crear Establecimiento
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
