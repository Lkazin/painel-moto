# Correção de download — 1.1.17 / código 19

O erro informado foi HTTP 504 no download da 1.1.16, antes da instalação. O endereço público do GitHub também retornou 504 no diagnóstico. O APK local da 1.1.16 corresponde ao digest publicado, tem versão interna e assinatura compatíveis; esses dados não apontam para erro de assinatura ou troca do identificador.

## Mudanças

- O botão de atualização mantém a validação rígida do endereço canônico oficial, mas gera uma URL de abertura com `download=1` e identificador novo por tentativa, para renovar o redirecionamento do GitHub.
- O aviso de erro orienta voltar ao aplicativo e tentar o download novamente se o navegador apresentar 504.
- A notificação do Android abre uma Activity privada. Só no momento do toque ela valida novamente a versão e cria o endereço renovado; nenhum endereço temporário da CDN é salvo.
- A Activity não abre APK de versão igual ou anterior à instalada, e não modifica sessão, GPS ou entregas.
- A release 1.1.16 e suas tags não são sobrescritas. A correção usa 1.1.17/código 19 e a mesma assinatura.

## Verificação

162 testes JavaScript aprovados. Cinco testes JUnit aprovados, incluindo o caminho nativo de renovação de link e rejeição de versões já instaladas. Compilação web e Android aprovadas. Sem teste de instalação em aparelho físico.

Renovar o endereço não elimina uma indisponibilidade do GitHub ou da conexão. A confirmação do download completo e da integridade deve ser feita também depois da publicação da nova versão.
