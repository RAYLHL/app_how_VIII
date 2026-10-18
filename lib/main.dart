import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'catalog.dart';
import 'geo.dart';
import 'map_view.dart';
import 'platform.dart';
import 'reports.dart';

const green = Color(0xffbaef94),
    muted = Color(0xffa3b29f),
    panel = Color(0xff1b261f);
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ZeloApp());
}

ThemeData zeloTheme() => ThemeData(
  brightness: Brightness.dark,
  useMaterial3: true,
  scaffoldBackgroundColor: const Color(0xff101713),
  colorScheme: ColorScheme.fromSeed(
    seedColor: green,
    brightness: Brightness.dark,
  ),
  appBarTheme: const AppBarTheme(backgroundColor: Color(0xff101713)),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: panel,
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: BorderSide.none,
    ),
  ),
  navigationBarTheme: const NavigationBarThemeData(
    backgroundColor: panel,
    indicatorColor: Color(0xff3b5330),
  ),
);

class ZeloApp extends StatelessWidget {
  const ZeloApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Zelo',
    debugShowCheckedModeBanner: false,
    theme: zeloTheme(),
    home: const Boot(),
  );
}

class Boot extends StatefulWidget {
  const Boot({super.key});
  @override
  State<Boot> createState() => _BootState();
}

class _BootState extends State<Boot> {
  Catalog? catalog;
  ReportStore? store;
  String? error;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() => error = null);
    try {
      final data = await Future.wait([
        rootBundle.loadString('assets/region.json'),
        rootBundle.loadString('assets/streets.json'),
      ]);
      final c = Catalog(data[0], data[1]);
      final s = ReportStore(c, NativeStorage());
      await s.load();
      if (mounted) {
        setState(() {
          catalog = c;
          store = s;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(
          () => error =
              'Não foi possível abrir os dados locais. Nenhum registro foi apagado.\n$e',
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) => store != null
      ? ZeloHome(catalog: catalog!, store: store!)
      : Scaffold(
          body: SafeArea(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: error == null
                    ? const Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'zelo',
                            style: TextStyle(fontSize: 42, color: green),
                          ),
                          SizedBox(height: 24),
                          CircularProgressIndicator(),
                        ],
                      )
                    : Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(error!),
                          const SizedBox(height: 16),
                          FilledButton(
                            onPressed: load,
                            child: const Text('Tentar novamente'),
                          ),
                        ],
                      ),
              ),
            ),
          ),
        );
}

String meters(double value) => value < 1000
    ? '${value.round()} m'
    : '${(value / 1000).toStringAsFixed(1).replaceAll('.', ',')} km';
String date(int value) {
  final d = DateTime.fromMillisecondsSinceEpoch(value);
  return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
}

void message(BuildContext context, String text) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
}

String errorMessage(Object e) => e is PlatformException
    ? (e.message ?? 'Falha no serviço do Android.')
    : e.toString();

class ZeloHome extends StatefulWidget {
  final Catalog catalog;
  final ReportStore store;
  const ZeloHome({super.key, required this.catalog, required this.store});
  @override
  State<ZeloHome> createState() => _ZeloHomeState();
}

class _ZeloHomeState extends State<ZeloHome> {
  final map = MapController(), search = TextEditingController();
  int page = 0;
  String? cityId;
  int? category;
  double radius = 3;
  LocationFix? fix;
  bool locating = false;
  List<Street> suggestions = [];
  @override
  void dispose() {
    map.dispose();
    search.dispose();
    super.dispose();
  }

  Future<void> location({bool report = false}) async {
    if (locating) return;
    setState(() => locating = true);
    try {
      final result = await locate();
      if (!mounted) return;
      setState(() => fix = result);
      map.focus(result.point);
      if (widget.catalog.cityAt(result.point) == null) {
        message(
          context,
          'Você está fora das três cidades atendidas. Escolha um ponto válido no mapa.',
        );
        if (report) setState(() => page = 0);
      } else if (report) {
        await selectPoint(result.point);
      }
    } catch (e) {
      if (mounted) {
        message(
          context,
          '${errorMessage(e)} Pressione um ponto do mapa para escolher manualmente.',
        );
      }
    } finally {
      if (mounted) setState(() => locating = false);
    }
  }

