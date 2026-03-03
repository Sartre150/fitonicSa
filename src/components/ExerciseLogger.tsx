"use client";

import { useState, useMemo, useEffect } from "react";
import { createClient } from "@/utils/supabase";
import { X, Save, Plus, Trash2, Loader2, Calendar } from "lucide-react";

type SetType = "Warmup" | "Normal";

type SetField = "weight" | "reps" | "rpe" | "type";

type SetRow = {
  weight: string;
  reps: string;
  rpe: string;
  type: SetType;
};

interface ExerciseItem {
  id: string;
  exercise_id: string;
  day_id: string;
  exercises: {
    name: string;
    body_part: string;
  };
  warmup_sets: string | number;
  working_sets: number;
  target_reps: string | number;
  target_rpe: string | number;
  program_days: {
    day_name: string;
  };
}

type WorkoutSet = {
  workout_id: string;
  exercise_id: string;
  set_number: number;
  set_type: SetType;
  weight_lbs: number;
  reps_done: number;
  rpe_felt: number | null;
};

interface ExerciseLoggerProps {
  exercise: ExerciseItem;
  onClose: () => void;
}

export default function ExerciseLogger({ exercise, onClose }: ExerciseLoggerProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [unit, setUnit] = useState<'lbs' | 'kg'>('lbs');

  // Cargar unidad del localStorage
  useEffect(() => {
    const savedUnit = (localStorage.getItem('weightUnit') as 'lbs' | 'kg') || 'lbs';
    setUnit(savedUnit);
  }, []);

  const convertToLbs = (value: number): number => {
    return unit === 'kg' ? Number((value / 0.453592).toFixed(1)) : value;
  };

  // Obtener la fecha actual formateada
  const todayFormatted = useMemo(() => {
    const today = new Date();
    return today.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, []);

  const [sets, setSets] = useState<SetRow[]>([
    { weight: "", reps: "", rpe: "", type: "Warmup" },
    { weight: "", reps: "", rpe: "", type: "Normal" },
    { weight: "", reps: "", rpe: "", type: "Normal" },
  ]);

  const updateSet = (index: number, field: SetField, value: string) => {
    setSets((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        if (field === "type") return { ...s, type: value as SetType };
        return { ...s, [field]: value } as SetRow;
      })
    );
  };

  const addSet = () => {
    setSets((prev) => [...prev, { weight: "", reps: "", rpe: "", type: "Normal" }]);
  };

  const removeSet = (index: number) => {
    setSets((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setLoading(false);
      alert("Error: No estás logueado");
      return;
    }

    const today = new Date().toISOString().split("T")[0];

    try {
      // 1) Buscar workout de hoy (si existe)
      const { data: existingWorkout, error: existingError } = await supabase
        .from("user_workouts")
        .select("id")
        .eq("user_id", user.id)
        .eq("day_id", exercise.day_id)
        .eq("date", today)
        .maybeSingle();

      if (existingError) throw existingError;

      let currentWorkoutId: string;

      if (existingWorkout?.id) {
        currentWorkoutId = existingWorkout.id;
      } else {
        // 2) Crear workout
        const { data: newWorkout, error: createError } = await supabase
          .from("user_workouts")
          .insert({
            user_id: user.id,
            day_id: exercise.day_id,
            date: today,
          })
          .select("id")
          .single();

        if (createError) throw createError;
        currentWorkoutId = newWorkout.id;
      }

      // 3) Preparar sets válidos
      const setsToSave: WorkoutSet[] = sets
        .filter((s) => s.weight.trim() !== "" && s.reps.trim() !== "")
        .map((s, index) => {
          const weight = Number.parseFloat(s.weight);
          const reps = Number.parseInt(s.reps, 10);
          const rpe = s.rpe.trim() === "" ? null : Number.parseFloat(s.rpe);

          if (Number.isNaN(weight) || Number.isNaN(reps)) return null;

          return {
            workout_id: currentWorkoutId,
            exercise_id: exercise.exercise_id,
            set_number: index + 1,
            set_type: s.type, // "Warmup" | "Normal"
            weight_lbs: convertToLbs(weight),
            reps_done: reps,
            rpe_felt: rpe !== null && Number.isNaN(rpe) ? null : rpe,
          };
        })
        .filter((s): s is WorkoutSet => s !== null);

      if (setsToSave.length > 0) {
        const { error: setsError } = await supabase.from("workout_sets").insert(setsToSave);
        if (setsError) throw setsError;
      }

      alert("¡Guardado máquina! 💪");
      onClose();
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(err);
      alert("Error al guardar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 w-full max-w-md rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-6 bg-zinc-950 border-b border-zinc-800 flex justify-between items-start shrink-0">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-white">{exercise?.exercises?.name}</h3>
            <div className="flex items-center gap-2 mt-2">
              <Calendar size={14} className="text-emerald-400" />
              <p className="text-emerald-400 text-xs font-semibold capitalize">
                {todayFormatted}
              </p>
            </div>
            <p className="text-indigo-400 text-xs font-mono uppercase tracking-wider mt-2">
              Meta: {exercise?.target_reps} Reps @ RPE {exercise?.target_rpe}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-zinc-800 rounded-full text-zinc-400 hover:text-white flex-shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabla Scrollable */}
        <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
          <div className="grid grid-cols-[30px_1fr_1fr_1fr_20px] gap-3 mb-2 text-center text-xs text-zinc-500 font-bold uppercase tracking-wider px-1">
            <span>#</span>
            <span>{unit}</span>
            <span>Reps</span>
            <span>RPE</span>
            <span></span>
          </div>

          <div className="space-y-3">
            {sets.map((set, index) => (
              <div key={index} className="grid grid-cols-[30px_1fr_1fr_1fr_20px] gap-3 items-center">
                {/* Número / Tipo */}
                <button
                  onClick={() => {
                    const newType: SetType = set.type === "Normal" ? "Warmup" : "Normal";
                    updateSet(index, "type", newType);
                  }}
                  className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${
                    set.type === "Warmup"
                      ? "bg-yellow-500/20 text-yellow-500"
                      : "bg-indigo-600 text-white"
                  }`}
                  disabled={loading}
                >
                  {set.type === "Warmup" ? "W" : index + 1}
                </button>

                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={set.weight}
                  onChange={(e) => updateSet(index, "weight", e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 text-center text-white font-mono text-lg focus:border-indigo-500 focus:outline-none"
                />

                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={set.reps}
                  onChange={(e) => updateSet(index, "reps", e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 text-center text-white font-mono text-lg focus:border-indigo-500 focus:outline-none"
                />

                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="-"
                  value={set.rpe}
                  onChange={(e) => updateSet(index, "rpe", e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 text-center text-white font-mono text-lg focus:border-indigo-500 focus:outline-none"
                />

                <button
                  onClick={() => removeSet(index)}
                  className="text-zinc-600 hover:text-red-500"
                  disabled={loading}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={addSet}
            disabled={loading}
            className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-dashed border-zinc-700 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors text-sm disabled:opacity-50"
          >
            <Plus size={16} /> Agregar set
          </button>
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-800 shrink-0">
          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20 active:scale-95 transition-transform disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <>
                <Save size={20} /> Guardar Progreso
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}