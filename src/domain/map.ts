import { Point } from "./geo";
export type Camera = { center: Point; scale: number };
export type Size = { width: number; height: number };
export const clampScale = (value: number) =>
  Math.max(0.45, Math.min(85, value));
export function project(p: Point, c: Camera, size: Size) {
  return {
    x:
      size.width / 2 +
      ((p.longitude - c.center.longitude) *
        111320 *
        Math.cos((c.center.latitude * Math.PI) / 180)) /
        c.scale,
    y: size.height / 2 - ((p.latitude - c.center.latitude) * 111320) / c.scale,
  };
}
export function unproject(
  p: { x: number; y: number },
  c: Camera,
  size: Size,
): Point {
  return {
    latitude: c.center.latitude - ((p.y - size.height / 2) * c.scale) / 111320,
    longitude:
      c.center.longitude +
      ((p.x - size.width / 2) * c.scale) /
        (111320 * Math.cos((c.center.latitude * Math.PI) / 180)),
  };
}
export function moveCamera(
  c: Camera,
  dx: number,
  dy: number,
  scale = c.scale,
): Camera {
  return {
    scale: clampScale(scale),
    center: {
      latitude: Math.max(
        -27.17,
        Math.min(-26.7, c.center.latitude + (dy * c.scale) / 111320),
      ),
      longitude: Math.max(
        -48.95,
        Math.min(
          -48.52,
          c.center.longitude -
            (dx * c.scale) /
              (111320 * Math.cos((c.center.latitude * Math.PI) / 180)),
        ),
      ),
    },
  };
}
