/**
 * Cédula de ciudadanía colombiana: validación y lectura de datos.
 *
 * Modelos:
 *  - Amarilla con hologramas (2000–2020): reverso con código PDF417. Los datos
 *    van en posiciones fijas (fuente: implementaciones abiertas, p. ej.
 *    github.com/Eitol/colombian-cedula-reader).
 *  - Digital (desde 2020): reverso con QR cifrado por la Registraduría (no
 *    legible) y zona MRZ tipo TD1 (3 líneas de 30 caracteres, ICAO 9303),
 *    donde el número de cédula (NUIP) va en los datos opcionales de la línea 2.
 *
 * Todo este módulo es puro (sin DOM) para poder probarlo en Node.
 */

export type ModeloCedula = 'amarilla' | 'digital' | 'desconocido';

export interface DatosCedula {
  numero: string;              // sin ceros a la izquierda
  primerApellido: string;
  segundoApellido: string;
  primerNombre: string;
  segundoNombre: string;
  sexo?: 'M' | 'F';
  fechaNacimiento?: string;    // AAAA-MM-DD
  rh?: string;
  fuente: 'pdf417' | 'mrz';
  /** MRZ: línea de nombres tal como la leyó el OCR (solo letras y espacios). */
  textoNombres?: string;
}

// ------------------------------------------------------------ texto
/** Mayúsculas, sin tildes (Ñ se conserva), solo letras y espacios simples. */
export function normalizarNombre(s: string | null | undefined): string {
  return (s ?? '')
    .toUpperCase()
    .replace(/Ñ/g, '\u0001')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\u0001/g, 'Ñ')
    .replace(/[^A-ZÑ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Deja solo los dígitos de un número de cédula escrito con puntos o espacios. */
export function soloDigitosCedula(s: string): string {
  return (s ?? '').replace(/\D/g, '').replace(/^0+/, '');
}

/**
 * Valida el número de cédula colombiana (CC): 5 a 10 dígitos.
 * Las más antiguas tienen 5–8 dígitos; las expedidas desde 2004 suelen
 * tener 10 y empezar por 1. No existe dígito de verificación público.
 */
export function validarNumeroCedula(s: string): string | null {
  const n = soloDigitosCedula(s);
  if (!n) return 'Ingresa el número de tu cédula.';
  if (n.length < 5 || n.length > 10) return 'El número de cédula debe tener entre 5 y 10 dígitos.';
  if (/^(\d)\1+$/.test(n)) return 'El número de cédula no es válido.';
  return null;
}

/** Nombres y apellidos: letras (con tildes/ñ), espacios, guion y apóstrofo. */
export function validarNombrePersona(s: string, campo: 'nombres' | 'apellidos'): string | null {
  const v = (s ?? '').trim();
  if (v.length < 2) return campo === 'nombres' ? 'Ingresa tus nombres.' : 'Ingresa tus apellidos.';
  if (v.length > 60) return 'Es demasiado largo (máximo 60 caracteres).';
  if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]+$/.test(v)) return 'Usa solo letras, espacios o guiones.';
  return null;
}

// ------------------------------------------------------------ PDF417 (cédula amarilla)
function latin1(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

const limpiarCampo = (s: string) => normalizarNombre(s.replace(/\0/g, ' '));

function fechaValida(aaaa: string, mm: string, dd: string): string | undefined {
  const y = Number(aaaa), m = Number(mm), d = Number(dd);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > new Date().getFullYear()) return undefined;
  return `${aaaa}-${mm}-${dd}`;
}

/**
 * Datos del PDF417 de la cédula amarilla.
 * Posiciones (0-based): número 48–58, primer apellido 58–81, segundo
 * apellido 81–104, primer nombre 104–127, segundo nombre 127–150,
 * sexo 151, nacimiento AAAAMMDD 152–160, RH 166–168.
 */
