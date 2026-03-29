"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { LogOut, Plus, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useFarmScope } from "@/components/farm-scope-context"
import { createFarm } from "@/lib/supabase-api"
import { createClient } from "@/lib/supabase/client"

export function AppHeader() {
  const router = useRouter()
  const {
    farms,
    loading: farmsLoading,
    selectedFarmId,
    setSelectedFarmId,
    refreshFarms,
  } = useFarmScope()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [newFarmOpen, setNewFarmOpen] = useState(false)
  const [newFarmName, setNewFarmName] = useState("")
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null)
    })
  }, [])

  function getInitials(email: string | null): string {
    if (!email) return "??"
    const name = email.split("@")[0]
    return name.slice(0, 2).toUpperCase()
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  async function handleCreateFarm(e: React.FormEvent) {
    e.preventDefault()
    const name = newFarmName.trim()
    if (!name) {
      toast.error("Ingresá un nombre")
      return
    }
    setCreating(true)
    try {
      const farm = await createFarm({ name })
      await refreshFarms()
      setSelectedFarmId(farm.id)
      setNewFarmName("")
      setNewFarmOpen(false)
      toast.success("Campo creado")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al crear el campo",
      )
    }
    setCreating(false)
  }

  const selectValue =
    selectedFarmId === "all" ||
    farms.some((f) => f.id === selectedFarmId)
      ? selectedFarmId
      : "all"

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-card px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          {farmsLoading ? (
            <span className="truncate text-sm text-muted-foreground">
              Cargando campos…
            </span>
          ) : (
            <>
              <Select
                value={selectValue}
                onValueChange={(v) =>
                  setSelectedFarmId(v === "all" ? "all" : v)
                }
              >
                <SelectTrigger
                  className="h-9 w-full max-w-[200px] sm:max-w-[280px]"
                  aria-label="Campo activo"
                >
                  <SelectValue placeholder="Campo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los campos</SelectItem>
                  {farms.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setNewFarmOpen(true)}
              >
                <Plus className="mr-1 h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Nuevo campo</span>
                <span className="sm:hidden">Nuevo</span>
              </Button>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-9 w-9 shrink-0 rounded-full p-0"
                aria-label="Menú de cuenta"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-primary text-xs font-medium text-primary-foreground">
                  {getInitials(userEmail)}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {userEmail ?? "Usuario"}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Configuración
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <Dialog open={newFarmOpen} onOpenChange={setNewFarmOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateFarm}>
            <DialogHeader>
              <DialogTitle>Nuevo campo</DialogTitle>
              <DialogDescription>
                Creá un campo para organizar lotes e historial por ubicación.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="new-farm-name">Nombre</Label>
                <Input
                  id="new-farm-name"
                  value={newFarmName}
                  onChange={(e) => setNewFarmName(e.target.value)}
                  placeholder="Ej. Campo Norte"
                  autoComplete="off"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewFarmOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Creando…" : "Crear"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