  Future<void> selectPoint(GeoPoint point) async {
    final city = widget.catalog.cityAt(point);
    if (city == null) {
      message(
        context,
        'Só é possível reportar em Navegantes, Itajaí e Balneário Camboriú.',
      );
      return;
    }
    final selected = await Navigator.of(context).push<GeoPoint>(
      MaterialPageRoute(
        builder: (_) => PointPicker(catalog: widget.catalog, initial: point),
      ),
    );
    if (selected == null || !mounted) return;
    final report = await Navigator.of(context).push<Report>(
      MaterialPageRoute(
        builder: (_) => ReportForm(
          catalog: widget.catalog,
          initial: selected,
          onSave: widget.store.save,
        ),
      ),
    );
    if (report == null || !mounted) return;
    setState(() {
      page = 2;
      cityId = null;
      category = null;
    });
    map.focus(report.point);
    message(context, 'Relato salvo neste aparelho. Protocolo ${report.id}.');
  }

  Future<void> detail(Report report) async {
    bool busy = false;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheet) => StatefulBuilder(
        builder: (sheet, refresh) {
          final r = widget.store.rows.firstWhere((r) => r.id == report.id);
          Future<void> change(bool support) async {
            if (busy) return;
            refresh(() => busy = true);
            try {
              if (support) {
                await widget.store.toggleSupport(r.id);
              } else {
                await widget.store.toggleFollow(r.id);
              }
              if (mounted) setState(() {});
            } catch (e) {
              if (sheet.mounted) {
                message(
                  sheet,
                  'Falha ao salvar. A alteração não foi confirmada.',
                );
              }
            } finally {
              if (sheet.mounted) refresh(() => busy = false);
            }
          }

          return SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    r.demo
                        ? 'EXEMPLO · sem atendimento oficial'
                        : 'LOCAL · salvo neste aparelho',
                    style: const TextStyle(color: green, fontSize: 12),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    r.title,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 10),
                  Text(
                    '${r.status} · prioridade ${r.priority}',
                    style: const TextStyle(color: green),
                  ),
                  const SizedBox(height: 12),
                  Text(r.address),
                  Text(
                    '${r.point.lat.toStringAsFixed(5)}, ${r.point.lon.toStringAsFixed(5)}',
                    style: const TextStyle(color: muted),
                  ),
                  const SizedBox(height: 16),
                  Text(r.description),
                  if (r.photo.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: Image.file(
                          File(r.photo),
                          height: 200,
                          width: double.infinity,
                          fit: BoxFit.cover,
                          errorBuilder: (_, e, st) =>
                              const Text('Foto indisponível.'),
                        ),
                      ),
                    ),
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 12,
                    runSpacing: 8,
                    children: [
                      FilledButton.tonalIcon(
                        onPressed: busy ? null : () => change(true),
                        icon: Icon(
                          r.supported
                              ? Icons.thumb_up
                              : Icons.thumb_up_outlined,
                        ),
                        label: Text(
                          '${r.supported ? 'Apoiado' : 'Apoiar'} · ${r.votes}',
                        ),
                      ),
                      OutlinedButton.icon(
                        onPressed: busy ? null : () => change(false),
                        icon: Icon(
                          r.following ? Icons.bookmark : Icons.bookmark_border,
                        ),
                        label: Text(
                          r.following ? 'Acompanhando' : 'Acompanhar',
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 22),
                  const Text(
                    'Histórico',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  ...r.history.map(
                    (h) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.history, color: muted),
                      title: Text(h['text']),
                      subtitle: Text(date(h['time'])),
                    ),
                  ),
                  Text(
                    'Protocolo ${r.id}',
                    style: const TextStyle(color: muted, fontSize: 12),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Sem sincronização ou envio à prefeitura nesta versão.',
                    style: TextStyle(color: muted, fontSize: 12),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget filters() => SingleChildScrollView(
    scrollDirection: Axis.horizontal,
    padding: const EdgeInsets.symmetric(horizontal: 16),
    child: Row(
      children: [
        DropdownButton<String>(
          value: cityId ?? '',
          underline: const SizedBox(),
          items: [
            const DropdownMenuItem(value: '', child: Text('Três cidades')),
            ...widget.catalog.cities.map(
              (c) => DropdownMenuItem(value: c.id, child: Text(c.name)),
            ),
          ],
          onChanged: (id) {
            setState(() {
              cityId = id == '' ? null : id;
              suggestions = [];
            });
            if (cityId != null) {
              map.focus(widget.catalog.city(cityId!).center, scale: 6);
            }
          },
        ),
        const SizedBox(width: 12),
        DropdownButton<int>(
          value: category ?? -1,
          underline: const SizedBox(),
          items: [
            const DropdownMenuItem(
              value: -1,
              child: Text('Todas as categorias'),
            ),
            ...List.generate(
              categories.length,
              (i) => DropdownMenuItem(value: i, child: Text(categories[i])),
            ),
          ],
          onChanged: (v) => setState(() => category = v == -1 ? null : v),
        ),
      ],
    ),
  );
  Widget mapPage() => Stack(
    children: [
      Positioned.fill(
        child: CityMap(
          catalog: widget.catalog,
          reports: widget.store.filter(cityId: cityId, category: category),
          controller: map,
          user: fix?.point,
          onPick: selectPoint,
          onReport: detail,
        ),
      ),
      Positioned(
        top: 0,
        left: 0,
        right: 0,
        child: Column(
          children: [
            Container(
              color: const Color(0xee101713),
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                    child: Row(
                      children: [
                        const Text(
                          'zelo',
                          style: TextStyle(
                            color: green,
                            fontSize: 32,
                            fontWeight: FontWeight.w600,
                            letterSpacing: -1,
                          ),
                        ),
                        const Spacer(),
                        IconButton(
                          tooltip: 'Sobre o Zelo',
                          onPressed: about,
                          icon: const Icon(Icons.info_outline),
                        ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: TextField(
                      controller: search,
                      onChanged: (q) => setState(
                        () => suggestions = widget.catalog.search(q, cityId),
                      ),
                      decoration: InputDecoration(
                        hintText: 'Buscar rua nas três cidades',
                        prefixIcon: const Icon(Icons.search),
                        suffixIcon: search.text.isEmpty
                            ? null
                            : IconButton(
                                tooltip: 'Limpar busca',
                                icon: const Icon(Icons.close),
                                onPressed: () {
                                  search.clear();
                                  setState(() => suggestions = []);
                                },
                              ),
                      ),
                    ),
                  ),
                  filters(),
                ],
              ),
            ),
            if (suggestions.isNotEmpty)
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 16),
                constraints: const BoxConstraints(maxHeight: 240),
                child: Material(
                  color: panel,
                  borderRadius: BorderRadius.circular(12),
                  child: ListView(
                    shrinkWrap: true,
                    padding: EdgeInsets.zero,
                    children: suggestions
                        .map(
                          (s) => ListTile(
                            dense: true,
                            title: Text(s.name),
                            subtitle: Text(widget.catalog.city(s.cityId).name),
                            onTap: () {
                              final point = widget.catalog.pointFor(
                                s,
                                fix?.point ??
                                    widget.catalog.city(s.cityId).center,
                              );
                              map.focus(point);
                              search.text = s.name;
                              FocusScope.of(context).unfocus();
                              setState(() => suggestions = []);
                            },
                          ),
                        )
                        .toList(),
                  ),
                ),
              ),
          ],
        ),
      ),
      Positioned(
        right: 16,
        bottom: 150,
        child: Column(
          children: [
            FloatingActionButton.small(
              heroTag: 'zoom-in',
              tooltip: 'Aproximar',
              onPressed: () => map.zoom(1.5),
              child: const Icon(Icons.add),
            ),
            const SizedBox(height: 8),
            FloatingActionButton.small(
              heroTag: 'zoom-out',
              tooltip: 'Afastar',
              onPressed: () => map.zoom(1 / 1.5),
              child: const Icon(Icons.remove),
            ),
            const SizedBox(height: 8),
            FloatingActionButton.small(
              heroTag: 'gps',
              tooltip: 'Minha localização',
              onPressed: locating ? null : () => location(),
              child: const Icon(Icons.my_location),
            ),
          ],
        ),
      ),
      Positioned(
        bottom: 0,
        left: 0,
        right: 0,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0x00101713), Color(0xff101713)],
            ),
          ),
          child: Column(
            children: [
              const Text(
                'Pressione o mapa para escolher um ponto',
                style: TextStyle(color: muted, fontSize: 12),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: locating ? null : () => location(report: true),
                      icon: locating
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.add_location_alt_outlined),
                      label: Text(
                        locating ? 'Obtendo localização…' : 'Reportar aqui',
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filledTonal(
                    tooltip: 'Reportar no centro do mapa',
                    onPressed: () => selectPoint(map.center),
                    icon: const Icon(Icons.center_focus_strong),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              const Text(
                '© OpenStreetMap contributors · ODbL 1.0 · Limites IBGE',
                style: TextStyle(fontSize: 10, color: muted),
              ),
            ],
          ),
        ),
      ),
    ],
  );
  Widget listPage() {
    final nearby = page == 1;
    final rows = nearby
        ? (fix == null
              ? <Report>[]
              : widget.store.nearby(
                  fix!.point,
                  radius,
                  cityId: cityId,
                  category: category,
                ))
        : widget.store.filter(
            cityId: cityId,
            category: category,
            following: true,
          );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
          child: Text(
            nearby ? 'Perto de mim' : 'Acompanhando',
            style: Theme.of(context).textTheme.headlineMedium,
          ),
        ),
        filters(),
        if (nearby)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 8,
                  children: [
                    ...<double>[1, 3, 5].map(
                      (r) => ChoiceChip(
                        label: Text('${r.toInt()} km'),
                        selected: radius == r,
                        onSelected: (_) => setState(() => radius = r),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Atualizar localização',
                      onPressed: locating ? null : () => location(),
                      icon: const Icon(Icons.my_location),
                    ),
                  ],
                ),
                Text(
                  fix == null
                      ? 'Use sua localização para ver os relatos próximos.'
                      : '${fix!.freshForReport(DateTime.now()) ? 'Posição atual' : 'Última posição obtida'} · precisão ${fix!.accuracy.round()} m · distância em linha reta',
                  style: const TextStyle(fontSize: 12, color: muted),
                ),
                if (fix != null && widget.catalog.cityAt(fix!.point) == null)
                  const Text(
                    'Você está fora da área atendida.',
                    style: TextStyle(color: Colors.orange),
                  ),
              ],
            ),
          ),
        Expanded(
          child: rows.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          nearby
                              ? Icons.near_me_outlined
                              : Icons.bookmark_border,
                          size: 40,
                          color: muted,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          nearby
                              ? 'Nenhuma ocorrência neste raio ou filtro.'
                              : 'Nenhuma solicitação acompanhada neste filtro.',
                          textAlign: TextAlign.center,
                        ),
                        if (nearby && fix == null)
                          Padding(
                            padding: const EdgeInsets.only(top: 16),
                            child: FilledButton(
                              onPressed: locating ? null : () => location(),
                              child: const Text('Usar minha localização'),
                            ),
                          ),
                      ],
                    ),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: rows.length,
                  itemBuilder: (context, i) {
                    final r = rows[i];
                    return Card(
                      color: panel,
                      margin: const EdgeInsets.only(bottom: 12),
                      child: ListTile(
                        contentPadding: const EdgeInsets.all(16),
                        leading: CircleAvatar(
                          backgroundColor: green,
                          foregroundColor: Colors.black,
                          child: Text(
                            [
                              'L',
                              'B',
                              'E',
                              'C',
                              'S',
                              'O',
                              'A',
                              'V',
                              '+',
                            ][r.category],
                          ),
                        ),
                        title: Text(r.title),
                        subtitle: Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            '${r.address}\n${r.status} · ${r.demo ? 'EXEMPLO' : 'LOCAL'}${nearby ? ' · ${meters(distance(fix!.point, r.point))}' : ''}',
                          ),
                        ),
                        isThreeLine: true,
                        onTap: () => detail(r),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  void about() => showDialog<void>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Zelo'),
      content: const SingleChildScrollView(
        child: Text(
          'Zeladoria urbana para Navegantes, Itajaí e Balneário Camboriú.\n\nO mapa e as sugestões de ruas funcionam offline. Os relatos ficam neste aparelho. Apoios e acompanhamentos também são locais. Não há respostas oficiais, contas municipais ou envio à prefeitura nesta versão.\n\nEXEMPLO identifica registros fictícios. LOCAL identifica registros criados neste aparelho.\n\nRuas © OpenStreetMap contributors — ODbL 1.0. Limites municipais: IBGE.\n\nA proposta futura prevê uso gratuito pelos moradores e adesão municipal. Não há contratação ou cobrança neste aplicativo.',
        ),
      ),
      actions: [
        TextButton(
          onPressed: () =>
              showLicensePage(context: context, applicationName: 'Zelo'),
          child: const Text('Licenças'),
        ),
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Fechar'),
        ),
      ],
    ),
  );
  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(child: page == 0 ? mapPage() : listPage()),
    bottomNavigationBar: NavigationBar(
      selectedIndex: page,
      onDestinationSelected: (v) => setState(() => page = v),
      destinations: const [
        NavigationDestination(
          icon: Icon(Icons.map_outlined),
          selectedIcon: Icon(Icons.map),
          label: 'Mapa',
        ),
        NavigationDestination(
          icon: Icon(Icons.near_me_outlined),
          selectedIcon: Icon(Icons.near_me),
          label: 'Perto de mim',
        ),
        NavigationDestination(
          icon: Icon(Icons.bookmark_border),
          selectedIcon: Icon(Icons.bookmark),
          label: 'Acompanhando',
        ),
      ],
    ),
  );
}

