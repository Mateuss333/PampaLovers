"use client"

import { useState } from "react"
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
import { Plus, MapPin, Calendar, Wheat, Trash2, Loader2 } from "lucide-react"
import { createPlot } from "@/lib/supabase-api"

interface Coordinate {
  lon: string
  lat: string
}

interface NewLotFormData {
  name: string
  group: string
  cropType: string
  year: string
  sowingDate: string
  areaHa: string
  coordinates: Coordinate[]
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

interface NewLotFormProps {
  farmId: string | null
  onSuccess?: () => void
}

export function NewLotForm({ farmId, onSuccess }: NewLotFormProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<NewLotFormData>({
    name: "",
    group: "",
    cropType: "",
    year: currentYear.toString(),
    sowingDate: "",
    areaHa: "",
    coordinates: [
      { lon: "", lat: "" },
      { lon: "", lat: "" },
      { lon: "", lat: "" },
    ],
  })

  const handleAddCoordinate = () => {
    setFormData({
      ...formData,
      coordinates: [...formData.coordinates, { lon: "", lat: "" }],
    })
  }

  const handleRemoveCoordinate = (index: number) => {
    if (formData.coordinates.length > 3) {
      setFormData({
        ...formData,
        coordinates: formData.coordinates.filter((_, i) => i !== index),
      })
    }
  }

  const handleCoordinateChange = (index: number, field: "lon" | "lat", value: string) => {
    const newCoordinates = [...formData.coordinates]
    newCoordinates[index] = { ...newCoordinates[index], [field]: value }
    setFormData({ ...formData, coordinates: newCoordinates })
  }

  const resetForm = () => {
    setFormData({
      name: "",
      group: "",
      cropType: "",
      year: currentYear.toString(),
      sowingDate: "",
      areaHa: "",
      coordinates: [
        { lon: "", lat: "" },
        { lon: "", lat: "" },
        { lon: "", lat: "" },
      ],
    })
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!farmId) {
      setError("No se encontró un establecimiento asociado.")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const validCoords = formData.coordinates.filter((c) => c.lon && c.lat)
      const centroid =
        validCoords.length > 0
          ? {
              latitude:
                validCoords.reduce((s, c) => s + parseFloat(c.lat), 0) /
                validCoords.length,
              longitude:
                validCoords.reduce((s, c) => s + parseFloat(c.lon), 0) /
                validCoords.length,
            }
          : {}

      await createPlot({
        farm_id: farmId,
        name: formData.name,
        crop_type: formData.cropType || undefined,
        description: formData.group || undefined,
        area_ha: formData.areaHa ? parseFloat(formData.areaHa) : undefined,
        ...centroid,
      })

      onSuccess?.()
      setOpen(false)
      resetForm()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al crear el lote",
      )
    }
    setSubmitting(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
          <Plus className="h-4 w-4" />
          Nuevo Lote
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Crear Nuevo Lote</DialogTitle>
          <DialogDescription>
            Ingresa los datos del lote para registrarlo en el sistema
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Basic Info */}
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
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-background"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="group" className="text-foreground">
                  Grupo
                </Label>
                <Input
                  id="group"
                  placeholder="ej: Zona Norte"
                  value={formData.group}
                  onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                  className="bg-background"
                />
              </div>
            </div>
          </div>

          {/* Crop Info */}
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
                  onValueChange={(value) => setFormData({ ...formData, cropType: value })}
                  required
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
                  onValueChange={(value) => setFormData({ ...formData, year: value })}
                  required
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
                  onChange={(e) => setFormData({ ...formData, sowingDate: e.target.value })}
                  className="bg-background"
                  required
                />
              </div>
            </div>
          </div>

          {/* Area */}
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

          {/* Coordinates */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Coordenadas del Polígono
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCoordinate}
                className="gap-1"
              >
                <Plus className="h-3 w-3" />
                Agregar Punto
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground">
              Ingresa al menos 3 coordenadas para definir el polígono del lote (formato decimal)
            </p>
            
            <div className="space-y-3">
              {formData.coordinates.map((coord, index) => (
                <div key={index} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground w-6">
                    {index + 1}.
                  </span>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div className="relative">
                      <Input
                        placeholder="Longitud (lon)"
                        value={coord.lon}
                        onChange={(e) => handleCoordinateChange(index, "lon", e.target.value)}
                        className="bg-background font-mono text-sm"
                        type="number"
                        step="any"
                        required
                      />
                    </div>
                    <div className="relative">
                      <Input
                        placeholder="Latitud (lat)"
                        value={coord.lat}
                        onChange={(e) => handleCoordinateChange(index, "lat", e.target.value)}
                        className="bg-background font-mono text-sm"
                        type="number"
                        step="any"
                        required
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveCoordinate(index)}
                    disabled={formData.coordinates.length <= 3}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
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
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={submitting}
            >
              {submitting && <Loader2 className="animate-spin" />}
              Crear Lote
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
