"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { User, Building2, MapPin } from "lucide-react"
import {
  getUserProfile,
  getFarmSettingsForFarm,
  updateProfile,
  updateFarm,
  type FarmSettings,
} from "@/lib/supabase-api"
import { createClient } from "@/lib/supabase/client"
import { useFarmScope } from "@/components/farm-scope-context"

const DELETE_ACCOUNT_PHRASE = "ELIMINAR"

function SettingsPageInner() {
  const router = useRouter()
  const { selectedFarmId } = useFarmScope()
  const [farmSettings, setFarmSettings] = useState<FarmSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [farmName, setFarmName] = useState("")
  const [farmSize, setFarmSize] = useState("")
  const [location, setLocation] = useState("")
  const [timezone, setTimezone] = useState("")
  const [currency, setCurrency] = useState("")

  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)
  const [deleteAccountInput, setDeleteAccountInput] = useState("")
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false)

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
          setTimezone("america-buenos-aires")
          setCurrency("ars")
        } else {
          const farm = await getFarmSettingsForFarm(selectedFarmId)
          setFarmSettings(farm)
          if (farm) {
            setFarmName(farm.name)
            setFarmSize(String(farm.size))
            setLocation(farm.location)
            setTimezone(farm.timezone)
            setCurrency(farm.currency)
          } else {
            setFarmName("")
            setFarmSize("")
            setLocation("")
            setTimezone("america-buenos-aires")
            setCurrency("ars")
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
      await updateProfile({ name, email })
      if (farmSettings && !farmScopeLocked) {
        await updateFarm(farmSettings.id, {
          name: farmName,
          location_name: location,
          size_ha: farmSize ? parseFloat(farmSize) : undefined,
          timezone,
          currency,
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

  async function handleDeleteAccount() {
    if (deleteAccountInput.trim() !== DELETE_ACCOUNT_PHRASE) {
      toast.error(`Escribí ${DELETE_ACCOUNT_PHRASE} para confirmar`)
      return
    }
    setDeleteAccountLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.functions.invoke("delete-account", {
        method: "POST",
      })

      if (error) {
        let message = error.message
        try {
          const body = await error.context.json() as { error?: string }
          if (body?.error) message = body.error
        } catch {
          /* usar message por defecto */
        }
        toast.error(message)
        return
      }

      if (
        data &&
        typeof data === "object" &&
        "error" in data &&
        data.error != null
      ) {
        toast.error(String(data.error))
        return
      }

      toast.success("Cuenta eliminada")
      setDeleteAccountOpen(false)
      setDeleteAccountInput("")
      await supabase.auth.signOut()
      router.push("/login")
      router.refresh()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo eliminar la cuenta",
      )
    }
    setDeleteAccountLoading(false)
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Configuración</h1>
          <p className="text-muted-foreground">
            Perfil y datos del campo elegido en la barra superior (no «Todos los campos»).
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Settings */}
          <form className="space-y-6 lg:col-span-2" onSubmit={handleSave}>
            {/* Profile Information */}
            <Card className="border-border/60">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-foreground">Información Personal</CardTitle>
                    <CardDescription>
                      Actualiza tu información de contacto
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
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-background"
                        autoComplete="email"
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
                        ? "Seleccioná un campo en la barra superior para editar nombre, superficie y ubicación."
                        : "Información del establecimiento del campo seleccionado"}
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
                      <Input
                        id="farmSize"
                        type="number"
                        value={farmSize}
                        onChange={(e) => setFarmSize(e.target.value)}
                        className="bg-background font-mono"
                        disabled={farmScopeLocked || !farmSettings}
                      />
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
                  <div className="space-y-2">
                    <Label htmlFor="timezone" className="text-foreground">Zona Horaria</Label>
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Select
                        value={timezone}
                        onValueChange={setTimezone}
                        disabled={farmScopeLocked || !farmSettings}
                      >
                        <SelectTrigger id="timezone" className="bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="america-buenos-aires">
                            América/Buenos Aires (GMT-3)
                          </SelectItem>
                          <SelectItem value="america-montevideo">
                            América/Montevideo (GMT-3)
                          </SelectItem>
                          <SelectItem value="america-santiago">
                            América/Santiago (GMT-4)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency" className="text-foreground">Moneda</Label>
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Select
                        value={currency}
                        onValueChange={setCurrency}
                        disabled={farmScopeLocked || !farmSettings}
                      >
                        <SelectTrigger id="currency" className="bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ars">Peso Argentino (ARS)</SelectItem>
                          <SelectItem value="usd">Dólar (USD)</SelectItem>
                          <SelectItem value="eur">Euro (EUR)</SelectItem>
                        </SelectContent>
                      </Select>
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

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base text-foreground">Tu Cuenta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-medium text-foreground">Professional</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Lotes</span>
                  <span className="font-mono font-medium text-foreground">24 / 50</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Imágenes/mes</span>
                  <span className="font-mono font-medium text-foreground">1,247 / 2,000</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Miembro desde</span>
                  <span className="font-medium text-foreground">Mar 2024</span>
                </div>
                <Separator />
                <Button variant="outline" className="w-full" type="button">
                  Actualizar Plan
                </Button>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-destructive/40">
              <CardHeader>
                <CardTitle className="text-base text-destructive">
                  Zona de Peligro
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                  onClick={() => {
                    setDeleteAccountInput("")
                    setDeleteAccountOpen(true)
                  }}
                >
                  Eliminar cuenta
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog
        open={deleteAccountOpen}
        onOpenChange={(open) => {
          setDeleteAccountOpen(open)
          if (!open) setDeleteAccountInput("")
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar cuenta</DialogTitle>
            <DialogDescription>
              Se borrará tu usuario y los datos asociados en la base. Esta acción no se puede
              deshacer. Escribí{" "}
              <span className="font-mono font-semibold text-foreground">{DELETE_ACCOUNT_PHRASE}</span>{" "}
              para confirmar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="delete-confirm" className="text-foreground">
              Confirmación
            </Label>
            <Input
              id="delete-confirm"
              value={deleteAccountInput}
              onChange={(e) => setDeleteAccountInput(e.target.value)}
              placeholder={DELETE_ACCOUNT_PHRASE}
              className="bg-background"
              autoComplete="off"
              disabled={deleteAccountLoading}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteAccountOpen(false)}
              disabled={deleteAccountLoading}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDeleteAccount()}
              disabled={
                deleteAccountLoading || deleteAccountInput.trim() !== DELETE_ACCOUNT_PHRASE
              }
            >
              {deleteAccountLoading ? "Eliminando…" : "Eliminar definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <SettingsPageInner />
    </DashboardLayout>
  )
}
