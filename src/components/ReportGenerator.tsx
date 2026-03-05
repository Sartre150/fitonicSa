"use client";

import { useState } from "react";
import { Calendar, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable"; // <-- IMPORTANTE: Importar el plugin
import * as XLSX from "xlsx";

// Interfaces reutilizadas para mantener consistencia
interface ChartPoint { date: string; orm: number }
interface ExerciseStats {
  name: string;
  body_part: string;
  maxWeight: number;
  currentORM: number;
  lastDate: string;
  dataPoints: ChartPoint[];
}
interface WorkoutLog {
  id: string;
  weight_lbs: number;
  reps_done: number;
  rpe_felt: number | null;
  set_type: string;
  exercises: { name: string; body_part: string; };
  user_workouts: { date: string; };
}

interface ReportGeneratorProps {
  exerciseStats: Map<string, ExerciseStats>;
  unit: "lbs" | "kg";
  logs: WorkoutLog[];
}

type ReportPeriod = "week" | "month";

export default function ReportGenerator({ exerciseStats, unit, logs }: ReportGeneratorProps) {
  const [period, setPeriod] = useState<ReportPeriod>("month");
  const [isGenerating, setIsGenerating] = useState(false);

  const getDateRange = (period: ReportPeriod) => {
    const today = new Date();
    const startDate = new Date();
    if (period === "week") startDate.setDate(today.getDate() - 7);
    else startDate.setMonth(today.getMonth() - 1);
    return { startDate, todayDate: today };
  };

  const filterDataByPeriod = (period: ReportPeriod) => {
    const { startDate } = getDateRange(period);
    // Filtrar logs por fecha
    return logs.filter(log => {
      // Aseguramos compatibilidad de fechas
      const logDate = new Date(log.user_workouts?.date); 
      // Ajuste simple para comparar solo fechas sin horas
      return logDate >= startDate;
    });
  };

  const convertW = (lbs: number) => unit === "kg" ? Number((lbs * 0.453592).toFixed(1)) : lbs;

  // --- GENERAR EXCEL ---
  const generateExcel = () => {
    const filteredLogs = filterDataByPeriod(period);

    // Hoja 1: Resumen
    const summaryData = Array.from(exerciseStats.values())
      .filter(stats => stats.dataPoints.length > 0)
      .map(stats => ({
        Ejercicio: stats.name,
        "Grupo Muscular": stats.body_part,
        [`1RM Actual (${unit})`]: convertW(stats.currentORM),
        [`PR Histórico (${unit})`]: convertW(stats.maxWeight),
        "Última Sesión": stats.lastDate,
      }));

    // Hoja 2: Detalles
    const detailData = filteredLogs.map(log => ({
      Fecha: new Date(log.user_workouts?.date).toLocaleDateString("es-ES"),
      Ejercicio: log.exercises?.name || "N/A",
      Grupo: log.exercises?.body_part || "N/A",
      [`Carga (${unit})`]: convertW(log.weight_lbs),
      Reps: log.reps_done,
      RPE: log.rpe_felt || "-",
      [`1RM Est. (${unit})`]: convertW(Math.round(log.weight_lbs * (1 + log.reps_done / 30))),
    }));

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(summaryData);
    const ws2 = XLSX.utils.json_to_sheet(detailData);

    XLSX.utils.book_append_sheet(wb, ws1, "Resumen");
    XLSX.utils.book_append_sheet(wb, ws2, "Historial Completo");

    XLSX.writeFile(wb, `Fitonic_Reporte_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // --- GENERAR PDF PREMIUM ---
  const generatePDF = () => {
    setIsGenerating(true);
    try {
      const filteredLogs = filterDataByPeriod(period);
      const { startDate, todayDate } = getDateRange(period);
      const doc = new jsPDF();

      // Colores de la marca (Fitonic Dark)
      const primaryColor = [79, 70, 229] as [number, number, number]; // Indigo
      const bgColor = [24, 24, 27] as [number, number, number]; // Zinc 900

      // Encabezado
      doc.setFillColor(...bgColor);
      doc.rect(0, 0, 210, 40, 'F'); // Barra negra arriba
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("FITONIC", 14, 18);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("REPORTE DE PROGRESO", 14, 25);

      doc.text(`Generado: ${todayDate.toLocaleDateString("es-ES")}`, 150, 18);
      doc.text(`Unidad: ${unit.toUpperCase()}`, 150, 25);

      // Info del Periodo
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.text(`Período analizado: ${period === 'week' ? 'Última Semana' : 'Último Mes'}`, 14, 50);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Desde ${startDate.toLocaleDateString()} hasta ${todayDate.toLocaleDateString()}`, 14, 56);

      // Tabla 1: Resumen de Fuerza (1RM)
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text("Resumen de Fuerza (1RM)", 14, 70);

      const summaryRows = Array.from(exerciseStats.values()).map(stats => [
        stats.name,
        stats.body_part,
        `${convertW(stats.currentORM)} ${unit}`,
        `${convertW(stats.maxWeight)} ${unit}`,
        stats.lastDate
      ]);

      autoTable(doc, {
        startY: 75,
        head: [['Ejercicio', 'Músculo', '1RM Actual', 'Mejor PR', 'Última Vez']],
        body: summaryRows,
        theme: 'grid',
        headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 3 },
        alternateRowStyles: { fillColor: [245, 247, 250] }
      });

      // @ts-expect-error (Para obtener la posición Y final de la tabla anterior)
      const finalY = (doc.lastAutoTable as unknown as { finalY: number }).finalY + 15;

      // Tabla 2: Historial Detallado
      doc.setFontSize(14);
      doc.text("Historial Detallado de Sets", 14, finalY);

      const logRows = filteredLogs.map(log => [
        new Date(log.user_workouts?.date).toLocaleDateString("es-ES"),
        log.exercises?.name,
        `${convertW(log.weight_lbs)} ${unit}`,
        log.reps_done,
        log.rpe_felt || "-",
        convertW(Math.round(log.weight_lbs * (1 + log.reps_done / 30)))
      ]);

      autoTable(doc, {
        startY: finalY + 5,
        head: [['Fecha', 'Ejercicio', 'Carga', 'Reps', 'RPE', '1RM Est.']],
        body: logRows,
        theme: 'striped',
        headStyles: { fillColor: [50, 50, 50], textColor: 255 },
        styles: { fontSize: 8 },
      });

      // Pie de página
      const pageCount = doc.getNumberOfPages();
      for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Página ${i} de ${pageCount} - Generado por Fitonic App`, 105, 290, { align: "center" });
      }

      doc.save(`Fitonic_Reporte_${todayDate.toISOString().split('T')[0]}.pdf`);

    } catch (e) {
      console.error(e);
      alert("Error al generar PDF. Intenta de nuevo.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="text-emerald-500" size={20} />
          <h3 className="font-bold text-white">Exportar Datos</h3>
        </div>
        
        {/* Selector Periodo */}
        <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
          <button 
            onClick={() => setPeriod("week")}
            className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${period === 'week' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
          >
            Semana
          </button>
          <button 
            onClick={() => setPeriod("month")}
            className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${period === 'month' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
          >
            Mes
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={generateExcel}
          className="flex items-center justify-center gap-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white py-3 px-4 rounded-xl font-bold text-sm transition-colors border border-emerald-500/20"
        >
          <FileSpreadsheet size={18} /> Excel
        </button>
        <button
          onClick={generatePDF}
          disabled={isGenerating}
          className="flex items-center justify-center gap-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white py-3 px-4 rounded-xl font-bold text-sm transition-colors border border-red-500/20 disabled:opacity-50"
        >
          {isGenerating ? <Loader2 className="animate-spin" /> : <><FileText size={18} /> PDF</>}
        </button>
      </div>
    </div>
  );
}