import { useState, useRef, useEffect } from 'react';
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
  Warehouse,
  MapPin,
  ChevronDown,
  LogOut,
  User,
  Menu,
  X,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { AlertBell } from './AlertBell.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeDropdown, setActiveDropdown] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navRef = useRef(null);
  const closeTimerRef = useRef(null);

  const pathname = location.pathname;

  // Active state checkers
  const isDashboardActive = pathname === '/';
  const isOperationsActive = pathname.startsWith('/operations');
  const isProductsActive =
    pathname.startsWith('/products') ||
    pathname.startsWith('/stock') ||
    pathname.startsWith('/moves');
  const isSettingsActive = pathname.startsWith('/settings');
  const isProfileActive = pathname.startsWith('/profile');

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
          {/* Left Brand + Mobile Toggle */}
          <div className="top-nav-left">
            <button
              type="button"
              className="top-mobile-toggle"
              aria-label="Toggle navigation menu"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            <NavLink to="/" className="top-nav-brand">
              <img src="/logo.svg" alt="StockSense" width="28" height="28" />
              <span className="brand-text">StockSense</span>
            </NavLink>
          </div>

          {/* Center Navigation Links & Mega-Menu Dropdowns (Desktop) */}
          <nav className="top-nav-menu" aria-label="Main Navigation">
            {/* 1. Dashboard */}
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `top-nav-link ${isActive ? 'active' : ''}`
              }
            >
              <LayoutDashboard size={16} className="nav-item-icon" />
              <span>Dashboard</span>
            </NavLink>

            {/* 2. Operations Dropdown */}
            <div
              className={`top-nav-dropdown-wrap ${
                activeDropdown === 'operations' ? 'open' : ''
              }`}
              onMouseEnter={() => handleMouseEnter('operations')}
              onMouseLeave={handleMouseLeave}
            >
              <button
                type="button"
                className={`top-nav-link dropdown-trigger ${
                  isOperationsActive ? 'active' : ''
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
                <div className="mega-menu-panel operations-panel">
                  <div className="mega-menu-columns">
                    {/* Column 1 */}
                    <div className="mega-column">
                      <div className="mega-column-heading">
                        Inward & Outward Logistics
                      </div>
                      <NavLink
                        to="/operations/receipts"
                        className={({ isActive }) =>
                          `mega-item ${isActive ? 'active' : ''}`
                        }
                        onClick={() => setActiveDropdown(null)}
                      >
                        <div className="mega-item-icon-box in">
                          <ArrowDownToLine size={18} />
                        </div>
                        <div className="mega-item-text">
                          <div className="mega-item-title">Receipts</div>
                          <div className="mega-item-desc">
                            Inward vendor deliveries & dock receiving
                          </div>
                        </div>
                      </NavLink>

                      <NavLink
                        to="/operations/deliveries"
                        className={({ isActive }) =>
                          `mega-item ${isActive ? 'active' : ''}`
                        }
                        onClick={() => setActiveDropdown(null)}
                      >
                        <div className="mega-item-icon-box out">
                          <Truck size={18} />
                        </div>
                        <div className="mega-item-text">
                          <div className="mega-item-title">Deliveries</div>
                          <div className="mega-item-desc">
                            Outward picking, packing & shipment dispatch
                          </div>
                        </div>
                      </NavLink>
                    </div>

                    {/* Column 2 */}
                    <div className="mega-column">
                      <div className="mega-column-heading">
                        Internal Warehouse Operations
                      </div>
                      <NavLink
                        to="/operations/transfers"
                        className={({ isActive }) =>
                          `mega-item ${isActive ? 'active' : ''}`
                        }
                        onClick={() => setActiveDropdown(null)}
                      >
                        <div className="mega-item-icon-box transfer">
                          <ArrowLeftRight size={18} />
                        </div>
                        <div className="mega-item-text">
                          <div className="mega-item-title">Internal Transfers</div>
                          <div className="mega-item-desc">
                            Inter-location relocations & bin replenishments
                          </div>
                        </div>
                      </NavLink>

                      <NavLink
                        to="/operations/adjustments"
                        className={({ isActive }) =>
                          `mega-item ${isActive ? 'active' : ''}`
                        }
                        onClick={() => setActiveDropdown(null)}
                      >
                        <div className="mega-item-icon-box adjustment">
                          <Scale size={18} />
                        </div>
                        <div className="mega-item-text">
                          <div className="mega-item-title">Adjustments</div>
                          <div className="mega-item-desc">
                            Physical cycle counts & stock discrepancy fixes
                          </div>
                        </div>
                      </NavLink>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Products Dropdown */}
            <div
              className={`top-nav-dropdown-wrap ${
                activeDropdown === 'products' ? 'open' : ''
              }`}
              onMouseEnter={() => handleMouseEnter('products')}
              onMouseLeave={handleMouseLeave}
            >
              <button
                type="button"
                className={`top-nav-link dropdown-trigger ${
                  isProductsActive ? 'active' : ''
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
                <div className="mega-menu-panel products-panel">
                  <div className="mega-menu-columns">
                    {/* Column 1 */}
                    <div className="mega-column">
                      <div className="mega-column-heading">
                        Catalog & Categories
                      </div>
                      <NavLink
                        to="/products"
                        end
                        className={({ isActive }) =>
                          `mega-item ${isActive ? 'active' : ''}`
                        }
                        onClick={() => setActiveDropdown(null)}
                      >
                        <div className="mega-item-icon-box product">
                          <Package size={18} />
                        </div>
                        <div className="mega-item-text">
                          <div className="mega-item-title">Products</div>
                          <div className="mega-item-desc">
                            Master SKU registry, barcodes & reorder rules
                          </div>
                        </div>
                      </NavLink>

                      <NavLink
                        to="/products/categories"
                        className={({ isActive }) =>
                          `mega-item ${isActive ? 'active' : ''}`
                        }
                        onClick={() => setActiveDropdown(null)}
                      >
                        <div className="mega-item-icon-box category">
                          <Tags size={18} />
                        </div>
                        <div className="mega-item-text">
                          <div className="mega-item-title">Categories</div>
                          <div className="mega-item-desc">
                            Product taxonomy, families & classification
                          </div>
                        </div>
                      </NavLink>
                    </div>

                    {/* Column 2 */}
                    <div className="mega-column">
                      <div className="mega-column-heading">
                        Inventory & Audit Trail
                      </div>
                      <NavLink
                        to="/stock"
                        className={({ isActive }) =>
                          `mega-item ${isActive ? 'active' : ''}`
                        }
                        onClick={() => setActiveDropdown(null)}
                      >
                        <div className="mega-item-icon-box stock">
                          <Boxes size={18} />
                        </div>
                        <div className="mega-item-text">
                          <div className="mega-item-title">Stock Quants</div>
                          <div className="mega-item-desc">
                            Real-time on-hand balances by storage location
                          </div>
                        </div>
                      </NavLink>

                      <NavLink
                        to="/moves"
                        className={({ isActive }) =>
                          `mega-item ${isActive ? 'active' : ''}`
                        }
                        onClick={() => setActiveDropdown(null)}
                      >
                        <div className="mega-item-icon-box moves">
                          <History size={18} />
                        </div>
                        <div className="mega-item-text">
                          <div className="mega-item-title">Move History</div>
                          <div className="mega-item-desc">
                            Immutable stock ledger & full movement traceability
                          </div>
                        </div>
                      </NavLink>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Settings Dropdown */}
            <div
              className={`top-nav-dropdown-wrap ${
                activeDropdown === 'settings' ? 'open' : ''
              }`}
              onMouseEnter={() => handleMouseEnter('settings')}
              onMouseLeave={handleMouseLeave}
            >
              <button
                type="button"
                className={`top-nav-link dropdown-trigger ${
                  isSettingsActive ? 'active' : ''
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
                <div className="mega-menu-panel settings-panel">
                  <div className="mega-column" style={{ width: '100%' }}>
                    <div className="mega-column-heading">
                      Facilities & Storage Setup
                    </div>
                    <NavLink
                      to="/settings/warehouses"
                      className={({ isActive }) =>
                        `mega-item ${isActive ? 'active' : ''}`
                      }
                      onClick={() => setActiveDropdown(null)}
                    >
                      <div className="mega-item-icon-box settings">
                        <Warehouse size={18} />
                      </div>
                      <div className="mega-item-text">
                        <div className="mega-item-title">Warehouses</div>
                        <div className="mega-item-desc">
                          Physical distribution hubs & facility codes
                        </div>
                      </div>
                    </NavLink>

                    <NavLink
                      to="/settings/locations"
                      className={({ isActive }) =>
                        `mega-item ${isActive ? 'active' : ''}`
                      }
                      onClick={() => setActiveDropdown(null)}
                    >
                      <div className="mega-item-icon-box settings">
                        <MapPin size={18} />
                      </div>
                      <div className="mega-item-text">
                        <div className="mega-item-title">Locations</div>
                        <div className="mega-item-desc">
                          Internal storage aisles, zones, shelves & bins
                        </div>
                      </div>
                    </NavLink>
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
                className={`top-user-pill ${isProfileActive ? 'active' : ''}`}
                onClick={() => toggleDropdown('user')}
                aria-expanded={activeDropdown === 'user'}
              >
                <span className="top-user-avatar">{initials}</span>
                <div className="top-user-info-text">
                  <span className="top-user-name">{user?.name}</span>
                  <span className="top-user-role">
                    {user?.role === 'manager' ? 'Manager' : 'Staff'}
                  </span>
                </div>
                <ChevronDown
                  size={14}
                  className={`chevron-icon ${
                    activeDropdown === 'user' ? 'rotated' : ''
                  }`}
                />
              </button>

              {activeDropdown === 'user' && (
                <div className="user-dropdown-panel">
                  <div className="user-dropdown-header">
                    <div className="user-dropdown-avatar">{initials}</div>
                    <div className="user-dropdown-details">
                      <strong>{user?.name}</strong>
                      <small className="muted">{user?.email}</small>
                      <span className="user-role-badge">
                        <ShieldCheck size={12} />
                        {user?.role === 'manager'
                          ? 'Inventory Manager'
                          : 'Warehouse Staff'}
                      </span>
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

        {/* ========================================================
            RESPONSIVE MOBILE / TABLET DRAWER
        ======================================================== */}
        {mobileMenuOpen && (
          <div className="top-mobile-drawer">
            <nav className="mobile-nav-content">
              {/* Dashboard */}
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `mobile-nav-link ${isActive ? 'active' : ''}`
                }
                onClick={() => setMobileMenuOpen(false)}
              >
                <LayoutDashboard size={18} />
                <span>Dashboard</span>
              </NavLink>

              {/* Operations Group */}
              <div className="mobile-nav-group">
                <span className="mobile-group-title">Operations</span>
                <NavLink
                  to="/operations/receipts"
                  className={({ isActive }) =>
                    `mobile-nav-link sub ${isActive ? 'active' : ''}`
                  }
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <ArrowDownToLine size={16} />
                  <span>Receipts</span>
                </NavLink>
                <NavLink
                  to="/operations/deliveries"
                  className={({ isActive }) =>
                    `mobile-nav-link sub ${isActive ? 'active' : ''}`
                  }
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Truck size={16} />
                  <span>Deliveries</span>
                </NavLink>
                <NavLink
                  to="/operations/transfers"
                  className={({ isActive }) =>
                    `mobile-nav-link sub ${isActive ? 'active' : ''}`
                  }
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <ArrowLeftRight size={16} />
                  <span>Internal Transfers</span>
                </NavLink>
                <NavLink
                  to="/operations/adjustments"
                  className={({ isActive }) =>
                    `mobile-nav-link sub ${isActive ? 'active' : ''}`
                  }
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Scale size={16} />
                  <span>Adjustments</span>
                </NavLink>
              </div>

              {/* Products Group */}
              <div className="mobile-nav-group">
                <span className="mobile-group-title">Products & Inventory</span>
                <NavLink
                  to="/products"
                  end
                  className={({ isActive }) =>
                    `mobile-nav-link sub ${isActive ? 'active' : ''}`
                  }
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Package size={16} />
                  <span>Products</span>
                </NavLink>
                <NavLink
                  to="/stock"
                  className={({ isActive }) =>
                    `mobile-nav-link sub ${isActive ? 'active' : ''}`
                  }
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Boxes size={16} />
                  <span>Stock Quants</span>
                </NavLink>
                <NavLink
                  to="/products/categories"
                  className={({ isActive }) =>
                    `mobile-nav-link sub ${isActive ? 'active' : ''}`
                  }
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Tags size={16} />
                  <span>Categories</span>
                </NavLink>
                <NavLink
                  to="/moves"
                  className={({ isActive }) =>
                    `mobile-nav-link sub ${isActive ? 'active' : ''}`
                  }
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <History size={16} />
                  <span>Move History</span>
                </NavLink>
              </div>

              {/* Settings Group */}
              <div className="mobile-nav-group">
                <span className="mobile-group-title">Settings</span>
                <NavLink
                  to="/settings/warehouses"
                  className={({ isActive }) =>
                    `mobile-nav-link sub ${isActive ? 'active' : ''}`
                  }
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Warehouse size={16} />
                  <span>Warehouses</span>
                </NavLink>
                <NavLink
                  to="/settings/locations"
                  className={({ isActive }) =>
                    `mobile-nav-link sub ${isActive ? 'active' : ''}`
                  }
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <MapPin size={16} />
                  <span>Locations</span>
                </NavLink>
              </div>

              {/* User Section in Mobile Menu */}
              <div className="mobile-user-section">
                <NavLink
                  to="/profile"
                  className="mobile-nav-link"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="avatar sm">{initials}</span>
                  <span>My Profile ({user?.name})</span>
                </NavLink>
                <button
                  type="button"
                  className="mobile-logout-btn"
                  onClick={handleLogout}
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* ========================================================
          FULL WIDTH MAIN CONTENT CONTAINER
      ======================================================== */}
      <main className="app-main">
        <div className="content">
          <Outlet />
        </div>
      </main>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="top-mobile-backdrop"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}