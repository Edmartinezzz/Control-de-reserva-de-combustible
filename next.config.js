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
    let apiBase = process.env.BACKEND_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL;

    console.log('Build-time BACKEND_API_BASE_URL:', apiBase);

    if (!apiBase) {
      console.warn('WARNING: BACKEND_API_BASE_URL is not defined. API rewrites will be disabled.');
      return [];
    }

    // Sanitize: remove trailing slash and whitespace
    apiBase = apiBase.trim().replace(/\/$/, '');

    // Validate: must start with http
    if (!apiBase.startsWith('http')) {
      console.error('ERROR: BACKEND_API_BASE_URL must start with http:// or https://');
      return [];
    }

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
