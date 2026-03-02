// src/app/login/page.tsx
"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase";
import { useRouter } from "next/navigation";
import { Dumbbell, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Intentar iniciar sesión
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/workout"); // Si entra, mandar al workout
      router.refresh();
    }
  };

  const handleSignUp = async () => {
    setLoading(true);
    setError(null);
    
    // Crear cuenta nueva
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      alert("¡Cuenta creada! Ya puedes iniciar sesión.");
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(79,70,229,0.3)]">
            <Dumbbell size={32} className="text-white" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-center mb-1">Bienvenido a Fitonic</h2>
        <p className="text-zinc-500 text-center mb-8 text-sm">Tracker para Sofia y Alex</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-zinc-500 mb-1 ml-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="tu@email.com"
              required
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold uppercase text-zinc-500 mb-1 ml-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="animate-spin" /> : "Entrar"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={handleSignUp}
            type="button"
            className="text-zinc-500 text-sm hover:text-white transition-colors"
          >
            ¿No tienes cuenta? <span className="underline decoration-indigo-500/50">Regístrate aquí</span>
          </button>
        </div>
      </div>
    </main>
  );
}