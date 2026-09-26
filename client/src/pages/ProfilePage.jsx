import { useState, useEffect, useRef } from 'react';
import {
  User,
  ShieldAlert,
  PackageCheck,
  FileSpreadsheet,
  BellRing,
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
  Trash2,
  Smartphone
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useForm } from '../hooks/useForm.js';
import { useToast } from '../context/ToastContext.jsx';
import { Alert, Button, Input, Select } from '../components/ui.jsx';
import { EMAIL_RE, fmtDate, fmtDateTime, passwordProblems, timeAgo } from '../utils.js';
import { useFetch } from '../hooks/useFetch.js';
import { warehouseApi, authApi } from '../api/endpoints.js';

/** "Chrome on macOS" from a user-agent string (best effort, no library). */
function describeDevice(ua = '') {
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'unknown OS';
  return `${browser} on ${os}`;
}

export default function ProfilePage() {
  const { user, setUser, updateProfile, logout, prefs, updatePreferences } = useAuth();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);
  const notify = useToast();
  const [activeTab, setActiveTab] = useState('general');
  const [warehouses, setWarehouses] = useState([]);
  const [copied, setCopied] = useState(false);

  const notifs = prefs.notifications;

  // Password change (server-verified) + real sign-in sessions
  const [pwSuccess, setPwSuccess] = useState('');
  const sessions = useFetch(() => authApi.sessions(), [activeTab === 'security'], { live: ['users'] });
  const pwForm = useForm({ currentPassword: '', password: '', confirmPassword: '' }, {
    validate: (v) => {
      const e = {};
      if (!v.currentPassword) e.currentPassword = 'Current password is required';
      const problems = passwordProblems(v.password);
      if (problems.length) e.password = `Password needs ${problems.join(', ')}`;
      if (v.password !== v.confirmPassword) e.confirmPassword = 'Passwords do not match';
      return e;
    },
    onSubmit: async (v) => {
      setPwSuccess('');
      const res = await authApi.changePassword(v);
      pwForm.setValues({ currentPassword: '', password: '', confirmPassword: '' });
      const others = res.signedOutSessions;
      setPwSuccess(`Password updated.${others ? ` Signed out ${others} other session(s).` : ''}`);
      notify('Password changed');
      sessions.reload();
    },
  });

  // Load warehouses for preferences
  useEffect(() => {
    warehouseApi.list().then(setWarehouses).catch(() => {});
  }, []);

  // Main profile form
  const form = useForm(
    { name: user?.name || '', email: user?.email || '', phone: user?.phone || '', department: user?.department || '' },
    {
      validate: (v) => ({
        ...(v.name.trim().length < 2 && { name: 'Name must be at least 2 characters' }),
        ...(!EMAIL_RE.test(v.email.trim()) && { email: 'Please enter a valid email address' }),
        ...(v.phone.trim() && !/^\+?[0-9 ()-]{7,}$/.test(v.phone.trim()) && { phone: 'Enter a valid phone number' }),
      }),
      onSubmit: async (v) => {
        await updateProfile({ name: v.name, email: v.email, phone: v.phone, department: v.department });
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

  // Saved to the database immediately (user_preferences), applied across the app.
  const savePref = async (patch, message) => {
    try {
      await updatePreferences(patch);
      notify(message);
    } catch (err) {
      notify(err.message, 'error');
    }
  };
  const handlePrefChange = (key, value) => savePref({ [key]: value }, 'Preference saved');
  const handleNotifToggle = (key) => savePref({ notifications: { [key]: !notifs[key] } }, 'Alert setting updated');

  const revokeSession = async (id) => {
    try {
      await authApi.revokeSession(id);
      notify('Session signed out');
      sessions.reload();
    } catch (err) {
      notify(err.message, 'error');
    }
  };
  const revokeOthers = async () => {
    const { signedOutSessions } = await authApi.revokeOtherSessions();
    notify(`Signed out ${signedOutSessions} other session(s)`);
    sessions.reload();
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
              value={prefs.defaultWarehouseId ? String(prefs.defaultWarehouseId) : ''}
              onChange={(e) => handlePrefChange('defaultWarehouseId', e.target.value ? Number(e.target.value) : null)}
              placeholder="All Warehouses (Global View)"
              options={warehouses.map((w) => ({ value: String(w.id), label: `${w.name} (${w.shortCode})` }))}
              hint="Pre-filters operations and inventory to your primary hub."
            />

            <Select
              label="Default Starting View"
              value={prefs.landingPage}
              onChange={(e) => handlePrefChange('landingPage', e.target.value)}
              options={[
                { value: '/', label: 'Dashboard Overview' },
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

      {/* Tab 4: Alert Notifications with Industrial Styled Badges */}
      {activeTab === 'notifications' && (
        <div className="profile-section-card industrial-alerts-section">
          <div className="section-head">
            <div className="industrial-section-header">
              <div className="industrial-header-badge">
                <BellRing size={20} className="industrial-header-icon" />
              </div>
              <div>
                <h3>Alerts & Event Notifications</h3>
                <p>Industrial event triggers, dock dispatch alerts, and automated stock safety webhooks.</p>
              </div>
            </div>
          </div>

          <div className="industrial-switch-list">
            {/* 1. Low-Stock Safety Buffer */}
            <div className={`industrial-switch-card ${notifs.lowStock ? 'active' : ''}`}>
              <div className="industrial-icon-box hazard">
                <ShieldAlert size={24} strokeWidth={2.2} />
              </div>
              <div className="industrial-switch-info">
                <div className="industrial-title-row">
                  <h4 className="industrial-switch-heading">Low-Stock Reorder Triggers</h4>
                  <span className="industrial-badge hazard">HAZARD DEFENSE</span>
                </div>
                <p className="industrial-switch-text">
                  Receive immediate telemetry alerts when SKU on-hand reaches or drops below minimum safety buffer.
                </p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notifs.lowStock}
                  onChange={() => handleNotifToggle('lowStock')}
                  aria-label="Toggle low-stock alerts"
                />
                <span className="toggle-slider" />
              </label>
            </div>

            {/* 2. Inward Receipt Confirmations */}
            <div className={`industrial-switch-card ${notifs.receipts ? 'active' : ''}`}>
              <div className="industrial-icon-box inward">
                <PackageCheck size={24} strokeWidth={2.2} />
              </div>
              <div className="industrial-switch-info">
                <div className="industrial-title-row">
                  <h4 className="industrial-switch-heading">Inward Receipt Confirmations</h4>
                  <span className="industrial-badge inward">DOCK RECEIVING</span>
                </div>
                <p className="industrial-switch-text">
                  Notify when purchase vendor goods are checked in and verified at inbound receiving dock locations.
                </p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notifs.receipts}
                  onChange={() => handleNotifToggle('receipts')}
                  aria-label="Toggle inward receipt alerts"
                />
                <span className="toggle-slider" />
              </label>
            </div>

            {/* 3. Outward Delivery Dispatches */}
            <div className={`industrial-switch-card ${notifs.deliveries ? 'active' : ''}`}>
              <div className="industrial-icon-box outward">
                <Truck size={24} strokeWidth={2.2} />
              </div>
              <div className="industrial-switch-info">
                <div className="industrial-title-row">
                  <h4 className="industrial-switch-heading">Outward Delivery Dispatches</h4>
                  <span className="industrial-badge outward">FLEET DISPATCH</span>
                </div>
                <p className="industrial-switch-text">
                  Real-time alerts when customer shipments are validated, packed, and stock departs loading bays.
                </p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notifs.deliveries}
                  onChange={() => handleNotifToggle('deliveries')}
                  aria-label="Toggle outward delivery alerts"
                />
                <span className="toggle-slider" />
              </label>
            </div>

            {/* 4. Physical Count Discrepancies */}
            <div className={`industrial-switch-card ${notifs.adjustments ? 'active' : ''}`}>
              <div className="industrial-icon-box audit">
                <Scale size={24} strokeWidth={2.2} />
              </div>
              <div className="industrial-switch-info">
                <div className="industrial-title-row">
                  <h4 className="industrial-switch-heading">Physical Count Discrepancies</h4>
                  <span className="industrial-badge audit">LEDGER AUDIT</span>
                </div>
                <p className="industrial-switch-text">
                  Flag when a cycle count physical inventory adjustment modifies the verified double-entry stock ledger.
                </p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notifs.adjustments}
                  onChange={() => handleNotifToggle('adjustments')}
                  aria-label="Toggle count discrepancy alerts"
                />
                <span className="toggle-slider" />
              </label>
            </div>

            {/* 5. Daily Movement Digest */}
            <div className={`industrial-switch-card ${notifs.dailyDigest ? 'active' : ''}`}>
              <div className="industrial-icon-box digest">
                <FileSpreadsheet size={24} strokeWidth={2.2} />
              </div>
              <div className="industrial-switch-info">
                <div className="industrial-title-row">
                  <h4 className="industrial-switch-heading">Daily Movement Telemetry Digest</h4>
                  <span className="industrial-badge digest">SCHEDULED REPORT</span>
                </div>
                <p className="industrial-switch-text">
                  Receive an automated end-of-day summary email of all internal stock quants, velocities, and valuation.
                </p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notifs.dailyDigest}
                  onChange={() => handleNotifToggle('dailyDigest')}
                  aria-label="Toggle daily movement digest"
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

          <form onSubmit={pwForm.handleSubmit} className="form-grid narrow" noValidate>
            {pwForm.formError && <div className="span-all"><Alert>{pwForm.formError}</Alert></div>}
            {pwSuccess && <div className="span-all"><div className="alert alert-info">{pwSuccess}</div></div>}

            <div className="span-all">
              <Input label="Current Password" type="password" required autoComplete="current-password" {...pwForm.bind('currentPassword')} />
            </div>
            <Input label="New Password" type="password" required autoComplete="new-password"
              hint="Must have uppercase, lowercase, special character, 9+ chars." {...pwForm.bind('password')} />
            <Input label="Confirm New Password" type="password" required autoComplete="new-password" {...pwForm.bind('confirmPassword')} />
            <div className="span-all">
              <Button type="submit" loading={pwForm.submitting}>
                <KeyRound size={16} /> Update Password
              </Button>
              {user?.passwordChangedAt && <span className="muted small-print" style={{ marginLeft: 12 }}>Last changed {fmtDate(user.passwordChangedAt)}</span>}
            </div>
          </form>

          <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <div className="section-head" style={{ marginBottom: 10 }}>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={16} color="#10b981" /> Active sessions
              </h4>
              {sessions.data?.length > 1 && <Button variant="ghost" onClick={revokeOthers}>Sign out other devices</Button>}
            </div>
            {sessions.error && <Alert>{sessions.error.message}</Alert>}
            <div className="stack" style={{ gap: 8 }}>
              {(sessions.data ?? []).map((sess) => (
                <div key={sess.id} className="card session-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/mobile|android|iphone/i.test(sess.userAgent ?? '') ? <Smartphone size={22} className="muted" /> : <Laptop size={22} className="muted" />}
                    <div>
                      <strong>{describeDevice(sess.userAgent)}</strong>
                      <p className="muted" style={{ margin: '2px 0 0', fontSize: '12px' }}>
                        IP {sess.ip ?? 'unknown'} · signed in {fmtDateTime(sess.createdAt)} · active {timeAgo(sess.lastSeenAt)}
                      </p>
                    </div>
                  </div>
                  {sess.current
                    ? <span className="stock-pill stock-in">This device</span>
                    : <Button variant="danger-ghost" onClick={() => revokeSession(sess.id)}>Sign out</Button>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}