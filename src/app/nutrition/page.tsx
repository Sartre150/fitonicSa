"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { UtensilsCrossed, Edit3, X } from "lucide-react";

export default function NutritionPage() {
  const supabase = createClient();
  const[loading, setLoading] = useState(true);
  const [showGoalModal, setShowGoalModal] = useState(false);

  const [goals, setGoals] = useState({ protein: 160, carbs: 250, fats: 70, calories: 2500 });
  const [macros, setMacros] = useState({ protein: 0, carbs: 0, fats: 0, calories: 0 });

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (profile) {
      setGoals({ protein: profile.daily_protein, carbs: profile.daily_carbs, fats: profile.daily_fats, calories: profile.daily_calories });
    }

    // Crea una fecha local (respetando tu zona horaria)
    const dateObj = new Date();
    const offset = dateObj.getTimezoneOffset();
    const localDate = new Date(dateObj.getTime() - (offset*60*1000));
    const today = localDate.toISOString().split('T')[0];
    const { data: nutrition } = await supabase.from("daily_nutrition").select("*").eq("user_id", user.id).eq("date", today).maybeSingle();
    
    if (nutrition) setMacros(nutrition);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { (async () => fetchData())(); }, [fetchData]);

  const updateMacro = async (field: string, value: number) => {
    const newMacros = { ...macros, [field]: value };
    if (field !== 'calories') {
       newMacros.calories = (newMacros.protein * 4) + (newMacros.carbs * 4) + (newMacros.fats * 9);
    }
    setMacros(newMacros);
    const { data: { user } } = await supabase.auth.getUser();
    // Calcular fecha local para la consulta
    const dateObjUpdate = new Date();
    const offsetUpdate = dateObjUpdate.getTimezoneOffset();
    const localDateUpdate = new Date(dateObjUpdate.getTime() - (offsetUpdate*60*1000));
    const todayUpdate = localDateUpdate.toISOString().split('T')[0];
    await supabase.from("daily_nutrition").update(newMacros).eq("user_id", user?.id).eq("date", todayUpdate);
  };

  const saveGoals = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("profiles").update({ daily_protein: goals.protein, daily_carbs: goals.carbs, daily_fats: goals.fats, daily_calories: goals.calories }).eq("id", user?.id);
    setShowGoalModal(false);
  };

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500">Cargando...</div>;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 p-6 pb-24">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2 text-emerald-500"><UtensilsCrossed /> Nutrición</h1>
          <p className="text-zinc-500 text-sm">Hoy vs Metas</p>
        </div>
        {/* BOTON PARA EDITAR METAS AQUÍ */}
        <button onClick={() => setShowGoalModal(true)} className="bg-zinc-900 p-3 rounded-full border border-zinc-800 text-zinc-400 hover:text-white">
          <Edit3 size={20} />
        </button>
      </header>

      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl mb-6 relative overflow-hidden text-center">
        <div className="absolute top-0 left-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500" style={{ width: `${Math.min((macros.calories / goals.calories) * 100, 100)}%` }} />
        <h2 className="text-4xl font-black text-white">{macros.calories}</h2>
        <p className="text-zinc-500 text-xs font-bold uppercase">de {goals.calories} kcal</p>
      </div>

      <div className="space-y-4">
        {[
          { label: "Proteína", key: "protein", color: "text-indigo-400", bg: "accent-indigo-500", goal: goals.protein },
          { label: "Carbs", key: "carbs", color: "text-amber-400", bg: "accent-amber-500", goal: goals.carbs },
          { label: "Grasas", key: "fats", color: "text-rose-400", bg: "accent-rose-500", goal: goals.fats },
        ].map((m) => (
          <div key={m.key} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
            <div className="flex justify-between mb-2 text-sm font-bold">
              <span className={m.color}>{m.label}</span>
              <span className="text-zinc-500">{(macros as Record<string, number>)[m.key]} / {m.goal}g</span>
            </div>
            <input type="range" max={m.goal * 1.5} 
              value={(macros as Record<string, number>)[m.key]} onChange={(e) => updateMacro(m.key, parseInt(e.target.value))}
              className={`w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer ${m.bg}`} 
            />
          </div>
        ))}
      </div>

      {showGoalModal && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="bg-zinc-900 w-full max-w-sm rounded-3xl border border-zinc-800 p-6 shadow-2xl">
            <div className="flex justify-between mb-6 items-center">
              <h3 className="font-black text-xl">Tus Metas</h3>
              <button onClick={() => setShowGoalModal(false)} className="text-zinc-500 hover:text-white"><X /></button>
            </div>
            <div className="space-y-4">
              {['protein', 'carbs', 'fats', 'calories'].map((k) => (
                <div key={k}>
                  <label className="text-xs uppercase text-zinc-500 font-bold block mb-1">{k}</label>
                  <input type="number" 
                    value={(goals as Record<string, number>)[k]} onChange={(e) => setGoals({...goals, [k]: parseInt(e.target.value)})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:border-indigo-500 outline-none" 
                  />
                </div>
              ))}
              <button onClick={saveGoals} className="w-full bg-emerald-600 hover:bg-emerald-500 py-4 rounded-xl font-bold mt-4 transition-colors">Guardar Metas</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}