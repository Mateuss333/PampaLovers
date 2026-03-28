"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, Filter, MoreHorizontal, Eye, Pencil, Trash2 } from "lucide-react"
import {
  fetchLots,
  getUserFarm,
  getPlotRow,
  updatePlot,
  deletePlot,
  type Lot,
  type DbPlot,
} from "@/lib/supabase-api"
import { NewLotForm } from "@/components/new-lot-form"

const statusColors: Record<string, string> = {
  Sembrado: "bg-primary/15 text-primary border-primary/30",
  Crecimiento: "bg-emerald-600/15 text-emerald-700 border-emerald-600/30",
  Cosechado: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  Barbecho: "bg-stone-400/15 text-stone-600 border-stone-400/30",
}

const PLOT_STATUSES = [
  "Sembrado",
  "Crecimiento",
  "Cosechado",
  "Barbecho",
] as const satisfies readonly DbPlot["status"][]

const CROP_TYPES = [
  "Soja",
  "Maíz",
  "Trigo",
  "Girasol",
  "Sorgo",
  "Cebada",
  "Arroz",
  "Algodón",
] as const

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-4 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-12" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-10" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-20 rounded-full" />
          </TableCell>
          <TableCell>
            <div className="flex items-center justify-end gap-2">
              <Skeleton className="h-2 w-12 rounded-full" />
              <Skeleton className="h-4 w-8" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-10" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-8 w-8" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
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

