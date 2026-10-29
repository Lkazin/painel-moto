import React, { useEffect, useState } from 'react';
import {
  History,
  Star,
  DollarSign,
  Package,
  TrendingUp,
  Calendar,
  ShieldCheck,
  Info,
  Clock,
  ArrowUpRight
} from 'lucide-react';
import { DeliveryHistoryItem, RatingsData } from '../types';
import { api } from '../services/api';

export const ScreenHistory: React.FC = () => {
  const [historyItems, setHistoryItems] = useState<DeliveryHistoryItem[]>([]);
  const [totalEarnings, setTotalEarnings] = useState<number>(0);
  const [hasUninformed, setHasUninformed] = useState<boolean>(false);
  const [ratings, setRatings] = useState<RatingsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'deliveries' | 'ratings'>('deliveries');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [histData, ratData] = await Promise.all([
          api.getHistory(),
          api.getRatings()
        ]);
        setHistoryItems(histData.items);
        setTotalEarnings(histData.totalEarnings);
        setHasUninformed(histData.hasUninformedFees);
        setRatings(ratData);
      } catch (e) {
        console.error('Erro ao buscar histórico:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div style={{ padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Abas Superiores */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          background: 'var(--bg-card)',
          padding: '4px',
          borderRadius: '16px'
        }}
      >
        <button
          onClick={() => setActiveTab('deliveries')}
          style={{
            background: activeTab === 'deliveries' ? 'var(--nw-pink)' : 'transparent',
            color: activeTab === 'deliveries' ? '#ffffff' : 'var(--text-muted)',
            border: 'none',
            padding: '12px 8px',
            borderRadius: '12px',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <History size={16} />
          <span>Minhas Entregas</span>
        </button>

        <button
          onClick={() => setActiveTab('ratings')}
          style={{
            background: activeTab === 'ratings' ? 'var(--nw-purple)' : 'transparent',
            color: activeTab === 'ratings' ? '#ffffff' : 'var(--text-muted)',
            border: 'none',
            padding: '12px 8px',
            borderRadius: '12px',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <Star size={16} />
          <span>Avaliações da Loja</span>
        </button>
      </div>

      {activeTab === 'deliveries' ? (
        <>
          {/* Card Resumo de Ganhos Informados */}
          <div
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
          </div>

          {/* Lista do Histórico de Entregas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-muted)' }}>
              Últimas Entregas Realizadas
            </h3>

            {historyItems.length === 0 ? (
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

                    {item.deliveryFee !== null ? (
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
                      {new Date(item.completedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span style={{ color: item.confirmedVia.includes('offline') ? 'var(--nw-amber)' : 'var(--nw-emerald)' }}>
                      {item.confirmedVia === 'pin_offline_synced' ? 'PIN (Sincronizado Offline)' : 'PIN Validado Online'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        /* Aba de Avaliações (Estritamente sem comentários escritos) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {ratings ? (
            <>
              <div className="card-surface" style={{ textAlign: 'center', padding: '24px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Média de Avaliações dos Clientes
                </span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '8px' }}>
                  <span style={{ fontSize: '48px', fontWeight: 900, color: '#facc15' }}>
                    {ratings.averageStars.toFixed(1)}
                  </span>
                  <Star size={36} color="#facc15" fill="#facc15" />
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Baseado em <strong>{ratings.totalRatings} avaliações</strong> nos {ratings.period.toLowerCase()}
                </p>
              </div>

              {/* Distribuição de Estrelas */}
              <div className="card-surface" style={{ padding: '16px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 800, marginBottom: '12px', color: 'var(--text-muted)' }}>
                  Distribuição de Notas
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {ratings.distribution.map((d) => (
                    <div key={d.star} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
                      <span style={{ width: '42px', fontWeight: 700 }}>{d.star} ★</span>
                      <div style={{ flex: 1, height: '8px', background: 'var(--bg-app)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${d.percentage}%`,
                            height: '100%',
                            background: d.star >= 4 ? 'var(--nw-emerald)' : 'var(--nw-amber)',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                      <span style={{ width: '30px', textAlign: 'right', color: 'var(--text-subtle)' }}>
                        {d.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Informação sobre ausência de comentários escritos (Documento 02 v1.1) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(139, 92, 246, 0.08)',
                  padding: '12px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  color: 'var(--text-subtle)'
                }}
              >
                <ShieldCheck size={16} color="var(--nw-purple)" style={{ flexShrink: 0 }} />
                <span>
                  Por diretriz de privacidade do NovaesWeb Entregador, o aplicativo apresenta exclusivamente a média numérica e quantidade de estrelas, sem exibição de comentários de texto.
                </span>
              </div>
            </>
          ) : (
            <div className="card-surface" style={{ textAlign: 'center', padding: '24px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Nenhuma avaliação registrada ainda para este período.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
