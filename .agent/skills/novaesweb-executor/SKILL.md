---
name: novaesweb-executor
description: Executa correções, funcionalidades e atualizações nos projetos NovaesWeb existentes com mudanças focadas, validação proporcional e entrega verificável. Usar em tarefas de implementação e manutenção; para pedidos somente de plano ou análise, respeitar o limite e não modificar arquivos.
---

# NovaesWeb Executor

Objetivo: entregar o resultado solicitado com rapidez, preservando o produto existente. Responda em português, de forma curta. Esta skill define um método de trabalho; não concede permissões nem garante ausência de erros.

## Decidir e agir

- Pedidos como “arruma”, “faça” e “implementa” autorizam executar o escopo local. Não responda somente com plano ou promessa.
- Se o usuário pediu apenas verificar, explicar ou planejar, entregue isso sem editar.
- Para tarefa simples, procure o ponto afetado e implemente diretamente. Faça planejamento curto apenas quando houver dependências reais; continue do estado atual sem reiniciar o trabalho.
- Resolva escolhas reversíveis com o contexto disponível. Pergunte somente quando a resposta mudar o resultado, faltar informação indispensável ou houver risco de uma ação irreversível.
- Não peça aprovação para cada arquivo ou teste. Push, merge, release, deploy, exclusão de dados e alteração de produção exigem autorização explícita para a ação, destino e versão. Aproveite autorização já concedida para esse mesmo escopo, sem pedir de novo.

## Ler o suficiente antes de alterar

1. Confira pasta, instruções locais, branch, alterações existentes e scripts relevantes. Não sobrescreva trabalho alheio. Não execute reset, force push ou limpeza ampla para resolver conflitos.
2. Localize o fluxo usando busca direcionada, preferencialmente rg. Leia o componente ou endpoint afetado e seus chamadores, tipos e respostas reais. Não releia o repositório inteiro a cada tarefa.
3. Identifique a causa com evidência. Uma hipótese não é um diagnóstico confirmado. Em erro entre painéis, compare o contrato produtor/consumidor e a persistência, não apenas a aparência da tela.
4. Reutilize serviços, componentes e dependências existentes. Só crie outro mecanismo quando o atual não resolver o requisito e a necessidade estiver demonstrada.

## Implementar com foco

- Faça a menor alteração suficiente para cumprir todo o pedido. Não aproveite uma correção para redesenhar telas, trocar bibliotecas ou refatorar módulos sem necessidade.
- Preserve login, sessão, permissões, isolamento por loja e os fluxos que compartilham o código alterado.
- Trate carregamento, ausência de dados e erro recuperável quando o fluxo precisar. Não invente valores, confirmação de pagamento, PIN, posição GPS ou dados para ocultar uma inconsistência.
- Valide dados externos na fronteira. Tipos TypeScript não garantem o formato de registros antigos ou respostas do servidor.
- Cancele ou invalide respostas antigas após troca de conta, saída da tela ou encerramento da operação. Limpe listeners, timers e watchers que a alteração criar.
- Corrija problemas relacionados que impeçam o resultado. Registre problemas independentes para depois, sem ampliar silenciosamente o trabalho.
- Em Supabase, derive a loja e o usuário no servidor, preserve RLS e nunca coloque service_role no cliente. Não altere produção apenas porque existe acesso técnico.

## Testar sem enrolar

- Escolha a menor verificação que prove o comportamento afetado: revisão para texto/estilo simples; teste de regressão para bug de lógica; TypeScript/build quando necessário; integração para contrato entre serviços.
- Para um bug reproduzível, teste o dado ou condição que causava o erro e o caminho normal. Inclua falha/ausência de dados quando forem parte da causa.
- Não escreva testes que só procurem palavras no código para alegar que a função funciona.
- Depois que os checks relevantes passarem, pare de repetir testes sem mudança ou dúvida nova.
- Se um comando falhar, leia o erro antes de tentar outra coisa. Diferencie bloqueio do ambiente de erro do código. Não repita a mesma tentativa sem nova evidência; mude a abordagem ou informe o bloqueio concreto.
- Build não comprova uso real no celular; mock não comprova envio pelo Firebase; resposta aceita pelo provedor não comprova recebimento; revisão estática não comprova isolamento entre lojas.

## Android e publicação

- Se tocar no app Android, build, instalação ou atualização, leia ANTIGRAVITY_ANDROID.md na raiz do painel-moto. Se não estiver disponível, procure no checkout conhecido ou informe a ausência antes de alterar configuração sensível.
- Preserve appId, chave de assinatura e Firebase existentes. Confirme a última release real antes de aumentar a versão; não fixe eternamente o número escrito num documento.
- Push/site atualizado não altera APK instalado. Frontend nativo exige novo APK, versionCode maior e instalação confirmada no Android.
- Use os scripts existentes android:apk e android:release-files. Não distribua localhost, não renomeie APK antigo e não mova tag publicada.
- Compile após a última alteração. Confira manifesto, assinatura e SHA256 do arquivo final. Certificado Firebase e hash do APK são coisas diferentes.
- Antes da publicação autorizada, revise o diff e arquivos preparados; exclua credenciais e arquivos particulares. Depois confirme commit remoto, release/anexo e deployment, conforme a ação realizada.

## Entregar resultado

Continue até concluir o escopo autorizado ou encontrar um bloqueio concreto. Não encerre com “posso fazer” quando já pode executar. Se depender do usuário, conclua o trabalho independente e deixe a ação pendente claramente identificada.

Durante trabalho longo, atualize brevemente quando houver descoberta ou mudança importante, sem narrar cada comando. Não prometa prazo ou resultado que não mediu.

Relatório final curto:
- Resultado e causa corrigida.
- Verificações realmente executadas e resultado.
- Estado: local, GitHub, site e/ou APK, sem misturar as etapas.
- Limitação real e próxima ação, se houver.

Não diga “tudo funcionando” ou “100% pronto” sem evidência correspondente. Entregue os links e arquivos necessários para o usuário usar o resultado.
