"use client"

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import type {
  CircleMarker,
  LayerGroup,
  Map as LeafletMap,
  TileLayer,
} from "leaflet"
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

const PLOT_STYLE = {
  color: "#16a34a",
  weight: 2,
  fillColor: "#16a34a",
  fillOpacity: 0.18,
} as const

export type SatellitePlotOverlay = {
  id: string
  name: string
  polygon: [number, number][]
}

export type SatelliteMapHandle = {
  zoomIn: () => void
  zoomOut: () => void
  fitToPlots: () => void
  flyToLot: (id: string) => void
}

type SatelliteMapProps = {
  mapType: "satellite" | "streets"
  className?: string
  plots?: SatellitePlotOverlay[]
}

function extendBoundsFromPolygon(
  L: typeof import("leaflet"),
  bounds: import("leaflet").LatLngBounds,
  polygon: [number, number][]
) {
  for (const [lon, lat] of polygon) {
    bounds.extend([lat, lon])
  }
}

export const SatelliteMap = forwardRef<SatelliteMapHandle, SatelliteMapProps>(
  function SatelliteMap(
    { mapType, className, plots: plotsProp = [] },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<LeafletMap | null>(null)
    const layerRef = useRef<TileLayer | null>(null)
    const layersRef = useRef<{
      streets: TileLayer
      satellite: TileLayer
    } | null>(null)
    const leafletRef = useRef<typeof import("leaflet") | null>(null)
    const plotsGroupRef = useRef<LayerGroup | null>(null)
    const demoMarkerRef = useRef<CircleMarker | null>(null)
    const plotsRef = useRef(plotsProp)
    plotsRef.current = plotsProp

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
      fitToPlots: () => {
        const map = mapRef.current
        const L = leafletRef.current
        const list = plotsRef.current
        if (!map || !L || list.length === 0) return
        const bounds = L.latLngBounds([])
        for (const p of list) {
          if (p.polygon.length > 0) extendBoundsFromPolygon(L, bounds, p.polygon)
        }
        if (!bounds.isValid()) return
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 })
        requestAnimationFrame(() => map.invalidateSize())
        window.setTimeout(() => map.invalidateSize(), 200)
      },
      flyToLot: (id: string) => {
        const map = mapRef.current
        const L = leafletRef.current
        const plot = plotsRef.current.find((p) => p.id === id)
        if (!map || !L || !plot || plot.polygon.length === 0) return
        const bounds = L.latLngBounds([])
        extendBoundsFromPolygon(L, bounds, plot.polygon)
        if (!bounds.isValid()) return
        map.fitBounds(bounds, { padding: [56, 56], maxZoom: 17 })
        requestAnimationFrame(() => map.invalidateSize())
        window.setTimeout(() => map.invalidateSize(), 200)
      },
    }))

    useEffect(() => {
      const el = containerRef.current
      if (!el || mapRef.current) return

      let cancelled = false

      void import("leaflet").then((L) => {
        if (cancelled || !containerRef.current) return

        leafletRef.current = L
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

        const plotsGroup = L.layerGroup().addTo(map)
        plotsGroupRef.current = plotsGroup

        mapRef.current = map
        setMapReady(true)
      })

      return () => {
        cancelled = true
        setMapReady(false)
        demoMarkerRef.current = null
        plotsGroupRef.current = null
        leafletRef.current = null
        mapRef.current?.remove()
        mapRef.current = null
        layerRef.current = null
        layersRef.current = null
      }
    }, [])

    useEffect(() => {
      const map = mapRef.current
      const L = leafletRef.current
      if (!mapReady || !map || !L) return

      if (plotsProp.length > 0) {
        if (demoMarkerRef.current) {
          map.removeLayer(demoMarkerRef.current)
          demoMarkerRef.current = null
        }
      } else if (!demoMarkerRef.current) {
        const m = L.circleMarker(PAMPA_DEMO_CENTER, {
          radius: 8,
          fillColor: "#16a34a",
          color: "#fff",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.85,
        })
          .addTo(map)
          .bindPopup("Referencia demo — región pampeana")
        demoMarkerRef.current = m
      }
    }, [mapReady, plotsProp.length])

    useEffect(() => {
      const L = leafletRef.current
      const group = plotsGroupRef.current
      if (!mapReady || !L || !group) return

      group.clearLayers()
      for (const plot of plotsProp) {
        if (plot.polygon.length < 3) continue
        const latlngs: [number, number][] = plot.polygon.map(([lon, lat]) => [
          lat,
          lon,
        ])
        L.polygon(latlngs, PLOT_STYLE)
          .addTo(group)
          .bindPopup(plot.name)
      }
    }, [plotsProp, mapReady])

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
