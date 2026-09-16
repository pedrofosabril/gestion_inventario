import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export const useRepuestos = () => {
  const [repuestos, setRepuestos] = useState<any[]>([]);

  useEffect(() => {
    const fetchRepuestos = async () => {
      const { data } = await supabase.from('repuestos').select('*');
      if (data) setRepuestos(data);
    };

    fetchRepuestos();

    // Escuchar inserciones, cambios o bajas en la tabla repuestos
    const canal = supabase
      .channel('cambios-repuestos')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'repuestos' },
        () => fetchRepuestos()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  return repuestos;
};