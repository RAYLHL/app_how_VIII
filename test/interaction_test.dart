import 'dart:io';
import 'package:flutter/services.dart';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zelo_flutter/catalog.dart';
import 'package:zelo_flutter/main.dart';
import 'package:zelo_flutter/reports.dart';
import 'domain_test.dart' show MemoryStorage;

void main() {
  testWidgets('Street search and local support through the detail sheet', (
    tester,
  ) async {
    final fontPath = Platform.environment['ZELO_TEST_FONT'];
    if (fontPath != null) {
      final loader = FontLoader('Roboto')
        ..addFont(
          Future.value(ByteData.sublistView(File(fontPath).readAsBytesSync())),
        );
      await loader.load();
    }
    final iconPath = Platform.environment['ZELO_TEST_ICON_FONT'];
    if (iconPath != null) {
      final loader = FontLoader('MaterialIcons')
        ..addFont(
          Future.value(ByteData.sublistView(File(iconPath).readAsBytesSync())),
        );
      await loader.load();
    }
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final c = Catalog(
      File('assets/region.json').readAsStringSync(),
      File('assets/streets.json').readAsStringSync(),
    );
    final store = ReportStore(c, MemoryStorage());
    await store.load();
    final first = store.rows.first;
    await store.toggleFollow(first.id);
    final boundary = GlobalKey();
    Future<void> capture(String name) async {
      final folder = Platform.environment['ZELO_SCREENSHOTS_DIR'];
      if (folder == null) return;
      await tester.runAsync(() async {
        final image =
            await (boundary.currentContext!.findRenderObject()
                    as RenderRepaintBoundary)
                .toImage(pixelRatio: 2);
        final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
        await Directory(folder).create(recursive: true);
        await File(
          '$folder/$name.png',
        ).writeAsBytes(bytes!.buffer.asUint8List());
        image.dispose();
      });
    }

    await tester.pumpWidget(
      RepaintBoundary(
        key: boundary,
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: zeloTheme(),
          home: ZeloHome(catalog: c, store: store),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await capture('mapa');
    await tester.enterText(find.byType(TextField).first, 'atlantica');
    await tester.pumpAndSettle();
    expect(find.text('Balneário Camboriú'), findsWidgets);
    await capture('busca');
    await tester.tap(find.text('Acompanhando').last);
    await tester.pumpAndSettle();
    await capture('acompanhando');
    await tester.tap(find.text(first.title));
    await tester.pumpAndSettle();
    await capture('detalhe');
    final votes = store.rows.firstWhere((r) => r.id == first.id).votes;
    await tester.tap(find.text('Apoiar · $votes'));
    await tester.pumpAndSettle();
    expect(store.rows.firstWhere((r) => r.id == first.id).votes, votes + 1);
    expect(tester.takeException(), isNull);
    Navigator.of(tester.element(find.text('Histórico'))).pop();
    await tester.pumpAndSettle();
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
    await tester.pumpWidget(
      RepaintBoundary(
        key: boundary,
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: zeloTheme(),
          home: ReportForm(
            catalog: c,
            initial: c.cities.first.center,
            onSave: store.save,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await capture('formulario');
    expect(tester.takeException(), isNull);
  });
}
