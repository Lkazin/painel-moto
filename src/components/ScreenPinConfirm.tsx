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
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '300px', margin: '4px auto 0' }}>
          Peça ao cliente os 4 dígitos exibidos no aplicativo dele ao entregar a pizza.
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

      {/* Solicitar Exceção à Pizzaria */}
      <div style={{ marginTop: '6px', textAlign: 'center' }}>
        <button
          onClick={() => onRequestException(assignment)}
          disabled={isValidating}
          style={{
            background: 'none',
            border: 'none',
            color: '#c084fc',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            textDecoration: 'underline'
          }}
        >
          <HelpCircle size={16} />
          <span>Cliente sem celular ou sem código? Solicitar exceção à loja</span>
        </button>
      </div>
    </div>
  );
};
