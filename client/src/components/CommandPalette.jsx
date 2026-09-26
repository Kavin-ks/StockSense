import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Package,
  Layers,
  FileText,
  Warehouse,
  MapPin,
  Clock,
  BarChart3,
  Users,
  Settings,
  PlusCircle,
  X,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { searchApi } from '../api/endpoints.js';
import { OPERATION_META, fmtDate } from '../utils.js';

export function CommandPalette({ open, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ products: [], operations: [], warehouses: [], locations: [] });
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const QUICK_ACTIONS = [
    { id: 'new-rec', label: 'Create Receipt', icon: PlusCircle, path: '/operations/receipts/new', section: 'Actions' },
    { id: 'new-del', label: 'Create Delivery Order', icon: PlusCircle, path: '/operations/deliveries/new', section: 'Actions' },
    { id: 'new-trf', label: 'Create Internal Transfer', icon: PlusCircle, path: '/operations/transfers/new', section: 'Actions' },
    { id: 'new-prod', label: 'Add New Product', icon: Package, path: '/products/new', section: 'Actions' },
    { id: 'new-adj', label: 'Physical Inventory Adjustment', icon: Layers, path: '/operations/adjustments', section: 'Actions' },
  ];

  const NAVIGATION_ITEMS = [
    { id: 'nav-dash', label: 'Inventory Dashboard', icon: BarChart3, path: '/', section: 'Navigation' },
    { id: 'nav-rec', label: 'Receipts (Inbound)', icon: FileText, path: '/operations/receipts', section: 'Navigation' },
    { id: 'nav-del', label: 'Deliveries (Outbound)', icon: FileText, path: '/operations/deliveries', section: 'Navigation' },
    { id: 'nav-trf', label: 'Internal Transfers', icon: FileText, path: '/operations/transfers', section: 'Navigation' },
    { id: 'nav-prod', label: 'Products Catalog', icon: Package, path: '/products', section: 'Navigation' },
    { id: 'nav-moves', label: 'Move History & Audit Trail', icon: Clock, path: '/moves', section: 'Navigation' },
    { id: 'nav-rep', label: 'Inventory Reports & Valuation', icon: TrendingUp, path: '/reports', section: 'Navigation' },
    { id: 'nav-wh', label: 'Warehouses', icon: Warehouse, path: '/settings/warehouses', section: 'Navigation' },
    { id: 'nav-loc', label: 'Locations & Bins', icon: MapPin, path: '/settings/locations', section: 'Navigation' },
    { id: 'nav-users', label: 'Users & Team Roles', icon: Users, path: '/settings/users', section: 'Navigation' },
    { id: 'nav-prof', label: 'Profile & Security', icon: Settings, path: '/profile', section: 'Navigation' },
  ];

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Live unified backend search
  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults({ products: [], operations: [], warehouses: [], locations: [] });
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await searchApi.query(query.trim());
        if (active) setResults(res || { products: [], operations: [], warehouses: [], locations: [] });
      } catch (err) {
        console.error('Unified search error:', err);
      } finally {
        if (active) setLoading(false);
      }
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, open]);

  // Build flattened selectable items list
  const filteredQuick = query.trim()
    ? QUICK_ACTIONS.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()))
    : QUICK_ACTIONS;

  const filteredNav = query.trim()
    ? NAVIGATION_ITEMS.filter((n) => n.label.toLowerCase().includes(query.toLowerCase()))
    : NAVIGATION_ITEMS;

  const allItems = [
    ...results.products.map((p) => ({
      id: `p-${p.id}`,
      type: 'product',
      title: p.name,
      subtitle: `SKU: ${p.sku} ${p.barcode ? '• Barcode: ' + p.barcode : ''}`,
      path: `/products/${p.id}`,
      icon: Package,
    })),
    ...results.operations.map((o) => ({
      id: `o-${o.id}`,
      type: 'operation',
      title: o.reference,
      subtitle: `${OPERATION_META[o.type]?.single || o.type} • ${o.status.toUpperCase()} ${o.contact ? '• ' + o.contact : ''}`,
      path: `${OPERATION_META[o.type]?.path || '/operations/receipts'}/${o.id}`,
      icon: FileText,
    })),
    ...results.warehouses.map((w) => ({
      id: `w-${w.id}`,
      type: 'warehouse',
      title: w.name,
      subtitle: `Code: ${w.code}`,
      path: `/settings/warehouses`,
      icon: Warehouse,
    })),
    ...filteredQuick.map((a) => ({
      id: a.id,
      type: 'action',
      title: a.label,
      subtitle: 'Quick Action',
      path: a.path,
      icon: a.icon,
    })),
    ...filteredNav.map((n) => ({
      id: n.id,
      type: 'nav',
      title: n.label,
      subtitle: 'Navigation',
      path: n.path,
      icon: n.icon,
    })),
  ];

  const handleSelect = (item) => {
    if (!item) return;
    onClose();
    navigate(item.path);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (allItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + (allItems.length || 1)) % (allItems.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allItems[selectedIndex]) {
        handleSelect(allItems[selectedIndex]);
      }
    }
  };

  if (!open) return null;

  return (
    <div className="cmd-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="cmd-modal" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="cmd-header">
          <Search size={18} className="cmd-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="cmd-input"
            placeholder="Type a product, SKU, document reference, or action..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          {query && (
            <button type="button" className="cmd-clear-btn" onClick={() => setQuery('')}>
              <X size={16} />
            </button>
          )}
          <kbd className="cmd-esc-badge">ESC</kbd>
        </div>

        <div className="cmd-content">
          {loading && (
            <div className="cmd-loading-hint">
              <span className="spinner-dot" /> Searching inventory...
            </div>
          )}

          {allItems.length === 0 && !loading && (
            <div className="cmd-empty">
              <p>No results found for "{query}".</p>
              <span className="muted small-print">Try searching for an SKU, reference (e.g. REC-00001), or warehouse name.</span>
            </div>
          )}

          {/* Group 1: Products Found */}
          {results.products.length > 0 && (
            <div className="cmd-group">
              <div className="cmd-group-title">Products ({results.products.length})</div>
              {results.products.map((p) => {
                const item = allItems.find((it) => it.id === `p-${p.id}`);
                const isSelected = allItems[selectedIndex]?.id === item?.id;
                return (
                  <div
                    key={p.id}
                    className={`cmd-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(allItems.indexOf(item))}
                  >
                    <div className="cmd-item-icon-box product"><Package size={16} /></div>
                    <div className="cmd-item-info">
                      <span className="cmd-item-title">{p.name}</span>
                      <span className="cmd-item-sub">SKU: <strong>{p.sku}</strong> {p.barcode ? `• Barcode: ${p.barcode}` : ''}</span>
                    </div>
                    <ArrowRight size={14} className="cmd-item-arrow" />
                  </div>
                );
              })}
            </div>
          )}

          {/* Group 2: Operations Found */}
          {results.operations.length > 0 && (
            <div className="cmd-group">
              <div className="cmd-group-title">Operations ({results.operations.length})</div>
              {results.operations.map((o) => {
                const item = allItems.find((it) => it.id === `o-${o.id}`);
                const isSelected = allItems[selectedIndex]?.id === item?.id;
                return (
                  <div
                    key={o.id}
                    className={`cmd-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(allItems.indexOf(item))}
                  >
                    <div className="cmd-item-icon-box operation"><FileText size={16} /></div>
                    <div className="cmd-item-info">
                      <span className="cmd-item-title">{o.reference}</span>
                      <span className="cmd-item-sub">{OPERATION_META[o.type]?.single || o.type} • {o.status.toUpperCase()} {o.contact ? `• ${o.contact}` : ''}</span>
                    </div>
                    <ArrowRight size={14} className="cmd-item-arrow" />
                  </div>
                );
              })}
            </div>
          )}

          {/* Group 3: Warehouses Found */}
          {results.warehouses.length > 0 && (
            <div className="cmd-group">
              <div className="cmd-group-title">Warehouses</div>
              {results.warehouses.map((w) => {
                const item = allItems.find((it) => it.id === `w-${w.id}`);
                const isSelected = allItems[selectedIndex]?.id === item?.id;
                return (
                  <div
                    key={w.id}
                    className={`cmd-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(allItems.indexOf(item))}
                  >
                    <div className="cmd-item-icon-box warehouse"><Warehouse size={16} /></div>
                    <div className="cmd-item-info">
                      <span className="cmd-item-title">{w.name}</span>
                      <span className="cmd-item-sub">Code: {w.code}</span>
                    </div>
                    <ArrowRight size={14} className="cmd-item-arrow" />
                  </div>
                );
              })}
            </div>
          )}

          {/* Group 4: Quick Actions */}
          {filteredQuick.length > 0 && (
            <div className="cmd-group">
              <div className="cmd-group-title">Quick Actions</div>
              {filteredQuick.map((a) => {
                const item = allItems.find((it) => it.id === a.id);
                const isSelected = allItems[selectedIndex]?.id === item?.id;
                const Icon = a.icon;
                return (
                  <div
                    key={a.id}
                    className={`cmd-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(allItems.indexOf(item))}
                  >
                    <div className="cmd-item-icon-box action"><Icon size={16} /></div>
                    <div className="cmd-item-info">
                      <span className="cmd-item-title">{a.label}</span>
                    </div>
                    <ArrowRight size={14} className="cmd-item-arrow" />
                  </div>
                );
              })}
            </div>
          )}

          {/* Group 5: Navigation */}
          {filteredNav.length > 0 && (
            <div className="cmd-group">
              <div className="cmd-group-title">Navigation</div>
              {filteredNav.slice(0, query.trim() ? 10 : 6).map((n) => {
                const item = allItems.find((it) => it.id === n.id);
                const isSelected = allItems[selectedIndex]?.id === item?.id;
                const Icon = n.icon;
                return (
                  <div
                    key={n.id}
                    className={`cmd-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(allItems.indexOf(item))}
                  >
                    <div className="cmd-item-icon-box nav"><Icon size={16} /></div>
                    <div className="cmd-item-info">
                      <span className="cmd-item-title">{n.label}</span>
                    </div>
                    <ArrowRight size={14} className="cmd-item-arrow" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="cmd-footer">
          <span><kbd className="shortcut-kbd">↑</kbd> <kbd className="shortcut-kbd">↓</kbd> Navigate</span>
          <span><kbd className="shortcut-kbd">↵</kbd> Select</span>
          <span><kbd className="shortcut-kbd">ESC</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
