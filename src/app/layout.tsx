import './globals.css';
import type { Metadata } from 'next';
import React from 'react';
import SidebarWrapper from '../components/layout/SidebarWrapper';
import Topbar from '../components/layout/Topbar';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/contexts/AuthContext';
import { ClienteAuthProvider } from '@/contexts/ClienteAuthContext';
import { QueryProvider } from '@/providers/QueryProvider';
import { ThemeProvider } from '@/contexts/ThemeContext';
import ThemeToggleButton from '@/components/ui/ThemeToggleButton';
import { Toaster } from 'react-hot-toast';
import { Analytics } from '@vercel/analytics/next';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Despacho Gas',
  description: 'Plataforma de Despacho Inteligente de Gas'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>
              <ClienteAuthProvider>
                <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300 relative">
                  {/* Botón de tema flotante en la esquina superior derecha */}
                  <div className="fixed top-4 right-4 z-50">
                    <ThemeToggleButton />
                  </div>
                  <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
                </div>
                <Toaster position="top-right" />
              </ClienteAuthProvider>
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}


