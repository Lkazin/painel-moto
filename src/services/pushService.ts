import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { accountClient } from './accountClient';
import { logisticsApiUrl } from './logisticsConfig';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type PushPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

export const DEFAULT_VAPID_PUBLIC_KEY =
  'BI07ZQtHW3jjOz1BoDHw8QXL1tjmF1ZxVln2MZSUClRE4Bb4BOU-ahEEqUQkVK9JSeV4ja9enmR3CErXrviab3c';

class PushNotificationService {
  private cachedVapidKey: string | null = null;
  private nativeListenersConfigured = false;

  public isSupported(): boolean {
    if (Capacitor.isNativePlatform()) {
      return true;
    }
    if (typeof window === 'undefined') return false;
    return (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  public getPermissionStatus(): PushPermissionStatus {
    if (Capacitor.isNativePlatform()) {
      return localStorage.getItem('novaesweb_push_enabled') === 'true' ? 'granted' : 'default';
    }
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission;
  }

  private getPushApiUrl(action: string): string {
    return logisticsApiUrl().replace('/api/v1/logistics', '/api/v1/driver-push') + '/' + action;
  }

  public async getVapidPublicKey(): Promise<string> {
    if (this.cachedVapidKey) return this.cachedVapidKey;

    // 1. Tenta buscar do backend dinamicamente
    try {
      const url = this.getPushApiUrl('vapid-public-key');
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.publicKey) {
        this.cachedVapidKey = data.publicKey;
        return data.publicKey;
      }
    } catch (err) {
      console.warn('[PushService] Erro ao obter VAPID do backend, usando fallback local:', err);
    }

    // 2. Fallback da variável de ambiente Vite
    const envKey = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY || '';
    if (envKey) {
      this.cachedVapidKey = envKey;
      return envKey;
    }

    // 3. Fallback da chave pública VAPID oficial do sistema NovaesWeb
    this.cachedVapidKey = DEFAULT_VAPID_PUBLIC_KEY;
    return DEFAULT_VAPID_PUBLIC_KEY;
  }

  public async getExistingSubscription(): Promise<PushSubscription | { endpoint: string } | null> {
    if (Capacitor.isNativePlatform()) {
      return localStorage.getItem('novaesweb_push_enabled') === 'true'
        ? ({ endpoint: 'fcm:native' } as any)
        : null;
    }

    if (!this.isSupported()) return null;
    try {
      const reg = await navigator.serviceWorker.ready;
      return await reg.pushManager.getSubscription();
    } catch {
      return null;
    }
  }

  private setupNativeListeners() {
    if (this.nativeListenersConfigured || !Capacitor.isNativePlatform()) return;
    this.nativeListenersConfigured = true;

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[PushService] Notificação recebida em 1º plano:', notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('[PushService] Notificação tocada pelo motoboy:', notification);
    });
  }

  public async subscribe(): Promise<{
    success: boolean;
    reason?: 'unsupported' | 'denied' | 'no_key' | 'failed' | 'unauthenticated';
    error?: string;
  }> {
    if (!this.isSupported()) {
      return { success: false, reason: 'unsupported', error: 'Notificações não suportadas neste ambiente.' };
    }

    if (!accountClient.getToken()) {
      return { success: false, reason: 'unauthenticated', error: 'Entre na sua conta para ativar notificações.' };
    }

    // ==========================================
    // FLUXO NATIVO ANDROID (FIREBASE CLOUD MESSAGING)
    // ==========================================
    if (Capacitor.isNativePlatform()) {
      try {
        let perm = await PushNotifications.checkPermissions();
        if (perm.receive !== 'granted') {
          perm = await PushNotifications.requestPermissions();
        }

        if (perm.receive !== 'granted') {
          return {
            success: false,
            reason: 'denied',
            error: 'Permissão de notificação negada no Android. Permita nas configurações do aparelho.',
          };
        }

        // Cria o canal com prioridade máxima e som
        await PushNotifications.createChannel({
          id: 'pedidos_entregas',
          name: 'Chamados e Entregas',
          description: 'Avisos sonoros e vibração de novas corridas',
          importance: 5,
          visibility: 1,
          vibration: true,
          lights: true,
        }).catch(() => {});

        this.setupNativeListeners();

        // Registra e aguarda o token FCM
        const fcmToken = await new Promise<string>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Tempo esgotado ao registrar no Firebase FCM. Verifique sua conexão.'));
          }, 15000);

          PushNotifications.addListener('registration', (token) => {
            clearTimeout(timeout);
            resolve(token.value);
          });

          PushNotifications.addListener('registrationError', (err) => {
            clearTimeout(timeout);
            reject(new Error(err.error || 'Falha ao registrar token no Firebase.'));
          });

          PushNotifications.register().catch(reject);
        });

        // Envia o token FCM para o backend autenticado
        await accountClient.request(this.getPushApiUrl('subscribe'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fcmToken,
            deviceType: 'android',
            userAgent: navigator.userAgent,
          }),
        });

        localStorage.setItem('novaesweb_push_enabled', 'true');
        return { success: true };
      } catch (err: any) {
        console.error('[PushService] Falha no registro nativo FCM:', err);
        return {
          success: false,
          reason: 'failed',
          error: err?.message || 'Falha ao ativar notificações nativas no Android.',
        };
      }
    }

    // ==========================================
    // FLUXO WEB PUSH / PWA (VAPID)
    // ==========================================
    let permission = Notification.permission;
    if (permission !== 'granted') {
      try {
        permission = await Notification.requestPermission();
      } catch (err) {
        console.warn('[PushService] Erro ao solicitar permissão:', err);
        return { success: false, reason: 'denied', error: 'Permissão não concedida.' };
      }
    }

    if (permission !== 'granted') {
      return {
        success: false,
        reason: 'denied',
        error: 'Permissão de notificação negada no navegador ou sistema operacional.',
      };
    }

    const vapidKey = await this.getVapidPublicKey();
    if (!vapidKey) {
      return {
        success: false,
        reason: 'no_key',
        error: 'Chave pública VAPID não configurada no servidor.',
      };
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      let subscription = await reg.pushManager.getSubscription();

      if (!subscription) {
        const convertedKey = urlBase64ToUint8Array(vapidKey);
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey,
        });
      }

      const subJson = subscription.toJSON();
      await accountClient.request(this.getPushApiUrl('subscribe'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: {
            endpoint: subJson.endpoint,
            keys: {
              p256dh: subJson.keys?.p256dh,
              auth: subJson.keys?.auth,
            },
          },
          deviceType: /Android/i.test(navigator.userAgent)
            ? 'android'
            : /iPhone|iPad|iPod/i.test(navigator.userAgent)
              ? 'ios'
              : 'desktop',
          userAgent: navigator.userAgent,
        }),
      });

      localStorage.setItem('novaesweb_push_enabled', 'true');
      return { success: true };
    } catch (err: any) {
      console.error('[PushService] Falha ao registrar inscrição push:', err);
      return {
        success: false,
        reason: 'failed',
        error: err?.message || 'Falha ao registrar inscrição push no aparelho.',
      };
    }
  }

  public async unsubscribe(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        await PushNotifications.removeAllListeners();
      } catch {}
      localStorage.removeItem('novaesweb_push_enabled');
      return true;
    }

    if (!this.isSupported()) return false;

    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe().catch(() => { });

        if (accountClient.getToken()) {
          await accountClient
            .request(this.getPushApiUrl('unsubscribe'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ endpoint }),
            })
            .catch(() => { });
        }
      }

      localStorage.removeItem('novaesweb_push_enabled');
      return true;
    } catch (err) {
      console.warn('[PushService] Erro ao desinscrever notificações:', err);
      return false;
    }
  }

  public async sendTestPush(): Promise<{ success: boolean; message: string }> {
    if (!accountClient.getToken()) {
      return { success: false, message: 'Entre na sua conta para testar o envio.' };
    }

    try {
      const data = await accountClient.request(this.getPushApiUrl('test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      return {
        success: data.success && data.sent > 0,
        message: data.message || 'Notificação de teste enviada com sucesso!',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Falha ao enviar notificação de teste.',
      };
    }
  }
}

export const pushService = new PushNotificationService();
