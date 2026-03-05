"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { TrendingUp, ChevronDown, Database, Activity, Dumbbell, ArrowRightLeft, Edit2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import EditSetModal from "@/components/EditSetModal";
import ReportGenerator from "@/components/ReportGenerator";

type Unit = "lbs" | "kg";

interface WorkoutLog {
  id: string;
  weight_lbs: number;
  reps_done: number;
  rpe_felt: number | null;
  set_type: string;
  exercises: { name: string; body_part: string; };
  user_workouts: { date: string; };
}

interface ChartPoint { date: string; orm: number; }
interface ExerciseStats {
  name: string;
  body_part: string;
  maxWeight: number;
  currentORM: number;
  lastDate: string;
  dataPoints: ChartPoint[];
}

interface CombinedChartPoint {
  date: string;
  [key: string]: number | string; // <-- ARREGLADO PARA TYPESCRIPT
}

const COLORS =[
  "#6366f1", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", 
  "#ef4444", "#06b6d4", "#f97316", "#84cc16", "#eab308"
];

export default function ProgressPage() {
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [registeredExercises, setRegisteredExercises] = useState<string[]>([]);
  const [selectedExercise, setSelectedExercise] = useState("Todos");
  const [exerciseStats, setExerciseStats] = useState<Map<string, ExerciseStats>>(new Map());
  const [combinedChartData, setCombinedChartData] = useState<CombinedChartPoint[]>([]); 
  const [selectedLog, setSelectedLog] = useState<WorkoutLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState<Unit>("lbs");
  const supabase = createClient();

  // Preferencia de Kg/Lbs guardada en el celular
  useEffect(() => {
    (async () => {
      const saved = (localStorage.getItem("weightUnit") as Unit) || "lbs";
      setUnit(saved);
    })();
  },[]);

  const toggleUnit = () => {
    const next = unit === "lbs" ? "kg" : "lbs";
    setUnit(next);
    localStorage.setItem("weightUnit", next);
  };

  const convertW = useCallback((lbs: number) => (unit === "kg" ? Math.round(lbs * 0.453592) : lbs), [unit]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // Obtener todos los workouts del usuario
    const { data: userWorkouts, error: workoutsError } = await supabase
      .from("user_workouts")
      .select("id")
      .eq("user_id", user.id);

    if (workoutsError || !userWorkouts || userWorkouts.length === 0) {
      setLogs([]);
      setRegisteredExercises([]);
      setExerciseStats(new Map());
      setCombinedChartData([]);
      setLoading(false);
      return;
    }

    const workoutIds = userWorkouts.map(w => w.id);

    // Traer todos los sets "Normal" del usuario
    const { data, error } = await supabase
      .from("workout_sets")
      .select(`id, weight_lbs, reps_done, rpe_felt, set_type, exercises (name, body_part), user_workouts (date)`)
      .eq("set_type", "Normal")
      .in("workout_id", workoutIds)
      .order("id", { ascending: false });

    if (!error && data && Array.isArray(data)) {
      const typedData = data as unknown as WorkoutLog[];
      
      // Filtrar logs sin ejercicios válidos
      const validLogs = typedData.filter(l => l.exercises?.name);
      setLogs(validLogs);

      // Extraer ejercicios únicos
      const uniqueEx = Array.from(new Set(
        validLogs.map(l => l.exercises!.name)
      )).sort();
      
      if (uniqueEx.length === 0) {
        setRegisteredExercises([]);
        setExerciseStats(new Map());
        setCombinedChartData([]);
        setLoading(false);
        return;
      }
      
      setRegisteredExercises(uniqueEx);

      const statsMap = new Map<string, ExerciseStats>();

      uniqueEx.forEach(exerciseName => {
        const exLogs = validLogs.filter(l => l.exercises?.name === exerciseName);
        if (exLogs.length === 0) return;

        const bodyPart = exLogs[0].exercises.body_part || "Otros";
        const bestPerDayMap = new Map<string, number>();

        exLogs.forEach(l => {
          if (!l.user_workouts?.date) return;
          const rawDate = l.user_workouts.date;
          const orm = Math.round(l.weight_lbs * (1 + l.reps_done / 30));
          
          if (!bestPerDayMap.has(rawDate) || orm > bestPerDayMap.get(rawDate)!) {
            bestPerDayMap.set(rawDate, orm);
          }
        });

        const chartPoints = Array.from(bestPerDayMap.entries())
          .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
          .map(([rawDate, orm]) => ({
            date: new Date(rawDate).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
            orm
          }));

        const maxWeight = Math.max(...exLogs.map(l => l.weight_lbs));
        const currentORM = chartPoints[chartPoints.length - 1]?.orm || 0;
        
        const mostRecentLog = exLogs.reduce((a, b) => new Date(a.user_workouts.date) > new Date(b.user_workouts.date) ? a : b);
        const lastDateStr = new Date(mostRecentLog.user_workouts.date).toLocaleDateString('es-ES', { timeZone: 'UTC' });

        statsMap.set(exerciseName, {
          name: exerciseName,
          body_part: bodyPart,
          maxWeight,
          currentORM,
          lastDate: lastDateStr,
          dataPoints: chartPoints
        });
      });

      setExerciseStats(statsMap);

      const allDatesRaw = Array.from(new Set(validLogs.map(l => l.user_workouts?.date).filter(Boolean)))
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

      const combined = allDatesRaw.map(rawDate => {
        const formattedDate = new Date(rawDate).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', timeZone: 'UTC' });
        const point: CombinedChartPoint = { date: formattedDate };
        
        uniqueEx.forEach(ex => {
          const statData = statsMap.get(ex);
          if (statData) {
            const dayPoint = statData.dataPoints.find(p => p.date === formattedDate);
            if (dayPoint) point[ex] = dayPoint.orm;
          }
        });
        return point;
      });

      setCombinedChartData(combined);
    } else if (error) {
      console.error("Error fetching workout data:", error);
      setLogs([]);
      setRegisteredExercises([]);
      setExerciseStats(new Map());
      setCombinedChartData([]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      await fetchHistory();
    })();
  }, [fetchHistory]);

  // Memoized computation para currentChartData en lugar de setState
  const currentChartData = useMemo(() => {
    if (selectedExercise !== "Todos") {
      return exerciseStats.get(selectedExercise)?.dataPoints ?? [];
    }
    return [];
  }, [selectedExercise, exerciseStats]);

  const logsByMuscleGroup = useMemo(() => {
    const grouped: Record<string, WorkoutLog[]> = {};
    logs.forEach(log => {
      if (!log.exercises) return;
      const group = log.exercises.body_part || "Otros";
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(log);
    });

    // Ordenar dentro de cada grupo muscular: por ejercicio (alfabético), luego por fecha (más reciente primero)
    Object.keys(grouped).forEach(group => {
      grouped[group].sort((a, b) => {
        // Primero ordenar por ejercicio (alfabético)
        const exerciseA = a.exercises?.name || "";
        const exerciseB = b.exercises?.name || "";
        const exerciseCompare = exerciseA.localeCompare(exerciseB);

        if (exerciseCompare !== 0) return exerciseCompare;

        // Si son el mismo ejercicio, ordenar por fecha (más reciente primero)
        const dateA = new Date(a.user_workouts?.date || '').getTime();
        const dateB = new Date(b.user_workouts?.date || '').getTime();
        return dateB - dateA; // Más reciente primero
      });
    });

    return grouped;
  }, [logs]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 p-6 pb-24">
      <header className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-2">
            <TrendingUp className="text-indigo-500" /> Progreso
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Tu evolución real, día por día</p>
        </div>
        <button onClick={toggleUnit} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-xl text-sm font-bold hover:bg-zinc-800 transition-colors text-indigo-400">
          {unit.toUpperCase()} <ArrowRightLeft size={14} />
        </button>
      </header>

      {loading ? (
        <div className="text-center text-zinc-500 py-10 animate-pulse font-bold">Cargando métricas...</div>
      ) : registeredExercises.length === 0 ? (
         <div className="text-center text-zinc-500 mt-20 p-8 border border-dashed border-zinc-800 rounded-3xl">
            <Dumbbell className="mx-auto mb-4 opacity-50" size={40} />
            <p>No has registrado ningún ejercicio aún.</p>
            <p className="text-xs mt-2">Ve a la pestaña de Rutina y trackea tu primer set (Normal)</p>
         </div>
      ) : (
        <>
          {/* REPORTE GENERATOR */}
          <ReportGenerator 
            exerciseStats={exerciseStats} 
            unit={unit} 
            logs={logs} 
          />

          {/* SELECTOR */}
          <div className="relative mb-6">
            <select 
              value={selectedExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 text-white font-bold py-4 px-4 rounded-2xl appearance-none focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
            >
              <option value="Todos">🌐 Vista Global ({registeredExercises.length} Ejercicios registrados)</option>
              {registeredExercises.map(ex => (
                <option key={ex} value={ex}>⭐ {ex}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-5 text-zinc-500 pointer-events-none" size={20} />
          </div>

          {/* GRÁFICA */}
          <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-6 rounded-3xl mb-8">
            
            {selectedExercise !== "Todos" && exerciseStats.has(selectedExercise) && (
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-black text-white pr-2">{exerciseStats.get(selectedExercise)!.name}</h2>
                  <span className="inline-block mt-1 text-[10px] uppercase font-black bg-zinc-800 text-zinc-400 px-2 py-1 rounded">
                    {exerciseStats.get(selectedExercise)!.body_part}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-indigo-400 font-black text-2xl">{convertW(exerciseStats.get(selectedExercise)!.currentORM)}</div>
                  <div className="text-zinc-500 text-xs uppercase font-bold">1RM ({unit})</div>
                </div>
              </div>
            )}

            {selectedExercise === "Todos" && (
               <div className="mb-4 flex items-center gap-2">
                 <Activity className="text-emerald-500" size={20}/>
                 <h2 className="font-bold text-zinc-300">Evolución Global</h2>
               </div>
            )}

            <div className="h-64 w-full mb-4">
              <ResponsiveContainer width="100%" height="100%">
                {selectedExercise === "Todos" ? (
                  <LineChart data={combinedChartData}>
                    <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickMargin={8} />
                    <YAxis stroke="#52525b" fontSize={10} width={30} tickFormatter={(val) => convertW(val).toString()} />
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }} itemStyle={{ fontWeight: 'bold' }} formatter={(val: number) =>[`${convertW(val)} ${unit}`, '1RM']} />
                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                    {registeredExercises.map((ex, i) => (
                      <Line key={ex} type="monotone" dataKey={ex} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    ))}
                  </LineChart>
                ) : (
                  <LineChart data={currentChartData}>
                    <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickMargin={8} />
                    <YAxis stroke="#52525b" fontSize={10} domain={['dataMin - 10', 'dataMax + 10']} hide />
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }} itemStyle={{ color: '#818cf8', fontWeight: 'bold' }} formatter={(val: number) =>[`${convertW(val)} ${unit}`, '1RM']} />
                    <Line type="monotone" dataKey="orm" stroke="#6366f1" strokeWidth={3} dot={{ r: 5, fill: '#09090b', stroke: '#6366f1', strokeWidth: 2 }} activeDot={{ r: 7 }} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* TABLA DE BASE DE DATOS AGRUPADA */}
          <div>
            <h3 className="text-lg font-bold text-zinc-300 mb-4 flex items-center gap-2">
              <Database size={18} className="text-emerald-500" /> Historial de Sets
            </h3>
            
            <div className="space-y-6">
              {Object.entries(logsByMuscleGroup).map(([muscleGroup, groupLogs]) => (
                <div key={muscleGroup} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                  <div className="bg-zinc-950 p-3 border-b border-zinc-800">
                    <h4 className="text-sm font-black text-indigo-400 uppercase tracking-widest pl-2">{muscleGroup}</h4>
                  </div>
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-zinc-900/50 text-zinc-500 text-[10px] uppercase font-black tracking-wider">
                        <tr>
                          <th className="px-4 py-2">Fecha</th>
                          <th className="px-4 py-2">Ejercicio</th>
                          <th className="px-4 py-2">Carga</th>
                          <th className="px-4 py-2 text-right">1RM</th>
                          <th className="px-4 py-2 text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50">
                        {groupLogs.map(log => (
                          <tr key={log.id} className="hover:bg-zinc-800/30 transition-colors">
                            <td className="px-4 py-3 text-zinc-400 text-xs">
                              {log.user_workouts?.date ? new Date(log.user_workouts.date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : 'N/A'}
                            </td>
                            <td className="px-4 py-3 font-medium text-white truncate max-w-[120px] text-xs">
                              {log.exercises?.name}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-white font-mono font-bold text-sm">{convertW(log.weight_lbs)} {unit}</span>
                              <span className="text-zinc-500 ml-1 text-xs">x {log.reps_done}</span>
                            </td>
                            <td className="px-4 py-3 text-indigo-400 font-mono font-bold text-right text-sm">
                              {convertW(Math.round(log.weight_lbs * (1 + log.reps_done / 30)))}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => setSelectedLog(log)}
                                className="inline-flex items-center justify-center p-2 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors"
                                title="Editar registro"
                              >
                                <Edit2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Modal para editar registro */}
      {selectedLog && (
        <EditSetModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
          onUpdate={() => {
            setSelectedLog(null);
            (async () => await fetchHistory())();
          }}
        />
      )}
    </main>
  );
}