"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MetricCardSkeleton, ChartCardSkeleton, ActivitySkeleton } from "@/components/skeleton-card"
import { createClient as createSupabaseClient } from "@/lib/supabase/client"
import { MapPin, Layers, TrendingUp, Cpu, Database } from "lucide-react"
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
  getYieldComparison,
  getMLStatus,
  type DashboardMetric,
  type YieldComparison,
  type MLStatus,
} from "@/lib/api"

const iconMap: Record<string, typeof MapPin> = {
  area: MapPin,
  lots: Layers,
  yield: TrendingUp,
}

type SupabaseStatus = {
  variant: "default" | "destructive"
  title: string
  message: string
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetric[] | null>(null)
  const [yieldData, setYieldData] = useState<YieldComparison[] | null>(null)
  const [mlStatus, setMLStatus] = useState<MLStatus | null>(null)
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const [metricsData, yieldDataRes, mlStatusData] = await Promise.all([
        getDashboardMetrics(),
        getYieldComparison(),
        getMLStatus(),
      ])
      setMetrics(metricsData)
      setYieldData(yieldDataRes)
      setMLStatus(mlStatusData)
      setLoading(false)
    }
    loadData()
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadSupabaseStatus() {
      try {
        const supabase = createSupabaseClient()
        const { data, error } = await supabase.auth.getUser()

        if (cancelled) {
          return
        }

        if (error) {
          setSupabaseStatus({
            variant: "destructive",
            title: "Supabase respondio con error",
            message: error.message,
          })
          return
        }

        setSupabaseStatus({
          variant: "default",
          title: "Supabase conectado",
          message: data.user
            ? `Sesion detectada para ${data.user.email ?? data.user.id}.`
            : "Cliente configurado correctamente. No hay una sesion iniciada todavia.",
        })
      } catch (error) {
        if (cancelled) {
          return
        }

        setSupabaseStatus({
          variant: "destructive",
          title: "Falta configurar Supabase",
          message: error instanceof Error ? error.message : "No se pudo inicializar el cliente de Supabase.",
        })
      }
    }

    loadSupabaseStatus()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Resumen de tu operación agrícola con predicciones ML en tiempo real
          </p>
        </div>

        {supabaseStatus ? (
          <Alert
            variant={supabaseStatus.variant}
            className="border-border/60 bg-card text-card-foreground"
          >
            <Database className="h-4 w-4" />
            <AlertTitle>{supabaseStatus.title}</AlertTitle>
            <AlertDescription>{supabaseStatus.message}</AlertDescription>
          </Alert>
        ) : null}

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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-foreground">Rendimiento por Cultivo</CardTitle>
                    <CardDescription>
                      Comparación: Estimado vs Real vs Predicción ML
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-md bg-accent/20 px-2.5 py-1 text-xs font-medium text-accent">
                    <Cpu className="h-3 w-3" />
                    ML Activo
                  </div>
                </div>
              </CardHeader>
              <CardContent>
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
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "6px",
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "var(--color-foreground)", fontWeight: 500 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="estimated"
                      name="Estimado"
                      fill="var(--color-chart-5)"
                      radius={[2, 2, 0, 0]}
                    />
                    <Bar
                      dataKey="actual"
                      name="Real"
                      fill="var(--color-chart-3)"
                      radius={[2, 2, 0, 0]}
                    />
                    <Bar
                      dataKey="predicted"
                      name="Predicción ML"
                      fill="var(--color-accent)"
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ML Predictions Summary */}
        <Card className="border-border/60">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent/20">
                <Cpu className="h-5 w-5 text-accent" />
              </div>
              <div>
                <CardTitle className="text-foreground">Predicciones Machine Learning</CardTitle>
                <CardDescription>
                  Análisis de imágenes satelitales procesadas en las últimas 24 horas
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading || !mlStatus ? (
              <div className="grid gap-4 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-md border border-border bg-muted/30 p-4">
                    <div className="h-4 w-24 bg-muted rounded animate-pulse mb-2" />
                    <div className="h-8 w-16 bg-muted rounded animate-pulse mb-1" />
                    <div className="h-3 w-12 bg-muted rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-md border border-border bg-muted/30 p-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    Imágenes Procesadas
                  </p>
                  <p className="mt-1 text-3xl font-bold font-mono text-foreground">{mlStatus.imagesProcessed}</p>
                  <p className="mt-1 text-xs font-medium text-accent">+{mlStatus.imagesToday} hoy</p>
                </div>
                <div className="rounded-md border border-border bg-muted/30 p-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    Precisión del Modelo
                  </p>
                  <p className="mt-1 text-3xl font-bold font-mono text-foreground">{mlStatus.accuracy}%</p>
                  <p className="mt-1 text-xs font-medium text-accent">+{mlStatus.accuracyChange}% este mes</p>
                </div>
                <div className="rounded-md border border-border bg-muted/30 p-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    Próxima Actualización
                  </p>
                  <p className="mt-1 text-3xl font-bold font-mono text-foreground">{mlStatus.nextUpdate}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{mlStatus.source}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
