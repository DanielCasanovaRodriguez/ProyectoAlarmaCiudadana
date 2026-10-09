/**
 * Líneas de atención en Colombia (gratuitas desde celular y fijo).
 * Verificadas el 2026-10-08 con fuentes oficiales y de prensa:
 *  - 123: Línea Única de Emergencias (Policía, Bomberos, ambulancias, gestión
 *    del riesgo). En Bogotá la coordina el C4 de la Secretaría de Seguridad;
 *    el antiguo 112 de la Policía se unificó en el 123.
 *  - 155: orientación a mujeres víctimas de violencia.
 *  - 141: ICBF, protección de niños, niñas y adolescentes.
 *  - 165: GAULA, antisecuestro y antiextorsión.
 *  - 119 Bomberos · 132 Cruz Roja · 144 Defensa Civil.
 * El uso indebido del 123 se sanciona (Ley 1801 de 2016, art. 35 num. 7:
 * multa general tipo 4 y actividad pedagógica).
 */
export interface LineaEmergencia {
  numero: string;
  nombre: string;
  uso:    string;
}

export const LINEA_EMERGENCIAS = '123';

export const LINEAS_EMERGENCIA: LineaEmergencia[] = [
  { numero: '123', nombre: 'Línea Única de Emergencias', uso: 'Policía, Bomberos, ambulancias y atención de emergencias' },
  { numero: '155', nombre: 'Línea 155',                  uso: 'Orientación a mujeres víctimas de violencia' },
  { numero: '141', nombre: 'ICBF',                       uso: 'Protección de niños, niñas y adolescentes' },
  { numero: '165', nombre: 'GAULA',                      uso: 'Secuestro y extorsión' },
  { numero: '119', nombre: 'Bomberos',                   uso: 'Incendios, rescates y materiales peligrosos' },
  { numero: '132', nombre: 'Cruz Roja',                  uso: 'Búsqueda, rescate y apoyo humanitario' },
  { numero: '144', nombre: 'Defensa Civil',              uso: 'Desastres y gestión del riesgo' },
];

/** Celular colombiano (3XX XXX XXXX) o fijo con indicativo nacional (60X XXX XXXX). */
export function normalizarTelefonoCO(entrada: string): string | null {
  let d = entrada.replace(/\D/g, '');
  if (d.startsWith('57') && d.length === 12) d = d.slice(2);
  if (!/^(3\d{9}|60\d{8})$/.test(d)) return null;
  return `+57 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

/** Enlace de Google Maps a unas coordenadas. */
export const enlaceMapa = (lat: number, lng: number) =>
  `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
