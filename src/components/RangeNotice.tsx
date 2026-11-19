// Small notice shown on report screens while the records of the selected
// period are being read, or when the result may be incomplete.
import React from 'react';

interface Props {
  loading?: boolean;
  truncated?: boolean;
  fromCache?: boolean;
  error?: string | null;
}

export default function RangeNotice({ loading, truncated, fromCache, error }: Props) {
  let text = '';
  let tone = 'bg-blue-50 text-blue-700 border-blue-100';
  if (error) {
    text = `${error} Los totales pueden estar incompletos.`;
    tone = 'bg-rose-50 text-rose-700 border-rose-100';
  } else if (loading) {
    text = 'Cargando todos los registros del período…';
  } else if (truncated) {
    text = 'El período tiene más de 20,000 registros: se muestran los más recientes. Reduzca el rango de fechas para ver totales exactos.';
    tone = 'bg-amber-50 text-amber-800 border-amber-100';
  } else if (fromCache) {
    text = 'Sin conexión: se muestran los registros guardados en este dispositivo; pueden faltar algunos del período.';
    tone = 'bg-amber-50 text-amber-800 border-amber-100';
  }
  if (!text) return null;
  return (
    <div role="status" className={`text-[11px] font-semibold border rounded-lg px-3 py-2 ${tone}`}>
      {text}
    </div>
  );
}
