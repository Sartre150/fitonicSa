"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase";
import { TrendingUp, Calendar } from "lucide-react";

type WorkoutLog = {
  id: string;
  weight_lbs: number;
  reps_done: number;
  rpe_felt: number | null;
  set_type: string;
  exercises: { name: string } | null;
  user_workouts: { date: string } | null;
};

export default function ProgressPage() {
  const [logs, setLogs] = useState<WorkoutLog[]>([]);

  // ✅ IMPORTANTe: instancia estable (no se recrea cada render)
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let cancelled = false;

    const fetchHistory = async () => {
      const { data, error: userError } = await supabase.auth.getUser();
      const user = data?.user;

      if (userError || !user) {
        if (!cancelled) setLogs([]);
        return;
      }

      const { data: rows, error } = await supabase
        .from("workout_sets")
        .select(
          `
          id,
          weight_lbs,
          reps_done,
          rpe_felt,
          set_type,
          exercises (name),
          user_workouts (date)
        `
        )
        // Si tu RLS/relaciones lo requieren, probablemente tengas que filtrar por usuario
        // .eq("user_workouts.user_id", user.id)
        .order("id", { ascending: false })
        .limit(20);

      if (!cancelled) {
        if (error || !rows) {
          console.error("Error cargando historial:", error);
          setLogs([]);
        } else {
          setLogs(rows as unknown as WorkoutLog[]);
        }
      }
    };

    fetchHistory();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 p-6 pb-24">
      <header className="mb-8">
        <h1 className="text-2xl font-black flex items-center gap-2">
          <TrendingUp className="text-indigo-500" />
          Historial Reciente
        </h1>
        <p className="text-zinc-500 text-sm">Tus últimos levantamientos</p>
      </header>

      <div className="space-y-3">
        {logs.map((log) => (
          <div
            key={log.id}
            className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex justify-between items-center"
          >
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white">
                  {log.exercises?.name || "Ejercicio"}
                </h3>

                {log.set_type === "Warmup" && (
                  <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded uppercase font-bold">
                    Calentamiento
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
                <Calendar size={12} />
                {log.user_workouts?.date
                  ? new Date(log.user_workouts.date).toLocaleDateString()
                  : "Fecha desconocida"}
              </div>
            </div>

            <div className="text-right">
              <div className="text-xl font-black text-indigo-400">
                {log.weight_lbs}{" "}
                <span className="text-xs text-zinc-500 font-normal">lbs</span>
              </div>
              <div className="text-xs font-mono text-zinc-400">
                {log.reps_done} reps{" "}
                {log.rpe_felt != null ? `@ RPE ${log.rpe_felt}` : ""}
              </div>
            </div>
          </div>
        ))}

        {logs.length === 0 && (
          <div className="text-center text-zinc-600 mt-10 p-10 border border-dashed border-zinc-800 rounded-2xl">
            <p>No se encontraron datos.</p>
            <p className="text-xs mt-2">Asegúrate de haber guardado al menos un set.</p>
          </div>
        )}
      </div>
    </main>
  );
}