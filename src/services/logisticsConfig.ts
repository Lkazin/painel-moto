const configuredUrl = import.meta.env?.VITE_LOGISTICS_API_URL || '';
const STORE_URL = 'https://entregado001-oe6y.vercel.app';

export function normalizeLogisticsUrl(value: string): string {
  const url = new URL(value.trim());
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new Error('Informe o endereço HTTPS do site da loja.');
  }
  if (url.username || url.password) throw new Error('Endereço da loja inválido.');
  url.pathname = '/api/v1/logistics';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

export function logisticsApiUrl(): string {
  if (configuredUrl) return normalizeLogisticsUrl(configuredUrl);
  if (import.meta.env?.DEV) return 'http://localhost:3000/api/v1/logistics';
  return normalizeLogisticsUrl(STORE_URL);
}
