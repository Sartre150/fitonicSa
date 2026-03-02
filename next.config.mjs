// next.config.mjs
import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development', // Solo se activa cuando la subas a internet
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {}, // <-- ¡Agregamos esta línea para solucionar el error!
};

export default withPWA(nextConfig);