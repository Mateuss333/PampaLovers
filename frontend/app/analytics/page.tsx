"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ChartCardSkeleton } from "@/components/skeleton-card"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts"
import { TrendingUp, Droplets, FlaskConical, Thermometer, Cpu } from "lucide-react"
import {
  getHistoricalYields,
  getNDVITrend,
  type HistoricalYield,
  type NDVITrend,
} from "@/lib/api"
import {
  fetchLots,
  getSoilMetrics,
  type Lot,
  type SoilMetric,
} from "@/lib/supabase-api"
import { useFarmScope } from "@/components/farm-scope-context"

const statusColors: Record<string, string> = {
  "Óptimo": "bg-primary/10 text-primary border-primary/20",
  "Normal": "bg-chart-5/10 text-chart-5 border-chart-5/20",
  "Alto": "bg-accent/20 text-accent border-accent/30",
  "Ideal": "bg-primary/10 text-primary border-primary/20",
  "Moderado": "bg-chart-4/10 text-chart-4 border-chart-4/20",
  "Bajo": "bg-destructive/10 text-destructive border-destructive/20",
}

const iconMap: Record<string, typeof FlaskConical> = {
  ph: FlaskConical,
  moisture: Droplets,
  nitrogen: FlaskConical,
  temp: Thermometer,
  phosphorus: FlaskConical,
  potassium: FlaskConical,
}

