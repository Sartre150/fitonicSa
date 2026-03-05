"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { X, Save, Trash2, Loader2 } from "lucide-react";

interface WorkoutLog {
  id: string;
  weight_lbs: number;
  reps_done: number;
  rpe_felt: number | null;
  set_type: string;
  exercises: { name: string; body_part: string; };
  user_workouts: { date: string; };
}

interface EditSetModalProps {
  log: WorkoutLog;
  onClose: () => void;
  onUpdate: () => void;
}

export default function EditSetModal({ log, onClose, onUpdate }: EditSetModalProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  
  // Estado local para los inputs (como strings para compatibilidad con inputs HTML)
  const [weight, setWeight] = useState(log.weight_lbs.toString());
  const [reps, setReps] = useState(log.reps_done.toString());
  const [rpe, setRpe] = useState(log.rpe_felt?.toString() || "");

  const handleSave = async () => {
    setLoading(true);
    
    // Validación
    const parsedWeight = parseFloat(weight);
    const parsedReps = parseInt(reps);
    const parsedRpe = rpe ? parseFloat(rpe) : null;

    if (isNaN(parsedWeight) || isNaN(parsedReps)) {
      alert("Por favor, ingresa valores válidos");
      setLoading(false);
      return;
    }
    
    // UPDATE directo a la tabla workout_sets
    const { error } = await supabase
      .from("workout_sets")
      .update({
        weight_lbs: parsedWeight,
        reps_done: parsedReps,
        rpe_felt: parsedRpe
      })
      .eq("id", log.id);

    setLoading(false);

    if (error) {
      console.error("Error al editar:", error);
      alert("No se pudo guardar el cambio.");
    } else {
      onUpdate();
      onClose();
    }
  };

  const handleDelete = async () => {
    if (!confirm("¿Seguro que quieres borrar este set?")) return;
    setLoading(true);

    const { error } = await supabase
      .from("workout_sets")
      .delete()
      .eq("id", log.id);

    setLoading(false);

    if (error) {
      alert("Error al borrar.");
    } else {
      onUpdate();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-zinc-900 w-full max-w-sm rounded-3xl border border-zinc-800 p-6 shadow-2xl">
        
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-white text-lg">Editar Registro</h3>
          <button onClick={onClose} className="bg-zinc-800 p-2 rounded-full text-zinc-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase text-zinc-500 font-bold ml-1 mb-1 block">Carga (LBS)</label>
            <input 
              type="number" 
              value={weight} 
              onChange={(e) => setWeight(e.target.value)}
              step="0.1"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white font-mono text-lg focus:border-indigo-500 outline-none" 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs uppercase text-zinc-500 font-bold ml-1 mb-1 block">Reps</label>
              <input 
                type="number" 
                value={reps} 
                onChange={(e) => setReps(e.target.value)}
                step="1"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white font-mono text-lg focus:border-indigo-500 outline-none" 
              />
            </div>
            <div>
              <label className="text-xs uppercase text-zinc-500 font-bold ml-1 mb-1 block">RPE</label>
              <input 
                type="number" 
                value={rpe} 
                onChange={(e) => setRpe(e.target.value)}
                step="0.5"
                placeholder="-"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white font-mono text-lg focus:border-indigo-500 outline-none" 
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button 
            onClick={handleDelete} 
            className="bg-red-500/10 text-red-500 p-4 rounded-xl hover:bg-red-500 hover:text-white transition-colors"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
          </button>
          
          <button 
            onClick={handleSave} 
            disabled={loading}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : <><Save size={20} /> Guardar Cambios</>}
          </button>
        </div>

      </div>
    </div>
  );
}