"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { ArrowLeft, CheckCircle2, ChevronDown } from "lucide-react";
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
  superset_group: string | null;
  notes: string;
  exercises: { name: string; body_part: string; };
  program_days: { day_name: string; };
}

interface Program {
  id: string;
  name: string;
  description: string;
}

interface ProgramDay {
  id: string;
  day_name: string;
}

export default function WorkoutPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [activeProgramId, setActiveProgramId] = useState<string | null>(null);

  const [days, setDays] = useState<ProgramDay[]>([]);
  const[activeDayId, setActiveDayId] = useState<string | null>(null);

  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<WorkoutExercise | null>(null);
  
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [loadingDays, setLoadingDays] = useState(false);
  const [loadingExercises, setLoadingExercises] = useState(false);

  const supabase = createClient();

  // 1. Cargar Programas (Fases) al montar el componente
  useEffect(() => {
    let isMounted = true;

    async function loadPrograms() {
      setLoadingPrograms(true);
      const { data, error } = await supabase
        .from("programs")
        .select("*")
        .order("name");

      if (isMounted) {
        if (!error && data && data.length > 0) {
          setPrograms(data as Program[]);
          setActiveProgramId(data[0].id); // Selecciona el primero por defecto
        } else {
          setPrograms([]);
          setActiveProgramId(null);
        }
        setLoadingPrograms(false);
      }
    }

    loadPrograms();

    return () => { isMounted = false; };
  }, [supabase]);

  // 2. Cargar Días cuando cambia el activeProgramId
  useEffect(() => {
    let isMounted = true;

    async function loadDays() {
      if (!activeProgramId) {
        if (isMounted) {
          setDays([]);
          setActiveDayId(null);
        }
        return;
      }

      setLoadingDays(true);
      const { data, error } = await supabase
        .from("program_days")
        .select("id, day_name")
        .eq("program_id", activeProgramId);

      if (isMounted) {
        if (!error && data && data.length > 0) {
          // Ordenamiento específico
          const sorted = data.sort((a, b) => {
            const order =["Push #1", "Pull #1", "Legs #1", "Upper #1", "Lower #1"];
            const leftIndex = order.indexOf(a.day_name);
            const rightIndex = order.indexOf(b.day_name);

            if (leftIndex === -1 && rightIndex === -1) return a.day_name.localeCompare(b.day_name);
            if (leftIndex === -1) return 1;
            if (rightIndex === -1) return -1;
            return leftIndex - rightIndex;
          });

          setDays(sorted);
          setActiveDayId(sorted[0].id); // Selecciona el primer día automáticamente
        } else {
          setDays([]);
          setActiveDayId(null);
        }
        setLoadingDays(false);
      }
    }

    loadDays();

    return () => { isMounted = false; };
  },[activeProgramId, supabase]);

  // 3. Cargar Ejercicios cuando cambia el activeDayId
  useEffect(() => {
    let isMounted = true;

    async function loadExercises() {
      if (!activeDayId) {
        if (isMounted) setExercises([]);
        return;
      }

      setLoadingExercises(true);
      const { data, error } = await supabase
        .from("workout_structure")
        .select(`*, exercises (name, body_part), program_days (day_name)`)
        .eq("day_id", activeDayId)
        .order("order_index", { ascending: true });

      if (isMounted) {
        if (!error && data) {
          setExercises(data as unknown as WorkoutExercise[]);
        } else {
          setExercises([]);
        }
        setLoadingExercises(false);
      }
    }

    loadExercises();

    return () => { isMounted = false; };
  },[activeDayId, supabase]);

  const [currentWeekString] = useState<string>(() => {
    const today = new Date();
    const day = today.getDay() || 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - day + 1);
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - day + 7);

    return `${monday.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - ${sunday.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`;
  });

  const isLoadingAny = loadingPrograms || loadingDays || loadingExercises;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 p-6 pb-24 flex flex-col">
      <header className="flex items-center gap-4 mb-6">
        <Link href="/" className="bg-zinc-900 p-2 rounded-full border border-zinc-800 hover:bg-zinc-800 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          {/* SELECTOR DE FASE */}
          <div className="relative">
            <select
              value={activeProgramId || ""}
              onChange={(e) => setActiveProgramId(e.target.value)}
              disabled={programs.length === 0}
              className="appearance-none w-full bg-transparent text-xl font-black focus:outline-none cursor-pointer pr-6 text-white truncate"
            >
              {programs.length === 0 ? (
                <option value="">Cargando Fases...</option>
              ) : (
                programs.map((program) => (
                  <option key={program.id} value={program.id} className="bg-zinc-900 text-base">
                    {program.name}
                  </option>
                ))
              )}
            </select>
            <ChevronDown className="absolute right-0 top-1 text-indigo-500 pointer-events-none" size={20} />
          </div>

          <p className="text-indigo-400 font-semibold text-xs mt-1">
            {programs.find((p) => p.id === activeProgramId)?.description || "Cargando descripción..."}
          </p>
        </div>
      </header>

      {/* FECHA SEMANA */}
      <div className="flex items-center justify-between bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 mb-4">
        <div>
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">Semana del</span>
          <span className="font-bold text-white">{currentWeekString}</span>
        </div>
        <div className="bg-indigo-600/20 text-indigo-400 px-3 py-1 rounded-lg text-xs font-bold border border-indigo-500/20">
          HOY
        </div>
      </div>

      {/* PESTAÑAS DE DÍAS */}
      {days.length > 0 && (
        <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2 mb-6 snap-x">
          {days.map((day) => (
            <button
              key={day.id}
              onClick={() => setActiveDayId(day.id)}
              className={`snap-start whitespace-nowrap px-5 py-2 rounded-full font-bold text-sm transition-all border ${
                activeDayId === day.id
                  ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-900/20"
                  : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white hover:bg-zinc-800"
              }`}
            >
              {day.day_name}
            </button>
          ))}
        </div>
      )}

      {/* CONTENIDO EJERCICIOS */}
      {isLoadingAny ? (
        <div className="flex-1 flex justify-center items-center">
           <p className="text-zinc-500 animate-pulse font-bold">Cargando rutina...</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 flex-1">
          {exercises.map((item) => (
            <div key={item.id} className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl relative overflow-hidden">
              {item.superset_group && (
                <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500"></div>
              )}
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-lg font-bold pr-2">{item.exercises?.name}</h2>
                <span className="text-[10px] uppercase font-black bg-zinc-800 text-zinc-300 px-2 py-1 rounded border border-zinc-700 shrink-0">
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

              {item.notes && (
                <p className="text-xs text-zinc-400 mb-4 bg-zinc-950 p-3 rounded-lg border border-zinc-800/50">
                  💡 {item.notes}
                </p>
              )}

              <button
                onClick={() => setSelectedExercise(item)}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-colors py-3 rounded-xl font-bold text-sm border border-indigo-600/20 active:scale-95"
              >
                <CheckCircle2 size={16} /> Trackear Sets
              </button>
            </div>
          ))}

          {exercises.length === 0 && activeDayId && (
            <div className="text-center text-zinc-500 mt-10 p-6 border border-dashed border-zinc-800 rounded-xl">
              No hay ejercicios cargados en este dia para esta fase.
            </div>
          )}
        </div>
      )}

      {selectedExercise && (
        <ExerciseLogger 
          exercise={selectedExercise} 
          onClose={() => setSelectedExercise(null)} 
        />
      )}
    </main>
  );
}