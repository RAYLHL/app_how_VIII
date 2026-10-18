import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'catalog.dart';
import 'geo.dart';
import 'reports.dart';

class MapController extends ChangeNotifier {
  GeoPoint center = const GeoPoint(-26.93, -48.658);
  double metersPerPixel = 7;
  void focus(GeoPoint p, {double scale = 2.7}) {
    center = p;
    metersPerPixel = scale;
    notifyListeners();
  }

  void zoom(double factor) {
    metersPerPixel = (metersPerPixel / factor).clamp(.45, 85);
    notifyListeners();
  }

  void gesture(Offset delta, double scale) {
    metersPerPixel = scale.clamp(.45, 85);
    move(delta);
  }

  void move(Offset delta) {
    center = GeoPoint(
      (center.lat + delta.dy * metersPerPixel / 111320).clamp(-27.17, -26.70),
      (center.lon -
              delta.dx *
                  metersPerPixel /
                  (111320 * math.cos(center.lat * math.pi / 180)))
          .clamp(-48.95, -48.52),
    );
    notifyListeners();
  }

  Offset project(GeoPoint p, Size size) => Offset(
    size.width / 2 +
        (p.lon - center.lon) *
            111320 *
            math.cos(center.lat * math.pi / 180) /
            metersPerPixel,
    size.height / 2 - (p.lat - center.lat) * 111320 / metersPerPixel,
  );
  GeoPoint unproject(Offset p, Size size) => GeoPoint(
    center.lat - (p.dy - size.height / 2) * metersPerPixel / 111320,
    center.lon +
        (p.dx - size.width / 2) *
            metersPerPixel /
            (111320 * math.cos(center.lat * math.pi / 180)),
  );
}

class CityMap extends StatefulWidget {
  final Catalog catalog;
  final List<Report> reports;
  final MapController controller;
  final GeoPoint? user, selected;
  final void Function(Report)? onReport;
  final void Function(GeoPoint)? onPick;
  const CityMap({
    super.key,
    required this.catalog,
    required this.reports,
    required this.controller,
    this.user,
    this.selected,
    this.onReport,
    this.onPick,
  });
  @override
  State<CityMap> createState() => _CityMapState();
}

class _CityMapState extends State<CityMap> {
  double baseScale = 7;
  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: widget.controller,
    builder: (context, _) => LayoutBuilder(
      builder: (context, box) {
        final size = box.biggest;
        return Semantics(
          label:
              'Mapa das três cidades. Arraste e use pinça para zoom. Pressione para selecionar um ponto.',
          child: GestureDetector(
            onScaleStart: (_) => baseScale = widget.controller.metersPerPixel,
            onScaleUpdate: (d) {
              widget.controller.gesture(d.focalPointDelta, baseScale / d.scale);
            },
            onLongPressStart: widget.onPick == null
                ? null
                : (d) => widget.onPick!(
                    widget.controller.unproject(d.localPosition, size),
                  ),
            onTapUp: (d) {
              Report? best;
              var nearest = 32.0;
              for (final r in widget.reports) {
                final distance =
                    (widget.controller.project(r.point, size) - d.localPosition)
                        .distance;
                if (distance < nearest) {
                  nearest = distance;
                  best = r;
                }
              }
              if (best != null) widget.onReport?.call(best);
            },
            child: CustomPaint(
              size: size,
              painter: MapPainter(
                widget.catalog,
                widget.reports,
                widget.controller,
                widget.user,
                widget.selected,
              ),
            ),
          ),
        );
      },
    ),
  );
}

