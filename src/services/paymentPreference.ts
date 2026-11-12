export type PaymentMethod = 'pix' | 'dinheiro' | 'cartao' | 'transferencia';

export interface PaymentMethodOption {
  value: PaymentMethod;
  label: string;
}

export const PAYMENT_METHODS: PaymentMethodOption[] = [
  { value: 'pix', label: 'PIX' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'transferencia', label: 'Transferência' },
];

const KEY = 'nw:payment-method:v1';

function isMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && PAYMENT_METHODS.some((option) => option.value === value);
}

/** Forma de pagamento escolhida pelo entregador para receber da loja. */
export function getPaymentMethod(storage: Pick<Storage, 'getItem'> = localStorage): PaymentMethod | null {
  try {
    const saved = storage.getItem(KEY);
    return isMethod(saved) ? saved : null;
  } catch {
    return null;
  }
}

export function setPaymentMethod(method: PaymentMethod | null, storage: Pick<Storage, 'setItem' | 'removeItem'> = localStorage): void {
  try {
    if (method === null) storage.removeItem(KEY);
    else if (isMethod(method)) storage.setItem(KEY, method);
  } catch {
    /* Armazenamento indisponível não impede o uso do app. */
  }
}

export function paymentMethodLabel(method: PaymentMethod | null): string {
  if (!method) return 'Não informada';
  return PAYMENT_METHODS.find((option) => option.value === method)?.label ?? 'Não informada';
}
