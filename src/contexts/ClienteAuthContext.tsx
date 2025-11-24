'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

type Cliente = {
  id: number;
  nombre: string;
  cedula: string;
  telefono: string;
  categoria: string;
  placa: string;
  litros_disponibles: number;
  litros_mes: number;
  // Nuevos campos separados por tipo de combustible
  litros_disponibles_gasolina?: number;
  litros_disponibles_gasoil?: number;
  litros_mes_gasolina?: number;
  litros_mes_gasoil?: number;
};

type ClienteAuthContextType = {
  cliente: Cliente | null;
  loading: boolean;
  login: (cedula: string) => Promise<void>;
  logout: () => void;
  updateCliente: (updatedCliente: Cliente) => void;
};

const ClienteAuthContext = createContext<ClienteAuthContextType | undefined>(undefined);

export function ClienteAuthProvider({ children }: { children: ReactNode }) {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Verificar si hay un token guardado al cargar la aplicación
    const token = localStorage.getItem('clienteToken');
    const clienteData = localStorage.getItem('clienteData');

    if (token && clienteData) {
      try {
        setCliente(JSON.parse(clienteData));
      } catch (error) {
        console.error('Error al analizar los datos del cliente:', error);
        logout();
      }
    }
    setLoading(false);
  }, []);

  const login = async (cedula: string) => {
    try {
      const { data } = await api.post('/api/clientes/login', { cedula });

      // Guardar el token y los datos del cliente
      localStorage.setItem('clienteToken', data.token);
      localStorage.setItem('clienteData', JSON.stringify(data.cliente));

      setCliente(data.cliente);
      router.push('/cliente/dashboard');
    } catch (error: any) {
      console.error('Error al iniciar sesión:', error);
      throw new Error(error.response?.data?.error || 'Error al iniciar sesión');
    }
  };

  const logout = () => {
    // Eliminar datos de autenticación
    localStorage.removeItem('clienteToken');
    localStorage.removeItem('clienteData');
    setCliente(null);
    router.push('/login');
  };

  // Función para actualizar los datos del cliente
  const updateCliente = (updatedCliente: Cliente) => {
    // Actualizar el estado local
    setCliente(updatedCliente);
    // Actualizar los datos en localStorage
    localStorage.setItem('clienteData', JSON.stringify(updatedCliente));
  };

  return (
    <ClienteAuthContext.Provider value={{ cliente, loading, login, logout, updateCliente }}>
      {children}
    </ClienteAuthContext.Provider>
  );
}

export function useClienteAuth() {
  const context = useContext(ClienteAuthContext);
  if (context === undefined) {
    throw new Error('useClienteAuth debe ser usado dentro de un ClienteAuthProvider');
  }
  return context;
}
