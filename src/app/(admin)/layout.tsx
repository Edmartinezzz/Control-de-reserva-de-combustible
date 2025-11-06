'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Importar componentes dinámicamente para asegurar que se carguen del lado del cliente
const Sidebar = dynamic(() => import('@/components/admin/Sidebar'), { ssr: false });
const AdminTopbar = dynamic(() => import('@/components/admin/AdminTopbar'), { ssr: false });

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <Sidebar />
        
        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <AdminTopbar />
          <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
