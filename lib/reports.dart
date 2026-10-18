import 'dart:convert';
import 'dart:math';
import 'catalog.dart';
import 'geo.dart';

const categories = [
  'Iluminação pública',
  'Buraco na via',
  'Entulho',
  'Calçada',
  'Sinalização',
  'Obra parada',
  'Alagamento',
  'Esgoto a céu aberto',
  'Outros',
];
const priorities = ['Baixa', 'Média', 'Alta'];

class Report {
  final String id, title, address, cityId, description, status, priority, photo;
  final int category, votes, created;
  final GeoPoint point;
  final bool following, supported, demo;
  final List<Map<String, dynamic>> history;
  const Report({
    required this.id,
    required this.title,
    required this.address,
    required this.cityId,
    required this.description,
    required this.category,
    required this.point,
    required this.created,
    this.status = 'Aberta',
    this.priority = 'Média',
    this.photo = '',
    this.votes = 0,
    this.following = false,
    this.supported = false,
    this.demo = false,
    this.history = const [],
  });
  factory Report.fromJson(Map<String, dynamic> j) => Report(
    id: j['id'],
    title: j['title'],
    address: j['address'],
    cityId: j['cityId'],
    description: j['description'],
    category: j['category'],
    point: GeoPoint((j['lat'] as num).toDouble(), (j['lon'] as num).toDouble()),
    created: j['created'],
    status: j['status'],
    priority: j['priority'],
    photo: j['photo'] ?? '',
    votes: j['votes'] ?? 0,
    following: j['following'] ?? false,
    supported: j['supported'] ?? false,
    demo: j['demo'] ?? false,
    history: (j['history'] as List? ?? [])
        .map((x) => Map<String, dynamic>.from(x))
        .toList(),
  );
  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'address': address,
    'cityId': cityId,
    'description': description,
    'category': category,
    'lat': point.lat,
    'lon': point.lon,
    'created': created,
    'status': status,
    'priority': priority,
    'photo': photo,
    'votes': votes,
    'following': following,
    'supported': supported,
    'demo': demo,
    'history': history,
  };
  Report withFlags({bool? following, bool? supported, int? votes}) =>
      Report.fromJson({
        ...toJson(),
        'following': following ?? this.following,
        'supported': supported ?? this.supported,
        'votes': votes ?? this.votes,
      });
}

abstract class ReportStorage {
  Future<String?> read();
  Future<void> write(String value);
}

class ReportStore {
  final Catalog catalog;
  final ReportStorage storage;
  List<Report> _rows = [];
  List<Report> get rows => List.unmodifiable(_rows);
  Future<void> _queue = Future.value();
  ReportStore(this.catalog, this.storage);
  bool valid(Report r) =>
      r.point.valid &&
      catalog.cityAt(r.point)?.id == r.cityId &&
      r.category >= 0 &&
      r.category < categories.length &&
      r.title.trim().isNotEmpty &&
      r.address.trim().isNotEmpty &&
      r.description.trim().isNotEmpty &&
      priorities.contains(r.priority) &&
      r.votes >= 0;
  Future<void> load() async {
    final raw = await storage.read();
    if (raw == null) {
      final seed = _seed();
      await storage.write(jsonEncode(seed.map((r) => r.toJson()).toList()));
      _rows = seed;
    } else {
      final parsed = (jsonDecode(raw) as List)
          .map((j) => Report.fromJson(j))
          .toList();
      if (parsed.any((r) => !valid(r))) {
        throw const FormatException(
          'Registros inválidos. Os dados foram preservados.',
        );
      }
      _rows = parsed;
    }
  }

  Future<void> _change(List<Report> Function(List<Report>) operation) {
    final future = _queue.then((_) async {
      final next = operation(List.of(_rows));
      if (next.any((r) => !valid(r))) {
        throw ArgumentError(
          'Ocorrência inválida ou fora das cidades atendidas.',
        );
      }
      await storage.write(jsonEncode(next.map((r) => r.toJson()).toList()));
      _rows = next;
    });
    _queue = future.then((_) {}, onError: (Object e, StackTrace st) {});
    return future;
  }

  Future<void> save(Report report) =>
      _change((rows) => [report, ...rows.where((r) => r.id != report.id)]);
  Future<void> toggleFollow(String id) => _change(
    (rows) => rows
        .map((r) => r.id == id ? r.withFlags(following: !r.following) : r)
        .toList(),
  );
  Future<void> toggleSupport(String id) => _change(
    (rows) => rows
        .map(
          (r) => r.id == id
              ? r.withFlags(
                  supported: !r.supported,
                  votes: r.votes + (r.supported ? -1 : 1),
                )
              : r,
        )
        .toList(),
  );
  List<Report> nearby(
    GeoPoint user,
    double radiusKm, {
    String? cityId,
    int? category,
  }) =>
      filter(
        cityId: cityId,
        category: category,
      ).where((r) => distance(user, r.point) <= radiusKm * 1000).toList()..sort(
        (a, b) => distance(user, a.point).compareTo(distance(user, b.point)),
      );
  List<Report> filter({
    String? cityId,
    int? category,
    bool following = false,
  }) => _rows
      .where(
        (r) =>
            (cityId == null || r.cityId == cityId) &&
            (category == null || r.category == category) &&
            (!following || r.following),
      )
      .toList();
  List<Report> _seed() {
    final result = <Report>[];
    for (final c in catalog.cities) {
      final seen = <String>{};
      for (final s in catalog.streets.where(
        (s) => s.cityId == c.id && s.name.isNotEmpty,
      )) {
        if (distance(s.points.first, c.center) > 3500 ||
            seen.contains(s.name)) {
          continue;
        }
        final p = s.nearest(c.center);
        if (!c.contains(p)) continue;
        seen.add(s.name);
        final n = result.length;
        result.add(
          Report(
            id: 'EX-${n + 1}',
            title: '${categories[n % 9]} · exemplo',
            address: '${s.name} · ${c.name}',
            cityId: c.id,
            description:
                'Ocorrência fictícia para experimentar o mapa. Não é uma reclamação real.',
            category: n % 9,
            point: p,
            created: DateTime.now().millisecondsSinceEpoch - (n + 1) * 3600000,
            demo: true,
            votes: n + 3,
            priority: n % 3 == 0 ? 'Alta' : 'Média',
            status: n % 3 == 0 ? 'Em andamento' : 'Aberta',
            history: [
              {
                'time': DateTime.now().millisecondsSinceEpoch,
                'text': 'Exemplo ilustrativo. Sem resposta oficial.',
              },
            ],
          ),
        );
        if (seen.length == 3) break;
      }
    }
    return result;
  }
}

String newReportId() =>
    'ZL-${DateTime.now().microsecondsSinceEpoch.toRadixString(36).toUpperCase()}-${Random.secure().nextInt(1 << 24).toRadixString(36).toUpperCase()}';
