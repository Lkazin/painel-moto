import type { DeliveryHistoryItem } from '../types';

const STATUS_LABEL: Record<DeliveryHistoryItem['status'], string> = {
  delivered: 'Entregue',
  canceled_by_store: 'Cancelada pela loja',
  withdrawn: 'Retirada',
};

const CONFIRM_LABEL: Record<DeliveryHistoryItem['confirmedVia'], string> = {
  pin_online: 'PIN online',
  pin_offline_synced: 'PIN offline sincronizado',
  store_override: 'Liberada pela loja',
  unknown: 'Não informada',
};

function cell(value: string): string {
  const clean = String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim();
  return /[";]/.test(clean) ? `"${clean.replace(/"/g, '""')}"` : clean;
}

function money(value: number | null): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toFixed(2).replace('.', ',')
    : '';
}

function date(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * CSV para o entregador conferir o mês com a loja.
 * Separador ";" e vírgula decimal: é o que o Excel em português abre sem ajuste.
 */
export function buildHistoryCsv(items: DeliveryHistoryItem[], generatedAt = new Date()): string {
  const header = ['Pedido', 'Loja', 'Endereço', 'Bairro', 'Status', 'Confirmado por', 'Concluída em', 'Taxa (R$)'];
  const rows = items.map((item) => [
    cell(item.orderNumber),
    cell(item.storeName),
    cell(item.address),
    cell(item.neighborhood),
    cell(STATUS_LABEL[item.status] ?? item.status),
    cell(CONFIRM_LABEL[item.confirmedVia] ?? item.confirmedVia),
    cell(date(item.completedAt)),
    cell(money(item.deliveryFee)),
  ]);
  const total = items.reduce((sum, item) => sum + (typeof item.deliveryFee === 'number' ? item.deliveryFee : 0), 0);
  const footer = ['Total', `${items.length} entrega(s)`, '', '', '', '', '', money(total)];
  const generated = ['Gerado em', date(generatedAt.toISOString())];
  return [header, ...rows, footer, generated].map((row) => row.join(';')).join('\r\n') + '\r\n';
}

export function historyCsvFileName(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `entregas-${now.getFullYear()}-${month}.csv`;
}
