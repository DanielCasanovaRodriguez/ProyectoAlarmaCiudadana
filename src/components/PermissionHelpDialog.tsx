/**
 * Diálogo de Ayuda de Permisos
 * Muestra instrucciones visuales para habilitar permisos de cámara/micrófono
 */

import React from 'react';
import { X, AlertCircle, Lock, Info, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';

interface PermissionHelpDialogProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'microphone' | 'camera';
}

export function PermissionHelpDialog({ isOpen, onClose, type }: PermissionHelpDialogProps) {
  if (!isOpen) return null;

  const permissionName = type === 'microphone' ? 'Micrófono' : 'Cámara';
  const icon = type === 'microphone' ? '🎤' : '📷';

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white px-6 pt-6 pb-4 border-b border-gray-100">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-2xl">
                  {icon}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Permiso de {permissionName}
                  </h2>
                  <p className="text-sm text-gray-600">
                    Necesario para esta función
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-5 space-y-5">
            {/* Alerta */}
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-orange-800">
                  <p className="font-medium mb-1">Permiso Denegado</p>
                  <p>
                    El navegador bloqueó el acceso al {permissionName.toLowerCase()}. 
                    Sigue estos pasos para habilitarlo.
                  </p>
                </div>
              </div>
            </div>

            {/* Instrucciones por navegador */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">
                Cómo Habilitar Permisos
              </h3>

              {/* Chrome/Edge */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Lock className="w-4 h-4 text-blue-600" />
                  </div>
                  <p className="font-medium text-gray-900">
                    Chrome / Edge / Brave
                  </p>
                </div>
                
                <ol className="text-sm text-gray-700 space-y-2 ml-10 list-decimal">
                  <li>
                    Busca el ícono de <strong>candado</strong> 🔒 o <strong>información</strong> ℹ️ 
                    en la barra de direcciones (izquierda arriba)
                  </li>
                  <li>
                    Haz clic en él
                  </li>
                  <li>
                    Busca "<strong>{permissionName}</strong>" en la lista de permisos
                  </li>
                  <li>
                    Cambia de "Bloquear" a "<strong>Permitir</strong>"
                  </li>
                  <li>
                    Recarga la página (F5 o ⌘+R)
                  </li>
                  <li>
                    Intenta de nuevo
                  </li>
                </ol>
              </div>

              {/* Firefox */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                    <Info className="w-4 h-4 text-orange-600" />
                  </div>
                  <p className="font-medium text-gray-900">
                    Firefox
                  </p>
                </div>
                
                <ol className="text-sm text-gray-700 space-y-2 ml-10 list-decimal">
                  <li>
                    Haz clic en el ícono de <strong>información</strong> ℹ️ en la barra de direcciones
                  </li>
                  <li>
                    Click en "Conexión segura"
                  </li>
                  <li>
                    Click en "Más información"
                  </li>
                  <li>
                    Pestaña "<strong>Permisos</strong>"
                  </li>
                  <li>
                    Busca "Usar el {permissionName.toLowerCase()}"
                  </li>
                  <li>
                    Desmarca "Usar predeterminada" y marca "<strong>Permitir</strong>"
                  </li>
                  <li>
                    Recarga la página
                  </li>
                </ol>
              </div>

              {/* Safari */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Lock className="w-4 h-4 text-blue-600" />
                  </div>
                  <p className="font-medium text-gray-900">
                    Safari (macOS)
                  </p>
                </div>
                
                <ol className="text-sm text-gray-700 space-y-2 ml-10 list-decimal">
                  <li>
                    Safari → <strong>Preferencias</strong> (o Configuración)
                  </li>
                  <li>
                    Pestaña "<strong>Sitios web</strong>"
                  </li>
                  <li>
                    Click en "{permissionName}" (lado izquierdo)
                  </li>
                  <li>
                    Busca este sitio en la lista
                  </li>
                  <li>
                    Cambia a "<strong>Permitir</strong>"
                  </li>
                  <li>
                    Recarga la página
                  </li>
                </ol>
              </div>

              {/* Mobile */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                    <span className="text-sm">📱</span>
                  </div>
                  <p className="font-medium text-gray-900">
                    Móvil (Chrome/Safari)
                  </p>
                </div>
                
                <ol className="text-sm text-gray-700 space-y-2 ml-10 list-decimal">
                  <li>
                    Toca el ícono de <strong>candado</strong> 🔒 en la barra de direcciones
                  </li>
                  <li>
                    Busca "Permisos" o "Configuración del sitio"
                  </li>
                  <li>
                    Busca "{permissionName}"
                  </li>
                  <li>
                    Cambia a "<strong>Permitir</strong>"
                  </li>
                  <li>
                    Vuelve a la página y recarga
                  </li>
                </ol>
              </div>
            </div>

            {/* Requisitos */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex gap-3">
                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 space-y-2">
                  <p className="font-medium">Requisitos Importantes:</p>
                  <ul className="space-y-1 ml-4 list-disc">
                    <li>
                      <strong>Conexión HTTPS:</strong> La grabación requiere conexión segura 
                      (excepto en localhost)
                    </li>
                    <li>
                      <strong>Navegador moderno:</strong> Chrome 53+, Firefox 36+, Safari 11+, Edge 79+
                    </li>
                    <li>
                      <strong>{permissionName} conectado:</strong> Verifica que tu dispositivo 
                      tenga un {permissionName.toLowerCase()} funcionando
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Problemas comunes */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 text-sm">
                ¿Sigue sin funcionar?
              </h4>
              <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
                <li>Verifica que ninguna otra aplicación esté usando el {permissionName.toLowerCase()}</li>
                <li>Prueba con otro navegador</li>
                <li>Verifica los permisos del sistema operativo</li>
                <li>Reinicia el navegador</li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-gray-100">
            <Button
              onClick={onClose}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              Entendido
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
