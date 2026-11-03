import type { DeliveryHistoryItem } from '../types';

/** Supports old records without inventing payment or PIN evidence. */
export function normalizeDeliveryHistory(data: unknown) {
  const source = Array.isArray(data) ? data : data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items) ? (data as { items: unknown[] }).items : [];
  const text = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  const items: DeliveryHistoryItem[] = source.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item)).map((item, index) => {
    const rawFee = item.deliveryFee;
    const fee = typeof rawFee === 'number' || (typeof rawFee === 'string' && rawFee.trim() !== '') ? Number(rawFee) : NaN;
    return {
      id: text(item.id || item.assignmentId || item.orderId) || `history-${index}`,
      orderNumber: text(item.orderNumber), storeId: text(item.storeId), storeName: text(item.storeName),
      address: text(item.address || item.deliveryAddress), neighborhood: text(item.neighborhood),
      deliveryFee: Number.isFinite(fee) && fee >= 0 ? fee : null,
      status: item.status === 'canceled_by_store' || item.status === 'withdrawn' ? item.status : 'delivered',
      completedAt: text(item.completedAt || item.deliveredAt),
      confirmedVia: item.confirmedVia === 'pin_online' || item.confirmedVia === 'pin_offline_synced' || item.confirmedVia === 'store_override' ? item.confirmedVia : 'unknown',
    };
  });
  return { items, totalEarnings: items.reduce((sum, item) => sum + (item.deliveryFee ?? 0), 0), hasUninformedFees: items.some(item => item.deliveryFee === null) };
}
