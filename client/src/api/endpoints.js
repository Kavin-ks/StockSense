// One place that knows every backend route. Pages call these, never raw URLs.
import { api } from './client.js';

export const authApi = {
  login: (body) => api.post('/auth/login', body),
  signup: (body) => api.post('/auth/signup', body),
  sendSignupOtp: (body) => api.post('/auth/signup/send-otp', body),
  forgotPassword: (body) => api.post('/auth/forgot-password', body),
  resetPassword: (body) => api.post('/auth/reset-password', body),
  me: () => api.get('/auth/me'),
  updateMe: (body) => api.put('/auth/me', body),
  uploadAvatar: (formData) => api.upload('/auth/me/avatar', formData),
  deleteAvatar: () => api.del('/auth/me/avatar'),
  changePassword: (body) => api.put('/auth/me/password', body),
  sessions: () => api.get('/auth/me/sessions'),
  revokeSession: (id) => api.del(`/auth/me/sessions/${id}`),
  revokeOtherSessions: () => api.post('/auth/me/sessions/revoke-others'),
  logout: () => api.post('/auth/logout'),
  preferences: () => api.get('/auth/me/preferences'),
  updatePreferences: (body) => api.put('/auth/me/preferences', body),
};

export const dashboardApi = {
  summary: (params) => api.get('/dashboard/summary', params),
  alerts: () => api.get('/dashboard/alerts'),
  users: () => api.get('/dashboard/users'),
};

const archivable = (base) => ({
  archive: (id) => api.post(`${base}/${id}/archive`),
  restore: (id) => api.post(`${base}/${id}/restore`),
});

export const warehouseApi = {
  ...archivable('/warehouses'),
  list: () => api.get('/warehouses'),
  create: (body) => api.post('/warehouses', body),
  update: (id, body) => api.put(`/warehouses/${id}`, body),
};

export const locationApi = {
  ...archivable('/locations'),
  list: (params) => api.get('/locations', params),
  create: (body) => api.post('/locations', body),
  update: (id, body) => api.put(`/locations/${id}`, body),
};

export const categoryApi = {
  ...archivable('/categories'),
  list: () => api.get('/categories'),
  create: (body) => api.post('/categories', body),
};

export const productApi = {
  ...archivable('/products'),
  list: (params) => api.get('/products', params),
  get: (id) => api.get(`/products/${id}`),
  create: (body) => api.post('/products', body),
  update: (id, body) => api.put(`/products/${id}`, body),
  uoms: () => api.get('/products/meta/uoms'),
  saveRule: (id, body) => api.put(`/products/${id}/reorder-rules`, body),
  deleteRule: (id, ruleId) => api.del(`/products/${id}/reorder-rules/${ruleId}`),
};

export const operationApi = {
  list: (params) => api.get('/operations', params),
  get: (id) => api.get(`/operations/${id}`),
  create: (body) => api.post('/operations', body),
  update: (id, body) => api.put(`/operations/${id}`, body),
  confirm: (id) => api.post(`/operations/${id}/confirm`),
  validate: (id) => api.post(`/operations/${id}/validate`),
  cancel: (id) => api.post(`/operations/${id}/cancel`),
  batchConfirm: (ids) => api.post('/operations/batch/confirm', { ids }),
  batchCancel: (ids) => api.post('/operations/batch/cancel', { ids }),
  adjust: (body) => api.post('/operations/adjustments', body),
  pick: (id, body) => api.post(`/operations/${id}/pick`, body),
  pack: (id) => api.post(`/operations/${id}/pack`),
  checkAvailability: (id) => api.post(`/operations/${id}/check-availability`),
};

export const moveApi = {
  list: (params) => api.get('/moves', params),
};

export const userApi = {
  list: (params) => api.get('/users', params),
  create: (body) => api.post('/users', body),
  update: (id, body) => api.patch(`/users/${id}`, body),
  approve: (id, body) => api.post(`/users/${id}/approve`, body),
  reject: (id) => api.post(`/users/${id}/reject`),
  pendingCount: () => api.get('/users/pending-count'),
  remove: (id) => api.del(`/users/${id}`),
};

export const eventsApi = {
  token: () => api.post('/events/token'),
};

export const exportApi = {
  products: () => api.download('/export/products'),
  stock: () => api.download('/export/stock'),
  moves: () => api.download('/export/moves'),
  operations: () => api.download('/export/operations'),
};

export const reportsApi = {
  movement: (params) => api.get('/reports/movement', params),
  activity: (params) => api.get('/reports/activity', params),
  reorderSuggestions: () => api.get('/reports/reorder-suggestions'),
  insights: (params) => api.get('/reports/insights', params),
  cycleCounts: (params) => api.get('/reports/cycle-counts', params),
};

export const importApi = {
  products: (csvText, dryRun) => api.postText('/import/products', csvText, { dryRun: dryRun ? 'true' : undefined }),
};

export const searchApi = {
  query: (q) => api.get('/search', { q }),
};
