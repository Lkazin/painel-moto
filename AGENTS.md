# Processo de Desenvolvimento — NovaesWeb Entregador

Atue como desenvolvedor responsável pelo aplicativo NovaesWeb Entregador. Siga este processo para corrigir, gerar e atualizar o aplicativo Android sem quebrar as funcionalidades existentes.

## 1. Projetos existentes

Aplicativo do motoboy:
- Pasta: `C:\Users\camil\Downloads\painel motoboy`
- GitHub: `https://github.com/Lkazin/painel-moto`
- Branch principal: `main`
- Site: `https://painel-moto-three.vercel.app/`

Backend e painel do lojista:
- Pasta: `C:\Users\camil\Downloads\entregado`
- GitHub: `https://github.com/Lkazin/entregado001`
- Branch principal: `main`
- Site: `https://entregado001-oe6y.vercel.app/`

Antes de trabalhar, leia `AGENTS.md`, `ANTIGRAVITY_ANDROID.md`, os scripts e o estado do Git. Confira as alterações locais antes de atualizar a pasta. Não apague nem sobrescreva trabalho de outra pessoa. Não use reset ou force push.

## 2. Estrutura do aplicativo

O aplicativo usa React, Vite e Capacitor, com os arquivos do site empacotados dentro do APK.

IMPORTANTE:
- Atualizar o GitHub ou a Vercel não atualiza os arquivos já instalados no celular.
- Alterações no frontend do aplicativo exigem gerar e instalar um novo APK.
- Alterações somente no backend podem funcionar sem novo APK, desde que mantenham compatibilidade.
- Não transforme o aplicativo em um simples navegador apontando para o site para contornar esse processo.

Preserve:
- Login, sessão única e primeiro acesso.
- Pedidos, aceite, retirada, confirmação e histórico.
- Rotas e integração com mapas.
- GPS em segundo plano durante entregas.
- Notificações Firebase.
- Perfil, extrato e verificação de atualizações.
- Separação entre os dados das lojas e das contas.

Corrija somente o necessário para a tarefa solicitada.

## 3. Identidade Android e assinatura

Não altere:
- Application ID: `br.com.novaesweb.entregador`
- Nome: `NovaesWeb Entregador`
- Projeto Firebase: `novaesweb-47551`

Certificado SHA-256 usado nas versões de teste existentes:

`11:3A:08:0F:B1:C9:AB:56:CB:9E:AC:4D:6F:E3:8B:3B:54:80:17:F1:77:4D:E8:18:B5:39:AB:EB:4C:8A:83:AB`

Preserve a chave de assinatura existente. Não gere outra chave, não troque o identificador e não peça para desinstalar o aplicativo para esconder incompatibilidade.

Essas versões usam assinatura Android Debug de teste. Se houver uma migração futura para assinatura de produção, trate isso como uma tarefa separada, com aprovação.

A impressão digital do certificado cadastrada no Firebase é diferente do SHA-256 do arquivo APK. O hash do arquivo muda a cada compilação.

## 4. Versão e compatibilidade das atualizações

A última versão publicada nesta entrega foi:
- Version name: `1.1.2`
- Version code: `4`
- Tag: `android-v1.1.2`
- Arquivo: `NovaesWeb-Entregador-v1.1.2-code4.apk`
- Commit: `2a67449b7b2236be940d0069e78d44a376f83260`

Antes da próxima publicação, consulte as releases reais no GitHub. Não assuma que essa informação continua sendo a mais recente.

Para uma nova versão:
1. Aumente `versionCode`.
2. Atualize `versionName`.
3. Faça isso em `android/app/build.gradle`.
4. Use uma nova tag e um novo nome de APK.

Se a versão mais recente ainda for 1.1.2/code4, a próxima correção poderá ser 1.1.3/code5.

Nunca:
- Mova uma tag já publicada para outro commit.
- Substitua um APK publicado mantendo a mesma versão.
- Renomeie um APK antigo para parecer uma versão nova.
- Publique um APK cujo manifesto interno não corresponda ao nome do arquivo.

## 5. Preparação e compilação

Inspecione `package.json` e os scripts antes de executar comandos.

Execute os testes pertinentes à alteração e a verificação TypeScript:

`npx tsc -b`

Para gerar o APK, use:

`npm run android:apk`

Esse comando usa o processo existente para:
- Selecionar Java 21.
- Compilar os arquivos do aplicativo.
- Preparar o backend oficial.
- Sincronizar o Capacitor.
- Compilar o APK Android.

O Java 21 portátil está em `.android-tools`. O SDK Android já está instalado no computador. Não instale ferramentas duplicadas nem troque configurações globais sem necessidade. Não use Java 25 neste processo.

O backend oficial do aplicativo é:

`https://entregado001-oe6y.vercel.app/api/v1/logistics`

A configuração local de desenvolvimento pode conter localhost. Não distribua um APK apontando para localhost. Use o script existente, que prepara a configuração Android correta.

Depois de concluir a compilação, execute:

`npm run android:release-files`

Esse comando verifica a versão real do APK e prepara:
- APK com nome de distribuição.
- Arquivo SHA-256.
- Notas da versão.

Os arquivos ficam em:

`.android-tools/releases/android-vVERSAO/`

Não execute a preparação de distribuição usando um APK antigo.

## 6. Conferência antes de publicar

Verifique:
- Application ID dentro do APK.
- Version name e version code dentro do APK.
- Assinatura com `apksigner`.
- Mesma assinatura das versões anteriores.
- Backend oficial no pacote.
- Ausência de credenciais privadas no pacote e no Git.
- Hash SHA-256 do APK final.
- Correspondência entre o código compilado e o commit que será publicado.

