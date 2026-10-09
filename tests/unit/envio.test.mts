/** Pruebas de la interpretación de los límites de envío de códigos de Supabase. */
import { interpretarErrorEnvio, ESPERA_REENVIO_S } from '../../src/utils/envioCodigos.ts';

let ok = 0, total = 0;
function prueba(nombre: string, cond: boolean, detalle = '') {
  total++; if (cond) ok++;
  console.log(cond ? '✔' : '✘', nombre, cond ? '' : `→ ${detalle}`);
}

const a = interpretarErrorEnvio({ message: 'For security purposes, you can only request this after 27 seconds.' });
prueba('espera exacta de Supabase', a.esperaS === 27 && /27 s/.test(a.error ?? ''), JSON.stringify(a));
const b = interpretarErrorEnvio({ message: 'Email rate limit exceeded' });
prueba('límite por hora: aviso claro, sin bloquear', b.limiteHora === true && /último código/.test(b.error ?? ''), JSON.stringify(b));
const c = interpretarErrorEnvio(new Error('Por seguridad, espera 45 s para pedir otro código.'));
prueba('mensaje de la función acceso-cedula', c.esperaS === 45, JSON.stringify(c));
const d = interpretarErrorEnvio({ message: 'Failed to fetch' });
prueba('sin conexión: sin espera y mensaje amigable', !d.esperaS && !!d.error && !/fetch/i.test(d.error), JSON.stringify(d));
prueba('la app espera 30 s entre envíos', ESPERA_REENVIO_S === 30);

console.log(`\n${ok}/${total} correctas`);
if (ok !== total) process.exit(1);
