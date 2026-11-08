# Atualizações dentro do aplicativo — 1.1.18 / código 20

## Fluxo para o entregador

1. O aplicativo consulta `https://painel-moto-three.vercel.app/downloads/latest.json`, inclusive antes do login. Não consulta o GitHub para descobrir ou baixar novas versões.
2. Ao encontrar build maior, exibe o aviso. Em **Baixar e atualizar**, o Android baixa o arquivo diretamente do site do app e a tela mostra o progresso.
3. O download é mantido pelo DownloadManager do Android e pode continuar com o aplicativo em segundo plano, conforme conexão e configurações do sistema.
4. O app confere tamanho, SHA-256, identificador, versão e certificado de assinatura antes de liberar **Instalar atualização**.
5. Ao tocar em instalar, o Android pode pedir autorização para instalar atualizações pelo NovaesWeb Entregador. Após autorizar, o usuário volta e toca novamente em instalar.
6. O instalador do Android pede confirmação. Não há instalação silenciosa nem desinstalação da versão anterior.

O toque na notificação abre o app e força a conferência da atualização. Não abre navegador nem inicia instalação automaticamente. Notificações continuam respeitando preferência, permissão, canal e verificação periódica.

## Primeira instalação desta mudança

É necessário instalar a 1.1.18 uma vez. APKs anteriores possuem o código antigo de download; publicar o site não altera o código já instalado. Após esta instalação, as próximas atualizações poderão ser baixadas pelo próprio aplicativo.

## Publicação das próximas versões

- Aumentar versionName e versionCode, preservar assinatura e gerar com `npm run android:apk`.
- Executar `npm run android:release-files`. Além dos arquivos locais de distribuição, esse comando prepara o APK e `release-downloads/release.json` para a hospedagem própria. Não sobrescreve um APK diferente mantendo a mesma versão e não permite rebaixar o manifesto.
- Incluir **o novo APK de release-downloads e release.json** no commit, junto com o código correspondente. Não enviar credenciais, chaves de assinatura ou arquivos locais privados.
- O build da Vercel executa `prepare-web-download.cjs`: confere o hash, mantém downloads antigos e publica o APK e `downloads/latest.json` juntos. O manifesto é servido sem cache persistente.
- Conferir o manifesto publicado, baixar o APK completo e comparar o hash. A release do GitHub é uma cópia adicional.
- Aguardar a autorização exigida pelo projeto antes de push/release de cada nova entrega.

## Verificação e limites

Testes cobrem manifesto, URLs externas, versões, hash/tamanho, download nativo, progresso, retomada de estado, cliques duplicados, resposta antiga, instalação somente por toque e publicação imutável. Os testes Java validam os valores aceitos pelo worker e downloader; a compilação verifica a integração Android.

Ainda é necessário testar em celular físico: download real pelo DownloadManager, permissão de instalação e atualização por cima preservando dados. Testes simulados e compilação não substituem essa validação. Bateria, internet e bloqueios do Android podem adiar notificações e downloads.
