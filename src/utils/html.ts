/**
 * Escapa texto para insertarlo en HTML construido como cadena (popups de
 * Leaflet, reportes impresos). Todo dato que venga de la BD o del usuario
 * —descripciones, nombres, IDs— debe pasar por aquí.
 */
export function escapeHtml(valor: unknown): string {
  return String(valor ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>
  )[c]);
}
