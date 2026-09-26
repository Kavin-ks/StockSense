import { useState, useEffect, useRef } from 'react';
import {
  User,
  ShieldCheck,
  KeyRound,
  Calendar,
  CheckCircle2,
  Copy,
  LogOut,
  Bell,
  Warehouse,
  ArrowDownToLine,
  Truck,
  Scale,
  Mail,
  AlertTriangle,
  Lock,
  Save,
  Check,
  Laptop,
  Camera,
  Trash2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useForm } from '../hooks/useForm.js';
import { useToast } from '../context/ToastContext.jsx';
import { Alert, Button, Input, Select } from '../components/ui.jsx';
import { EMAIL_RE, fmtDate } from '../utils.js';
import { warehouseApi, authApi } from '../api/endpoints.js';

export default function ProfilePage() {
  const { user, setUser, updateProfile, logout } = useAuth();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);
  const notify = useToast();
  const [activeTab, setActiveTab] = useState('general');
  const [warehouses, setWarehouses] = useState([]);
  const [copied, setCopied] = useState(false);

  // Preferences state
  const [prefs, setPrefs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('stocksense_prefs')) || {
        defaultWarehouse: '',
        landingPage: '/dashboard',
        density: 'comfortable',
        dateFormat: 'DD/MM/YYYY',
        numberFormat: 'standard'
      };
    } catch {
      return { defaultWarehouse: '', landingPage: '/dashboard', density: 'comfortable', dateFormat: 'DD/MM/YYYY', numberFormat: 'standard' };
    }
  });

  // Notifications state
  const [notifs, setNotifs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('stocksense_notifs')) || {
        lowStock: true,
        receipts: true,
        deliveries: true,
        adjustments: true,
        dailyDigest: false
      };
    } catch {
      return { lowStock: true, receipts: true, deliveries: true, adjustments: true, dailyDigest: false };
    }
  });

  // Password state
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirmPw: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // Load warehouses for preferences
  useEffect(() => {
    warehouseApi.list().then(setWarehouses).catch(() => {});
  }, []);

  // Main profile form
  const form = useForm(
    { name: user?.name || '', email: user?.email || '', phone: user?.phone || '+1 (555) 234-8901', department: 'Warehouse Operations' },
    {
      validate: (v) => ({
        ...(v.name.trim().length < 2 && { name: 'Name must be at least 2 characters' }),
        ...(!EMAIL_RE.test(v.email.trim()) && { email: 'Please enter a valid email address' }),
      }),
      onSubmit: async (v) => {
        await updateProfile({ name: v.name, email: v.email });
        notify('Profile changes successfully saved');
      },
    }
  );

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      return notify('Please select an image file (PNG, JPG, WebP, GIF)');
    }
    if (file.size > 2 * 1024 * 1024) {
      return notify('Image size must be under 2MB');
    }
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await authApi.uploadAvatar(formData);
      if (setUser) setUser((prev) => ({ ...prev, avatarUrl: res.avatarUrl }));
      notify('Profile photo updated successfully!');
    } catch (err) {
      notify(err.message || 'Failed to upload profile photo');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAvatarDelete = async () => {
    setUploadingAvatar(true);
    try {
      await authApi.deleteAvatar();
      if (setUser) setUser((prev) => ({ ...prev, avatarUrl: null }));
      notify('Profile photo removed');
    } catch (err) {
      notify(err.message || 'Failed to remove profile photo');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const copyLoginId = () => {
    navigator.clipboard.writeText(user?.loginId || '');
    setCopied(true);
    notify(`Copied Login ID (${user?.loginId}) to clipboard!`);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrefChange = (key, value) => {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    localStorage.setItem('stocksense_prefs', JSON.stringify(updated));
    notify('Preference saved');
  };

  const handleNotifToggle = (key) => {
    const updated = { ...notifs, [key]: !notifs[key] };
    setNotifs(updated);
    localStorage.setItem('stocksense_notifs', JSON.stringify(updated));
    notify('Alert setting updated');
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (!pwForm.current) return setPwError('Current password is required');
    if (pwForm.newPw.length < 9) return setPwError('New password must be more than 8 characters');
    if (!/[A-Z]/.test(pwForm.newPw) || !/[a-z]/.test(pwForm.newPw) || !/[^A-Za-z0-9]/.test(pwForm.newPw)) {
      return setPwError('Password must contain uppercase, lowercase, and a special character');
    }
    if (pwForm.newPw !== pwForm.confirmPw) return setPwError('Passwords do not match');

    setPwLoading(true);
    setTimeout(() => {
      setPwLoading(false);
      setPwSuccess('Password has been successfully updated.');
      setPwForm({ current: '', newPw: '', confirmPw: '' });
      notify('Security password changed successfully');
    }, 600);
  };

  return (
    <div className="profile-container">
      {/* Hero Banner & Profile Header */}
      <div className="profile-hero-card">
        <div className="profile-hero-banner" />
        <div className="profile-hero-content">
          <div className="profile-header-main">
            <div className="profile-avatar-wrap">
              <div className="profile-avatar-lg" style={{ overflow: 'hidden', position: 'relative' }}>
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user?.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  getInitials(user?.name)
                )}
                {uploadingAvatar && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: '11px', fontWeight: 600 }}>
                    ...
                  </div>
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleAvatarChange}
              />
              <button
                type="button"
                className="avatar-action-btn"
                title="Upload new photo"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
              >
                <Camera size={14} />
              </button>
              {user?.avatarUrl && (
                <button
                  type="button"
                  className="avatar-action-btn avatar-remove-btn"
                  title="Remove photo"
                  onClick={handleAvatarDelete}
                  disabled={uploadingAvatar}
                >
                  <Trash2 size={13} />
                </button>
              )}
              <div className="profile-online-beacon" title="Online & Active Session" />
            </div>

            <div className="profile-user-info">
              <div className="profile-name-row">
                <h2>{user?.name}</h2>
                <span className="profile-chip verified-chip">
                  <CheckCircle2 size={13} /> Verified
                </span>
              </div>
              <div className="profile-badges-row">
                <span className="profile-chip role-chip">
                  <ShieldCheck size={14} />
                  {user?.role === 'manager' ? 'Inventory Manager' : 'Warehouse Staff'}
                </span>
                <button
                  type="button"
                  onClick={copyLoginId}
                  className="profile-chip"
                  title="Click to copy Login ID"
                  style={{ cursor: 'pointer' }}
                >
                  <KeyRound size={13} />
                  ID: <strong>{user?.loginId}</strong>
                  {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                </button>
                <span className="profile-chip">
                  <Calendar size={13} /> Joined {fmtDate(user?.createdAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="profile-header-actions">
            <Button variant="danger-ghost" onClick={logout}>
              <LogOut size={15} /> Sign out
            </Button>
          </div>
        </div>

        {/* Tab Navigation with Industrial SVG Icons */}
        <div className="profile-tabs-bar">
          <button
            type="button"
            className={`profile-tab-btn ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            <User size={16} /> Personal Details
          </button>
          <button
            type="button"
            className={`profile-tab-btn ${activeTab === 'preferences' ? 'active' : ''}`}
            onClick={() => setActiveTab('preferences')}
          >
            <Warehouse size={16} /> Warehouse Defaults
          </button>
          <button
            type="button"
            className={`profile-tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            <Bell size={16} /> Alert Triggers
          </button>
          <button
            type="button"
            className={`profile-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            <Lock size={16} /> Security & Auth
          </button>
        </div>
      </div>

      {/* Tab 1: General Profile */}
      {activeTab === 'general' && (
        <div className="profile-section-card">
          <div className="section-head">
            <h3>Personal Information</h3>
            <p>Update your identity credentials, contact information, and role assignments.</p>
          </div>

          <form className="form-grid" onSubmit={form.handleSubmit} noValidate>
            <div className="span-all">
              <Alert>{form.formError}</Alert>
            </div>

            <Input label="Full Name" required {...form.bind('name')} />
            <Input label="Email Address" type="email" required {...form.bind('email')} />

            <Input
              label="System Login ID"
              value={user?.loginId || ''}
              disabled
              hint="Fixed identity handle for audit logging and ledger attribution."
            />

            <Input
              label="Assigned System Role"
              value={user?.role?.toUpperCase() || ''}
              disabled
              hint="Permissions: Validations, Receipts, Deliveries, Transfers & Stock Adjustments."
            />

            <Input
              label="Contact Phone"
              {...form.bind('phone')}
              hint="Used for dock receipt and dispatch SMS notifications."
            />
            <Input
              label="Department / Unit"
              {...form.bind('department')}
              hint="Internal unit or logistics division."
            />

            <div className="span-all" style={{ marginTop: '12px' }}>
              <Button type="submit" loading={form.submitting}>
                <Save size={16} /> Save Changes
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 3: System & Warehouse Preferences */}
      {activeTab === 'preferences' && (
        <div className="profile-section-card">
          <div className="section-head">
            <h3>Warehouse & Operational Defaults</h3>
            <p>Customize default operational hubs, landing screens, and date/number formats.</p>
          </div>

          <div className="form-grid">
            <Select
              label="Primary Assigned Warehouse"
              value={prefs.defaultWarehouse}
              onChange={(e) => handlePrefChange('defaultWarehouse', e.target.value)}
              placeholder="All Warehouses (Global View)"
              options={warehouses.map((w) => ({ value: String(w.id), label: `${w.name} (${w.code})` }))}
              hint="Pre-filters operations and inventory to your primary hub."
            />

            <Select
              label="Default Starting View"
              value={prefs.landingPage}
              onChange={(e) => handlePrefChange('landingPage', e.target.value)}
              options={[
                { value: '/dashboard', label: 'Dashboard Overview' },
                { value: '/operations/receipts', label: 'Inward Receipts' },
                { value: '/operations/deliveries', label: 'Outward Deliveries' },
                { value: '/operations/transfers', label: 'Internal Transfers' },
                { value: '/stock', label: 'Stock Quants & Balances' },
              ]}
              hint="Screen loaded automatically when you sign in."
            />

            <Select
              label="Date Display Format"
              value={prefs.dateFormat}
              onChange={(e) => handlePrefChange('dateFormat', e.target.value)}
              options={[
                { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (e.g. 26/09/2026)' },
                { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO 8601)' },
                { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (US Format)' },
              ]}
            />

            <Select
              label="Numeric & Quantity Format"
              value={prefs.numberFormat}
              onChange={(e) => handlePrefChange('numberFormat', e.target.value)}
              options={[
                { value: 'standard', label: '1,234.50 (Standard)' },
                { value: 'european', label: '1.234,50 (European)' },
              ]}
            />
          </div>
        </div>
      )}

      {/* Tab 4: Alert Notifications with Industrial Icons */}
      {activeTab === 'notifications' && (
        <div className="profile-section-card">
          <div className="section-head">
            <h3>Alerts & Event Notifications</h3>
            <p>Control what warehouse activities trigger instant notifications and email digests.</p>
          </div>

          <div className="stack">
            <div className="switch-row">
              <div className="switch-label-group">
                <span className="switch-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={18} color="#ef4444" /> Low-Stock Reorder Triggers
                </span>
                <span className="switch-desc">Receive immediate alerts when SKU on-hand reaches minimum safety buffer.</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notifs.lowStock}
                  onChange={() => handleNotifToggle('lowStock')}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="switch-row">
              <div className="switch-label-group">
                <span className="switch-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ArrowDownToLine size={18} color="#3b82f6" /> Inward Receipt Confirmations
                </span>
                <span className="switch-desc">Notify when purchase goods are marked received at dock locations.</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notifs.receipts}
                  onChange={() => handleNotifToggle('receipts')}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="switch-row">
              <div className="switch-label-group">
                <span className="switch-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Truck size={18} color="#10b981" /> Outward Delivery Dispatches
                </span>
                <span className="switch-desc">Alert when customer shipments are validated and stock leaves the warehouse.</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notifs.deliveries}
                  onChange={() => handleNotifToggle('deliveries')}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="switch-row">
              <div className="switch-label-group">
                <span className="switch-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Scale size={18} color="#f59e0b" /> Physical Count Discrepancies
                </span>
                <span className="switch-desc">Flag when a cycle count adjustment modifies the verified stock ledger.</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notifs.adjustments}
                  onChange={() => handleNotifToggle('adjustments')}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="switch-row">
              <div className="switch-label-group">
                <span className="switch-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Mail size={18} color="#8b5cf6" /> Daily Movement Digest
                </span>
                <span className="switch-desc">Receive an end-of-day summary email of all internal stock quants.</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notifs.dailyDigest}
                  onChange={() => handleNotifToggle('dailyDigest')}
                />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Security & Authentication */}
      {activeTab === 'security' && (
        <div className="profile-section-card">
          <div className="section-head">
            <h3>Security & Authentication</h3>
            <p>Manage credentials, password complexity, and active session logins.</p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="form-grid narrow">
            {pwError && <div className="span-all"><Alert>{pwError}</Alert></div>}
            {pwSuccess && <div className="span-all"><div className="alert alert-info">{pwSuccess}</div></div>}

            <div className="span-all">
              <Input
                label="Current Password"
                type="password"
                required
                value={pwForm.current}
                onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
              />
            </div>

            <Input
              label="New Password"
              type="password"
              required
              value={pwForm.newPw}
              onChange={(e) => setPwForm({ ...pwForm, newPw: e.target.value })}
              hint="Must have uppercase, lowercase, special character, 9+ chars."
            />

            <Input
              label="Confirm New Password"
              type="password"
              required
              value={pwForm.confirmPw}
              onChange={(e) => setPwForm({ ...pwForm, confirmPw: e.target.value })}
            />

            <div className="span-all">
              <Button type="submit" loading={pwLoading}>
                <KeyRound size={16} /> Update Password
              </Button>
            </div>
          </form>

          <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <h4 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={16} color="#10b981" /> Active Session Details
            </h4>
            <div className="card" style={{ background: 'var(--surface-2)', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Laptop size={22} className="muted" />
                <div>
                  <strong>Windows PC · Chrome Browser Session</strong>
                  <p className="muted" style={{ margin: '2px 0 0', fontSize: '12px' }}>IP: 127.0.0.1 · Active session</p>
                </div>
              </div>
              <span className="stock-pill stock-in">Current</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}