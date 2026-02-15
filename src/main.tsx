import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { initStores } from './store/initDB';
import { runMigration } from './store/runMigration';
import App from './App';
import './index.css';

async function bootstrap(): Promise<void> {
  await initStores();
  runMigration();
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'system-ui', background: '#101622', color: '#f1f5f9', minHeight: '100vh' }}>
          <h1 style={{ color: '#ef4444' }}>Something went wrong</h1>
          <pre style={{ overflow: 'auto', background: '#1a2436', padding: 16, borderRadius: 8 }}>{this.state.error.message}</pre>
          <pre style={{ fontSize: 12, color: '#92a4c9' }}>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

bootstrap().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
});
