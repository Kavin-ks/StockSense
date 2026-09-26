import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowDownToLine,
  Truck,
  ArrowLeftRight,
  Scale,
  Package,
  Boxes,
  Tags,
  History,
  Warehouse,
  MapPin,
  LogOut,
  Menu,
  Users
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { AlertBell } from './AlertBell.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';
import { LiveIndicator } from './LiveIndicator.jsx';
import { PendingBadge } from './PendingBadge.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  {
    label: 'Operations',
    children: [
      { to: '/operations/receipts', label: 'Receipts', icon: ArrowDownToLine },
      { to: '/operations/deliveries', label: 'Deliveries', icon: Truck },
      { to: '/operations/transfers', label: 'Internal Transfers', icon: ArrowLeftRight },
      { to: '/operations/adjustments', label: 'Adjustments', icon: Scale },
    ],
  },
  {
    label: 'Products',
    children: [
      { to: '/products', label: 'Products', icon: Package, end: true },
      { to: '/stock', label: 'Stock', icon: Boxes },
      { to: '/products/categories', label: 'Categories', icon: Tags },
    ],
  },
  { to: '/moves', label: 'Move History', icon: History },
  {
    label: 'Settings',
    children: [
      { to: '/settings/warehouses', label: 'Warehouses', icon: Warehouse },
      { to: '/settings/locations', label: 'Locations', icon: MapPin },
      { to: '/settings/users', label: 'Users', icon: Users, permission: 'users.manage', badge: PendingBadge },
    ],
  },
];

export function Layout() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const initials = user?.name?.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className={`shell ${open ? 'nav-open' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <img src="/logo.svg" alt="" width="28" height="28" /> StockSense
        </div>
        <nav onClick={() => setOpen(false)}>
          {NAV.map((item) =>
            item.children ? (
              <div key={item.label} className="nav-group">
                <span className="nav-group-title">{item.label}</span>
                {item.children.filter((c) => !c.permission || can(c.permission)).map((c) => {
                  const Icon = c.icon;
                  return (
                    <NavLink key={c.to} to={c.to} end={c.end} className="nav-link">
                      {Icon && <Icon size={16} className="nav-icon" />}
                      <span>{c.label}</span>
                      {c.badge && <c.badge />}
                    </NavLink>
                  );
                })}
              </div>
            ) : (
              (() => {
                const Icon = item.icon;
                return (
                  <NavLink key={item.to} to={item.to} end={item.end} className="nav-link">
                    {Icon && <Icon size={16} className="nav-icon" />}
                    <span>{item.label}</span>
                  </NavLink>
                );
              })()
            )
          )}
        </nav>
        <div className="profile-menu">
          <NavLink to="/profile" className="profile-link" onClick={() => setOpen(false)}>
            <span className="avatar">{initials}</span>
            <span>
              <strong>{user?.name}</strong>
              <small className="muted">
                <span className={`role-badge role-${user?.role}`}>{user?.role === 'manager' ? 'Manager' : 'Staff'}</span> My Profile
              </small>
            </span>
          </NavLink>
          <button className="btn btn-ghost full" onClick={() => { logout(); navigate('/login'); }}>
            <LogOut size={15} /> Logout
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" aria-label="Toggle menu" onClick={() => setOpen((o) => !o)}>
            <Menu size={20} />
          </button>
          <div className="spacer" />
          <LiveIndicator />
          <ThemeToggle />
          <AlertBell />
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
      {open && <div className="nav-scrim" onClick={() => setOpen(false)} />}
    </div>
  );
}