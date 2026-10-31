// Utilitário para Notificações Push Locais e Screen Wake Lock (Manter Tela Acesa)
// Desenvolvido para uso do motoboy em suporte de moto ou celular bloqueado

import { Offer } from '../types';

let wakeLockSentinel: any = null;

/**
 * Solicita permissão para exibir notificações nativas no sistema operacional
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (err) {
    console.warn('Erro ao solicitar permissão de notificações:', err);
    return false;
  }
}

/**
 * Verifica o status atual da permissão de notificação
 */
export function getNotificationPermission(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Ativa o Screen Wake Lock para impedir que a tela do celular apague/bloqueie sozinha no suporte da moto
 */
export async function requestScreenWakeLock(): Promise<boolean> {
  if (typeof window === 'undefined' || !('wakeLock' in navigator)) {
    return false;
  }

  try {
    if (wakeLockSentinel && !wakeLockSentinel.released) {
      return true;
    }
    wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
    wakeLockSentinel.addEventListener('release', () => {
      wakeLockSentinel = null;
    });
    return true;
  } catch (err) {
    console.warn('Wake Lock não pôde ser ativado:', err);
    return false;
  }
}

/**
 * Libera o Wake Lock para permitir que a tela economize bateria
 */
export async function releaseScreenWakeLock(): Promise<void> {
  if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release();
    } catch {}
    wakeLockSentinel = null;
  }
}

/**
 * Dispara uma notificação do sistema com som e vibração intensa para acordar a tela do motoboy
 */
export async function triggerOfferNotification(offer: Offer): Promise<void> {
  if (typeof window === 'undefined') return;

  // Vibração forte do aparelho
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate([600, 200, 600, 200, 900]);
    } catch {}
  }

  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const feeFormatted = offer.deliveryFee
    ? `R$ ${Number(offer.deliveryFee).toFixed(2).replace('.', ',')}`
    : 'R$ 12,00';
  const orderNum = offer.orderNumber ? `#${offer.orderNumber}` : 'Nova Corrida';
  const title = `🍕 NOVA CORRIDA: ${orderNum}`;
  const body = `Taxa: ${feeFormatted} • Toque agora para aceitar no painel!`;

  // 1. Tenta disparar via Service Worker (Funciona com tela bloqueada e PWA em segundo plano)
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body,
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          vibrate: [600, 200, 600, 200, 900],
          tag: 'nova-oferta-' + (offer.offerId || Date.now()),
          renotify: true,
          requireInteraction: true,
          data: { url: '/' }
        } as any);
        return;
      }
    } catch (e) {
      console.warn('Falha ao disparar notificação via Service Worker:', e);
    }
  }

  // 2. Fallback direto da Notification API
  try {
    new Notification(title, {
      body,
      icon: '/favicon.svg',
      vibrate: [600, 200, 600, 200, 900]
    } as any);
  } catch (e) {}
}