Se os arquivos do aplicativo mudarem depois da compilação, gere o APK novamente. Não publique um arquivo compilado antes da última alteração.

Não declare teste no celular se você só executou testes automatizados ou compilação.

## 7. Como publicar uma atualização

Antes de push, release ou deploy, informe:
- Repositório.
- Branch.
- Versão Android.
- Ambiente afetado.
- Resumo das alterações e testes.

Aguarde minha autorização explícita. Uma autorização anterior não vale automaticamente para todas as versões futuras.

Depois de autorizado:
1. Faça commit apenas dos arquivos pertinentes.
2. Envie para a branch autorizada.
3. Confirme o commit remoto.
4. Crie uma nova release com a tag correspondente.
5. Anexe o APK final e seu arquivo `.sha256`.
6. Confira o hash do anexo no GitHub.
7. Publique como release final, sem draft e sem prerelease.
8. Confirme o estado da publicação na Vercel quando houver atualização do site.
9. Entregue o link direto do APK.

O atualizador espera este padrão:

Tag:
`android-vX.Y.Z`

Arquivo:
`NovaesWeb-Entregador-vX.Y.Z-codeN.apk`

Exemplo:
`NovaesWeb-Entregador-v1.1.3-code5.apk`

Se utilizar um script existente de publicação, revise antes o repositório, a versão, o nome do arquivo e o hash esperado. Não execute um script antigo com valores de outra versão.

Nunca exponha tokens, senhas ou credenciais em comandos, logs, mensagens ou commits.

## 8. Funcionamento da atualização no celular

O aplicativo verifica releases públicas no GitHub e compara o version code com o aplicativo instalado.

A opção fica em:

**Extrato → Meu Perfil & Extrato → Atualizações do aplicativo**

Existe:
- Opção de verificar versões automaticamente.
- Botão para verificar manualmente.
- Aviso de nova versão.
- Botão “Baixar e atualizar”.

A verificação automática tem intervalo; o botão manual permite consultar imediatamente.

Não existe instalação silenciosa neste processo. O usuário baixa a atualização e confirma a instalação no Android.

Se o aplicativo instalado já for a versão mais recente, não deve aparecer aviso de nova versão.

A atualização deve ocorrer por cima do aplicativo existente, sem desinstalar e sem apagar dados.

## 9. Firebase e notificações

O aplicativo utiliza Firebase Cloud Messaging.

Preserve:
- `google-services.json` do aplicativo Android correto.
- Permissão real de notificações do Android.
- Canal `pedidos_entregas`.
- Registro do token no backend autenticado.
- Associação da inscrição à sessão vigente da conta.
- Bloqueio de envio após logout, expiração ou substituição da sessão.
- Remoção da inscrição ao desativar notificações.
- Abertura da área autenticada de pedidos ao tocar na notificação.

No backend, a variável privada é:

`FIREBASE_SERVICE_ACCOUNT`

Ela foi configurada como segredo na Vercel de produção do projeto `entregado001-oe6y`. Verifique sua existência quando necessário, sem revelar o valor.

O arquivo local `credentials/firebase-admin.json` é privado. Nunca coloque seu conteúdo no frontend ou no GitHub.

Não confunda:
- Permissão concedida.
- Token registrado.
- Mensagem aceita pelo Firebase.
- Notificação efetivamente recebida no celular.

São etapas diferentes. Confirme o que realmente foi testado.

## 10. GPS

Mantenha a preferência de localização após a autorização, respeitando a permissão real do Android.

Ao reabrir:
- Retome a obtenção da posição quando autorizado.
- Não inicie compartilhamento de uma entrega inexistente.
- Não compartilhe localização após logout ou sessão encerrada.
- Preserve o rastreamento em segundo plano durante entregas ativas.
- Não substitua a integração nativa por um temporizador JavaScript.

Teste, quando houver celular disponível:
- Uso com Waze aberto.
- Aplicativo em segundo plano.
- Tela bloqueada.
- Queda e retorno da internet.
- Finalização da entrega.
- Logout e sessão substituída.

Não prometa funcionamento contínuo sem considerar permissões e restrições de bateria do Android.

## 11. Histórico de entregas

Foi corrigida uma incompatibilidade entre os dados do backend e a tela de histórico.

Registros antigos podem enviar:
- `deliveryAddress` em vez de `address`.
- `deliveredAt` em vez de `completedAt`.
- Nenhum `confirmedVia`.

A função `normalizeDeliveryHistory` adapta esses dados e valida os valores.

Preserve:
- Valores ausentes como não informados.
- Confirmação desconhecida como “Confirmação não informada”.
- Identificação correta de confirmação pela loja e por PIN.
- Tratamento de erro com “Tentar novamente”.
- Proteção contra respostas recebidas depois de sair da tela.

Não invente PIN validado, data, horário ou valor para preencher campos ausentes.

## 12. Entrega final

Entregue um relatório curto contendo:
- O que foi corrigido.
- Arquivos principais alterados.
- Testes executados e resultados.
- Versão e assinatura do APK.
- Commit e release publicados, se autorizados.
- Link do APK.
- Pendências de teste real no celular.

Diferencie claramente:
- Código local.
- Código enviado ao GitHub.
- Site publicado.
- APK gerado.
- APK publicado.
- APK instalado e testado no celular.

Não diga que o aplicativo do usuário foi atualizado apenas porque o GitHub ou a Vercel foram atualizados.

