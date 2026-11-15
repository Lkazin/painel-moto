import type { Assignment, DeliveryHistoryItem, StoreShiftSummary } from '../types';

export interface DriverHistorySnapshot {
  items: DeliveryHistoryItem[];
  totalEarnings: number;
  hasUninformedFees: boolean;
}

export interface DriverDataSnapshot {
  accountId: string;
  updatedAt: string;
  assignmentsByStore: Record<string, Assignment[]>;
  historyByStore: Record<string, DriverHistorySnapshot>;
  ledger: StoreShiftSummary[];
}

const SNAPSHOT_PREFIX = 'novaesweb_driver_snapshot_v1:';

function snapshotKey(accountId: string): string {
  return `${SNAPSHOT_PREFIX}${accountId.trim()}`;
}

function normalizeStore(storeId?: string | null): string {
  const value = typeof storeId === 'string' ? storeId.trim() : '';
  return value || 'default';
}

function assignmentIdentity(a: Assignment): string {
  return String(a.assignmentId || a.id || a.orderId || '');
}

function emptySnapshot(accountId: string): DriverDataSnapshot {
  return {
    accountId,
    updatedAt: new Date().toISOString(),
    assignmentsByStore: {},
    historyByStore: {},
    ledger: [],
  };
}

export function readDriverSnapshot(accountId?: string | null): DriverDataSnapshot | null {
  if (!accountId || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(snapshotKey(accountId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DriverDataSnapshot>;
    if (!parsed || parsed.accountId !== accountId) return null;
    return {
      accountId,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      assignmentsByStore:
        parsed.assignmentsByStore && typeof parsed.assignmentsByStore === 'object'
          ? parsed.assignmentsByStore
          : {},
      historyByStore:
        parsed.historyByStore && typeof parsed.historyByStore === 'object'
          ? parsed.historyByStore
          : {},
      ledger: Array.isArray(parsed.ledger) ? parsed.ledger : [],
    };
  } catch {
    return null;
  }
}

function writeSnapshot(snapshot: DriverDataSnapshot): void {
  if (!snapshot.accountId || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(snapshotKey(snapshot.accountId), JSON.stringify(snapshot));
  } catch {
    // Ignore storage quota issues without disrupting live UI state.
  }
}

export function readCachedAssignments(accountId?: string | null, storeId?: string | null): Assignment[] {
  const snapshot = readDriverSnapshot(accountId);
  if (!snapshot) return [];
  const items = snapshot.assignmentsByStore[normalizeStore(storeId)];
  return Array.isArray(items) ? items : [];
}

export function saveCachedAssignments(
  accountId: string | null | undefined,
  storeId: string | null | undefined,
  assignments: Assignment[],
): void {
  if (!accountId) return;
  const current = readDriverSnapshot(accountId) || emptySnapshot(accountId);
  const storeKey = normalizeStore(storeId);
  current.assignmentsByStore = {
    ...current.assignmentsByStore,
    [storeKey]: assignments,
  };
  current.updatedAt = new Date().toISOString();
  writeSnapshot(current);
}

/**
 * Combina atribuições da nuvem com pendências offline locais sem apagar
 * confirmações ainda não sincronizadas nem perder estado em falhas temporárias.
 */
export function reconcileAssignmentsWithServer(
  localAssignments: Assignment[],
  serverAssignments: Assignment[],
): Assignment[] {
  const serverIds = new Set(serverAssignments.map(assignmentIdentity).filter(Boolean));
  const pendingLocal = localAssignments.filter(
    (item) => Boolean(item.isPendingSync) && !serverIds.has(assignmentIdentity(item)),
  );
  return [...serverAssignments, ...pendingLocal];
}

export function readCachedHistory(
  accountId?: string | null,
  storeId?: string | null,
): DriverHistorySnapshot | null {
  const snapshot = readDriverSnapshot(accountId);
  if (!snapshot) return null;
  const entry = snapshot.historyByStore[normalizeStore(storeId)];
  if (!entry || !Array.isArray(entry.items)) return null;
  return {
    items: entry.items,
    totalEarnings: Number(entry.totalEarnings) || 0,
    hasUninformedFees: Boolean(entry.hasUninformedFees),
  };
}

export function saveCachedHistory(
  accountId: string | null | undefined,
  storeId: string | null | undefined,
  history: DriverHistorySnapshot,
): void {
  if (!accountId) return;
  const current = readDriverSnapshot(accountId) || emptySnapshot(accountId);
  const storeKey = normalizeStore(storeId);
  current.historyByStore = {
    ...current.historyByStore,
    [storeKey]: {
      items: Array.isArray(history.items) ? history.items : [],
      totalEarnings: Number(history.totalEarnings) || 0,
      hasUninformedFees: Boolean(history.hasUninformedFees),
    },
  };
  current.updatedAt = new Date().toISOString();
  writeSnapshot(current);
}

export function readCachedLedger(accountId?: string | null): StoreShiftSummary[] {
  const snapshot = readDriverSnapshot(accountId);
  return snapshot?.ledger || [];
}

export function saveCachedLedger(
  accountId: string | null | undefined,
  ledger: StoreShiftSummary[],
): void {
  if (!accountId) return;
  const current = readDriverSnapshot(accountId) || emptySnapshot(accountId);
  current.ledger = Array.isArray(ledger) ? ledger : [];
  current.updatedAt = new Date().toISOString();
  writeSnapshot(current);
}

/**
 * Limpa somente o snapshot da conta no logout explícito.
 * Atualizações do aplicativo NUNCA devem chamar esta função.
 */
export function clearDriverSnapshotOnLogout(accountId?: string | null): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (accountId) {
      localStorage.removeItem(snapshotKey(accountId));
      return;
    }
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(SNAPSHOT_PREFIX)) keysToRemove.push(k);
    }
    for (const k of keysToRemove) localStorage.removeItem(k);
  } catch {
    // Ignore storage removal errors cleanly.
  }
}
