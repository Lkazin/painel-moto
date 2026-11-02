import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';
import type { BackgroundGeolocationPlugin, Location } from '@capacitor-community/background-geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');
export const supportsBackgroundTracking = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

/** Owns exactly one native watcher; cancelled starts remove their late watcher too. */
export class NativeTrackingWatcher {
  private epoch = 0;
  private id: string | null = null;
  async start(onLocation: (location: Location) => void, onError: (message: string, denied: boolean) => void) {
    const epoch = this.epoch + 1;
    await this.stop();
    if (epoch !== this.epoch) return;
    try {
      let permission = await LocalNotifications.checkPermissions();
      if (permission.display !== 'granted') permission = await LocalNotifications.requestPermissions();
      if (epoch !== this.epoch) return;
      if (permission.display !== 'granted') {
        onError('Permita as notificações do aplicativo para mostrar o aviso de localização durante a entrega.', true);
        return;
      }
      const id = await BackgroundGeolocation.addWatcher({
        backgroundTitle: 'NovaesWeb · entrega em andamento',
        backgroundMessage: 'Compartilhando sua localização durante a entrega. O envio termina ao encerrar as entregas ou sair da conta.',
        requestPermissions: true,
        stale: false,
        distanceFilter: 0,
      }, (location, error) => {
        if (epoch !== this.epoch) return;
        if (error) onError(error.code === 'NOT_AUTHORIZED'
          ? 'Permita a localização precisa nas configurações do aplicativo.' : 'Aguardando sinal de GPS do aparelho.', error.code === 'NOT_AUTHORIZED');
        else if (location) onLocation(location);
      });
      if (epoch !== this.epoch) await BackgroundGeolocation.removeWatcher({ id });
      else this.id = id;
    } catch {
      if (epoch === this.epoch) onError('Não foi possível iniciar o GPS em segundo plano. Abra o aplicativo e confira as permissões.', false);
    }
  }
  async stop() {
    this.epoch++;
    const id = this.id;
    this.id = null;
    if (id) await BackgroundGeolocation.removeWatcher({ id }).catch(() => {});
  }
}

/** A foreground permission/position check never starts background sharing. */
export function nativeCurrentPosition(success: PositionCallback, failure: PositionErrorCallback) {
  let id: string | undefined;
  let done = false;
  const clear = () => { if (id) void BackgroundGeolocation.removeWatcher({ id }).catch(() => {}); };
  const finishError = (denied: boolean) => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    clear();
    failure({ code: denied ? 1 : 2, message: 'Não foi possível obter a posição.', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
  };
  const timer = setTimeout(() => finishError(false), 15000);
  void BackgroundGeolocation.addWatcher({ requestPermissions: true, stale: false, distanceFilter: 0 }, (location, error) => {
    if (done) return;
    if (error) { finishError(error.code === 'NOT_AUTHORIZED'); return; }
    if (!location) return;
    done = true;
    clearTimeout(timer);
    clear();
    success({ timestamp: Number(location.time), coords: {
      latitude: location.latitude, longitude: location.longitude, accuracy: location.accuracy,
      altitude: location.altitude, altitudeAccuracy: location.altitudeAccuracy,
      heading: location.bearing, speed: location.speed, toJSON: () => ({}) }, toJSON: () => ({}) });
  }).then(watcherId => { id = watcherId; if (done) clear(); }).catch(() => finishError(false));
}

/** Native HTTP avoids Android WebView request throttling while using Waze. */
export async function nativeAccountRequest(url: string, options: RequestInit) {
  if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const response = await CapacitorHttp.request({
    url, method: options.method || 'GET',
    headers: Object.fromEntries(new Headers(options.headers).entries()),
    data: typeof options.body === 'string' ? JSON.parse(options.body) : undefined,
    responseType: 'json', connectTimeout: 15000, readTimeout: 15000,
    disableRedirects: true,
  });
  if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return { ok: response.status >= 200 && response.status < 300, status: response.status,
    json: async () => typeof response.data === 'string' ? JSON.parse(response.data) : response.data };
}
