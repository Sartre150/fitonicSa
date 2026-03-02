import "./globals.css";
import BottomNav from "@/components/BottomNav";
import { Metadata, Viewport } from "next";

// 1. Configuración PWA y SEO
export const metadata: Metadata = {
  title: "Fitonic",
  description: "Tu plataforma de entrenamiento PPL",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Fitonic",
  },
  icons: {
    apple: "/icon-192.png", // Icono para iPhone
  },
};

// 2. Configuración de Pantalla (Bloquea el zoom para sentirla nativa)
export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="bg-zinc-950 text-zinc-50 antialiased select-none">
        {/* select-none evita que seleccionen texto sin querer al usar la app */}
        {children}
        <BottomNav />
      </body>
    </html>
  );
}