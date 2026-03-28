"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { User, Building2, MapPin, Cpu } from "lucide-react"
import { getUserProfile, getFarmSettings, type UserProfile, type FarmSettings } from "@/lib/api"

export default function SettingsPage() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [farmSettings, setFarmSettings] = useState<FarmSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [farmName, setFarmName] = useState("")
  const [farmSize, setFarmSize] = useState("")
  const [location, setLocation] = useState("")
  const [timezone, setTimezone] = useState("")
  const [currency, setCurrency] = useState("")

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const [profile, farm] = await Promise.all([
        getUserProfile(),
        getFarmSettings(),
      ])
      setUserProfile(profile)
      setFarmSettings(farm)
      setFirstName(profile.firstName)
      setLastName(profile.lastName)
      setEmail(profile.email)
      setFarmName(farm.name)
      setFarmSize(String(farm.size))
      setLocation(farm.location)
      setTimezone(farm.timezone)
      setCurrency(farm.currency)
      setLoading(false)
    }
    loadData()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await new Promise((r) => setTimeout(r, 450))
    setSaving(false)
    toast.success("Cambios guardados")
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Configuración</h1>
          <p className="text-muted-foreground">
            Administra tu perfil, preferencias y configuración de la finca
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
                <div className="flex items-center gap-4">
                  {loading ? (
                    <>
                      <Skeleton className="h-16 w-16 rounded-full" />
                      <div>
                        <Skeleton className="h-8 w-24 mb-1" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </>
                  ) : (
                    <>
                      <Avatar className="h-16 w-16 border border-border">
                        <AvatarImage src={userProfile?.avatar || "/avatars/01.png"} alt="Usuario" />
                        <AvatarFallback className="bg-primary text-primary-foreground text-lg font-medium">
                          {userProfile?.firstName?.[0]}{userProfile?.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <Button type="button" variant="outline" size="sm">
                          Cambiar foto
                        </Button>
                        <p className="mt-1 text-xs text-muted-foreground">
                          JPG, PNG. Max 2MB.
                        </p>
                      </div>
                    </>
                  )}
                </div>

                <Separator />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-foreground">Nombre</Label>
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Input
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="bg-background"
                        autoComplete="given-name"
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-foreground">Apellido</Label>
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Input
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="bg-background"
                        autoComplete="family-name"
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
                    <CardTitle className="text-foreground">Detalles de la Finca</CardTitle>
                    <CardDescription>
                      Información de tu establecimiento agrícola
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="farmName" className="text-foreground">Nombre de la Finca</Label>
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Input
                        id="farmName"
                        value={farmName}
                        onChange={(e) => setFarmName(e.target.value)}
                        className="bg-background"
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
                        />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone" className="text-foreground">Zona Horaria</Label>
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Select value={timezone} onValueChange={setTimezone}>
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
                      <Select value={currency} onValueChange={setCurrency}>
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
                  Guarda nombre, email y datos de la finca. El resto de opciones del panel se gestionan aparte.
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
            {/* ML Settings */}
            <Card className="border-border/60">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-accent" />
                  <CardTitle className="text-base text-foreground">Configuración ML</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Frecuencia de Análisis</Label>
                  <Select defaultValue="daily">
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="realtime">Tiempo real</SelectItem>
                      <SelectItem value="daily">Diario</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

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
                >
                  Eliminar cuenta
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
