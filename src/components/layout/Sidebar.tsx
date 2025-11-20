"use client";
import React from 'react';
import Link from 'next/link';

export function Sidebar() {
  return (
    <aside className="hidden md:flex md:w-72 md:flex-col bg-red-700 dark:bg-gray-800 text-white shadow-lg rounded-r-xl animate-slide-in-left transition-colors duration-300">
      <div className="flex flex-col h-full">
        <div className="px-6 py-6 border-b border-white/10 dark:border-gray-700 animate-fade-in-down">
          <div className="text-xl font-bold animate-pulse-slow">DESPACHO GAS+</div>
        </div>

        <nav className="flex-1 px-2 py-6 space-y-1 animate-fade-in" style={{animationDelay: '0.2s'}}>
          <Link href="/admin" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-800 dark:bg-gray-700 text-white hover:scale-105 transition-all duration-200">
            <span className="w-2 h-2 rounded-full bg-white/80" />
            <span className="font-medium">Dashboard</span>
          </Link>

          <Link href="/admin" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-600 dark:hover:bg-gray-700 text-white/90 hover:scale-105 transition-all duration-200">
            <span className="w-2 h-2 rounded-full bg-white/30" />
            <span>Profile</span>
          </Link>

          <Link href="/admin" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-600 dark:hover:bg-gray-700 text-white/90 hover:scale-105 transition-all duration-200">
            <span className="w-2 h-2 rounded-full bg-white/30" />
            <span>Notifications</span>
          </Link>

          <Link href="/driver" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-600 dark:hover:bg-gray-700 text-white/90 hover:scale-105 transition-all duration-200">
            <span className="w-2 h-2 rounded-full bg-white/30" />
            <span>Repartidor</span>
          </Link>
        </nav>

        <div className="px-6 py-6 border-t border-white/10 dark:border-gray-700">
          <button className="w-full bg-red-800 dark:bg-gray-700 hover:bg-red-900 dark:hover:bg-gray-600 text-white px-4 py-3 rounded-md font-medium transition-colors">Logout</button>
        </div>
      </div>
    </aside>
  );
}






