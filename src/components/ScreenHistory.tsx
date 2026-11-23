import React, { useEffect, useMemo, useState } from 'react';
import {
  History,
  Info,
  Download,
  RefreshCw,
  Search,
  ChevronDown,
  X
} from 'lucide-react';
import { DeliveryHistoryItem } from '../types';
import { api } from '../services/api';
import { audioAlert } from '../utils/audioAlert';
import { DriverLoadingSkeleton } from './DriverLoadingSkeleton';
import { buildHistoryCsv, historyCsvFileName } from '../services/historyExport';
import { readCachedHistory, saveCachedHistory } from '../services/driverDataSnapshot';

export const ScreenHistory: React.FC = () => {
  const accountId = api.getDriverAccount()?.id;
  const storeId = api.getSession()?.storeId;
  const initialCached = readCachedHistory(accountId, storeId);
  const [historyItems, setHistoryItems] = useState<DeliveryHistoryItem[]>(() => initialCached?.items || []);
  const [totalEarnings, setTotalEarnings] = useState<number>(() => initialCached?.totalEarnings || 0);
  const [hasUninformed, setHasUninformed] = useState<boolean>(() => initialCached?.hasUninformedFees || false);
  const [loading, setLoading] = useState<boolean>(() => !initialCached);
  const [error, setError] = useState(false);
  const [usingCachedFallback, setUsingCachedFallback] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    const cached = readCachedHistory(accountId, storeId);
    setLoading(!cached);
    setError(false);
    setUsingCachedFallback(false);
    const fetchData = async () => {
      try {
        const histData = await api.getHistory();
        if (!live) return;
        setHistoryItems(histData.items);
        setTotalEarnings(histData.totalEarnings);
        setHasUninformed(histData.hasUninformedFees);
        setUsingCachedFallback(false);
        saveCachedHistory(accountId, storeId, histData);
      } catch {
        if (!live) return;
        if (readCachedHistory(accountId, storeId)) {
          setUsingCachedFallback(true);
        } else {
          setError(true);
        }
      } finally {
        if (live) setLoading(false);
      }
    };
    fetchData();
    return () => { live = false; };
  }, [attempt, accountId, storeId]);

  const [exported, setExported] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'with_fee' | 'offline_pin'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const visibleHistoryItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('pt-BR');
    return historyItems.filter(item => {
      if (filterMode === 'with_fee' && !(typeof item.deliveryFee === 'number' && Number.isFinite(item.deliveryFee) && item.deliveryFee > 0)) {
        return false;
      }
      if (filterMode === 'offline_pin' && item.confirmedVia !== 'pin_offline_synced') {
        return false;
      }
      if (!query) return true;
      return [item.orderNumber, item.address, item.neighborhood, item.storeName]
        .some(field => String(field || '').toLocaleLowerCase('pt-BR').includes(query));
    });
  }, [historyItems, filterMode, searchQuery]);

  const handleExport = async () => {
    const csv = buildHistoryCsv(historyItems);
    const fileName = historyCsvFileName();
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        const file = new File([`\uFEFF${csv}`], fileName, { type: 'text/csv;charset=utf-8' });
        const canShareFiles = typeof (navigator as any).canShare === 'function' && (navigator as any).canShare({ files: [file] });
        if (canShareFiles) {
          await navigator.share({ title: 'Histórico de entregas', files: [file] });
          setExported(true);
          setTimeout(() => setExported(false), 2500);
          return;
        }
      }
    } catch {
      /* Segue para o download direto caso o compartilhamento nativo seja cancelado ou indisponível. */
    }
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExported(true);
    setTimeout(() => setExported(false), 2500);
  };

  return (
    <div style={{ padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Título da Tela */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
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
        <button
          type="button"
          onClick={() => {
            audioAlert.playClickSound();
            setAttempt(value => value + 1);
          }}
          disabled={loading}
          aria-label="Atualizar histórico de entregas"
          title="Atualizar histórico"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            minHeight: '38px',
            padding: '0 12px',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            fontSize: '12px',
            fontWeight: 700,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.65 : 1
          }}
        >
          <RefreshCw size={14} />
          <span>Atualizar</span>
        </button>
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

        <button
          type="button"
          onClick={handleExport}
          disabled={loading || historyItems.length === 0}
          style={{
            marginTop: '12px',
            width: '100%',
            height: '46px',
            borderRadius: '12px',
            border: '1px solid var(--nw-emerald)',
            background: 'rgba(16, 185, 129, 0.16)',
            color: 'var(--nw-emerald)',
            fontSize: '13px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '7px',
            cursor: loading || historyItems.length === 0 ? 'not-allowed' : 'pointer',
            opacity: loading || historyItems.length === 0 ? 0.55 : 1
          }}
        >
          <Download size={16} />
          <span>{exported ? 'Planilha baixada' : 'Baixar planilha (CSV)'}</span>
        </button>

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-muted)', margin: 0 }}>
            Últimas Entregas Realizadas
          </h3>
          {historyItems.length > 0 && (
            <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>
              {visibleHistoryItems.length} de {historyItems.length}
            </span>
          )}
        </div>

        {historyItems.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0 12px',
                minHeight: '42px',
                borderRadius: '12px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-card)'
              }}
            >
              <Search size={16} color="var(--text-subtle)" aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="Buscar pedido, bairro ou loja..."
                aria-label="Buscar entregas no histórico"
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: 'transparent',
                  border: 0,
                  outline: 'none',
                  color: '#ffffff',
                  font: 'inherit',
                  fontSize: '13px'
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Limpar busca"
                  style={{ background: 'none', border: 0, color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'grid', placeItems: 'center' }}
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }} role="group" aria-label="Filtrar histórico">
              {([
                { key: 'all', label: 'Todas' },
                { key: 'with_fee', label: 'Com taxa' },
                { key: 'offline_pin', label: 'PIN offline' }
              ] as const).map(tab => {
                const active = filterMode === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      audioAlert.playClickSound();
                      setFilterMode(tab.key);
                    }}
                    style={{
                      minHeight: '32px',
                      padding: '4px 12px',
                      borderRadius: '999px',
                      border: `1px solid ${active ? 'var(--nw-pink)' : 'var(--border-subtle)'}`,
                      background: active ? 'rgba(236, 72, 153, 0.2)' : 'var(--bg-card)',
                      color: active ? '#ffffff' : 'var(--text-muted)',
                      font: 'inherit',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {usingCachedFallback && (
          <p className="card-surface" role="status" style={{ fontSize: '12px', color: 'var(--nw-amber)', padding: '10px 12px', margin: 0 }}>
            Sem conexão com a loja no momento · exibindo histórico salvo neste aparelho.
          </p>
        )}

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
        ) : visibleHistoryItems.length === 0 ? (
          <div className="card-surface" style={{ textAlign: 'center', padding: '20px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              Nenhuma entrega encontrada para esse filtro.
            </p>
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setFilterMode('all'); }}
              style={{ marginTop: '10px', background: 'none', border: 0, color: 'var(--nw-pink)', fontWeight: 700, fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Limpar filtros
            </button>
          </div>
        ) : (
          visibleHistoryItems.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
              <div key={item.id} className="card-surface" style={{ padding: '14px 16px' }}>
                <button
                  type="button"
                  onClick={() => {
                    audioAlert.playClickSound();
                    setExpandedId(prev => (prev === item.id ? null : item.id));
                  }}
                  aria-expanded={isExpanded}
                  style={{
                    width: '100%',
                    padding: 0,
                    margin: 0,
                    background: 'transparent',
                    border: 0,
                    color: 'inherit',
                    textAlign: 'left',
                    font: 'inherit',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px', fontWeight: 900, color: '#ffffff' }}>
                        {item.orderNumber}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>
                        {item.storeName}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {typeof item.deliveryFee === 'number' && Number.isFinite(item.deliveryFee) ? (
                        <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--nw-emerald)' }}>
                          R$ {item.deliveryFee.toFixed(2).replace('.', ',')}
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>
                          Sem valor
                        </span>
                      )}
                      <ChevronDown
                        size={16}
                        color="var(--text-subtle)"
                        style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 160ms ease' }}
                        aria-hidden="true"
                      />
                    </div>
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
                </button>

                {isExpanded && (
                  <div
                    style={{
                      marginTop: '10px',
                      paddingTop: '10px',
                      borderTop: '1px solid var(--border-subtle)',
                      display: 'grid',
                      gap: '4px',
                      fontSize: '12px',
                      color: 'var(--text-muted)'
                    }}
                  >
                    <div><strong style={{ color: '#ffffff' }}>Loja:</strong> {item.storeName || 'Não informada'}</div>
                    <div><strong style={{ color: '#ffffff' }}>Endereço:</strong> {[item.address, item.neighborhood].filter(Boolean).join(' · ') || 'Não informado'}</div>
                    <div><strong style={{ color: '#ffffff' }}>Situação:</strong> {item.status === 'delivered' ? 'Entregue' : item.status === 'canceled_by_store' ? 'Cancelado pela loja' : 'Desistência'}</div>
                    <div>
                      <strong style={{ color: '#ffffff' }}>Concluído em:</strong>{' '}
                      {Number.isFinite(Date.parse(item.completedAt))
                        ? new Date(item.completedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : 'Não informado'}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
