import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Download,
  Share,
  PlusSquare,
  CheckCircle2,
  X,
  Apple,
  Sparkles
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstallModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  useEffect(() => {
    // 1. Detecta se já está instalado e rodando em modo standalone (app nativo)
    const checkStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(checkStandalone);

    // 2. Detecta iOS (iPhone / iPad)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // 3. Captura evento de instalação nativa do Android
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // 4. Detecta quando o app foi instalado
    const handleAppInstalled = () => {
      setInstallSuccess(true);
      setDeferredPrompt(null);
      setTimeout(() => {
        onClose();
      }, 2500);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [onClose]);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstallSuccess(true);
        setTimeout(() => onClose(), 2000);
      }
      setDeferredPrompt(null);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10, 4, 18, 0.88)',
        backdropFilter: 'blur(10px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'linear-gradient(160deg, #2A0A3D 0%, #16061F 100%)',
          border: '1.5px solid rgba(255, 110, 200, 0.6)',
          borderRadius: '28px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(255, 46, 154, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Cabeçalho */}
        <div
          style={{
            padding: '20px 22px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 110, 200, 0.2)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #FF3D6E, #FF2E9A, #8B2FE8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(255, 46, 154, 0.4)'
              }}
            >
              <Smartphone size={22} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: '#ffffff' }}>
                Baixar Aplicativo
              </h3>
              <span style={{ fontSize: '11px', color: '#FFB3E0', fontWeight: 600 }}>
                Android &amp; iOS (iPhone)
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#FFB3E0',
              cursor: 'pointer',
              padding: '6px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo */}
        <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {installSuccess ? (
            <div
              style={{
                padding: '24px 16px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <CheckCircle2 size={48} color="#10b981" />
              <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
                Aplicativo Instalado com Sucesso!
              </h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#E5C4F0' }}>
                O ícone já está disponível na tela inicial do seu celular.
              </p>
            </div>
          ) : isStandalone ? (
            <div
              style={{
                padding: '20px 16px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <CheckCircle2 size={40} color="#FF2E9A" />
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#ffffff' }}>
                Você já está usando o App Instalado!
              </h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#E5C4F0' }}>
                O NovaesWeb Entregador já está rodando em tela cheia no seu dispositivo.
              </p>
            </div>
          ) : isIOS ? (
            /* Guia específico para iPhone (Safari) */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255, 46, 154, 0.15)',
                  border: '1px solid rgba(255, 110, 200, 0.35)',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: '#FFB3E0',
                  fontWeight: 700
                }}
              >
                <Apple size={16} />
                <span>Instalação no iPhone (iOS Safari)</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#E5C4F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: '#FF2E9A',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '12px',
                      flexShrink: 0
                    }}
                  >
                    1
                  </span>
                  <span>
                    Toque no botão <strong>Compartilhar</strong> (ícone <Share size={15} style={{ display: 'inline', verticalAlign: 'middle', margin: '0 2px' }} /> na barra inferior do Safari).
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: '#FF2E9A',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '12px',
                      flexShrink: 0
                    }}
                  >
                    2
                  </span>
                  <span>
                    Role para baixo e selecione <strong>Adicionar à Tela de Início</strong> (<PlusSquare size={15} style={{ display: 'inline', verticalAlign: 'middle', margin: '0 2px' }} />).
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: '#FF2E9A',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '12px',
                      flexShrink: 0
                    }}
                  >
                    3
                  </span>
                  <span>
                    No canto superior direito, toque em <strong>Adicionar</strong>.
                  </span>
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(139, 47, 232, 0.2)',
                  border: '1px solid rgba(139, 47, 232, 0.4)',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Sparkles size={16} color="#FFB3E0" />
                <span>O app abrirá em tela cheia sem barras do navegador!</span>
              </div>
            </div>
          ) : (
            /* Guia e Botão para Android / Navegadores */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ margin: 0, fontSize: '13.5px', color: '#E5C4F0', lineHeight: 1.5 }}>
                Baixe o <strong>NovaesWeb Entregador</strong> no seu celular para receber avisos sonoros de pedidos mesmo com a tela bloqueada.
              </p>

              {deferredPrompt ? (
                <button
                  type="button"
                  onClick={handleInstallClick}
                  style={{
                    width: '100%',
                    height: '56px',
                    border: '1.5px solid rgba(255, 190, 235, 0.6)',
                    borderRadius: '16px',
                    background: 'linear-gradient(90deg, #FF3D6E 0%, #FF2E9A 40%, #C02BE0 72%, #8B2FE8 100%)',
                    color: '#ffffff',
                    fontSize: '16px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    boxShadow: '0 0 24px rgba(255, 46, 154, 0.55), 0 8px 20px rgba(139, 47, 232, 0.35)'
                  }}
                >
                  <Download size={22} />
                  <span>Instalar no Celular Agora</span>
                </button>
              ) : (
                <div
                  style={{
                    background: 'rgba(255, 46, 154, 0.12)',
                    border: '1px solid rgba(255, 110, 200, 0.4)',
                    padding: '12px 14px',
                    borderRadius: '14px',
                    fontSize: '13px',
                    color: '#E5C4F0',
                    lineHeight: 1.6
                  }}
                >
                  <strong style={{ color: '#ffffff', display: 'block', marginBottom: '4px' }}>
                    Como instalar no Android:
                  </strong>
                  Toque nos <strong>3 pontinhos do Chrome (⋮)</strong> no canto superior e selecione <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: '#FFB3E0'
                }}
              >
                <CheckCircle2 size={16} color="#10b981" />
                <span>Leve, rápido e não consome memória do aparelho.</span>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid rgba(255, 110, 200, 0.2)',
            display: 'flex',
            justifyContent: 'flex-end'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 110, 200, 0.3)',
              borderRadius: '12px',
              padding: '8px 18px',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
