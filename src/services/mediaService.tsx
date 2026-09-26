/**
 * Servicio de Gestión de Multimedia
 * Maneja la carga, almacenamiento y validación de archivos multimedia
 * en Supabase Storage
 */

import { createClient } from '../utils/supabase/client';

// ==========================================
// TIPOS Y CONSTANTES
// ==========================================

export type MediaType = 'image' | 'video' | 'audio';

export interface MediaFile {
  id: string;
  file: File;
  type: MediaType;
  url: string; // URL temporal para preview
  uploadProgress: number;
  uploaded: boolean;
  error?: string;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

// Configuración
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg'];

const STORAGE_BUCKET = 'evidencias';

// ==========================================
// VALIDACIÓN
// ==========================================

/**
 * Valida un archivo antes de subirlo
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  // Validar tamaño
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `El archivo es demasiado grande. Máximo ${MAX_FILE_SIZE / 1024 / 1024}MB`
    };
  }

  // Validar tipo
  const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
  const isAudio = ALLOWED_AUDIO_TYPES.includes(file.type);

  if (!isImage && !isVideo && !isAudio) {
    return {
      valid: false,
      error: 'Tipo de archivo no permitido'
    };
  }

  return { valid: true };
}

/**
 * Determina el tipo de media basado en el MIME type
 */
export function getMediaType(file: File): MediaType {
  if (ALLOWED_IMAGE_TYPES.includes(file.type)) return 'image';
  if (ALLOWED_VIDEO_TYPES.includes(file.type)) return 'video';
  if (ALLOWED_AUDIO_TYPES.includes(file.type)) return 'audio';
  return 'image'; // fallback
}

/**
 * Valida el número total de archivos
 */
export function validateFileCount(currentCount: number, newCount: number): { valid: boolean; error?: string } {
  if (currentCount + newCount > MAX_FILES) {
    return {
      valid: false,
      error: `Máximo ${MAX_FILES} archivos permitidos`
    };
  }
  return { valid: true };
}

// ==========================================
// PREVIEW
// ==========================================

/**
 * Crea una URL temporal para preview
 */
export function createPreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}

/**
 * Libera una URL temporal
 */
export function revokePreviewUrl(url: string): void {
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

// ==========================================
// COMPRESIÓN DE IMÁGENES
// ==========================================

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/webm': 'webm', 'audio/ogg': 'ogg',
};

function extensionFor(file: File): string {
  const fromMime = MIME_EXT[file.type];
  if (fromMime) return fromMime;
  const fromName = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  return /^[a-z0-9]{2,5}$/.test(fromName) ? fromName : 'bin';
}

const COMPRESS_THRESHOLD = 1024 * 1024; // comprimir si pesa más de 1 MB
const MAX_DIMENSION      = 1920;
const JPEG_QUALITY       = 0.82;

/**
 * Reduce fotos grandes a máx. 1920 px en JPEG (respetando la orientación
 * EXIF). Si el formato no se puede decodificar (p. ej. HEIC) o el
 * resultado no es más liviano, se devuelve el archivo original.
 */
export async function compressImageIfNeeded(file: File): Promise<File> {
  const esImagenComprimible = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type);
  if (!esImagenComprimible || file.size <= COMPRESS_THRESHOLD || typeof createImageBitmap !== 'function') {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale  = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width  = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, '') || 'foto';
    console.log(`🗜️ Imagen reducida: ${(file.size / 1048576).toFixed(1)} MB → ${(blob.size / 1048576).toFixed(2)} MB`);
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch (err) {
    console.warn('No se pudo comprimir la imagen; se sube el original:', err);
    return file;
  }
}

// ==========================================
// UPLOAD
// ==========================================

/**
 * Sube un archivo a Supabase Storage
 * @param file - Archivo a subir
 * @param alertId - ID de la alerta asociada
 * @param onProgress - Callback de progreso (opcional)
 */
export async function uploadFile(
  file: File,
  alertId: string,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  try {
    // Validar archivo
    const validation = validateFile(file);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      };
    }

    const supabase = createClient();

    // Fotos de cámara (~3 MB) se reducen antes de subir
    file = await compressImageIfNeeded(file);

    // Nombre único; la extensión sale del tipo MIME (en Android algunas
    // fotos llegan sin extensión en el nombre)
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const fileExt = extensionFor(file);
    const fileName = `${timestamp}-${randomStr}.${fileExt}`;

    // Path en storage: alertas/{alertId}/{fileName}
    const filePath = `alertas/${alertId}/${fileName}`;

    console.log('📤 Subiendo archivo:', {
      name: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      type: file.type,
      path: filePath
    });

    // Simular progreso (Supabase no tiene onProgress nativo)
    if (onProgress) {
      onProgress(30);
    }

    // Subir archivo
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('❌ Error al subir archivo:', error);
      return {
        success: false,
        error: error.message || 'Error al subir archivo'
      };
    }

    if (onProgress) {
      onProgress(100);
    }

    // Se guarda la ruta interna (no una URL pública): las evidencias se
    // muestran con URLs firmadas temporales (ver getSignedMediaUrls).
    console.log('✅ Archivo subido exitosamente:', filePath);

    return {
      success: true,
      url: filePath
    };
  } catch (error: any) {
    console.error('❌ Error inesperado al subir archivo:', error);
    return {
      success: false,
      error: error.message || 'Error al subir archivo'
    };
  }
}

