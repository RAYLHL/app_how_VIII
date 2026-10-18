# Verificação da entrega de 17 de outubro de 2026

- `flutter analyze`: sem problemas.
- `flutter test`: 19 testes aprovados (16 de domínio e 3 de widgets), inclusive na execução padrão sem configuração opcional de capturas.
- `flutter build apk --debug --target-platform android-arm64`: concluído.
- APK: `br.com.zelo.zelo_flutter`, versão 1.0.0+1, Android mínimo API 26, alvo API 36, arquitetura arm64-v8a.
- `apksigner verify --verbose`: assinatura APK v2 verificada.
- `zipalign -c -v 4`: Verification successful.
- Mapa, busca, acompanhamentos, detalhe e formulário renderizados nos testes Flutter e inspecionados visualmente.
- JSON cartográfico, atribuição e licença preservados byte a byte em relação à base Java de origem.
- Sem execução em aparelho ou emulador Android nesta entrega. GPS real, fotos, ciclo de vida e desempenho permanecem pendentes de validação.
- Relatos e apoios são locais; sem sincronização ou atendimento oficial.

SHA-256 do APK entregue: `9572aee7a4e8cec7cd401456339c50e66fd95745aeaee4574e48dba3e6f764f8`

Ambiente: Flutter 3.47.7, Dart 3.13.5, JDK 21 e SDK Android API 36.
O APK é de desenvolvimento, assinado com chave de teste. O projeto não inclui chaves privadas.
