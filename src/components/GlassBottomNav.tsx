import type { CSSProperties } from 'react';
import { Home, Package, Navigation, History } from 'lucide-react';
import './GlassBottomNav.css';

export type GlassNavTab = 'dashboard' | 'orders' | 'route' | 'history';

interface GlassBottomNavProps {
  active: GlassNavTab;
  waitingCount: number;
  routeCount: number;
  onNavigate: (tab: GlassNavTab) => void;
}

const tabs = [
  { key: 'dashboard', label: 'Início', Icon: Home },
  { key: 'orders', label: 'Pedidos', Icon: Package },
  { key: 'route', label: 'Minha Rota', Icon: Navigation },
  { key: 'history', label: 'Histórico', Icon: History },
] as const;

function validCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function GlassBottomNav({ active, waitingCount, routeCount, onNavigate }: GlassBottomNavProps) {
  const index = Math.max(0, tabs.findIndex(tab => tab.key === active));
  const counts = { orders: validCount(waitingCount), route: validCount(routeCount) };
  return <nav className="nw-glass-nav" aria-label="Navegação principal" style={{ '--glass-active-index': index } as CSSProperties}>
    <span className="nw-glass-nav-bubble" aria-hidden="true" />
    {tabs.map(({ key, label, Icon }) => {
      const count = key === 'orders' ? counts.orders : key === 'route' ? counts.route : 0;
      const countLabel = key === 'orders'
        ? `${count} ${count === 1 ? 'pedido aguardando retirada' : 'pedidos aguardando retirada'}`
        : `${count} ${count === 1 ? 'entrega na rota' : 'entregas na rota'}`;
      return <button key={key} type="button" className={`nw-glass-nav-tab${active === key ? ' is-selected' : ''}`}
        aria-current={active === key ? 'page' : undefined}
        aria-label={count > 0 ? `${label}, ${countLabel}` : label}
        onClick={() => onNavigate(key)}>
        <span className="nw-glass-nav-icon"><Icon size={22} strokeWidth={active === key ? 2.4 : 1.8} aria-hidden="true" />
          {count > 0 && <span className={`nw-glass-nav-badge${key === 'route' ? ' is-route' : ''}`} aria-hidden="true">{count > 99 ? '99+' : count}</span>}
        </span>
        <span className="nw-glass-nav-label">{label}</span>
      </button>;
    })}
  </nav>;
}
