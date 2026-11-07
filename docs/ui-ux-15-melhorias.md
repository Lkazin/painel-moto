# Interface do entregador — 15 melhorias locais

Melhorias preparadas para a versão Android 1.1.14 (código 16), sobre a versão 1.1.13. A geração do APK não atualiza o aplicativo já instalado; é preciso baixar e confirmar a instalação no Android.

| # | Melhoria | Comportamento implementado |
|---|---|---|
| 1 | Início adaptativo | Próxima ação muda conforme rota, retirada, conexão e disponibilidade. |
| 2 | Barra flutuante | Rota, contato e confirmação por PIN acessíveis acima da navegação. |
| 3 | Cartões expansíveis | Itens e detalhes da entrega podem ser consultados sem abandonar a tela. |
| 4 | Painel inferior | Navegação, contato e detalhes em painel com Escape, controle de foco, rolagem e fechamento por arraste. |
| 5 | Ações por deslize | Deslizar cartões da rota revela atalhos. Botões equivalentes funcionam sem gesto. O gesto não confirma entregas. |
| 6 | Modo entrega | Endereço ampliado e informações essenciais. Pode ser ativado na tela ou definido como preferência inicial. |
| 7 | Prévia da rota | Sequência por endereços e prévia geográfica quando o cálculo fornece ao menos duas coordenadas válidas. A ligação entre pontos é identificada como ilustrativa; não representa ruas ou trajeto viário. |
| 8 | Números animados | Métricas animam apenas mudanças dos valores recebidos. Leitores de tela recebem o valor final; movimento reduzido elimina a animação. |
| 9 | Resposta tátil | Padrões de seleção, sucesso e atenção, com preferência para desativar. Depende do suporte do aparelho. |
| 10 | Transição conectada | Cartão da rota e destino da entrega compartilham a transição nos navegadores compatíveis. Há alternativa sem animação. |
| 11 | Estados vazios úteis | Orientações para ausência de pedidos, endereço ou telefone e ações disponíveis conforme o contexto. |
| 12 | Indicador de conexão | Internet, GPS e fila em painel compacto. Distingue captura de GPS, envio confirmado, pendências e falhas. |
| 13 | Desfazer | Restaura somente a alteração local de sequência, antes de salvar. Alterações relevantes no polling invalidam o snapshot. |
| 14 | Leitura na rua | Superfícies sólidas, bordas com maior contraste e botões maiores. Texto ampliado é uma opção separada. |
| 15 | Personalização com prévia | Tema, texto, leitura na rua, foco e movimento são experimentados antes de salvar. Som e vibração também têm testar, salvar e descartar. |

## Onde encontrar as preferências

Extrato → configurações de experiência → **Do seu jeito** e **Som e vibração de novos pedidos**. Preferências são locais ao aparelho e não alteram dados da conta ou da loja.

## Verificação executada

- 142 testes automatizados aprovados, incluindo login, ofertas, retirada, rastreamento, atualizações, fila offline, preferências, prévia sonora, tela de entrega e reordenação com desfazer.
- TypeScript e compilação de produção aprovados. O lint terminou sem erros, com avisos. A compilação sinalizou um bloco JavaScript acima de 500 kB minificado.
- Verificação no Chromium local com dados fictícios, em larguras de 390 e 320 pixels. Testados painel inferior, Escape, retenção de foco, gesto de fechamento simulado, modo entrega, prévia/salvamento de aparência e som, reordenação/desfazer, atalhos por gesto simulado, transição da rota para entrega, estado vazio e conexão offline.
- Nenhum pedido real foi criado, atualizado ou enviado durante a validação visual.

## Limites

Sem teste em aparelho: vibração física, leitura sob sol, GPS em segundo plano, acessibilidade por leitor de tela e desempenho em celulares precisam de validação real. Transições dependem do navegador e respeitam a opção de reduzir movimento. A prévia geográfica exige coordenadas do cálculo; sem elas a interface mostra os endereços, sem inventar pontos no mapa.
