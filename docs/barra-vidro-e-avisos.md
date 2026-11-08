# Barra de vidro e avisos de atualização — Android 1.1.15

Versão Android 1.1.15 (código 17). Instalar o APK é necessário para receber os novos componentes nativos; publicar o site não altera o aplicativo já instalado.

## Interface

- Barra inferior flutuante com transparência, desfoque, bordas com reflexos e bolha em relevo que acompanha a aba selecionada.
- Início, Pedidos, Minha Rota e Histórico preservam os destinos e os contadores reais.
- Modos claro/escuro, rótulos sempre visíveis, suporte a movimento reduzido e alternativa sólida no modo de leitura na rua.
- A barra de ações da entrega fica acima da navegação, sem sobreposição.
- O aviso de atualização fica no topo, em fluxo normal, sem cobrir a confirmação por PIN ou as ações da entrega. Permite baixar, adiar e tentar novamente se o download falhar.

## Aviso na área de notificações do Android

- Canal separado: **Atualizações do aplicativo** (`atualizacoes_aplicativo`). Não modifica o canal de pedidos.
- Reutiliza a permissão de notificações já concedida. Solicitação de permissão só acontece quando o usuário toca em permitir, nas configurações do app.
- Quando a verificação automática e o aviso no celular estão habilitados, o Android pode consultar a publicação pública do GitHub em segundo plano a cada seis horas, conforme conexão e disponibilidade.
- Também emite o aviso quando o app aberto encontra uma versão válida mais nova. O mesmo build não gera avisos repetidos.
- Ao tocar, abre somente o endereço do APK do repositório oficial. O usuário confirma a instalação no Android. O aviso orienta concluir as entregas antes de atualizar.
- Desativar a verificação automática ou o aviso no celular cancela a tarefa periódica e o aviso atual.
- A consulta de versões não utiliza conta, senha, token, loja, pedidos, clientes ou localização. O acesso ao GitHub é anônimo.

## Limites importantes

O recurso de segundo plano exige instalar **este novo APK e abrir o app ao menos uma vez**. Versões antigas não passam a ter um worker nativo apenas porque uma versão foi publicada. Não há envio instantâneo de campanha push para todos os aparelhos.

A verificação de seis horas não é um horário garantido: falta de internet, Doze, economia de bateria, configurações do fabricante e encerramento forçado podem adiar ou impedir o trabalho. Permissão do app e canal de atualização precisam estar habilitados. O app explica como conferir esses bloqueios.

## Verificação

- 158 testes JavaScript aprovados, incluindo navegação, avisos, permissões, cancelamento, concorrência de permissões e preservação dos fluxos existentes.
- Quatro testes JUnit aprovados nos validadores Java reais: endereço de download, versão, build, identificador da release e data de publicação.
- TypeScript, compilação web e compilação Java Android aprovados. Permanecem avisos de lint e de tamanho do pacote JavaScript.
- Verificação visual no Chromium em 390 e 320 pixels, com dados fictícios, conferindo quatro abas, contadores, painel de atualização, dock e modo rua.
- Recebimento na área de notificações e execução com o app fechado ainda precisam de teste em aparelho físico. Nenhum celular conectado durante esta etapa.

Referência oficial: [trabalho periódico no Android](https://developer.android.com/develop/background-work/background-tasks/persistent/getting-started/define-work).
