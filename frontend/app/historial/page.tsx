"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, Eye } from "lucide-react"
import { fetchHarvestLogs, type HarvestLog } from "@/lib/supabase-api"

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-14" /></TableCell>
          <TableCell><Skeleton className="h-4 w-10" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-4 w-14" /></TableCell>
          <TableCell><Skeleton className="h-4 w-10" /></TableCell>
          <TableCell><Skeleton className="h-8 w-8" /></TableCell>
        </TableRow>
      ))}
    </>
  )
}

function formatDate(iso: string | null) {
  if (!iso) return "—"
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("es-AR", { dateStyle: "short" })
  } catch {
    return iso
  }
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
    })
  } catch {
    return iso
  }
}

export default function HistorialPage() {
  const [logs, setLogs] = useState<HarvestLog[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLog, setDetailLog] = useState<HarvestLog | null>(null)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const data = await fetchHarvestLogs()
        setLogs(data)
      } catch (err) {
        console.error("Error loading harvest logs:", err)
        setLogs([])
      }
      setLoading(false)
    }
    loadData()
  }, [])

  const filteredLogs = logs?.filter(
    (log) =>
      log.plot_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.crop_type ?? "").toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Historial de Cosechas
          </h1>
          <p className="text-muted-foreground">
            Registro histórico de todas las cosechas realizadas
          </p>
        </div>

        <Card className="border-border/60">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-foreground">Cosechas Registradas</CardTitle>
                <CardDescription>
                  {loading
                    ? "Cargando..."
                    : `${filteredLogs?.length || 0} cosechas en tu historial`}
                </CardDescription>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por lote o cultivo..."
                  className="w-[240px] pl-9 bg-background"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold text-foreground">Lote</TableHead>
                    <TableHead className="font-semibold text-foreground">Cultivo</TableHead>
                    <TableHead className="text-right font-semibold text-foreground">Área (ha)</TableHead>
                    <TableHead className="font-semibold text-foreground">Siembra</TableHead>
                    <TableHead className="font-semibold text-foreground">Cosecha</TableHead>
                    <TableHead className="text-right font-semibold text-foreground">Rend. (kg/ha)</TableHead>
                    <TableHead className="text-right font-semibold text-foreground">NDVI</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableSkeleton />
                  ) : filteredLogs && filteredLogs.length > 0 ? (
                    filteredLogs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium text-foreground">{log.plot_name}</TableCell>
                        <TableCell className="text-muted-foreground">{log.crop_type ?? "—"}</TableCell>
                        <TableCell className="text-right font-mono text-foreground">
                          {log.area_ha != null ? Number(log.area_ha) : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(log.sowing_date)}</TableCell>
                        <TableCell className="text-foreground">{formatDate(log.harvest_date)}</TableCell>
                        <TableCell className="text-right font-mono font-medium text-foreground tabular-nums">
                          {Number(log.yield_kg_per_hectare).toLocaleString("es-AR")}
                        </TableCell>
                        <TableCell className="text-right">
                          {log.ndvi_index != null ? (
                            <div className="flex items-center justify-end gap-2">
                              <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${Math.max(0, Number(log.ndvi_index)) * 100}%`,
                                    backgroundColor:
                                      Number(log.ndvi_index) > 0.6
                                        ? "var(--color-accent)"
                                        : Number(log.ndvi_index) > 0.4
                                          ? "var(--color-chart-3)"
                                          : "var(--color-chart-4)",
                                  }}
                                />
                              </div>
                              <span className="text-sm font-mono text-foreground tabular-nums">
                                {Number(log.ndvi_index).toFixed(2)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setDetailLog(log)
                              setDetailOpen(true)
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No hay cosechas registradas.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Detalle de cosecha</DialogTitle>
              <DialogDescription>
                Snapshot del lote al momento de la cosecha.
              </DialogDescription>
            </DialogHeader>
            {detailLog ? (
              <div className="grid gap-3 py-2 text-sm max-h-[60vh] overflow-y-auto">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Lote</span>
                  <span className="font-medium text-foreground text-right">{detailLog.plot_name}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Cultivo</span>
                  <span className="text-foreground text-right">{detailLog.crop_type ?? "—"}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Área (ha)</span>
                  <span className="font-mono text-foreground">
                    {detailLog.area_ha != null ? String(detailLog.area_ha) : "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Fecha de siembra</span>
                  <span className="text-foreground">{formatDate(detailLog.sowing_date)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Fecha de cosecha</span>
                  <span className="font-medium text-foreground">{formatDate(detailLog.harvest_date)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Rendimiento</span>
                  <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-500/30 font-mono">
                    {Number(detailLog.yield_kg_per_hectare).toLocaleString("es-AR")} kg/ha
                  </Badge>
                </div>

                <div className="border-t border-border pt-2 mt-1">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Datos ambientales al cosechar</p>
                </div>
                {detailLog.ndvi_index != null && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">NDVI</span>
                    <span className="font-mono text-foreground">{Number(detailLog.ndvi_index).toFixed(2)}</span>
                  </div>
                )}
                {detailLog.soil_ph != null && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">pH del suelo</span>
                    <span className="font-mono text-foreground">{String(detailLog.soil_ph)}</span>
                  </div>
                )}
                {detailLog.soil_moisture_percent != null && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Humedad suelo</span>
                    <span className="font-mono text-foreground">{String(detailLog.soil_moisture_percent)}%</span>
                  </div>
                )}
                {detailLog.temperature_c != null && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Temperatura</span>
                    <span className="font-mono text-foreground">{String(detailLog.temperature_c)} °C</span>
                  </div>
                )}
                {detailLog.humidity_percent != null && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Humedad ambiente</span>
                    <span className="font-mono text-foreground">{String(detailLog.humidity_percent)}%</span>
                  </div>
                )}
                {detailLog.rainfall_mm != null && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Precipitaciones</span>
                    <span className="font-mono text-foreground">{String(detailLog.rainfall_mm)} mm</span>
                  </div>
                )}
                {detailLog.sunlight_hours != null && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Horas de sol</span>
                    <span className="font-mono text-foreground">{String(detailLog.sunlight_hours)} hs</span>
                  </div>
                )}
                {detailLog.irrigation_type && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Riego</span>
                    <span className="text-foreground">{detailLog.irrigation_type}</span>
                  </div>
                )}
                {detailLog.fertilizer_type && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Fertilizante</span>
                    <span className="text-foreground">{detailLog.fertilizer_type}</span>
                  </div>
                )}
                {detailLog.pesticide_usage_ml != null && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Pesticida</span>
                    <span className="font-mono text-foreground">{String(detailLog.pesticide_usage_ml)} ml</span>
                  </div>
                )}
                {detailLog.crop_disease_status && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Estado sanitario</span>
                    <span className="text-foreground">{detailLog.crop_disease_status}</span>
                  </div>
                )}
                {detailLog.notes && (
                  <div className="border-t border-border pt-2">
                    <p className="text-muted-foreground text-xs mb-1">Notas</p>
                    <p className="text-foreground">{detailLog.notes}</p>
                  </div>
                )}
                <div className="flex justify-between gap-4 text-xs text-muted-foreground border-t border-border pt-2">
                  <span>Registrado</span>
                  <span>{formatDateTime(detailLog.created_at)}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">Sin datos.</p>
            )}
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setDetailOpen(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