/**
 * Sube múltiples archivos
 */
export async function uploadMultipleFiles(
  files: File[],
  alertId: string,
  onFileProgress?: (fileIndex: number, progress: number) => void
): Promise<{ success: boolean; urls: string[]; errors: string[] }> {
  const results = await Promise.all(
    files.map((file, index) =>
      uploadFile(file, alertId, (progress) => {
        onFileProgress?.(index, progress);
      })
    )
  );

  const urls: string[] = [];
  const errors: string[] = [];

  results.forEach((result, index) => {
    if (result.success && result.url) {
      urls.push(result.url);
    } else {
      errors.push(`${files[index].name}: ${result.error}`);
    }
  });

  return {
    success: errors.length === 0,
    urls,
    errors
  };
}

// ==========================================
// DELETE
// ==========================================

/**
 * Elimina un archivo de Supabase Storage
 */
export async function deleteFile(fileUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    const filePath = toStoragePath(fileUrl);
    if (!filePath) {
      return {
        success: false,
        error: 'URL inválida'
      };
    }

    console.log('🗑️ Eliminando archivo:', filePath);

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error('❌ Error al eliminar archivo:', error);
      return {
        success: false,
        error: error.message
      };
    }

    console.log('✅ Archivo eliminado exitosamente');

    return { success: true };
  } catch (error: any) {
    console.error('❌ Error inesperado al eliminar archivo:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ==========================================
// URLs FIRMADAS (evidencias privadas)
// ==========================================

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hora

/**
 * Convierte un valor de media_urls en la ruta dentro del bucket.
 * Acepta la ruta nueva ("alertas/<id>/<archivo>") y las URLs públicas
 * antiguas ("https://.../storage/v1/object/public/evidencias/alertas/...").
 */
export function toStoragePath(value: string): string | null {
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, '');
  const marker = `/object/public/${STORAGE_BUCKET}/`;
  const i = value.indexOf(marker);
  if (i !== -1) return decodeURIComponent(value.slice(i + marker.length).split('?')[0]);
  const signMarker = `/object/sign/${STORAGE_BUCKET}/`;
  const j = value.indexOf(signMarker);
  if (j !== -1) return decodeURIComponent(value.slice(j + signMarker.length).split('?')[0]);
  return null;
}

/**
 * Devuelve URLs firmadas temporales para mostrar evidencias.
 * Funciona con el bucket público (estado actual) y privado (tras aplicar
 * supabase/migrations/20260925000003_storage_evidencias.sql).
 * Si un valor no es del bucket, se devuelve tal cual.
 */
export async function getSignedMediaUrls(values: string[]): Promise<string[]> {
  if (!values?.length) return [];
  const paths = values.map(toStoragePath);
  const toSign = paths.filter((p): p is string => !!p);
  if (toSign.length === 0) return values;

  const { data, error } = await createClient().storage
    .from(STORAGE_BUCKET)
    .createSignedUrls(toSign, SIGNED_URL_TTL_SECONDS);

  if (error || !data) {
    console.warn('No se pudieron firmar las URLs de evidencias:', error?.message);
    return values;
  }
  const byPath = new Map(data.map(d => [d.path, d.signedUrl]));
  return values.map((v, i) => (paths[i] && byPath.get(paths[i]!)) || v);
}

/** Tipo de evidencia a partir de la ruta/URL (para elegir img/video/audio). */
export function mediaKindFromUrl(url: string): MediaType {
  const clean = url.split('?')[0].toLowerCase();
  if (/\.(mp4|webm|mov|quicktime)$/.test(clean)) return 'video';
  if (/\.(mp3|wav|ogg|m4a|mpeg)$/.test(clean)) return 'audio';
  return 'image';
}

// ==========================================
// UTILIDADES
// ==========================================

/**
 * Formatea el tamaño de un archivo
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Obtiene el ícono apropiado para un tipo de media
 */
export function getMediaIcon(type: MediaType): string {
  switch (type) {
    case 'image':
      return '🖼️';
    case 'video':
      return '🎥';
    case 'audio':
      return '🎤';
    default:
      return '📄';
  }
}

/**
 * Genera un ID único para un archivo
 */
export function generateFileId(): string {
  return `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ==========================================
// CONFIGURACIÓN Y CONSTANTES EXPORTADAS
// ==========================================

export const MEDIA_CONFIG = {
  maxFileSize: MAX_FILE_SIZE,
  maxFiles: MAX_FILES,
  allowedImageTypes: ALLOWED_IMAGE_TYPES,
  allowedVideoTypes: ALLOWED_VIDEO_TYPES,
  allowedAudioTypes: ALLOWED_AUDIO_TYPES,
  storageBucket: STORAGE_BUCKET
};
