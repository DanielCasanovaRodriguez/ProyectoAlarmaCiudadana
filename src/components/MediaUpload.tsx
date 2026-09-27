/**
 * Componente de Carga de Multimedia
 * Permite capturar/seleccionar fotos, videos y audios
 */

import React, { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Video, Mic, X, Upload } from 'lucide-react';
import { Button } from './ui/button';
import { 
  MediaFile, 
  createPreviewUrl, 
  validateFile, 
  validateFileCount, 
  getMediaType,
  generateFileId,
  formatFileSize,
  MEDIA_CONFIG
} from '../services/mediaService';
import { PermissionHelpDialog } from './PermissionHelpDialog';

interface MediaUploadProps {
  files: MediaFile[];
  onFilesChange: (files: MediaFile[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}

export function MediaUpload({ 
  files, 
  onFilesChange, 
  maxFiles = MEDIA_CONFIG.maxFiles,
  disabled = false 
}: MediaUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [audioRecorder, setAudioRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [showPermissionHelp, setShowPermissionHelp] = useState(false);
  const [permissionHelpType, setPermissionHelpType] = useState<'microphone' | 'camera'>('microphone');

  // ==========================================
  // HANDLERS DE ARCHIVOS
  // ==========================================

  const handleFilesSelected = (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    const fileArray = Array.from(selectedFiles);
    
    // Validar cantidad
    const countValidation = validateFileCount(files.length, fileArray.length);
    if (!countValidation.valid) {
      alert(countValidation.error);
      return;
    }

    // Procesar archivos
    const newMediaFiles: MediaFile[] = [];

    for (const file of fileArray) {
      // Validar archivo
      const validation = validateFile(file);
      if (!validation.valid) {
        alert(`${file.name}: ${validation.error}`);
        continue;
      }

      // Crear MediaFile
      const mediaFile: MediaFile = {
        id: generateFileId(),
        file,
        type: getMediaType(file),
        url: createPreviewUrl(file),
        uploadProgress: 0,
        uploaded: false
      };

      newMediaFiles.push(mediaFile);
    }

    if (newMediaFiles.length > 0) {
      onFilesChange([...files, ...newMediaFiles]);
    }
  };

  const handleRemoveFile = (fileId: string) => {
    const updatedFiles = files.filter(f => f.id !== fileId);
    onFilesChange(updatedFiles);
  };

  // ==========================================
  // CAPTURA DE FOTO
  // ==========================================

  const handleCapturePhoto = () => {
    if (files.length >= maxFiles) {
      alert(`Máximo ${maxFiles} archivos permitidos`);
      return;
    }
    cameraInputRef.current?.click();
  };

  // ==========================================
  // SELECCIÓN DESDE GALERÍA
  // ==========================================

  const handleSelectFromGallery = () => {
    if (files.length >= maxFiles) {
      alert(`Máximo ${maxFiles} archivos permitidos`);
      return;
    }
    fileInputRef.current?.click();
  };

  // ==========================================
  // GRABACIÓN DE VIDEO
  // ==========================================

  const handleRecordVideo = () => {
    if (files.length >= maxFiles) {
      alert(`Máximo ${maxFiles} archivos permitidos`);
      return;
    }
    videoInputRef.current?.click();
  };

  // ==========================================
  // GRABACIÓN DE AUDIO
  // ==========================================

  const startAudioRecording = async () => {
    if (files.length >= maxFiles) {
      alert(`Máximo ${maxFiles} archivos permitidos`);
      return;
    }

    try {
      // Verificar si estamos en HTTPS (requerido para permisos de media)
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        alert('La grabación de audio requiere una conexión segura (HTTPS). Por favor accede al sitio usando HTTPS.');
        return;
      }

      // Verificar si el navegador soporta getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Tu navegador no soporta grabación de audio. Por favor usa un navegador moderno como Chrome, Firefox o Safari.');
        return;
      }

      console.log('🎤 Solicitando permiso de micrófono...');

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      console.log('✅ Permiso de micrófono concedido');

      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        console.log('🎤 Grabación de audio finalizada');
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `audio_${Date.now()}.webm`, {
          type: 'audio/webm'
        });

        // Crear MediaFile
        const mediaFile: MediaFile = {
          id: generateFileId(),
          file: audioFile,
          type: 'audio',
          url: createPreviewUrl(audioFile),
          uploadProgress: 0,
          uploaded: false
        };

        onFilesChange([...files, mediaFile]);

        // Detener stream
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setAudioRecorder(recorder);
      setIsRecordingAudio(true);
      setAudioChunks([]);

      console.log('🎤 Grabación iniciada (máximo 60 segundos)');

      // Auto-detener después de 60 segundos
      setTimeout(() => {
        if (recorder.state === 'recording') {
          console.log('⏱️ Tiempo máximo alcanzado, deteniendo grabación...');
          recorder.stop();
          setIsRecordingAudio(false);
        }
      }, 60000);
    } catch (error: any) {
      console.error('❌ Error al iniciar grabación de audio:', error);
      console.error('❌ Error name:', error.name);
      console.error('❌ Error message:', error.message);

      // Mensajes de error específicos
      let errorMessage = '';
      let showHelpDialog = false;
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        // Mostrar diálogo de ayuda visual en lugar de alert
        setPermissionHelpType('microphone');
        setShowPermissionHelp(true);
        return; // No mostrar alert, solo el diálogo
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'No se encontró ningún micrófono.\n\n' +
          'Verifica que tu dispositivo tenga un micrófono conectado.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = 'El micrófono está siendo usado por otra aplicación.\n\n' +
          'Cierra otras aplicaciones que puedan estar usando el micrófono e intenta de nuevo.';
      } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
        errorMessage = 'Configuración de audio no soportada por tu dispositivo.\n\n' +
          'Intenta con otro dispositivo o navegador.';
      } else if (error.name === 'SecurityError') {
        errorMessage = 'Error de seguridad al acceder al micrófono.\n\n' +
          '¿Estás usando HTTPS? La grabación de audio requiere una conexión segura.';
      } else if (error.name === 'AbortError') {
        errorMessage = 'La solicitud de acceso al micrófono fue cancelada.';
      } else if (error.name === 'TypeError') {
        errorMessage = 'Tu navegador no soporta grabación de audio.\n\n' +
          'Por favor usa un navegador moderno como Chrome, Firefox, Edge o Safari.';
      } else {
        errorMessage = 'No se pudo acceder al micrófono.\n\n' +
          'Verifica los permisos del navegador y que estés usando HTTPS.';
      }

