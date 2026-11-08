// Captura privada de erros para diagnóstico e suporte, sem enviar dados automaticamente.
// Não coleta conta, loja, pedido, cliente nem localização. Guarda apenas a mensagem
// e a pilha no aparelho, para o entregador compartilhar se precisar de ajuda.

export interface CapturedError {
  message: string;
  stack?: string;
  componentStack?: string;
  at: string;
}

const LAST_ERROR_KEY = 'novaesweb:last-error:v1';
const MAX_MESSAGE = 500;
const MAX_STACK = 2000;

export function captureError(error: unknown, info?: { componentStack?: string | null }): CapturedError {
  const normalized = error instanceof Error ? error : new Error(String(error));
  const record: CapturedError = {
    message: (normalized.message || 'Erro desconhecido').slice(0, MAX_MESSAGE),
    stack: (normalized.stack || '').slice(0, MAX_STACK),
    componentStack: (info?.componentStack || '').slice(0, MAX_STACK) || undefined,
    at: new Date().toISOString(),
  };
  try {
    sessionStorage.setItem(LAST_ERROR_KEY, JSON.stringify(record));
  } catch {
    // Armazenamento indisponível não impede o registro em console.
  }
  console.error('[NovaesWeb Entregador]', record);
  return record;
}

export function readLastError(): CapturedError | null {
  try {
    const raw = sessionStorage.getItem(LAST_ERROR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.message === 'string') return parsed as CapturedError;
  } catch { /* Ignora dado local corrompido. */ }
  return null;
}

export function clearLastError(): void {
  try { sessionStorage.removeItem(LAST_ERROR_KEY); } catch { /* Sem efeito. */ }
}

// Captura falhas fora do React (erros globais e rejeições não tratadas).
// Sempre preserva o comportamento padrão do navegador depois de registrar.
export function installGlobalErrorHandlers(): () => void {
  if (typeof window === 'undefined') return () => {};
  const onError = (event: ErrorEvent) => { captureError(event.error || event.message); };
  const onRejection = (event: PromiseRejectionEvent) => { captureError(event.reason); };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}

