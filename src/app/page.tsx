// src/app/page.tsx
import { Dumbbell } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col items-center justify-center p-6">
      
      <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(79,70,229,0.5)]">
        <Dumbbell size={40} className="text-white" />
      </div>

      <h1 className="text-4xl font-extrabold tracking-tight mb-2">
        Fitonic
      </h1>

      <p className="text-zinc-400 text-center max-w-sm mb-10">
        Tu plataforma de progreso, comidas y fuerza.
      </p>

      <Link
        href="/login"
        className="bg-white text-zinc-950 text-center font-bold py-4 px-8 rounded-xl shadow-lg hover:scale-105 hover:bg-zinc-200 transition-all duration-200"
      >
        Iniciar Sesión
      </Link>

    </main>
  );
}