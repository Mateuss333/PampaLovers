"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { Skeleton } from "@/components/ui/skeleton"
import { User, Building2, MapPin } from "lucide-react"
import {
  getUserProfile,
  getFarmSettingsForFarm,
  updateProfile,
  updateFarm,
  type FarmSettings,
} from "@/lib/supabase-api"
import { useFarmScope } from "@/components/farm-scope-context"

function SettingsPageInner() {
  const { selectedFarmId } = useFarmScope()
  const [farmSettings, setFarmSettings] = useState<FarmSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [farmName, setFarmName] = useState("")
  const [farmSize, setFarmSize] = useState("")
  const [location, setLocation] = useState("")

  const farmScopeLocked = selectedFarmId === "all"

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const profile = await getUserProfile()
        setName(profile.name)
        setEmail(profile.email)

        if (selectedFarmId === "all") {
          setFarmSettings(null)
          setFarmName("")
          setFarmSize("")
          setLocation("")
        } else {
          const farm = await getFarmSettingsForFarm(selectedFarmId)
          setFarmSettings(farm)
          if (farm) {
            setFarmName(farm.name)
            setFarmSize(String(farm.size))
            setLocation(farm.location)
          } else {
            setFarmName("")
            setFarmSize("")
            setLocation("")
          }
        }
      } catch (err) {
        console.error("Error loading settings:", err)
      }
      setLoading(false)
    }
    void loadData()
  }, [selectedFarmId])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateProfile({ name })
      if (farmSettings && !farmScopeLocked) {
        await updateFarm(farmSettings.id, {
          name: farmName,
          location_name: location,
          timezone: farmSettings.timezone,
          currency: farmSettings.currency,
        })
      }
      toast.success("Cambios guardados")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar los cambios",
      )
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Configuración</h1>
        <p className="text-muted-foreground">
          Perfil y datos del campo elegido en la barra superior (no «Todos los campos»).
        </p>
      </div>

      <div className="max-w-4xl">
        <form className="space-y-6" onSubmit={handleSave}>
          {/* Profile Information */}
          <Card className="border-border/60">
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-foreground">Información Personal</CardTitle>
                  <CardDescription>
                    El email no se puede cambiar desde aquí
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="name" className="text-foreground">Nombre Completo</Label>
                  {loading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-background"
                      autoComplete="name"
                    />
                  )}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="email" className="text-foreground">Email</Label>
                  {loading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      readOnly
                      tabIndex={-1}
                      className="bg-muted/50 cursor-default"
                      autoComplete="email"
                      aria-readonly="true"
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Farm Details */}
          <Card className="border-border/60">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-foreground">Detalles del campo</CardTitle>
                  <CardDescription>
                    {farmScopeLocked
                      ? "Seleccioná un campo en la barra superior para editar nombre y ubicación."
                      : "La superficie total es la suma de los lotes; el resto es del establecimiento seleccionado"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="farmName" className="text-foreground">Nombre del campo</Label>
                  {loading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Input
                      id="farmName"
                      value={farmName}
                      onChange={(e) => setFarmName(e.target.value)}
                      className="bg-background"
                      disabled={farmScopeLocked || !farmSettings}
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="farmSize" className="text-foreground">Superficie Total (ha)</Label>
                  {loading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <>
                      <Input
                        id="farmSize"
                        readOnly
                        tabIndex={-1}
                        value={farmScopeLocked || !farmSettings ? "—" : farmSize}
                        className="bg-muted/50 font-mono cursor-default"
                        disabled={farmScopeLocked || !farmSettings}
                        aria-readonly="true"
                      />
                      <p className="text-xs text-muted-foreground">
                        Suma de la superficie de todos los lotes del campo.
                      </p>
                    </>
                  )}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="location" className="text-foreground">Ubicación</Label>
                  {loading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      <Input
                        id="location"
                        className="pl-10 bg-background"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        disabled={farmScopeLocked || !farmSettings}
                      />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="rounded-lg border border-border bg-card px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Guarda perfil siempre; datos del campo solo con un campo concreto seleccionado arriba.
              </p>
              <Button
                type="submit"
                size="lg"
                className="w-full shrink-0 sm:w-auto min-w-[180px] bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={loading || saving}
              >
                {saving ? "Guardando…" : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <SettingsPageInner />
    </DashboardLayout>
  )
}
