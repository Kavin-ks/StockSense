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
};

export const dashboardApi = {
  summary: (params) => api.get('/dashboard/summary', params),
  alerts: () => api.get('/dashboard/alerts'),
  users: () => api.get('/dashboard/users'),
};

export const warehouseApi = {
  list: () => api.get('/warehouses'),
  create: (body) => api.post('/warehouses', body),
  update: (id, body) => api.put(`/warehouses/${id}`, body),
};

export const locationApi = {
  list: (params) => api.get('/locations', params),
  create: (body) => api.post('/locations', body),
  update: (id, body) => api.put(`/locations/${id}`, body),
};

export const categoryApi = {
  list: () => api.get('/categories'),
  create: (body) => api.post('/categories', body),
};

export const productApi = {
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
  adjust: (body) => api.post('/operations/adjustments', body),
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
