# Zelo — React Native

Protótipo acadêmico do HOW VIII (UNIVALI), a partir da proposta de iluminação pública desenvolvida no HOW IV, Hands on Work. Relatos de manutenção urbana em Navegantes, Itajaí e Balneário Camboriú.

## Executar no Android

Requisitos: Node.js 22.13 ou superior, Android Studio com SDK, emulador aberto e Java 17 ou superior (recomendado: JDK do Android Studio). Abra esta pasta no VS Code.

```sh
npm install
npm run android
```

O segundo comando gera o projeto nativo, compila e instala o novo **Zelo, com ícone azul**. Na primeira compilação, o Gradle poderá baixar o NDK 27.1.12297006, CMake e outros componentes Android. Aceite as licenças pelo SDK Manager se solicitado.

Com o aplicativo instalado, para continuar editando:

```sh
npm start
```

Deixe o terminal aberto e abra o Zelo com ícone azul no emulador. Se reiniciar o emulador, use `npm run android` para restabelecer a conexão de desenvolvimento. Mudanças em TypeScript atualizam pela recarga do Metro. Mudanças em dependências nativas exigem `npm run android` novamente. Se o SDK não for encontrado, configure `ANDROID_HOME` para `$HOME/Library/Android/sdk`.

## Mapa local, sem chave de API

O mapa anterior foi adaptado para React Native. Ele desenha os dados locais de ruas OpenStreetMap e limites municipais do IBGE, com `react-native-svg`. Funciona offline, sem serviços de mapas pagos, sem chave de API e sem cadastro no Google Cloud.

O visual se inspira no Google Maps: fundo neutro, água azul, ruas claras, contornos suaves, vias principais destacadas e nomes das ruas. O tema escuro usa superfícies em cinza, textos claros e água azul escura. O conteúdo é o catálogo local das três cidades; não há dados de trânsito, imagens de satélite nem catálogo atualizado de estabelecimentos.

- Arraste para mover o mapa; use dois dedos ou os botões `+` e `−` para o zoom.
- **Escolher ponto no mapa**: selecione a cidade, busque uma rua ou arraste o mapa até o pin central. Confirme o ponto e complete o relato. Não exige localização do aparelho.
- Segure um ponto no mapa principal para iniciar a seleção manual.
- **GPS**: opcional; solicita somente localização em primeiro plano. Se estiver fora da região, escolha manualmente um ponto em uma das três cidades.
- **Tema**: claro, escuro ou acompanhar o sistema. A escolha é salva no aparelho.

Os marcadores usam ícones de lâmpada, alerta, lixeira, pedestre, semáforo, construção, inundação, gota e mais opções. A cor indica prioridade: azul baixa, âmbar média e vermelho alta; verde indica conclusão.

## Relatos e dados

Fotos, relatos, apoios e acompanhamento ficam neste aparelho. Exemplos fictícios estão identificados. Não há autenticação, sincronização entre aparelhos, envio à prefeitura ou acompanhamento oficial.

**Perto de mim** usa uma posição obtida sob solicitação, com horário exibido e raio de 1, 3 ou 5 km. Atualize a posição ao mudar de local. O endereço sugerido pelo catálogo deve ser conferido no formulário.

A instalação usa o pacote `br.com.zelo.reactnative` e pode coexistir com a versão anterior. Dados salvos pela versão anterior não são importados automaticamente.

## Estrutura

- `src/app/`: navegação Expo Router e interface React Native.
- `src/components/LocalMap.tsx`: desenho do mapa local, marcadores e gestos.
- `src/domain/`: limites municipais, ruas, projeção e regras dos relatos.
- `src/services/device.ts`: persistência, localização e seleção de fotos.
- `src/theme.ts`: paleta clara e escura.
- `app.config.ts`: configuração nativa gerada pelo Expo.
- `assets/`: catálogo local, com atribuições e licenças em `NOTICE.txt` e `ODbL-1.0.txt`.
- `licenses/`: licença do template Expo utilizado na estrutura inicial.

## Verificação

```sh
npm run typecheck
npm run lint
npm test
```

Os testes cobrem limites, buracos em polígonos, ruas, exemplos, precisão e validade temporal do GPS, raio de busca, gravação com falha, ações simultâneas, projeção e movimento do mapa.

## Conexão do modo de desenvolvimento

Se aparecer `Unable to load script`, mantenha o Metro aberto e execute no macOS:

```sh
"$HOME/Library/Android/sdk/platform-tools/adb" reverse tcp:8081 tcp:8081
```

No menu de desenvolvimento do aplicativo, em **Change Bundle Location**, use `localhost:8081` e aplique. Em versões recentes do Android, permita a conexão local solicitada para o modo de desenvolvimento. O mapa em si usa dados locais.
