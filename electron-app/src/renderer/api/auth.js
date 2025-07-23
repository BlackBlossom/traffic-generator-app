// src/api/auth.js

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_BASE = `${API_URL}/api/auth`;

// Helper to get authentication headers
function getAuthHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey
  };
}

// Helper function for authenticated fetch requests
export async function authFetch(url, options = {}, apiKey = null) {
  const email = getStoredEmail();
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('No token found in localStorage');
  }
  if (!email) {
    throw new Error('No email found in localStorage');
  }

  // Use provided API key or try to get from localStorage as fallback
  const finalApiKey = apiKey || localStorage.getItem('traffica_api_key');
  if (!finalApiKey) {
    throw new Error('No API key found. Please generate an API key first.');
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-api-key': finalApiKey,
    ...options.headers
  };

  return fetch(url, {
    ...options,
    headers
  });
}


// Helper to get email from localStorage
function getStoredEmail() {
  return localStorage.getItem('traffica_user_email');
}

// Registration
export async function register(name, email, password) {
  try {
    const res = await axios.post(`${API_BASE}/register`, { name, email, password });
    if (res.data) {
      localStorage.setItem('traffica_user_email', email);
    }
    return { success: true, ...res.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.error || error.message };
  }
}

// OTP Verification
export async function verify(otp) {
  const email = getStoredEmail();
  if (!email) return { success: false, message: 'No email found in localStorage.' };
  try {
    const res = await axios.post(`${API_BASE}/verify`, { email, otp });
    return { success: true, ...res.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.error || error.message };
  }
}

// Login
export async function login(email, password) {
  try {
    const res = await axios.post(`${API_BASE}/login`, { email, password });
    // Store email in localStorage on successful login
    if (res.data && res.data.token) {
      localStorage.setItem('traffica_user_email', email);
    }
    return { success: true, ...res.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.error || error.message };
  }
}

// Resend OTP
export async function resendOtp() {
  const email = getStoredEmail();
  if (!email) return { success: false, message: 'No email found in localStorage.' };
  try {
    const res = await axios.post(`${API_BASE}/resend-otp`, { email });
    return { success: true, ...res.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.error || error.message };
  }
}

// Forgot Password (send OTP)
export async function forgotPassword() {
  const email = getStoredEmail();
  if (!email) return { success: false, message: 'No email found in localStorage.' };
  try {
    const res = await axios.post(`${API_BASE}/forgot-password`, { email });
    return { success: true, ...res.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.error || error.message };
  }
}

// Reset Password (using OTP)
export async function resetPassword(otp, newPassword) {
  const email = getStoredEmail();
  if (!email) return { success: false, message: 'No email found in localStorage.' };
  try {
    const res = await axios.post(`${API_BASE}/reset-password`, { email, otp, newPassword });
    return { success: true, ...res.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.error || error.message };
  }
}

// Fetch User Details by Email
// src/api/auth.js

export async function getUserByEmail(token) {
  const email = localStorage.getItem('traffica_user_email');
  if (!email) return { success: false, message: 'No email found in localStorage.' };
  try {
    const config = token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : {};
    const res = await axios.get(
      `${API_BASE}/user-by-email`,
      {
        ...config,
        params: { email }
      }
    );
    return { success: true, ...res.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.error || error.message };
  }
}


// Update User Details (name, newEmail, password)
export async function updateUserDetails({ name, newEmail, password, token }) {
  const email = getStoredEmail();
  if (!email) return { success: false, message: 'No email found in localStorage.' };
  try {
    const payload = { name, newEmail, password, email };
    const res = await axios.post(
      `${API_BASE}/update-user`,
      payload,
      token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : undefined
    );
    // If email was changed, update in localStorage
    if (newEmail && newEmail !== email) {
      localStorage.setItem('traffica_user_email', newEmail);
    }
    return { success: true, ...res.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.error || error.message };
  }
}

// Change Password
export async function changePassword({ oldPassword, newPassword, token }) {
  const email = getStoredEmail();
  if (!email) return { success: false, message: 'No email found in localStorage.' };
  try {
    const payload = { email, oldPassword, newPassword };
    const res = await axios.post(
      `${API_BASE}/change-password`,
      payload,
      token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : undefined
    );
    return { success: true, ...res.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.error || error.message };
  }
}

// Generate API Key (requires JWT token)
export async function generateApiKey(token) {
  try {
    const res = await axios.post(
      `${API_BASE}/generate-apikey`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return { success: true, ...res.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.error || error.message };
  }
}

// Revoke API Key (requires JWT token)
export async function revokeApiKey(apiKey, token) {
  try {
    const res = await axios.post(
      `${API_BASE}/revoke-apikey`,
      { apiKey },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return { success: true, ...res.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.error || error.message };
  }
}

// ---Campaigns API Endpoints---

// GET /api/users/:email/campaigns
export async function getUserCampaigns(email, apiKey) {
  const url = `${API_BASE}/users/${encodeURIComponent(email)}/campaigns`;
  const response = await axios.get(url, {
    headers: getAuthHeaders(apiKey),
  });
  return response.data;
}

// POST /api/users/:email/campaigns
export async function createCampaign(email, apiKey, campaignData) {
  const url = `${API_BASE}/users/${encodeURIComponent(email)}/campaigns`;
  const response = await axios.post(url, campaignData, {
    headers: getAuthHeaders(apiKey)
  });
  return response.data;
}

// PUT /api/users/:email/campaigns/:campaignId
export async function updateCampaign(email, campaignId, apiKey, updateData) {
  const url = `${API_BASE}/users/${encodeURIComponent(email)}/campaigns/${campaignId}`;
  const response = await axios.put(url, updateData, {
    headers: getAuthHeaders(apiKey)
  });
  return response.data;
}

// GET /api/users/:email/campaigns/:campaignId
export async function getSingleCampaign(email, campaignId, apiKey) {
  const url = `${API_BASE}/users/${encodeURIComponent(email)}/campaigns/${campaignId}`;
  const response = await axios.get(url, {
    headers: getAuthHeaders(apiKey)
  });
  return response.data;
}

// DELETE /api/users/:email/campaigns/:campaignId
export async function deleteCampaign(email, campaignId, apiKey) {
  const url = `${API_BASE}/users/${encodeURIComponent(email)}/campaigns/${campaignId}`;
  const response = await axios.delete(url, {
    headers: getAuthHeaders(apiKey)
  });
  return response.data;
}

// POST /api/users/:email/campaigns/:campaignId/stop
export async function stopCampaign(email, campaignId, apiKey) {
  const url = `${API_BASE}/users/${encodeURIComponent(email)}/campaigns/${campaignId}/stop`;
  const response = await axios.post(url, {}, {
    headers: getAuthHeaders(apiKey)
  });
  return response.data;
}
