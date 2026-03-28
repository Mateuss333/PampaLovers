"use client"

import { useEffect, useRef, useState } from "react"
import type { LayerGroup, Map as LeafletMap } from "leaflet"
import { Button } from "@/components/ui/button"
import { PAMPA_DEMO_CENTER } from "@/components/satellite-map"
import "leaflet/dist/leaflet.css"

const MAX_POINTS = 4

const OSM_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

export type LngLatTuple = [number, number]

type LotPolygonMapPickerProps = {
  points: LngLatTuple[]
  onPointsChange: (next: LngLatTuple[]) => void
  className?: string
  /** When the host dialog is open, triggers invalidateSize so tiles render correctly */
  active?: boolean
}

function vertexIcon(L: typeof import("leaflet"), index: number) {
  return L.divIcon({
    className: "lot-vertex-marker border-0 bg-transparent",
    html: `<div style="background:#16a34a;color:#fff;border:2px solid #fff;border-radius:9999px;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,0.35)">${index + 1}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}

export function LotPolygonMapPicker({
  points,
  onPointsChange,
  className,
  active = true,
}: LotPolygonMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const groupRef = useRef<LayerGroup | null>(null)
  const leafletRef = useRef<typeof import("leaflet") | null>(null)
  const pointsRef = useRef(points)
  const onPointsChangeRef = useRef(onPointsChange)
  const [mapReady, setMapReady] = useState(false)

  pointsRef.current = points
  onPointsChangeRef.current = onPointsChange

  useEffect(() => {
    const el = containerRef.current
    if (!el || mapRef.current) return

    let cancelled = false

    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return

      leafletRef.current = L
      const map = L.map(containerRef.current, {
        center: PAMPA_DEMO_CENTER,
        zoom: 7,
        zoomControl: true,
      })

      L.tileLayer(OSM_TILES, { attribution: OSM_ATTRIBUTION }).addTo(map)

      const fg = L.layerGroup().addTo(map)
      groupRef.current = fg
      mapRef.current = map

      map.on("click", (e) => {
        const current = pointsRef.current
        if (current.length >= MAX_POINTS) return
        const next: LngLatTuple[] = [
          ...current,
          [e.latlng.lng, e.latlng.lat],
        ]
        onPointsChangeRef.current(next)
      })

      setMapReady(true)
    })

    return () => {
      cancelled = true
      setMapReady(false)
      mapRef.current?.remove()
      mapRef.current = null
      groupRef.current = null
      leafletRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapReady) return
    const L = leafletRef.current
    const fg = groupRef.current
    if (!L || !fg) return

    fg.clearLayers()
    const latLngs: [number, number][] = points.map(([lon, lat]) => [lat, lon])

    points.forEach(([lon, lat], i) => {
      L.marker([lat, lon], { icon: vertexIcon(L, i) }).addTo(fg)
    })

    if (points.length >= 2 && points.length < 3) {
      L.polyline(latLngs, { color: "#16a34a", weight: 2, opacity: 0.9 }).addTo(
        fg
      )
    }

    if (points.length >= 3) {
      L.polygon(latLngs, {
        color: "#16a34a",
        weight: 2,
        fillColor: "#16a34a",
        fillOpacity: 0.18,
      }).addTo(fg)
    }
  }, [points, mapReady])

  useEffect(() => {
    if (!active || !mapReady || !mapRef.current) return
    const map = mapRef.current
    const raf = requestAnimationFrame(() => map.invalidateSize())
    const t = window.setTimeout(() => map.invalidateSize(), 200)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(t)
    }
  }, [active, mapReady])

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className={className}
        style={{ minHeight: 280, height: 280, width: "100%" }}
        aria-label="Mapa para marcar vértices del lote"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPointsChange([])}
          disabled={points.length === 0}
        >
          Limpiar puntos
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPointsChange(points.slice(0, -1))}
          disabled={points.length === 0}
        >
          Deshacer último
        </Button>
      </div>
    </div>
  )
}
