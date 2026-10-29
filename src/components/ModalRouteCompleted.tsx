import React from 'react';
import {
  CheckCircle2,
  Package,
  TrendingUp,
  Clock,
  ArrowRight,
  ShieldAlert,
  Info,
  Sparkles
} from 'lucide-react';
import { audioAlert } from '../utils/audioAlert';

interface ModalRouteCompletedProps {
  completedOrdersCount: number;
  totalFeesInformed: number;
  hasUninformedFees: boolean;
  isAccessExpired: boolean;
  onReturnToHome: () => void;
  onViewHistory: () => void;
}

export const ModalRouteCompleted: React.FC<ModalRouteCompletedProps> = ({
  completedOrdersCount,
  totalFeesInformed,
  hasUninformedFees,
  isAccessExpired,
  onReturnToHome,
  onViewHistory
}) => {
  return (
    <div className="modal-overlay">
      <div
        className="modal-content"
        style={{
          borderTop: '4px solid var(--nw-emerald)',
          textAlign: 'center',
          padding: '28px 20px calc(28px + env(safe-area-inset-bottom, 16px))'
        }}
      >
        {/* Ícone de Sucesso */}
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '2px solid var(--nw-emerald)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 0 30px var(--nw-emerald-glow)'
          }}
        >
          <CheckCircle2 size={46} color="var(--nw-emerald)" strokeWidth={2.5} />
        </div>

        <span
          style={{
            background: 'rgba(16, 185, 129, 0.2)',
            color: 'var(--nw-emerald)',
            fontSize: '12px',
            fontWeight: 800,
            padding: '4px 12px',
            borderRadius: '20px',
            display: 'inline-block',
            marginBottom: '8px'
          }}
        >
          ROTA CONCLUÍDA COM SUCESSO
        </span>

        <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.5px' }}>
          Todas as Entregas Finalizadas!
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '320px', margin: '6px auto 0' }}>
          Parabéns! Todas as pizzas da sua rota foram entregues e validadas com o código PIN dos clientes.
        </p>

        {/* Cards de Resumo da Rota Finalizada */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', margin: '20px 0' }}>
          <div className="card-surface" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--nw-purple)' }}>
              <Package size={18} />
              <span style={{ fontSize: '12px', fontWeight: 700 }}>Entregas</span>
            </div>
            <span style={{ fontSize: '28px', fontWeight: 900, color: '#ffffff', marginTop: '4px', display: 'block' }}>
              {completedOrdersCount}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>100% validadas</span>
          </div>

          <div className="card-surface" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--nw-emerald)' }}>
              <TrendingUp size={18} />
              <span style={{ fontSize: '12px', fontWeight: 700 }}>Ganhos Inf.</span>
            </div>
            <span style={{ fontSize: '28px', fontWeight: 900, color: 'var(--nw-emerald)', marginTop: '4px', display: 'block' }}>
              R$ {totalFeesInformed.toFixed(2).replace('.', ',')}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {hasUninformedFees ? '*taxas parciais' : 'informado pela loja'}
            </span>
          </div>
        </div>

        {/* Aviso de Vencimento de Acesso pós-rota (Critério AC-25 do Documento 02) */}
        {isAccessExpired && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid var(--nw-red)',
              borderRadius: '14px',
              padding: '12px 14px',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              marginBottom: '16px',
              fontSize: '12px',
              color: '#fca5a5'
            }}
          >
            <ShieldAlert size={20} color="var(--nw-red)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ color: '#ffffff', display: 'block', marginBottom: '2px' }}>
                Aviso: Prazo do Vínculo Expirado
              </strong>
              <span>
                Seu código de acesso expirou durante o percurso desta rota. As entregas que você já havia assumido foram concluídas normalmente. Para receber novas corridas, solicite um novo código ao gerente da loja.
              </span>
            </div>
          </div>
        )}

        {/* Nota Legal Informativa */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            background: 'rgba(139, 92, 246, 0.08)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '10px 12px',
            fontSize: '11px',
            color: 'var(--text-subtle)',
            textAlign: 'left',
            marginBottom: '20px'
          }}
        >
          <Info size={16} color="var(--nw-purple)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            Os valores apresentados são estritamente informados no despacho pelo estabelecimento e não constituem comprovante de quitação financeira.
          </span>
        </div>

        {/* Botões Grandes para Suporte / Luva */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={() => {
              audioAlert.playClickSound();
              onReturnToHome();
            }}
            className="btn-glove btn-glove-primary"
            style={{ height: '62px', fontSize: '17px' }}
          >
            <span>Voltar à Tela Inicial</span>
            <ArrowRight size={20} />
          </button>

          <button
            onClick={() => {
              audioAlert.playClickSound();
              onViewHistory();
            }}
            className="btn-glove btn-glove-secondary"
            style={{ height: '52px', fontSize: '15px' }}
          >
            <span>Ver Histórico Completo do Turno</span>
          </button>
        </div>
      </div>
    </div>
  );
};
