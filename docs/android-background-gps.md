# GPS durante o uso do Waze — Android

O site/PWA mantém o GPS do navegador, que pode ser suspenso pelo celular. O projeto Android usa Capacitor e um serviço de localização com aviso persistente. Os dois utilizam as mesmas contas, permissões de entrega e endpoints existentes. Não cria outra base de dados.

## Gerar e instalar

É necessário Android Studio e Android SDK. Abra a pasta `android` no Android Studio, configure o SDK e execute `npm run android:sync`. Para abrir o projeto use `npm run android:open`. Para um APK local de teste no Windows, com Java configurado: `npm run android:apk`. O APK é gerado em `android/app/build/outputs/apk/debug/app-debug.apk`. Uma versão para distribuição precisa de assinatura própria; nenhum certificado ou senha está no Git.

Este projeto usa Capacitor 8: Node 22+, Android Studio 2025.2.1 ou superior, JDK 21 e Android SDK Platform 36. O Android Studio fornece seu próprio JDK; ao usar o terminal, configure `JAVA_HOME` para esse JDK. O projeto suporta Android 7/API 24 ou superior. Os requisitos estão documentados em https://capacitorjs.com/docs/updating/8-0 e https://capacitorjs.com/docs/getting-started/environment-setup.

O aplicativo inclui os arquivos do build local; mudanças publicadas no site não atualizam automaticamente um APK já instalado. Recrie e reinstale a versão para atualizar.

## Aviso de nova versão

A versão Android 1.1.0 (versionCode 2) inclui o verificador de atualizações. O primeiro APK 1.0 não tem esse verificador: quem já o instalou precisa instalar 1.1.0 manualmente uma vez. A partir dela, o aplicativo pode avisar quando encontrar uma versão Android pública mais recente no repositório oficial `Lkazin/painel-moto`.

Os avisos dependem de uma GitHub Release pública real, final e não marcada como prévia. O padrão de distribuição é tag `android-v1.1.0` e arquivo `NovaesWeb-Entregador-v1.1.0-code2.apk` para esta versão. O verificador compara o versionCode instalado e somente oferece uma versão maior. Não há atualização silenciosa: o entregador escolhe baixar e o Android pede confirmação para instalar.

`android/app/build.gradle` é a fonte única de versionName/versionCode. Aumente o versionCode ao preparar uma nova versão distribuível; não incremente automaticamente a cada compilação. Para atualizar por cima, preserve o applicationId e a mesma chave de assinatura. O APK de teste usa a chave Android Debug deste computador; publicar para distribuição definitiva exige escolher e guardar uma chave própria. Trocar a chave impede atualizar por cima dos APKs de teste existentes.

Depois de `npm run android:apk`, execute `node scripts/prepare-android-release.cjs` para validar os metadados compilados e o manifesto real do APK com `aapt`, e preparar uma cópia do APK, notas e SHA256 em `.android-tools/releases/android-v1.1.0/`. O script interrompe se o APK estiver com identidade, variante ou versão diferente do Gradle, mesmo que um arquivo JSON ao lado dele informe outra versão. Não coloque um APK em `public/` nem nos assets Android: isso aumentaria o próximo APK e poderia embutir cópias recursivas.

Preparar os arquivos localmente não publica a versão nem ativa avisos nos aparelhos. Publicar o APK em uma GitHub Release continua exigindo autorização explícita do proprietário. Sem release publicada, o aplicativo não inventa link de atualização. Falta de conexão ou erro do GitHub não bloqueia entregas nem encerra a conta.

`android:sync` e `android:apk` usam o backend público HTTPS da loja, independentemente de um `.env` local apontar para `localhost`. Para outra loja, informe `ANDROID_LOGISTICS_API_URL` com o endereço HTTPS público autorizado. O script rejeita loopback/HTTP e confere o bundle antes de copiar para o Android. A configuração de desenvolvimento do site é preservada.

No Windows, `android:apk` procura JDK 21 em `ANDROID_JAVA_HOME`, `JAVA_HOME`, na pasta local ignorada `.android-tools`, em `.jdks` ou no Android Studio. Uma versão do Android Studio com Java 25 precisa de JDK 21 separado para este Gradle; não é necessário alterar o Java do sistema. A pasta `.android-tools` e `android/local.properties` permanecem fora do Git.

## Uso e limites

- Permitir localização precisa e notificações. O aviso permanente informa quando o GPS está sendo usado.
- O serviço começa quando existe entrega retirada/em andamento, e termina sem entregas ativas ou ao sair da conta.
- Abrir Waze não encerra o serviço. Não forçar parada do aplicativo; o Android interrompe serviços quando o usuário força a parada. Restrições de bateria específicas do fabricante também podem interromper o processo.
- HTTP nativo evita a limitação de rede do WebView em segundo plano. Sem internet não há movimento ao vivo; na reconexão é enviada uma posição nova, sem reproduzir coordenadas antigas como atuais.
- O backend continua validando sessão e entrega; o APK não contém chave privada do Supabase.

## Validação física necessária

1. Entrar, aceitar e retirar um pedido de teste autorizado; confirmar posição no cliente e lojista.
2. Abrir Waze e percorrer um trecho por mais de cinco minutos; verificar novas posições e horários no cliente.
3. Bloquear a tela e repetir. Testar internet desligada/ligada e permissão negada.
4. Finalizar uma entrega com outra ainda ativa: GPS continua para a entrega restante. Encerrar todas: aviso e envio param.
5. Sair da conta e acessar em outro aparelho: a sessão antiga não consegue continuar compartilhando.

Sem teste em aparelho não se considera o funcionamento em segundo plano validado. Este projeto prepara Android; não gera aplicativo iOS.

Referências: https://github.com/capacitor-community/background-geolocation e https://capacitorjs.com/docs/apis/http.
