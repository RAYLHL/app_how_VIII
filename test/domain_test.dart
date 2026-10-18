import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:zelo_flutter/catalog.dart';
import 'package:zelo_flutter/geo.dart';
import 'package:zelo_flutter/platform.dart';
import 'package:zelo_flutter/reports.dart';

class MemoryStorage implements ReportStorage {
  String? raw;
  bool fail = false;
  @override
  Future<String?> read() async => raw;
  @override
  Future<void> write(String value) async {
    if (fail) throw StateError('disk full');
    raw = value;
  }
}

void main() {
  late Catalog c;
  setUpAll(() {
    c = Catalog(
      File('assets/region.json').readAsStringSync(),
      File('assets/streets.json').readAsStringSync(),
    );
  });
  test('Exact regional catalog and real city centers', () {
    expect(c.cities.map((x) => x.id).toSet(), {
      '4211306',
      '4208203',
      '4202008',
    });
    expect(c.streets.length, 12807);
    for (final city in c.cities) {
      expect(c.cityAt(city.center)?.id, city.id);
    }
  });
  for (final entry in <String, GeoPoint>{
    'Camboriú': const GeoPoint(-27.025, -48.653),
    'Penha': const GeoPoint(-26.77, -48.647),
    'ocean': const GeoPoint(-27.10, -48.615),
    'Belo Horizonte': const GeoPoint(-19.92, -43.93),
  }.entries) {
    test('Reject ${entry.key}', () => expect(c.cityAt(entry.value), isNull));
  }
  test('Nonfinite locations are rejected', () {
    expect(c.cityAt(const GeoPoint(double.nan, 0)), isNull);
    expect(c.cityAt(const GeoPoint(0, double.infinity)), isNull);
  });
  test('Polygon holes and boundaries', () {
    const rings = [
      [
        GeoPoint(0, 0),
        GeoPoint(0, 10),
        GeoPoint(10, 10),
        GeoPoint(10, 0),
        GeoPoint(0, 0),
      ],
      [
        GeoPoint(4, 4),
        GeoPoint(4, 6),
        GeoPoint(6, 6),
        GeoPoint(6, 4),
        GeoPoint(4, 4),
      ],
    ];
    expect(polygonContains(rings, const GeoPoint(2, 2)), isTrue);
    expect(polygonContains(rings, const GeoPoint(5, 5)), isFalse);
    expect(polygonContains(rings, const GeoPoint(20, 5)), isFalse);
    expect(polygonContains(rings, const GeoPoint(0, 3)), isTrue);
  });
  test('Haversine distance and segment clamp', () {
    expect(
      distance(const GeoPoint(0, 0), const GeoPoint(0, 1)),
      closeTo(111195, 10),
    );
    expect(
      distance(const GeoPoint(-26.9, -48.6), const GeoPoint(-26.9, -48.6)),
      0,
    );
    final p = nearestOnSegment(
      const GeoPoint(1, 2),
      const GeoPoint(0, 0),
      const GeoPoint(0, 1),
    );
    expect(p.lat, 0);
    expect(p.lon, 1);
  });
  test('Autocomplete accents threshold uniqueness and city filtering', () {
    expect(normalize(' ITAJAÍ '), 'itajai');
    expect(c.search('a'), isEmpty);
    expect(c.search('via inexistente xyz'), isEmpty);
    expect(c.search('atlantica', '4202008'), isNotEmpty);
    for (final city in c.cities) {
      final found = c.search('rua', city.id);
      expect(found, isNotEmpty);
      expect(found.length, lessThanOrEqualTo(8));
      expect(found.every((s) => s.cityId == city.id), isTrue);
      expect(found.map((s) => s.normalized).toSet().length, found.length);
    }
  });
  test('Street suggestions select real points inside their city', () {
    for (final city in c.cities) {
      for (final street in c.search('rua', city.id)) {
        final p = c.pointFor(street, city.center);
        expect(city.contains(p), isTrue);
      }
    }
  });
  test(
    'More than 99 percent of road midpoints remain in assigned municipality',
    () {
      final inside = c.streets
          .where(
            (s) => c.city(s.cityId).contains(s.points[s.points.length ~/ 2]),
          )
          .length;
      expect(inside, greaterThan(c.streets.length * .99));
    },
  );
  test('Location age accuracy and clock boundaries', () {
    final now = DateTime(2026, 10, 17, 12);
    expect(
      LocationFix(
        c.cities.first.center,
        100,
        now.subtract(const Duration(seconds: 30)),
      ).freshForReport(now),
      isTrue,
    );
    expect(
      LocationFix(c.cities.first.center, 101, now).freshForReport(now),
      isFalse,
    );
    expect(
      LocationFix(
        c.cities.first.center,
        20,
        now.subtract(const Duration(seconds: 31)),
      ).freshForReport(now),
      isFalse,
    );
    expect(
      LocationFix(
        c.cities.first.center,
        20,
        now.add(const Duration(seconds: 2)),
      ).freshForReport(now),
      isFalse,
    );
  });
  test(
    'Persistence support follow and concurrent changes survive reload',
    () async {
      final storage = MemoryStorage(), store = ReportStore(c, MemoryStorage());
      await store.load();
      expect(store.rows.length, 9);
      expect(store.rows.every((r) => r.demo), isTrue);
      final s = ReportStore(c, storage);
      await s.load();
      final id = s.rows.first.id, initialVotes = s.rows.first.votes;
      await Future.wait([s.toggleSupport(id), s.toggleFollow(id)]);
      final reload = ReportStore(c, storage);
      await reload.load();
      final r = reload.rows.firstWhere((r) => r.id == id);
      expect(r.votes, initialVotes + 1);
      expect(r.supported, isTrue);
      expect(r.following, isTrue);
      await reload.toggleSupport(id);
      expect(reload.rows.firstWhere((r) => r.id == id).votes, initialVotes);
    },
  );
  test(
    'Failed storage never confirms an in-memory change and queue recovers',
    () async {
      final storage = MemoryStorage(), s = ReportStore(c, MemoryStorage());
      await s.load();
      final store = ReportStore(c, storage);
      await store.load();
      final id = store.rows.first.id;
      final before = storage.raw;
      storage.fail = true;
      await expectLater(store.toggleSupport(id), throwsStateError);
      expect(storage.raw, before);
      expect(store.rows.first.supported, isFalse);
      storage.fail = false;
      await store.toggleSupport(id);
      expect(store.rows.first.supported, isTrue);
    },
  );
  test(
    'Save rejects outside boundary and mismatched city; nearby is sorted',
    () async {
      final store = ReportStore(c, MemoryStorage());
      await store.load();
      final r = store.rows.first;
      final outside = Report.fromJson({
        ...r.toJson(),
        'lat': -19.92,
        'lon': -43.93,
      });
      await expectLater(store.save(outside), throwsArgumentError);
      final wrongCity = Report.fromJson({...r.toJson(), 'cityId': '4202008'});
      await expectLater(store.save(wrongCity), throwsArgumentError);
      final list = store.nearby(r.point, 3);
      expect(list.every((x) => distance(r.point, x.point) <= 3000), isTrue);
      for (var i = 1; i < list.length; i++) {
        expect(
          distance(r.point, list[i - 1].point),
          lessThanOrEqualTo(distance(r.point, list[i].point)),
        );
      }
    },
  );
  test('Corrupt persisted records are not replaced with examples', () async {
    final storage = MemoryStorage()..raw = 'corrupt';
    await expectLater(ReportStore(c, storage).load(), throwsFormatException);
    expect(storage.raw, 'corrupt');
  });
}
