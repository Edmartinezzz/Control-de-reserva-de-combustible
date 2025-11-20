'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ExclamationTriangleIcon, UserCircleIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';

export default function Login() {
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [esAdmin, setEsAdmin] = useState(true);
  const [telefonoCliente, setTelefonoCliente] = useState('');
  const { login } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!usuario || !contrasena) {
      setError('Por favor ingrese usuario y contraseña');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await login(usuario, contrasena);
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Error al iniciar sesión:', error);
      let message = 'Error al iniciar sesión';

      if (error.response) {
        // Server responded with a status code outside 2xx range
        message = error.response.data?.error || `Error del servidor: ${error.response.status}`;
      } else if (error.request) {
        // Request was made but no response received
        message = 'No se recibió respuesta del servidor. Verifique su conexión.';
      } else {
        // Something happened in setting up the request
        message = error.message || message;
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleClienteLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Redirigir directamente a la página del cliente
    router.push('/cliente');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 animate-fade-in transition-colors duration-300">
      <div className="max-w-md w-full space-y-8 animate-fade-in-up">
        <div>
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="animate-bounce-in">
              <img
                src={theme === 'dark' ? '/logo-dark.png' : '/logo.png'}
                alt="Despacho Gas+ Logo"
                className="h-32 w-auto transition-opacity duration-300"
              />
            </div>
          </div>

          <p className="text-center text-sm font-medium text-gray-600 dark:text-gray-400 mb-6">
            Sistema de Gestión de Combustible
          </p>
          <h2 className="text-center text-xl font-semibold text-gray-800 dark:text-white">
            {esAdmin ? 'Iniciar sesión' : 'Consulta de Usuario'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            {esAdmin
              ? 'Ingrese sus credenciales de administrador'
              : 'Ingrese su número de teléfono para ver su saldo'}
          </p>
        </div>

        {/* Selector de tipo de usuario */}
        <div className="flex rounded-md shadow-sm animate-scale-in" style={{ animationDelay: '0.2s' }}>
          <button
            type="button"
            onClick={() => setEsAdmin(true)}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-l-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:z-10 transition-all duration-200 hover:scale-105 active:scale-95 transform ${esAdmin
                ? 'bg-red-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'
              }`}
          >
            <div className="flex items-center justify-center">
              <LockClosedIcon className="h-5 w-5 mr-2" />
              Administrador
            </div>
          </button>
          <button
            type="button"
            onClick={() => setEsAdmin(false)}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-r-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:z-10 transition-all duration-200 hover:scale-105 active:scale-95 transform ${!esAdmin
                ? 'bg-red-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'
              }`}
          >
            <div className="flex items-center justify-center">
              <UserCircleIcon className="h-5 w-5 mr-2" />
              Usuario
            </div>
          </button>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4 animate-fade-in-down">
            <div className="flex">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-400">{error}</h3>
              </div>
            </div>
          </div>
        )}

        {esAdmin ? (
          <form className="mt-8 space-y-6" onSubmit={handleAdminLogin}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="usuario" className="sr-only">
                  Usuario
                </label>
                <input
                  id="usuario"
                  name="usuario"
                  type="text"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-t-md focus:outline-none focus:ring-red-500 focus:border-red-500 focus:z-10 sm:text-sm transition-colors duration-200"
                  placeholder="Usuario"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="contrasena" className="sr-only">
                  Contraseña
                </label>
                <input
                  id="contrasena"
                  name="contrasena"
                  type="password"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-b-md focus:outline-none focus:ring-red-500 focus:border-red-500 focus:z-10 sm:text-sm transition-colors duration-200"
                  placeholder="Contraseña"
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 active:scale-95 active:shadow-inner hover:shadow-lg transform"
              >
                {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
              </button>
            </div>
          </form>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleClienteLogin}>
            <div className="rounded-md shadow-sm">
              <div>
                <label htmlFor="telefono" className="sr-only">
                  Teléfono
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 dark:text-gray-400 sm:text-sm">+1</span>
                  </div>
                  <input
                    type="tel"
                    name="telefono"
                    id="telefono"
                    className="focus:ring-red-500 focus:border-red-500 block w-full pl-12 pr-12 sm:text-sm border-gray-300 dark:border-gray-600 rounded-md p-2 border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-colors duration-200"
                    placeholder="Ingrese su teléfono"
                    value={telefonoCliente}
                    onChange={(e) => setTelefonoCliente(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 active:scale-95 active:shadow-inner hover:shadow-lg transform"
              >
                {loading ? 'Buscando...' : 'Ver mi saldo'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
