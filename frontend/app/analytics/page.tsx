"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useFarmScope } from "@/components/farm-scope-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  fetchLots,
  getPlotPredictionHistory,
  type Lot,
  type PlotPredictionHistoryPoint,
} from "@/lib/supabase-api"

type FarmOption = {
  id: string
  name: string
}

function buildFarmOptions(lots: Lot[]): FarmOption[] {
  const farmsById = new Map<string, FarmOption>()

  for (const lot of lots) {
    if (!farmsById.has(lot.farmId)) {
      farmsById.set(lot.farmId, {
        id: lot.farmId,
        name: lot.farmName || "Granja sin nombre",
      })
    }
  }

  return [...farmsById.values()].sort((a, b) => a.name.localeCompare(b.name, "es"))
}

function buildLotsForFarm(lots: Lot[], farmId: string): Lot[] {
  return lots
    .filter((lot) => lot.farmId === farmId)
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
}

function formatAxisDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  })
}

function formatTooltipDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function formatKgHa(value: number): string {
  return `${Math.round(value).toLocaleString("es-AR")} kg/ha`
}

function normalizeChartNumber(value: number | string | Array<number | string>): number {
  if (Array.isArray(value)) {
    return Number(value[0] ?? 0)
  }

  return Number(value)
}

function formatAxisKgHa(value: number | string): string {
  return Math.round(Number(value)).toLocaleString("es-AR")
}

