import { supabase } from '../utils/supabase/client';
import { toAppError, toUserMessage } from '../utils/errors';
import { compressImageIfNeeded } from './mediaService';
import {
  parsePdf417Cedula, parseMrzCedula, compararConRegistro,
  type DatosCedula, type ModeloCedula, type ResultadoComparacion,
} from '../utils/cedula';
import type { EstadoIdentidad } from '../types/database.types';
import zxingWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

const BUCKET = 'documentos-identidad';
const MIN_LADO_PX = 700;

// ================================================================
// TIPOS
// ================================================================

export interface LecturaReverso {
  modelo: ModeloCedula;
  metodo: 'pdf417' | 'mrz' | 'manual';
  datos?: DatosCedula;
}

export interface CapturaIdentidad {
  numero: string;
  frente: File;
  reverso: File;
  lectura: LecturaReverso;
  comparacion?: ResultadoComparacion;
}

export interface MiIdentidad {
  estado: EstadoIdentidad;
  ultimos_digitos: string;
  motivo_rechazo: string | null;
  intentos: number;
  actualizado_at: string;
}

// ================================================================
// IMAGEN → lienzo (orientación EXIF y tamaño manejable)
// ================================================================

async function aLienzo(file: File, maxLado = 2000): Promise<HTMLCanvasElement> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('No pudimos abrir la foto. Toma otra en formato JPG o PNG.');
  }
  if (Math.max(bitmap.width, bitmap.height) < MIN_LADO_PX) {
    bitmap.close();
    throw new Error('La foto tiene muy poca resolución. Acércate un poco más a la cédula y vuelve a tomarla.');
  }
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

/** Valida que la foto del frente se pueda abrir y tenga resolución suficiente. */
export async function validarFotoDocumento(file: File): Promise<void> {
  await aLienzo(file, 800);
}

// ================================================================
// LECTURA DEL REVERSO
// ================================================================

let zxingListo: Promise<typeof import('zxing-wasm/reader')> | null = null;
function cargarZxing() {
  zxingListo ??= import('zxing-wasm/reader').then(zx => {
    // WebAssembly empaquetado con la app (funciona sin CDN)
    zx.prepareZXingModule({
      overrides: { locateFile: (ruta: string, prefijo: string) => (ruta.endsWith('.wasm') ? zxingWasmUrl : prefijo + ruta) },
    });
    return zx;
  });
  return zxingListo;
}

async function leerCodigos(canvas: HTMLCanvasElement) {
  const zx = await cargarZxing();
  const datos = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
  return zx.readBarcodes(datos, {
    formats: ['PDF417', 'QRCode'],
    tryHarder: true,
    tryRotate: true,
    tryInvert: true,
    tryDownscale: true,
    maxNumberOfSymbols: 2,
  });
}

/** Recorta una franja horizontal del lienzo (0–1) y la amplía para el OCR. */
function franja(canvas: HTMLCanvasElement, desde: number, hasta: number, anchoObjetivo = 1800) {
  const y = Math.round(canvas.height * desde);
  const h = Math.round(canvas.height * (hasta - desde));
  const escala = anchoObjetivo / canvas.width;
  const c = document.createElement('canvas');
  c.width = anchoObjetivo; c.height = Math.round(h * escala);
  const ctx = c.getContext('2d')!;
  ctx.filter = 'grayscale(1) contrast(1.4)';
  ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, c.width, c.height);
  return c;
}

async function leerMrzConOcr(canvas: HTMLCanvasElement, onProgreso?: (t: string) => void): Promise<DatosCedula | null> {
  onProgreso?.('Leyendo el texto de la cédula digital…');
  const { createWorker, PSM } = await import('tesseract.js');
  const worker = await createWorker('eng', 1);
  try {
    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    });
    // La MRZ va en la parte inferior del reverso; si la foto está girada, en la superior
    const zonas: HTMLCanvasElement[] = [franja(canvas, 0.55, 1), franja(canvas, 0.4, 1)];
    const girado = document.createElement('canvas');
    girado.width = canvas.width; girado.height = canvas.height;
    const g = girado.getContext('2d')!;
    g.translate(canvas.width, canvas.height); g.rotate(Math.PI); g.drawImage(canvas, 0, 0);
    zonas.push(franja(girado, 0.55, 1));

    for (const zona of zonas) {
      const { data } = await worker.recognize(zona);
      const leida = parseMrzCedula(data.text);
      if (leida) return leida;
    }
    return null;
  } finally {
    await worker.terminate();
  }
}

/**
 * Lee el reverso de la cédula:
 *  1. PDF417 (cédula amarilla con hologramas).
 *  2. MRZ por OCR (cédula digital; su QR está cifrado por la Registraduría).
 *  3. Si nada se puede leer: revisión manual.
 */