class PointPicker extends StatefulWidget {
  final Catalog catalog;
  final GeoPoint initial;
  const PointPicker({super.key, required this.catalog, required this.initial});
  @override
  State<PointPicker> createState() => _PointPickerState();
}

class _PointPickerState extends State<PointPicker> {
  final map = MapController();
  @override
  void initState() {
    super.initState();
    map.focus(widget.initial);
  }

  @override
  void dispose() {
    map.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Confirme o ponto')),
    body: Column(
      children: [
        Expanded(
          child: Stack(
            children: [
              Positioned.fill(
                child: CityMap(
                  catalog: widget.catalog,
                  reports: const [],
                  controller: map,
                  onPick: (p) => map.focus(p, scale: map.metersPerPixel),
                ),
              ),
              const Center(
                child: IgnorePointer(
                  child: Icon(Icons.add_location_alt, color: green, size: 42),
                ),
              ),
              Positioned(
                right: 16,
                bottom: 16,
                child: Column(
                  children: [
                    IconButton.filled(
                      onPressed: () => map.zoom(1.5),
                      icon: const Icon(Icons.add),
                    ),
                    IconButton.filled(
                      onPressed: () => map.zoom(1 / 1.5),
                      icon: const Icon(Icons.remove),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              const Text(
                'Arraste o mapa até o local exato da falha.',
                style: TextStyle(color: muted),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () {
                    if (widget.catalog.cityAt(map.center) == null) {
                      message(
                        context,
                        'O ponto precisa estar em uma das três cidades atendidas.',
                      );
                      return;
                    }
                    Navigator.pop(context, map.center);
                  },
                  child: const Text('Confirmar localização'),
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class ReportForm extends StatefulWidget {
  final Catalog catalog;
  final GeoPoint initial;
  final Report? draft;
  final Future<void> Function(Report) onSave;
  const ReportForm({
    super.key,
    required this.catalog,
    required this.initial,
    required this.onSave,
    this.draft,
  });
  @override
  State<ReportForm> createState() => _ReportFormState();
}

class _ReportFormState extends State<ReportForm> {
  final form = GlobalKey<FormState>(),
      title = TextEditingController(),
      address = TextEditingController(),
      description = TextEditingController(),
      map = MapController();
  late GeoPoint point;
  int category = 0;
  String priority = 'Média', photo = '';
  List<Street> suggestions = [];
  bool picking = false, saving = false;
  @override
  void initState() {
    super.initState();
    point = widget.initial;
    map.focus(point);
    final r = widget.draft;
    title.text = r?.title ?? '';
    address.text = r?.address ?? widget.catalog.address(point);
    description.text = r?.description ?? '';
    category = r?.category ?? 0;
    priority = r?.priority ?? 'Média';
    photo = r?.photo ?? '';
  }

  @override
  void dispose() {
    title.dispose();
    address.dispose();
    description.dispose();
    map.dispose();
    super.dispose();
  }

  Future<void> choosePhoto() async {
    setState(() => picking = true);
    try {
      final path = await pickPhoto();
      if (mounted && path != null) setState(() => photo = path);
    } catch (e) {
      if (mounted) message(context, errorMessage(e));
    } finally {
      if (mounted) setState(() => picking = false);
    }
  }

  Future<void> submit() async {
    if (saving) return;
    if (!form.currentState!.validate()) return;
    final city = widget.catalog.cityAt(point);
    if (city == null) {
      message(context, 'Local fora da área atendida.');
      return;
    }
    final time = widget.draft?.created ?? DateTime.now().millisecondsSinceEpoch;
    final report = Report(
      id: widget.draft?.id ?? newReportId(),
      title: title.text.trim(),
      address: address.text.trim(),
      cityId: city.id,
      description: description.text.trim(),
      category: category,
      point: point,
      created: time,
      priority: priority,
      photo: photo,
      following: true,
      history: [
        {
          'time': time,
          'text': 'Relato criado localmente. Ainda não enviado à prefeitura.',
        },
      ],
    );
    setState(() => saving = true);
    try {
      await widget.onSave(report);
      if (mounted) Navigator.pop(context, report);
    } catch (e) {
      if (mounted) {
        message(
          context,
          'Não foi possível salvar. Seu formulário foi mantido; tente novamente.',
        );
      }
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Nova ocorrência')),
    body: SafeArea(
      child: Form(
        key: form,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Seu relato será salvo neste aparelho.',
                style: TextStyle(color: muted),
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<int>(
                isExpanded: true,
                initialValue: category,
                decoration: const InputDecoration(
                  labelText: 'Tipo de problema',
                ),
                items: List.generate(
                  categories.length,
                  (i) => DropdownMenuItem(value: i, child: Text(categories[i])),
                ),
                onChanged: (v) => setState(() => category = v!),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: title,
                maxLength: 100,
                decoration: const InputDecoration(labelText: 'Título'),
                validator: (v) => (v ?? '').trim().length < 3
                    ? 'Descreva o problema em pelo menos três caracteres.'
                    : null,
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: address,
                maxLength: 200,
                decoration: const InputDecoration(
                  labelText: 'Rua e referência',
                ),
                validator: (v) => (v ?? '').trim().isEmpty
                    ? 'Informe o endereço ou uma referência.'
                    : null,
                onChanged: (q) => setState(
                  () => suggestions = widget.catalog.search(
                    q,
                    widget.catalog.cityAt(point)?.id,
                  ),
                ),
              ),
              ...suggestions.map(
                (s) => ListTile(
                  dense: true,
                  title: Text(s.name),
                  subtitle: Text(widget.catalog.city(s.cityId).name),
                  onTap: () {
                    final p = widget.catalog.pointFor(s, point);
                    if (widget.catalog.cityAt(p) == null) return;
                    setState(() {
                      point = p;
                      address.text =
                          '${s.name} · ${widget.catalog.city(s.cityId).name}';
                      suggestions = [];
                    });
                    map.focus(p);
                  },
                ),
              ),
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: SizedBox(
                  height: 160,
                  child: CityMap(
                    catalog: widget.catalog,
                    reports: const [],
                    controller: map,
                    selected: point,
                  ),
                ),
              ),
              TextButton.icon(
                onPressed: () async {
                  final p = await Navigator.push<GeoPoint>(
                    context,
                    MaterialPageRoute(
                      builder: (_) =>
                          PointPicker(catalog: widget.catalog, initial: point),
                    ),
                  );
                  if (p != null && mounted) {
                    setState(() {
                      point = p;
                      address.text = widget.catalog.address(p);
                      suggestions = [];
                    });
                    map.focus(p);
                  }
                },
                icon: const Icon(Icons.edit_location_alt_outlined),
                label: const Text('Ajustar ponto no mapa'),
              ),
              const Text(
                'Editar apenas o texto de referência não altera o ponto.',
                style: TextStyle(color: muted, fontSize: 12),
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                isExpanded: true,
                initialValue: priority,
                decoration: const InputDecoration(
                  labelText: 'Prioridade percebida',
                ),
                items: priorities
                    .map((p) => DropdownMenuItem(value: p, child: Text(p)))
                    .toList(),
                onChanged: (p) => priority = p!,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: description,
                minLines: 3,
                maxLines: 6,
                maxLength: 1500,
                decoration: const InputDecoration(labelText: 'Descrição'),
                validator: (v) => (v ?? '').trim().length < 5
                    ? 'Descreva a situação em pelo menos cinco caracteres.'
                    : null,
              ),
              if (photo.isNotEmpty)
                Image.file(
                  File(photo),
                  height: 140,
                  fit: BoxFit.cover,
                  errorBuilder: (_, e, st) => const Text('Foto indisponível.'),
                ),
              OutlinedButton.icon(
                onPressed: picking ? null : choosePhoto,
                icon: const Icon(Icons.photo_library_outlined),
                label: Text(
                  photo.isEmpty ? 'Adicionar foto opcional' : 'Trocar foto',
                ),
              ),
              if (photo.isNotEmpty)
                TextButton(
                  onPressed: () => setState(() => photo = ''),
                  child: const Text('Remover foto'),
                ),
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: picking || saving ? null : submit,
                icon: const Icon(Icons.check),
                label: Text(saving ? 'Salvando…' : 'Salvar relato'),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
