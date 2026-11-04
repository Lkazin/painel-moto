import { Capacitor, registerPlugin } from '@capacitor/core';

type Status = { available: boolean; enabled: boolean; hasAccount: boolean };
type NativeAccess = {
  status(): Promise<Status>;
  save(data: { name: 'account' | 'offline'; value: string }): Promise<void>;
  read(data: { name: 'account' | 'offline' }): Promise<{ value: string | null }>;
  remove(data: { name: 'account' | 'offline' }): Promise<void>;
  unlock(): Promise<{ value: string | null }>;
  configure(data: { enabled: boolean }): Promise<void>;
  lock(): Promise<void>;
};
const plugin = registerPlugin<NativeAccess>('DriverSecureAccess');
export const nativeSecureAccess = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export const driverSecurity = {
  status: () => plugin.status(),
  save: (name: 'account' | 'offline', value: string) => plugin.save({ name, value }),
  read: async (name: 'account' | 'offline') => (await plugin.read({ name })).value,
  remove: (name: 'account' | 'offline') => plugin.remove({ name }),
  unlock: async () => (await plugin.unlock()).value,
  configure: (enabled: boolean) => plugin.configure({ enabled }),
  lock: () => plugin.lock(),
};
