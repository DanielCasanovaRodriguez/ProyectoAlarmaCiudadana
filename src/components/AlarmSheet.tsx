import React, { useState } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Alert } from '../App';
import { AlertTriangle, Car, Shield, Flame, Users, X } from 'lucide-react';
import { MediaUpload } from './MediaUpload';
import { HoldToConfirmButton } from './HoldToConfirmButton';
import { MediaFile } from '../services/mediaService';
import { toast } from 'sonner';

// ================================================================
// TIPOS
// ================================================================

interface AlarmSheetProps {
  isOpen:        boolean;
  onClose:       () => void;
  // Recibe File[] crudos — App.tsx maneja todo el ciclo:
  //   1. Crear alerta en BD (obtener ID real)
  //   2. Subir archivos con el ID real
  //   3. Actualizar media_urls en la alerta
  onCreateAlert: (type: Alert['type'], description: string, files: File[]) => Promise<void>;
}

const alertTypes = [
  {
    type:        'medical'  as const,
    icon:        AlertTriangle,
    label:       'Emergencia Médica',
    color:       'bg-red-500',
    description: 'Situación que requiere atención médica inmediata',
  },
  {
    type:        'robbery'  as const,
    icon:        Shield,
    label:       'Robo / Asalto',
    color:       'bg-orange-500',
    description: 'Robo o asalto en progreso o reciente',
  },
  {
    type:        'accident' as const,
    icon:        Car,
    label:       'Accidente',
    color:       'bg-yellow-500',
    description: 'Accidente de tráfico o similar',
  },
  {
    type:        'fire'     as const,
    icon:        Flame,
    label:       'Incendio',
    color:       'bg-red-600',
    description: 'Incendio o emergencia con fuego',
  },
  {
    type:        'violence' as const,
    icon:        Users,
    label:       'Violencia',
    color:       'bg-purple-500',
    description: 'Situación de violencia o conflicto',
  },
];

// ================================================================
// COMPONENTE
// ================================================================

export function AlarmSheet({ isOpen, onClose, onCreateAlert }: AlarmSheetProps) {
  const [selectedType,  setSelectedType]  = useState<Alert['type'] | null>(null);
  const [description,   setDescription]   = useState('');
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const [mediaFiles,    setMediaFiles]    = useState<MediaFile[]>([]);

  const resetForm = () => {
    setSelectedType(null);
    setDescription('');
    setMediaFiles([]);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedType || isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Extraer File[] nativos del array de MediaFile
      const rawFiles = mediaFiles.map(mf => mf.file);

      // Delegar a App.tsx el ciclo completo:
      // crear en BD → subir archivos → actualizar media_urls
      await onCreateAlert(selectedType, description, rawFiles);

      resetForm();
    } catch (error: any) {
      console.error('Error al enviar alarma:', error);
      toast.error('Error al enviar la alarma', {
        description: error.message || 'Por favor intenta de nuevo',
      });
      setIsSubmitting(false);
    }
  };

  // Limpiar formulario cada vez que se abre el modal
  React.useEffect(() => {
    if (isOpen) resetForm();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                Reportar Alarma Ciudadana
              </h2>
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Contenido scrollable */}
          <div className="px-6 py-5 overflow-y-auto flex-1 space-y-5">

            {/* Tipo de emergencia */}
            <div>
              <h3 className="mb-3 text-sm font-medium text-gray-900">
                Selecciona el tipo de emergencia:
              </h3>
              <div className="space-y-2">
                {alertTypes.map(alertType => {
                  const Icon       = alertType.icon;
                  const isSelected = selectedType === alertType.type;

                  return (
                    <button
                      key={alertType.type}
                      onClick={() => setSelectedType(alertType.type)}
                      disabled={isSubmitting}
                      className={`
                        w-full p-3 rounded-xl border-2 text-left transition-all
                        ${isSelected
                          ? 'border-blue-500 bg-blue-50 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${alertType.color} flex-shrink-0`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {alertType.label}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {alertType.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Descripción */}
            {selectedType && (
              <div className="space-y-1.5">
                <label htmlFor="description" className="block text-sm font-medium text-gray-900">
                  Descripción{' '}
                  <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <Textarea
                  id="description"
                  placeholder="Describe brevemente la situación..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  disabled={isSubmitting}
                  className="resize-none"
                />
              </div>
            )}

            {/* Evidencia multimedia */}
            {selectedType && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-900">
                  Evidencia multimedia{' '}
                  <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <MediaUpload
                  files={mediaFiles}
                  onFilesChange={setMediaFiles}
                  disabled={isSubmitting}
                />
              </div>
            )}

            {/* Aviso legal */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
              <div className="flex gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-800">
                  <strong>Importante:</strong> Solo reporta emergencias reales.
                  El mal uso puede tener consecuencias legales.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancelar
            </Button>
            <HoldToConfirmButton
              onConfirm={handleSubmit}
              disabled={!selectedType || isSubmitting}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Enviando...
                </span>
              ) : (
                'Mantén para enviar'
              )}
            </HoldToConfirmButton>
          </div>
        </div>
      </div>
    </>
  );
}
