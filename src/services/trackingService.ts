import { DriverLocationUpdate, TrackingSessionState } from '../types';

import { logisticsApiUrl } from './logisticsConfig';
import { accountClient } from './accountClient';

type StateListener = (state: TrackingSessionState) => void;

interface StoredDriverIdentity {
  driverId: string;
  membershipId?: string;
  driverName?: string;
  token?: string;
  inviteCode?: string;
}

function getStoredDriverIdentity(fallbackDriverId?: string | null): StoredDriverIdentity {
  if (typeof window === 'undefined') {
    return { driverId: '' };
  }

  let sessionObj: any = null;
  let accountObj: any = null;

  try {
    const rawSession = localStorage.getItem('novaesweb_driver_session_v2');
    if (rawSession) sessionObj = JSON.parse(rawSession);
  } catch {}

  try {
    const rawAccount = localStorage.getItem('novaesweb_driver_account_v2');
    if (rawAccount) accountObj = JSON.parse(rawAccount);
  } catch {}

  const driverId =
    sessionObj?.driverId ||
    accountObj?.id ||
    (fallbackDriverId && fallbackDriverId !== 'drv_default' ? fallbackDriverId : null) ||
    sessionObj?.membershipId ||
    '';

  const membershipId = sessionObj?.membershipId || undefined;
  const driverName = sessionObj?.driverName || accountObj?.name || undefined;
  const token =
    sessionObj?.token || undefined;

  return {
    driverId,
    membershipId,
    driverName,
    token,
  };
}

class TrackingService {
  private watchId: number | null = null;
  private activeDriverId: string | null = null;
  private activeAssignmentId: string | null = null;
  private lastSentTime: number = 0;
  private listeners: Set<StateListener> = new Set();
  private permissionState: 'granted' | 'denied' | 'prompt' | 'unknown' = 'unknown';

  private currentState: TrackingSessionState = {
    isActive: false,
    driverId: null,
    assignmentId: null,
    lastLocation: null,
    lastPushedAt: null,
    error: null,
  };

  constructor() {
    this.initPermissionMonitor();
    accountClient.subscribe(() => this.stop(false));
  }

  private initPermissionMonitor() {
    if (typeof window === 'undefined' || !('permissions' in navigator)) return;
    try {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((status) => {
          this.permissionState = status.state as 'granted' | 'denied' | 'prompt';
          this.notify();
          status.onchange = () => {
            this.permissionState = status.state as 'granted' | 'denied' | 'prompt';
            if (status.state === 'granted' && this.currentState.isActive) {
              const identity = getStoredDriverIdentity(this.activeDriverId);
              this.startWatch(identity.driverId);
            }
            this.notify();
          };
        })
        .catch(() => {});
    } catch {}
  }

