import React, { useState, useEffect } from 'react';
import {
  Bell,
  BellOff,
  BellRing,
  CheckCircle,
  AlertTriangle,
  Smartphone,
  Send,
  Loader2,
  Info
} from 'lucide-react';
import { pushService, PushPermissionStatus } from '../services/pushService';
import { audioAlert } from '../utils/audioAlert';

interface SectionPushNotificationsProps {
  onShowToast?: (text: string, type: 'success' | 'error' | 'info') => void;
}

export const SectionPushNotifications: React.FC<SectionPushNotificationsProps> = ({ onShowToast }) => {
  const [permission, setPermission] = useState<PushPermissionStatus>(pushService.getPermissionStatus());
  const [hasSubscription, setHasSubscription] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);

  const checkStatus = async () => {
    const currentPerm = pushService.getPermissionStatus();
    setPermission(currentPerm);
    if (currentPerm === 'granted') {
      const sub = await pushService.getExistingSubscription();
      setHasSubscription(Boolean(sub));
    } else {
      setHasSubscription(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleActivate = async () => {
    audioAlert.playClickSound();
    setLoading(true);

    try {
      const result = await pushService.subscribe();
      await checkStatus();

      if (result.success) {
        audioAlert.playSuccessSound();
        if (onShowToast) {
          onShowToast('Notificações de entregas ativadas com sucesso!', 'success');
        }
      } else {
        audioAlert.playErrorSound();
        if (onShowToast) {
          onShowToast(result.error || 'Não foi possível ativar as notificações.', 'error');
        }
      }
    } catch (err: any) {
      audioAlert.playErrorSound();
      if (onShowToast) {
        onShowToast(err?.message || 'Falha ao configurar notificações.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    audioAlert.playClickSound();
    setLoading(true);

    try {
      await pushService.unsubscribe();
      await checkStatus();
      if (onShowToast) {
        onShowToast('Notificações push desativadas.', 'info');
      }
    } catch {
      if (onShowToast) {
        onShowToast('Erro ao desativar notificações.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    audioAlert.playClickSound();
    setTesting(true);

    try {
      const result = await pushService.sendTestPush();
      if (result.success) {
        audioAlert.playSuccessSound();
        if (onShowToast) {
          onShowToast('Notificação de teste enviada! Verifique a barra de notificações.', 'success');
        }
      } else {
        audioAlert.playErrorSound();
        if (onShowToast) {
          onShowToast(result.message || 'Falha ao disparar teste.', 'error');
        }
      }
    } catch (err: any) {
      audioAlert.playErrorSound();
      if (onShowToast) {
        onShowToast(err?.message || 'Erro ao enviar notificação de teste.', 'error');
      }
    } finally {
      setTesting(false);
    }
  };

  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);

  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: 'rgba(139, 47, 232, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--brand-primary, #8b2fe8)',
            }}
          >
            <BellRing size={18} />
          </div>
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 900, color: '#ffffff', margin: 0 }}>
              Notificações de entregas
            </h4>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Avisos mesmo com app fechado ou tela bloqueada
            </span>
          </div>
        </div>

        {/* Badge do Estado da Permissão */}
        <div>
          {permission === 'granted' && hasSubscription ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 800,
                color: 'var(--nw-emerald, #10b981)',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '4px 10px',
                borderRadius: '100px',
              }}
            >
              <CheckCircle size={12} />
              Ativadas
            </span>
          ) : permission === 'denied' ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 800,
                color: 'var(--nw-red, #ef4444)',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '4px 10px',
                borderRadius: '100px',
              }}
            >
              <BellOff size={12} />
              Bloqueadas
            </span>
          ) : (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 800,
                color: '#f59e0b',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                padding: '4px 10px',
                borderRadius: '100px',
              }}
            >
              <AlertTriangle size={12} />
              Não configuradas
            </span>
          )}
        </div>
      </div>

      {/* Ações */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {permission !== 'granted' || !hasSubscription ? (
          <button
            type="button"
            onClick={handleActivate}
            disabled={loading}
            className="btn-glove btn-glove-primary"
            style={{
              flex: 1,
              height: '44px',
              fontSize: '13px',
              minWidth: '160px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />}
            <span>Ativar notificações</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              style={{
                flex: 1,
                height: '44px',
                borderRadius: '12px',
                background: 'rgba(139, 47, 232, 0.2)',
                border: '1px solid var(--brand-primary, #8b2fe8)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              {testing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              <span>Testar notificação</span>
            </button>

            <button
              type="button"
              onClick={handleDeactivate}
              disabled={loading}
              style={{
                height: '44px',
                padding: '0 14px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: 'var(--text-muted)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Desativar
            </button>
          </>
        )}
      </div>

      {/* Orientações para quando estiver bloqueado */}
      {permission === 'denied' && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            padding: '12px',
            fontSize: '12px',
            color: '#fca5a5',
            lineHeight: 1.4,
          }}
        >
          <strong>Como desbloquear no aparelho:</strong>
          <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
            <li>Toque no cadeado ao lado do endereço do site ou abra as Configurações do celular.</li>
            <li>Acesse <em>Aplicativos &gt; Navegador &gt; Permissões &gt; Notificações</em>.</li>
            <li>Marque como <strong>Permitido</strong> e retorne ao aplicativo.</li>
          </ul>
        </div>
      )}

      {/* Dica para iOS PWA */}
      {isIOS && (
        <div
          style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: '12px',
            padding: '10px 12px',
            fontSize: '11px',
            color: '#93c5fd',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Smartphone size={16} style={{ flexShrink: 0 }} />
          <span>
            <strong>No iPhone (iOS 16.4+):</strong> Para receber notificações com o app fechado, adicione o NovaesWeb à <strong>Tela de Início</strong> pelo botão Compartilhar do Safari.
          </span>
        </div>
      )}
    </div>
  );
};

