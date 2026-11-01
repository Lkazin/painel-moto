import { useEffect, useRef } from 'react';
import { FileText, HelpCircle, MessageCircle, Shield, X } from 'lucide-react';

export type AccountInformationPage = 'privacy' | 'terms' | 'support';
const WHATSAPP_URL = 'https://wa.me/5551991189293';
const titles = { privacy: 'Sua privacidade', terms: 'Termos de uso', support: 'Como podemos ajudar?' };
const descriptions = {
  privacy: 'Entenda quais informações o painel utiliza e como elas acompanham sua conta.',
  terms: 'As regras para cadastrar sua conta, conectar-se às lojas e registrar entregas.',
  support: 'Respostas rápidas para entrar na conta e continuar suas entregas.',
};

export function AccountInformationModal({ page, onClose }: { page: AccountInformationPage; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => { dialog?.close(); document.body.style.overflow = previousOverflow; opener?.focus(); };
  }, []);

  return (
    <dialog ref={dialogRef} className="nwl-info-dialog" aria-labelledby="account-info-title" aria-describedby="account-info-description"
      onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="nwl-info-shell">
        <header className="nwl-info-header">
          <div className="nwl-info-heading">
            <span className="nwl-info-icon" aria-hidden="true">{page === 'privacy' ? <Shield size={22} /> : page === 'terms' ? <FileText size={22} /> : <HelpCircle size={22} />}</span>
            <div><p className="nwl-info-eyebrow">NovaesWeb Entregador</p><h2 id="account-info-title">{titles[page]}</h2></div>
          </div>
          <button type="button" className="nwl-info-close" aria-label="Fechar informações" onClick={onClose}><X size={22} /></button>
        </header>
        <div className="nwl-info-body">
          <p id="account-info-description" className="nwl-info-intro">{descriptions[page]}</p>
          <p className="nwl-info-date">Atualizado em 1º de novembro de 2026</p>
          {page === 'privacy' && <>
            <section className="nwl-info-highlight"><h3>Uma conta que acompanha você</h3><p>Seu cadastro é armazenado no servidor para recuperar suas informações em outros aparelhos. Entrar em outro celular ou computador substitui a sessão anterior. Sair da conta não apaga seu cadastro nem seu histórico.</p></section>
            <section><h3>O que utilizamos e para quê</h3><p>Nome, telefone, placa e modelo do veículo identificam sua conta nas operações de entrega. Códigos de cadastro, vínculos com lojas, pedidos atribuídos, confirmações, justificativas e valores registrados permitem organizar o trabalho e conferir o histórico.</p><p>A senha não é guardada em texto simples. Identificadores de sessão, horários e registros técnicos de acesso, incluindo informações de rede, são utilizados para autenticação, prevenção de abuso e diagnóstico de falhas.</p></section>
            <section><h3>Localização durante as entregas</h3><p>Com a permissão do aparelho, o aplicativo pode enviar localização enquanto houver uma entrega ativa, inclusive aguardando retirada. As informações podem incluir coordenadas, horário, precisão, velocidade e direção, quando fornecidas pelo aparelho.</p><p>A loja utiliza esses dados para acompanhar a operação. O cliente com o link de acompanhamento pode visualizar informações da entrega, nome, placa e localização do entregador quando o rastreamento estiver disponível. A precisão e a atualização dependem de GPS, internet e permissões do aparelho.</p><p>Ao sair da conta ou ter a sessão desconectada, o aplicativo interrompe o envio de localização naquele acesso. Isso não apaga registros que já tenham sido enviados.</p></section>
            <section><h3>Armazenamento e compartilhamento</h3><p>O painel utiliza serviços de hospedagem e banco de dados em nuvem, inclusive infraestrutura fora do Brasil. Informações operacionais são disponibilizadas às lojas vinculadas e ao acompanhamento do pedido conforme a funcionalidade utilizada.</p><p>O navegador guarda informações necessárias para manter sua sessão, preferências e confirmações pendentes de envio. Em aparelhos compartilhados, saia da conta ao terminar. Não há exclusão automática do cadastro ou do histórico ao sair ou encerrar um vínculo.</p></section>
            <section><h3>Seus dados e suas solicitações</h3><p>Você pode solicitar informações sobre o tratamento dos seus dados, acesso, correção e, nas hipóteses previstas em lei, exclusão e outros direitos da LGPD. A solicitação pode exigir confirmação da sua identidade; registros sujeitos a conservação obrigatória não são necessariamente apagados imediatamente.</p><p>Para assuntos de cadastro e privacidade na NovaesWeb, use o WhatsApp oficial abaixo. Para informações de pedidos, repasses ou registros mantidos pelo estabelecimento, procure também a loja responsável.</p><p><a href="https://www.gov.br/mcti/pt-br/acesso-a-informacao/lei-geral-de-protecao-de-dados-pessoais-lgpd/direito-dos-titulares" target="_blank" rel="noopener noreferrer" style={{color: '#ffb3e0'}}>Conheça os direitos previstos na LGPD</a>.</p></section>
          </>}
          {page === 'terms' && <>
            <section className="nwl-info-highlight"><h3>Cadastro autorizado pela loja</h3><p>Para criar uma conta, solicite ao lojista um código de cadastro emitido para o seu telefone. Esse código possui prazo de validade e só pode ser utilizado uma vez. Ele autoriza o cadastro; não é uma confirmação do telefone por SMS.</p></section>
            <section><h3>Sua conta e o acesso por aparelho</h3><p>Informe dados corretos e utilize uma senha pessoal com pelo menos oito caracteres. Não compartilhe sua senha, códigos ou acesso. A mesma conta funciona no celular e no computador, com uma sessão autorizada por vez: o último login substitui o anterior.</p><p>O aparelho anterior recebe o aviso quando se comunica com o servidor. Sem internet, o aviso pode aparecer apenas ao reconectar. A recuperação automática de senha e a confirmação por SMS ainda não estão disponíveis.</p></section>
            <section><h3>Vínculos, plantões e histórico</h3><p>O código de cadastro é diferente do código de plantão da loja, no formato NW-XXXXXX. O lojista gerencia a validade e a situação desses vínculos e pode bloquear ou encerrar o acesso às operações da sua loja.</p><p>Para recuperar um histórico antigo, a loja precisa associar sua conta ao vínculo correspondente. Trocar de aparelho ou sair da conta não conclui entregas, não encerra automaticamente o plantão e não exclui o histórico.</p></section>
            <section><h3>Registro das entregas e conexão</h3><p>Confira os dados do pedido e registre cada etapa de acordo com a operação realizada. Solicite o PIN do cliente quando exigido. Se houver uma opção de exceção no aplicativo, utilize-a apenas na situação correspondente e informe a justificativa solicitada.</p><p>Uma confirmação guardada sem internet permanece pendente até ser validada pelo servidor. Ela não equivale a uma entrega confirmada. Pendências de uma sessão substituída não são reenviadas usando o acesso de outro aparelho.</p></section>
            <section><h3>Valores e uso responsável</h3><p>Taxas e condições de repasse devem ser conferidas com o estabelecimento. O painel registra valores operacionais e não realiza o pagamento automaticamente.</p><p>Utilize os dados dos clientes apenas para executar a entrega. Não compartilhe informações de pedidos, não acesse contas de terceiros e não tente contornar autorizações. Configure o aplicativo com o veículo parado e respeite as regras de trânsito.</p></section>
          </>}
          {page === 'support' && <div className="nwl-info-faq">
            <details open><summary>É meu primeiro acesso. Como faço?</summary><p>Peça ao lojista um código de cadastro para o seu telefone. Toque em “Criar conta”, preencha seus dados, informe o código e escolha sua senha. Para iniciar o plantão, use o código da loja quando solicitado.</p></details>
            <details><summary>Posso usar no celular e no computador?</summary><p>Sim. Entre com o mesmo telefone e senha. Suas informações são recuperadas do servidor e o acesso anterior é desconectado. Você não precisa criar outra conta.</p></details>
            <details><summary>Meu histórico antigo não apareceu</summary><p>Peça ao lojista para usar “Associar conta cadastrada” no vínculo antigo. Confira o telefone da sua conta com ele e atualize o aplicativo após a associação. Não crie contas duplicadas para tentar recuperar as entregas.</p></details>
            <details><summary>O código não funciona ou expirou</summary><p>Confira se está usando o código de cadastro ou o de plantão no campo correto. O código de cadastro deve corresponder ao seu telefone. Se estiver usado, revogado ou expirado, peça outro à loja. Após muitas tentativas, aguarde 15 minutos antes de tentar novamente.</p></details>
            <details><summary>Esqueci a senha ou meu acesso foi desconectado</summary><p>A recuperação automática de senha ainda não está disponível. Fale com o suporte oficial para orientação. Se houve acesso em outro aparelho, entre novamente apenas se você reconhecer essa troca. Nunca envie sua senha, PIN de cliente ou chave de acesso ao suporte.</p></details>
            <details><summary>Uma entrega ficou pendente sem internet</summary><p>Reconecte o mesmo aparelho e mantenha sua sessão para que a confirmação possa ser validada. Confira o resultado antes de considerar a entrega concluída. Se você entrou em outro aparelho, fale com a loja para conferir a pendência.</p></details>
            <details><summary>Com quem falo sobre pedidos e repasses?</summary><p>Fale diretamente com o responsável pela loja sobre códigos de plantão, despacho, entrega, valores e repasses. Para falhas no aplicativo ou solicitações sobre seus dados na NovaesWeb, utilize o contato abaixo.</p></details>
          </div>}
          <aside className="nwl-info-contact"><h3>{page === 'privacy' ? 'Contato para privacidade' : 'Suporte oficial NovaesWeb'}</h3><p>WhatsApp: (51) 99118-9293</p><a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} aria-hidden="true" /> Conversar no WhatsApp</a></aside>
        </div>
        <footer className="nwl-info-footer"><button type="button" onClick={onClose}>Voltar ao {page === 'support' ? 'aplicativo' : 'cadastro ou login'}</button></footer>
      </div>
    </dialog>
  );
}
