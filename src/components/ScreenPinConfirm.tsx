import React, { useState } from 'react';
import {
  KeyRound,
  Delete,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ShieldAlert,
  Clock,
  WifiOff,
  HelpCircle
} from 'lucide-react';
import { Assignment } from '../types';
import { api } from '../services/api';
import { audioAlert } from '../utils/audioAlert';
import { offlineQueue } from '../services/offlineQueue';

interface ScreenPinConfirmProps {
  assignment: Assignment;
  onBack: () => void;
  onDeliverySuccess: (message: string, isOfflinePending?: boolean) => void;
  onRequestException: (assignment: Assignment) => void;
}

export const ScreenPinConfirm: React.FC<ScreenPinConfirmProps> = ({
  assignment,
  onBack,
  onDeliverySuccess,
  onRequestException
}) => {
  const [pin, setPin] = useState<string>('');
  const [attempts, setAttempts] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [showForceModal, setShowForceModal] = useState<boolean>(false);
  const [isForcing, setIsForcing] = useState<boolean>(false);

  const isOnline = offlineQueue.getIsOnline();

  const handleKeyPress = (num: string) => {
    if (isValidating) return;
    audioAlert.playClickSound();

    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      setErrorMessage(null);

      // Auto submissão ao completar o 4º dígito
      if (nextPin.length === 4) {
        submitPin(nextPin);
      }
    }
  };

  const handleDelete = () => {
    if (isValidating || pin.length === 0) return;
    audioAlert.playClickSound();
    setPin(pin.slice(0, -1));
    setErrorMessage(null);
  };

  const handleClear = () => {
    if (isValidating) return;
    audioAlert.playClickSound();
    setPin('');
    setErrorMessage(null);
  };

  const submitPin = async (codeToSubmit: string) => {
    setIsValidating(true);
    setErrorMessage(null);

    try {
      const result = await api.confirmDelivery(assignment.assignmentId, codeToSubmit);
      audioAlert.playSuccessSound();
      onDeliverySuccess(result.message, result.isOfflinePending);
    } catch (err: any) {
      audioAlert.playErrorSound();
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setPin('');
      setErrorMessage(err.message || 'Código PIN incorreto.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleForceDelivery = async () => {
    setIsForcing(true);
    setErrorMessage(null);
    try {
      const result = await api.confirmDelivery(
        assignment.assignmentId,
        'SEM_PIN',
        assignment.deliveryFee,
        true,
        'Entrega concluída sob termo de responsabilidade pelo motoboy'
      );
      audioAlert.playSuccessSound();
      setShowForceModal(false);
      onDeliverySuccess(result.message, result.isOfflinePending);
    } catch (err: any) {
      audioAlert.playErrorSound();
      setErrorMessage(err.message || 'Falha ao forçar conclusão.');
      setShowForceModal(false);
    } finally {
      setIsForcing(false);
    }
  };

  return (
    <div style={{ padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Botão Superior Voltar */}
      <button
        onClick={onBack}
        disabled={isValidating}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '13px',
          fontWeight: 700,
          cursor: 'pointer',
          padding: '4px 0'
        }}
      >
        <ArrowLeft size={18} />
        <span>Voltar para Detalhes</span>
      </button>

      {/* Header do PIN */}
      <div style={{ textAlign: 'center' }}>
        <span
          style={{
            background: 'rgba(236, 72, 153, 0.15)',
            color: 'var(--nw-pink)',
            border: '1px solid var(--border-strong)',
            fontSize: '12px',
            fontWeight: 800,
            padding: '4px 12px',
            borderRadius: '20px',
            display: 'inline-block',
            marginBottom: '8px'
          }}
        >
          {assignment.orderNumber} • {assignment.customerName}
        </span>
        <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#ffffff' }}>
          Código de Confirmação
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '340px', margin: '4px auto 0', lineHeight: 1.35 }}>
          Digite os <strong style={{ color: '#fff' }}>4 dígitos do PIN</strong>, ou os <strong style={{ color: '#fff' }}>4 finais do celular</strong> do cliente, ou o <strong style={{ color: '#fff' }}>número do pedido</strong>.
        </p>
      </div>

      {/* Indicador de Status de Conectividade */}
      {!isOnline && (
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid var(--nw-amber)',
            borderRadius: '12px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#fef08a',
            fontSize: '12px',
            fontWeight: 700
          }}
        >
          <WifiOff size={18} color="var(--nw-amber)" style={{ flexShrink: 0 }} />
          <span>
            Modo sem internet: o PIN será validado e enviado à loja assim que a conexão retornar.
          </span>
        </div>
      )}

      {/* 4 Caixas de Dígitos */}
      <div className="pin-slots">
        {[0, 1, 2, 3].map((idx) => {
          const char = pin[idx];
          return (
            <div key={idx} className={`pin-slot ${char ? 'filled' : ''}`}>
              {char || '•'}
            </div>
          );
        })}
      </div>

      {/* Mensagem de Erro / Limite de Tentativas */}
      {errorMessage && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid var(--nw-red)',
            borderRadius: '12px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#fca5a5',
            fontSize: '13px',
            fontWeight: 700
          }}
        >
          <AlertCircle size={20} color="var(--nw-red)" style={{ flexShrink: 0 }} />
          <span>{errorMessage} (Tentativa {attempts} de 5)</span>
        </div>
      )}

      {/* Teclado Numérico Gigante para Uso com Luva */}
      <div className="glove-keypad-grid">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            onClick={() => handleKeyPress(digit)}
            disabled={isValidating}
            className="keypad-key"
          >
            {digit}
          </button>
        ))}

        <button
          onClick={handleClear}
          disabled={isValidating || pin.length === 0}
          className="keypad-key keypad-key-action"
        >
          LIMPAR
        </button>

        <button
          onClick={() => handleKeyPress('0')}
          disabled={isValidating}
          className="keypad-key"
        >
          0
        </button>

        <button
          onClick={handleDelete}
          disabled={isValidating || pin.length === 0}
          className="keypad-key keypad-key-action"
          aria-label="Apagar dígito"
        >
          <Delete size={26} />
        </button>
      </div>

      {/* Opções de Resolução de Entrega */}
      <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          onClick={() => {
            audioAlert.playClickSound();
            setShowForceModal(true);
          }}
          disabled={isValidating}
          style={{
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.45)',
            color: '#fbbf24',
            borderRadius: '12px',
            padding: '12px 14px',
            fontSize: '13px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          <ShieldAlert size={18} color="#fbbf24" style={{ flexShrink: 0 }} />
          <span>Cliente sem código? Forçar Entrega (Assumir Responsabilidade)</span>
        </button>

        <div style={{ textAlign: 'center', marginTop: '2px' }}>
          <button
            onClick={() => onRequestException(assignment)}
            disabled={isValidating}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-subtle)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              textDecoration: 'underline'
            }}
          >
            <HelpCircle size={15} />
            <span>Outro problema? Notificar a loja</span>
          </button>
        </div>
      </div>

      {/* Modal: Termo de Responsabilidade do Entregador */}
      {showForceModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => {
            if (!isForcing) setShowForceModal(false);
          }}
        >
          <div
            style={{
              backgroundColor: '#18181b',
              border: '2px solid #d97706',
              borderRadius: '20px',
              maxWidth: '440px',
              width: '100%',
              padding: '24px',
              color: '#ffffff',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fbbf24', marginBottom: '14px' }}>
              <ShieldAlert size={28} color="#fbbf24" />
              <h3 style={{ fontSize: '18px', fontWeight: 900, margin: 0 }}>
                Termo de Responsabilidade
              </h3>
            </div>

            <p style={{ fontSize: '14px', lineHeight: 1.5, color: '#e4e4e7', marginBottom: '14px' }}>
              Você está concluindo o <strong style={{ color: '#ffffff' }}>Pedido #{assignment.orderNumber}</strong> para <strong style={{ color: '#ffffff' }}>{assignment.customerName}</strong> sem a digitação do código do cliente.
            </p>

            <div
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: '12px',
                padding: '14px',
                fontSize: '12px',
                color: '#fef3c7',
                lineHeight: 1.45,
                marginBottom: '20px'
              }}
            >
              ⚠️ <strong>Declaração de Entrega Realizada:</strong> Ao confirmar, você atesta sob sua inteira responsabilidade que esteve no endereço e entregou a pizza nas mãos do cliente ou responsável. Esta ação ficará gravada com seu nome e horário exato no painel de controle da pizzaria.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={handleForceDelivery}
                disabled={isForcing}
                style={{
                  height: '52px',
                  backgroundColor: '#d97706',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: 900,
                  cursor: isForcing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(217, 119, 6, 0.4)'
                }}
              >
                {isForcing ? (
                  <>
                    <Clock size={18} className="animate-spin" />
                    <span>Registrando Entrega...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    <span>Assumir Responsabilidade e Concluir</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowForceModal(false)}
                disabled={isForcing}
                style={{
                  height: '44px',
                  backgroundColor: '#27272a',
                  color: '#d4d4d8',
                  border: '1px solid #3f3f46',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Voltar e Digitar Código
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
