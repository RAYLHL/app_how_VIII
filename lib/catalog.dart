import 'dart:convert';
import 'geo.dart';

class City {
  final String id, name;
  final GeoPoint center;
  final List<List<List<GeoPoint>>> polygons;
  City(Map<String, dynamic> json)
    : id = json['id'],
      name = json['name'],
      center = GeoPoint(
        (json['lat'] as num).toDouble(),
        (json['lon'] as num).toDouble(),
      ),
      polygons = (json['polygons'] as List)
          .map(
            (polygon) => (polygon as List)
                .map(
                  (ring) => (ring as List)
                      .map(
                        (p) => GeoPoint(
                          (p[1] as num).toDouble(),
                          (p[0] as num).toDouble(),
                        ),
                      )
                      .toList(),
                )
                .toList(),
          )
          .toList();
  bool contains(GeoPoint p) =>
      polygons.any((rings) => polygonContains(rings, p));
}

class Street {
  final String name, cityId, kind, normalized;
  final List<GeoPoint> points;
  late final double minLat, maxLat, minLon, maxLon;
  Street(List<dynamic> json)
    : name = json[0],
      cityId = json[1],
      kind = json[2],
      normalized = normalize(json[0]),
      points = (json[3] as List)
          .map(
            (p) => GeoPoint((p[1] as num).toDouble(), (p[0] as num).toDouble()),
          )
          .toList() {
    minLat = points.map((p) => p.lat).reduce((a, b) => a < b ? a : b);
    maxLat = points.map((p) => p.lat).reduce((a, b) => a > b ? a : b);
    minLon = points.map((p) => p.lon).reduce((a, b) => a < b ? a : b);
    maxLon = points.map((p) => p.lon).reduce((a, b) => a > b ? a : b);
  }
  bool get major => const [
    'motorway',
    'trunk',
    'primary',
    'secondary',
    'tertiary',
  ].contains(kind);
  GeoPoint nearest(GeoPoint p) {
    var best = points.first, d = double.infinity;
    for (var i = 1; i < points.length; i++) {
      final q = nearestOnSegment(p, points[i - 1], points[i]),
          v = distance(p, nearestOnSegment(p, points[i - 1], points[i]));
      if (v < d) {
        best = q;
        d = v;
      }
    }
    return best;
  }
}

class Catalog {
  final List<City> cities;
  final List<Street> streets;
  Catalog(String region, String roads)
    : cities = ((jsonDecode(region)['cities']) as List)
          .map((j) => City(j))
          .toList(),
      streets = (jsonDecode(roads) as List).map((j) => Street(j)).toList();
  City? cityAt(GeoPoint p) {
    for (final c in cities) {
      if (c.contains(p)) return c;
    }
    return null;
  }

  City city(String id) => cities.firstWhere((c) => c.id == id);
  List<Street> search(String query, [String? cityId]) {
    final q = normalize(query), seen = <String>{};
    if (q.length < 2) return [];
    final found = streets
        .where(
          (s) =>
              (cityId == null || s.cityId == cityId) &&
              s.normalized.contains(q) &&
              seen.add('${s.cityId}|${s.normalized}'),
        )
        .toList();
    found.sort((a, b) {
      final rank = (a.normalized.startsWith(q) ? 0 : 1).compareTo(
        b.normalized.startsWith(q) ? 0 : 1,
      );
      return rank == 0 ? a.name.compareTo(b.name) : rank;
    });
    return found.take(8).toList();
  }

  GeoPoint pointFor(Street street, GeoPoint reference) {
    var best = street.nearest(reference),
        d = distance(reference, street.nearest(reference));
    for (final s in streets.where(
      (s) => s.cityId == street.cityId && s.name == street.name,
    )) {
      final p = s.nearest(reference),
          v = distance(reference, s.nearest(reference));
      if (v < d) {
        best = p;
        d = v;
      }
    }
    return best;
  }

  String address(GeoPoint point) {
    final c = cityAt(point);
    if (c == null) return 'Fora da área atendida';
    Street? best;
    var d = 100.0;
    for (final s in streets.where(
      (s) => s.cityId == c.id && s.name.isNotEmpty,
    )) {
      final v = distance(point, s.nearest(point));
      if (v < d) {
        d = v;
        best = s;
      }
    }
    return '${best?.name ?? 'Ponto no mapa'} · ${c.name}';
  }
}
