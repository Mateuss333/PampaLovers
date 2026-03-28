"use client"

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import type { Map as LeafletMap, TileLayer } from "leaflet"
import "leaflet/dist/leaflet.css"

const OSM_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
const ESRI_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
const ESRI_ATTRIBUTION =
  "Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics, GIS User Community"

/** Centro aproximado región pampeana (demo hackathon) */
export const PAMPA_DEMO_CENTER: [number, number] = [-34.2, -61.5]
const PAMPA_DEMO_ZOOM = 7

export type SatelliteMapHandle = {
  zoomIn: () => void
  zoomOut: () => void
}

type SatelliteMapProps = {
  mapType: "satellite" | "streets"
  className?: string
}

export const SatelliteMap = forwardRef<SatelliteMapHandle, SatelliteMapProps>(
  function SatelliteMap({ mapType, className }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<LeafletMap | null>(null)
    const layerRef = useRef<TileLayer | null>(null)
    const layersRef = useRef<{
      streets: TileLayer
      satellite: TileLayer
    } | null>(null)
    const mapTypeRef = useRef(mapType)
    mapTypeRef.current = mapType
    const [mapReady, setMapReady] = useState(false)

    useImperativeHandle(ref, () => ({
      zoomIn: () => {
        mapRef.current?.zoomIn()
      },
      zoomOut: () => {
        mapRef.current?.zoomOut()
      },
    }))

    useEffect(() => {
      const el = containerRef.current
      if (!el || mapRef.current) return

      let cancelled = false

      void import("leaflet").then((L) => {
        if (cancelled || !containerRef.current) return

        const map = L.map(containerRef.current, {
          center: PAMPA_DEMO_CENTER,
          zoom: PAMPA_DEMO_ZOOM,
          zoomControl: false,
        })

        const streets = L.tileLayer(OSM_TILES, { attribution: OSM_ATTRIBUTION })
        const satellite = L.tileLayer(ESRI_TILES, {
          attribution: ESRI_ATTRIBUTION,
        })
        layersRef.current = { streets, satellite }

        const initial =
          mapTypeRef.current === "satellite" ? satellite : streets
        initial.addTo(map)
        layerRef.current = initial

        L.circleMarker(PAMPA_DEMO_CENTER, {
          radius: 8,
          fillColor: "#16a34a",
          color: "#fff",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.85,
        })
          .addTo(map)
          .bindPopup("Referencia demo — región pampeana")

        mapRef.current = map
        setMapReady(true)
      })

      return () => {
        cancelled = true
        setMapReady(false)
        mapRef.current?.remove()
        mapRef.current = null
        layerRef.current = null
        layersRef.current = null
      }
    }, [])

    useEffect(() => {
      const map = mapRef.current
      const layers = layersRef.current
      const current = layerRef.current
      if (!mapReady || !map || !layers || !current) return

      const next = mapType === "satellite" ? layers.satellite : layers.streets
      if (next === current) return

      map.removeLayer(current)
      next.addTo(map)
      layerRef.current = next
    }, [mapType, mapReady])

    return (
      <div
        ref={containerRef}
        className={className}
        style={{ minHeight: "100%" }}
        aria-label="Mapa interactivo"
      />
    )
  }
)
