import { Component, type ErrorInfo, type ReactNode } from 'react';
import { captureError } from '../services/errorReporting';

interface ErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// Evita que uma falha local derrube o aplicativo inteiro.
// Mostra uma recuperação amigável e registra a pilha localmente.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    captureError(error, { componentStack: info.componentStack });
  }

  private handleReset = (): void => {
    this.setState({ hasError: false });
    this.props.onReset?.();
  };

  private handleReload = (): void => {
    try { window.location.reload(); } catch { this.handleReset(); }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="app-container nw-account-wait" role="alert" aria-label="Falha no aplicativo">
          <img className="nw-account-wait-brand" src="/brand/novaesweb-entregador-ui.png" alt="" aria-hidden="true" />
          <div className="card-surface" style={{ margin: 20, padding: 22, textAlign: 'center', display: 'grid', gap: 14 }}>
            <h2 style={{ fontSize: 22 }}>Algo deu errado</h2>
            <p>Nenhum dado seu foi perdido. Tente novamente para continuar suas entregas.</p>
            <button type="button" className="btn-glove btn-glove-accent" onClick={this.handleReload}>Tentar novamente</button>
            <button type="button" className="btn-glove" onClick={this.handleReset}>Continuar mesmo assim</button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
