export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand center"><img src="/logo.svg" alt="" width="40" height="40" /><span>StockSense</span></div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
