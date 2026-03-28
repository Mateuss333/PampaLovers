"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, MapPin, Calendar, Wheat, Loader2, FlaskConical } from "lucide-react"
import { createPlot } from "@/lib/supabase-api"
import { polygonAreaHectares } from "@/lib/polygon-area"
import {
  LotPolygonMapPicker,
  type LngLatTuple,
} from "@/components/lot-polygon-map-picker"

function formatSubmitError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === "object" && err !== null && "message" in err) {
    const o = err as { message?: string; details?: string }
    if (o.message) {
      return o.details ? `${o.message} (${o.details})` : o.message
    }
  }
  return "Error al crear el lote"
}

export interface NewLotFormData {
  name: string
  group: string
  cropType: string
  year: string
  sowingDate: string
  areaHa: string
  polygonPoints: LngLatTuple[]
  soilPh: string
  irrigationType: string
  fertilizerType: string
  pesticideUsageMl: string
  harvestMonth: string
  cropDiseaseStatus: string
}

const cropTypes = [
  "Soja",
  "Maíz",
  "Trigo",
  "Girasol",
  "Sorgo",
  "Cebada",
  "Arroz",
  "Algodón",
]

const currentYear = new Date().getFullYear()
const years = Array.from({ length: 10 }, (_, i) => (currentYear - 5 + i).toString())

const irrigationTypes = ["Drip", "Sprinkle", "Manual", "None"] as const
const fertilizerTypes = ["Organic", "Inorganic", "Mixed"] as const
const cropDiseaseOptions = ["None", "Mild", "Moderate", "Severe"] as const
const months = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
] as const

function emptyForm(): NewLotFormData {
  return {
    name: "",
    group: "",
    cropType: "",
    year: currentYear.toString(),
    sowingDate: "",
    areaHa: "",
    polygonPoints: [],
    soilPh: "",
    irrigationType: "",
    fertilizerType: "",
    pesticideUsageMl: "",
    harvestMonth: "",
    cropDiseaseStatus: "",
  }
}

interface NewLotFormProps {
  farmId: string | null
  onSuccess?: () => void
}

