import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' }
});

// Attach JWT token — checks both citizen and admin tokens
api.interceptors.request.use((config) => {
  // Admin routes use admin token
  if (config.url?.includes('/admin') || config.url?.includes('/auth/login')) {
    const adminToken = localStorage.getItem('civicpulse_token');
    if (adminToken) config.headers.Authorization = `Bearer ${adminToken}`;
  } else {
    // Citizen routes use citizen token
    const citizenToken = localStorage.getItem('civicpulse_citizen_token');
    if (citizenToken) config.headers.Authorization = `Bearer ${citizenToken}`;
  }
  return config;
});

// ===== Citizen Auth APIs (2FA) =====
export const citizenRegister = async ({ name, email, phone, password }) => {
  const response = await api.post('/citizen/register', { name, email, phone, password });
  return response.data;
};

export const citizenLogin = async (email, password) => {
  const response = await api.post('/citizen/login', { email, password });
  return response.data;
};

export const verifyOTP = async (email, otp) => {
  const response = await api.post('/citizen/verify-otp', { email, otp });
  return response.data;
};

export const resendOTP = async (email) => {
  const response = await api.post('/citizen/resend-otp', { email });
  return response.data;
};

// ===== Citizen APIs =====
export const submitIssue = async (formData) => {
  const response = await api.post('/issues', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const trackIssue = async (ticketId) => {
  const response = await api.get(`/issues/${ticketId}`);
  return response.data;
};

export const getCitizenIssues = async () => {
  const response = await api.get('/citizen/my-issues');
  return response.data;
};

export const getPublicAnalytics = async () => {
  const response = await api.get('/analytics');
  return response.data;
};

// ===== Admin Auth APIs =====
export const adminLogin = async (email, password) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};

// ===== Admin APIs =====
export const getAdminIssues = async (filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value);
  });
  const response = await api.get(`/admin/issues?${params.toString()}`);
  return response.data;
};

export const updateIssueStatus = async (id, updates) => {
  const response = await api.patch(`/admin/issues/${id}`, updates);
  return response.data;
};

export const markIssueInvalid = async (id, reason) => {
  const response = await api.post(`/admin/issues/${id}/invalid`, { reason });
  return response.data;
};

export const getAdminAnalytics = async () => {
  const response = await api.get('/admin/analytics');
  return response.data;
};

export const pingCityAdmin = async (issueId, message) => {
  const response = await api.post('/admin/ping', { issue_id: issueId, message });
  return response.data;
};

export default api;

// ===== New Feature APIs =====

/** Resolve an issue with a proof photo (admin) */
export const resolveIssueWithPhoto = async (id, file, adminNotes = '') => {
  const formData = new FormData();
  formData.append('resolved_photo', file);
  if (adminNotes) formData.append('admin_notes', adminNotes);
  const response = await api.post(`/admin/issues/${id}/resolve`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

/** React to a resolved issue (citizen) */
export const reactToIssue = async (ticketId, reaction) => {
  const response = await api.post(`/issues/${ticketId}/react`, { reaction });
  return response.data;
};
