# 📍 Zelo

### Cuidar da cidade começa com você.

Um aplicativo para registrar, localizar e acompanhar problemas urbanos em **Navegantes, Itajaí e Balneário Camboriú**.

## Sobre o projeto

Uma lâmpada apagada, um buraco na rua ou uma calçada danificada fazem parte do cotidiano de muitos moradores. Comunicar esses problemas e acompanhar o que acontece depois nem sempre é simples.

O **Zelo** propõe reunir essas informações em uma experiência centrada no mapa. Cada ocorrência pode ser registrada com localização, descrição, categoria, prioridade e fotografia, facilitando a identificação das demandas da cidade.

O projeto nasceu de uma proposta sobre iluminação pública desenvolvida pela equipe no **HOW IV**, no segundo semestre da graduação. No **HOW VIII**, a ideia foi ampliada para contemplar diferentes necessidades de zeladoria urbana.

## 🗺️ Explore sua cidade

Na tela inicial, você pode pesquisar ruas e selecionar a cidade e a categoria que deseja visualizar.

Os ícones ajudam a reconhecer o tipo de ocorrência diretamente no mapa. Ao selecionar um registro, é possível consultar sua descrição, situação e histórico, além de manifestar apoio ou acompanhá-lo.

A navegação está organizada em três áreas:

| Área | O que você encontra |
| --- | --- |
| **Mapa** | Ocorrências, pesquisa de ruas, filtros e acesso ao cadastro. |
| **Perto de mim** | Relatos em um raio de 1, 3 ou 5 km da posição obtida pelo aplicativo. |
| **Acompanhando** | Ocorrências que você escolheu acompanhar e seus novos relatos. |

## 📝 Registre uma ocorrência

1. Selecione uma das cidades atendidas.
2. Toque em **Escolher ponto no mapa**.
3. Busque uma rua ou mova o mapa até o pin indicar o local desejado.
4. Confirme o ponto e escolha a categoria.
5. Preencha o título, a referência, a descrição e a prioridade.
6. Adicione uma fotografia, se desejar, e salve.

**Você não precisa estar no local para criar um relato.** A seleção manual permite indicar um ponto dentro da área atendida sem utilizar o GPS do aparelho.

## 💡 Categorias

O Zelo reúne nove categorias de ocorrências:

| Categoria | Exemplos |
| --- | --- |
| 💡 **Iluminação pública** | Lâmpadas apagadas ou iluminação intermitente. |
| ⚠️ **Buraco na via** | Buracos, desníveis e danos no pavimento. |
| 🗑️ **Entulho** | Resíduos de obras e descarte irregular. |
| 🚶 **Calçada** | Piso danificado ou passagem obstruída. |
| 🚦 **Sinalização** | Placas danificadas e faixas apagadas. |
| 🚧 **Obra parada** | Intervenções aparentemente interrompidas. |
| 🌊 **Alagamento** | Acúmulo de água e dificuldades de escoamento. |
| 💧 **Esgoto a céu aberto** | Vazamentos aparentes e escoamento irregular. |
| ⋯ **Outros** | Situações que não se enquadram nas demais categorias. |

*Os símbolos desta tabela são ilustrativos. No aplicativo, cada categoria possui seu próprio ícone.*

## 🎨 Uma interface para diferentes momentos

Escolha entre os temas **claro**, **escuro** ou **automático**, que acompanha a configuração do aparelho.

As cores dos marcadores indicam a prioridade informada no relato:

- 🔵 **Azul:** baixa.
- 🟠 **Âmbar:** média.
- 🔴 **Vermelho:** alta.
- 🟢 **Verde:** ocorrência concluída.

A prioridade representa a percepção de quem registra a ocorrência.

## 📍 Cobertura

O aplicativo contempla três municípios de Santa Catarina:

**Navegantes · Itajaí · Balneário Camboriú**

O mapa utiliza um catálogo local de ruas do **OpenStreetMap** e limites municipais do **IBGE**, permitindo consultar a base cartográfica sem depender de um serviço de mapas online.

## 🤝 Apoie e acompanhe

Você pode manifestar apoio a uma ocorrência e adicioná-la à aba **Acompanhando** para encontrá-la novamente.

A proposta é incentivar a participação dos moradores e organizar informações que, em uma etapa futura, possam apoiar a comunicação com os responsáveis pela manutenção urbana.

## 🚀 Conheça o protótipo