export async function leerReversoCedula(file: File, onProgreso?: (t: string) => void): Promise<LecturaReverso> {
  onProgreso?.('Buscando el código de barras…');
  const canvas = await aLienzo(file, 2000);

  let hayQr = false;
  try {
    const codigos = await leerCodigos(canvas);
    const pdf = codigos.find(c => c.format === 'PDF417' && c.isValid);
    hayQr = codigos.some(c => c.format === 'QRCode');
    if (pdf) {
      const datos = parsePdf417Cedula(pdf.bytes);
      if (datos) return { modelo: 'amarilla', metodo: 'pdf417', datos };
    }
  } catch (err) {
    console.warn('Lectura de código de barras:', err);
  }

  try {
    const mrz = await leerMrzConOcr(canvas, onProgreso);
    if (mrz) return { modelo: 'digital', metodo: 'mrz', datos: mrz };
  } catch (err) {
    console.warn('Lectura MRZ (OCR):', err);
  }

  return { modelo: hayQr ? 'digital' : 'desconocido', metodo: 'manual' };
}

export function compararLectura(
  lectura: LecturaReverso,
  registro: { numero: string; nombres: string; apellidos: string },
): ResultadoComparacion | undefined {
  return lectura.datos ? compararConRegistro(lectura.datos, registro) : undefined;
}

// ================================================================
// ENVÍO
// ================================================================

async function subir(uid: string, file: File, lado: 'frente' | 'reverso'): Promise<string> {
  const comprimida = await compressImageIfNeeded(file);
  const ext = comprimida.type === 'image/png' ? 'png' : comprimida.type === 'image/webp' ? 'webp' : 'jpg';
  const ruta = `${uid}/${Date.now()}-${lado}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, comprimida, {
    contentType: comprimida.type || 'image/jpeg',
    upsert: false,
  });
  if (error) throw toAppError(error, 'No se pudo subir la foto de tu cédula.');
  return ruta;
}

/** Sube las fotos y registra la verificación del usuario con sesión activa. */
export async function enviarVerificacion(captura: CapturaIdentidad): Promise<{ estado: EstadoIdentidad; ultimos_digitos: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Tu sesión expiró. Inicia sesión de nuevo para continuar.');

  const [frente, reverso] = await Promise.all([
    subir(user.id, captura.frente, 'frente'),
    subir(user.id, captura.reverso, 'reverso'),
  ]);

  const d = captura.lectura.datos;
  const { data, error } = await supabase.rpc('registrar_identidad', {
    p_numero: captura.numero,
    p_modelo: captura.lectura.modelo,
    p_metodo: captura.lectura.metodo,
    p_coincide_numero: captura.comparacion?.coincideNumero ?? false,
    p_coincide_nombre: captura.comparacion?.coincideNombre ?? false,
    p_datos: d ? {
      numero: d.numero, primerApellido: d.primerApellido, segundoApellido: d.segundoApellido,
      primerNombre: d.primerNombre, segundoNombre: d.segundoNombre,
      sexo: d.sexo ?? null, fechaNacimiento: d.fechaNacimiento ?? null, fuente: d.fuente,
    } : null,
    p_frente: frente,
    p_reverso: reverso,
  });
  if (error) throw toAppError(error, 'No se pudo registrar la verificación de tu cédula.');
  const fila = (data ?? [])[0];
  return { estado: fila?.estado ?? 'pendiente', ultimos_digitos: fila?.ultimos_digitos ?? captura.numero.slice(-4) };
}

/** Estado de verificación del usuario actual (null si nunca la envió). */
export async function obtenerMiIdentidad(): Promise<MiIdentidad | null> {
  const { data, error } = await supabase.rpc('mi_identidad');
  if (error) throw toAppError(error);
  return (data ?? [])[0] ?? null;
}

export const identidadPermiteReportar = (i: MiIdentidad | null) =>
  !!i && (i.estado === 'pendiente' || i.estado === 'verificada');

// ================================================================
// ADMINISTRACIÓN
// ================================================================

export type VerificacionAdmin = {
  user_id: string; nombres: string | null; apellidos: string | null; email: string | null;
  estado: EstadoIdentidad; ultimos_digitos: string; modelo_documento: string; metodo_lectura: string;
  coincide_numero: boolean; coincide_nombre: boolean; intentos: number; motivo_rechazo: string | null;
  created_at: string; updated_at: string;
};

export async function listarVerificaciones(estado?: EstadoIdentidad | null): Promise<{ data: VerificacionAdmin[]; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_listar_identidades', { p_estado: estado ?? null });
  if (error) return { data: [], error: toUserMessage(error) };
  return { data: (data ?? []) as VerificacionAdmin[], error: null };
}

export async function detalleVerificacion(userId: string): Promise<{
  numero: string; datos: Record<string, unknown> | null; frenteUrl: string | null; reversoUrl: string | null;
}> {
  const { data, error } = await supabase.rpc('admin_detalle_identidad', { p_user_id: userId });
  if (error) throw toAppError(error);
  const fila = (data ?? [])[0];
  if (!fila) throw new Error('No se encontró la verificación.');
  const { data: urls } = await supabase.storage.from(BUCKET).createSignedUrls([fila.frente_path, fila.reverso_path], 600);
  return {
    numero: fila.numero,
    datos: fila.datos_documento,
    frenteUrl: urls?.[0]?.signedUrl ?? null,
    reversoUrl: urls?.[1]?.signedUrl ?? null,
  };
}

export async function revisarVerificacion(userId: string, estado: 'verificada' | 'rechazada', motivo?: string) {
  const { error } = await supabase.rpc('revisar_identidad', { p_user_id: userId, p_estado: estado, p_motivo: motivo ?? null });
  if (error) throw toAppError(error);
}
