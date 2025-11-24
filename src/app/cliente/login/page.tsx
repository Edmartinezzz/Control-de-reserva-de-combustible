'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useClienteAuth } from '@/contexts/ClienteAuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FiDroplet, FiUser, FiArrowLeft } from 'react-icons/fi';

export default function ClienteLogin() {
  const [cedula, setCedula] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useClienteAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const cedulaParam = searchParams.get('cedula');
    if (cedulaParam) {
      setCedula(cedulaParam);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar formato de cédula venezolana (7 u 8 dígitos)
    const cedulaRegex = /^[0-9]{7,8}$/;
    if (!cedulaRegex.test(cedula)) {
      setError('La cédula debe tener 7 u 8 dígitos numéricos');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await login(cedula);
      // Redirección manejada por el contexto después del login exitoso
    } catch (error: any) {
      console.error('Error al iniciar sesión:', error);
      setError(error.message || 'Error al iniciar sesión. Por favor, intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-600 to-red-700 dark:from-gray-900 dark:to-gray-800 py-12 px-4 sm:px-6 lg:px-8 relative animate-fade-in">
      <button
        onClick={() => router.push('/')}
        className="absolute top-4 left-4 flex items-center text-white hover:text-red-100 transition-all duration-200 hover:scale-105 active:scale-95 transform"
      >
        <FiArrowLeft className="h-6 w-6 mr-2" />
        Volver al inicio
      </button>

      <div className="max-w-md w-full space-y-8 animate-scale-in">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 transition-colors duration-300">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4 animate-bounce-in">
              <img
                src={theme === 'dark' ? '/logo-dark.png' : '/logo.png'}
                alt="Despacho Gas+ Logo"
                className="h-24 w-auto transition-opacity duration-300"
              />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Portal del Usuario</h1>
            <p className="text-gray-600 dark:text-gray-300">Ingresa tu número de cédula para acceder</p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg relative mb-6 animate-fade-in-down" role="alert">
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="cedula" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Número de Cédula
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiUser className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                </div>
                <input
                  id="cedula"
                  name="cedula"
                  type="text"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200"
                  placeholder="Ej: 12345678"
                  value={cedula}
                  onChange={(e) => setCedula(e.target.value.replace(/\D/g, ''))}
                  maxLength={8}
                  pattern="\d{7,8}"
                  title="Ingrese un número de cédula válido (7 u 8 dígitos)"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-lg font-medium text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 active:scale-95 active:shadow-inner hover:shadow-lg transform"
            >
              {loading ? 'Verificando...' : 'Acceder'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => router.push('/login')}
              className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
            >
              ¿Eres administrador? Inicia sesión aquí
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
