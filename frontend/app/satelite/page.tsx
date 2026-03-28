"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Plus,
  Minus,
  Satellite,
  Map as MapIcon,
  Calendar,
  Crosshair,
  ChevronDown,
  TriangleAlert,
} from "lucide-react"
import { fetchLots, type Lot } from "@/lib/supabase-api"
import {
  SatelliteMap,
  type SatelliteMapHandle,
} from "@/components/satellite-map"
import { Switch } from "@/components/ui/switch"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const cropColors: Record<string, string> = {
  Soja: "bg-primary",
  Maíz: "bg-accent",
  Trigo: "bg-chart-3",
  Girasol: "bg-chart-4",
}

function lotHasPolygon(lot: Lot): boolean {
  return !!(lot.polygon && lot.polygon.length >= 3)
}

export default function SatelitePage() {
  const mapRef = useRef<SatelliteMapHandle>(null)
  const [mapType, setMapType] = useState<"satellite" | "streets">("satellite")
  const [lots, setLots] = useState<Lot[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [hiddenPlotIds, setHiddenPlotIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        setLots(await fetchLots())
      } catch {
        setLots([])
      }
      setLoading(false)
    }
    loadData()
  }, [])

  const satellitePlots = useMemo(() => {
    if (!lots) return []
    return lots
      .filter((l) => lotHasPolygon(l))
      .map((l) => ({
        id: l.id,
        name: l.name,
        polygon: l.polygon!,
      }))
  }, [lots])

  const visiblePlotsOnMap = useMemo(
    () => satellitePlots.filter((p) => !hiddenPlotIds.has(p.id)),
    [satellitePlots, hiddenPlotIds],
  )

  const lotsByGroup = useMemo(() => {
    if (!lots) return []
    const m = new Map<number, Lot[]>()
    for (const lot of lots) {
      const g = lot.plotGroup
      if (!m.has(g)) m.set(g, [])
      m.get(g)!.push(lot)
    }
    return [...m.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([group, items]) => ({
        group,
        items: [...items].sort((a, b) => a.name.localeCompare(b.name, "es")),
      }))
  }, [lots])

  const mappablePlotIds = useMemo(() => satellitePlots.map((p) => p.id), [satellitePlots])

  function togglePlotOnMap(id: string) {
    setHiddenPlotIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function setGroupOnMap(groupLots: Lot[], visible: boolean) {
    const ids = groupLots.filter(lotHasPolygon).map((l) => l.id)
    if (ids.length === 0) return
    setHiddenPlotIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        if (visible) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }

  function showAllPlotsOnMap() {
    setHiddenPlotIds(new Set())
  }

  function hideAllPlotsOnMap() {
    setHiddenPlotIds(new Set(mappablePlotIds))
  }

  const showPolygonApproximationNotice = useMemo(
    () => lots?.some((l) => l.polygonApproximated) ?? false,
    [lots],
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Vista Satelital</h1>
          <p className="text-muted-foreground">
            Mapa base con tus lotes dibujados cuando tengan polígono guardado en la base.
          </p>
        </div>

        {showPolygonApproximationNotice ? (
          <Alert
            role="status"
            className="border-amber-600/35 bg-amber-500/[0.07] text-foreground shadow-sm"
          >
            <TriangleAlert className="text-amber-700 dark:text-amber-500" aria-hidden />
            <AlertTitle>Algunos lotes sin contorno guardado</AlertTitle>
            <AlertDescription>
              Tenés al menos un lote cargado antes de guardar el polígono en la base: en el mapa se muestra un cuadrado
              aproximado por ubicación y superficie. Los lotes nuevos usan el trazo real que marcaste.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-4">
          <div className="relative lg:col-span-3">
            <Card className="overflow-hidden border-border/60">
              <div className="relative h-[600px] w-full bg-muted">
                <SatelliteMap
                  ref={mapRef}
                  mapType={mapType}
                  plots={visiblePlotsOnMap}
                  navigationPlots={satellitePlots}
                  className="absolute inset-0 z-0 h-full w-full [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full [&_.leaflet-container]:bg-muted"
                />

                <div className="pointer-events-none absolute inset-0 z-10">
                  <div className="pointer-events-auto absolute right-4 top-4 flex flex-col gap-2">
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="h-10 w-10 shadow-lg bg-card border border-border"
                      onClick={() => mapRef.current?.zoomIn()}
                      aria-label="Acercar mapa"
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="h-10 w-10 shadow-lg bg-card border border-border"
                      onClick={() => mapRef.current?.zoomOut()}
                      aria-label="Alejar mapa"
                    >
                      <Minus className="h-5 w-5" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-auto min-w-[10rem] flex-col gap-0.5 py-2 shadow-lg bg-card border border-border px-2"
                      disabled={satellitePlots.length === 0}
                      onClick={() => mapRef.current?.fitToPlots()}
                      aria-label="Centrar mapa en mis lotes"
                    >
                      <Crosshair className="h-4 w-4" />
                      <span className="text-[10px] font-medium leading-tight text-center">
                        Ir a mis lotes
                      </span>
                    </Button>
                  </div>

                  <div className="pointer-events-auto absolute left-4 top-4 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={mapType === "satellite" ? "default" : "secondary"}
                      onClick={() => setMapType("satellite")}
                      className={`gap-2 shadow-lg ${mapType === "satellite" ? "bg-primary text-primary-foreground" : "bg-card"}`}
                    >
                      <Satellite className="h-4 w-4" />
                      Satelital
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={mapType === "streets" ? "default" : "secondary"}
                      onClick={() => setMapType("streets")}
                      className={`gap-2 shadow-lg ${mapType === "streets" ? "bg-primary text-primary-foreground" : "bg-card"}`}
                    >
                      <MapIcon className="h-4 w-4" />
                      Calles
                    </Button>
                  </div>

                  <div className="pointer-events-auto absolute bottom-4 right-4 max-w-[min(100%,280px)]">
                    <Badge
                      variant="secondary"
                      className="gap-1.5 bg-card/95 shadow-lg border-border text-foreground"
                    >
                      <Calendar className="h-3 w-3 shrink-0" />
                      Última actualización: 26 Mar 2026, 14:32
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-foreground">Lotes en el mapa</CardTitle>
                <p className="text-xs text-muted-foreground font-normal pt-1">
                  Activá o desactivá lotes por grupo. El mapa usa el polígono guardado en la base; los lotes viejos sin
                  ese dato se muestran con una vista aproximada.
                </p>
              </CardHeader>
              <CardContent>
                {loading || !lots ? (
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-5 w-8 rounded-full" />
                          <Skeleton className="h-4 w-16" />
                        </div>
                        <Skeleton className="h-3 w-10" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={mappablePlotIds.length === 0}
                        onClick={showAllPlotsOnMap}
                      >
                        Mostrar todos
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={mappablePlotIds.length === 0}
                        onClick={hideAllPlotsOnMap}
                      >
                        Ocultar todos
                      </Button>
                    </div>
                    <div className="max-h-[min(52vh,22rem)] space-y-2 overflow-y-auto pr-1">
                      {lotsByGroup.length === 0 ? (
                        <p className="px-1 text-sm text-muted-foreground">No hay lotes en tu cuenta.</p>
                      ) : null}
                      {lotsByGroup.map(({ group, items }) => {
                        const mappable = items.filter(lotHasPolygon)
                        const groupChecked =
                          mappable.length === 0
                            ? true
                            : mappable.every((l) => !hiddenPlotIds.has(l.id))
                        const farmLabel =
                          items.length > 0 &&
                          Boolean(items[0].farmName) &&
                          items.every((l) => l.farmName === items[0].farmName)
                            ? items[0].farmName
                            : null

                        return (
                          <Collapsible key={group} defaultOpen className="rounded-md border border-border/60 bg-muted/20">
                            <div className="flex items-center gap-2 border-b border-border/50 px-2 py-1.5">
                              <CollapsibleTrigger className="flex flex-1 min-w-0 items-center gap-1.5 text-left text-sm font-medium text-foreground hover:opacity-90 [&[data-state=open]_svg]:rotate-180">
                                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform" />
                                <span className="truncate">Grupo {group}</span>
                                {farmLabel ? (
                                  <Badge variant="secondary" className="ml-1 max-w-[8rem] truncate font-normal">
                                    {farmLabel}
                                  </Badge>
                                ) : null}
                              </CollapsibleTrigger>
                              <Switch
                                checked={groupChecked}
                                disabled={mappable.length === 0}
                                onCheckedChange={(v) => setGroupOnMap(items, v)}
                                aria-label={
                                  mappable.length === 0
                                    ? `Grupo ${group} sin polígonos en mapa`
                                    : groupChecked
                                      ? `Ocultar todos los lotes del grupo ${group}`
                                      : `Mostrar todos los lotes del grupo ${group}`
                                }
                              />
                            </div>
                            <CollapsibleContent>
                              <ul className="space-y-0.5 p-1.5">
                                {items.map((lot) => {
                                  const mappableLot = lotHasPolygon(lot)
                                  const onMap = mappableLot && !hiddenPlotIds.has(lot.id)
                                  return (
                                    <li
                                      key={lot.id}
                                      className={cn(
                                        "flex items-center gap-2 rounded-md px-1.5 py-1",
                                        mappableLot && "hover:bg-muted/80",
                                      )}
                                    >
                                      <Switch
                                        checked={onMap}
                                        disabled={!mappableLot}
                                        onCheckedChange={() => mappableLot && togglePlotOnMap(lot.id)}
                                        aria-label={
                                          mappableLot
                                            ? onMap
                                              ? `Ocultar ${lot.name} del mapa`
                                              : `Mostrar ${lot.name} en el mapa`
                                            : `${lot.name} sin polígono`
                                        }
                                      />
                                      <button
                                        type="button"
                                        disabled={!mappableLot}
                                        onClick={() => mappableLot && mapRef.current?.flyToLot(lot.id)}
                                        className={cn(
                                          "flex min-w-0 flex-1 items-center gap-2 text-left",
                                          !mappableLot && "cursor-not-allowed opacity-50",
                                        )}
                                      >
                                        <span
                                          className={`h-2.5 w-2.5 shrink-0 rounded-sm ${cropColors[lot.crop] || "bg-muted"}`}
                                        />
                                        <span className="truncate text-sm font-medium text-foreground">
                                          {lot.name}
                                        </span>
                                        <span className="truncate text-xs text-muted-foreground">{lot.crop}</span>
                                      </button>
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 shrink-0"
                                        disabled={!mappableLot}
                                        aria-label={`Centrar mapa en ${lot.name}`}
                                        onClick={() => mapRef.current?.flyToLot(lot.id)}
                                      >
                                        <Crosshair className="h-4 w-4" />
                                      </Button>
                                    </li>
                                  )
                                })}
                              </ul>
                            </CollapsibleContent>
                          </Collapsible>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
