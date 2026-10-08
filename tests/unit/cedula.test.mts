/** Pruebas de las validaciones del formulario de cédula (mismas reglas que la BD). */
import {
  validarNumeroCedula, validarFechaExpedicion, soloDigitosCedula, validarNombrePersona,
  enmascararCedula, hoyISO,
} from '../../src/utils/cedula.ts';

let ok = 0, total = 0;
function prueba(nombre: string, cond: boolean, detalle = '') {
  total++; if (cond) ok++;
  console.log(cond ? '✔' : '✘', nombre, cond ? '' : `→ ${detalle}`);
}

const HOY = new Date(2026, 9, 8); // 8 de octubre de 2026

// Número
prueba('número con puntos y espacios es válido', validarNumeroCedula('1.012 345.678') === null);
prueba('ceros a la izquierda se ignoran', soloDigitosCedula('0001012345678') === '1012345678');
prueba('vacío', validarNumeroCedula('') !== null);
prueba('letras', validarNumeroCedula('10123A5678') !== null, String(validarNumeroCedula('10123A5678')));
prueba('4 dígitos', validarNumeroCedula('1234') !== null);
prueba('11 dígitos', validarNumeroCedula('12345678901') !== null);
prueba('todos iguales', validarNumeroCedula('1111111111') !== null);
prueba('5 dígitos (cédula antigua) válido', validarNumeroCedula('41234') === null);

// Fecha de expedición
prueba('fecha válida', validarFechaExpedicion('2010-05-14', HOY) === null);
prueba('obligatoria', validarFechaExpedicion('', HOY) !== null);
prueba('formato inválido', validarFechaExpedicion('14/05/2010', HOY) !== null);
prueba('30 de febrero no existe', validarFechaExpedicion('2023-02-30', HOY) !== null);
prueba('29 de febrero bisiesto existe', validarFechaExpedicion('2024-02-29', HOY) === null);
prueba('29 de febrero no bisiesto no existe', validarFechaExpedicion('2023-02-29', HOY) !== null);
prueba('hoy es válida', validarFechaExpedicion(hoyISO(HOY), HOY) === null);
prueba('mañana (futura) no', validarFechaExpedicion('2026-10-09', HOY) !== null);
prueba('antes de 1940 no', validarFechaExpedicion('1939-12-31', HOY) !== null);
prueba('hoyISO con ceros', hoyISO(new Date(2026, 0, 5)) === '2026-01-05');

// Nombres y máscara
prueba('nombre con números inválido', validarNombrePersona('Juan2', 'nombres') !== null);
prueba("nombre con tilde y apóstrofo válido", validarNombrePersona("José D'Angelo", 'nombres') === null);
prueba('enmascarar', enmascararCedula('1012345678') === '••••••5678');

console.log(`\n${ok}/${total} correctas`);
if (ok !== total) process.exit(1);