function AnalyticsPageInner() {
  const { selectedFarmId: scopedFarmId } = useFarmScope()
  const [lots, setLots] = useState<Lot[]>([])
  const [selectedFarmId, setSelectedFarmId] = useState("")
  const [selectedLotId, setSelectedLotId] = useState("")
  const [history, setHistory] = useState<PlotPredictionHistoryPoint[] | null>(null)
  const [loadingLots, setLoadingLots] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const farms = buildFarmOptions(lots)
  const lotsForSelectedFarm = selectedFarmId ? buildLotsForFarm(lots, selectedFarmId) : []
  const selectedLot = lots.find((lot) => lot.id === selectedLotId) ?? null

  useEffect(() => {
    let active = true

    async function loadLots() {
      setLoadingLots(true)
      setError(null)

      try {
        const lotsData = await fetchLots(
          scopedFarmId === "all" ? undefined : { farmId: scopedFarmId },
        )
        if (!active) return
        setLots(lotsData)
      } catch (err) {
        console.error("Error loading lots for analytics:", err)
        if (!active) return
        setLots([])
        setError("No pudimos cargar granjas y lotes desde Supabase.")
      } finally {
        if (active) setLoadingLots(false)
      }
    }

    void loadLots()

    return () => {
      active = false
    }
  }, [scopedFarmId])

  useEffect(() => {
    if (farms.length === 0) {
      if (selectedFarmId) setSelectedFarmId("")
      return
    }

    if (scopedFarmId !== "all") {
      const scopedExists = farms.some((farm) => farm.id === scopedFarmId)
      if (scopedExists && selectedFarmId !== scopedFarmId) {
        setSelectedFarmId(scopedFarmId)
        return
      }
    }

    const farmExists = farms.some((farm) => farm.id === selectedFarmId)
    if (!farmExists) {
      setSelectedFarmId(farms[0].id)
    }
  }, [farms, scopedFarmId, selectedFarmId])

  useEffect(() => {
    if (!selectedFarmId) {
      if (selectedLotId) setSelectedLotId("")
      return
    }

    const lotExists = lotsForSelectedFarm.some((lot) => lot.id === selectedLotId)
    if (!lotExists) {
      setSelectedLotId(lotsForSelectedFarm[0]?.id ?? "")
    }
  }, [lotsForSelectedFarm, selectedFarmId, selectedLotId])

  useEffect(() => {
    let active = true

    async function loadHistory() {
      if (!selectedLotId) {
        setHistory([])
        setLoadingHistory(false)
        return
      }

      setLoadingHistory(true)
      setHistory(null)
      setError(null)

      try {
        const historyData = await getPlotPredictionHistory(selectedLotId)
        if (!active) return
        setHistory(historyData)
      } catch (err) {
        console.error("Error loading prediction history:", err)
        if (!active) return
        setHistory([])
        setError("No pudimos cargar las estimaciones guardadas para este lote.")
      } finally {
        if (active) setLoadingHistory(false)
      }
    }

    void loadHistory()

    return () => {
      active = false
    }
  }, [selectedLotId])

  const showEmptyLots = !loadingLots && farms.length === 0
  const showEmptyHistory =
    !loadingLots &&
    !loadingHistory &&
    selectedLot != null &&
    Array.isArray(history) &&
    history.length === 0 &&
    !error

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Rendimientos
        </h1>
        <p className="text-muted-foreground">
          Historial de estimaciones guardadas en Supabase por granja y lote.
        </p>
      </div>

      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div>
            <CardTitle className="text-foreground">
              Estimaciones a lo largo del tiempo
            </CardTitle>
            <CardDescription>
              Elegi una granja y despues un lote para ver los registros de
              `plot_prediction` ordenados por `created_at`.
            </CardDescription>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="analytics-farm">Granja</Label>
              <Select
                value={selectedFarmId}
                onValueChange={setSelectedFarmId}
                disabled={loadingLots || farms.length === 0}
              >
                <SelectTrigger id="analytics-farm" className="bg-card">
                  <SelectValue placeholder="Seleccionar granja" />
                </SelectTrigger>
                <SelectContent>
                  {farms.map((farm) => (
                    <SelectItem key={farm.id} value={farm.id}>
                      {farm.name}
                    </SelectItem>
                  ))}
                  {farms.length === 0 && (
                    <SelectItem value="_none" disabled>
                      Sin granjas registradas
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="analytics-lot">Lote</Label>
              <Select
                value={selectedLotId}
                onValueChange={setSelectedLotId}
                disabled={
                  loadingLots ||
                  !selectedFarmId ||
                  lotsForSelectedFarm.length === 0
                }
              >
                <SelectTrigger id="analytics-lot" className="bg-card">
                  <SelectValue placeholder="Seleccionar lote" />
                </SelectTrigger>
                <SelectContent>
                  {lotsForSelectedFarm.map((lot) => (
                    <SelectItem key={lot.id} value={lot.id}>
                      {lot.name}
                    </SelectItem>
                  ))}
                  {lotsForSelectedFarm.length === 0 && (
                    <SelectItem value="_none" disabled>
                      Sin lotes para esta granja
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loadingLots || loadingHistory ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-[360px] w-full" />
            </div>
          ) : showEmptyLots ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-center">
              <div className="space-y-2">
                <p className="font-medium text-foreground">
                  No hay granjas ni lotes cargados.
                </p>
                <p className="text-sm text-muted-foreground">
                  Crea al menos un lote para ver el historial de estimaciones.
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-6 text-center">
              <div className="space-y-2">
                <p className="font-medium text-foreground">{error}</p>
                <p className="text-sm text-muted-foreground">
                  Revisa la tabla `plot_prediction` y la sesion de Supabase.
                </p>
              </div>
            </div>
          ) : showEmptyHistory ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-center">
              <div className="space-y-2">
                <p className="font-medium text-foreground">
                  No hay estimaciones guardadas para este lote.
                </p>
                <p className="text-sm text-muted-foreground">
                  Cuando existan filas en `plot_prediction`, apareceran en este
                  grafico segun `created_at`.
                </p>
              </div>
            </div>
          ) : !selectedLot || !history ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-center">
              <div className="space-y-2">
                <p className="font-medium text-foreground">
                  Selecciona un lote para ver el historial.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {selectedLot.farmName} / {selectedLot.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {history.length} estimacion{history.length === 1 ? "" : "es"} registradas
                </p>
              </div>

              <div className="h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={history}
                    margin={{ top: 12, right: 16, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-border"
                    />
                    <XAxis
                      dataKey="createdAt"
                      tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                      tickFormatter={formatAxisDate}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={24}
                    />
                    <YAxis
                      tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                      tickFormatter={(value: number | string) => formatAxisKgHa(value)}
                      tickLine={false}
                      axisLine={false}
                      width={72}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "6px",
                        fontSize: 12,
                      }}
                      formatter={(
                        value: number | string | Array<number | string>,
                      ) => [
                        formatKgHa(normalizeChartNumber(value)),
                        "Estimacion",
                      ]}
                      labelFormatter={(label: string | number) =>
                        typeof label === "string"
                          ? formatTooltipDate(label)
                          : String(label)
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="predictedKgHa"
                      name="Estimacion"
                      stroke="var(--color-primary)"
                      strokeWidth={3}
                      dot={{
                        fill: "var(--color-primary)",
                        stroke: "var(--color-card)",
                        strokeWidth: 2,
                        r: history.length === 1 ? 5 : 4,
                      }}
                      activeDot={{ r: 6, fill: "var(--color-primary)" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function AnalyticsPage() {
  return (
    <DashboardLayout>
      <AnalyticsPageInner />
    </DashboardLayout>
  )
}
