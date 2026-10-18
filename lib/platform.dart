import 'package:flutter/services.dart';
import 'geo.dart';
import 'reports.dart';

const nativeChannel = MethodChannel('br.com.zelo/native');

class NativeStorage implements ReportStorage {
  @override
  Future<String?> read() => nativeChannel.invokeMethod<String>('load');
  @override
  Future<void> write(String value) async {
    await nativeChannel.invokeMethod<void>('save', value);
  }
}

class LocationFix {
  final GeoPoint point;
  final double accuracy;
  final DateTime time;
  const LocationFix(this.point, this.accuracy, this.time);
  bool freshForReport(DateTime now) =>
      point.valid &&
      accuracy.isFinite &&
      accuracy >= 0 &&
      accuracy <= 100 &&
      now.difference(time).inMilliseconds >= -1000 &&
      now.difference(time).inSeconds <= 30;
}

Future<LocationFix> locate() async {
  final data = await nativeChannel.invokeMapMethod<String, dynamic>('location');
  if (data == null) throw StateError('Posição indisponível.');
  final fix = LocationFix(
    GeoPoint((data['lat'] as num).toDouble(), (data['lon'] as num).toDouble()),
    (data['accuracy'] as num).toDouble(),
    DateTime.fromMillisecondsSinceEpoch(data['time']),
  );
  if (!fix.freshForReport(DateTime.now())) {
    throw StateError(
      'Localização imprecisa ou antiga. Escolha o ponto no mapa.',
    );
  }
  return fix;
}

Future<String?> pickPhoto() => nativeChannel.invokeMethod<String>('photo');
