import { useState, useRef, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
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
  BarChart3,
  LogOut,
  Warehouse,
  MapPin,
  ChevronDown,
  User,
  Menu,
  X,
  ShieldCheck,
  Users
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { AlertBell } from './AlertBell.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';
import { PendingBadge } from './PendingBadge.jsx';

const MOBILE_NAV = [
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
      { to: '/stock', label: 'Stock Quants', icon: Boxes },
      { to: '/products/categories', label: 'Categories', icon: Tags },
      { to: '/moves', label: 'Move History', icon: History },
      { to: '/reports', label: 'Reports & Counts', icon: BarChart3 },
    ],
  },
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
  const location = useLocation();

  const [activeDropdown, setActiveDropdown] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navRef = useRef(null);
  const closeTimerRef = useRef(null);

  const pathname = location.pathname;

  // Active state checkers
  const isOperationsActive = pathname.startsWith('/operations');
  const isProductsActive =
    pathname.startsWith('/products') ||
    pathname.startsWith('/stock') ||
    pathname.startsWith('/moves') ||
    pathname.startsWith('/reports');
  const isSettingsActive = pathname.startsWith('/settings');
  const isProfileActive = pathname.startsWith('/profile');

    // Sliding Liquid Glass Tracker Button
  const menuContainerRef = useRef(null);
  const dashboardRef = useRef(null);
  const operationsRef = useRef(null);
  const productsRef = useRef(null);
  const settingsRef = useRef(null);

  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0, opacity: 0 });

  // Determine which nav section is active or hovered
  let currentSection = 'dashboard';
  if (activeDropdown === 'operations' || (!activeDropdown && isOperationsActive)) {
    currentSection = 'operations';
  } else if (activeDropdown === 'products' || (!activeDropdown && isProductsActive)) {
    currentSection = 'products';
  } else if (activeDropdown === 'settings' || (!activeDropdown && isSettingsActive)) {
    currentSection = 'settings';
  } else if (pathname === '/' || pathname === '/dashboard') {
    currentSection = 'dashboard';
  }

  const updatePill = useCallback(() => {
    let targetEl = null;
    if (currentSection === 'dashboard') targetEl = dashboardRef.current;
    else if (currentSection === 'operations') targetEl = operationsRef.current;
    else if (currentSection === 'products') targetEl = productsRef.current;
    else if (currentSection === 'settings') targetEl = settingsRef.current;

    const containerEl = menuContainerRef.current;
    if (targetEl && containerEl) {
      const targetRect = targetEl.getBoundingClientRect();
      const containerRect = containerEl.getBoundingClientRect();
      setPillStyle({
        left: targetRect.left - containerRect.left,
        width: targetRect.width,
        opacity: 1,
      });
    }
  }, [currentSection]);

  useEffect(() => {
    updatePill();
    const timer = setTimeout(updatePill, 50);
    window.addEventListener('resize', updatePill);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePill);
    };
  }, [updatePill]);

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menus when route changes
  useEffect(() => {
    setActiveDropdown(null);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleMouseEnter = (menuName) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setActiveDropdown(menuName);
  };

  const handleMouseLeave = () => {
    closeTimerRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 180);
  };

  const toggleDropdown = (menuName) => {
    setActiveDropdown((prev) => (prev === menuName ? null : menuName));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      {/* ========================================================
          TOP HORIZONTAL NAVIGATION HEADER
      ======================================================== */}
      <header className="top-nav-header" ref={navRef}>
        <div className="top-nav-inner">
          {/* Left: Brand */}
          <div className="top-nav-left">
            <button
              type="button"
              className="top-mobile-toggle"
              aria-label="Toggle navigation menu"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={22} />
            </button>

            <NavLink to="/" className="top-nav-brand">
              <img src="/logo.svg" alt="StockSense" width="28" height="28" />
              <span className="brand-text">StockSense</span>
            </NavLink>
          </div>

          {/* Center: Navigation Links & Single-Column Dropdowns */}
          <nav
            ref={menuContainerRef}
            className="top-nav-menu"
            aria-label="Main Navigation"
          >
            {/* Sliding Liquid Glass Nav Track Button */}
            <div
              className="nav-track-button"
              style={{
                left: `${pillStyle.left}px`,
                width: `${pillStyle.width}px`,
                opacity: pillStyle.opacity,
              }}
              aria-hidden="true"
            />

            {/* 1. Dashboard */}
            <NavLink
              ref={dashboardRef}
              to="/"
              end
              className={({ isActive }) =>
                `top-nav-link ${isActive ? 'active' : ''}`
              }
              onClick={() => setActiveDropdown(null)}
            >
              <LayoutDashboard size={16} className="nav-item-icon" />
              <span>Dashboard</span>
            </NavLink>

            {/* 2. Operations Dropdown (Single Column - One under another) */}
            <div
              className={`top-nav-dropdown-wrap ${
                activeDropdown === 'operations' ? 'open' : ''
              }`}
              onMouseEnter={() => handleMouseEnter('operations')}
              onMouseLeave={handleMouseLeave}
            >
              <button
                ref={operationsRef}
                type="button"
                className={`top-nav-link dropdown-trigger ${
                  isOperationsActive || activeDropdown === 'operations' ? 'active' : ''
                }`}
                onClick={() => toggleDropdown('operations')}
                aria-expanded={activeDropdown === 'operations'}
              >
                <ArrowDownToLine size={16} className="nav-item-icon" />
                <span>Operations</span>
                <ChevronDown
                  size={14}
                  className={`chevron-icon ${
                    activeDropdown === 'operations' ? 'rotated' : ''
                  }`}
                />
              </button>

              {activeDropdown === 'operations' && (
                <div className="nav-dropdown-panel">
                  <div className="dropdown-items-list">
                    <NavLink
                      to="/operations/receipts"
                      className={({ isActive }) =>
                        `dropdown-item-row ${isActive ? 'active' : ''}`
                      }
                      onClick={() => setActiveDropdown(null)}
                    >
                      <div className="dropdown-icon-box in">
                        <ArrowDownToLine size={18} />
                      </div>
                      <div className="dropdown-item-details">
                        <div className="dropdown-item-title">Receipts</div>
                        <div className="dropdown-item-desc">
                          Inward vendor deliveries & dock receiving
                        </div>
                      </div>
                    </NavLink>

                    <NavLink
                      to="/operations/deliveries"
                      className={({ isActive }) =>
                        `dropdown-item-row ${isActive ? 'active' : ''}`
                      }
                      onClick={() => setActiveDropdown(null)}
                    >
                      <div className="dropdown-icon-box out">
                        <Truck size={18} />
                      </div>
                      <div className="dropdown-item-details">
                        <div className="dropdown-item-title">Deliveries</div>
                        <div className="dropdown-item-desc">
                          Outward picking, packing & shipment dispatch
                        </div>
                      </div>
                    </NavLink>

                    <NavLink
                      to="/operations/transfers"
                      className={({ isActive }) =>
                        `dropdown-item-row ${isActive ? 'active' : ''}`
                      }
                      onClick={() => setActiveDropdown(null)}
                    >
                      <div className="dropdown-icon-box transfer">
                        <ArrowLeftRight size={18} />
                      </div>
                      <div className="dropdown-item-details">
                        <div className="dropdown-item-title">Internal Transfers</div>
                        <div className="dropdown-item-desc">
                          Inter-location relocations & bin replenishments
                        </div>
                      </div>
                    </NavLink>

                    <NavLink
                      to="/operations/adjustments"
                      className={({ isActive }) =>
                        `dropdown-item-row ${isActive ? 'active' : ''}`
                      }
                      onClick={() => setActiveDropdown(null)}
                    >
                      <div className="dropdown-icon-box adjustment">
                        <Scale size={18} />
                      </div>
                      <div className="dropdown-item-details">
                        <div className="dropdown-item-title">Adjustments</div>
                        <div className="dropdown-item-desc">
                          Physical cycle counts & stock discrepancy fixes
                        </div>
                      </div>
                    </NavLink>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Products Dropdown (Single Column - One under another) */}
            <div
              className={`top-nav-dropdown-wrap ${
                activeDropdown === 'products' ? 'open' : ''
              }`}
              onMouseEnter={() => handleMouseEnter('products')}
              onMouseLeave={handleMouseLeave}
            >
              <button
                ref={productsRef}
                type="button"
                className={`top-nav-link dropdown-trigger ${
                  isProductsActive || activeDropdown === 'products' ? 'active' : ''
                }`}
                onClick={() => toggleDropdown('products')}
                aria-expanded={activeDropdown === 'products'}
              >
                <Package size={16} className="nav-item-icon" />
                <span>Products</span>
                <ChevronDown
                  size={14}
                  className={`chevron-icon ${
                    activeDropdown === 'products' ? 'rotated' : ''
                  }`}
                />
              </button>

              {activeDropdown === 'products' && (
                <div className="nav-dropdown-panel">
                  <div className="dropdown-items-list">
                    <NavLink
                      to="/products"
                      end
                      className={({ isActive }) =>
                        `dropdown-item-row ${isActive ? 'active' : ''}`
                      }
                      onClick={() => setActiveDropdown(null)}
                    >
                      <div className="dropdown-icon-box product">
                        <Package size={18} />
                      </div>
                      <div className="dropdown-item-details">
                        <div className="dropdown-item-title">Products</div>
                        <div className="dropdown-item-desc">
                          Master SKU registry, barcodes & reorder rules
                        </div>
                      </div>
                    </NavLink>

                    <NavLink
                      to="/stock"
                      className={({ isActive }) =>
                        `dropdown-item-row ${isActive ? 'active' : ''}`
                      }
                      onClick={() => setActiveDropdown(null)}
                    >
                      <div className="dropdown-icon-box stock">
                        <Boxes size={18} />
                      </div>
                      <div className="dropdown-item-details">
                        <div className="dropdown-item-title">Stock Quants</div>
                        <div className="dropdown-item-desc">
                          Real-time on-hand balances by storage location
                        </div>
                      </div>
                    </NavLink>

                    <NavLink
                      to="/products/categories"
                      className={({ isActive }) =>
                        `dropdown-item-row ${isActive ? 'active' : ''}`
                      }
                      onClick={() => setActiveDropdown(null)}
                    >
                      <div className="dropdown-icon-box category">
                        <Tags size={18} />
                      </div>
                      <div className="dropdown-item-details">
                        <div className="dropdown-item-title">Categories</div>
                        <div className="dropdown-item-desc">
                          Product taxonomy, families & classification
                        </div>
                      </div>
                    </NavLink>

                    <NavLink
                      to="/moves"
                      className={({ isActive }) =>
                        `dropdown-item-row ${isActive ? 'active' : ''}`
                      }
                      onClick={() => setActiveDropdown(null)}
                    >
                      <div className="dropdown-icon-box moves">
                        <History size={18} />
                      </div>
                      <div className="dropdown-item-details">
                        <div className="dropdown-item-title">Move History</div>
                        <div className="dropdown-item-desc">
                          Immutable stock ledger & full movement traceability
                        </div>
                      </div>
                    </NavLink>

                    <NavLink
                      to="/reports"
                      className={({ isActive }) =>
                        `dropdown-item-row ${isActive ? 'active' : ''}`
                      }
                      onClick={() => setActiveDropdown(null)}
                    >
                      <div className="dropdown-icon-box reports">
                        <BarChart3 size={18} />
                      </div>
                      <div className="dropdown-item-details">
                        <div className="dropdown-item-title">Reports &amp; Counts</div>
                        <div className="dropdown-item-desc">
                          Top movers, days of cover, dead stock & cycle counts
                        </div>
                      </div>
                    </NavLink>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Settings Dropdown (Single Column - One under another) */}
            <div
              className={`top-nav-dropdown-wrap ${
                activeDropdown === 'settings' ? 'open' : ''
              }`}
              onMouseEnter={() => handleMouseEnter('settings')}
              onMouseLeave={handleMouseLeave}
            >
              <button
                ref={settingsRef}
                type="button"
                className={`top-nav-link dropdown-trigger ${
                  isSettingsActive || activeDropdown === 'settings' ? 'active' : ''
                }`}
                onClick={() => toggleDropdown('settings')}
                aria-expanded={activeDropdown === 'settings'}
              >
                <Warehouse size={16} className="nav-item-icon" />
                <span>Settings</span>
                <ChevronDown
                  size={14}
                  className={`chevron-icon ${
                    activeDropdown === 'settings' ? 'rotated' : ''
                  }`}
                />
              </button>

              {activeDropdown === 'settings' && (
                <div className="nav-dropdown-panel">
                  <div className="dropdown-items-list">
                    <NavLink
                      to="/settings/warehouses"
                      className={({ isActive }) =>
                        `dropdown-item-row ${isActive ? 'active' : ''}`
                      }
                      onClick={() => setActiveDropdown(null)}
                    >
                      <div className="dropdown-icon-box warehouses"><Warehouse size={18} /></div>
                      <div className="dropdown-item-details">
                        <div className="dropdown-item-title">Warehouses</div>
                        <div className="dropdown-item-desc">
                          Physical distribution hubs & facility codes
                        </div>
                      </div>
                    </NavLink>

                    <NavLink
                      to="/settings/locations"
                      className={({ isActive }) =>
                        `dropdown-item-row ${isActive ? 'active' : ''}`
                      }
                      onClick={() => setActiveDropdown(null)}
                    >
                      <div className="dropdown-icon-box locations"><MapPin size={18} /></div>
                      <div className="dropdown-item-details">
                        <div className="dropdown-item-title">Locations</div>
                        <div className="dropdown-item-desc">
                          Internal storage aisles, zones, shelves & bins
                        </div>
                      </div>
                    </NavLink>

                    {can('users.manage') && (
                      <NavLink
                        to="/settings/users"
                        className={({ isActive }) =>
                          `dropdown-item-row ${isActive ? 'active' : ''}`
                        }
                        onClick={() => setActiveDropdown(null)}
                      >
                        <div className="dropdown-icon-box users"><Users size={18} /></div>
                        <div className="dropdown-item-details">
                          <div className="dropdown-item-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            Users <PendingBadge />
                          </div>
                          <div className="dropdown-item-desc">
                            Team members, roles & pending approvals
                          </div>
                        </div>
                      </NavLink>
                    )}
                  </div>
                </div>
              )}
            </div>
          </nav>

          {/* Right Section: Theme Toggle, Notifications & User Profile */}
          <div className="top-nav-right">
            <ThemeToggle />
            <AlertBell />

            {/* User Profile Pill & Dropdown */}
            <div
              className={`top-user-wrap ${
                activeDropdown === 'user' ? 'open' : ''
              }`}
              onMouseEnter={() => handleMouseEnter('user')}
              onMouseLeave={handleMouseLeave}
            >
              <button
                type="button"
                className={`top-user-pill icon-only ${isProfileActive ? 'active' : ''}`}
                onClick={() => toggleDropdown('user')}
                aria-expanded={activeDropdown === 'user'}
                title={user?.name || 'Account'}
                aria-label="User profile and settings"
              >
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user?.name} className="top-user-avatar-img" />
                ) : (
                  <span className="top-user-avatar">{initials}</span>
                )}
              </button>

              {activeDropdown === 'user' && (
                <div className="user-dropdown-panel">
                  <div className="user-dropdown-header">
                    {user?.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user?.name} className="user-dropdown-avatar-img" />
                    ) : (
                      <div className="user-dropdown-avatar">{initials}</div>
                    )}
                    <div className="user-dropdown-details">
                      <strong>{user?.name}</strong>
                    </div>
                  </div>

                  <div className="user-dropdown-divider" />

                  <NavLink
                    to="/profile"
                    className="user-dropdown-item"
                    onClick={() => setActiveDropdown(null)}
                  >
                    <User size={16} />
                    <span>My Profile & Settings</span>
                  </NavLink>

                  <div className="user-dropdown-divider" />

                  <button
                    type="button"
                    className="user-dropdown-item logout-btn"
                    onClick={handleLogout}
                  >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

      </header>

      {/* ========================================================
          FULL WIDTH MAIN CONTENT CONTAINER
      ======================================================== */}
      <main className="app-main">
        <div className="content">
          <Outlet />
        </div>
      </main>

      {/* ========================================================
          MOBILE SIDEBAR DRAWER (Classic Slide-over Sidebar)
      ======================================================== */}
      <aside className={`mobile-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="mobile-sidebar-head">
          <div className="brand">
            <img src="/logo.svg" alt="StockSense" width="28" height="28" />
            <span className="brand-text">StockSense</span>
          </div>
          <button
            type="button"
            className="mobile-close-btn"
            aria-label="Close navigation menu"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="mobile-sidebar-nav">
          {MOBILE_NAV.map((item) =>
            item.children ? (
              <div key={item.label} className="nav-group">
                <span className="nav-group-title">{item.label}</span>
                {item.children.filter((c) => !c.permission || can(c.permission)).map((c) => {
                  const Icon = c.icon;
                  return (
                    <NavLink
                      key={c.to}
                      to={c.to}
                      end={c.end}
                      className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
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
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {Icon && <Icon size={16} className="nav-icon" />}
                    <span>{item.label}</span>
                  </NavLink>
                );
              })()
            )
          )}
        </nav>

        <div className="profile-menu">
          <NavLink
            to="/profile"
            className={({ isActive }) => `profile-link ${isActive ? 'active' : ''}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            {user?.avatarUrl ? <img src={user.avatarUrl} alt={user?.name} className="top-user-avatar-img" /> : <span className="avatar">{initials}</span>}
            <span>
              <strong>{user?.name}</strong>
              <small className="muted">
                <span className={`role-badge role-${user?.role}`}>{user?.role === 'manager' ? 'Manager' : 'Staff'}</span> My Profile
              </small>
            </span>
          </NavLink>
          <button
            type="button"
            className="btn btn-ghost full"
            onClick={() => {
              setMobileMenuOpen(false);
              handleLogout();
            }}
          >
            <LogOut size={15} /> Logout
          </button>
        </div>
      </aside>

      {/* Backdrop Scrim */}
      <div
        className={`mobile-scrim ${mobileMenuOpen ? 'open' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
      />
    </div>
  );
}