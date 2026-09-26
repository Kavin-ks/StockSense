import { ThemeToggle } from '../../components/ThemeToggle.jsx';

export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="auth-page">
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <ThemeToggle />
      </div>
      <div className="auth-card">
        <div className="brand center"><img src="/logo.png" alt="StockSense" className="auth-logo" width="44" height="44" /><span>StockSense</span></div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
