import type { FC } from 'react';
import './DriverLoadingSkeleton.css';

export type DriverSkeletonVariant = 'account' | 'dashboard' | 'orders' | 'route' | 'history-summary' | 'history-list';

export const DriverLoadingSkeleton: FC<{ variant: DriverSkeletonVariant }> = ({ variant }) => {
  const onlySummary = variant === 'history-summary';
  const onlyList = variant === 'history-list';
  return (
    <div className={`nw-driver-skeleton nw-driver-skeleton--${variant}`} role="status" aria-label="Carregando informações" aria-busy="true">
      {!onlySummary && !onlyList && <>
        <div className="nw-sk-line nw-sk-heading" />
        <div className="nw-sk-line nw-sk-subheading" />
      </>}
      {!onlyList && (
        <div className="nw-sk-card nw-sk-feature">
          <div className="nw-sk-line nw-sk-label" />
          <div className="nw-sk-line nw-sk-amount" />
          <div className="nw-sk-line nw-sk-footer" />
        </div>
      )}
      {!onlySummary && [1, 2, 3].map(i => (
        <div className="nw-sk-card nw-sk-entry" key={i}>
          <div className="nw-sk-row">
            <div className="nw-sk-icon" />
            <div className="nw-sk-text">
              <div className="nw-sk-line nw-sk-title" />
              <div className="nw-sk-line nw-sk-subheading" />
            </div>
          </div>
          <div className="nw-sk-line nw-sk-footer" />
        </div>
      ))}
      <span className="nw-sk-sr">Buscando as informações, aguarde.</span>
    </div>
  );
};
