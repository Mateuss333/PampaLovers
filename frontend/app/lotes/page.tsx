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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, Filter, MoreHorizontal, Eye, Pencil, Trash2 } from "lucide-react"
import { fetchLots, getUserFarm, type Lot } from "@/lib/supabase-api"
import { NewLotForm } from "@/components/new-lot-form"

const statusColors: Record<string, string> = {
  Sembrado: "bg-primary/15 text-primary border-primary/30",
  Crecimiento: "bg-emerald-600/15 text-emerald-700 border-emerald-600/30",
  Cosechado: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  Barbecho: "bg-stone-400/15 text-stone-600 border-stone-400/30",
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-4 w-12" /></TableCell>
          <TableCell><Skeleton className="h-4 w-10" /></TableCell>
          <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
          <TableCell>
            <div className="flex items-center gap-2 justify-end">
              <Skeleton className="h-2 w-12 rounded-full" />
              <Skeleton className="h-4 w-8" />
            </div>
          </TableCell>
          <TableCell><Skeleton className="h-4 w-10" /></TableCell>
          <TableCell><Skeleton className="h-8 w-8" /></TableCell>
        </TableRow>
      ))}
    </>
  )
}

export default function LotesPage() {
  const [lots, setLots] = useState<Lot[] | null>(null)
  const [farmId, setFarmId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  async function refreshLots() {
    const data = await fetchLots()
    setLots(data)
  }

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const [lotsData, farm] = await Promise.all([
          fetchLots(),
          getUserFarm(),
        ])
        setLots(lotsData)
        if (farm) setFarmId(farm.id)
      } catch (err) {
        console.error("Error loading lots:", err)
        setLots([])
      }
      setLoading(false)
    }
    loadData()
  }, [])

  const filteredLots = lots?.filter(
    (lot) =>
      lot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lot.crop.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Administrar Lotes</h1>
            <p className="text-muted-foreground">
              Gestiona y monitorea todos tus lotes agrícolas
            </p>
          </div>
          <NewLotForm farmId={farmId} onSuccess={refreshLots} />
        </div>

        {/* Table Card */}
        <Card className="border-border/60">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-foreground">Todos los Lotes</CardTitle>
                <CardDescription>
                  {loading ? "Cargando..." : `${filteredLots?.length || 0} lotes registrados en tu cuenta`}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar lote..."
                    className="w-[200px] pl-9 bg-background"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <Filter className="h-4 w-4" />
                      Filtrar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Todos los cultivos</DropdownMenuItem>
                    <DropdownMenuItem>Soja</DropdownMenuItem>
                    <DropdownMenuItem>Maíz</DropdownMenuItem>
                    <DropdownMenuItem>Trigo</DropdownMenuItem>
                    <DropdownMenuItem>Girasol</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
                    <TableHead className="font-semibold text-foreground">Estado</TableHead>
                    <TableHead className="text-right font-semibold text-foreground">NDVI</TableHead>
                    <TableHead className="text-right font-semibold text-foreground">Rend. Predicho</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableSkeleton />
                  ) : filteredLots && filteredLots.length > 0 ? (
                    filteredLots.map((lot) => (
                      <TableRow key={lot.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium text-foreground">{lot.name}</TableCell>
                        <TableCell className="text-muted-foreground">{lot.crop}</TableCell>
                        <TableCell className="text-right font-mono text-foreground">{lot.area}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={statusColors[lot.status]}
                          >
                            {lot.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ 
                                  width: `${lot.ndvi * 100}%`,
                                  backgroundColor: lot.ndvi > 0.6 ? "var(--color-accent)" : 
                                                   lot.ndvi > 0.4 ? "var(--color-chart-3)" : "var(--color-chart-4)"
                                }}
                              />
                            </div>
                            <span className="text-sm font-mono text-foreground tabular-nums">
                              {lot.ndvi.toFixed(2)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-foreground tabular-nums">
                          {lot.predictedYield ? `${lot.predictedYield.toFixed(1)} t/ha` : "—"}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem className="gap-2">
                                <Eye className="h-4 w-4" /> Ver detalles
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gap-2">
                                <Pencil className="h-4 w-4" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive">
                                <Trash2 className="h-4 w-4" /> Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        No se encontraron lotes.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
