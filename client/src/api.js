import axios from 'axios';

const BASE = import.meta.env.DEV ? '/api' : '/api';

const client = axios.create({ baseURL: BASE });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('asterope_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('asterope_token');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export const auth = {
  login:  (password) => client.post('/auth/login', { password }),
  verify: ()         => client.post('/auth/verify'),
};

export const workspaces = {
  list:   ()       => client.get('/workspaces'),
  get:    (id)     => client.get(`/workspaces/${id}`),
  create: (data)   => client.post('/workspaces', data),
  start:  (id)     => client.post(`/workspaces/${id}/start`),
  stop:   (id)     => client.post(`/workspaces/${id}/stop`),
  delete: (id)     => client.delete(`/workspaces/${id}`),
  logs:   (id)     => client.get(`/workspaces/${id}/logs`),
};

export const metrics = {
  get: () => client.get('/metrics'),
};
