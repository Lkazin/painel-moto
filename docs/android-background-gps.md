# GPS durante o uso do Waze — Android

O site/PWA mantém o GPS do navegador, que pode ser suspenso pelo celular. O projeto Android usa Capacitor e um serviço de localização com aviso persistente. Os dois utilizam as mesmas contas, permissões de entrega e endpoints existentes. Não cria outra base de dados.

## Gerar e instalar

É necessário Android Studio e Android SDK. Abra a pasta `android` no Android Studio, configure o SDK e execute `npm run android:sync`. Para abrir o projeto use `npm run android:open`. Para um APK local de teste no Windows, com Java configurado: `npm run android:apk`. O APK é gerado em `android/app/build/outputs/apk/debug/app-debug.apk`. Uma versão para distribuição precisa de assinatura própria; nenhum certificado ou senha está no Git.

Este projeto usa Capacitor 8: Node 22+, Android Studio 2025.2.1 ou superior, JDK 21 e Android SDK Platform 36. O Android Studio fornece seu próprio JDK; ao usar o terminal, configure `JAVA_HOME` para esse JDK. O projeto suporta Android 7/API 24 ou superior. Os requisitos estão documentados em https://capacitorjs.com/docs/updating/8-0 e https://capacitorjs.com/docs/getting-started/environment-setup.

O aplicativo inclui os arquivos do build local; mudanças publicadas no site não atualizam automaticamente um APK já instalado. Recrie e reinstale a versão para atualizar.

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
