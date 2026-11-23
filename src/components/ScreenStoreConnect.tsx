import './ScreenStoreConnect.css';
import React, { useState } from 'react';
import { AlertCircle, ArrowRight, Bike, Package, Store, Wallet } from 'lucide-react';
import { DriverAccount, DriverSession } from '../types';
import { api } from '../services/api';
import { audioAlert } from '../utils/audioAlert';

interface ScreenStoreConnectProps {
  account?: DriverAccount;
  onShiftStarted: (session: DriverSession) => void;
}

export const ScreenStoreConnect: React.FC<ScreenStoreConnectProps> = ({
  onShiftStarted
}) => {
  const [storeCode, setStoreCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const handleFormatCode = (val: string) => {
    let clean = val.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (!clean.startsWith('NW-') && clean.length > 0) {
      if (clean.startsWith('NW')) {
        clean = 'NW-' + clean.substring(2);
      } else {
        clean = 'NW-' + clean.replace(/-/g, '');
      }
    }
    setStoreCode(clean);
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
      audioAlert.playSuccessSound();
      onShiftStarted(session);
    } catch (err: any) {
      audioAlert.playErrorSound();
      setErrorMessage(err.message || 'Código da loja inválido ou não autorizado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="store-connect">
      <div className="store-connect__hero" role="img" aria-label="NovaesWeb Entregador. Motoboy ao pôr do sol." />
      <form className="store-connect__form" onSubmit={event => {
        event.preventDefault();
        if (!loading) void handleConnectStore();
      }}>
        <h1>Conectar à Loja</h1>
        <p>Informe o código da loja para iniciar suas entregas na NovaesWeb.</p>
        <label htmlFor="shift-store-code">Código da Loja</label>
        <div className="store-connect__field">
          <Store size={22} aria-hidden="true" />
          <input id="shift-store-code" value={storeCode} onChange={event => handleFormatCode(event.target.value)}
            placeholder="NW-XXXXXX" maxLength={14} autoCapitalize="characters" spellCheck={false}
            aria-invalid={Boolean(errorMessage)} aria-describedby={errorMessage ? 'shift-error' : 'shift-example'} />
        </div>
        {errorMessage && <div id="shift-error" role="alert"><AlertCircle size={18} /> {errorMessage}</div>}
        <button type="submit" disabled={loading}>
          {loading ? 'Conectando à loja...' : 'Conectar e Iniciar'} <ArrowRight size={21} />
        </button>
        <small id="shift-example">Ex: NW-BELLA ou NW-1049</small>
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