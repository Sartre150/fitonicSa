"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import ExerciseLogger from "@/components/ExerciseLogger";

interface WorkoutExercise {
  id: string;
  order_index: number;
  warmup_sets: string;
  working_sets: number;
  target_reps: string;
  target_rpe: string;
  day_id: string;
  exercise_id: string;
  superset_group: string;
  notes: string;
  exercises: { name: string; body_part: string; };
  program_days: { day_name: string; };
}

export default function WorkoutPage() {
  const [days, setDays] = useState<any[]>([]);
  const [activeDayId, setActiveDayId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const[selectedExercise, setSelectedExercise] = useState<WorkoutExercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [week, setWeek] = useState(1);
  
  const supabase = createClient();

  const fetchDays = useCallback(async () => {
    const { data } = await supabase.from("program_days").select("id, day_name").order("day_name");
    if (data && data.length > 0) {
      // Ordenamos manualmente para que salga Push, Pull, Legs, Upper, Lower
      const sorted = data.sort((a, b) => {
        const order =["Push #1", "Pull #1", "Legs #1", "Upper #1", "Lower #1"];
        return order.indexOf(a.day_name) - order.indexOf(b.day_name);
      });
      setDays(sorted);
      setActiveDayId(sorted[0].id);
    }
  }, [supabase]);

  const fetchExercises = useCallback(async (dayId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("workout_structure")
      .select(`*, exercises (name, body_part), program_days (day_name)`)
      .eq("day_id", dayId)
      .order("order_index", { ascending: true });

    if (data) setExercises(data as unknown as WorkoutExercise[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchDays(); }, [fetchDays]);
  useEffect(() => { if (activeDayId) fetchExercises(activeDayId); },[activeDayId, fetchExercises]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 p-6 pb-24 flex flex-col">
      <header className="flex items-center gap-4 mb-6">
        <Link href="/" className="bg-zinc-900 p-2 rounded-full border border-zinc-800">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-black">Fase 1: Base</h1>
          <p className="text-indigo-400 font-semibold text-sm">Ultimate PPL System</p>
        </div>
      </header>

      {/* Selector de Semana */}
      <div className="flex items-center justify-between bg-zinc-900/50 p-3 rounded-xl border border-zinc-800 mb-4">
        <span className="text-sm font-bold text-zinc-400">Semana Actual:</span>
        <div className="flex items-center gap-3">
          <button onClick={() => setWeek(w => Math.max(1, w - 1))} className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-lg font-bold hover:bg-zinc-700">-</button>
          <span className="font-mono text-xl font-black text-indigo-400 w-6 text-center">{week}</span>
          <button onClick={() => setWeek(w => Math.min(12, w + 1))} className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-lg font-bold hover:bg-zinc-700">+</button>
        </div>
      </div>

      {/* TABS DE DIAS (Selector horizontal) */}
      <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2 mb-6 snap-x">
        {days.map((day) => (
          <button
            key={day.id}
            onClick={() => setActiveDayId(day.id)}
            className={`snap-start whitespace-nowrap px-5 py-2 rounded-full font-bold text-sm transition-all border ${
              activeDayId === day.id
                ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-900/20"
                : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
            }`}
          >
            {day.day_name}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center mt-10 text-zinc-500 animate-pulse font-bold">Cargando...</p>
      ) : (
        <div className="flex flex-col gap-4 flex-1">
          {exercises.map((item) => (
            <div key={item.id} className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl relative overflow-hidden">
              {item.superset_group && (
                <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500"></div>
              )}
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-lg font-bold pr-2">{item.exercises?.name}</h2>
                <span className="text-[10px] uppercase font-black bg-zinc-800 text-zinc-300 px-2 py-1 rounded border border-zinc-700">
                  {item.exercises?.body_part}
                </span>
              </div>
              
              <div className="grid grid-cols-4 gap-2 mb-4 text-center text-sm">
                <div className="bg-zinc-950 rounded-lg p-2 border border-zinc-800/50">
                  <p className="text-zinc-500 text-[10px] uppercase font-bold">Warmup</p>
                  <p className="font-semibold text-yellow-500/80">{item.warmup_sets || '0'}</p>
                </div>
                <div className="bg-zinc-950 rounded-lg p-2 border border-zinc-800/50">
                  <p className="text-zinc-500 text-[10px] uppercase font-bold">Working</p>
                  <p className="font-semibold text-indigo-400">{item.working_sets}</p>
                </div>
                <div className="bg-zinc-950 rounded-lg p-2 border border-zinc-800/50">
                  <p className="text-zinc-500 text-[10px] uppercase font-bold">Reps</p>
                  <p className="font-semibold">{item.target_reps}</p>
                </div>
                <div className="bg-zinc-950 rounded-lg p-2 border border-zinc-800/50">
                  <p className="text-zinc-500 text-[10px] uppercase font-bold">RPE</p>
                  <p className="font-semibold text-red-400">{item.target_rpe}</p>
                </div>
              </div>

              {item.notes && <p className="text-xs text-zinc-500 mb-4 bg-zinc-950 p-2 rounded-lg border border-zinc-800/50">💡 {item.notes}</p>}

              <button onClick={() => setSelectedExercise(item)} className="w-full flex items-center justify-center gap-2 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-colors py-3 rounded-xl font-bold text-sm border border-indigo-600/20">
                <CheckCircle2 size={16} /> Trackear Sets
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedExercise && <ExerciseLogger exercise={selectedExercise} onClose={() => setSelectedExercise(null)} />}
    </main>
  );
}