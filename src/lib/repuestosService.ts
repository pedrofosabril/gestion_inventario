import { supabase } from '../lib/supabase';

export const guardarRepuesto = async (repuestoData: any) => {
  const { data, error } = await supabase
    .from('repuestos')
    .upsert(repuestoData, { onConflict: 'codigo' });

  if (error) {
    console.error('Error al guardar en Supabase:', error.message);
    throw error;
  }

  return data;
};