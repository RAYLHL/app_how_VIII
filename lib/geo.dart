import 'dart:math' as math;

class GeoPoint {
  final double lat, lon;
  const GeoPoint(this.lat, this.lon);
  bool get valid =>
      lat.isFinite && lon.isFinite && lat.abs() <= 90 && lon.abs() <= 180;
}

String normalize(String text) {
  const from = 'áàâãäåéèêëíìîïóòôõöúùûüçñ';
  const to = 'aaaaaaeeeeiiiiooooouuuucn';
  var value = text.toLowerCase().trim();
  for (var i = 0; i < from.length; i++) {
    value = value.replaceAll(from[i], to[i]);
  }
  return value.replaceAll(RegExp(r'[\u0300-\u036f]'), '');
}

double distance(GeoPoint a, GeoPoint b) {
  final p = a.lat * math.pi / 180, q = b.lat * math.pi / 180;
  final v =
      math.pow(math.sin((q - p) / 2), 2) +
      math.cos(p) *
          math.cos(q) *
          math.pow(math.sin((b.lon - a.lon) * math.pi / 360), 2);
  return 6371008.8 * 2 * math.asin(math.sqrt(v.clamp(0, 1)));
}

bool ringContains(List<GeoPoint> ring, GeoPoint p) {
  var inside = false;
  for (int i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    final a = ring[i], b = ring[j];
    final cross =
        (p.lon - a.lon) * (b.lat - a.lat) - (p.lat - a.lat) * (b.lon - a.lon);
    if (cross.abs() < 1e-12 &&
        p.lon >= math.min(a.lon, b.lon) - 1e-10 &&
        p.lon <= math.max(a.lon, b.lon) + 1e-10 &&
        p.lat >= math.min(a.lat, b.lat) - 1e-10 &&
        p.lat <= math.max(a.lat, b.lat) + 1e-10) {
      return true;
    }
    if ((a.lat > p.lat) != (b.lat > p.lat) &&
        p.lon < (b.lon - a.lon) * (p.lat - a.lat) / (b.lat - a.lat) + a.lon) {
      inside = !inside;
    }
  }
  return inside;
}

bool polygonContains(List<List<GeoPoint>> rings, GeoPoint p) =>
    p.valid &&
    rings.isNotEmpty &&
    ringContains(rings.first, p) &&
    !rings.skip(1).any((r) => ringContains(r, p));

GeoPoint nearestOnSegment(GeoPoint p, GeoPoint a, GeoPoint b) {
  final scale = math.cos(p.lat * math.pi / 180);
  final dx = (b.lon - a.lon) * scale, dy = b.lat - a.lat;
  final len = dx * dx + dy * dy;
  final t = len == 0
      ? 0.0
      : (((p.lon - a.lon) * scale * dx + (p.lat - a.lat) * dy) / len).clamp(
          0.0,
          1.0,
        );
  return GeoPoint(a.lat + t * (b.lat - a.lat), a.lon + t * (b.lon - a.lon));
}