export function NewLotForm({ farmId, onSuccess }: NewLotFormProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<NewLotFormData>(emptyForm)

  useEffect(() => {
    setFormData((prev) => {
      const pts = prev.polygonPoints
      if (pts.length !== 4) {
        return prev.areaHa === "" ? prev : { ...prev, areaHa: "" }
      }
      const ha = polygonAreaHectares(pts)
      if (!Number.isFinite(ha) || ha <= 0) {
        return prev.areaHa === "" ? prev : { ...prev, areaHa: "" }
      }
      const next = ha.toFixed(2)
      return prev.areaHa === next ? prev : { ...prev, areaHa: next }
    })
  }, [formData.polygonPoints])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setFormData(emptyForm())
      setError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!farmId) {
      setError("No se encontró un establecimiento asociado.")
      return
    }

    const pts = formData.polygonPoints
    if (pts.length !== 4) {
      setError("Marcá exactamente 4 vértices en el mapa.")
      return
    }
    if (!pts.every(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat))) {
      setError("Coordenadas del polígono inválidas.")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const parsedGroup = parseInt(formData.group, 10)
      if (!Number.isFinite(parsedGroup) || parsedGroup < 1) {
        setError("El grupo debe ser un número válido.")
        setSubmitting(false)
        return
      }

      const latSum = pts.reduce((s, [, lat]) => s + lat, 0)
      const lonSum = pts.reduce((s, [lon]) => s + lon, 0)
      const n = pts.length
      const descriptionParts = [
        formData.year && `Campaña ${formData.year}`,
        formData.sowingDate && `Siembra ${formData.sowingDate}`,
        formData.harvestMonth && `Cosecha: ${formData.harvestMonth}`,
      ].filter(Boolean)

      const parsedArea = parseFloat(formData.areaHa)
      const areaHa =
        formData.areaHa.trim() !== "" &&
        Number.isFinite(parsedArea) &&
        parsedArea > 0
          ? parsedArea
          : undefined

      const parsedPh = parseFloat(formData.soilPh)
      const parsedPesticide = parseFloat(formData.pesticideUsageMl)

      await createPlot({
        farm_id: farmId,
        name: formData.name,
        group: parsedGroup,
        crop_type: formData.cropType || undefined,
        description: descriptionParts.length ? descriptionParts.join(" · ") : undefined,
        sowing_date: formData.sowingDate.trim() || undefined,
        area_ha: areaHa,
        status: "Sembrado",
        latitude: latSum / n,
        longitude: lonSum / n,
        polygon: pts,
        soil_ph: Number.isFinite(parsedPh) && parsedPh > 0 ? parsedPh : undefined,
        irrigation_type: formData.irrigationType || undefined,
        fertilizer_type: formData.fertilizerType || undefined,
        pesticide_usage_ml: Number.isFinite(parsedPesticide) && parsedPesticide >= 0 ? parsedPesticide : undefined,
        crop_disease_status: formData.cropDiseaseStatus || undefined,
      })

      onSuccess?.()
      handleOpenChange(false)
    } catch (err) {
      setError(formatSubmitError(err))
    }
    setSubmitting(false)
  }

  const polygonComplete = formData.polygonPoints.length === 4

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
          <Plus className="h-4 w-4" />
          Nuevo Lote
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Crear Nuevo Lote</DialogTitle>
          <DialogDescription>
            Ingresa los datos del lote y marcá cuatro vértices en el mapa en orden
            (contorno del polígono).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Wheat className="h-4 w-4 text-muted-foreground" />
              Información del Lote
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground">
                  Nombre del Lote <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="ej: Lote A1"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="bg-background"
                  required
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="group" className="text-foreground">
                  Grupo <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="group"
                  type="number"
                  step="1"
                  min="1"
                  placeholder="ej: 1"
                  value={formData.group}
                  onChange={(e) =>
                    setFormData({ ...formData, group: e.target.value })
                  }
                  className="bg-background font-mono"
                  required
                  disabled={submitting}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Información del Cultivo
            </h3>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="cropType" className="text-foreground">
                  Tipo de Cultivo <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.cropType}
                  onValueChange={(value) =>
                    setFormData({ ...formData, cropType: value })
                  }
                  required
                  disabled={submitting}
                >
                  <SelectTrigger id="cropType" className="bg-background">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {cropTypes.map((crop) => (
                      <SelectItem key={crop} value={crop.toLowerCase()}>
                        {crop}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="year" className="text-foreground">
                  Año <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.year}
                  onValueChange={(value) =>
                    setFormData({ ...formData, year: value })
                  }
                  required
                  disabled={submitting}
                >
                  <SelectTrigger id="year" className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sowingDate" className="text-foreground">
                  Fecha de Siembra <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="sowingDate"
                  type="date"
                  value={formData.sowingDate}
                  onChange={(e) =>
                    setFormData({ ...formData, sowingDate: e.target.value })
                  }
                  className="bg-background"
                  required
                  disabled={submitting}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="areaHa" className="text-foreground">
                  Superficie (hectáreas)
                </Label>
                <Input
                  id="areaHa"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="ej: 85"
                  value={formData.areaHa}
                  onChange={(e) =>
                    setFormData({ ...formData, areaHa: e.target.value })
                  }
                  className="bg-background font-mono"
                  disabled={submitting}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-muted-foreground" />
              Datos Agronómicos
            </h3>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="soilPh" className="text-foreground">
                  pH del Suelo
                </Label>
                <Input
                  id="soilPh"
                  type="number"
                  step="0.1"
                  min="0"
                  max="14"
                  placeholder="ej: 6.5"
                  value={formData.soilPh}
                  onChange={(e) =>
                    setFormData({ ...formData, soilPh: e.target.value })
                  }
                  className="bg-background font-mono"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="irrigationType" className="text-foreground">
                  Tipo de Riego
                </Label>
                <Select
                  value={formData.irrigationType}
                  onValueChange={(value) =>
                    setFormData({ ...formData, irrigationType: value })
                  }
                  disabled={submitting}
                >
                  <SelectTrigger id="irrigationType" className="bg-background">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {irrigationTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fertilizerType" className="text-foreground">
                  Tipo de Fertilizante
                </Label>
                <Select
                  value={formData.fertilizerType}
                  onValueChange={(value) =>
                    setFormData({ ...formData, fertilizerType: value })
                  }
                  disabled={submitting}
                >
                  <SelectTrigger id="fertilizerType" className="bg-background">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {fertilizerTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pesticideUsageMl" className="text-foreground">
                  Uso de Pesticida (ml/día)
                </Label>
                <Input
                  id="pesticideUsageMl"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="ej: 50"
                  value={formData.pesticideUsageMl}
                  onChange={(e) =>
                    setFormData({ ...formData, pesticideUsageMl: e.target.value })
                  }
                  className="bg-background font-mono"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cropDiseaseStatus" className="text-foreground">
                  Estado Sanitario
                </Label>
                <Select
                  value={formData.cropDiseaseStatus}
                  onValueChange={(value) =>
                    setFormData({ ...formData, cropDiseaseStatus: value })
                  }
                  disabled={submitting}
                >
                  <SelectTrigger id="cropDiseaseStatus" className="bg-background">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {cropDiseaseOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="max-w-md space-y-2">
              <Label htmlFor="harvestMonth" className="text-foreground">
                Mes de Cosecha
              </Label>
              <Select
                value={formData.harvestMonth}
                onValueChange={(value) =>
                  setFormData({ ...formData, harvestMonth: value })
                }
                disabled={submitting}
              >
                <SelectTrigger id="harvestMonth" className="bg-background">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Contorno del lote en el mapa
            </h3>
            <p className="text-xs text-muted-foreground">
              Hacé clic en el mapa cuatro veces, en el orden de los vértices del
              polígono. El primero debe coincidir con el sentido que querés para
              el perímetro (como un rectángulo: esquina 1 → 2 → 3 → 4).
            </p>
            <p className="text-xs font-medium text-foreground">
              Puntos marcados: {formData.polygonPoints.length} / 4
              {!polygonComplete && (
                <span className="ml-2 font-normal text-muted-foreground">
                  — necesitás 4 puntos para crear el lote
                </span>
              )}
            </p>
            <LotPolygonMapPicker
              points={formData.polygonPoints}
              onPointsChange={(polygonPoints) =>
                setFormData((prev) => ({ ...prev, polygonPoints }))
              }
              active={open}
              className="z-0 overflow-hidden rounded-md border border-border [&_.leaflet-container]:h-[280px] [&_.leaflet-container]:w-full [&_.leaflet-container]:bg-muted"
            />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting || !polygonComplete}
              className="inline-flex gap-2 bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-60"
            >
              {submitting && (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              )}
              Crear Lote
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
