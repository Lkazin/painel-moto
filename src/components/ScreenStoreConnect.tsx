import './ScreenStoreConnect.css';
import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Bike,
  CheckCircle2,
  ClipboardPaste,
  History,
  LogOut,
  Package,
  Store,
  Wallet
} from 'lucide-react';
import { DriverAccount, DriverSession } from '../types';
import { api } from '../services/api';
import { audioAlert } from '../utils/audioAlert';

interface ScreenStoreConnectProps {
  account?: DriverAccount;
  onShiftStarted: (session: DriverSession) => void;
  onLogout?: () => void;
}

interface RecentStoreEntry {
  code: string;
  storeName?: string;
  connectedAt: string;
  accountId?: string;
}

const RECENT_STORES_KEY = 'novaesweb_recent_store_codes_v1';
const MAX_RECENT_STORES = 2;

const isCompleteStoreCode = (code: string): boolean => {
  const normalized = code.trim().toUpperCase();
  if (!/^NW-[A-Z0-9-]{4,11}$/.test(normalized)) return false;
  const suffix = normalized.slice(3).replace(/-/g, '');
  return suffix.length >= 4;
};

const normalizeStoreCodeInput = (raw: string, previousValue = ''): string => {
  const upper = raw.toUpperCase();
  const extracted = upper.match(/NW-[A-Z0-9-]{1,11}/);
  let clean = extracted ? extracted[0] : upper.replace(/[^A-Z0-9-]/g, '');

  if (previousValue && raw.length < previousValue.length && (clean === 'NW' || clean === 'N')) {
    return '';
  }
  if (!clean.startsWith('NW-') && clean.length > 0) {
    clean = clean.startsWith('NW')
      ? 'NW-' + clean.substring(2)
      : 'NW-' + clean.replace(/-/g, '');
  }
  return clean.slice(0, 14);
};

const loadRecentStores = (accountId?: string): RecentStoreEntry[] => {
  try {
    const raw = localStorage.getItem(RECENT_STORES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is RecentStoreEntry => {
        if (!item || typeof item !== 'object' || typeof item.code !== 'string') return false;
        if (!isCompleteStoreCode(item.code)) return false;
        return !accountId || !item.accountId || item.accountId === accountId;
      })
      .slice(0, MAX_RECENT_STORES);
  } catch {
    return [];
  }
};

const saveRecentStore = (code: string, storeName: string | undefined, accountId?: string): RecentStoreEntry[] => {
  const normalizedCode = code.trim().toUpperCase();
  if (!isCompleteStoreCode(normalizedCode)) return loadRecentStores(accountId);
  const nextEntry: RecentStoreEntry = {
    code: normalizedCode,
    storeName: storeName?.trim() || undefined,
    connectedAt: new Date().toISOString(),
    ...(accountId ? { accountId } : {})
  };
  try {
    const raw = localStorage.getItem(RECENT_STORES_KEY);
    const existing: RecentStoreEntry[] = raw ? (JSON.parse(raw) as RecentStoreEntry[]) : [];
    const filtered = Array.isArray(existing)
      ? existing.filter(item => !(item?.code === normalizedCode && (!accountId || !item.accountId || item.accountId === accountId)))
      : [];
    const updated = [nextEntry, ...filtered].slice(0, 6);
    localStorage.setItem(RECENT_STORES_KEY, JSON.stringify(updated));
  } catch {
    /* ignore storage limits */
  }
  return loadRecentStores(accountId);
};

