import './globals.css';
import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Despacho Gas',
  description: 'Plataforma de Despacho Inteligente de Gas'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen">
        <header className="border-b bg-white">
          <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
            <a href="/" className="font-semibold text-lg">Despacho Gas</a>
            <nav className="flex gap-4 text-sm">
              <a className="hover:underline" href="/admin">Admin</a>
              <a className="hover:underline" href="/driver">Repartidor</a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}


