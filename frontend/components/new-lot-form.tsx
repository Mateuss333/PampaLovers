"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
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
import { createPlotWithEnrichment } from "@/lib/supabase-api"
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
  sowingDate: string
  areaHa: string
  polygonPoints: LngLatTuple[]
  soilPh: string
  irrigationType: string
  fertilizerType: string
  pesticideUsageMl: string
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

/** Valores en inglés para BD/API; `label` es solo lo que ve el usuario. */
const irrigationOptions = [
  { value: "Drip", label: "Goteo" },
  { value: "Sprinkle", label: "Aspersión" },
  { value: "Manual", label: "Manual" },
  { value: "None", label: "Sin riego" },
] as const

const fertilizerOptions = [
  { value: "Organic", label: "Orgánico" },
  { value: "Inorganic", label: "Inorgánico" },
  { value: "Mixed", label: "Mixto" },
] as const

const cropDiseaseOptions = [
  { value: "None", label: "Sin problemas" },
  { value: "Mild", label: "Leve" },
  { value: "Moderate", label: "Moderado" },
  { value: "Severe", label: "Severo" },
] as const

function formatDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getLatestAllowedSowingDate(): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - 7)
  return formatDateInputValue(date)
}

function formatDisplayDate(value: string): string {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("es-AR")
}

function emptyForm(): NewLotFormData {
  return {
    name: "",
    group: "",
    cropType: "",
    sowingDate: "",
    areaHa: "",
    polygonPoints: [],
    soilPh: "",
    irrigationType: "",
    fertilizerType: "",
    pesticideUsageMl: "",
    cropDiseaseStatus: "",
  }
}

interface NewLotFormProps {
  farmId: string | null
  disabledReason?: string | null
  onSuccess?: () => void
}

export function NewLotForm({
  farmId,
  disabledReason = null,
  onSuccess,
}: NewLotFormProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<NewLotFormData>(emptyForm)
  const latestAllowedSowingDate = getLatestAllowedSowingDate()

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

      if (
        formData.sowingDate.trim() !== "" &&
        formData.sowingDate > latestAllowedSowingDate
      ) {
        setError(
          `La fecha de siembra debe ser igual o anterior al ${formatDisplayDate(latestAllowedSowingDate)}.`,
        )
        setSubmitting(false)
        return
      }

      const latSum = pts.reduce((s, [, lat]) => s + lat, 0)
      const lonSum = pts.reduce((s, [lon]) => s + lon, 0)
      const n = pts.length
      const descriptionParts = [
        formData.sowingDate && `Siembra ${formData.sowingDate}`,
      ].filter(Boolean)

      const parsedPh = parseFloat(formData.soilPh)
      const parsedPesticide = parseFloat(formData.pesticideUsageMl)

      const result = await createPlotWithEnrichment({
        farm_id: farmId,
        name: formData.name,
        group: parsedGroup,
        crop_type: formData.cropType || undefined,
        description: descriptionParts.length ? descriptionParts.join(" · ") : undefined,
        sowing_date: formData.sowingDate.trim() || undefined,
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

      toast.success("Lote creado")
      if (result.enrichment.warnings.length > 0) {
        toast.info(
          `El lote se guardo, pero faltaron metricas automaticas. ${result.enrichment.warnings.join(" ")}`,
        )
      }

      onSuccess?.()
      handleOpenChange(false)
    } catch (err) {
      setError(formatSubmitError(err))
    }
    setSubmitting(false)
  }

  const polygonComplete = formData.polygonPoints.length === 4
  const canCreateLot = farmId != null && farmId.trim() !== ""

  return (
    <div className="flex flex-col items-end gap-1">
      <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next && !canCreateLot) return
        handleOpenChange(next)
      }}
    >
      {canCreateLot ? (
        <DialogTrigger asChild>
          <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Nuevo Lote
          </Button>
        </DialogTrigger>
      ) : (
        <Button
          type="button"
          disabled
          className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          title={disabledReason ?? "Selecciona una granja arriba para crear un lote"}
        >
          <Plus className="h-4 w-4" />
          Nuevo Lote
        </Button>
      )}
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

            <div className="grid gap-4 sm:grid-cols-2">
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
                <Label htmlFor="sowingDate" className="text-foreground">
                  Fecha de Siembra <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="sowingDate"
                  type="date"
                  max={latestAllowedSowingDate}
                  value={formData.sowingDate}
                  onChange={(e) =>
                    setFormData({ ...formData, sowingDate: e.target.value })
                  }
                  className="bg-background"
                  required
                  disabled={submitting}
                  aria-describedby="sowingDate-help"
                />
                <p id="sowingDate-help" className="text-xs text-muted-foreground">
                  Solo se permiten fechas hasta el {formatDisplayDate(latestAllowedSowingDate)}.
                </p>
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
                  readOnly
                  tabIndex={-1}
                  placeholder="Marcá 4 puntos en el mapa"
                  value={formData.areaHa}
                  className="bg-muted/50 font-mono text-foreground cursor-default"
                  disabled={submitting}
                  aria-readonly="true"
                />
                <p className="text-xs text-muted-foreground">
                  Se calcula sola a partir del contorno en el mapa.
                </p>
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
                    {irrigationOptions.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
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
                    {fertilizerOptions.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
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
                    {cropDiseaseOptions.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
              {submitting ? "Consultando APIs..." : "Crear Lote"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      </Dialog>
      {!canCreateLot && disabledReason ? (
        <p className="max-w-72 text-right text-xs text-muted-foreground">
          {disabledReason}
        </p>
      ) : null}
    </div>
  )
}
