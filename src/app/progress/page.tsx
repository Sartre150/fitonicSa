"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase";
import { TrendingUp, Calendar } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface WorkoutLog {
  id: string;
  weight_lbs: number;
  reps_done: number;
  rpe_felt: number | null;
  set_type: string;
  exercises: { name: string } | null;
  user_workouts: { date: string } | null;
}

interface ChartPoint {
  date: string;
  orm: number;
  originalDate?: string;
}

export default function ProgressPage() {
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const supabase = createClient();

  const fetchHistory = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Traer historial (Lista)
    const { data } = await supabase
      .from("workout_sets")
      .select(`*, exercises (name), user_workouts (date)`)
      .order("id", { ascending: false })
      .limit(50);

    if (data) {
      setLogs(data as unknown as WorkoutLog[]);

      // 2. Preparar datos para gráfica (Ejemplo: Bench Press)
      // Filtramos solo el ejercicio más popular o el último realizado
      const exerciseName = (data as unknown as WorkoutLog[])[0]?.exercises?.name || "Bench Press";

      const chartPoints = (data as unknown as WorkoutLog[])
        .filter((l) => l.exercises?.name === exerciseName && l.set_type === "Normal")
        .map((l) => ({
          date: new Date(l.user_workouts?.date || "").toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          orm: Math.round(l.weight_lbs * (1 + l.reps_done / 30)),
          originalDate: l.user_workouts?.date,
        }))
        .reverse(); // Para que la gráfica vaya de izquierda (viejo) a derecha (nuevo)

      setChartData(chartPoints);
    }
  }, [supabase]);

  useEffect(() => {
    (async () => fetchHistory())();
  }, [fetchHistory]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 p-6 pb-24">
      <header className="mb-6">
        <h1 className="text-2xl font-black flex items-center gap-2">
          <TrendingUp className="text-indigo-500" /> Progreso
        </h1>
        <p className="text-zinc-500 text-sm">Tu evolución en números</p>
      </header>

      {/* GRÁFICA */}
      {chartData.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl mb-6">
          <h3 className="font-bold text-sm text-zinc-400 mb-4 uppercase tracking-wider">Fuerza Estimada (1RM)</h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="date" stroke="#52525b" fontSize={11} />
                <YAxis stroke="#52525b" fontSize={11} domain={["dataMin - 10", "dataMax + 10"]} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px" }}
                  itemStyle={{ color: "#818cf8" }}
                />
                <Line
                  type="monotone"
                  dataKey="orm"
                  stroke="#6366f1"
                  strokeWidth={3}
                  dot={{ r: 5, fill: "#6366f1" }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-center text-xs text-zinc-600 mt-2">Calculado mediante fórmula Epley basada en tus sets</p>
        </div>
      )}

      {/* LISTA DE LOGS */}
      <div className="mb-4">
        <h2 className="text-lg font-bold text-zinc-300 mb-4">Historial Reciente</h2>
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50 flex justify-between items-center hover:border-zinc-700 transition-colors"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-white">{log.exercises?.name || "Ejercicio"}</span>
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
                <div className="text-lg font-black text-indigo-400">
                  {log.weight_lbs}
                  <span className="text-xs text-zinc-500 font-normal ml-1">lbs</span>
                </div>
                <div className="text-xs font-mono text-zinc-400">
                  {log.reps_done} reps {log.rpe_felt != null ? `@ RPE ${log.rpe_felt}` : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {logs.length === 0 && (
        <div className="text-center text-zinc-600 mt-10 p-10 border border-dashed border-zinc-800 rounded-2xl">
          <p>No se encontraron datos.</p>
          <p className="text-xs mt-2">Asegúrate de haber guardado al menos un set.</p>
        </div>
      )}
    </main>
  );
}