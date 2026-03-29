"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { fetchUserFarms, type DbFarm } from "@/lib/supabase-api"

const STORAGE_KEY = "pampa-selected-farm-id-v1"

export type SelectedFarmScope = "all" | string

interface FarmScopeValue {
  farms: DbFarm[]
  loading: boolean
  selectedFarmId: SelectedFarmScope
  setSelectedFarmId: (id: SelectedFarmScope) => void
  refreshFarms: () => Promise<void>
}

const FarmScopeContext = createContext<FarmScopeValue | null>(null)

export function FarmScopeProvider({ children }: { children: React.ReactNode }) {
  const [farms, setFarms] = useState<DbFarm[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFarmId, setSelectedFarmIdState] =
    useState<SelectedFarmScope>("all")

  const refreshFarms = useCallback(async () => {
    setLoading(true)
    try {
      const list = await fetchUserFarms()
      setFarms(list)
    } catch {
      setFarms([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshFarms()
  }, [refreshFarms])

  useEffect(() => {
    if (loading) return
    let next: SelectedFarmScope = "all"
    try {
      const s = localStorage.getItem(STORAGE_KEY)
      if (s && s !== "all" && farms.some((f) => f.id === s)) next = s
    } catch {
      /* ignore */
    }
    setSelectedFarmIdState(next)
  }, [loading, farms])

  const setSelectedFarmId = useCallback((id: SelectedFarmScope) => {
    setSelectedFarmIdState(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      /* ignore */
    }
  }, [])

  const value = useMemo(
    () => ({
      farms,
      loading,
      selectedFarmId,
      setSelectedFarmId,
      refreshFarms,
    }),
    [farms, loading, selectedFarmId, setSelectedFarmId, refreshFarms],
  )

  return (
    <FarmScopeContext.Provider value={value}>{children}</FarmScopeContext.Provider>
  )
}

export function useFarmScope() {
  const ctx = useContext(FarmScopeContext)
  if (!ctx) {
    throw new Error("useFarmScope must be used within FarmScopeProvider")
  }
  return ctx
}
