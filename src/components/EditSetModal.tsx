"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { X, Save, Trash2, Loader2 } from "lucide-react";

interface WorkoutSetLog {
  id: string;
  weight_lbs: number;
  reps_done: number;
  rpe_felt: number | null;
}

interface EditSetModalProps {
  log: WorkoutSetLog;
  onClose: () => void;
  onUpdate: () => void; // Para recargar la gráfica al guardar
}

export default function EditSetModal({ log, onClose, onUpdate }: EditSetModalProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    weight: log.weight_lbs.toString(),
    reps: log.reps_done.toString(),
    rpe: log.rpe_felt?.toString() || ""
  });

  const handleSave = async () => {
    setLoading(true);
    const weightNum = Number(formData.weight);
    const repsNum = Number(formData.reps);
    const rpeNum = formData.rpe ? Number(formData.rpe) : null;

    if (isNaN(weightNum) || isNaN(repsNum)) {
      alert("Por favor ingresa valores válidos para peso y reps");
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from("workout_sets")
      .update({
        weight_lbs: weightNum,
        reps_done: repsNum,
        rpe_felt: rpeNum
      })
      .eq("id", log.id);

    setLoading(false);
    if (!error) {
      onUpdate();
      onClose();
    } else {
      alert("Error al actualizar");
    }
  };

  const handleDelete = async () => {
    if (!confirm("¿Seguro que quieres borrar este registro?")) return;
    setLoading(true);
    const { error } = await supabase.from("workout_sets").delete().eq("id", log.id);
    setLoading(false);
    if (!error) {
      onUpdate();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-zinc-900 w-full max-w-xs rounded-2xl border border-zinc-800 p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-white">Editar Registro</h3>
          <button onClick={onClose}><X className="text-zinc-500" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase text-zinc-500 font-bold">Peso (Lbs)</label>
            <input
              type="number"
              step="0.1"
              value={formData.weight}
              onChange={e => setFormData({...formData, weight: e.target.value})}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs uppercase text-zinc-500 font-bold">Reps</label>
              <input
                type="number"
                step="1"
                value={formData.reps}
                onChange={e => setFormData({...formData, reps: e.target.value})}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white font-mono"
              />
            </div>
            <div>
              <label className="text-xs uppercase text-zinc-500 font-bold">RPE</label>
              <input
                type="number"
                step="0.5"
                value={formData.rpe}
                onChange={e => setFormData({...formData, rpe: e.target.value})}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white font-mono"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleDelete}
            disabled={loading}
            className="p-4 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 size={20} />
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !formData.weight || !formData.reps}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> Guardar</>}
          </button>
        </div>
      </div>
    </div>
  );
}