class MapPainter extends CustomPainter {
  final Catalog catalog;
  final List<Report> reports;
  final MapController controller;
  final GeoPoint? user, selected;
  MapPainter(
    this.catalog,
    this.reports,
    this.controller,
    this.user,
    this.selected,
  );
  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawColor(const Color(0xff101a19), BlendMode.src);
    final paint = Paint()..isAntiAlias = true;
    Offset project(GeoPoint p) => controller.project(p, size);
    for (final city in catalog.cities) {
      final path = Path()..fillType = PathFillType.evenOdd;
      for (final polygon in city.polygons) {
        for (final ring in polygon) {
          for (var i = 0; i < ring.length; i++) {
            final p = project(ring[i]);
            if (i == 0) {
              path.moveTo(p.dx, p.dy);
            } else {
              path.lineTo(p.dx, p.dy);
            }
          }
          path.close();
        }
      }
      canvas.drawPath(
        path,
        paint
          ..style = PaintingStyle.fill
          ..color = const Color(0xff1c2720),
      );
      canvas.drawPath(
        path,
        paint
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1
          ..color = const Color(0xff3f5239),
      );
    }
    final halfLat = (size.height / 2 + 80) * controller.metersPerPixel / 111320,
        halfLon =
            (size.width / 2 + 80) *
            controller.metersPerPixel /
            (111320 * math.cos(controller.center.lat * math.pi / 180));
    final labels = <Rect>[], named = <String>{};
    for (final street in catalog.streets) {
      if (street.maxLat < controller.center.lat - halfLat ||
          street.minLat > controller.center.lat + halfLat ||
          street.maxLon < controller.center.lon - halfLon ||
          street.minLon > controller.center.lon + halfLon ||
          (controller.metersPerPixel > 22 && !street.major)) {
        continue;
      }
      final path = Path();
      for (var i = 0; i < street.points.length; i++) {
        final p = project(street.points[i]);
        if (i == 0) {
          path.moveTo(p.dx, p.dy);
        } else {
          path.lineTo(p.dx, p.dy);
        }
      }
      canvas.drawPath(
        path,
        paint
          ..style = PaintingStyle.stroke
          ..strokeWidth = (street.major ? 2.2 : 1)
          ..color = Color(street.major ? 0xff657356 : 0xff3b4a3e),
      );
      if (controller.metersPerPixel < 5 &&
          street.name.isNotEmpty &&
          !named.contains('${street.cityId}|${street.name}')) {
        final mid = project(street.points[street.points.length ~/ 2]);
        final text = TextPainter(
          text: TextSpan(
            text: street.name,
            style: const TextStyle(
              fontFamily: 'Roboto',
              fontSize: 10,
              color: Color(0xff9eae99),
            ),
          ),
          textDirection: TextDirection.ltr,
        )..layout(maxWidth: 150);
        final rect = Rect.fromLTWH(
          mid.dx - text.width / 2,
          mid.dy,
          text.width,
          text.height,
        ).inflate(5);
        if (rect.overlaps(Offset.zero & size) &&
            !labels.any((r) => r.overlaps(rect))) {
          text.paint(canvas, Offset(mid.dx - text.width / 2, mid.dy));
          labels.add(rect);
          named.add('${street.cityId}|${street.name}');
        }
      }
    }
    for (final city in catalog.cities) {
      final text = TextPainter(
        text: TextSpan(
          text: city.name,
          style: const TextStyle(
            fontFamily: 'Roboto',
            color: Color(0xffb9c7ae),
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      final p = project(city.center);
      text.paint(canvas, Offset(p.dx - text.width / 2, p.dy - 25));
    }
    for (final r in reports) {
      final p = project(r.point);
      if (!(Offset.zero & size).inflate(30).contains(p)) continue;
      canvas.drawCircle(
        p,
        14,
        paint
          ..style = PaintingStyle.fill
          ..color = r.status == 'Concluída'
              ? const Color(0xff90d3b0)
              : r.priority == 'Alta'
              ? const Color(0xfff5ad77)
              : const Color(0xffbaef94),
      );
      canvas.drawCircle(
        p,
        14,
        paint
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..color = const Color(0xff142016),
      );
      const symbols = ['L', 'B', 'E', 'C', 'S', 'O', 'A', 'V', '+'];
      final text = TextPainter(
        text: TextSpan(
          text: symbols[r.category],
          style: const TextStyle(
            fontFamily: 'Roboto',
            color: Color(0xff142016),
            fontSize: 12,
            fontWeight: FontWeight.bold,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      text.paint(canvas, Offset(p.dx - text.width / 2, p.dy - text.height / 2));
    }
    if (user != null) {
      final p = project(user!);
      canvas.drawCircle(
        p,
        16,
        paint
          ..style = PaintingStyle.fill
          ..color = const Color(0x444ba4ff),
      );
      canvas.drawCircle(p, 6, paint..color = const Color(0xff83c5ff));
    }
    if (selected != null) {
      final p = project(selected!);
      canvas.drawCircle(
        p,
        18,
        paint
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3
          ..color = Colors.white,
      );
      canvas.drawLine(p - const Offset(24, 0), p + const Offset(24, 0), paint);
      canvas.drawLine(p - const Offset(0, 24), p + const Offset(0, 24), paint);
    }
  }

  @override
  bool shouldRepaint(covariant MapPainter oldDelegate) => true;
}
