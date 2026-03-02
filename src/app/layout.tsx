import "./globals.css";
import BottomNav from "@/components/BottomNav"; // <--- 1. Importar

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="bg-zinc-950 text-zinc-50 antialiased">
        {children}
        <BottomNav /> {/* <--- 2. Poner aquí al final */}
      </body>
    </html>
  );
}