function AnalyticsPageInner() {
  const { selectedFarmId } = useFarmScope()
  const [selectedCrop, setSelectedCrop] = useState("all")
  const [lots, setLots] = useState<Lot[]>([])
  const [selectedLot, setSelectedLot] = useState<string | null>(null)
  const [historicalYields, setHistoricalYields] = useState<HistoricalYield[] | null>(null)
  const [soilMetrics, setSoilMetrics] = useState<SoilMetric[] | null>(null)
  const [ndviTrend, setNDVITrend] = useState<NDVITrend[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const lotsData = await fetchLots(
          selectedFarmId === "all"
            ? undefined
            : { farmId: selectedFarmId },
        )
        const [yieldsData, ndviData] = await Promise.all([
          getHistoricalYields(),
          getNDVITrend(),
        ])
        setHistoricalYields(yieldsData)
        setNDVITrend(ndviData)
        setLots(lotsData)
        setSelectedLot((prev) => {
          if (prev && lotsData.some((l) => l.id === prev)) return prev
          return lotsData.length > 0 ? lotsData[0].id : null
        })
      } catch (err) {
        console.error("Error loading analytics:", err)
      }
      setLoading(false)
    }
    void loadData()
  }, [selectedFarmId])

  useEffect(() => {
    if (!selectedLot) return
    async function loadSoil() {
      const soilData = await getSoilMetrics(selectedLot!)
      setSoilMetrics(soilData)
    }
    loadSoil()
  }, [selectedLot])

  return (
    <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Rendimientos e Info del Campo
          </h1>
          <p className="text-muted-foreground">
            {selectedFarmId === "all"
              ? "Análisis histórico y predicciones basadas en Machine Learning"
              : "Lotes del campo seleccionado en la barra superior; gráficos globales siguen siendo ilustrativos."}
          </p>
        </div>

        <Tabs defaultValue="yields" className="space-y-6">
          <TabsList className="bg-muted/60">
            <TabsTrigger value="yields">Rendimientos Históricos</TabsTrigger>
            <TabsTrigger value="soil">Información del Suelo</TabsTrigger>
            <TabsTrigger value="predictions">Predicciones ML</TabsTrigger>
          </TabsList>

          {/* YIELDS TAB */}
          <TabsContent value="yields" className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Select value={selectedCrop} onValueChange={setSelectedCrop}>
                  <SelectTrigger className="w-[160px] bg-card">
                    <SelectValue placeholder="Cultivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los cultivos</SelectItem>
                    <SelectItem value="soja">Soja</SelectItem>
                    <SelectItem value="maiz">Maíz</SelectItem>
                    <SelectItem value="trigo">Trigo</SelectItem>
                  </SelectContent>
                </Select>
                <Select defaultValue="5y">
                  <SelectTrigger className="w-[140px] bg-card">
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3y">Últimos 3 años</SelectItem>
                    <SelectItem value="5y">Últimos 5 años</SelectItem>
                    <SelectItem value="10y">Últimos 10 años</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Badge variant="outline" className="gap-1.5 border-accent/30 text-accent">
                <Cpu className="h-3 w-3" />
                Predicción 2026 incluida
              </Badge>
            </div>

            {loading || !historicalYields ? (
              <ChartCardSkeleton />
            ) : (
              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="text-foreground">Tendencia de Rendimientos</CardTitle>
                  <CardDescription>
                    Rendimiento histórico por cultivo en toneladas/hectárea
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={historicalYields}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        dataKey="year"
                        tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value} t/ha`}
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
                      {(selectedCrop === "all" || selectedCrop === "soja") && (
                        <Line
                          type="monotone"
                          dataKey="soja"
                          name="Soja"
                          stroke="var(--color-primary)"
                          strokeWidth={2}
                          dot={{ fill: "var(--color-primary)" }}
                          connectNulls
                        />
                      )}
                      {(selectedCrop === "all" || selectedCrop === "maiz") && (
                        <Line
                          type="monotone"
                          dataKey="maiz"
                          name="Maíz"
                          stroke="var(--color-accent)"
                          strokeWidth={2}
                          dot={{ fill: "var(--color-accent)" }}
                          connectNulls
                        />
                      )}
                      {(selectedCrop === "all" || selectedCrop === "trigo") && (
                        <Line
                          type="monotone"
                          dataKey="trigo"
                          name="Trigo"
                          stroke="var(--color-chart-3)"
                          strokeWidth={2}
                          dot={{ fill: "var(--color-chart-3)" }}
                          connectNulls
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="predicted"
                        name="Predicción ML"
                        stroke="var(--color-chart-4)"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={{ fill: "var(--color-chart-4)", r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Rendimiento Promedio (5 años)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <>
                      <Skeleton className="h-8 w-24 mb-2" />
                      <Skeleton className="h-4 w-32" />
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold font-mono text-foreground">5.2 t/ha</div>
                      <p className="mt-1 flex items-center text-xs font-medium text-accent">
                        <TrendingUp className="mr-1 h-3 w-3" />
                        +8.3% vs período anterior
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Mejor Año
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <>
                      <Skeleton className="h-8 w-16 mb-2" />
                      <Skeleton className="h-4 w-28" />
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold font-mono text-foreground">2025</div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Maíz: 9.6 t/ha (récord)
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Predicción 2026
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <>
                      <Skeleton className="h-8 w-20 mb-2" />
                      <Skeleton className="h-4 w-24" />
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="text-2xl font-bold font-mono text-foreground">+4.2%</div>
                        <Badge className="bg-accent/20 text-accent border-accent/30">
                          <Cpu className="mr-1 h-3 w-3" />
                          ML
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Confianza: 94%
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* SOIL TAB */}
          <TabsContent value="soil" className="space-y-6">
            <div className="flex items-center gap-2">
              <Select value={selectedLot ?? ""} onValueChange={setSelectedLot}>
                <SelectTrigger className="w-[200px] bg-card">
                  <SelectValue placeholder="Seleccionar lote" />
                </SelectTrigger>
                <SelectContent>
                  {lots.map((lot) => (
                    <SelectItem key={lot.id} value={lot.id}>
                      {lot.name}
                    </SelectItem>
                  ))}
                  {lots.length === 0 && (
                    <SelectItem value="_none" disabled>
                      Sin lotes registrados
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {loading || !soilMetrics ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="border-border/60">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-4" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-10 w-20 mb-2" />
                      <Skeleton className="h-6 w-16 mb-2" />
                      <Skeleton className="h-3 w-32 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </CardContent>
                  </Card>
                ))
              ) : (
                soilMetrics.map((metric) => {
                  const Icon = iconMap[metric.id] || FlaskConical
                  return (
                    <Card key={metric.id} className="border-border/60">
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-foreground">
                          {metric.title}
                        </CardTitle>
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold font-mono text-foreground">{metric.value}</span>
                          <span className="text-lg text-muted-foreground">
                            {metric.unit}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <Badge
                            variant="outline"
                            className={statusColors[metric.status]}
                          >
                            {metric.status}
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {metric.description}
                        </p>
                        <p className="mt-1 text-xs font-medium text-accent">{metric.trend}</p>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>
          </TabsContent>

          {/* PREDICTIONS TAB */}
          <TabsContent value="predictions" className="space-y-6">
            {loading || !ndviTrend ? (
              <ChartCardSkeleton />
            ) : (
              <Card className="border-border/60">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent/20">
                      <Cpu className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <CardTitle className="text-foreground">Tendencia NDVI vs Óptimo</CardTitle>
                      <CardDescription>
                        Comparación del índice de vegetación actual con valores óptimos
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={ndviTrend}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        dataKey="month"
                        tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        domain={[0, 1]}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--color-card)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "6px",
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area
                        type="monotone"
                        dataKey="optimal"
                        name="NDVI Óptimo"
                        stroke="var(--color-primary)"
                        fill="var(--color-primary)"
                        fillOpacity={0.1}
                        strokeWidth={2}
                        strokeDasharray="5 5"
                      />
                      <Area
                        type="monotone"
                        dataKey="ndvi"
                        name="NDVI Actual"
                        stroke="var(--color-accent)"
                        fill="var(--color-accent)"
                        fillOpacity={0.2}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="text-base text-foreground">Modelo de Predicción</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Algoritmo</span>
                    <span className="text-sm font-medium text-foreground">Random Forest + CNN</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Datos de Entrenamiento</span>
                    <span className="text-sm font-mono font-medium text-foreground">15,000+ imágenes</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Precisión</span>
                    <span className="text-sm font-mono font-medium text-accent">94.2%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Última actualización</span>
                    <span className="text-sm font-medium text-foreground">Hace 2 horas</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="text-base text-foreground">Fuentes de Datos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3 rounded-md border border-border p-3">
                    <div className="h-2 w-2 rounded-full bg-accent" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Sentinel-2</p>
                      <p className="text-xs text-muted-foreground">
                        Imágenes multiespectrales cada 5 días
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-md border border-border p-3">
                    <div className="h-2 w-2 rounded-full bg-chart-3" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Estaciones Meteorológicas</p>
                      <p className="text-xs text-muted-foreground">
                        Datos climáticos en tiempo real
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-md border border-border p-3">
                    <div className="h-2 w-2 rounded-full bg-chart-4" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Sensores IoT</p>
                      <p className="text-xs text-muted-foreground">
                        Humedad y temperatura del suelo
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
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
