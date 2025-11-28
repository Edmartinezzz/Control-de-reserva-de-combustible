'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';
import { FiDownload, FiCalendar, FiUsers, FiClock, FiSettings, FiSearch, FiFilter, FiRefreshCw, FiTruck, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import BackButton from '@/components/ui/BackButton';

// Declaración de tipo para jsPDF con autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: typeof autoTable;
  }
}

interface Agendamiento {
  id: number;
  cliente_id: number;
  cliente_nombre: string;
  cedula: string;
  telefono: string;
  placa: string;
  tipo_combustible: string;
  litros: number;
  fecha_agendada: string;
  codigo_ticket: number;
  estado: string;
  fecha_creacion: string;
  subcliente_id?: number | null;
  subcliente_nombre?: string | null;
  subcliente_cedula?: string | null;
  subcliente_placa?: string | null;
}

interface Limites {
  limite_diario: number;
  hoy: {
    fecha: string;
    agendados: number;
    procesados: number;
  };
  mañana: {
    fecha: string;
    agendados: number;
    disponible: number;
  };
}

export default function AgendamientosDiariosPage() {
  const [fechaSeleccionada, setFechaSeleccionada] = useState(() => {
    const hoy = new Date();
    return hoy.toISOString().split('T')[0];
  });
  const [nuevoLimite, setNuevoLimite] = useState('');
  const [mostrarConfiguracion, setMostrarConfiguracion] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  // Query para obtener agendamientos del día
  const { data: agendamientos = [], isLoading, refetch } = useQuery({
    queryKey: ['agendamientos-dia', fechaSeleccionada],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/api/agendamientos/dia/${fechaSeleccionada}`);
        return data;
      } catch (error) {
        console.error('Error al obtener agendamientos:', error);
        return [];
      }
    },
    refetchInterval: 30000, // Actualizar cada 30 segundos
  });

  // Query para obtener límites y configuración
  const { data: limites, refetch: refetchLimites } = useQuery({
    queryKey: ['sistema-limites'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/api/sistema/limites');
        return data;
      } catch (error) {
        console.error('Error al obtener límites:', error);
        return null;
      }
    },
    refetchInterval: 60000, // Actualizar cada minuto
  });

  // Actualizar límite diario
  const actualizarLimite = async () => {
    if (!nuevoLimite || parseFloat(nuevoLimite) <= 0) {
      toast.error('Ingrese un límite válido');
      return;
    }

    try {
      await api.put('/api/sistema/limite-diario', {
        limite: parseFloat(nuevoLimite)
      });

      toast.success('Límite diario actualizado exitosamente');
      setNuevoLimite('');
      setMostrarConfiguracion(false);
      refetchLimites();
    } catch (error: any) {
      console.error('Error al actualizar límite:', error);
      toast.error(error.response?.data?.error || 'Error al actualizar límite');
    }
  };

  // Marcar agendamiento como entregado
  const marcarComoEntregado = async (agendamientoId: number, ticket: number) => {
    if (!confirm(`¿Marcar como entregado el ticket #${ticket.toString().padStart(3, '0')}?`)) {
      return;
    }

    try {
      await api.patch(`/api/agendamientos/${agendamientoId}/entregar`);
      toast.success(`Ticket #${ticket.toString().padStart(3, '0')} marcado como entregado`);
      refetch(); // Actualizar la lista
    } catch (error: any) {
      console.error('Error al marcar como entregado:', error);
      toast.error(error.response?.data?.error || 'Error al marcar como entregado');
    }
  };

  // Descargar lista en CSV
  const descargarLista = () => {
    if (agendamientos.length === 0) {
      toast.error('No hay agendamientos para descargar');
      return;
    }

    const headers = ['Ticket', 'Cliente', 'Cédula', 'Teléfono', 'Placa Cliente', 'Trabajador', 'CI Trabajador', 'Placa Trabajador', 'Litros', 'Estado'];
    const csvContent = [
      headers.join(','),
      ...agendamientos.map((a: Agendamiento) => [
        a.codigo_ticket.toString().padStart(3, '0'),
        `"${a.cliente_nombre}"`,
        a.cedula,
        a.telefono,
        a.placa || 'N/A',
        a.subcliente_nombre ? `"${a.subcliente_nombre}"` : '',
        a.subcliente_cedula || '',
        a.subcliente_placa || '',
        a.litros,
        a.estado
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `agendamientos_${fechaSeleccionada}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Lista descargada exitosamente');
  };

  const descargarListaPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4'); // Portrait

    // Colores limpios y profesionales
    const azul: [number, number, number] = [37, 99, 235];
    const verde: [number, number, number] = [34, 197, 94];
    const amarillo: [number, number, number] = [234, 179, 8];
    const rojo: [number, number, number] = [239, 68, 68];
    const gris: [number, number, number] = [75, 85, 99];
    const grisClaro: [number, number, number] = [248, 250, 252];

    // HEADER LIMPIO Y PROFESIONAL
    doc.setFillColor(...azul);
    doc.rect(0, 0, 210, 35, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('SISTEMA DE DESPACHO DE GAS', 15, 15);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Lista de Validacion de Tickets', 15, 25);

    // Fecha en el header
    const fecha = new Date(fechaSeleccionada + 'T00:00:00').toLocaleDateString('es-ES');
    doc.text(`Fecha: ${fecha}`, 130, 15);
    doc.text(`Total: ${agendamientosFiltrados.length} agendamientos`, 130, 25);

    // ESTADÍSTICAS SIMPLES
    let y = 45;

    // Fondo para estadísticas
    doc.setFillColor(...grisClaro);
    doc.rect(15, y, 180, 25, 'F');

    doc.setTextColor(...gris);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');

    // Estadísticas en línea
    doc.text(`TOTAL: ${estadisticas.total}`, 25, y + 8);
    doc.text(`PENDIENTES: ${estadisticas.pendientes}`, 70, y + 8);
    doc.text(`ENTREGADOS: ${estadisticas.entregados}`, 25, y + 16);
    doc.text(`PROCESADOS: ${estadisticas.procesados}`, 70, y + 16);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Cada agendamiento incluye su ticket oficial para validacion', 25, y + 18);

    y += 35;

    // LISTA DE AGENDAMIENTOS - SOLO DATOS
    doc.setTextColor(...gris);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('LISTA DE AGENDAMIENTOS DIARIOS', 15, y);

    y += 15;

    // Headers de la tabla mejorados
    doc.setFillColor(...azul);
    doc.rect(15, y, 180, 10, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('TICKET', 18, y + 6);
    doc.text('CLIENTE', 45, y + 6);
    doc.text('CEDULA', 85, y + 6);
    doc.text('TELEFONO', 115, y + 6);
    doc.text('LITROS', 150, y + 6);
    doc.text('ESTADO', 170, y + 6);

    y += 15;

    // Cada agendamiento - diseño limpio
    agendamientosFiltrados.forEach((agendamiento: Agendamiento, index: number) => {
      const itemY = y + (index * 22);

      // Fondo alternado
      if (index % 2 === 0) {
        doc.setFillColor(...grisClaro);
        doc.rect(15, itemY - 2, 180, 22, 'F');
      }

      // Número de ticket destacado
      const ticketNum = agendamiento.codigo_ticket.toString().padStart(3, '0');
      doc.setTextColor(...azul);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`#${ticketNum}`, 18, itemY + 6);

      // Información del cliente - Primera línea
      doc.setTextColor(...gris);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(agendamiento.cliente_nombre.substring(0, 15), 45, itemY + 6);
      doc.text(agendamiento.cedula, 85, itemY + 6);
      doc.text(agendamiento.telefono, 115, itemY + 6);

      // Litros destacados
      doc.setTextColor(...verde);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`${agendamiento.litros}L`, 150, itemY + 6);

      // Placa y trabajador en segunda línea
      doc.setTextColor(...gris);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      const trabajadorTexto = agendamiento.subcliente_nombre
        ? ` · Trabajador: ${agendamiento.subcliente_nombre}`
        : '';
      doc.text(`Placa: ${agendamiento.placa || 'N/A'}${trabajadorTexto}`, 45, itemY + 12);

      // Estado con color
      let estadoColor: [number, number, number];
      let estadoTexto = '';

      switch (agendamiento.estado) {
        case 'pendiente':
          estadoColor = amarillo;
          estadoTexto = 'PENDIENTE';
          break;
        case 'entregado':
          estadoColor = verde;
          estadoTexto = 'ENTREGADO';
          break;
        case 'procesado':
          estadoColor = azul;
          estadoTexto = 'PROCESADO';
          break;
        default:
          estadoColor = gris;
          estadoTexto = agendamiento.estado.toUpperCase();
      }

      doc.setTextColor(...estadoColor);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(estadoTexto, 170, itemY + 6);

      // Fecha de creación en segunda línea
      doc.setTextColor(120, 120, 120);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(`Creado: ${new Date(agendamiento.fecha_creacion).toLocaleDateString('es-ES')}`, 115, itemY + 12);

      // Línea separadora sutil
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(15, itemY + 18, 195, itemY + 18);
    });

    // FOOTER SIMPLE
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);

      // Línea del footer
      doc.setDrawColor(...azul);
      doc.setLineWidth(2);
      doc.line(15, 270, 195, 270);

      // Información del footer
      doc.setTextColor(...gris);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')} ${new Date().toLocaleTimeString('es-ES')}`, 15, 277);
      doc.text('Documento Oficial - Sistema de Despacho de Gas', 15, 282);

      // Página
      doc.text(`Pagina ${i} de ${totalPages}`, 150, 277);

      // Marca
      doc.setFont('helvetica', 'bold');
      doc.text('DESPACHO GAS+', 150, 282);
    }

    // Guardar PDF
    const fileName = `Lista_Tickets_${fechaSeleccionada}.pdf`;
    doc.save(fileName);

    toast.success('PDF generado correctamente', {
      duration: 3000,
      icon: '📄'
    });
  };

  const descargarTicketsPDF = () => {
    if (agendamientosFiltrados.length === 0) {
      toast.error('No hay agendamientos para generar tickets');
      return;
    }

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 10;
    const ticketWidth = (pageWidth - (margin * 3)) / 2; // 2 columns
    const ticketHeight = (pageHeight - (margin * 5)) / 4; // 4 rows

    // Colors
    const azul: [number, number, number] = [37, 99, 235];
    const gris: [number, number, number] = [75, 85, 99];

    let ticketsOnPage = 0;

    agendamientosFiltrados.forEach((agendamiento: Agendamiento, index: number) => {
      if (ticketsOnPage === 8) {
        doc.addPage();
        ticketsOnPage = 0;
      }

      // Calculate position
      const col = ticketsOnPage % 2;
      const row = Math.floor(ticketsOnPage / 2);

      const x = margin + (col * (ticketWidth + margin));
      const y = margin + (row * (ticketHeight + margin));

      // Draw Ticket Border (Dashed line for cutting)
      doc.setDrawColor(200, 200, 200);
      doc.setLineDashPattern([3, 3], 0);
      doc.rect(x, y, ticketWidth, ticketHeight);
      doc.setLineDashPattern([], 0); // Reset to solid

      // Ticket Header
      doc.setFillColor(...azul);
      doc.rect(x, y, ticketWidth, 15, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`TICKET #${agendamiento.codigo_ticket.toString().padStart(3, '0')}`, x + 5, y + 10);

      // Date in header
      doc.setFontSize(8);
      doc.text(new Date(agendamiento.fecha_agendada).toLocaleDateString('es-ES'), x + ticketWidth - 25, y + 10);

      // Content
      doc.setTextColor(...gris);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');

      let currentY = y + 25;

      // Client Info
      doc.text('CLIENTE:', x + 5, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(doc.splitTextToSize(agendamiento.cliente_nombre, ticketWidth - 10), x + 5, currentY + 5);

      currentY += 15;

      // Worker Info (if exists)
      if (agendamiento.subcliente_nombre) {
        doc.setFont('helvetica', 'bold');
        doc.text('TRABAJADOR:', x + 5, currentY);
        doc.setFont('helvetica', 'normal');
        doc.text(agendamiento.subcliente_nombre, x + 28, currentY);

        currentY += 5;
        doc.text(`CI: ${agendamiento.subcliente_cedula || 'N/A'}`, x + 5, currentY);
        doc.text(`Placa: ${agendamiento.subcliente_placa || 'N/A'}`, x + 50, currentY);
        currentY += 8;
      } else {
        // If no worker, show client details
        doc.setFont('helvetica', 'bold');
        doc.text('DETALLES:', x + 5, currentY);
        currentY += 5;
        doc.setFont('helvetica', 'normal');
        doc.text(`CI/RIF: ${agendamiento.cedula}`, x + 5, currentY);
        doc.text(`Placa: ${agendamiento.placa || 'N/A'}`, x + 50, currentY);
        currentY += 8;
      }

      // Fuel Info (Highlighted)
      doc.setFillColor(240, 240, 240);
      doc.rect(x + 2, currentY, ticketWidth - 4, 15, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text(`${agendamiento.litros} L`, x + 10, currentY + 10);
      doc.text(agendamiento.tipo_combustible.toUpperCase(), x + 40, currentY + 10);

      // Footer
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text('Sistema de Despacho de Gas', x + 5, y + ticketHeight - 5);

      ticketsOnPage++;
    });

    doc.save(`Tickets_Imprimibles_${fechaSeleccionada}.pdf`);
    toast.success('Tickets generados exitosamente');
  };

  // Filtrar agendamientos según búsqueda y filtros
  const agendamientosFiltrados = agendamientos.filter((agendamiento: Agendamiento) => {
    // Filtro por búsqueda (ticket, nombre, cédula)
    const coincideBusqueda = busqueda === '' ||
      agendamiento.codigo_ticket.toString().padStart(3, '0').includes(busqueda) ||
      agendamiento.cliente_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      agendamiento.cedula.includes(busqueda);

    // Filtro por estado
    const coincideEstado = filtroEstado === 'todos' || agendamiento.estado === filtroEstado;

    return coincideBusqueda && coincideEstado;
  });

  // Calcular estadísticas de agendamientos filtrados
  const totalLitros = agendamientosFiltrados.reduce((total: number, agendamiento: Agendamiento) => {
    return total + agendamiento.litros;
  }, 0);

  const estadisticas = {
    total: agendamientosFiltrados.length,
    pendientes: agendamientosFiltrados.filter((a: Agendamiento) => a.estado === 'pendiente').length,
    entregados: agendamientosFiltrados.filter((a: Agendamiento) => a.estado === 'entregado').length,
    procesados: agendamientosFiltrados.filter((a: Agendamiento) => a.estado === 'procesado').length,
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8 transition-colors duration-300">
        <div className="max-w-7xl mx-auto">
          <BackButton href="/dashboard" label="Volver al Dashboard" className="mb-6" />

          {/* Header */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6 transition-colors duration-300">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Lista Diaria - Entregas de Hoy</h1>
                <p className="text-gray-600 dark:text-gray-300 mt-1">Clientes que deben retirar combustible hoy ({new Date().toLocaleDateString('es-ES')})</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-4 md:mt-0">
                <button
                  onClick={() => setMostrarConfiguracion(!mostrarConfiguracion)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  <FiSettings className="mr-2 h-4 w-4" />
                  Configurar Límite
                </button>

                <button
                  onClick={descargarLista}
                  disabled={agendamientos.length === 0}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FiDownload className="mr-2 h-4 w-4" />
                  Descargar Lista
                </button>

                <button
                  onClick={descargarTicketsPDF}
                  disabled={agendamientos.length === 0}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed ml-2"
                >
                  <FiDownload className="mr-2 h-4 w-4" />
                  Descargar Tickets
                </button>
              </div>
            </div>
          </div>

          {/* Configuración de límite */}
          {mostrarConfiguracion && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6 transition-colors duration-300">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Configurar Límite Diario</h3>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label htmlFor="limite" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Límite diario de gasolina (litros)
                  </label>
                  <input
                    type="number"
                    id="limite"
                    value={nuevoLimite}
                    onChange={(e) => setNuevoLimite(e.target.value)}
                    placeholder={`Actual: ${limites?.limite_diario || 2000}L`}
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    onClick={actualizarLimite}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Actualizar
                  </button>
                  <button
                    onClick={() => {
                      setMostrarConfiguracion(false);
                      setNuevoLimite('');
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Estadísticas Mejoradas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {/* Total Agendamientos */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Total Agendamientos</p>
                  <p className="text-3xl font-bold">{estadisticas.total}</p>
                  <p className="text-blue-100 text-xs mt-1">{totalLitros}L total</p>
                </div>
                <FiUsers className="h-8 w-8 text-blue-200" />
              </div>
            </div>

            {/* Pendientes */}
            <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-yellow-100 text-sm font-medium">Pendientes</p>
                  <p className="text-3xl font-bold">{estadisticas.pendientes}</p>
                  <p className="text-yellow-100 text-xs mt-1">Por entregar</p>
                </div>
                <FiClock className="h-8 w-8 text-yellow-200" />
              </div>
            </div>

            {/* Entregados */}
            <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium">Entregados</p>
                  <p className="text-3xl font-bold">{estadisticas.entregados}</p>
                  <p className="text-green-100 text-xs mt-1">Completados</p>
                </div>
                <FiCheckCircle className="h-8 w-8 text-green-200" />
              </div>
            </div>

            {/* Procesados */}
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm font-medium">Procesados</p>
                  <p className="text-3xl font-bold">{estadisticas.procesados}</p>
                  <p className="text-purple-100 text-xs mt-1">Automáticos</p>
                </div>
                <FiTruck className="h-8 w-8 text-purple-200" />
              </div>
            </div>
          </div>

          {/* Información del día */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-blue-900">📋 Entregas Programadas para Hoy</h2>
                <p className="text-blue-700 mt-1">
                  Clientes que agendaron <strong>ayer ({new Date(Date.now() - 86400000).toLocaleDateString('es-ES')})</strong> para retirar <strong>hoy ({new Date().toLocaleDateString('es-ES')})</strong>
                </p>
                <p className="text-sm text-blue-600 mt-2">
                  ✅ Valida el ticket del cliente y marca como "Entregado" cuando retire el combustible.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => refetch()}
                  className="flex items-center px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                  title="Actualizar lista"
                >
                  <FiRefreshCw className="h-4 w-4" />
                </button>
                <div className="bg-blue-100 rounded-lg p-3">
                  <p className="text-sm text-blue-600">Mostrando</p>
                  <p className="text-2xl font-bold text-blue-900">{agendamientosFiltrados.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Estadísticas */}
          {limites && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center">
                  <FiUsers className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-blue-600">Límite Diario</p>
                    <p className="text-2xl font-bold text-blue-900">{limites.limite_diario}L</p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center">
                  <FiCalendar className="h-8 w-8 text-yellow-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-yellow-600">Hoy Procesados</p>
                    <p className="text-2xl font-bold text-yellow-900">{limites.hoy.procesados}L</p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                  <FiClock className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-green-600">Mañana Agendados</p>
                    <p className="text-2xl font-bold text-green-900">{limites.mañana.agendados}L</p>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center">
                  <FiUsers className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-purple-600">Disponible Mañana</p>
                    <p className="text-2xl font-bold text-purple-900">{limites.mañana.disponible}L</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Barra de Búsqueda y Filtros */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6 transition-colors duration-300">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* Búsqueda */}
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="text"
                    placeholder="Buscar por ticket, nombre o cédula..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Filtros y Controles */}
              <div className="flex items-center gap-3">
                {/* Filtro por Estado */}
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="todos">Todos los estados</option>
                  <option value="pendiente">Pendientes</option>
                  <option value="entregado">Entregados</option>
                  <option value="procesado">Procesados</option>
                </select>

                {/* Selector de Fecha */}
                <button
                  onClick={() => setFechaSeleccionada(new Date().toISOString().split('T')[0])}
                  className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                >
                  📅 Hoy
                </button>
                <input
                  type="date"
                  value={fechaSeleccionada}
                  onChange={(e) => setFechaSeleccionada(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />

                {/* Botón Descargar PDF */}
                <button
                  onClick={descargarListaPDF}
                  className="flex items-center px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <FiDownload className="mr-2 h-4 w-4" />
                  📄 Descargar PDF
                </button>
              </div>
            </div>

            {/* Información de Filtros Activos */}
            {(busqueda || filtroEstado !== 'todos') && (
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                <FiFilter className="h-4 w-4" />
                <span>Filtros activos:</span>
                {busqueda && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                    Búsqueda: "{busqueda}"
                  </span>
                )}
                {filtroEstado !== 'todos' && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full">
                    Estado: {filtroEstado}
                  </span>
                )}
                <button
                  onClick={() => {
                    setBusqueda('');
                    setFiltroEstado('todos');
                  }}
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>

          {/* Lista de agendamientos */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden transition-colors duration-300">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Agendamientos para {new Date(fechaSeleccionada + 'T00:00:00').toLocaleDateString('es-ES', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </h3>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {agendamientosFiltrados.length} agendamientos • {totalLitros}L total
                  {agendamientosFiltrados.length !== agendamientos.length && (
                    <span className="text-blue-600"> (filtrados de {agendamientos.length})</span>
                  )}
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : agendamientos.length === 0 ? (
              <div className="text-center py-12">
                <FiCalendar className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No hay entregas programadas</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {fechaSeleccionada === new Date().toISOString().split('T')[0]
                    ? `No hay clientes que deban retirar combustible hoy. Nadie agendó ayer (${new Date(Date.now() - 86400000).toLocaleDateString('es-ES')}) para hoy.`
                    : `No se encontraron agendamientos para ${new Date(fechaSeleccionada + 'T00:00:00').toLocaleDateString('es-ES')}.`
                  }
                </p>
                {fechaSeleccionada === new Date().toISOString().split('T')[0] && (
                  <p className="mt-2 text-xs text-blue-600">
                    💡 Los agendamientos aparecen aquí cuando los clientes agendan para este día.
                  </p>
                )}
              </div>
            ) : agendamientosFiltrados.length === 0 ? (
              <div className="text-center py-12">
                <FiSearch className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No se encontraron resultados</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {busqueda || filtroEstado !== 'todos'
                    ? "Intenta ajustar los filtros de búsqueda."
                    : "No hay agendamientos para la fecha seleccionada."
                  }
                </p>
                {(busqueda || filtroEstado !== 'todos') && (
                  <button
                    onClick={() => {
                      setBusqueda('');
                      setFiltroEstado('todos');
                    }}
                    className="mt-3 text-blue-600 hover:text-blue-800 underline"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ticket
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cliente
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contacto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Vehículo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Litros
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {agendamientosFiltrados.map((agendamiento: Agendamiento) => (
                      <tr key={agendamiento.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            #{agendamiento.codigo_ticket.toString().padStart(3, '0')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{agendamiento.cliente_nombre}</div>
                          <div className="text-sm text-gray-500">CI: {agendamiento.cedula}</div>
                          {agendamiento.subcliente_nombre && (
                            <div className="text-xs text-gray-500 mt-1">
                              Trabajador: {agendamiento.subcliente_nombre}
                              {agendamiento.subcliente_cedula ? ` · CI: ${agendamiento.subcliente_cedula}` : ''}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{agendamiento.telefono}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">Placa Cliente: {agendamiento.placa || 'N/A'}</div>
                          {agendamiento.subcliente_placa && (
                            <div className="text-xs text-gray-500 mt-1">Placa Trabajador: {agendamiento.subcliente_placa}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{agendamiento.litros}L</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${agendamiento.estado === 'procesado'
                            ? 'bg-green-100 text-green-800'
                            : agendamiento.estado === 'pendiente'
                              ? 'bg-yellow-100 text-yellow-800'
                              : agendamiento.estado === 'entregado'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                            {agendamiento.estado === 'procesado' ? 'Procesado' :
                              agendamiento.estado === 'pendiente' ? 'Pendiente' :
                                agendamiento.estado === 'entregado' ? 'Entregado' : 'Cancelado'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {agendamiento.estado === 'pendiente' && (
                            <button
                              onClick={() => marcarComoEntregado(agendamiento.id, agendamiento.codigo_ticket)}
                              className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                            >
                              ✅ Entregar
                            </button>
                          )}
                          {agendamiento.estado === 'entregado' && (
                            <span className="text-green-600 text-xs">✅ Entregado</span>
                          )}
                          {agendamiento.estado === 'procesado' && (
                            <span className="text-blue-600 text-xs">🔄 Procesado</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
