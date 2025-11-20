import axios from 'axios';

const rawBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_BACKEND_API_BASE_URL ||
  '';
const normalizedBaseUrl = rawBaseUrl.trim().replace(/\/$/, '');

// Usar ruta relativa solo si no existe baseURL configurada
const api = axios.create({
  baseURL: normalizedBaseUrl || undefined,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withCredentials: true,
  timeout: 60000, // 60 segundos de timeout (tolerancia a cold-start)
});

// Añadir el token a las solicitudes
api.interceptors.request.use((config) => {
  // Intentar obtener el token de administrador primero
  let token = null;

  if (typeof window !== 'undefined') {
    token = localStorage.getItem('token');

    // Si no hay token de administrador, intentar con el token de cliente
    if (!token) {
      token = localStorage.getItem('clienteToken');
    }
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Manejar errores de red
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('Error en la petición:', error);

    if (error.code === 'ERR_NETWORK') {
      console.error('Error de conexión con el servidor:', error.message);
      throw new Error('No se pudo conectar al servidor. Por favor, verifica tu conexión a internet o contacta al administrador.');
    }

    if (error.response) {
      // El servidor respondió con un código de estado fuera del rango 2xx
      console.error('Error en la respuesta del servidor:', error.response.status, error.response.data);

      if (error.response.status === 401 && !error.config.url?.includes('/login')) {
        // No autorizado - token inválido o expirado
        if (typeof window !== 'undefined') {
          const isCliente = localStorage.getItem('clienteToken');

          if (isCliente) {
            // Si es un cliente, redirigir al login de cliente
            localStorage.removeItem('clienteToken');
            localStorage.removeItem('clienteData');
            window.location.href = '/cliente/login';
          } else {
            // Si es un administrador, redirigir al login de administrador
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
          }
        }
      }

      throw new Error(error.response.data.error || 'Error en la solicitud');
    } else if (error.request) {
      // La solicitud fue hecha pero no se recibió respuesta
      console.error('No se recibió respuesta del servidor:', error.request);
      throw new Error('No se recibió respuesta del servidor. Verifica tu conexión a internet.');
    }

    return Promise.reject(error);
  }
);

export default api;
