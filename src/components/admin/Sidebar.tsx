'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Truck, Users, Settings, LogOut, Package } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  
  const navItems = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: Home },
    { name: 'Inventario', href: '/admin/inventario', icon: Package },
    { name: 'Vehículos', href: '/admin/vehicles', icon: Truck },
    { name: 'Conductores', href: '/admin/drivers', icon: Users },
    { name: 'Configuración', href: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="hidden md:flex md:flex-shrink-0">
      <div className="flex flex-col w-64 border-r border-gray-200 bg-white">
        <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-4">
            <h1 className="text-xl font-bold text-gray-800">Admin Panel</h1>
          </div>
          <div className="mt-5 flex-1 flex flex-col
          ">
            <nav className="flex-1 px-2 space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                      isActive
                        ? 'bg-blue-100 text-blue-600'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <item.icon
                      className={`mr-3 flex-shrink-0 h-6 w-6 ${
                        isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500'
                      }`}
                      aria-hidden="true"
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
            <Link
              href="/logout"
              className="flex-shrink-0 w-full group block"
            >
              <div className="flex items-center">
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                    Cerrar sesión
                  </p>
                </div>
                <div className="ml-auto">
                  <LogOut className="h-5 w-5 text-gray-400 group-hover:text-gray-500" />
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
