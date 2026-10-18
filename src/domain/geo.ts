export type Point = { latitude: number; longitude: number };
export type Ring = Point[];
export const validPoint = (p: Point) =>
  Number.isFinite(p.latitude) &&
  Number.isFinite(p.longitude) &&
  Math.abs(p.latitude) <= 90 &&
  Math.abs(p.longitude) <= 180;
export function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
export function distance(a: Point, b: Point) {
  const p = (a.latitude * Math.PI) / 180,
    q = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin((q - p) / 2) ** 2 +
    Math.cos(p) *
      Math.cos(q) *
      Math.sin(((b.longitude - a.longitude) * Math.PI) / 360) ** 2;
  return 6371008.8 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export function ringContains(r: Ring, p: Point) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    const cross =
      (p.longitude - a.longitude) * (b.latitude - a.latitude) -
      (p.latitude - a.latitude) * (b.longitude - a.longitude);
    if (
      Math.abs(cross) < 1e-12 &&
      p.longitude >= Math.min(a.longitude, b.longitude) - 1e-10 &&
      p.longitude <= Math.max(a.longitude, b.longitude) + 1e-10 &&
      p.latitude >= Math.min(a.latitude, b.latitude) - 1e-10 &&
      p.latitude <= Math.max(a.latitude, b.latitude) + 1e-10
    )
      return true;
    if (
      a.latitude > p.latitude !== b.latitude > p.latitude &&
      p.longitude <
        ((b.longitude - a.longitude) * (p.latitude - a.latitude)) /
          (b.latitude - a.latitude) +
          a.longitude
    )
      inside = !inside;
  }
  return inside;
}
export const polygonContains = (rings: Ring[], p: Point) =>
  validPoint(p) &&
  rings.length > 0 &&
  ringContains(rings[0], p) &&
  !rings.slice(1).some((r) => ringContains(r, p));
export function nearestOnSegment(p: Point, a: Point, b: Point): Point {
  const scale = Math.cos((p.latitude * Math.PI) / 180),
    dx = (b.longitude - a.longitude) * scale,
    dy = b.latitude - a.latitude;
  const len = dx * dx + dy * dy;
  const t =
    len === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((p.longitude - a.longitude) * scale * dx +
              (p.latitude - a.latitude) * dy) /
              len,
          ),
        );
  return {
    latitude: a.latitude + t * (b.latitude - a.latitude),
    longitude: a.longitude + t * (b.longitude - a.longitude),
  };
}
export function usableFix(
  fix: { point: Point; accuracy: number | null; timestamp: number },
  now = Date.now(),
) {
  return (
    validPoint(fix.point) &&
    fix.accuracy !== null &&
    Number.isFinite(fix.accuracy) &&
    fix.accuracy >= 0 &&
    fix.accuracy <= 100 &&
    now - fix.timestamp >= -1000 &&
    now - fix.timestamp <= 30000
  );
}
