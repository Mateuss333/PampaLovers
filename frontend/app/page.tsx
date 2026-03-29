"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MetricCardSkeleton, ChartCardSkeleton } from "@/components/skeleton-card"
import { MapPin, Layers, TrendingUp } from "lucide-react"
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts"
import {
  getDashboardMetrics,
  getYieldComparisonByCrop,
  type DashboardMetric,
  type YieldByCrop,
} from "@/lib/supabase-api"
import { useFarmScope } from "@/components/farm-scope-context"

const iconMap: Record<string, typeof MapPin> = {
  area: MapPin,
  lots: Layers,
  yield: TrendingUp,
}

function DashboardPageInner() {
  const { selectedFarmId } = useFarmScope()
  const [metrics, setMetrics] = useState<DashboardMetric[] | null>(null)
  const [yieldData, setYieldData] = useState<YieldByCrop[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const scopeOpts =
        selectedFarmId === "all" ? undefined : { farmId: selectedFarmId }
      const [metricsData, yieldDataRes] = await Promise.all([
        getDashboardMetrics(scopeOpts),
        getYieldComparisonByCrop(scopeOpts).catch((err) => {
          console.error(err)
          return [] as YieldByCrop[]
        }),
      ])
      setMetrics(metricsData)
      setYieldData(yieldDataRes)
      setLoading(false)
    }
    void loadData()
  }, [selectedFarmId])

  return (
    <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            {selectedFarmId === "all"
              ? "Resumen de tu operación agrícola y rendimiento por cultivo"
              : "Resumen del campo seleccionado en la barra superior"}
          </p>
        </div>

        {/* Metric Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {loading || !metrics ? (
            Array.from({ length: 3 }).map((_, i) => <MetricCardSkeleton key={i} />)
          ) : (
            metrics.map((metric) => {
              const Icon = iconMap[metric.id] || MapPin
              return (
                <Card key={metric.id} className="border-border/60 bg-card">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {metric.title}
                    </CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono text-foreground">
                      {metric.value}
                      <span className="ml-1.5 text-sm font-normal font-sans text-muted-foreground">
                        {metric.unit}
                      </span>
                    </div>
                    <p className={`mt-1 text-xs font-medium ${
                      metric.changeType === "positive" ? "text-accent" : 
                      metric.changeType === "negative" ? "text-destructive" : "text-muted-foreground"
                    }`}>
                      {metric.change} vs mes anterior
                    </p>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>

        {/* Yield chart */}
        <div>
          {loading || !yieldData ? (
            <ChartCardSkeleton />
          ) : (
            <Card className="border-border/60">
              <CardHeader>
                <div>
                  <CardTitle className="text-foreground">Rendimiento por Cultivo</CardTitle>
                  <CardDescription>
                    Comparación real vs predicción (t/ha). La predicción combina modelo ML e historial del lote.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {yieldData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    No hay lotes con cultivo asignado, o aún no hay datos de rendimiento histórico ni predicción
                    para graficar. Asigná un cultivo a tus lotes y cargá rendimientos previos o predicciones ML.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={yieldData} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        dataKey="crop"
                        tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value}`}
                        label={{
                          value: "t/ha",
                          angle: -90,
                          position: "insideLeft",
                          fill: "var(--color-muted-foreground)",
                          fontSize: 11,
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--color-card)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "6px",
                          fontSize: 12,
                        }}
                        labelStyle={{ color: "var(--color-foreground)", fontWeight: 500 }}
                        formatter={(value) => {
                          const n =
                            typeof value === "number" ? value : Number(value)
                          return n != null && Number.isFinite(n)
                            ? [`${n.toFixed(2)} t/ha`, ""]
                            : ["—", ""]
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar
                        dataKey="actual"
                        name="Real"
                        fill="var(--color-chart-3)"
                        radius={[2, 2, 0, 0]}
                      />
                      <Bar
                        dataKey="prediction"
                        name="Predicción"
                        fill="var(--color-accent)"
                        radius={[2, 2, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
  )
}

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <DashboardPageInner />
    </DashboardLayout>
  )
}
