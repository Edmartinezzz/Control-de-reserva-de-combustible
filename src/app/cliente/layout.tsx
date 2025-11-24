'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ClienteAuthProvider, useClienteAuth } from '@/contexts/ClienteAuthContext';
import { Toaster } from 'react-hot-toast';

// Componente para manejar la protección de rutas
export default function ClienteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClienteAuthProvider>
      <ClienteAuthChecker>
        <div className="min-h-screen bg-white">
          <main>{children}</main>
          <Toaster position="top-right" />
        </div>
      </ClienteAuthChecker>
    </ClienteAuthProvider>
  );
}

// Componente para verificar la autenticación del cliente
function ClienteAuthChecker({ children }: { children: React.ReactNode }) {
  const { cliente, loading } = useClienteAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  useEffect(() => {
    // Verificar si necesitamos redirigir después de que el componente se monte
    if (loading) return;

    const isAuthPage = ['/cliente/login', '/cliente/registro'].includes(pathname);

    if (!cliente && !isAuthPage) {
      // Redirigir al login si no está autenticado y no está en una página de autenticación
      setRedirectPath('/login');
      setShouldRedirect(true);
    } else if (cliente && isAuthPage) {
      // Redirigir al dashboard si está autenticado y está en una página de autenticación
      setRedirectPath('/cliente/dashboard');
      setShouldRedirect(true);
    }
  }, [cliente, loading, pathname]);

  useEffect(() => {
    // Realizar la redirección en un efecto separado
    if (shouldRedirect && redirectPath) {
      router.push(redirectPath);
      setShouldRedirect(false);
    }
  }, [shouldRedirect, redirectPath, router]);

  // Mostrar un indicador de carga mientras se verifica la autenticación
  if (loading && !cliente) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  // No renderizar nada si necesitamos redirigir
  if (shouldRedirect) {
    return null;
  }

  return <>{children}</>;
}
