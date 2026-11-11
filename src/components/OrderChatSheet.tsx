import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { realtimeWatcher } from '../services/realtimeWatcher';
import { OrderChatMessage } from '../types';
import './OrderChatSheet.css';

interface OrderChatSheetProps {
  orderId: string;
  orderLabel?: string;
  onClose: () => void;
}

/**
 * Chat do pedido no app do entregador.
 *
 * Fala com a loja sobre UM pedido — o mesmo histórico que o painel da loja lê.
 * Atualiza pelo tempo real (aviso da loja) e, como rede de segurança, a cada 30s.
 * O envio é otimista: a mensagem aparece na hora e é confirmada pelo servidor.
 */
export const OrderChatSheet: React.FC<OrderChatSheetProps> = ({ orderId, orderLabel, onClose }) => {
  const [messages, setMessages] = useState<OrderChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async (markRead = false) => {
    try {
      const data = await api.getOrderChat(orderId, markRead);
      setMessages(data.messages);
      setError('');
    } catch (loadError: any) {
      setError(loadError?.message || 'Não foi possível carregar a conversa.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load(true);
    const unsubscribe = realtimeWatcher.onUpdate(() => { void load(false); });
    const interval = setInterval(() => { void load(false); }, 30_000);
    return () => { unsubscribe(); clearInterval(interval); };
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const send = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setError('');
    const optimistic: OrderChatMessage = {
      id: `local-${Date.now()}`,
      author: 'entregador',
      authorName: 'Você',
      text: value,
      createdAt: new Date().toISOString(),
      read: false,
    };
    setMessages(current => [...current, optimistic]);
    setText('');
    try {
      const data = await api.sendOrderChatMessage(orderId, value);
      setMessages(data.messages);
    } catch (sendError: any) {
      setMessages(current => current.filter(message => message.id !== optimistic.id));
      setText(value);
      setError(sendError?.message || 'Mensagem não enviada. Tente novamente.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="order-chat-backdrop" role="dialog" aria-modal="true" aria-label="Conversa com a loja">
      <section className="order-chat">
        <header className="order-chat__header">
          <div>
            <p className="order-chat__eyebrow"><MessageCircle size={14} /> Conversa com a loja</p>
            <h2>{orderLabel ? `Pedido ${orderLabel}` : 'Pedido'}</h2>
          </div>
          <button type="button" className="order-chat__close" onClick={onClose} aria-label="Fechar conversa">
            <X size={18} />
          </button>
        </header>

        <div className="order-chat__body">
          {loading && <p className="order-chat__hint"><Loader2 size={16} className="spin" /> Carregando…</p>}
          {!loading && messages.length === 0 && (
            <p className="order-chat__hint">Nenhuma mensagem ainda. Escreva para a loja se precisar de algo sobre esta entrega.</p>
          )}
          {messages.map(message => (
            <article key={message.id} className={`order-chat__bubble order-chat__bubble--${message.author === 'entregador' ? 'mine' : 'theirs'}`}>
              <p className="order-chat__author">{message.author === 'entregador' ? 'Você' : message.authorName || 'Loja'}</p>
              <p className="order-chat__text">{message.text}</p>
              <time dateTime={message.createdAt}>
                {new Date(message.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </time>
            </article>
          ))}
          <div ref={endRef} />
        </div>

        {error && <p className="order-chat__error" role="alert"><AlertCircle size={14} /> {error}</p>}

        <form
          className="order-chat__form"
          onSubmit={event => { event.preventDefault(); void send(); }}
        >
          <input
            value={text}
            onChange={event => setText(event.target.value)}
            maxLength={500}
            placeholder="Escreva para a loja"
            aria-label="Mensagem para a loja"
          />
          <button type="submit" disabled={!text.trim() || sending} aria-label="Enviar mensagem">
            {sending ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
          </button>
        </form>
      </section>
    </div>
  );
};
