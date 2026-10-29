import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  ShieldAlert,
  Send,
  HelpCircle,
  CheckCircle2
} from 'lucide-react';
import { Assignment } from '../types';
import { api } from '../services/api';
import { audioAlert } from '../utils/audioAlert';

interface ModalWithdrawalProps {
  assignment: Assignment;
  isExceptionMode?: boolean; // true se for exceção de PIN sem código
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export const ModalWithdrawal: React.FC<ModalWithdrawalProps> = ({
  assignment,
  isExceptionMode = false,
  onClose,
  onSuccess
}) => {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customNotes, setCustomNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reasonsWithdraw = [
    'Pneu furado ou pane mecânica na moto',
    'Chuva forte ou via bloqueada / alagamento',
    'Pizza danificada / tombada durante o trajeto',
    'Acidente de trânsito ou emergência pessoal',
    'Cliente ausente há mais de 10 minutos'
  ];

  const reasonsException = [
    'Cliente idoso ou sem acesso ao aplicativo no momento',
    'Bateria do celular do cliente descarregou',
    'Aplicativo do cliente travou ou sem sinal 4G',
    'Entrega recebida por terceiro autorizado no local'
  ];

  const reasons = isExceptionMode ? reasonsException : reasonsWithdraw;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = selectedReason === 'Outro' ? customNotes : selectedReason || customNotes;

    if (!finalReason.trim()) {
      setErrorMessage('Selecione ou descreva o motivo da solicitação.');
      audioAlert.playErrorSound();
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    audioAlert.playClickSound();

    try {
      const res = await api.requestWithdrawal(assignment.assignmentId, finalReason);
      audioAlert.playSuccessSound();
      onSuccess(res.message);
    } catch (err: any) {
      audioAlert.playErrorSound();
      setErrorMessage(err.message || 'Falha ao registrar solicitação com a loja.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={24} color={isExceptionMode ? 'var(--nw-purple)' : 'var(--nw-amber)'} />
            <h3 style={{ fontSize: '18px', fontWeight: 900 }}>
              {isExceptionMode ? 'Solicitar Liberação de PIN' : 'Solicitar Desistência à Loja'}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg-elevated)',
              border: 'none',
              color: 'var(--text-muted)',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Identificação do Pedido */}
        <div style={{ background: 'var(--bg-card)', padding: '12px 14px', borderRadius: '14px', marginBottom: '14px' }}>
          <strong style={{ color: '#ffffff', fontSize: '14px' }}>
            {assignment.orderNumber} — {assignment.customerName}
          </strong>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
            {assignment.address}, {assignment.addressNumber} ({assignment.neighborhood})
          </p>
        </div>

        {/* Alerta de Responsabilidade Física Obrigatório (Documento 02 v1.1) */}
        {!isExceptionMode && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid var(--nw-red)',
              borderRadius: '12px',
              padding: '12px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              marginBottom: '16px',
              fontSize: '12px',
              color: '#fca5a5'
            }}
          >
            <ShieldAlert size={18} color="var(--nw-red)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>
              <strong>Atenção:</strong> Ao solicitar desistência, o pedido <strong>permanece sob sua responsabilidade</strong> até que o gerente da Bella Pizza aprove no painel e autorize a devolução do item.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
              Selecione o Motivo:
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {reasons.map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => {
                    audioAlert.playClickSound();
                    setSelectedReason(r);
                  }}
                  style={{
                    background: selectedReason === r ? 'var(--nw-pink)' : 'var(--bg-card)',
                    color: selectedReason === r ? '#ffffff' : 'var(--text-main)',
                    border: '1px solid ' + (selectedReason === r ? 'var(--nw-pink)' : 'var(--border-subtle)'),
                    padding: '12px 14px',
                    borderRadius: '12px',
                    textAlign: 'left',
                    fontSize: '13px',
                    fontWeight: selectedReason === r ? 800 : 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
              Observações Adicionais para a Loja:
            </label>
            <textarea
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="Descreva detalhes adicionais caso necessário..."
              rows={3}
              style={{
                width: '100%',
                background: 'var(--bg-app)',
                border: '1px solid var(--border-strong)',
                borderRadius: '12px',
                color: '#ffffff',
                padding: '10px 12px',
                fontSize: '13px',
                outline: 'none',
                resize: 'none'
              }}
            />
          </div>

          {errorMessage && (
            <div style={{ color: 'var(--nw-red)', fontSize: '12px', fontWeight: 700 }}>
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className={`btn-glove ${isExceptionMode ? 'btn-glove-accent' : 'btn-glove-danger'}`}
            style={{ height: '58px', marginTop: '6px' }}
          >
            <Send size={18} />
            <span>
              {isSubmitting
                ? 'Enviando à loja...'
                : isExceptionMode
                ? 'Enviar Solicitação de Exceção'
                : 'Confirmar Solicitação de Desistência'}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};
