/** Pruebas de la interventoría: escape HTML, teléfonos de Colombia, contraseña y mensajes del servidor. */
import { escapeHtml } from '../../src/utils/html.ts';
import { normalizarTelefonoCO, LINEAS_EMERGENCIA, LINEA_EMERGENCIAS } from '../../src/config/colombia.ts';
import { contieneDatoPersonal } from '../../src/utils/cedula.ts';
import { toUserMessage } from '../../src/utils/errors.ts';

let ok = 0, total = 0;
function prueba(nombre: string, cond: boolean, detalle = '') {
  total++; if (cond) ok++;
  console.log(cond ? '✔' : '✘', nombre, cond ? '' : `→ ${detalle}`);
}

// XSS: lo que escribe un ciudadano nunca se interpreta como HTML
const ataque = `<img src=x onerror="alert('x')">`;
prueba('escapeHtml neutraliza etiquetas y comillas', escapeHtml(ataque) === '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;', escapeHtml(ataque));
prueba('escapeHtml con null/undefined', escapeHtml(null) === '' && escapeHtml(undefined) === '');
prueba('escapeHtml deja texto normal', escapeHtml('Robo en la calle 38 sur') === 'Robo en la calle 38 sur');

// Teléfonos
prueba('celular 10 dígitos', normalizarTelefonoCO('300 123 4567') === '+57 300 123 4567', String(normalizarTelefonoCO('300 123 4567')));
prueba('celular con +57', normalizarTelefonoCO('+57 3001234567') === '+57 300 123 4567');
prueba('fijo con indicativo 601', normalizarTelefonoCO('601 234 5678') === '+57 601 234 5678');
prueba('número corto rechazado', normalizarTelefonoCO('12345') === null);
prueba('número extranjero rechazado', normalizarTelefonoCO('+1 415 555 0100') === null);

// Líneas de emergencia: solo Colombia
prueba('la línea principal es 123', LINEA_EMERGENCIAS === '123');
prueba('no hay 911 ni 112', !LINEAS_EMERGENCIA.some(l => l.numero === '911' || l.numero === '112'));
prueba('incluye 155, 141 y 165', ['155', '141', '165'].every(n => LINEAS_EMERGENCIA.some(l => l.numero === n)));

// Contraseña sin datos del documento
prueba('contraseña con la cédula', contieneDatoPersonal('Clave1012345678', '1.012.345.678', '2010-05-14'));
prueba('contraseña con la fecha AAAAMMDD', contieneDatoPersonal('abc20100514', '52000111', '2010-05-14'));
prueba('contraseña con la fecha DDMMAAAA', contieneDatoPersonal('x14052010y', '52000111', '2010-05-14'));
prueba('contraseña sin datos personales', !contieneDatoPersonal('Segura2026x', '52000111', '2010-05-14'));

// Mensajes de las validaciones del servidor
prueba('fuera de Colombia', /solo recibe reportes ubicados en Colombia/.test(toUserMessage({ message: 'fuera_de_colombia', code: '22023' })));
prueba('descripción larga', /1000 caracteres/.test(toUserMessage({ message: 'descripcion_larga', code: '22001' })));
prueba('solicitudes en trámite', /5 solicitudes/.test(toUserMessage({ message: 'demasiadas_solicitudes', code: 'P0001' })));

console.log(`\n${ok}/${total} correctas`);
if (ok !== total) process.exit(1);
