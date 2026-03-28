/**
 * Área aproximada de un polígono en WGS84 (lng, lat en grados).
 * Proyecta grados a metros con escala local en la latitud media (adecuado para lotes típicos en Argentina).
 */
export function polygonAreaHectares(points: [number, number][]): number {
  const n = points.length
  if (n < 3) return 0

  let latSum = 0
  for (const [, lat] of points) {
    if (!Number.isFinite(lat)) return NaN
    latSum += lat
  }
  const meanLatRad = (latSum / n) * (Math.PI / 180)
  const mPerDegLat = 111_320
  const mPerDegLon = 111_320 * Math.cos(meanLatRad)

  let sum = 0
  for (let i = 0; i < n; i++) {
    const [lon1, lat1] = points[i]
    const [lon2, lat2] = points[(i + 1) % n]
    if (
      !Number.isFinite(lon1) ||
      !Number.isFinite(lat1) ||
      !Number.isFinite(lon2) ||
      !Number.isFinite(lat2)
    ) {
      return NaN
    }
    const x1 = lon1 * mPerDegLon
    const y1 = lat1 * mPerDegLat
    const x2 = lon2 * mPerDegLon
    const y2 = lat2 * mPerDegLat
    sum += x1 * y2 - x2 * y1
  }

  const m2 = Math.abs(sum / 2)
  return m2 / 10_000
}
