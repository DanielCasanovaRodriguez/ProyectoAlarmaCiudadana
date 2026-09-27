/**
 * Pruebas del lector de cédula colombiana.
 * PDF417: se construye una cédula sintética con el formato real (531 bytes,
 * campos en posiciones fijas y relleno con \0), se genera la imagen del
 * código con bwip-js, se lee con zxing-wasm y se analiza.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  parsePdf417Cedula, parseMrzCedula, compararConRegistro, validarNumeroCedula,
  normalizarNombre, digitoControlMrz, edadDesde, enmascararCedula, validarNombrePersona,
} from '../../src/utils/cedula.ts';

const require = createRequire(import.meta.url);
let ok = 0, total = 0;
function prueba(nombre: string, cond: boolean, detalle = '') {
  total++; if (cond) ok++;
  console.log(cond ? '✔' : '✘', nombre, cond ? '' : `→ ${detalle}`);
}

// ---------------------------------------------------------------- PDF417 sintético
function campo(valor: string, largo: number) {
  return (valor + '\0'.repeat(largo)).slice(0, largo);
}
function cedulaPdf417(): Uint8Array {
  let s = campo('03012345678', 48);                 // códigos internos (AFIS, tarjeta)
  s += campo('0001012345678'.slice(-10), 10);       // número (10, ceros a la izq.)
  s += campo('GONZALEZ', 23) + campo('MARIN', 23);  // apellidos
  s += campo('MARIA', 23) + campo('GABRIELA', 23);  // nombres
  s += '0' + 'F' + '19900128' + '11001' + '0' + 'O+'; // 150..167
  s = campo(s, 531);
  return Uint8Array.from(s, c => c.charCodeAt(0));
}

const bytes = cedulaPdf417();
const d = parsePdf417Cedula(bytes);
prueba('PDF417 por posiciones: número sin ceros', d?.numero === '1012345678', JSON.stringify(d));
prueba('PDF417: apellidos', d?.primerApellido === 'GONZALEZ' && d?.segundoApellido === 'MARIN');
prueba('PDF417: nombres', d?.primerNombre === 'MARIA' && d?.segundoNombre === 'GABRIELA');
prueba('PDF417: sexo, nacimiento y RH', d?.sexo === 'F' && d?.fechaNacimiento === '1990-01-28' && d?.rh === 'O+', JSON.stringify(d));

// Código de barras real → zxing-wasm → análisis
const bwipjs = require('bwip-js');
const png: Buffer = await bwipjs.toBuffer({ bcid: 'pdf417', text: String.fromCharCode(...bytes), binarytext: true, scale: 3, eclevel: 5, paddingwidth: 20, paddingheight: 20, backgroundcolor: 'FFFFFF' });
const zx = await import('zxing-wasm/reader');
zx.prepareZXingModule({
  overrides: { wasmBinary: readFileSync(require.resolve('zxing-wasm/reader/zxing_reader.wasm')).buffer as ArrayBuffer },
});
const res = await zx.readBarcodes(new Blob([png], { type: 'image/png' }), { formats: ['PDF417'], tryHarder: true });
prueba('zxing-wasm lee la imagen PDF417', res.length === 1 && res[0].isValid, JSON.stringify(res.map(r => r.format)));
const leida = res[0] ? parsePdf417Cedula(res[0].bytes) : null;
prueba('imagen → datos: número y nombre correctos', leida?.numero === '1012345678' && leida?.primerNombre === 'MARIA', JSON.stringify(leida));

// Respaldo por palabras (datos truncados)
const truncada = parsePdf417Cedula('ABC0001012345678GONZALEZ MARIN MARIA GABRIELA');
prueba('PDF417 respaldo por palabras', truncada?.numero === '1012345678' && truncada?.primerApellido === 'GONZALEZ' && truncada?.primerNombre === 'MARIA', JSON.stringify(truncada));
prueba('PDF417 basura → null', parsePdf417Cedula('hola mundo') === null);

// ---------------------------------------------------------------- MRZ (cédula digital)
const l2 = '040315' + digitoControlMrz('040315') + 'F' + '320319' + digitoControlMrz('320319') + 'COL' + '1234567890' + '<0';
const mrz = `ICCOL000000012305001<<<<<<<<<<\n${l2}\nWALTEROS<<LAURA<<<<<<<<<<<<<<`;
const m = parseMrzCedula(mrz);
prueba('MRZ: NUIP de la línea 2', m?.numero === '1234567890', JSON.stringify(m));
prueba('MRZ: apellidos y nombres', m?.primerApellido === 'WALTEROS' && m?.primerNombre === 'LAURA');
prueba('MRZ: fecha y dígito de control', m?.fechaNacimiento === '2004-03-15' && m?.controlFechaOk === true, JSON.stringify(m));
const conErroresOcr = mrz.replace('COL1234567890', 'C0L123456789O').replace('040315', 'O4O315').replace(/\n/g, ' \n');
const m2 = parseMrzCedula(conErroresOcr);
prueba('MRZ tolera errores del OCR (O↔0, C0L)', m2?.numero === '1234567890', JSON.stringify(m2));
// Texto real devuelto por Tesseract en el navegador (relleno "<" leído como K/L)
const ocrReal = ['ICCOL000123456<5<<<<LLLLLLL', '9001284F3203190C0LL1012345678<4', 'GONZALEZ<MARIN<K<MARIA<KGABRIELAL', ''].join(String.fromCharCode(10));
const m3 = parseMrzCedula(ocrReal);
prueba('MRZ del OCR real: número', m3?.numero === '1012345678', JSON.stringify(m3));
prueba('MRZ del OCR real: fecha y control', m3?.fechaNacimiento === '1990-01-28' && m3?.controlFechaOk === true);
prueba('MRZ del OCR real: primer apellido', m3?.primerApellido === 'GONZALEZ', JSON.stringify(m3));
const c4 = compararConRegistro(m3!, { numero: '1012345678', nombres: 'María Gabriela', apellidos: 'González Marín' });
prueba('MRZ del OCR real: coincide con el registro', c4.coincideNumero && c4.coincideNombre, JSON.stringify(c4));
const c5 = compararConRegistro(m3!, { numero: '1012345678', nombres: 'Pedro', apellidos: 'Ramírez' });
prueba('MRZ del OCR real: otro nombre NO coincide', !c5.coincideNombre);
prueba('MRZ texto sin MRZ → null', parseMrzCedula('REPUBLICA DE COLOMBIA\nCEDULA DE CIUDADANIA') === null);
prueba('dígito de control ICAO de ejemplo (L898902C3 → 6)', digitoControlMrz('L898902C3') === 6);

// ---------------------------------------------------------------- comparación
const c1 = compararConRegistro(d!, { numero: '1.012.345.678', nombres: 'María Gabriela', apellidos: 'González Marín' });
prueba('coincide con tildes, puntos y mayúsculas', c1.coincideNumero && c1.coincideNombre, JSON.stringify(c1));
const c2 = compararConRegistro(d!, { numero: '1012345678', nombres: 'María', apellidos: 'González' });
prueba('coincide aunque omita segundo nombre y apellido', c2.coincideNombre);
const c3 = compararConRegistro(d!, { numero: '1012345679', nombres: 'Pedro', apellidos: 'González' });
prueba('detecta número y nombre distintos', !c3.coincideNumero && !c3.coincideNombre && c3.avisos.length === 2);

// ---------------------------------------------------------------- validaciones
prueba('valida número con puntos', validarNumeroCedula('1.012.345.678') === null);
prueba('rechaza 4 dígitos', validarNumeroCedula('1234') !== null);
prueba('rechaza 11 dígitos', validarNumeroCedula('12345678901') !== null);
prueba('rechaza repetidos', validarNumeroCedula('1111111111') !== null);
prueba('normaliza Ñ y tildes', normalizarNombre('  Íñigo  Peña-Nieto ') === 'IÑIGO PEÑA NIETO', normalizarNombre('  Íñigo  Peña-Nieto '));
prueba('nombre con números inválido', validarNombrePersona('Juan2', 'nombres') !== null);
prueba("nombre con apóstrofo válido", validarNombrePersona("D'Angelo", 'nombres') === null);
prueba('edad', edadDesde('2008-12-31', new Date('2026-09-26')) === 17 && edadDesde('1990-01-28', new Date('2026-09-26')) === 36);
prueba('enmascarar', enmascararCedula('1012345678') === '••••••5678');

console.log(`\n${ok}/${total} correctas`);
if (ok !== total) process.exit(1);