      if (errorMessage) {
        alert(errorMessage);
      }
    }
  };

  const stopAudioRecording = () => {
    if (audioRecorder && audioRecorder.state === 'recording') {
      console.log('⏹️ Deteniendo grabación de audio...');
      audioRecorder.stop();
      setIsRecordingAudio(false);
    }
  };

  // ==========================================
  // RENDER
  // ==========================================

  const canAddMore = files.length < maxFiles;

  return (
    <div className="space-y-4">
      {/* Inputs ocultos */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={(e) => handleFilesSelected(e.target.files)}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handleFilesSelected(e.target.files)}
        className="hidden"
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        onChange={(e) => handleFilesSelected(e.target.files)}
        className="hidden"
      />

      {/* Botones de captura */}
      {canAddMore && (
        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleCapturePhoto}
            disabled={disabled}
            className="flex flex-col items-center gap-2 h-auto py-3"
          >
            <Camera className="w-6 h-6" />
            <span className="text-sm">Tomar Foto</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleSelectFromGallery}
            disabled={disabled}
            className="flex flex-col items-center gap-2 h-auto py-3"
          >
            <ImageIcon className="w-6 h-6" />
            <span className="text-sm">Galería</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleRecordVideo}
            disabled={disabled}
            className="flex flex-col items-center gap-2 h-auto py-3"
          >
            <Video className="w-6 h-6" />
            <span className="text-sm">Video</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={isRecordingAudio ? stopAudioRecording : startAudioRecording}
            disabled={disabled}
            className={`flex flex-col items-center gap-2 h-auto py-3 ${
              isRecordingAudio ? 'bg-red-50 border-red-300' : ''
            }`}
          >
            <Mic className={`w-6 h-6 ${isRecordingAudio ? 'text-red-600 animate-pulse' : ''}`} />
            <span className="text-sm">
              {isRecordingAudio ? 'Detener' : 'Audio'}
            </span>
          </Button>
        </div>
      )}

      {/* Lista de archivos */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              Archivos adjuntos ({files.length}/{maxFiles})
            </p>
          </div>

          <div className="space-y-2">
            {files.map((mediaFile) => (
              <div
                key={mediaFile.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                {/* Preview */}
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                  {mediaFile.type === 'image' && (
                    <img
                      src={mediaFile.url}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  )}
                  {mediaFile.type === 'video' && (
                    <div className="w-full h-full flex items-center justify-center bg-gray-300">
                      <Video className="w-6 h-6 text-gray-600" />
                    </div>
                  )}
                  {mediaFile.type === 'audio' && (
                    <div className="w-full h-full flex items-center justify-center bg-gray-300">
                      <Mic className="w-6 h-6 text-gray-600" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {mediaFile.file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(mediaFile.file.size)}
                  </p>
                </div>

                {/* Botón eliminar */}
                <button
                  onClick={() => handleRemoveFile(mediaFile.id)}
                  className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors flex-shrink-0"
                  disabled={disabled}
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Límite alcanzado */}
      {files.length >= maxFiles && (
        <p className="text-sm text-amber-600 text-center">
          Límite de {maxFiles} archivos alcanzado
        </p>
      )}

      {/* Información */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>• Máximo {maxFiles} archivos</p>
        <p>• Tamaño máximo por archivo: {MEDIA_CONFIG.maxFileSize / 1024 / 1024}MB</p>
        <p>• Formatos: JPG, PNG, MP4, WebM, MP3, WAV</p>
      </div>

      {/* Diálogo de ayuda de permisos */}
      <PermissionHelpDialog
        isOpen={showPermissionHelp}
        type={permissionHelpType}
        onClose={() => setShowPermissionHelp(false)}
      />
    </div>
  );
}