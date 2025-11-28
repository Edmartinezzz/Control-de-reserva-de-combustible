'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  Filler,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { FiTruck, FiPackage, FiUser, FiUsers, FiDollarSign, FiClock, FiCalendar, FiSearch, FiUserPlus, FiLogOut, FiMenu, FiX, FiDownload, FiFilter, FiRefreshCw, FiLock, FiUnlock, FiFileText, FiEye } from 'react-icons/fi';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/lib/api';
import axios from 'axios';

// Registrar componentes de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  Filler
);


const opcionesGrafica = {
  responsive: true,
  plugins: {
    legend: {
      position: 'top' as const,
    },
  },
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const fechaActual = new Date();
  const fechaFormateada = format(fechaActual, "EEEE d 'de' MMMM 'de' yyyy", { locale: es });

  // Obtener estadísticas (ejemplo con React Query)
  const { data: estadisticas, isLoading, refetch: refetchEstadisticas } = useQuery({
    queryKey: ['estadisticas'],
    queryFn: async () => {
      const { data } = await api.get('/api/estadisticas');
      return data;
    },
    initialData: {
      totalClientes: 0,
      totalLitrosEntregados: 0,
      proximosVencimientos: 0,
    },
    refetchInterval: 5000, // Actualizar cada 5 segundos
    enabled: !!user, // Solo ejecutar si el usuario está autenticado
  });

  // Obtener últimos retiros en tiempo real
  const { data: ultimosRetiros = [], isLoading: loadingRetiros } = useQuery({
    queryKey: ['retiros'],
    queryFn: async () => {
      const { data } = await api.get('/api/retiros');
      return data;
    },
    refetchInterval: 3000, // Actualizar cada 3 segundos
    enabled: !!user, // Solo ejecutar si el usuario está autenticado
  });

  // Obtener lista de usuarios registrados
  const { data: usuarios = [], isLoading: loadingUsuarios } = useQuery({
    queryKey: ['usuarios-dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/api/clientes/simple');
      return data;
    },
    refetchInterval: 30000, // Actualizar cada 30 segundos
    enabled: !!user, // Solo ejecutar si el usuario está autenticado
  });

  // Obtener estadísticas de retiros para las gráficas
  const { data: statsRetiros, refetch: refetchStatsRetiros, isFetching: isFetchingStats } = useQuery({
    queryKey: ['estadisticasRetiros'],
    queryFn: async () => {
      const { data } = await api.get('/api/estadisticas/retiros');
      return data;
    },
    initialData: {
      litrosHoy: 0,
      litrosMes: 0,
      litrosAno: 0,
      clientesHoy: 0,
      litrosPorMes: [],
      retirosPorDia: []
    },
    refetchInterval: 5000, // Actualizar cada 5 segundos
    enabled: !!user, // Solo ejecutar si el usuario está autenticado
  });

  // Obtener estado de bloqueo de retiros
  const { data: estadoBloqueo, refetch: refetchBloqueo } = useQuery({
    queryKey: ['estadoBloqueo'],
    queryFn: async () => {
      const { data } = await api.get('/api/sistema/bloqueo');
      return data;
    },
    initialData: { bloqueado: false },
    refetchInterval: 10000, // Actualizar cada 10 segundos
    enabled: !!user, // Solo ejecutar si el usuario está autenticado
  });

  // Preparar datos para gráfica de retiros por día (últimos 7 días)
  const retirosPorDiaData = {
    labels: statsRetiros.retirosPorDia.map((item: any) =>
      format(new Date(item.dia + 'T00:00:00'), 'dd/MM', { locale: es })
    ),
    datasets: [
      {
        label: 'Litros retirados',
        data: statsRetiros.retirosPorDia.map((item: any) => item.total),
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
      },
    ],
  };

  // Preparar datos para gráfica de litros por mes (últimos 12 meses)
  const litrosPorMesData = {
    labels: statsRetiros.litrosPorMes.map((item: any) => {
      const [year, month] = item.mes.split('-');
      return format(new Date(parseInt(year), parseInt(month) - 1), 'MMM yyyy', { locale: es });
    }),
    datasets: [
      {
        label: 'Litros retirados por mes',
        data: statsRetiros.litrosPorMes.map((item: any) => item.total),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.5)',
        tension: 0.4,
        fill: true,
      },
    ],
  };

  // Preparar datos para gráfica circular de resumen
  const resumenData = {
    labels: ['Hoy', 'Este Mes', 'Este Año'],
    datasets: [
      {
        data: [statsRetiros.litrosHoy, statsRetiros.litrosMes, statsRetiros.litrosAno],
        backgroundColor: [
          'rgba(59, 130, 246, 0.7)',
          'rgba(16, 185, 129, 0.7)',
          'rgba(245, 158, 11, 0.7)',
        ],
        borderWidth: 2,
        borderColor: '#fff',
      },
    ],
  };

  // Función para actualizar todas las gráficas manualmente
  const handleRefreshCharts = async () => {
    try {
      await Promise.all([
        refetchEstadisticas(),
        refetchStatsRetiros()
      ]);
      // Mostrar toast de éxito
      const toastModule = await import('react-hot-toast');
      toastModule.default.success('Gráficas actualizadas correctamente');
    } catch (error) {
      const toastModule = await import('react-hot-toast');
      toastModule.default.error('Error al actualizar las gráficas');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 md:p-8 transition-colors duration-300">
        <header className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">Panel de Control</h1>
              <p className="text-gray-600 dark:text-gray-300">Bienvenido, {user?.nombre || 'Usuario'}</p>
              {estadoBloqueo?.bloqueado && (
                <div className="mt-2 flex items-center px-3 py-1 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-lg">
                  <FiLock className="mr-2 h-4 w-4 text-red-600 dark:text-red-400" />
                  <span className="text-sm font-medium text-red-800 dark:text-red-300">Retiros de combustible BLOQUEADOS</span>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRefreshCharts}
                disabled={isFetchingStats}
                className="flex items-center px-4 py-2 bg-indigo-600 dark:bg-indigo-700 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                title="Actualizar todas las gráficas"
              >
                <FiRefreshCw className={`mr-2 ${isFetchingStats ? 'animate-spin' : ''}`} />
                Actualizar Gráficas
              </button>
              <button
                onClick={() => router.push('/admin/agendamientos-diarios')}
                className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <FiCalendar className="mr-2" />
                Lista Diaria
              </button>
              <button
                onClick={() => router.push('/admin/inventario')}
                className="flex items-center px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
              >
                <FiPackage className="mr-2" />
                Inventario
              </button>
              <button
                onClick={() => router.push('/dashboard/registrar-cliente')}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <FiUserPlus className="mr-2" />
                Registrar Cliente
              </button>
              <button
                onClick={() => router.push('/clientes')}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FiSearch className="mr-2" />
                Consultar Cliente
              </button>
              <button
                onClick={async () => {
                  if (confirm('¿Resetear litros disponibles de todos los clientes? Esto restaurará sus litros mensuales.')) {
                    try {
                      const response = await api.post('/api/admin/reset-litros');
                      alert(`✅ ${response.data.message}\nClientes actualizados: ${response.data.clientes_actualizados}`);
                    } catch (error: any) {
                      alert('❌ Error al resetear litros: ' + (error.response?.data?.error || error.message));
                    }
                  }
                }}
                className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                <FiRefreshCw className="mr-2" />
                Reset Litros
              </button>
              <button
                onClick={async () => {
                  const accion = estadoBloqueo?.bloqueado ? 'desbloquear' : 'bloquear';
                  const mensaje = estadoBloqueo?.bloqueado
                    ? '¿Desbloquear retiros de combustible? Los clientes podrán volver a retirar combustible.'
                    : '¿Bloquear retiros de combustible? Ningún cliente podrá retirar combustible hasta que se desbloquee.';

                  if (confirm(mensaje)) {
                    try {
                      const response = await api.post('/api/sistema/bloqueo', {
                        bloqueado: !estadoBloqueo?.bloqueado
                      });
                      alert(`✅ ${response.data.message}`);
                      refetchBloqueo(); // Actualizar estado
                    } catch (error: any) {
                      alert('❌ Error al ' + accion + ' retiros: ' + (error.response?.data?.error || error.message));
                    }
                  }
                }}
                className={`flex items-center px-4 py-2 text-white rounded-lg transition-colors ${estadoBloqueo?.bloqueado
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-gray-600 hover:bg-gray-700'
                  }`}
                title={estadoBloqueo?.bloqueado ? 'Desbloquear retiros' : 'Bloquear retiros'}
              >
                {estadoBloqueo?.bloqueado ? (
                  <>
                    <FiUnlock className="mr-2" />
                    Desbloquear
                  </>
                ) : (
                  <>
                    <FiLock className="mr-2" />
                    Bloquear
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  logout();
                  router.push('/login');
                }}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                title="Cerrar Sesión"
              >
                <FiLogOut className="mr-2" />
                Cerrar Sesión
              </button>
            </div>
          </div>
          <div className="flex items-center text-sm text-gray-500">
            <FiClock className="mr-1.5 h-5 w-5 text-gray-400" />
            <span>{format(fechaActual, 'HH:mm')} hrs</span>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Se eliminaron las tarjetas de resumen */}

          {/* Tarjetas adicionales de estadísticas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 border border-blue-200 dark:border-blue-800 rounded-xl shadow p-6 transition-colors duration-300">
              <h3 className="text-sm font-semibold mb-2 text-blue-800 dark:text-blue-300">Litros Retirados Hoy</h3>
              <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">{statsRetiros.litrosHoy.toFixed(2)} <span className="text-2xl">L</span></p>
              <p className="text-sm text-blue-500 dark:text-blue-400 mt-2">{statsRetiros.clientesHoy} clientes retiraron hoy</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20 border border-green-200 dark:border-green-800 rounded-xl shadow p-6 transition-colors duration-300">
              <h3 className="text-sm font-semibold mb-2 text-green-800 dark:text-green-300">Litros Este Mes</h3>
              <p className="text-4xl font-bold text-green-600 dark:text-green-400">{statsRetiros.litrosMes.toFixed(2)} <span className="text-2xl">L</span></p>
              <p className="text-sm text-green-500 dark:text-green-400 mt-2">Acumulado mensual</p>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/20 border border-amber-200 dark:border-amber-800 rounded-xl shadow p-6 transition-colors duration-300">
              <h3 className="text-sm font-semibold mb-2 text-amber-800 dark:text-amber-300">Litros Este Año</h3>
              <p className="text-4xl font-bold text-amber-600 dark:text-amber-400">{statsRetiros.litrosAno.toFixed(2)} <span className="text-2xl">L</span></p>
              <p className="text-sm text-amber-500 dark:text-amber-400 mt-2">Acumulado anual</p>
            </div>
          </div>

          {/* Gráficas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow transition-colors duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Retiros por Día (Últimos 7 días)</h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">Actualización en tiempo real</span>
              </div>
              <div className="h-80">
                {statsRetiros.retirosPorDia.length > 0 ? (
                  <Bar options={opcionesGrafica} data={retirosPorDiaData} />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
                    No hay datos disponibles
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow transition-colors duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Resumen de Litros</h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">Hoy, Mes, Año</span>
              </div>
              <div className="h-80 flex items-center justify-center">
                {(statsRetiros.litrosHoy > 0 || statsRetiros.litrosMes > 0 || statsRetiros.litrosAno > 0) ? (
                  <Pie data={resumenData} options={opcionesGrafica} />
                ) : (
                  <div className="text-gray-400 dark:text-gray-500">No hay retiros registrados</div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg mb-8 transition-colors duration-300">
            <div className="px-4 py-5 sm:px-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Litros Retirados por Mes</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Últimos 12 meses - Identifica los meses con más retiros</p>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Actualización automática</span>
            </div>
            <div className="px-4 py-5 sm:p-6">
              <div className="h-80">
                {statsRetiros.litrosPorMes.length > 0 ? (
                  <Line options={opcionesGrafica} data={litrosPorMesData} />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
                    No hay datos disponibles
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabla de últimos retiros */}
          <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg transition-colors duration-300">
            <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
              <div>
                <h3 className="text-lg leading-6 font-semibold text-blue-800 dark:text-blue-400">Lista de Usuarios Registrados</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Vista previa de usuarios - Haz clic en "Ver Todos" para la lista completa</p>
              </div>
              <a
                href="/admin/usuarios"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 hover:scale-105 active:scale-95"
              >
                <FiUsers className="h-4 w-4" />
                Ver Todos los Usuarios
              </a>
            </div>
            <div className="overflow-x-auto">
              {loadingUsuarios ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : usuarios.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  No hay usuarios registrados
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Usuario
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cédula
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Teléfono
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Categoría
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Litros Asignados
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Litros Disponibles
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {usuarios.slice(0, 10).map((usuario: any) => (
                      <tr key={usuario.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-8 w-8">
                              <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <FiUser className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              </div>
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {usuario.nombre}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {usuario.placa || 'Sin placa'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {usuario.cedula}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {usuario.telefono}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            {usuario.categoria}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="font-semibold text-blue-600">{usuario.litros_mes?.toFixed(2) || '0.00'} L</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="font-semibold text-green-600">{usuario.litros_disponibles?.toFixed(2) || '0.00'} L</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