export const ScreenStoreConnect: React.FC<ScreenStoreConnectProps> = ({
  account,
  onShiftStarted,
  onLogout
}) => {
  const [storeCode, setStoreCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recentStores, setRecentStores] = useState<RecentStoreEntry[]>(() => loadRecentStores(account?.id));
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isCodeValid = useMemo(() => isCompleteStoreCode(storeCode), [storeCode]);
  const fieldStateClass = errorMessage
    ? 'store-connect__field--invalid'
    : isCodeValid
      ? 'store-connect__field--valid'
      : '';

  const handleFormatCode = (val: string) => {
    setStoreCode(prev => normalizeStoreCodeInput(val, prev));
    setErrorMessage(null);
  };

  const handlePasteCode = async () => {
    if (loading) return;
    audioAlert.playClickSound();
    try {
      const clipboardText = await navigator.clipboard?.readText?.();
      const formatted = normalizeStoreCodeInput(clipboardText || '');
      if (!formatted || formatted.length <= 3) {
        setErrorMessage('Nenhum código encontrado na área de transferência.');
        inputRef.current?.focus();
        return;
      }
      setStoreCode(formatted);
      setErrorMessage(null);
      inputRef.current?.focus();
    } catch {
      setErrorMessage('Segure no campo acima para colar o código.');
      inputRef.current?.focus();
    }
  };

  const handleSelectRecent = (code: string) => {
    if (loading) return;
    audioAlert.playClickSound();
    setStoreCode(normalizeStoreCodeInput(code));
    setErrorMessage(null);
  };

  const handleConnectStore = async (codeToUse?: string) => {
    const code = (codeToUse || storeCode).trim().toUpperCase();
    if (!code || code.length < 5) {
      setErrorMessage('Digite o código fornecido pela loja (ex: NW-XXXXXX).');
      audioAlert.playErrorSound();
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    audioAlert.playClickSound();

    try {
      const session = await api.activateStoreShift(code);
      setRecentStores(saveRecentStore(code, session.storeName, account?.id));
      audioAlert.playSuccessSound();
      onShiftStarted(session);
    } catch (err: unknown) {
      audioAlert.playErrorSound();
      const message = err instanceof Error ? err.message : '';
      setErrorMessage(message || 'Código da loja inválido ou não autorizado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="store-connect">
      <header className="store-connect__hero">
        {onLogout && (
          <button
            type="button"
            className="store-connect__logout"
            onClick={() => {
              audioAlert.playClickSound();
              onLogout();
            }}
            aria-label="Sair da conta e voltar ao login"
          >
            <LogOut size={14} aria-hidden="true" />
            <span>Sair</span>
          </button>
        )}
        <img src="/brand/novaesweb-symbol.png" alt="" className="store-connect__logo" />
        <strong>NovaesWeb</strong>
        <span>Entregador</span>
      </header>
      <form className="store-connect__form" onSubmit={event => {
        event.preventDefault();
        if (!loading) void handleConnectStore();
      }}>
        <h1>Conectar à Loja</h1>
        <p>Informe o código da loja para iniciar suas entregas na NovaesWeb.</p>
        <label htmlFor="shift-store-code">Código da Loja</label>
        <div className={`store-connect__field ${fieldStateClass}`.trim()}>
          <Store size={20} aria-hidden="true" />
          <input
            ref={inputRef}
            id="shift-store-code"
            value={storeCode}
            onChange={event => handleFormatCode(event.target.value)}
            placeholder="NW-XXXXXX"
            maxLength={14}
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={Boolean(errorMessage)}
            aria-describedby={errorMessage ? 'shift-error' : 'shift-example'}
          />
          {isCodeValid && !errorMessage && (
            <CheckCircle2 size={18} className="store-connect__valid-icon" aria-hidden="true" />
          )}
          <button
            type="button"
            className="store-connect__paste"
            onClick={() => { void handlePasteCode(); }}
            disabled={loading}
            aria-label="Colar código da loja"
            title="Colar código"
          >
            <ClipboardPaste size={14} aria-hidden="true" />
            <span>Colar</span>
          </button>
        </div>
        {errorMessage ? (
          <div id="shift-error" role="alert"><AlertCircle size={18} /> {errorMessage}</div>
        ) : isCodeValid ? (
          <small id="shift-example" className="store-connect__status store-connect__status--valid">
            Formato válido — toque em Conectar para iniciar
          </small>
        ) : storeCode.length > 0 ? (
          <small id="shift-example" className="store-connect__status">
            Continue após NW- (ex: NW-BELLA ou NW-1049)
          </small>
        ) : (
          <small id="shift-example">Ex: NW-BELLA ou NW-1049</small>
        )}
        {recentStores.length > 0 && (
          <div className="store-connect__recent" aria-label="Últimas lojas conectadas">
            <span className="store-connect__recent-label">
              <History size={13} aria-hidden="true" />
              <span>Última loja:</span>
            </span>
            <div className="store-connect__recent-list">
              {recentStores.map(item => (
                <button
                  key={item.code}
                  type="button"
                  className={`store-connect__recent-chip ${storeCode === item.code ? 'is-selected' : ''}`.trim()}
                  onClick={() => handleSelectRecent(item.code)}
                  disabled={loading}
                >
                  {item.storeName ? `${item.storeName} · ${item.code}` : item.code}
                </button>
              ))}
            </div>
          </div>
        )}
        <button type="submit" className="store-connect__submit" disabled={loading}>
          {loading ? 'Conectando à loja...' : 'Conectar e Iniciar'} <ArrowRight size={21} />
        </button>
      </form>
      <ul className="store-connect__benefits" aria-label="Recursos do plantão">
        <li><Package aria-hidden="true" />Receber pedidos</li>
        <li><Wallet aria-hidden="true" />Ver ganhos</li>
        <li><Bike aria-hidden="true" />Fazer entregas</li>
      </ul>
    </div>
  );
};

export default ScreenStoreConnect;