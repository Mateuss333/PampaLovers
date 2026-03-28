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
import { Plus, MapPin, Calendar, Wheat } from "lucide-react"
import {
  LotPolygonMapPicker,
  type LngLatTuple,
} from "@/components/lot-polygon-map-picker"

export interface NewLotFormData {
  name: string
  group: string
  cropType: string
  year: string
  sowingDate: string
  polygonPoints: LngLatTuple[]
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

const emptyForm = (): NewLotFormData => ({
  name: "",
  group: "",
  cropType: "",
  year: currentYear.toString(),
  sowingDate: "",
  polygonPoints: [],
})

export function NewLotForm({ onSubmit }: { onSubmit?: (data: NewLotFormData) => void }) {
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState(emptyForm)

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setFormData((prev) => ({ ...prev, polygonPoints: [] }))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const pts = formData.polygonPoints
    if (pts.length !== 4) return

    const allFinite = pts.every(
      ([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat)
    )
    if (!allFinite) return

    const ring: LngLatTuple[] = [...pts, pts[0]]

    const payload = {
      type: "Feature",
      properties: {
        name: formData.name,
        group: formData.group,
        years_data: [
          {
            crop_type: formData.cropType,
            year: formData.year,
            sowing_date: formData.sowingDate,
          },
        ],
      },
      geometry: {
        type: "Polygon",
        coordinates: [ring],
      },
    }

    console.log("API Payload:", JSON.stringify(payload, null, 2))
    onSubmit?.({ ...formData, polygonPoints: pts })
    setOpen(false)
    setFormData(emptyForm())
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
                  onChange={(e) =>
                    setFormData({ ...formData, group: e.target.value })
                  }
                  className="bg-background"
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
                />
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

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!polygonComplete}
              className="bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-60"
            >
              Crear Lote
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
