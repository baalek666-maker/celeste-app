import { Component, type ReactNode } from 'react';
import { captureError } from '../lib/monitoring';

interface Props {
  children: ReactNode;
  fallback?: (err: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches any uncaught render error in the children tree and displays a
 * recoverable fallback instead of crashing the whole app to a blank screen.
 * React 19 also has errorInfo support; we keep the API minimal here.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    captureError(error, { componentStack: info.componentStack });
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-night-100 cosmic-bg star-field">
        <div className="glass rounded-3xl p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">🌙</div>
          <h1 className="text-xl font-bold mb-2 text-gold-gradient">Une étincelle s'est éteinte</h1>
          <p className="text-night-300 text-sm mb-6">
            L'application a rencontré un imprévu. Tu peux réessayer sans perdre tes données.
          </p>
          {/* Debug: TOUJOURS afficher en prod (pas que DEV) pour pouvoir diagnostiquer */}
          <details className="text-left text-xs text-red-300 bg-night-900/60 rounded-xl p-3 mb-4">
            <summary className="cursor-pointer text-night-400 mb-1">Détails techniques</summary>
            <div className="font-bold mb-2 text-red-200">{this.state.error.name}: {this.state.error.message}</div>
            <pre className="overflow-auto max-h-60 text-[10px] text-night-300 whitespace-pre-wrap">{this.state.error.stack}</pre>
          </details>
          <button onClick={this.reset}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-cosmic-600 to-cosmic-700 text-white font-semibold">
            Réessayer
          </button>
        </div>
      </div>
    );
  }
}