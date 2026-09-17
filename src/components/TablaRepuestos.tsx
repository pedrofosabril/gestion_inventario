import { useRepuestos } from '../hooks/useRepuestos';
import { guardarRepuesto } from '../lib/repuestosService';

export const TablaRepuestos = () => {
  const repuestos = useRepuestos(); // Se actualiza solo ante cambios en Supabase

  const handleCrear = async () => {
    await guardarRepuesto({ codigo: 'R-001', descripcion: 'Filtro de aceite', precio: 1500 });
  };
};