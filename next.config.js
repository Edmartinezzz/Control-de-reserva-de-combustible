/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Configuración de Turbopack
  experimental: {
    // Habilitar Server Actions
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  
  // Configuración de Webpack
  webpack: (config, { isServer }) => {
    // Solo aplicar alias en modo Webpack
    if (!process.env.TURBOPACK) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@': require('path').resolve(__dirname, 'src'),
      };
    }
    return config;
  },
  
  // Configuración de Turbopack
  turbopack: {
    // Configuración específica de Turbopack
    resolveAlias: {
      '@': require('path').resolve(__dirname, 'src'),
    },
  },
  
  // Configuración de imágenes
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  
  async rewrites() {
    const apiBase = process.env.BACKEND_API_BASE_URL;
    if (!apiBase) return [];
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/api/:path*`,
      },
    ];
  },
  
  // Configuración de salida
  // output: 'standalone', // Deshabilitado para que "next start" funcione en Render sin Start Command personalizado
  
  // Configuración de paquetes para el servidor
  // Usamos solo serverExternalPackages para evitar conflictos
  serverExternalPackages: ['@prisma/client', 'prisma'],
  
  // Configuración de logging extendido (solo desarrollo)
  ...(process.env.NODE_ENV === 'development' && {
    logging: {
      fetches: {
        fullUrl: true,
      },
    },
  }),
};

module.exports = nextConfig;
