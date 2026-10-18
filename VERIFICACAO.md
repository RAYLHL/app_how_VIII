# Verificação da versão React Native com mapa local

- TypeScript: sem erros.
- ESLint: sem erros.
- Oito testes automatizados aprovados, cobrindo geografia, persistência, ações concorrentes, temas, projeção, escala e movimento do mapa.
- Mapa desenhado com o catálogo local OpenStreetMap/IBGE e react-native-svg.
- Dependência react-native-maps, chave, plugin e configuração Google Maps removidos.

A auditoria npm apontou alertas em dependências transitivas do Expo/Metro. A revisão dessas dependências fica pendente antes de publicação; não foram forçadas versões fora da compatibilidade do SDK.
