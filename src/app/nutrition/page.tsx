"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase";
import { UtensilsCrossed, Flame, Droplets, Save, Loader2 } from "lucide-react";

type Macros = {
  protein: number;
  carbs: number;
  fats: number;
  calories: number;
  water_cups: number;
};

export default function NutritionPage() {
  // ✅ Supabase estable (no se recrea cada render)
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Metas (hardcoded)
  const GOALS = { protein: 180, carbs: 250, fats: 70, calories: 2500 };

  const [macros, setMacros] = useState<Macros>({
    protein: 0,
    carbs: 0,
    fats: 0,
    calories: 0,
    water_cups: 0,
  });

  // ✅ Cargar datos de HOY (sin useCallback para evitar dependencias inestables)
  useEffect(() => {
    let cancelled = false;

    const fetchNutrition = async () => {
      const { data, error: userError } = await supabase.auth.getUser();
      const user = data?.user;

      if (userError || !user) {
        if (!cancelled) setLoading(false);
        return;
      }

      const today = new Date().toISOString().split("T")[0];

      const { data: row, error } = await supabase
        .from("daily_nutrition")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("Error cargando nutrición:", error);
        setLoading(false);
        return;
      }

      if (row) {
        // Asegura defaults por si faltan columnas
        setMacros({
          protein: row.protein ?? 0,
          carbs: row.carbs ?? 0,
          fats: row.fats ?? 0,
          calories: row.calories ?? 0,
          water_cups: row.water_cups ?? 0,
        });
      } else {
        // Si no existe, creamos la fila vacía
        const { data: newRow, error: createError } = await supabase
          .from("daily_nutrition")
          .insert({ user_id: user.id, date: today })
          .select("*")
          .single();

        if (createError) {
          console.error("Error creando nutrición de hoy:", createError);
          setLoading(false);
          return;
        }

        setMacros({
          protein: newRow.protein ?? 0,
          carbs: newRow.carbs ?? 0,
          fats: newRow.fats ?? 0,
          calories: newRow.calories ?? 0,
          water_cups: newRow.water_cups ?? 0,
        });
      }

      setLoading(false);
    };

    fetchNutrition();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Guardar cambios localmente (optimistic) + recalcular calorías
  const handleUpdate = (field: keyof Macros, value: number) => {
    const safeValue = Number.isFinite(value) ? value : 0;

    setMacros((prev) => {
      const next: Macros = { ...prev, [field]: safeValue };

      // Recalcular calorías si editan macros
      if (field !== "calories" && field !== "water_cups") {
        next.calories = next.protein * 4 + next.carbs * 4 + next.fats * 9;
      }

      return next;
    });
  };

  const saveToDb = async () => {
    setSaving(true);

    const { data, error: userError } = await supabase.auth.getUser();
    const user = data?.user;

    if (userError || !user) {
      setSaving(false);
      alert("Error: No estás logueado");
      return;
    }

    const today = new Date().toISOString().split("T")[0];

    const { error } = await supabase
      .from("daily_nutrition")
      .update({
        protein: macros.protein,
        carbs: macros.carbs,
        fats: macros.fats,
        calories: macros.calories,
        water_cups: macros.water_cups,
      })
      .eq("user_id", user.id)
      .eq("date", today);

    setSaving(false);

    if (error) {
      console.error("Error guardando macros:", error);
      alert("Error al guardar: " + (error.message || "Error desconocido"));
      return;
    }

    alert("Macros actualizados 🥦");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 p-6 flex items-center justify-center text-zinc-500">
        Cargando macros...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 p-6 pb-24">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <UtensilsCrossed className="text-emerald-500" />
            Nutrición
          </h1>
          <p className="text-zinc-500 text-sm">Combustible de hoy</p>
        </div>

        <button
          onClick={saveToDb}
          disabled={saving}
          className="bg-emerald-500/10 text-emerald-500 p-3 rounded-xl hover:bg-emerald-500 hover:text-white transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
        </button>
      </header>

      {/* Resumen Calorías */}
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl mb-6 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-zinc-800">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
            style={{ width: `${Math.min((macros.calories / GOALS.calories) * 100, 100)}%` }}
          />
        </div>
        <h2 className="text-4xl font-black text-white mb-1">{macros.calories}</h2>
        <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold">Kcal Consumidas</p>
        <p className="text-zinc-700 text-xs mt-2">Meta: {GOALS.calories}</p>
      </div>

      {/* Inputs de Macros */}
      <div className="grid gap-4">
        {/* Proteína */}
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
            <UtensilsCrossed size={24} />
          </div>
          <div className="flex-1">
            <div className="flex justify-between mb-1">
              <span className="text-sm font-bold text-indigo-200">Proteína</span>
              <span className="text-xs text-zinc-500">
                {macros.protein} / {GOALS.protein}g
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={300}
              value={macros.protein}
              onChange={(e) => handleUpdate("protein", Number.parseInt(e.target.value, 10) || 0)}
              className="w-full accent-indigo-500 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <input
            type="number"
            value={macros.protein}
            onChange={(e) => handleUpdate("protein", Number.parseInt(e.target.value, 10) || 0)}
            className="w-16 bg-zinc-950 border border-zinc-800 rounded-lg py-2 text-center font-bold text-white focus:border-indigo-500 outline-none"
          />
        </div>

        {/* Carbs */}
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400">
            <Flame size={24} />
          </div>
          <div className="flex-1">
            <div className="flex justify-between mb-1">
              <span className="text-sm font-bold text-amber-200">Carbs</span>
              <span className="text-xs text-zinc-500">
                {macros.carbs} / {GOALS.carbs}g
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={500}
              value={macros.carbs}
              onChange={(e) => handleUpdate("carbs", Number.parseInt(e.target.value, 10) || 0)}
              className="w-full accent-amber-500 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <input
            type="number"
            value={macros.carbs}
            onChange={(e) => handleUpdate("carbs", Number.parseInt(e.target.value, 10) || 0)}
            className="w-16 bg-zinc-950 border border-zinc-800 rounded-lg py-2 text-center font-bold text-white focus:border-amber-500 outline-none"
          />
        </div>

        {/* Grasas */}
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400">
            <Droplets size={24} />
          </div>
          <div className="flex-1">
            <div className="flex justify-between mb-1">
              <span className="text-sm font-bold text-rose-200">Grasas</span>
              <span className="text-xs text-zinc-500">
                {macros.fats} / {GOALS.fats}g
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={150}
              value={macros.fats}
              onChange={(e) => handleUpdate("fats", Number.parseInt(e.target.value, 10) || 0)}
              className="w-full accent-rose-500 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <input
            type="number"
            value={macros.fats}
            onChange={(e) => handleUpdate("fats", Number.parseInt(e.target.value, 10) || 0)}
            className="w-16 bg-zinc-950 border border-zinc-800 rounded-lg py-2 text-center font-bold text-white focus:border-rose-500 outline-none"
          />
        </div>
      </div>
    </main>
  );
}