"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Plus,
  Minus,
  Layers,
  Satellite,
  Map as MapIcon,
  Info,
  Calendar,
  Cpu,
} from "lucide-react"
import { fetchLots, getMLAnalysisProgress, type Lot } from "@/lib/api"

const ndviLegend = [
  { label: "0.0 - 0.2", color: "bg-red-500", description: "Sin vegetación" },
  { label: "0.2 - 0.4", color: "bg-orange-400", description: "Estrés" },
  { label: "0.4 - 0.6", color: "bg-yellow-400", description: "Moderado" },
  { label: "0.6 - 0.8", color: "bg-lime-500", description: "Saludable" },
  { label: "0.8 - 1.0", color: "bg-green-600", description: "Óptimo" },
]

const cropColors: Record<string, string> = {
  Soja: "bg-primary",
  Maíz: "bg-accent",
  Trigo: "bg-chart-3",
  Girasol: "bg-chart-4",
}

export default function SatelitePage() {
  const [mapType, setMapType] = useState<"satellite" | "streets">("satellite")
  const [selectedLayer, setSelectedLayer] = useState("ndvi")
  const [lots, setLots] = useState<Lot[] | null>(null)
  const [mlProgress, setMLProgress] = useState<{ status: string; progress: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const [lotsData, progressData] = await Promise.all([
        fetchLots(),
        getMLAnalysisProgress(),
      ])
      setLots(lotsData)
      setMLProgress(progressData)
      setLoading(false)
    }
    loadData()
  }, [])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Vista Satelital</h1>
          <p className="text-muted-foreground">
            Monitoreo en tiempo real con imágenes satelitales Sentinel-2 y análisis NDVI
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          {/* Map Area */}
          <div className="relative lg:col-span-3">
            <Card className="overflow-hidden border-border/60">
              <div
                className={`relative h-[600px] ${
                  mapType === "satellite"
                    ? "bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900"
                    : "bg-gradient-to-br from-stone-100 via-stone-50 to-amber-50"
                }`}
              >
                {/* Map Grid Pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div
                    className="h-full w-full"
                    style={{
                      backgroundImage: `
                        linear-gradient(to right, ${mapType === "satellite" ? "#fff" : "#000"} 1px, transparent 1px),
                        linear-gradient(to bottom, ${mapType === "satellite" ? "#fff" : "#000"} 1px, transparent 1px)
                      `,
                      backgroundSize: "50px 50px",
                    }}
                  />
                </div>

                {/* Simulated Field Polygons */}
                <svg className="absolute inset-0 h-full w-full">
                  {/* Lote A1 - Soja */}
                  <polygon
                    points="100,100 250,90 260,200 110,220"
                    className="fill-emerald-500/40 stroke-emerald-400 stroke-2"
                  />
                  {/* Lote A2 - Maíz */}
                  <polygon
                    points="280,85 450,100 440,210 270,190"
                    className="fill-lime-400/40 stroke-lime-300 stroke-2"
                  />
                  {/* Lote B1 - Trigo */}
                  <polygon
                    points="90,250 260,230 280,380 100,390"
                    className="fill-yellow-500/40 stroke-yellow-400 stroke-2"
                  />
                  {/* Lote B2 - Soja */}
                  <polygon
                    points="300,220 480,230 470,370 290,360"
                    className="fill-orange-400/40 stroke-orange-300 stroke-2"
                  />
                  {/* Lote C1 - Girasol */}
                  <polygon
                    points="520,120 700,130 690,280 510,270"
                    className="fill-emerald-600/40 stroke-emerald-500 stroke-2"
                  />
                  {/* Lote C2 - Maíz */}
                  <polygon
                    points="500,300 680,310 670,450 490,440"
                    className="fill-green-500/40 stroke-green-400 stroke-2"
                  />
                </svg>

                {/* Map Integration Point */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="rounded-md bg-card/95 px-6 py-4 text-center shadow-lg border border-border">
                    <Satellite className="mx-auto h-8 w-8 text-accent" />
                    <p className="mt-2 text-lg font-medium text-foreground">
                      Mapbox / Google Maps Integration
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Capa satelital con análisis NDVI en tiempo real
                    </p>
                  </div>
                </div>

                {/* Map Controls */}
                <div className="absolute right-4 top-4 flex flex-col gap-2">
                  <Button size="icon" variant="secondary" className="h-10 w-10 shadow-lg bg-card border border-border">
                    <Plus className="h-5 w-5" />
                  </Button>
                  <Button size="icon" variant="secondary" className="h-10 w-10 shadow-lg bg-card border border-border">
                    <Minus className="h-5 w-5" />
                  </Button>
                </div>

                {/* Layer Toggle */}
                <div className="absolute left-4 top-4 flex gap-2">
                  <Button
                    size="sm"
                    variant={mapType === "satellite" ? "default" : "secondary"}
                    onClick={() => setMapType("satellite")}
                    className={`gap-2 shadow-lg ${mapType === "satellite" ? "bg-primary text-primary-foreground" : "bg-card"}`}
                  >
                    <Satellite className="h-4 w-4" />
                    Satelital
                  </Button>
                  <Button
                    size="sm"
                    variant={mapType === "streets" ? "default" : "secondary"}
                    onClick={() => setMapType("streets")}
                    className={`gap-2 shadow-lg ${mapType === "streets" ? "bg-primary text-primary-foreground" : "bg-card"}`}
                  >
                    <MapIcon className="h-4 w-4" />
                    Calles
                  </Button>
                </div>

                {/* Layer Selector */}
                <div className="absolute bottom-4 left-4 flex gap-2">
                  <Select value={selectedLayer} onValueChange={setSelectedLayer}>
                    <SelectTrigger className="w-[140px] bg-card shadow-lg border-border">
                      <Layers className="mr-2 h-4 w-4" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ndvi">NDVI</SelectItem>
                      <SelectItem value="evi">EVI</SelectItem>
                      <SelectItem value="moisture">Humedad</SelectItem>
                      <SelectItem value="thermal">Térmico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Timestamp */}
                <div className="absolute bottom-4 right-4">
                  <Badge variant="secondary" className="gap-1.5 bg-card/95 shadow-lg border-border text-foreground">
                    <Calendar className="h-3 w-3" />
                    Última actualización: 26 Mar 2026, 14:32
                  </Badge>
                </div>
              </div>
            </Card>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-4">
            {/* ML Analysis Status */}
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-foreground">
                  <Cpu className="h-4 w-4 text-accent" />
                  Análisis ML
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading || !mlProgress ? (
                  <>
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-8" />
                    </div>
                    <Skeleton className="h-2 w-full rounded-full" />
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Estado</span>
                      <Badge className="bg-accent/20 text-accent border-accent/30">
                        {mlProgress.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Progreso</span>
                      <span className="text-sm font-mono font-medium text-foreground">{mlProgress.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-accent transition-all" 
                        style={{ width: `${mlProgress.progress}%` }}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Lot Legend */}
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-foreground">Lotes</CardTitle>
              </CardHeader>
              <CardContent>
                {loading || !lots ? (
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-3 w-3 rounded" />
                          <Skeleton className="h-4 w-16" />
                        </div>
                        <Skeleton className="h-3 w-10" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {lots.slice(0, 6).map((lot) => (
                      <div
                        key={lot.id}
                        className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`h-3 w-3 rounded ${cropColors[lot.crop] || "bg-muted"}`} />
                          <span className="text-sm font-medium text-foreground">{lot.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{lot.crop}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* NDVI Legend */}
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-foreground">
                  Escala NDVI
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {ndviLegend.map((item) => (
                    <div key={item.label} className="flex items-center gap-3">
                      <div className={`h-4 w-8 rounded ${item.color}`} />
                      <div className="flex-1">
                        <span className="text-xs font-mono font-medium text-foreground">{item.label}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {item.description}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