  public getPermissionStatus(): 'granted' | 'denied' | 'prompt' | 'unknown' {
    return this.permissionState;
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.currentState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l({ ...this.currentState }));
  }

  public getState(): TrackingSessionState {
    return { ...this.currentState };
  }

  /**
   * Solicita explicitamente a permissão de localização real do aparelho (GPS).
   * Só transmite coordenadas para o servidor quando houver uma rota ativa iniciada após retirada.
   */
  public requestLocationPermission(options?: { onlyCheckPermission?: boolean }): Promise<{
    granted: boolean;
    latitude?: number;
    longitude?: number;
    error?: string;
  }> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('geolocation' in navigator)) {
        const msg = 'Este navegador ou aparelho não suporta geolocalização GPS.';
        this.currentState.error = msg;
        this.notify();
        resolve({ granted: false, error: msg });
        return;
      }

      const identity = getStoredDriverIdentity(this.activeDriverId);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.permissionState = 'granted';
          const loc: DriverLocationUpdate = {
            driverId: identity.driverId,
            assignmentId: this.activeAssignmentId || undefined,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp,
          };

          this.currentState.lastLocation = loc;
          this.currentState.error = null;
          this.notify();

          // Só transmite para o servidor se não for apenas verificação de permissão e se a sessão de rota estiver ativa
          if (!options?.onlyCheckPermission && this.currentState.isActive) {
            this.handleNewLocation(loc, true);
            if (this.watchId === null) {
              this.startWatch(identity.driverId);
            }
          }

          resolve({
            granted: true,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            this.permissionState = 'denied';
            this.currentState.error =
              'Permissão de localização negada. Clique no cadeado da barra de endereço do navegador e permita Localização.';
          } else {
            this.currentState.error =
              'Não foi possível obter o sinal de GPS agora. Verifique se a localização do aparelho está ligada.';
          }
          this.notify();
          resolve({ granted: false, error: this.currentState.error || err.message });
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 15000,
        }
      );
    });
  }

  private startWatch(driverId: string) {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;

    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        this.permissionState = 'granted';
        const identity = getStoredDriverIdentity(driverId);
        const loc: DriverLocationUpdate = {
          driverId: identity.driverId,
          assignmentId: this.activeAssignmentId || undefined,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        };
        this.handleNewLocation(loc);
      },
      (err) => {
        console.warn('[TrackingService] Aviso GPS:', err.message);
        if (err.code === err.PERMISSION_DENIED) {
          this.permissionState = 'denied';
          this.currentState.error =
            'Permissão de GPS negada. Permita o acesso à localização no navegador.';
        } else {
          this.currentState.error = 'Aguardando sinal de GPS real do aparelho...';
        }
        this.notify();
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      }
    );
  }

  /**
   * Inicia o monitoramento de GPS real e envio de coordenadas em tempo real.
   * Nunca inventa coordenadas falsas em São Paulo.
   */
  public start(driverId?: string, assignmentId?: string) {
    const identity = getStoredDriverIdentity(driverId);
    const resolvedDriverId = identity.driverId;
    if (!accountClient.getToken() || !identity.token || !resolvedDriverId) return;

    if (this.currentState.isActive && this.activeDriverId === resolvedDriverId && this.watchId !== null) {
      if (assignmentId) {
        this.activeAssignmentId = assignmentId;
        this.currentState.assignmentId = assignmentId;
        this.notify();
      }
      return;
    }

    this.activeDriverId = resolvedDriverId;
    this.activeAssignmentId = assignmentId || null;
    this.currentState = {
      isActive: true,
      driverId: resolvedDriverId,
      assignmentId: assignmentId || null,
      lastLocation: this.currentState.lastLocation,
      lastPushedAt: this.currentState.lastPushedAt,
      error: null,
    };
    this.notify();

    // Captura imediata da posição atual e inicia watchPosition real
    this.requestLocationPermission();
    this.startWatch(resolvedDriverId);
  }

  /**
   * Para o envio de localização
   */
  public stop(sendEnd = true) {
    if (this.watchId !== null && typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    if (sendEnd && this.activeDriverId && accountClient.getToken()) {
      this.sendEndSession(this.activeDriverId);
    }

    this.currentState = {
      isActive: false,
      driverId: null,
      assignmentId: null,
      lastLocation: null,
      lastPushedAt: null,
      error: null,
    };
    this.activeDriverId = null;
    this.activeAssignmentId = null;
    this.notify();
  }

  /**
   * Trata nova localização real recebida com controle de taxa (throttle 5s)
   */
  private async handleNewLocation(loc: DriverLocationUpdate, forceImmediate = false) {
    this.currentState.lastLocation = loc;
    this.currentState.error = null;
    this.notify();

    if (!this.currentState.isActive || !accountClient.getToken()) return;
    const now = Date.now();
    if (!forceImmediate && now - this.lastSentTime < 5000) {
      return;
    }

    this.lastSentTime = now;
    const identity = getStoredDriverIdentity(loc.driverId);

    try {
      const payload = {
        ...loc,
        driverId: identity.driverId,
        membershipId: identity.membershipId,
        driverName: identity.driverName,
        sessionToken: identity.token,
      };

      await accountClient.request(`${logisticsApiUrl()}/tracking-location-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-driver-id': identity.driverId,
          ...(identity.token
            ? {
                'x-session-token': identity.token,
                Authorization: `Bearer ${identity.token}`,
              }
            : {}),
        },
        body: JSON.stringify(payload),
      });

      if (this.currentState.isActive && accountClient.getToken()) {
        this.currentState.lastPushedAt = new Date().toISOString();
        this.notify();
      }
    } catch (e) {
      console.warn('[TrackingService] Falha de conexão ao enviar coordenadas:', e);
    }
  }

  private async sendEndSession(driverId: string) {
    try {
      const identity = getStoredDriverIdentity(driverId);
      await accountClient.request(`${logisticsApiUrl()}/tracking-session-end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-driver-id': identity.driverId,
          ...(identity.token
            ? {
                'x-session-token': identity.token,
                Authorization: `Bearer ${identity.token}`,
              }
            : {}),
        },
        body: JSON.stringify({
          driverId: identity.driverId,
          membershipId: identity.membershipId,
          sessionToken: identity.token,
        }),
      });
    } catch (e) {}
  }
}

export const trackingService = new TrackingService();
