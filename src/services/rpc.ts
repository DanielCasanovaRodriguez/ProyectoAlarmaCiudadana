/**
 * Detecta que una función RPC todavía no existe en Supabase (migración
 * pendiente de aplicar). Permite que los clientes funcionen antes y después
 * de aplicar supabase/migrations/*. Cuando la migración esté aplicada en
 * producción, los caminos de respaldo que usan esta función pueden eliminarse.
 */
export function isMissingRpc(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === 'PGRST202' || /could not find the function/i.test(error.message ?? '');
}
