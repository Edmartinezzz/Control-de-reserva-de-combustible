'use client';

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { FiX, FiDownload, FiCalendar, FiUser, FiCreditCard, FiDroplet, FiTruck } from 'react-icons/fi';
import jsPDF from 'jspdf';

interface TicketData {
  codigo_ticket: number;
  fecha_agendada: string;
  litros: number;
  tipo_combustible: 'gasolina' | 'gasoil';
  cliente: {
    nombre: string;
    cedula: string;
    telefono: string;
    placa?: string;
    categoria: string;
  };
  subcliente?: {
    nombre: string;
    cedula?: string;
    placa?: string;
  } | null;
}

interface TicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketData: TicketData | null;
}

export default function TicketModal({ isOpen, onClose, ticketData }: TicketModalProps) {
  if (!ticketData) return null;

  const descargarTicket = () => {
    const doc = new jsPDF('p', 'mm', 'a4');

    // Colores
    const azul: [number, number, number] = [37, 99, 235];
    const verde: [number, number, number] = [34, 197, 94];
    const gris: [number, number, number] = [75, 85, 99];
    const grisClaro: [number, number, number] = [248, 250, 252];

    // HEADER
    doc.setFillColor(...azul);
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('SISTEMA DE DESPACHO DE GAS', 105, 15, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('TICKET DE AGENDAMIENTO', 105, 25, { align: 'center' });

    // Código de ticket destacado
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    const ticketNum = `#${ticketData.codigo_ticket.toString().padStart(3, '0')}`;
    doc.text(ticketNum, 105, 35, { align: 'center' });

    let y = 50;

    // INFORMACIÓN DEL CLIENTE
    doc.setFillColor(...grisClaro);
    doc.rect(15, y, 180, 8, 'F');

    doc.setTextColor(...gris);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMACIÓN DEL CLIENTE', 20, y + 5);

    y += 12;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Nombre: ${ticketData.cliente.nombre}`, 20, y);
    y += 6;
    doc.text(`Cédula: ${ticketData.cliente.cedula}`, 20, y);
    y += 6;
    doc.text(`Teléfono: ${ticketData.cliente.telefono}`, 20, y);
    y += 6;
    doc.text(`Dependencia: ${ticketData.cliente.categoria}`, 20, y);
    y += 6;
    doc.text(`Placa: ${ticketData.cliente.placa || 'No registrada'}`, 20, y);
    y += 10;

    // TRABAJADOR (si existe)
    if (ticketData.subcliente?.nombre) {
      doc.setFillColor(...grisClaro);
      doc.rect(15, y, 180, 8, 'F');

      doc.setFont('helvetica', 'bold');
      doc.text('TRABAJADOR ASIGNADO', 20, y + 5);

      y += 12;

      doc.setFont('helvetica', 'normal');
      doc.text(`Nombre: ${ticketData.subcliente.nombre}`, 20, y);
      y += 6;
      doc.text(`Cédula: ${ticketData.subcliente.cedula || 'No registrada'}`, 20, y);
      y += 6;
      doc.text(`Placa: ${ticketData.subcliente.placa || 'No registrada'}`, 20, y);
      y += 10;
    }

    // DETALLES DEL AGENDAMIENTO
    doc.setFillColor(...grisClaro);
    doc.rect(15, y, 180, 8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.text('DETALLES DEL AGENDAMIENTO', 20, y + 5);

    y += 12;

    doc.setFont('helvetica', 'normal');
    const fechaAgendamiento = new Date().toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    doc.text(`Fecha de Agendamiento: ${fechaAgendamiento} (HOY)`, 20, y);
    y += 6;

    const fechaRetiro = new Date(ticketData.fecha_agendada).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    doc.setTextColor(...azul);
    doc.setFont('helvetica', 'bold');
    doc.text(`Fecha de Retiro: ${fechaRetiro} (MAÑANA)`, 20, y);
    y += 6;

    doc.setTextColor(...gris);
    doc.setFont('helvetica', 'normal');
    const tipoLabel = ticketData.tipo_combustible === 'gasoil' ? 'GASOIL' : 'GASOLINA';
    doc.text(`Litros Agendados: ${ticketData.litros}L`, 20, y);
    y += 6;
    doc.text(`Tipo: ${tipoLabel}`, 20, y);
    y += 6;
    doc.setTextColor(...verde);
    doc.setFont('helvetica', 'bold');
    doc.text('Estado: CONFIRMADO', 20, y);
    y += 12;

    // INSTRUCCIONES
    doc.setFillColor(254, 243, 199); // yellow-100
    doc.rect(15, y, 180, 35, 'F');

    doc.setTextColor(146, 64, 14); // yellow-900
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('📋 INSTRUCCIONES IMPORTANTES', 20, y + 6);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    y += 12;
    doc.text('1. Presente este ticket el día de retiro', 20, y);
    y += 5;
    doc.text('2. Horario de atención: 8:00 AM - 5:00 PM', 20, y);
    y += 5;
    doc.text('3. Traiga su cédula de identidad', 20, y);
    y += 5;
    doc.text('4. El combustible será entregado por el administrador', 20, y);

    // FOOTER
    doc.setDrawColor(...azul);
    doc.setLineWidth(2);
    doc.line(15, 270, 195, 270);

    doc.setTextColor(...gris);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')} ${new Date().toLocaleTimeString('es-ES')}`, 15, 277);
    doc.text('¡Gracias por usar nuestro sistema!', 15, 282);

    doc.setFont('helvetica', 'bold');
    doc.text('DESPACHO GAS+', 150, 277);

    // Guardar PDF
    const fileName = `ticket_${ticketData.codigo_ticket.toString().padStart(3, '0')}.pdf`;
    doc.save(fileName);
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="text-white">
                      <h3 className="text-lg font-semibold">Ticket de Agendamiento</h3>
                      <p className="text-blue-100 text-sm">Sistema de Despacho de Gas</p>
                    </div>
                    <button
                      onClick={onClose}
                      className="text-white hover:text-blue-200 transition-colors"
                    >
                      <FiX className="h-6 w-6" />
                    </button>
                  </div>
                </div>

                {/* Ticket Content - Layout Horizontal */}
                <div className="px-6 py-6">
                  {/* Header del Ticket */}
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-3">
                      <span className="text-2xl font-bold text-blue-600">
                        #{ticketData.codigo_ticket.toString().padStart(3, '0')}
                      </span>
                    </div>
                    <h4 className="text-xl font-bold text-gray-900">Agendamiento Confirmado</h4>
                  </div>

                  {/* Layout Horizontal - 2 Columnas */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Columna Izquierda - Información del Cliente */}
                    <div className="space-y-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h5 className="font-semibold text-gray-900 mb-3 flex items-center">
                          <FiUser className="mr-2 text-blue-600" />
                          Información del Cliente
                        </h5>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Nombre:</span>
                            <span className="font-medium">{ticketData.cliente.nombre}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Cédula:</span>
                            <span className="font-medium">{ticketData.cliente.cedula}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Teléfono:</span>
                            <span className="font-medium">{ticketData.cliente.telefono}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Dependencia:</span>
                            <span className="font-medium">{ticketData.cliente.categoria}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Placa:</span>
                            <span className="font-medium">{ticketData.cliente.placa || 'No registrada'}</span>
                          </div>
                          {ticketData.subcliente?.nombre && (
                            <>
                              <div className="flex justify-between pt-2 border-t border-dashed border-gray-200 mt-2">
                                <span className="text-gray-600">Trabajador:</span>
                                <span className="font-medium">{ticketData.subcliente.nombre}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">CI Trabajador:</span>
                                <span className="font-medium">{ticketData.subcliente.cedula || 'No registrada'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Placa Trabajador:</span>
                                <span className="font-medium">{ticketData.subcliente.placa || 'No registrada'}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Instrucciones */}
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h5 className="font-semibold text-yellow-800 mb-2">📋 Instrucciones Importantes</h5>
                        <ul className="text-sm text-yellow-700 space-y-1">
                          <li>• Presente este ticket el día de retiro</li>
                          <li>• Traiga su cédula de identidad</li>
                          <li>• Horario: 8:00 AM - 5:00 PM</li>
                          <li>• El combustible será entregado por el administrador</li>
                        </ul>
                      </div>
                    </div>

                    {/* Columna Derecha - Detalles del Agendamiento */}
                    <div className="space-y-4">
                      <div className="bg-blue-50 rounded-lg p-4">
                        <h5 className="font-semibold text-gray-900 mb-3 flex items-center">
                          <FiCalendar className="mr-2 text-blue-600" />
                          Detalles del Agendamiento
                        </h5>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Fecha de Agendamiento:</span>
                            <span className="font-medium">
                              {new Date().toLocaleDateString('es-ES', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })} (HOY)
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Fecha de Retiro:</span>
                            <span className="font-medium text-blue-600">
                              {new Date(ticketData.fecha_agendada).toLocaleDateString('es-ES', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })} (MAÑANA)
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Litros Agendados:</span>
                            <span className="font-bold text-blue-600">{ticketData.litros}L</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Tipo de Combustible:</span>
                            <span className="font-medium">{ticketData.tipo_combustible.toUpperCase()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Información adicional */}
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h5 className="font-semibold text-green-800 mb-2">✅ Estado del Agendamiento</h5>
                        <div className="text-sm text-green-700 space-y-1">
                          <p>• <strong>Estado:</strong> Confirmado</p>
                          <p>• <strong>Hora de Agendamiento:</strong> {new Date().toLocaleTimeString('es-ES')}</p>
                          <p>• <strong>Procesamiento:</strong> Automático a las 5:00 AM</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer con botones */}
                <div className="bg-gray-50 px-6 py-4 flex gap-3">
                  <button
                    onClick={descargarTicket}
                    className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <FiDownload className="mr-2 h-4 w-4" />
                    Descargar Ticket
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
