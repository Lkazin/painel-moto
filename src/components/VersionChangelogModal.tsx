import React from 'react';
import {
  X,
  Sparkles,
  Volume2,
  Vibrate,
  ShieldCheck,
  BatteryCharging,
  WifiOff,
  AlertTriangle,
  Copy,
  CheckCircle2
} from 'lucide-react';
import { audioAlert } from '../utils/audioAlert';

interface VersionChangelogModalProps {
  onClose: () => void;
}

export const VersionChangelogModal: React.FC<VersionChangelogModalProps> = ({ onClose }) => {
  const items = [
    {
      icon: <Volume2 size={20} color="var(--nw-pink)" />,
      title: 'Som Tecnológico como Padrão',
      desc: 'Novo som moderno de ofertas com opção de alternar entre Clássico, Suave e Tecnológico.'
    },
    {
      icon: <Vibrate size={20} color="var(--nw-purple)" />,
      title: 'Vibração Configurável',
      desc: 'Ative ou desative a vibração do aparelho ao receber pedidos, direto nas configurações.'
    },
    {
      icon: <ShieldCheck size={20} color="var(--nw-emerald)" />,
      title: 'Diagnóstico de GPS e Notificações',
      desc: 'Alerta visível se você estiver ligado mas sem permissão de GPS ou notificação ativa.'
    },
    {
      icon: <BatteryCharging size={20} color="var(--nw-amber)" />,
      title: 'Otimização de Bateria',
      desc: 'Guia para manter o GPS e notificações em segundo plano sem cortes do Android.'
    },
    {
      icon: <WifiOff size={20} color="#60a5fa" />,
      title: 'Modo Off-line Transparente',
      desc: 'Entregas gravadas no aparelho com status claro e botão de sincronização manual.'
    },
    {
      icon: <AlertTriangle size={20} color="var(--nw-amber)" />,
      title: 'Botão de Problema na Entrega',
      desc: 'Aviso rápido na tela de rota para acionar a loja se o cliente estiver ausente.'
    },
    {
      icon: <Copy size={20} color="var(--nw-pink)" />,
      title: 'Copiar e Compartilhar Extrato',
      desc: 'Envie o fechamento do turno para o WhatsApp da loja ou copie o texto em segundos.'
    },
    {
      icon: <CheckCircle2 size={20} color="var(--nw-emerald)" />,
      title: 'Ergonomia para Luva e Moto',
      desc: 'Botões operacionais ampliados para facilitar toques rápidos com luvas no suporte.'
    }
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          overflowY: 'auto'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={22} color="var(--nw-pink)" />
            <h3 style={{ fontSize: '18px', fontWeight: 900 }}>O que há de novo no app</h3>
          </div>
          <button
            type="button"
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

        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
          Confira as melhorias mais recentes pensadas para o seu dia a dia nas entregas:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {items.map((it, idx) => (
            <div
              key={idx}
              className="card-surface"
              style={{
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div style={{ flexShrink: 0, marginTop: '2px' }}>{it.icon}</div>
              <div>
                <strong style={{ fontSize: '14px', color: '#ffffff', display: 'block', marginBottom: '2px' }}>
                  {it.title}
                </strong>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                  {it.desc}
                </span>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            audioAlert.playClickSound();
            onClose();
          }}
          className="btn-glove btn-glove-accent"
          style={{ height: '52px', fontSize: '15px', marginTop: '6px' }}
        >
          Entendido • Continuar
        </button>
      </div>
    </div>
  );
};

