"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { History, TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react"
import { getLotYieldHistory, type LotYieldRecord } from "@/lib/api"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"

interface LotYieldHistoryProps {
  lotId: string
  lotName: string
}

export function LotYieldHistory({ lotId, lotName }: LotYieldHistoryProps) {
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState<LotYieldRecord[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setLoading(true)
      getLotYieldHistory(lotId).then((data) => {
        setHistory(data)
        setLoading(false)
      })
    }
  }, [open, lotId])

  const chartData = history.map((record) => ({
    season: record.season,
    "Rendimiento Real": record.actualYield || null,
    "Predicción ML": record.predictedYield,
  }))

  const averageYield = history.filter(r => r.actualYield > 0).reduce((acc, r) => acc + r.actualYield, 0) / 
    Math.max(history.filter(r => r.actualYield > 0).length, 1)
  
  const totalProduction = history.reduce((acc, r) => acc + r.totalProduction, 0)
  
  const averageAccuracy = history.filter(r => r.accuracy !== null).reduce((acc, r) => acc + (r.accuracy || 0), 0) /
    Math.max(history.filter(r => r.accuracy !== null).length, 1)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <History className="h-4 w-4" />
          Historial
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <BarChart3 className="h-5 w-5 text-primary" />
            Historial de Rendimientos - {lotName}
          </DialogTitle>
          <DialogDescription>
            Registro histórico de producción y precisión de predicciones ML
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Rendimiento Promedio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono text-foreground">
                    {averageYield.toFixed(2)}
                    <span className="text-sm font-normal text-muted-foreground ml-1">ton/ha</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Producción Total
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono text-foreground">
                    {totalProduction.toLocaleString()}
                    <span className="text-sm font-normal text-muted-foreground ml-1">ton</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Precisión ML Promedio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono text-primary">
                    {averageAccuracy.toFixed(1)}%
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Chart */}
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base text-foreground">Evolución de Rendimientos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis 
                        dataKey="season" 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <YAxis 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        label={{ 
                          value: 'ton/ha', 
                          angle: -90, 
                          position: 'insideLeft',
                          fill: 'hsl(var(--muted-foreground))',
                          fontSize: 12
                        }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                          color: 'hsl(var(--foreground))'
                        }}
                      />
                      <Legend />
                      <Bar 
                        dataKey="Rendimiento Real" 
                        fill="hsl(var(--primary))" 
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar 
                        dataKey="Predicción ML" 
                        fill="hsl(var(--chart-4))" 
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Table */}
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base text-foreground">Detalle por Temporada</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/60">
                      <TableHead className="text-muted-foreground">Temporada</TableHead>
                      <TableHead className="text-muted-foreground">Cultivo</TableHead>
                      <TableHead className="text-muted-foreground text-right">Área (ha)</TableHead>
                      <TableHead className="text-muted-foreground text-right">Rend. Real</TableHead>
                      <TableHead className="text-muted-foreground text-right">Pred. ML</TableHead>
                      <TableHead className="text-muted-foreground text-right">Producción</TableHead>
                      <TableHead className="text-muted-foreground text-right">Precisión</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((record) => {
                      const diff = record.actualYield && record.predictedYield 
                        ? ((record.actualYield - record.predictedYield) / record.predictedYield) * 100 
                        : null
                      return (
                        <TableRow key={record.year} className="border-border/40">
                          <TableCell className="font-medium text-foreground">{record.season}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-secondary/50 text-secondary-foreground">
                              {record.crop}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-foreground">
                            {record.area}
                          </TableCell>
                          <TableCell className="text-right font-mono text-foreground">
                            {record.actualYield > 0 ? (
                              <span className="flex items-center justify-end gap-1">
                                {record.actualYield.toFixed(2)}
                                {diff !== null && (
                                  diff > 0 ? (
                                    <TrendingUp className="h-3 w-3 text-emerald-600" />
                                  ) : diff < 0 ? (
                                    <TrendingDown className="h-3 w-3 text-amber-600" />
                                  ) : (
                                    <Minus className="h-3 w-3 text-muted-foreground" />
                                  )
                                )}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-chart-4">
                            {record.predictedYield?.toFixed(2) || "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-foreground">
                            {record.totalProduction > 0 ? `${record.totalProduction.toLocaleString()} ton` : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {record.accuracy !== null ? (
                              <Badge 
                                variant="secondary" 
                                className={
                                  record.accuracy >= 97 
                                    ? "bg-emerald-600/15 text-emerald-700 border-emerald-600/30" 
                                    : record.accuracy >= 95 
                                    ? "bg-primary/15 text-primary border-primary/30"
                                    : "bg-amber-500/15 text-amber-700 border-amber-500/30"
                                }
                              >
                                {record.accuracy.toFixed(1)}%
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">Pendiente</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
