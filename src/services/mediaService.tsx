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

    // Generar nombre único
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const fileExt = file.name.split('.').pop();
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

    // Obtener URL pública
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

    console.log('✅ Archivo subido exitosamente:', urlData.publicUrl);

    return {
      success: true,
      url: urlData.publicUrl
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

    // Extraer path del URL
    const urlParts = fileUrl.split('/storage/v1/object/public/evidencias/');
    if (urlParts.length < 2) {
      return {
        success: false,
        error: 'URL inválida'
      };
    }

    const filePath = urlParts[1];

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
