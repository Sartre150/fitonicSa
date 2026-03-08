"use client";

import React, { useState, useRef } from "react";
import { Calendar, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid } from "recharts";

// Interfaces
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
const BAR_COLORS = ["#6366f1", "#8b5cf6", "#d946ef", "#f43f5e", "#f97316", "#eab308", "#10b981", "#06b6d4", "#3b82f6"];

export default function ReportGenerator({ exerciseStats, unit, logs }: ReportGeneratorProps) {
  // Referencia para el contenedor oculto de captura
  const printRef = useRef<HTMLDivElement>(null);
  
  const [period, setPeriod] = useState<ReportPeriod>("month");
  const [isGenerating, setIsGenerating] = useState(false);

  const getDateRange = (period: ReportPeriod) => {
    const today = new Date();
    const startDate = new Date();
    if (period === "week") startDate.setDate(today.getDate() - 7);
    else startDate.setMonth(today.getMonth() - 1);
    return { startDate, todayDate: today };
  };

  const filterDataByPeriod = (period: ReportPeriod): WorkoutLog[] => {
    const { startDate } = getDateRange(period);
    return logs.filter(log => {
      const logDate = new Date(log.user_workouts?.date); 
      return logDate >= startDate;
    });
  };

  const convertW = (lbs: number) => unit === "kg" ? Number((lbs * 0.453592).toFixed(1)) : lbs;

  // --- EXCEL ---
  const generateExcel = () => {
    const filteredLogs = filterDataByPeriod(period);
    const summaryData = Array.from(exerciseStats.values())
      .filter(stats => stats.dataPoints.length > 0)
      .map(stats => ({
        Ejercicio: stats.name,
        "Grupo Muscular": stats.body_part,
        [`1RM Actual (${unit})`]: convertW(stats.currentORM),
        [`PR Histórico (${unit})`]: convertW(stats.maxWeight),
        "Última Sesión": stats.lastDate,
      }));

    const detailData = filteredLogs.map((log: WorkoutLog) => ({
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

  // --- PDF ---
  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      // 1. Esperar a que el contenedor oculto se renderice bien
      // (Le damos un momento para que Recharts calcule tamaños)
      await new Promise(resolve => setTimeout(resolve, 800));

      if (!printRef.current) throw new Error("No se encontró el contenedor de gráficas");

      // 2. Capturar gráficas como imagen de alta calidad (scale reducido para móvil)
      const isMobile = window.innerWidth < 768;
      const canvas = await html2canvas(printRef.current, {
        scale: isMobile ? 1.5 : 2, // Menor resolución en móvil para evitar problemas de memoria
        backgroundColor: '#18181b',
        useCORS: true,
        allowTaint: true,
        logging: false,
        windowWidth: 800, // Forzar ancho consistente
        windowHeight: 600
      });
      const imgData = canvas.toDataURL('image/png');

      // 3. Crear PDF
      const doc = new jsPDF();
      const filteredLogs = filterDataByPeriod(period);
      const { startDate, todayDate } = getDateRange(period);
      const primaryColor: [number, number, number] = [79, 70, 229];
      const bgColor: [number, number, number] = [24, 24, 27];

      // Encabezado
      doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("FITONIC", 14, 18);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("REPORTE DE PROGRESO", 14, 25);
      doc.text(`Generado: ${todayDate.toLocaleDateString("es-ES")}`, 150, 18);
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.text(`Período: ${period === 'week' ? 'Semanal' : 'Mensual'} (${startDate.toLocaleDateString()} - ${todayDate.toLocaleDateString()})`, 14, 50);

      // Insertar Imagen de Gráficas
      const imgWidth = 180;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      doc.addImage(imgData, 'PNG', 15, 60, imgWidth, imgHeight);

      // Tabla Resumen
      let currentY = 60 + imgHeight + 15;
      if (currentY > 250) { doc.addPage(); currentY = 20; }
      
      doc.setFontSize(14);
      doc.text("Resumen de Fuerza (1RM)", 14, currentY);
      
      const summaryRows = Array.from(exerciseStats.values())
        .sort((a,b) => b.currentORM - a.currentORM)
        .slice(0, 15) // Top 15 para no saturar
        .map(stats => [
          stats.name,
          stats.body_part,
          `${convertW(stats.currentORM)} ${unit}`,
          `${convertW(stats.maxWeight)} ${unit}`,
          stats.lastDate
        ]);

      autoTable(doc, {
        startY: currentY + 5,
        head: [['Ejercicio', 'Músculo', '1RM Actual', 'Mejor PR', 'Última Vez']],
        body: summaryRows,
        theme: 'grid',
        headStyles: { fillColor: primaryColor, textColor: 255 },
        styles: { fontSize: 8 },
      });

      currentY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;

      // Tabla Detalle
      if (currentY > 240) { doc.addPage(); currentY = 20; }
      doc.setFontSize(14);
      doc.text("Historial Detallado", 14, currentY);

      const logRows = filteredLogs.map((log: WorkoutLog) => [
        new Date(log.user_workouts?.date).toLocaleDateString("es-ES"),
        log.exercises?.name,
        `${convertW(log.weight_lbs)} ${unit}`,
        log.reps_done,
        log.rpe_felt || "-",
        convertW(Math.round(log.weight_lbs * (1 + log.reps_done / 30)))
      ]);

      autoTable(doc, {
        startY: currentY + 5,
        head: [['Fecha', 'Ejercicio', 'Carga', 'Reps', 'RPE', '1RM']],
        body: logRows,
        theme: 'striped',
        headStyles: { fillColor: [50, 50, 50], textColor: 255 },
        styles: { fontSize: 8 },
      });

      // Compatibilidad móvil: usar blob para descarga
      const pdfBlob = doc.output('blob');
      const fileName = `Fitonic_Reporte_${todayDate.toISOString().split('T')[0]}.pdf`;
      
      // Detectar si es móvil para usar método alternativo de descarga
      if (typeof navigator !== 'undefined' && navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
        try {
          const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
          await navigator.share({ files: [file], title: 'Reporte Fitonic' });
        } catch {
          // Fallback si share falla
          const url = URL.createObjectURL(pdfBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          link.click();
          URL.revokeObjectURL(url);
        }
      } else {
        doc.save(fileName);
      }

    } catch (e) {
      console.error(e);
      alert("Hubo un error al generar el PDF.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Datos para gráficas ocultas (SOLO PARA PDF)
  const barChartData = Array.from(exerciseStats.values())
    .map(stats => ({
      name: stats.name.substring(0, 15) + (stats.name.length>15 ? '...' : ''), // Truncar nombres largos para PDF
      orm: stats.currentORM,
    }))
    .sort((a,b) => b.orm - a.orm)
    .slice(0, 8); // Solo top 8 para que se vea bien en la hoja

  const topExercise = Array.from(exerciseStats.values()).sort((a,b) => b.dataPoints.length - a.dataPoints.length)[0];
  const lineChartData = topExercise ? topExercise.dataPoints : [];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="text-emerald-500" size={20} />
          <h3 className="font-bold text-white">Exportar Datos</h3>
        </div>
        
        <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
          <button onClick={() => setPeriod("week")} className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${period === 'week' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>Semana</button>
          <button onClick={() => setPeriod("month")} className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${period === 'month' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>Mes</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={generateExcel} className="flex items-center justify-center gap-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white py-3 px-4 rounded-xl font-bold text-sm transition-colors border border-emerald-500/20">
          <FileSpreadsheet size={18} /> Excel
        </button>
        <button onClick={generatePDF} disabled={isGenerating} className="flex items-center justify-center gap-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white py-3 px-4 rounded-xl font-bold text-sm transition-colors border border-red-500/20 disabled:opacity-50">
          {isGenerating ? <Loader2 className="animate-spin" /> : <><FileText size={18} /> PDF</>}
        </button>
      </div>

      {/* 
        CONTENEDOR DE CAPTURA (ESTRATEGIA VISIBLE PERO OCULTA)
        En lugar de display:none o left:-9999px que rompe Recharts,
        lo posicionamos absoluto con opacidad 0 y z-index negativo.
        Así el navegador SI lo renderiza geométricamente.
      */}
      <div 
        style={{ 
          position: "absolute", 
          zIndex: -50, 
          opacity: 0, 
          pointerEvents: "none",
          width: "800px", // Ancho fijo para PDF
          top: 0,
          left: 0
        }}
      >
        <div ref={printRef} style={{ backgroundColor: '#18181b', padding: '32px', color: '#ffffff', width: '800px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', textAlign: 'center', color: '#ffffff' }}>Resumen Visual</h2>
          
          <div style={{ display: 'flex', gap: '32px' }}>
            {/* Gráfica de Barras */}
            <div style={{ width: '50%' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center', color: '#a1a1aa' }}>Top Fuerza (1RM)</h3>
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={barChartData} layout="vertical" margin={{ left: 40 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} tick={{fill: '#fff', fontSize: 10}} />
                    <Bar dataKey="orm" radius={[0, 4, 4, 0]}>
                      {barChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfica de Línea */}
            <div style={{ width: '50%' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center', color: '#a1a1aa' }}>Tendencia Principal</h3>
              {topExercise && (
                <>
                  <p style={{ textAlign: 'center', color: '#818cf8', fontWeight: 'bold', marginBottom: '8px' }}>{topExercise.name}</p>
                  <div style={{ width: "100%", height: 260 }}>
                    <ResponsiveContainer>
                      <LineChart data={lineChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                        <YAxis stroke="#71717a" fontSize={10} domain={['auto', 'auto']} />
                        <Line type="monotone" dataKey="orm" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#fff' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}