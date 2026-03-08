"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
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
  
  // Estados de selección y filtros
  const [selectedExercise, setSelectedExercise] = useState("Todos");
  const [selectedCategory, setSelectedCategory] = useState("Top"); // <-- Nuevo estado para el filtro de categorías

  const [exerciseStats, setExerciseStats] = useState<Map<string, ExerciseStats>>(new Map());
  const [strengthProfileData, setStrengthProfileData] = useState<StrengthProfileDataPoint[]>([]);
  
  const [selectedLog, setSelectedLog] = useState<WorkoutLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState<Unit>("lbs");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const supabase = createClient();

  useEffect(() => {
    const saved = (localStorage.getItem("weightUnit") as Unit) || "lbs";
    if(saved) Promise.resolve().then(() => setUnit(saved));
  }, []);

  const toggleUnit = () => {
    const next = unit === "lbs" ? "kg" : "lbs";
    setUnit(next);
    localStorage.setItem("weightUnit", next);
  };

  const convertW = useCallback((lbs: number) => (unit === "kg" ? Math.round(lbs * 0.453592) : lbs), [unit]);

  const calculateORM = (weight: number, reps: number, rpe: number | null) => {
    const rir = rpe ? (10 - rpe) : 0; 
    const effectiveReps = reps + Math.max(0, rir);
    return Math.round(weight * (1 + effectiveReps / 30));
  };

  // Formatters para tooltips
  const barChartFormatter = useCallback((val: number) => [`${convertW(val)} ${unit}`, '1RM Máximo'], [convertW, unit]);
  const lineChartFormatter = useCallback((val: number) => [`${convertW(val)} ${unit}`, '1RM Est.'], [convertW, unit]);

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (isMounted) setLoading(false); return; }

      const { data, error } = await supabase
        .from("workout_sets")
        .select(`id, weight_lbs, reps_done, rpe_felt, set_type, exercises (name, body_part), user_workouts (date)`)
        .eq("set_type", "Normal") 
        .order("user_workouts(date)", { ascending: false });

      if (!isMounted) return;

      if (!error && data) {
        // Ordenamiento seguro en JS
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
          const mostRecentLog = exLogs[0];
          const lastDateStr = new Date(mostRecentLog.user_workouts.date).toLocaleDateString('es-ES', { timeZone: 'UTC' });

          statsMap.set(exerciseName, { 
            name: exerciseName, body_part: bodyPart, maxWeight, currentORM: currentBestORM, lastDate: lastDateStr, dataPoints: chartPoints 
          });
          
          profileData.push({ name: exerciseName, orm: currentBestORM, part: bodyPart });
        });
        
        setExerciseStats(statsMap);
        setStrengthProfileData(profileData.sort((a, b) => b.orm - a.orm));
      }
      setLoading(false);
    }
    fetchData();
    return () => { isMounted = false; };
  }, [supabase, refreshTrigger]);

  // Calcular datos del gráfico de líneas con useMemo (más eficiente que useEffect + setState)
  const currentChartData = useMemo(() => {
    if (selectedExercise !== "Todos") {
      const stats = exerciseStats.get(selectedExercise);
      return stats ? stats.dataPoints : [];
    }
    return [];
  }, [selectedExercise, exerciseStats]);

  // --- LÓGICA DE FILTRADO PARA BARRAS ---
  const filteredBarData = useMemo(() => {
    if (selectedCategory === "Top") {
      return strengthProfileData.slice(0, 7); // Solo los 7 más fuertes
    }
    // Filtrado inteligente por palabras clave de grupos musculares
    return strengthProfileData.filter(d => {
        const p = d.part.toLowerCase();
        const cat = selectedCategory.toLowerCase();
        
        // Coincidencia directa o grupos relacionados
        if (p.includes(cat)) return true;
        
        if (selectedCategory === "Upper") return ["chest", "back", "shoulders", "triceps", "biceps", "arms"].some(k => p.includes(k));
        if (selectedCategory === "Lower") return ["legs", "hamstrings", "calves", "glutes", "quads"].some(k => p.includes(k));
        
        return false;
    });
  }, [selectedCategory, strengthProfileData]);

  // Cálculo de altura dinámica para que la gráfica crezca si hay muchos items
  const dynamicHeight = Math.max(300, filteredBarData.length * 50);

  // Obtener categorías únicas disponibles
  const availableCategories = useMemo(() => {
      const cats = new Set<string>();
      strengthProfileData.forEach(d => cats.add(d.part));
      return Array.from(cats).sort();
  }, [strengthProfileData]);

  const handleUpdate = () => {
    setRefreshTrigger(prev => prev + 1);
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

          {/* SELECTOR PRINCIPAL */}
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
            
            {/* CABECERA CON FILTROS (Solo visible en modo "Todos") */}
            {selectedExercise === "Todos" ? (
              <>
               <div className="mb-4 flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <BarChart3 className="text-emerald-500" size={20}/>
                    <h2 className="font-bold text-zinc-300">Perfil de Fuerza</h2>
                 </div>
               </div>
               
               {/* PESTAÑAS DE FILTRO */}
               <div className="flex gap-2 overflow-x-auto pb-4 mb-2 custom-scrollbar">
                  <button 
                    onClick={() => setSelectedCategory("Top")}
                    className={`whitespace-nowrap px-3 py-1 rounded-lg text-xs font-bold transition-colors ${selectedCategory === "Top" ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
                  >
                    🏆 Top 7
                  </button>
                  
                  {/* Botones inteligentes Upper/Lower si existen datos */}
                  <button onClick={() => setSelectedCategory("Upper")} className={`whitespace-nowrap px-3 py-1 rounded-lg text-xs font-bold transition-colors ${selectedCategory === "Upper" ? "bg-indigo-500 text-white" : "bg-zinc-800 text-zinc-400"}`}>Upper Body</button>
                  <button onClick={() => setSelectedCategory("Lower")} className={`whitespace-nowrap px-3 py-1 rounded-lg text-xs font-bold transition-colors ${selectedCategory === "Lower" ? "bg-indigo-500 text-white" : "bg-zinc-800 text-zinc-400"}`}>Lower Body</button>

                  {/* Categorías específicas dinámicas */}
                  {availableCategories.map(group => (
                    <button 
                      key={group}
                      onClick={() => setSelectedCategory(group)}
                      className={`whitespace-nowrap px-3 py-1 rounded-lg text-xs font-bold transition-colors ${selectedCategory === group ? "bg-indigo-500 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
                    >
                      {group}
                    </button>
                  ))}
               </div>
              </>
            ) : (
               <div className="flex justify-between items-start mb-6">
                 <div>
                   <h2 className="text-xl font-black text-white pr-2">{exerciseStats.get(selectedExercise)?.name}</h2>
                   <span className="inline-block mt-1 text-[10px] uppercase font-black bg-zinc-800 text-zinc-400 px-2 py-1 rounded">
                     {exerciseStats.get(selectedExercise)?.body_part}
                   </span>
                 </div>
                 <div className="text-right">
                   <div className="text-indigo-400 font-black text-2xl">{convertW(exerciseStats.get(selectedExercise)!.currentORM)}</div>
                   <div className="text-zinc-500 text-xs uppercase font-bold">PR ({unit})</div>
                 </div>
               </div>
            )}

            {/* GRÁFICA DINÁMICA */}
            <div style={{ height: selectedExercise === "Todos" ? dynamicHeight : 300, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                {selectedExercise === "Todos" ? (
                  // VISTA GLOBAL: GRÁFICA DE BARRAS
                  <BarChart 
                    data={filteredBarData} 
                    layout="vertical" 
                    margin={{ left: 0, right: 40, top: 10, bottom: 10 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={100} 
                      tick={{fill: '#a1a1aa', fontSize: 10, fontWeight: 600}} 
                      interval={0}
                    />
                    <Tooltip 
                      cursor={{fill: 'rgba(255,255,255,0.05)'}}
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }} 
                      itemStyle={{ fontWeight: 'bold', color: '#fff' }} 
                      formatter={barChartFormatter} 
                    />
                    <Bar dataKey="orm" radius={[0, 4, 4, 0]} barSize={24}>
                      {filteredBarData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : (
                  // VISTA INDIVIDUAL: GRÁFICA DE LÍNEA
                  <LineChart data={currentChartData}>
                    <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickMargin={8} />
                    <YAxis stroke="#52525b" fontSize={10} domain={['dataMin - 5', 'dataMax + 5']} hide />
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }} itemStyle={{ color: '#818cf8', fontWeight: 'bold' }} formatter={lineChartFormatter} />
                    <Line type="monotone" dataKey="orm" stroke="#6366f1" strokeWidth={3} dot={{ r: 5, fill: '#09090b', stroke: '#6366f1', strokeWidth: 2 }} activeDot={{ r: 7 }} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
            
            {/* MENSAJE SI ESTÁ VACÍO */}
            {selectedExercise === "Todos" && filteredBarData.length === 0 && (
              <p className="text-center text-zinc-500 text-sm py-10">No hay ejercicios en esta categoría.</p>
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