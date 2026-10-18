import regions from "../../assets/region.json";
import roads from "../../assets/streets.json";
import {
  Point,
  Ring,
  polygonContains,
  normalize,
  nearestOnSegment,
  distance,
} from "./geo";
export type City = {
  id: string;
  name: string;
  center: Point;
  polygons: Ring[][];
};
export type Street = {
  name: string;
  cityId: string;
  normalized: string;
  kind: string;
  points: Point[];
};
export const cities: City[] = regions.cities.map((c) => ({
  id: c.id,
  name: c.name,
  center: { latitude: c.lat, longitude: c.lon },
  polygons: c.polygons.map((p) =>
    p.map((r) => r.map((v) => ({ latitude: v[1], longitude: v[0] }))),
  ),
}));
export const streets: Street[] = (
  roads as unknown as [string, string, string, number[][]][]
).map((r) => ({
  name: r[0],
  kind: r[2],
  cityId: r[1],
  normalized: normalize(r[0]),
  points: r[3].map((v) => ({ latitude: v[1], longitude: v[0] })),
}));
export const cityAt = (p: Point) =>
  cities.find((c) => c.polygons.some((r) => polygonContains(r, p)));
export function searchStreets(query: string, cityId?: string) {
  const q = normalize(query),
    seen = new Set<string>();
  if (q.length < 2) return [];
  return streets
    .filter((s) => {
      const key = s.cityId + "|" + s.normalized;
      if (
        (cityId && s.cityId !== cityId) ||
        !s.normalized.includes(q) ||
        seen.has(key)
      )
        return false;
      seen.add(key);
      return true;
    })
    .sort(
      (a, b) =>
        Number(!a.normalized.startsWith(q)) -
          Number(!b.normalized.startsWith(q)) ||
        a.name.localeCompare(b.name, "pt-BR"),
    )
    .slice(0, 8);
}
export function streetPoint(street: Street, reference: Point) {
  let best = street.points[0],
    d = Infinity;
  for (const s of streets.filter(
    (s) => s.name === street.name && s.cityId === street.cityId,
  )) {
    for (let i = 1; i < s.points.length; i++) {
      const point = nearestOnSegment(reference, s.points[i - 1], s.points[i]),
        v = distance(reference, point);
      if (v < d) {
        d = v;
        best = point;
      }
    }
  }
  return best;
}
export function addressAt(point: Point) {
  const city = cityAt(point);
  if (!city) return "Fora da área atendida";
  let name = "Ponto no mapa",
    d = 100;
  for (const s of streets.filter((s) => s.cityId === city.id && s.name)) {
    for (let i = 1; i < s.points.length; i++) {
      const v = distance(
        point,
        nearestOnSegment(point, s.points[i - 1], s.points[i]),
      );
      if (v < d) {
        d = v;
        name = s.name;
      }
    }
  }
  return name + " · " + city.name;
}
