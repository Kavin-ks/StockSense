import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { AlertBell } from './AlertBell.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { label: 'Operations', children: [
    { to: '/operations/receipts', label: 'Receipts' },
    { to: '/operations/deliveries', label: 'Deliveries' },
    { to: '/operations/transfers', label: 'Internal Transfers' },
    { to: '/operations/adjustments', label: 'Adjustments' },
  ] },
  { label: 'Products', children: [
    { to: '/products', label: 'Products', end: true },
    { to: '/stock', label: 'Stock' },
    { to: '/products/categories', label: 'Categories' },
  ] },
  { to: '/moves', label: 'Move History' },
  { label: 'Settings', children: [
    { to: '/settings/warehouses', label: 'Warehouses' },
    { to: '/settings/locations', label: 'Locations' },
  ] },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const initials = user?.name?.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className={`shell ${open ? 'nav-open' : ''}`}>
      <aside className="sidebar">
        <div className="brand"><img src="/logo.svg" alt="" width="28" height="28" /> StockSense</div>
        <nav onClick={() => setOpen(false)}>
          {NAV.map((item) => item.children ? (
            <div key={item.label} className="nav-group">
              <span className="nav-group-title">{item.label}</span>
              {item.children.map((c) => <NavLink key={c.to} to={c.to} end={c.end} className="nav-link">{c.label}</NavLink>)}
            </div>
          ) : (
            <NavLink key={item.to} to={item.to} end={item.end} className="nav-link">{item.label}</NavLink>
          ))}
        </nav>
        <div className="profile-menu">
          <NavLink to="/profile" className="profile-link" onClick={() => setOpen(false)}>
            <span className="avatar">{initials}</span>
            <span><strong>{user?.name}</strong><small className="muted">My Profile</small></span>
          </NavLink>
          <button className="btn btn-ghost full" onClick={() => { logout(); navigate('/login'); }}>Logout</button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" aria-label="Toggle menu" onClick={() => setOpen((o) => !o)}>☰</button>
          <div className="spacer" />
          <AlertBell />
        </header>
        <main className="content"><Outlet /></main>
      </div>
      {open && <div className="nav-scrim" onClick={() => setOpen(false)} />}
    </div>
  );
}
