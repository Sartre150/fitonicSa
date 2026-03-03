"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/utils/supabase";
import { TrendingUp, ChevronDown, Database, Activity, Dumbbell } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface Exercise { name: string; body_part: string; }
interface UserWorkout { date: string; }
interface WorkoutLog {
  id: string;
  weight_lbs: number;
  reps_done: number;
  rpe_felt: number | null;
  set_type: string;
  exercises: Exercise;
  user_workouts: UserWorkout;
}

interface ChartPoint {
  date: string;
  orm: number;
}

interface ExerciseStats {
  name: string;
  body_part: string;
  maxWeight: number;
  currentORM: number;
  lastDate: string;
  dataPoints: ChartPoint[];
}

interface CombinedChartPoint {
  date: string;[key: string]: number | string;
}

const COLORS =["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#ef4444", "#06b6d4", "#f97316"];

export default function ProgressPage() {
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [registeredExercises, setRegisteredExercises] = useState<string[]>([]);
  const[selectedExercise, setSelectedExercise] = useState("Todos");
  const [exerciseStats, setExerciseStats] = useState<Map<string, ExerciseStats>>(new Map());
  
  const[currentChartData, setCurrentChartData] = useState<ChartPoint[]>([]);
  const [combinedChartData, setCombinedChartData] = useState<CombinedChartPoint[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState<'lbs' | 'kg'>('lbs');
  const supabase = createClient();

  // Cargar unidad del localStorage al montar
  useEffect(() => {
    (async () => {
      const savedUnit = (localStorage.getItem('weightUnit') as 'lbs' | 'kg') || 'lbs';
      setUnit(savedUnit);
    })();
  }, []);

  const handleUnitChange = (newUnit: 'lbs' | 'kg') => {
    setUnit(newUnit);
    localStorage.setItem('weightUnit', newUnit);
  };

  const convertWeight = (weightLbs: number): number => {
    return unit === 'kg' ? Number((weightLbs * 0.453592).toFixed(1)) : weightLbs;
  };

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Traemos logs (SOLO NORMAL SETS)
    const { data, error } = await supabase
      .from("workout_sets")
      .select(`id, weight_lbs, reps_done, rpe_felt, set_type, exercises (name, body_part), user_workouts (date)`)
      .eq("set_type", "Normal")
      .order("id", { ascending: false });

    if (!error && data) {
      const typedData = data as unknown as WorkoutLog[];
      setLogs(typedData);

      // 1. Descubrir qué ejercicios se han registrado realmente
      const uniqueExercises = Array.from(new Set(typedData.map(l => l.exercises?.name).filter(Boolean)));
      setRegisteredExercises(uniqueExercises);

      const stats = new Map<string, ExerciseStats>();

      // 2. Procesar datos POR DÍA para cada ejercicio
      uniqueExercises.forEach(exerciseName => {
        const exerciseLogs = typedData.filter(l => l.exercises?.name === exerciseName);
        if(exerciseLogs.length === 0) return;

        const bodyPart = exerciseLogs[0].exercises.body_part || "N/A";

        // Agrupar por fecha para encontrar el MEJOR set de cada día (Récord Diario)
        const bestPerDayMap = new Map<string, number>();
        
        exerciseLogs.forEach(l => {
          if (!l.user_workouts?.date) return; // Proteger por si no hay fecha
          
          // Guardamos la fecha tal cual (YYYY-MM-DD) para ordenar bien después
          const rawDate = l.user_workouts.date; 
          const orm = Math.round(l.weight_lbs * (1 + l.reps_done / 30));
          
          if (!bestPerDayMap.has(rawDate) || orm > bestPerDayMap.get(rawDate)!) {
            bestPerDayMap.set(rawDate, orm);
          }
        });

        // Convertir el mapa en un array, ordenarlo de viejo a nuevo, y formatear la fecha
        const chartPoints: ChartPoint[] = Array.from(bestPerDayMap.entries())
          .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()) // Orden Cronológico
          .map(([rawDate, orm]) => ({
            date: new Date(rawDate).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
            orm
          }));

        const maxWeight = Math.max(...exerciseLogs.map(l => l.weight_lbs));
        const currentORM = chartPoints[chartPoints.length - 1]?.orm || 0;
        
        // Obtener fecha del log más reciente
        const mostRecentRawDate = exerciseLogs.reduce((a, b) => 
          new Date(a.user_workouts.date) > new Date(b.user_workouts.date) ? a : b
        ).user_workouts.date;
        const lastDateStr = new Date(mostRecentRawDate).toLocaleDateString('es-ES', { timeZone: 'UTC' });

        stats.set(exerciseName, {
          name: exerciseName,
          body_part: bodyPart,
          maxWeight,
          currentORM,
          lastDate: lastDateStr,
          dataPoints: chartPoints,
        });
      });
      
      setExerciseStats(stats);

      // 3. Procesar datos para la Gráfica Global (Todos los registrados)
      const allDatesRaw = Array.from(new Set(typedData.map(l => l.user_workouts?.date).filter(Boolean)))
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime()); // Cronológico

      const combined = allDatesRaw.map(rawDate => {
        const formattedDate = new Date(rawDate).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', timeZone: 'UTC' });
        const point: CombinedChartPoint = { date: formattedDate };
        
        uniqueExercises.forEach(ex => {
          const statData = stats.get(ex);
          if (statData) {
            // Buscar si en esta fecha formateada hubo un registro
            const dayPoint = statData.dataPoints.find(p => p.date === formattedDate);
            if (dayPoint) {
              point[ex] = dayPoint.orm;
            }
          }
        });
        return point;
      });
      
      setCombinedChartData(combined);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { (async () => fetchHistory())(); }, [fetchHistory]);

  useEffect(() => {
    (async () => {
      if (selectedExercise !== "Todos") {
        const stats = exerciseStats.get(selectedExercise);
        setCurrentChartData(stats ? stats.dataPoints : []);
      }
    })();
  },[selectedExercise, exerciseStats]);

  // Agrupar los logs para la base de datos visual
  const logsByMuscleGroup = useMemo(() => {
    const grouped: Record<string, WorkoutLog[]> = {};
    logs.forEach(log => {
      const group = log.exercises?.body_part || "Otros";
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(log);
    });
    return grouped;
  }, [logs]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 p-6 pb-24">
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black flex items-center gap-2">
              <TrendingUp className="text-indigo-500" /> Progreso
            </h1>
            <p className="text-zinc-500 text-sm mt-1">Tu evolución real, día por día</p>
          </div>
          <button
            onClick={() => handleUnitChange(unit === 'lbs' ? 'kg' : 'lbs')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm"
          >
            {unit === 'lbs' ? 'lbs → kg' : 'kg → lbs'}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="text-center text-zinc-500 py-10 animate-pulse font-bold">Cargando métricas...</div>
      ) : registeredExercises.length === 0 ? (
         <div className="text-center text-zinc-500 mt-20 p-8 border border-dashed border-zinc-800 rounded-3xl">
            <Dumbbell className="mx-auto mb-4 opacity-50" size={40} />
            <p>No has registrado ningún ejercicio aún.</p>
            <p className="text-xs mt-2">¡Ve a la pestaña de Rutina y trackea tu primer set (Normal)!</p>
         </div>
      ) : (
        <>
          {/* SELECTOR DE EJERCICIO (Solo los que existen) */}
          <div className="relative mb-6">
            <select 
              value={selectedExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 text-white font-bold py-4 px-4 rounded-2xl appearance-none focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
            >
              <option value="Todos">🌐 Vista Global ({registeredExercises.length} Ejercicios)</option>
              {registeredExercises.map(ex => (
                <option key={ex} value={ex}>{ex}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-5 text-zinc-500 pointer-events-none" size={20} />
          </div>

          {/* GRÁFICA */}
          <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-6 rounded-3xl mb-8">
            
            {selectedExercise !== "Todos" && exerciseStats.has(selectedExercise) && (
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-black text-white pr-2 leading-tight">
                    {exerciseStats.get(selectedExercise)!.name}
                  </h2>
                  <span className="inline-block mt-1 text-[10px] uppercase font-black bg-zinc-800 text-zinc-300 px-2 py-1 rounded">
                    {exerciseStats.get(selectedExercise)!.body_part}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-indigo-400 font-black text-2xl">{convertWeight(exerciseStats.get(selectedExercise)!.currentORM)}</div>
                  <div className="text-zinc-500 text-xs uppercase font-bold">1RM ({unit})</div>
                </div>
              </div>
            )}

            {selectedExercise === "Todos" && (
               <div className="mb-4 flex items-center gap-2">
                 <Activity className="text-emerald-500" size={20}/>
                 <h2 className="font-bold text-zinc-300">Evolución Global (1RM)</h2>
               </div>
            )}

            <div className="h-64 w-full mb-4">
              <ResponsiveContainer width="100%" height="100%">
                {selectedExercise === "Todos" ? (
                  <LineChart data={combinedChartData}>
                    <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickMargin={8} />
                    <YAxis stroke="#52525b" fontSize={10} width={30} />
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }} itemStyle={{ fontWeight: 'bold' }} />
                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                    {registeredExercises.map((ex, i) => (
                      <Line key={ex} type="monotone" dataKey={ex} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    ))}
                  </LineChart>
                ) : (
                  <LineChart data={currentChartData}>
                    <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickMargin={8} />
                    <YAxis stroke="#52525b" fontSize={10} domain={['dataMin - 10', 'dataMax + 10']} hide />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                      itemStyle={{ color: '#818cf8', fontWeight: 'bold' }}
                      formatter={(value: number) =>[`${convertWeight(value)} ${unit}`, '1RM']}
                    />
                    <Line type="monotone" dataKey="orm" stroke="#6366f1" strokeWidth={3} dot={{ r: 5, fill: '#09090b', stroke: '#6366f1', strokeWidth: 2 }} activeDot={{ r: 7 }} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
            
            {selectedExercise !== "Todos" && exerciseStats.has(selectedExercise) && (
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800">
                <div>
                  <p className="text-zinc-500 text-xs uppercase font-bold">Máximo Absoluto</p>
                  <p className="text-indigo-400 font-black text-lg">{convertWeight(exerciseStats.get(selectedExercise)!.maxWeight)} {unit}</p>
                </div>
                <div className="text-right">
                  <p className="text-zinc-500 text-xs uppercase font-bold">Días Entrenados</p>
                  <p className="text-emerald-400 font-black text-lg">{exerciseStats.get(selectedExercise)!.dataPoints.length}</p>
                </div>
              </div>
            )}
          </div>

          {/* BASE DE DATOS AGRUPADA POR MÚSCULO */}
          <div>
            <h3 className="text-lg font-bold text-zinc-300 mb-4 flex items-center gap-2">
              <Database size={18} className="text-emerald-500" /> Registros por Grupo Muscular
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
                          <th className="px-4 py-2">1RM</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50">
                        {groupLogs.map(log => (
                          <tr key={log.id} className="hover:bg-zinc-800/30 transition-colors">
                            <td className="px-4 py-3 text-zinc-400">
                              {/* Agregué {timeZone: 'UTC'} para que no haya desfasaje de días por la zona horaria */}
                              {log.user_workouts?.date ? new Date(log.user_workouts.date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : 'N/A'}
                            </td>
                            <td className="px-4 py-3 font-medium text-white truncate max-w-[120px]">
                              {log.exercises?.name}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-white font-mono font-bold">{convertWeight(log.weight_lbs)} {unit}</span>
                              <span className="text-zinc-500 ml-1 text-xs">x {log.reps_done}</span>
                            </td>
                            <td className="px-4 py-3 text-indigo-400 font-mono font-bold">
                              {convertWeight(Math.round(log.weight_lbs * (1 + log.reps_done / 30)))}
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
    </main>
  );
}