export function parsePdf417Cedula(raw: Uint8Array | string): DatosCedula | null {
  const s = typeof raw === 'string' ? raw : latin1(raw);

  if (s.length >= 160) {
    const numero = soloDigitosCedula(s.slice(48, 58));
    const d: DatosCedula = {
      numero,
      primerApellido:  limpiarCampo(s.slice(58, 81)),
      segundoApellido: limpiarCampo(s.slice(81, 104)),
      primerNombre:    limpiarCampo(s.slice(104, 127)),
      segundoNombre:   limpiarCampo(s.slice(127, 150)),
      fuente: 'pdf417',
    };
    const sexo = s.charAt(151);
    if (sexo === 'M' || sexo === 'F') d.sexo = sexo;
    d.fechaNacimiento = fechaValida(s.slice(152, 156), s.slice(156, 158), s.slice(158, 160));
    const rh = s.slice(166, 168).replace(/\0/g, '').trim();
    if (/^(A|B|AB|O)[+-]$/.test(rh) || /^(A|B|O)[+-]$/.test(rh)) d.rh = rh;
    if (numero.length >= 5 && numero.length <= 10 && d.primerApellido && d.primerNombre) return d;
  }

  // Respaldo por palabras: el número (con ceros) va pegado al primer apellido
  const plano = s.replace(/\0/g, ' ');
  const m = plano.match(/0*(\d{5,10})([A-ZÑ]{2,}(?: [A-ZÑ]+)*)/);
  if (!m) return null;
  const palabras = normalizarNombre(plano.slice((m.index ?? 0) + m[0].length - m[2].length)).split(' ').filter(Boolean);
  if (palabras.length < 2) return null;
  return {
    numero: soloDigitosCedula(m[1]),
    primerApellido: palabras[0] ?? '',
    segundoApellido: palabras.length >= 4 ? palabras[1] : '',
    primerNombre: palabras.length >= 4 ? palabras[2] : palabras[1],
    segundoNombre: palabras.length >= 4 ? (palabras[3] ?? '') : (palabras[2] ?? ''),
    fuente: 'pdf417',
  };
}

// ------------------------------------------------------------ MRZ TD1 (cédula digital)
/** Dígito de control ICAO 9303 (pesos 7-3-1). */
export function digitoControlMrz(campo: string): number {
  const valor = (c: string) =>
    c === '<' ? 0 : /\d/.test(c) ? Number(c) : c.charCodeAt(0) - 55; // A=10…Z=35
  const pesos = [7, 3, 1];
  let suma = 0;
  for (let i = 0; i < campo.length; i++) suma += valor(campo[i]) * pesos[i % 3];
  return suma % 10;
}

/** Confusiones típicas del OCR en zonas que solo admiten dígitos. */
const aDigitos = (s: string) =>
  s.replace(/[OQD]/g, '0').replace(/[IL|]/g, '1').replace(/Z/g, '2').replace(/S/g, '5').replace(/G/g, '6').replace(/B/g, '8');

/**
 * Lee la MRZ de la cédula digital a partir del texto del OCR.
 * Línea 2 (30 car.): AAMMDD + dígito, sexo, AAMMDD vencimiento + dígito,
 * nacionalidad COL, NUIP (opcional), dígito compuesto.
 * Línea 3: APELLIDO1<APELLIDO2<<NOMBRE1<NOMBRE2
 */
