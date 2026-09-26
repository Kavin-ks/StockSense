import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('StockSense caught an unhandled rendering error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-screen" role="alert">
          <div className="error-boundary-card">
            <div className="error-boundary-icon-box">
              <AlertTriangle size={36} className="text-danger" />
            </div>
            <h1>Something unexpected happened</h1>
            <p className="muted">
              StockSense ran into an issue while displaying this page. Your data is safe.
            </p>

            <div className="error-boundary-actions">
              <button type="button" className="btn btn-primary" onClick={this.handleReset}>
                <RefreshCw size={15} /> Reload Application
              </button>
              <button type="button" className="btn btn-secondary" onClick={this.handleHome}>
                <Home size={15} /> Return to Dashboard
              </button>
            </div>

            {this.state.error && (
              <details className="error-boundary-details">
                <summary>Technical Details</summary>
                <pre>{this.state.error.toString()}</pre>
                {this.state.errorInfo?.componentStack && (
                  <pre className="stack-trace">{this.state.errorInfo.componentStack}</pre>
                )}
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
