"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { TrendingUp, ChevronDown, Dumbbell, ArrowRightLeft, BarChart3, Clock } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import EditSetModal from "@/components/EditSetModal";
import ReportGenerator from "@/components/ReportGenerator";
import CalendarHistory from "@/components/CalendarHistory";

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
interface StrengthProfileDataPoint {
  name: string;
  orm: number;
  part: string;
}
interface ExerciseStats {
  name: string;
  body_part: string;
  maxWeight: number;
  currentORM: number;
  lastDate: string;
  dataPoints: ChartPoint[];
}

const BAR_COLORS = ["#6366f1", "#8b5cf6", "#d946ef", "#f43f5e", "#f97316", "#eab308", "#10b981", "#06b6d4", "#3b82f6"];

export default function ProgressPage() {
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [registeredExercises, setRegisteredExercises] = useState<string[]>([]);
  const [selectedExercise, setSelectedExercise] = useState("Todos");
  const [exerciseStats, setExerciseStats] = useState<Map<string, ExerciseStats>>(new Map());
  const [strengthProfileData, setStrengthProfileData] = useState<StrengthProfileDataPoint[]>([]);
  const [currentChartData, setCurrentChartData] = useState<ChartPoint[]>([]);
  const [selectedLog, setSelectedLog] = useState<WorkoutLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState<Unit>("lbs");
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Para forzar recarga
  
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const saved = (localStorage.getItem("weightUnit") as Unit) || "lbs";
      setUnit(saved);
    })();
  }, []);

  const toggleUnit = () => {
    const next = unit === "lbs" ? "kg" : "lbs";
    setUnit(next);
    localStorage.setItem("weightUnit", next);
  };

  const convertW = (lbs: number) => (unit === "kg" ? Math.round(lbs * 0.453592) : lbs);

  const calculateORM = (weight: number, reps: number, rpe: number | null) => {
    const rir = rpe ? (10 - rpe) : 0; 
    const effectiveReps = reps + Math.max(0, rir);
    return Math.round(weight * (1 + effectiveReps / 30));
  };

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        if (isMounted) setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("workout_sets")
        .select(`id, weight_lbs, reps_done, rpe_felt, set_type, exercises (name, body_part), user_workouts (date)`)
        .eq("set_type", "Normal") 
        .order("user_workouts(date)", { ascending: false }); // Intenta ordenar por fecha relacionada, si falla usa JS sort

      if (!isMounted) return;

      if (!error && data) {
        // Ordenamiento manual en JS por seguridad
        const typedData = (data as unknown as WorkoutLog[]).sort((a, b) => 
          new Date(b.user_workouts.date).getTime() - new Date(a.user_workouts.date).getTime()
        );
        
        setLogs(typedData);

        const uniqueEx = Array.from(new Set(typedData.map(l => l.exercises?.name).filter(Boolean)));
        setRegisteredExercises(uniqueEx);

        const statsMap = new Map<string, ExerciseStats>();
        const profileData: StrengthProfileDataPoint[] = [];

        uniqueEx.forEach(exerciseName => {
          const exLogs = typedData.filter(l => l.exercises?.name === exerciseName);
          if(exLogs.length === 0) return;

          const bodyPart = exLogs[0].exercises.body_part || "Otros";
          const bestPerDayMap = new Map<string, number>();
          
          exLogs.forEach(l => {
            if (!l.user_workouts?.date) return;
            const rawDate = l.user_workouts.date; 
            const orm = calculateORM(l.weight_lbs, l.reps_done, l.rpe_felt);
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
          const currentBestORM = Math.max(...chartPoints.map(p => p.orm)); 
          
          // Encuentra el log más reciente para la fecha
          const mostRecentLog = exLogs[0]; // Ya están ordenados
          const lastDateStr = new Date(mostRecentLog.user_workouts.date).toLocaleDateString('es-ES', { timeZone: 'UTC' });

          statsMap.set(exerciseName, { 
            name: exerciseName, 
            body_part: bodyPart, 
            maxWeight, 
            currentORM: currentBestORM, 
            lastDate: lastDateStr, 
            dataPoints: chartPoints 
          });
          
          profileData.push({
            name: exerciseName,
            orm: currentBestORM,
            part: bodyPart
          });
        });
        
        setExerciseStats(statsMap);
        setStrengthProfileData(profileData.sort((a, b) => b.orm - a.orm));
      }
      
      setLoading(false);
    }

    fetchData();

    return () => { isMounted = false; };
  }, [supabase, refreshTrigger]); // Dependencia en refreshTrigger para recargar

  // Actualizar datos de gráfica cuando cambia la selección o stats
  useEffect(() => {
    (async () => {
      if (selectedExercise !== "Todos") {
        const stats = exerciseStats.get(selectedExercise);
        setCurrentChartData(stats ? stats.dataPoints : []);
      }
    })();
  }, [selectedExercise, exerciseStats]);

  const handleUpdate = () => {
    setRefreshTrigger(prev => prev + 1); // Forzar recarga
    setSelectedLog(null);
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 p-6 pb-24">
      <header className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-2">
            <TrendingUp className="text-indigo-500" /> Progreso
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Análisis de rendimiento</p>
        </div>
        <button onClick={toggleUnit} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-xl text-sm font-bold hover:bg-zinc-800 transition-colors text-indigo-400">
          {unit.toUpperCase()} <ArrowRightLeft size={14} />
        </button>
      </header>

      {loading ? (
        <div className="text-center text-zinc-500 py-10 animate-pulse font-bold">Cargando datos...</div>
      ) : registeredExercises.length === 0 ? (
         <div className="text-center text-zinc-500 mt-20 p-8 border border-dashed border-zinc-800 rounded-3xl">
            <Dumbbell className="mx-auto mb-4 opacity-50" size={40} />
            <p>Sin registros aún.</p>
            <p className="text-xs mt-2">Completa tu primer entrenamiento para ver estadísticas.</p>
         </div>
      ) : (
        <>
          <ReportGenerator exerciseStats={exerciseStats} unit={unit} logs={logs} />

          <div className="relative mb-6">
            <select 
              value={selectedExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 text-white font-bold py-4 px-4 rounded-2xl appearance-none focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
            >
              <option value="Todos">🌐 Perfil de Fuerza (Comparativa)</option>
              {registeredExercises.map(ex => (
                <option key={ex} value={ex}>📈 {ex}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-5 text-zinc-500 pointer-events-none" size={20} />
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-6 rounded-3xl mb-8">
            <div className="flex justify-between items-start mb-6">
              {selectedExercise === "Todos" ? (
                 <div>
                   <h2 className="text-lg font-black text-white flex items-center gap-2">
                     <BarChart3 className="text-emerald-500" size={20}/>
                     Perfil de Fuerza Actual
                   </h2>
                   <p className="text-zinc-500 text-xs mt-1">Comparativa de tu 1RM en todos tus ejercicios</p>
                 </div>
              ) : (
                 <div>
                   <h2 className="text-xl font-black text-white pr-2">{exerciseStats.get(selectedExercise)?.name}</h2>
                   <span className="inline-block mt-1 text-[10px] uppercase font-black bg-zinc-800 text-zinc-400 px-2 py-1 rounded">
                     {exerciseStats.get(selectedExercise)?.body_part}
                   </span>
                 </div>
              )}

              {selectedExercise !== "Todos" && exerciseStats.has(selectedExercise) && (
                <div className="text-right">
                  <div className="text-indigo-400 font-black text-2xl">
                    {convertW(exerciseStats.get(selectedExercise)!.currentORM)}
                  </div>
                  <div className="text-zinc-500 text-xs uppercase font-bold">PR ({unit})</div>
                </div>
              )}
            </div>

            <div className="h-64 w-full mb-2">
              <ResponsiveContainer width="100%" height="100%">
                {selectedExercise === "Todos" ? (
                  <BarChart data={strengthProfileData} layout="vertical" margin={{ left: 0, right: 30 }}>
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={100} 
                      tick={{fill: '#a1a1aa', fontSize: 10, fontWeight: 600}} 
                      interval={0}
                    />
                    <Tooltip 
                      cursor={{fill: 'transparent'}}
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }} 
                      itemStyle={{ fontWeight: 'bold', color: '#fff' }} 
                      formatter={(val: number) => [`${convertW(val)} ${unit}`, '1RM Máximo']} 
                    />
                    <Bar dataKey="orm" radius={[0, 4, 4, 0]} barSize={20}>
                      {strengthProfileData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : (
                  <LineChart data={currentChartData}>
                    <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickMargin={8} />
                    <YAxis stroke="#52525b" fontSize={10} domain={['dataMin - 5', 'dataMax + 5']} hide />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }} 
                      itemStyle={{ color: '#818cf8', fontWeight: 'bold' }} 
                      formatter={(val: number) => [`${convertW(val)} ${unit}`, '1RM Est.']} 
                    />
                    <Line type="monotone" dataKey="orm" stroke="#6366f1" strokeWidth={3} dot={{ r: 5, fill: '#09090b', stroke: '#6366f1', strokeWidth: 2 }} activeDot={{ r: 7 }} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
            
            {selectedExercise === "Todos" && (
              <p className="text-center text-[10px] text-zinc-600 mt-2">
                *Mostrando tu mejor desempeño histórico en cada levantamiento.
              </p>
            )}
          </div>

          <div className="mb-6 flex items-center gap-2">
             <Clock className="text-emerald-500" size={24}/>
             <h2 className="text-xl font-black text-white">Diario de Entrenamiento</h2>
          </div>
          
          <CalendarHistory logs={logs} unit={unit} onEdit={(log) => setSelectedLog(log)} />
        </>
      )}

      {selectedLog && (
        <EditSetModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
          onUpdate={handleUpdate}
        />
      )}
    </main>
  );
}