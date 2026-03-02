// src/app/workout/page.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import ExerciseLogger from "@/components/ExerciseLogger";

interface ExerciseItem {
  id: string;
  exercise_id: string;
  day_id: string;
  exercises: {
    name: string;
    body_part: string;
  };
  warmup_sets: number;
  working_sets: number;
  target_reps: number;
  target_rpe: number;
  program_days: {
    day_name: string;
  };
}

export default function WorkoutPage() {
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseItem | null>(null); // <-- Agregado
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchRoutine() {
      const { data, error } = await supabase
        .from("workout_structure")
        .select(
          `
          *,
          exercises (name, body_part),
          program_days (day_name)
        `
        )
        .order("order_index", { ascending: true });

      if (error) {
        console.error("Error cargando rutina:", error);
      } else {
        setExercises(data || []);
      }
      setLoading(false);
    }

    fetchRoutine();
  }, [supabase]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 p-6 pb-24">
      {/* Header */}
      <header className="flex items-center gap-4 mb-8">
        <Link
          href="/"
          className="bg-zinc-900 p-2 rounded-full border border-zinc-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-black">
            {exercises.length > 0
              ? exercises[0].program_days.day_name
              : "Entrenamiento"}
          </h1>
          <p className="text-indigo-400 font-semibold text-sm">
            Fase 1: Base Hypertrophy
          </p>
        </div>
      </header>

      {/* Lista de Ejercicios */}
      {loading ? (
        <p className="text-zinc-500 animate-pulse text-center mt-20">
          Cargando la fuerza bruta...
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {exercises.map((item) => (
            <div
              key={item.id}
              className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl"
            >
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-lg font-bold">{item.exercises.name}</h2>
                <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded border border-zinc-700">
                  {item.exercises.body_part}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-4 text-center text-sm">
                <div className="bg-zinc-950 rounded-lg p-2 border border-zinc-800/50">
                  <p className="text-zinc-500 text-[10px] uppercase font-bold">
                    Warmup
                  </p>
                  <p className="font-semibold">{item.warmup_sets} sets</p>
                </div>
                <div className="bg-zinc-950 rounded-lg p-2 border border-zinc-800/50">
                  <p className="text-zinc-500 text-[10px] uppercase font-bold">
                    Working
                  </p>
                  <p className="font-semibold text-indigo-400">
                    {item.working_sets} sets
                  </p>
                </div>
                <div className="bg-zinc-950 rounded-lg p-2 border border-zinc-800/50">
                  <p className="text-zinc-500 text-[10px] uppercase font-bold">
                    Reps
                  </p>
                  <p className="font-semibold">{item.target_reps}</p>
                </div>
                <div className="bg-zinc-950 rounded-lg p-2 border border-zinc-800/50">
                  <p className="text-zinc-500 text-[10px] uppercase font-bold">
                    RPE
                  </p>
                  <p className="font-semibold text-red-400">
                    {item.target_rpe}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedExercise(item)} // <-- Aquí activamos el modal
                className="w-full flex items-center justify-center gap-2 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-colors py-2 rounded-xl font-bold text-sm border border-indigo-600/20"
              >
                <CheckCircle2 size={16} />
                Comenzar Sets
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal Overlay */}
      {selectedExercise && (
        <ExerciseLogger
          exercise={selectedExercise}
          onClose={() => setSelectedExercise(null)}
        />
      )}
    </main>
  );
}