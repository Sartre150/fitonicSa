"use client";

import { useMemo } from "react";
import { Calendar, Edit2 } from "lucide-react";

type Unit = "lbs" | "kg";

interface WorkoutLog {
  id: string;
  weight_lbs: number;
  reps_done: number;
  rpe_felt: number | null;
  set_type: string;
  exercises: { name: string; body_part: string };
  user_workouts: { date: string };
}

interface CalendarHistoryProps {
  logs: WorkoutLog[];
  unit: Unit;
  onEdit: (log: WorkoutLog) => void;
}

export default function CalendarHistory({ logs, unit, onEdit }: CalendarHistoryProps) {
  
  const convertW = (lbs: number) => (unit === "kg" ? Math.round(lbs * 0.453592) : lbs);

  // Lógica Maestra de Agrupación: Fecha -> Músculo -> Sets
  const historyData = useMemo(() => {
    const groupedByDate: Record<string, Record<string, WorkoutLog[]>> = {};

    // 1. Ordenar por fecha descendente (Lo más nuevo arriba)
    const sortedLogs = [...logs].sort((a, b) => 
      new Date(b.user_workouts.date).getTime() - new Date(a.user_workouts.date).getTime()
    );

    sortedLogs.forEach((log) => {
      // Formato de fecha seguro (UTC para evitar desfase de días)
      const dateKey = log.user_workouts.date; 
      const muscleKey = log.exercises?.body_part || "Otros";

      if (!groupedByDate[dateKey]) groupedByDate[dateKey] = {};
      if (!groupedByDate[dateKey][muscleKey]) groupedByDate[dateKey][muscleKey] = [];

      groupedByDate[dateKey][muscleKey].push(log);
    });

    return groupedByDate;
  }, [logs]);

  if (Object.keys(historyData).length === 0) {
    return (
      <div className="text-center py-10 opacity-50">
        <p>No hay historial disponible.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 relative">
      {/* Línea de tiempo decorativa a la izquierda */}
      <div className="absolute left-[19px] top-4 bottom-0 w-0.5 bg-zinc-800/50 z-0"></div>

      {Object.entries(historyData).map(([date, muscles]) => {
        // Formatear fecha bonita: "Miércoles, 4 de Marzo"
        const dayName = new Date(date).toLocaleDateString("es-ES", { weekday: "long", timeZone: "UTC" });
        const dayNumber = new Date(date).toLocaleDateString("es-ES", { day: "numeric", timeZone: "UTC" });
        const monthName = new Date(date).toLocaleDateString("es-ES", { month: "long", timeZone: "UTC" });

        return (
          <div key={date} className="relative z-10 animate-in slide-in-from-bottom-4 duration-500">
            
            {/* CABECERA DEL DÍA (CALENDARIO) */}
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-zinc-900 border border-zinc-700 w-10 h-10 rounded-full flex items-center justify-center shadow-lg shadow-black/50">
                <Calendar size={18} className="text-indigo-400" />
              </div>
              <div>
                <h3 className="text-xl font-black capitalize text-white leading-none">
                  {dayName} <span className="text-indigo-500">{dayNumber}</span>
                </h3>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{monthName}</p>
              </div>
            </div>

            {/* CONTENIDO DEL DÍA (Tarjetas por Músculo) */}
            <div className="ml-5 pl-6 border-l-2 border-transparent space-y-4">
              
              {Object.entries(muscles).map(([muscle, muscleLogs]) => (
                <div key={muscle} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                  {/* Título Músculo */}
                  <div className="bg-zinc-950/50 px-4 py-2 border-b border-zinc-800 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-xs font-black uppercase text-zinc-400 tracking-wider">
                      {muscle}
                    </span>
                  </div>
                  {/* Tabla de Sets con slider horizontal */}
                  <div className="p-1 w-full overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900">
                    <table className="min-w-[400px] sm:min-w-[500px] md:min-w-[600px] text-left text-sm">
                      <thead className="text-[10px] uppercase text-zinc-600 font-bold">
                        <tr>
                          <th className="px-4 py-2 pl-4 whitespace-nowrap">Ejercicio</th>
                          <th className="px-2 py-2 text-center whitespace-nowrap">Peso ({unit})</th>
                          <th className="px-2 py-2 text-center whitespace-nowrap">Reps</th>
                          <th className="px-2 py-2 text-center whitespace-nowrap">1RM ({unit})</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50">
                        {muscleLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-zinc-800/30 transition-colors group">
                            <td className="px-4 py-3 font-medium text-white pl-4 whitespace-nowrap">
                              {log.exercises.name}
                            </td>
                            <td className="px-2 py-3 text-center whitespace-nowrap">
                              <span className="bg-zinc-800 text-white px-2 py-1 rounded-md text-xs font-mono font-bold">
                                {convertW(log.weight_lbs)} {unit}
                              </span>
                            </td>
                            <td className="px-2 py-3 text-center text-zinc-400 text-xs font-mono whitespace-nowrap">
                              {log.reps_done}
                            </td>
                            <td className="px-2 py-3 text-center text-indigo-400 text-xs font-mono font-bold whitespace-nowrap">
                              {convertW(Math.round(log.weight_lbs * (1 + log.reps_done / 30)))} {unit}
                            </td>
                            <td className="pr-2 text-right">
                              <button 
                                onClick={() => onEdit(log)}
                                className="p-1.5 text-zinc-600 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
                              >
                                <Edit2 size={12} />
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
        );
      })}
    </div>
  );
}