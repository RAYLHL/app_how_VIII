import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zelo_flutter/catalog.dart';
import 'package:zelo_flutter/main.dart';
import 'package:zelo_flutter/reports.dart';
import 'domain_test.dart' show MemoryStorage;

void main() {
  late Catalog c;
  setUpAll(
    () => c = Catalog(
      File('assets/region.json').readAsStringSync(),
      File('assets/streets.json').readAsStringSync(),
    ),
  );
  testWidgets('Android-sized navigation map and no invented user location', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final store = ReportStore(c, MemoryStorage());
    await store.load();
    await tester.pumpWidget(
      MaterialApp(
        theme: zeloTheme(),
        home: ZeloHome(catalog: c, store: store),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Reportar aqui'), findsOneWidget);
    await tester.tap(find.text('Perto de mim').last);
    await tester.pumpAndSettle();
    expect(
      find.text('Use sua localização para ver os relatos próximos.'),
      findsOneWidget,
    );
    await tester.tap(find.text('Acompanhando').last);
    await tester.pumpAndSettle();
    expect(
      find.text('Nenhuma solicitação acompanhada neste filtro.'),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });
  testWidgets('Invalid form blocks save and failed save preserves draft', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    var saves = 0;
    await tester.pumpWidget(
      MaterialApp(
        theme: zeloTheme(),
        home: ReportForm(
          catalog: c,
          initial: c.cities.first.center,
          onSave: (r) async {
            saves++;
            throw StateError('full disk');
          },
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Salvar relato'));
    await tester.tap(find.text('Salvar relato'));
    await tester.pumpAndSettle();
    expect(saves, 0);
    final title = find.byType(TextFormField).at(0),
        description = find.byType(TextFormField).at(2);
    await tester.ensureVisible(title);
    await tester.enterText(title, 'Lâmpada apagada');
    await tester.ensureVisible(description);
    await tester.enterText(
      description,
      'Poste em frente à praça sem iluminação.',
    );
    await tester.ensureVisible(find.text('Salvar relato'));
    await tester.tap(find.text('Salvar relato'));
    await tester.pumpAndSettle();
    expect(saves, 1);
    expect(find.text('Lâmpada apagada'), findsOneWidget);
    expect(find.textContaining('Seu formulário foi mantido'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