A versão atual é um **protótipo acadêmico para Android**. Ela inclui **108 ocorrências fictícias**, distribuídas pelas três cidades, para demonstrar os recursos do aplicativo. Esses registros estão identificados como exemplos.

Os relatos, fotos, apoios e acompanhamentos ficam armazenados no aparelho. Nesta etapa, **não há compartilhamento entre usuários nem envio de ocorrências às prefeituras**.

A continuidade do projeto prevê avaliação com usuários, sincronização de dados e integração com gestores municipais.

## 🛠️ Tecnologias e organização

O Zelo utiliza **React Native**, **TypeScript** e **Expo** para construir a interface Android e integrar os recursos do aparelho. As regras dos relatos, os dados geográficos e os serviços do dispositivo ficam separados para facilitar a manutenção e a evolução do projeto.

| Tecnologia | Aplicação no projeto |
| --- | --- |
| **React Native e React** | Interface móvel, componentes e interação com o usuário. |
| **TypeScript** | Tipagem, regras de negócio e organização dos fluxos. |
| **Expo e Expo Router** | Integrações nativas e estrutura de entrada da aplicação. |
| **react-native-svg** | Desenho do mapa vetorial offline. |
| **Expo Location** | Localização do aparelho em primeiro plano, quando solicitada. |
| **Expo ImagePicker** | Seleção de fotografias para os relatos. |
| **Expo FileSystem** | Armazenamento privado dos relatos, fotos e preferências. |
| **Material Icons** | Ícones das categorias e dos controles da interface. |
| **Node.js test runner e tsx** | Execução dos testes automatizados de domínio. |
| **TypeScript e ESLint** | Verificação de tipos e análise estática do código. |

### Organização do código

```text
Zelo-Flutter/
├── src/
│   ├── app/                 # Telas, navegação e formulários
│   ├── components/          # Mapa vetorial, marcadores e gestos
│   ├── domain/              # Geografia, catálogo e regras dos relatos
│   ├── services/            # Localização, fotos e persistência
│   └── theme.ts             # Paletas dos temas claro e escuro
├── assets/                  # Ícone e dados cartográficos locais
├── android/                 # Estrutura nativa para compilação Android
├── tests/                   # Testes automatizados de domínio
├── app.config.ts            # Configuração da aplicação Expo
└── package.json             # Dependências e comandos do projeto
```

A pasta local mantém o nome `Zelo-Flutter`, mas a implementação atual utiliza React Native.

## ✅ Verificação e testes

A qualidade do código é acompanhada por verificações de tipos, análise estática e testes automatizados. Para executá-los, instale as dependências e utilize os comandos abaixo na raiz do projeto:

```bash
npm ci
npm run typecheck
npm run lint
npm test
```

| Comando | O que verifica |
| --- | --- |
| `npm run typecheck` | Consistência dos tipos TypeScript. |
| `npm run lint` | Problemas identificados pelas regras de análise estática. |
| `npm test` | Comportamentos das regras de domínio com entradas controladas. |

A suíte atual contém **nove testes automatizados**, abrangendo:

- Limites municipais, ruas e posicionamento dos exemplos nas três cidades.
- Tratamento de bordas e áreas internas excluídas dos polígonos.
- Rejeição de posições de GPS antigas ou imprecisas.
- Apoio e acompanhamento concorrentes, recarga e falhas de gravação.
- Preservação de dados inválidos, sem substituição silenciosa por exemplos.
- Busca por proximidade, ordenação por distância e preferência de tema.
- Conversão entre coordenadas geográficas e posições no mapa.
- Sentido dos movimentos e limites de escala e região do mapa.
- Distribuição dos 108 exemplos e atualização da base sem apagar relatos pessoais.

Esses testes verificam regras do software e utilizam armazenamento simulado. A avaliação em aparelhos e com usuários complementa essa etapa, especialmente para permissões, GPS, seleção de fotos, desempenho, navegação e restauração dos dados após encerrar o aplicativo.

## 🎓 Equipe

Desenvolvido por:

- **Erick Lucas Martins**
- **Rayltson Henrique Lemes**
- **Yan Victor dos Santos Rocha**

**Análise e Desenvolvimento de Sistemas**  
Universidade do Vale do Itajaí — **UNIVALI**  
Projeto **HOW VIII — Hands on Work**

## Créditos

Dados de ruas: **OpenStreetMap contributors**, sob licença ODbL 1.0.  
Limites municipais: **Instituto Brasileiro de Geografia e Estatística — IBGE**.