export function parseMrzCedula(texto: string): (DatosCedula & { controlFechaOk: boolean }) | null {
  const lineas = texto
    .toUpperCase()
    .replace(/[«‹]/g, '<')
    .split(/\r?\n/)
    .map(l => l.replace(/\s+/g, '').replace(/[^A-Z0-9<]/g, ''))
    .filter(l => l.length >= 18);

  let l2: RegExpMatchArray | null = null;
  let idx2 = -1;
  for (let i = 0; i < lineas.length; i++) {
    const cand = lineas[i];
    // nacionalidad COL (el OCR a veces lee C0L)
    // Tras COL puede haber 1–2 caracteres de relleno mal leídos (< → K/L); el NUIP empieza por un dígito
    const m = cand.match(/^([0-9OQDILSZGB]{6})([0-9OQDILSZGB])([MF<])([0-9OQDILSZGB]{6})([0-9OQDILSZGB])(C[O0]L)[<KL]{0,2}([0-9][0-9OQDISZGB]{4,9})/);
    if (m) { l2 = m; idx2 = i; break; }
  }
  if (!l2) return null;

  const nacimiento = aDigitos(l2[1]);
  const controlFechaOk = digitoControlMrz(nacimiento) === Number(aDigitos(l2[2]));
  const numero = soloDigitosCedula(aDigitos(l2[7]));
  if (numero.length < 5 || numero.length > 10) return null;

  // Línea de nombres: la siguiente a la línea 2 (o cualquiera con "<<")
  // El OCR suele leer el relleno "<" como K o L: se corrigen los patrones típicos
  const l3cruda = [lineas[idx2 + 1], ...lineas.slice(idx2 + 2)].find(l => l && /^[A-Z<]+$/.test(l) && /[A-Z]{2,}/.test(l)) ?? '';
  const l3 = l3cruda.replace(/<[KL]</g, '<<').replace(/[<KL]*<[<KL]*$/, '').replace(/<+$/, '');
  const [apellidosMrz = '', nombresMrz = ''] = l3.includes('<<') ? l3.split('<<') : [l3, ''];
  const apellidos = apellidosMrz.split('<').filter(Boolean);
  const nombres = nombresMrz.split('<').filter(Boolean);

  const yy = Number(nacimiento.slice(0, 2));
  const siglo = yy > new Date().getFullYear() % 100 ? '19' : '20';
  return {
    numero,
    primerApellido: apellidos[0] ?? '',
    segundoApellido: apellidos.slice(1).join(' '),
    primerNombre: nombres[0] ?? '',
    segundoNombre: nombres.slice(1).join(' '),
    sexo: l2[3] === 'M' || l2[3] === 'F' ? l2[3] : undefined,
    fechaNacimiento: fechaValida(siglo + nacimiento.slice(0, 2), nacimiento.slice(2, 4), nacimiento.slice(4, 6)),
    fuente: 'mrz',
    textoNombres: l3cruda.replace(/</g, ' ').replace(/\s+/g, ' ').trim(),
    controlFechaOk,
  };
}

// ------------------------------------------------------------ comparación
export interface ResultadoComparacion {
  coincideNumero: boolean;
  coincideNombre: boolean;
  /** Mensajes para el usuario si algo no coincide. */
  avisos: string[];
}

/**
 * Compara lo leído del documento con lo digitado en el registro.
 * Nombre: el primer apellido y el primer nombre del documento deben estar
 * entre las palabras escritas (sin tildes ni mayúsculas; tolera que la
 * persona no escriba su segundo nombre o apellido).
 */
export function compararConRegistro(
  doc: DatosCedula,
  registro: { numero: string; nombres: string; apellidos: string },
): ResultadoComparacion {
  const avisos: string[] = [];
  const coincideNumero = soloDigitosCedula(registro.numero) === doc.numero;
  if (!coincideNumero) {
    avisos.push('El número de cédula que escribiste no coincide con el del documento.');
  }
  const palabrasNombres = new Set(normalizarNombre(registro.nombres).split(' '));
  const palabrasApellidos = new Set(normalizarNombre(registro.apellidos).split(' '));
  const pa = normalizarNombre(doc.primerApellido).split(' ')[0];
  const pn = normalizarNombre(doc.primerNombre).split(' ')[0];
  let coincideNombre = !!pa && !!pn && palabrasApellidos.has(pa) && palabrasNombres.has(pn);
  // MRZ leída por OCR: basta con que el primer nombre y el primer apellido
  // registrados aparezcan en la línea de nombres (tolera separadores mal leídos)
  if (!coincideNombre && doc.fuente === 'mrz' && doc.textoNombres) {
    const linea = normalizarNombre(doc.textoNombres).replace(/ /g, '');
    const rn = normalizarNombre(registro.nombres).split(' ')[0];
    const ra = normalizarNombre(registro.apellidos).split(' ')[0];
    coincideNombre = !!rn && !!ra && rn.length >= 2 && ra.length >= 2 && linea.includes(ra) && linea.includes(rn);
  }
  if (!coincideNombre) {
    avisos.push('Tu nombre o apellido no coincide exactamente con el del documento.');
  }
  return { coincideNumero, coincideNombre, avisos };
}

/** Edad en años a partir de AAAA-MM-DD. */
export function edadDesde(fecha: string | undefined, hoy = new Date()): number | null {
  if (!fecha) return null;
  const [y, m, d] = fecha.split('-').map(Number);
  let edad = hoy.getFullYear() - y;
  if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) edad--;
  return edad;
}

/** "••••5678" */
export function enmascararCedula(numero: string): string {
  const n = soloDigitosCedula(numero);
  return n.length <= 4 ? n : '•'.repeat(Math.min(6, n.length - 4)) + n.slice(-4);
}
