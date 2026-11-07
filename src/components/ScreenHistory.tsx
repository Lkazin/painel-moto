import React, { useEffect, useState } from 'react';
import {
  History,
  Info
} from 'lucide-react';
import { DeliveryHistoryItem } from '../types';
import { api } from '../services/api';
import { DriverLoadingSkeleton } from './DriverLoadingSkeleton';

export const ScreenHistory: React.FC = () => {
  const [historyItems, setHistoryItems] = useState<DeliveryHistoryItem[]>([]);
  const [totalEarnings, setTotalEarnings] = useState<number>(0);
  const [hasUninformed, setHasUninformed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true); setError(false);
    const fetchData = async () => {
      try {
        const histData = await api.getHistory();
        if (!live) return;
        setHistoryItems(histData.items);
        setTotalEarnings(histData.totalEarnings);
        setHasUninformed(histData.hasUninformedFees);
      } catch (e) {
        if (live) setError(true);
      } finally {
        if (live) setLoading(false);
      }
    };
    fetchData();
    return () => { live = false; };
  }, [attempt]);

  return (
    <div style={{ padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Título da Tela */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'rgba(236, 72, 153, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--nw-pink)'
          }}
        >
          <History size={20} />
        </div>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#ffffff', margin: 0, lineHeight: 1.2 }}>
            Minhas Entregas
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Histórico e ganhos acumulados no turno
          </span>
        </div>
      </div>

      {/* Card Resumo de Ganhos Informados */}
      {loading ? <DriverLoadingSkeleton variant="history-summary" /> : <div
        className="card-surface card-highlight"
        style={{
          padding: '20px',
          borderLeft: '5px solid var(--nw-emerald)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Ganhos Acumulados no Turno
          </span>
          <span
            style={{
              background: 'rgba(16, 185, 129, 0.15)',
              color: 'var(--nw-emerald)',
              fontSize: '11px',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: '8px'
            }}
          >
            {historyItems.length} corridas concluídas
          </span>
        </div>

        <div style={{ marginTop: '8px' }}>
          <span style={{ fontSize: '36px', fontWeight: 900, color: 'var(--nw-emerald)', letterSpacing: '-1px' }}>
            R$ {totalEarnings.toFixed(2).replace('.', ',')}
          </span>
        </div>

        {hasUninformed && (
          <p style={{ fontSize: '11px', color: 'var(--nw-amber)', marginTop: '4px' }}>
            * Algumas entregas não tiveram valor preenchido pela loja e não entraram na soma.
          </p>
        )}

        {/* Aviso de Não Comprovação de Pagamento (Documento 02 v1.1) */}
        <div
          style={{
            marginTop: '12px',
            paddingTop: '10px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            fontSize: '11px',
            color: 'var(--text-subtle)'
          }}
        >
          <Info size={16} color="var(--nw-purple)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            Valores meramente informados pelo funcionário no despacho. O total apresentado não comprova pagamento financeiro nem substitui o acerto com a loja.
          </span>
        </div>
      </div>}

      {/* Lista do Histórico de Entregas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-muted)' }}>
          Últimas Entregas Realizadas
        </h3>

        {loading ? (
          <DriverLoadingSkeleton variant="history-list" />
        ) : error ? (
          <div className="card-surface" role="alert" style={{ padding: 24 }}><p>Não foi possível carregar o histórico. Confira sua conexão.</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</button></div>
        ) : historyItems.length === 0 ? (
          <div className="card-surface" style={{ textAlign: 'center', padding: '24px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Nenhuma entrega finalizada nesta sessão ainda.
            </p>
          </div>
        ) : (
          historyItems.map((item) => (
            <div key={item.id} className="card-surface" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 900, color: '#ffffff' }}>
                    {item.orderNumber}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>
                    {item.storeName}
                  </span>
                </div>

                {typeof item.deliveryFee === 'number' && Number.isFinite(item.deliveryFee) ? (
                  <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--nw-emerald)' }}>
                    R$ {item.deliveryFee.toFixed(2).replace('.', ',')}
                  </span>
                ) : (
                  <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>
                    Sem valor
                  </span>
                )}
              </div>

              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                📍 {item.address} ({item.neighborhood})
              </p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: 'var(--text-subtle)' }}>
                <span>
                  {Number.isFinite(Date.parse(item.completedAt)) ? new Date(item.completedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Horário não informado'}
                </span>
                <span style={{ color: item.confirmedVia === 'pin_offline_synced' ? 'var(--nw-amber)' : 'var(--text-muted)' }}>
                  {item.confirmedVia === 'pin_offline_synced' ? 'PIN (Sincronizado Offline)' : item.confirmedVia === 'pin_online' ? 'PIN Validado Online' : item.confirmedVia === 'store_override' ? 'Confirmado pela loja' : 'Confirmação não informada'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
