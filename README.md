# Zelo em Flutter para Android

Portabilidade da versão Android Java do Zelo encontrada no chat **Criar app colaborativo de zeladoria**, de 12/10/2026. A interface, o mapa e as regras de domínio foram escritos em Dart/Flutter. O código Java restante é uma ponte pequena para localização, seletor de imagens e armazenamento Android.

## Funcionalidades

- Interface escura com destaque verde, voltada ao celular Android.
- Mapa vetorial offline com deslocamento, pinça, zoom, seleção de ponto e marcadores.
- Área atendida: **Navegantes, Itajaí e Balneário Camboriú**, validada por polígonos municipais.
- Base real embarcada: 12.807 trechos e 3.178 pares de nome de rua/município (784, 1.652 e 742, respectivamente).
- Sugestões de ruas a partir de dois caracteres, até oito opções, sem distinguir acentos; no formulário, restritas à cidade do ponto escolhido.
- Localização atual sob demanda, com pedido de permissão, limite de 20 segundos, validade de 30 segundos e precisão de até 100 metros. Sem localização válida, escolha manual no mapa.
- Nove categorias: iluminação pública, buraco na via, entulho, calçada, sinalização, obra parada, alagamento, esgoto a céu aberto e outros.
- Cadastro com referência, descrição, prioridade percebida, foto opcional e identificador.
- Fotos copiadas para a pasta privada do aplicativo, até 20 MB por imagem. Fotos removidas de um rascunho podem permanecer como arquivos sem referência até a limpeza dos dados do app.
- Abas **Mapa**, **Perto de mim** (1, 3 e 5 km em linha reta) e **Acompanhando**.
- Apoio, acompanhamento e histórico locais. Cadastro passa a ser acompanhado automaticamente.
- Gravações serializadas e confirmação somente após persistência; falha de gravação mantém o formulário.
- Dados corrompidos geram aviso; não são substituídos silenciosamente pelos exemplos.

## Experimentar e compilar

Projeto criado e verificado com **Flutter 3.47.7 / Dart 3.13.5**, JDK 21, Android API 36 e Gradle Wrapper incluído. Android mínimo: 8.0 / API 26.

```sh
flutter pub get
flutter analyze
flutter test
flutter run
flutter build apk --debug --target-platform android-arm64
```

Abra esta pasta no Android Studio ou VS Code com Flutter instalado. Configure o SDK Android e JDK 21 na sua máquina. O `pubspec.lock` fixa as dependências resolvidas. Não há dependências de plugins externos para mapas, GPS, fotos ou persistência; os recursos de dispositivo são expostos por `MethodChannel`.

O APK de desenvolvimento ARM64 fica em `build/app/outputs/flutter-apk/app-debug.apk`. A assinatura de desenvolvimento permite experimentar, mas não é uma assinatura de distribuição. Não há publicação na Play Store. Consulte `VERIFICACAO.md` para a situação exata do build desta entrega.

## O que ainda não existe

É um **protótipo funcional local**. Não há servidor, Firebase configurado, contas, sincronização entre moradores, autenticação de prefeituras, moderação, respostas oficiais ou notificações push. Os apoios não são votos compartilhados entre usuários. A prioridade é declarada pelo morador, sem algoritmo de urgência. A proposta futura prevê uso gratuito pelos moradores e adesão municipal; não há contratação ou cobrança no app.

Os nove registros iniciais são fictícios e marcados **EXEMPLO**. Novos registros são marcados **LOCAL**. O aplicativo não encaminha demandas à prefeitura. O painel administrativo da primeira versão web não foi reintroduzido: a migração preserva a última versão Android focada no mapa.

O pacote Flutter usa identidade Android e armazenamento próprios. Instala ao lado da versão Java e **não importa automaticamente seus relatos locais**. Mantenha a instalação anterior se precisar dos dados. Não foi aplicado um procedimento de migração de dados pessoais entre aplicativos.

Limpar dados ou desinstalar remove relatos e fotografias privados desta versão. O backup automático Android está desativado. A versão principal não pede internet nem rastreia localização em segundo plano; os manifests debug/profile permitem a conexão das ferramentas Flutter durante desenvolvimento.

## Organização

- `lib/main.dart`: telas, navegação, cadastro e detalhe.
- `lib/map_view.dart`: mapa vetorial Flutter com CustomPainter.
- `lib/geo.dart`: distâncias, polígonos e projeção sobre ruas.
- `lib/catalog.dart`: leitura do catálogo e sugestões de endereços.
- `lib/reports.dart`: registros, validação e persistência transacional local.
- `lib/platform.dart`: contrato de localização, foto e armazenamento Android.
- `android/.../MainActivity.java`: implementação do canal Android.
- `android/.../CurrentLocation.java`: aquisição limitada de posição, reaproveitada da versão Java.
- `test/`: testes de regras e widgets.
- `assets/`: dados cartográficos, atribuição e licença ODbL.

## Verificações e limites

A suíte verifica geometria com a base real, rejeição de municípios vizinhos, busca por acentos, sugestões por município, distâncias e raios, validade da posição, persistência, falhas de disco, mudanças concorrentes, dados corrompidos, formulário e interações. Os testes de widgets usam dimensões de celular. A ponte Android foi compilada no build, mas ainda precisa de execução em aparelho/emulador.

Não há evidência de que toda a implementação Java original tenha seguido TDD. Nesta portabilidade foram adicionadas verificações automatizadas dos comportamentos migrados. Os próximos incrementos podem seguir ciclos TDD de teste inicialmente reprovado, implementação e refatoração.

Ainda é necessário testar em dispositivo: GPS real, permissões negadas/aproximadas, seletor de fotos, teclado, botão Voltar, retomada do processo e desempenho do mapa. O rascunho é mantido durante erros de gravação na tela aberta, mas não possui restauração garantida após encerramento do processo Android. Não houve avaliação com moradores ou integração municipal.

A base geográfica foi copiada sem alterações da versão anterior. Pode estar incompleta ou desatualizada. Os limites municipais são simplificados e não substituem levantamento de precisão. Não há geocodificação de números de imóveis.

## Fontes e licenças

Ruas: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Preserve `assets/NOTICE.txt` e `assets/ODbL-1.0.txt` ao redistribuir os dados derivados. Os registros dos moradores são armazenados separadamente.

Limites: [API de malhas IBGE](https://servicodados.ibge.gov.br/api/docs/malhas?versao=3), municípios 4211306, 4208203 e 4202008. A extração e a documentação de origem encontram-se na versão Java anterior.

Implementação: [canais de plataforma Flutter](https://docs.flutter.dev/platform-integration/platform-channels) e [testes unitários Flutter](https://docs.flutter.dev/cookbook/testing/unit/introduction).

## Reconstruir a base cartográfica

`tools/build_catalog.py` foi preservado da versão Java. Requer Python, osmium e shapely, um extrato OSM e os três GeoJSON municipais IBGE. Execute passando como terceiro argumento a pasta `assets` deste projeto. A reconstrução não é necessária para compilar o app; os dados já estão embarcados.
