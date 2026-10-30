export interface DriverAccount {
  id: string;
  name: string;
  phone: string;
  vehiclePlate: string;
  vehicleModel?: string;
  createdAt: string;
}

export interface StoreShiftSummary {
  storeId: string;
  storeName: string;
  storeAddress?: string;
  completedCount: number;
  canceledCount: number;
  totalToReceive: number;
  lastShiftDate: string;
  isActiveShift?: boolean;
}

export interface DriverSession {
  token: string;
  driverId: string;
  driverName: string;
  phone: string;
  vehiclePlate?: string;
  deviceFingerprint: string;
  storeId: string;
  storeName: string;
  storeAddress?: string;
  membershipId: string;
  role: string;
  expiresAt: string;
  isActivated: boolean;
  shiftStartedAt?: string;
}

export interface DriverPresence {
  manualEnabled: boolean; // Ligado / Desligado
  isOnline: boolean;     // Conectividade com a internet
  lastHeartbeat: string;
}

export interface OfferOrderItem {
  id: string;
  orderNumber: string;
  customerName: string;
  customerAddress: string;
  customerNeighborhood: string;
  customerCity?: string;
  customerPhone?: string;
  itemsSummary: string;
  total?: number;
}

export interface Offer {
  offerId: string;
  orderId: string;
  orderNumber: string;
  storeId: string;
  storeName: string;
  storeAddress?: string;
  customerAddress: string;
  customerNeighborhood: string;
  customerCity?: string;
  estimatedDistanceKm: number;
  deliveryFee: number | null; // null se não informado pela loja
  itemsSummary: string;
  totalOrdersGrouped: number;
  orders?: OfferOrderItem[];
  createdAt: string;
  expiresAt: string;
  totalSeconds: number;
}

export type AssignmentStatus =
  | 'accepted'
  | 'waiting_pickup'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'withdrawn'
  | 'canceled_by_store';

export interface Assignment {
  assignmentId: string;
  orderId: string;
  orderNumber: string;
  storeId: string;
  storeName: string;
  customerName: string;
  customerPhone?: string;
  address: string;
  addressNumber: string;
  addressComplement?: string;
  neighborhood: string;
  city: string;
  instructions?: string;
  deliveryFee: number | null;
  itemsSummary: string;
  status: AssignmentStatus;
  sequence: number;
  acceptedAt: string;
  pickupConfirmedAt?: string;
  deliveredAt?: string;
  driverId?: string;
  driverName?: string;
  isPendingSync?: boolean; // Para confirmações offline
  pinCandidateOffline?: string;
}

export interface RouteStop {
  assignmentId: string;
  orderNumber: string;
  sequence: number;
  customerName: string;
  address: string;
  neighborhood: string;
  status: AssignmentStatus;
  isCurrent: boolean;
  deliveryFee: number | null;
}

export interface OfflineCommand {
  id: string;
  action: 'pickup_confirm' | 'delivery_confirm' | 'route_reorder' | 'assignment_withdraw';
  payload: any;
  idempotencyKey: string;
  createdAt: string;
  status: 'pending' | 'syncing' | 'failed' | 'confirmed';
  retryCount: number;
  lastError?: string;
}

export interface DeliveryHistoryItem {
  id: string;
  orderNumber: string;
  storeId?: string;
  storeName: string;
  address: string;
  neighborhood: string;
  deliveryFee: number | null;
  status: 'delivered' | 'canceled_by_store' | 'withdrawn';
  completedAt: string;
  confirmedVia: 'pin_online' | 'pin_offline_synced' | 'store_override';
}

export interface RatingsData {
  averageStars: number;
  totalRatings: number;
  period: string;
  distribution: {
    star: number;
    count: number;
    percentage: number;
  }[];
}