export default function LotesPage() {
  const [lots, setLots] = useState<Lot[] | null>(null)
  const [farmId, setFarmId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailPlot, setDetailPlot] = useState<DbPlot | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editName, setEditName] = useState("")
  const [editCrop, setEditCrop] = useState("")
  const [editArea, setEditArea] = useState("")
  const [editStatus, setEditStatus] = useState<DbPlot["status"]>("Sembrado")
  const [editDescription, setEditDescription] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const [editGroup, setEditGroup] = useState("")

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(
    null,
  )
  const [deleteLoading, setDeleteLoading] = useState(false)

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

  async function openDetail(lotId: string) {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailPlot(null)
    try {
      const row = await getPlotRow(lotId)
      setDetailPlot(row)
      if (!row) toast.error("No se pudo cargar el lote")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar el lote")
    }
    setDetailLoading(false)
  }

  async function openEdit(lotId: string) {
    setEditOpen(true)
    setEditId(lotId)
    setEditLoading(true)
    try {
      const row = await getPlotRow(lotId)
      if (!row) {
        toast.error("No se pudo cargar el lote")
        setEditOpen(false)
        setEditId(null)
        return
      }
      setEditName(row.name)
      setEditCrop(row.crop_type ?? "")
      setEditArea(
        row.area_ha != null && Number(row.area_ha) > 0
          ? String(row.area_ha)
          : "",
      )
      setEditStatus(row.status)
      setEditDescription(row.description ?? "")
      setEditNotes(row.notes ?? "")
      setEditGroup(String(row.group ?? ""))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar el lote")
      setEditOpen(false)
      setEditId(null)
    }
    setEditLoading(false)
  }

  function closeEdit() {
    setEditOpen(false)
    setEditId(null)
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editId) return
    const parsedGroup = parseInt(editGroup, 10)
    if (!editName.trim()) {
      toast.error("El nombre es obligatorio")
      return
    }
    if (!Number.isFinite(parsedGroup)) {
      toast.error("El grupo debe ser un número válido")
      return
    }
    let areaHa: number | null | undefined
    if (editArea.trim() === "") {
      areaHa = null
    } else {
      const a = parseFloat(editArea.replace(",", "."))
      if (!Number.isFinite(a) || a <= 0) {
        toast.error("El área debe ser un número mayor a 0")
        return
      }
      areaHa = a
    }

    setEditSaving(true)
    try {
      await updatePlot(editId, {
        name: editName.trim(),
        crop_type: editCrop.trim() ? editCrop.trim() : null,
        area_ha: areaHa,
        status: editStatus,
        description: editDescription.trim() || null,
        notes: editNotes.trim() || null,
        group: parsedGroup,
      })
      toast.success("Lote actualizado")
      closeEdit()
      await refreshLots()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al actualizar el lote",
      )
    }
    setEditSaving(false)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await deletePlot(deleteTarget.id)
      toast.success("Lote eliminado")
      setDeleteOpen(false)
      setDeleteTarget(null)
      await refreshLots()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al eliminar el lote",
      )
    }
    setDeleteLoading(false)
  }

  const filteredLots = lots?.filter(
    (lot) =>
      lot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lot.crop.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Administrar Lotes
            </h1>
            <p className="text-muted-foreground">
              Gestiona y monitorea todos tus lotes agrícolas
            </p>
          </div>
          <NewLotForm farmId={farmId} onSuccess={refreshLots} />
        </div>

        <Card className="border-border/60">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-foreground">Todos los Lotes</CardTitle>
                <CardDescription>
                  {loading
                    ? "Cargando..."
                    : `${filteredLots?.length || 0} lotes registrados en tu cuenta`}
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
                    <TableHead className="text-right font-semibold text-foreground">
                      Área (ha)
                    </TableHead>
                    <TableHead className="font-semibold text-foreground">Estado</TableHead>
                    <TableHead className="text-right font-semibold text-foreground">NDVI</TableHead>
                    <TableHead className="text-right font-semibold text-foreground">
                      Rend. Predicho
                    </TableHead>
                    <TableHead className="w-[50px]" />
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
                        <TableCell className="text-right font-mono text-foreground">
                          {lot.area}
                        </TableCell>
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
                                  backgroundColor:
                                    lot.ndvi > 0.6
                                      ? "var(--color-accent)"
                                      : lot.ndvi > 0.4
                                        ? "var(--color-chart-3)"
                                        : "var(--color-chart-4)",
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
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                disabled={loading}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="gap-2"
                                onSelect={(ev) => ev.preventDefault()}
                                onClick={() => void openDetail(lot.id)}
                              >
                                <Eye className="h-4 w-4" /> Ver detalles
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2"
                                onSelect={(ev) => ev.preventDefault()}
                                onClick={() => void openEdit(lot.id)}
                              >
                                <Pencil className="h-4 w-4" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2 text-destructive focus:text-destructive"
                                onSelect={(ev) => ev.preventDefault()}
                                onClick={() => {
                                  setDeleteTarget({ id: lot.id, name: lot.name })
                                  setDeleteOpen(true)
                                }}
                              >
                                <Trash2 className="h-4 w-4" /> Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No se encontraron lotes.
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
              <DialogTitle>Detalle del lote</DialogTitle>
              <DialogDescription>
                Información registrada en tu cuenta.
              </DialogDescription>
            </DialogHeader>
            {detailLoading ? (
              <div className="space-y-2 py-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : detailPlot ? (
              <div className="grid gap-3 py-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Nombre</span>
                  <span className="font-medium text-foreground text-right">{detailPlot.name}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Cultivo</span>
                  <span className="text-foreground text-right">
                    {detailPlot.crop_type ?? "Sin cultivo"}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Área (ha)</span>
                  <span className="font-mono text-foreground">
                    {detailPlot.area_ha != null ? String(detailPlot.area_ha) : "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Estado</span>
                  <Badge variant="outline" className={statusColors[detailPlot.status]}>
                    {detailPlot.status}
                  </Badge>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">NDVI</span>
                  <span className="font-mono text-foreground">
                    {detailPlot.ndvi_index != null
                      ? Number(detailPlot.ndvi_index).toFixed(2)
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Grupo</span>
                  <span className="font-mono text-foreground">{detailPlot.group}</span>
                </div>
                {(detailPlot.latitude != null || detailPlot.longitude != null) && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Ubicación</span>
                    <span className="font-mono text-xs text-foreground text-right">
                      {detailPlot.latitude != null && detailPlot.longitude != null
                        ? `${Number(detailPlot.latitude).toFixed(5)}, ${Number(detailPlot.longitude).toFixed(5)}`
                        : "—"}
                    </span>
                  </div>
                )}
                {detailPlot.description ? (
                  <div className="border-t border-border pt-2">
                    <p className="text-muted-foreground text-xs mb-1">Descripción</p>
                    <p className="text-foreground">{detailPlot.description}</p>
                  </div>
                ) : null}
                {detailPlot.notes ? (
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Notas</p>
                    <p className="text-foreground">{detailPlot.notes}</p>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4 text-xs text-muted-foreground border-t border-border pt-2">
                  <span>Creado</span>
                  <span>{formatDateTime(detailPlot.created_at)}</span>
                </div>
                <div className="flex justify-between gap-4 text-xs text-muted-foreground">
                  <span>Actualizado</span>
                  <span>{formatDateTime(detailPlot.updated_at)}</span>
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

        <Dialog open={editOpen} onOpenChange={(o) => !o && closeEdit()}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar lote</DialogTitle>
              <DialogDescription>Modificá los datos del lote y guardá los cambios.</DialogDescription>
            </DialogHeader>
            {editLoading ? (
              <div className="space-y-2 py-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <form onSubmit={(e) => void submitEdit(e)} className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Nombre</Label>
                  <Input
                    id="edit-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="bg-background"
                    required
                    disabled={editSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-group">Grupo</Label>
                  <Input
                    id="edit-group"
                    type="number"
                    value={editGroup}
                    onChange={(e) => setEditGroup(e.target.value)}
                    className="bg-background"
                    required
                    disabled={editSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cultivo</Label>
                  <Select
                    value={editCrop || "__none__"}
                    onValueChange={(v) => setEditCrop(v === "__none__" ? "" : v)}
                    disabled={editSaving}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Sin cultivo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin cultivo</SelectItem>
                      {CROP_TYPES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-area">Área (ha)</Label>
                  <Input
                    id="edit-area"
                    type="text"
                    inputMode="decimal"
                    placeholder="Opcional"
                    value={editArea}
                    onChange={(e) => setEditArea(e.target.value)}
                    className="bg-background font-mono"
                    disabled={editSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select
                    value={editStatus}
                    onValueChange={(v) => setEditStatus(v as DbPlot["status"])}
                    disabled={editSaving}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLOT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-desc">Descripción</Label>
                  <Input
                    id="edit-desc"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="bg-background"
                    disabled={editSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-notes">Notas</Label>
                  <Input
                    id="edit-notes"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="bg-background"
                    disabled={editSaving}
                  />
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeEdit}
                    disabled={editSaving}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={editSaving}>
                    {editSaving ? "Guardando…" : "Guardar"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar este lote?</AlertDialogTitle>
              <AlertDialogDescription>
                Se eliminará permanentemente{" "}
                <span className="font-medium text-foreground">
                  {deleteTarget?.name ?? "el lote"}
                </span>
                . Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteLoading}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => {
                  e.preventDefault()
                  void confirmDelete()
                }}
                disabled={deleteLoading}
              >
                {deleteLoading ? "Eliminando…" : "Eliminar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  )
}
