import axios from 'axios';

const getSanitizedApiUrl = () => {
  let url = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';
  // Strip trailing slashes and '/admin' suffix to prevent common misconfigurations
  url = url.replace(/\/$/, '');
  url = url.replace(/\/admin$/, '');
  return url;
};

const API_URL = getSanitizedApiUrl();

const api = axios.create({
  baseURL: API_URL,
});

// Interceptor to add JWT token if it exists
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('jwt');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export default api;
