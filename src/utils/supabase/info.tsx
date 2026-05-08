// Lee las credenciales desde variables de entorno
// Nunca hardcodear credenciales en el código fuente

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Validación en desarrollo
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan variables de entorno de Supabase. ' +
    'Verifica que el archivo .env existe con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY'
  );
}