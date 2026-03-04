"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { User, LogOut, Settings } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const [email, setEmail] = useState<string | null>("");
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setEmail(user.email || "");
    }
    getUser();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 p-6 pb-24">
      <header className="mb-8">
        <h1 className="text-2xl font-black flex items-center gap-2">
          <User className="text-indigo-500" /> Perfil
        </h1>
      </header>

      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl mb-6 flex items-center gap-4">
        <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center text-2xl font-black text-indigo-400 border-2 border-indigo-500/30">
          {email?.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">Sesión Activa</p>
          <h2 className="text-lg font-bold text-white break-all">{email}</h2>
        </div>
      </div>

      <div className="space-y-3">
        <button className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors">
          <div className="flex items-center gap-3">
            <Settings size={20} className="text-zinc-500" />
            <span className="font-bold">Configuración de App</span>
          </div>
        </button>

        <button 
          onClick={handleLogout}
          className="w-full bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center justify-between text-red-400 hover:bg-red-500 hover:text-white transition-colors"
        >
          <div className="flex items-center gap-3">
            <LogOut size={20} />
            <span className="font-bold">Cerrar Sesión</span>
          </div>
        </button>
      </div>
    </main>
  );
}