import React, { useState } from 'react';
import { Button } from '../ui/button';
import { ArrowLeft, Shield, Eye, Database, Lock, AlertTriangle, CheckCircle } from 'lucide-react';

interface PrivacyPolicyScreenProps {
  onBack: () => void;
}

export function PrivacyPolicyScreen({ onBack }: PrivacyPolicyScreenProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (sectionId: string) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };

  return (
    <div className="h-full bg-white flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onBack}
            className="p-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg">Política de Privacidad</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Last Updated */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-medium text-gray-900">Política de Privacidad</h2>
              <p className="text-xs text-gray-500 mt-1">
                Última actualización: 15 de diciembre de 2024
              </p>
            </div>
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
          </div>
        </div>

        {/* Important Notice */}
        <div className="p-4">
          <div className="border-blue-200 bg-blue-50 border rounded-lg p-3 flex gap-3">
            <Shield className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-blue-800 text-sm">
              Esta política cumple con la Ley 1581 de 2012 (Habeas Data), Decreto 1377 de 2013, 
              y Ley 1273 de 2009 sobre protección de datos en Colombia.
            </p>
          </div>
        </div>

        {/* Privacy Sections */}
        <div className="divide-y divide-gray-200">
          {/* Data Collection */}
          <div className="p-4">
            <button
              onClick={() => toggleSection('collection')}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Database className="w-4 h-4 text-blue-600" />
                </div>
                <h3 className="font-medium text-gray-900">Recolección de Datos</h3>
              </div>
              <div className="text-gray-400 text-xl">
                {expandedSection === 'collection' ? '−' : '+'}
              </div>
            </button>
            
            {expandedSection === 'collection' && (
              <div className="mt-4 ml-11 space-y-3 text-sm text-gray-700">
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Datos que recolectamos:</h4>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Información personal: nombre, teléfono, email</li>
                    <li>Ubicación geográfica (solo durante emergencias)</li>
                    <li>Contactos de emergencia autorizados</li>
                    <li>Historial de alertas reportadas</li>
                    <li>Datos técnicos del dispositivo (modelo, versión OS)</li>
                  </ul>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                  <p className="text-xs text-yellow-800">
                    <strong>Importante:</strong> Solo recolectamos datos estrictamente necesarios 
                    para el funcionamiento del servicio de alertas de emergencia.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Data Usage */}
          <div className="p-4">
            <button
              onClick={() => toggleSection('usage')}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <Eye className="w-4 h-4 text-green-600" />
                </div>
                <h3 className="font-medium text-gray-900">Uso de la Información</h3>
              </div>
              <div className="text-gray-400 text-xl">
                {expandedSection === 'usage' ? '−' : '+'}
              </div>
            </button>
            
            {expandedSection === 'usage' && (
              <div className="mt-4 ml-11 space-y-3 text-sm text-gray-700">
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Utilizamos sus datos para:</h4>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Procesar y enviar alertas de emergencia</li>
                    <li>Notificar a contactos de emergencia configurados</li>
                    <li>Coordinación con autoridades competentes (Policía, Bomberos, etc.)</li>
                    <li>Mejorar la precisión del servicio de geolocalización</li>
                    <li>Generar estadísticas anónimas de seguridad ciudadana</li>
                  </ul>
                </div>
                <div className="bg-red-50 border border-red-200 rounded p-2">
                  <p className="text-xs text-red-800">
                    <strong>NO compartimos</strong> su información con terceros para fines comerciales 
                    o publicitarios. Solo con autoridades durante emergencias reales.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Data Security */}
          <div className="p-4">
            <button
              onClick={() => toggleSection('security')}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Lock className="w-4 h-4 text-purple-600" />
                </div>
                <h3 className="font-medium text-gray-900">Seguridad de Datos</h3>
              </div>
              <div className="text-gray-400 text-xl">
                {expandedSection === 'security' ? '−' : '+'}
              </div>
            </button>
            
            {expandedSection === 'security' && (
              <div className="mt-4 ml-11 space-y-3 text-sm text-gray-700">
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Medidas de seguridad:</h4>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Encriptación AES-256 para todos los datos sensibles</li>
                    <li>Servidores seguros ubicados en Colombia</li>
                    <li>Certificación ISO 27001 en Seguridad de la Información</li>
                    <li>Auditorías de seguridad trimestrales</li>
                    <li>Acceso restringido solo a personal autorizado</li>
                    <li>Respaldo automático y recuperación ante desastres</li>
                  </ul>
                </div>
                <div className="bg-green-50 border border-green-200 rounded p-2">
                  <p className="text-xs text-green-800">
                    Cumplimos con estándares internacionales de ciberseguridad y 
                    normativas colombianas de protección de datos.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* User Rights */}
          <div className="p-4">
            <button
              onClick={() => toggleSection('rights')}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Shield className="w-4 h-4 text-orange-600" />
                </div>
                <h3 className="font-medium text-gray-900">Sus Derechos (Habeas Data)</h3>
              </div>
              <div className="text-gray-400 text-xl">
                {expandedSection === 'rights' ? '−' : '+'}
              </div>
            </button>
            
            {expandedSection === 'rights' && (
              <div className="mt-4 ml-11 space-y-3 text-sm text-gray-700">
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Usted tiene derecho a:</h4>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li><strong>Acceso:</strong> Conocer qué datos tenemos sobre usted</li>
                    <li><strong>Actualización:</strong> Corregir datos inexactos o incompletos</li>
                    <li><strong>Rectificación:</strong> Modificar información cuando sea necesario</li>
                    <li><strong>Supresión:</strong> Solicitar eliminación de sus datos</li>
                    <li><strong>Revocatoria:</strong> Retirar consentimiento en cualquier momento</li>
                    <li><strong>Reclamo:</strong> Presentar quejas ante la Superintendencia de Industria y Comercio</li>
                  </ul>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded p-2">
                  <p className="text-xs text-blue-800">
                    Para ejercer estos derechos, contacte: 
                    <strong> privacidad@alertaciudadana.co</strong> o al 
                    <strong> 01-8000-ALERTA</strong>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Emergency Sharing */}
          <div className="p-4">
            <button
              onClick={() => toggleSection('emergency')}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                <h3 className="font-medium text-gray-900">Compartir en Emergencias</h3>
              </div>
              <div className="text-gray-400 text-xl">
                {expandedSection === 'emergency' ? '−' : '+'}
              </div>
            </button>
            
            {expandedSection === 'emergency' && (
              <div className="mt-4 ml-11 space-y-3 text-sm text-gray-700">
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <h4 className="font-medium text-red-900 mb-1">Situaciones de Emergencia</h4>
                  <p className="text-xs text-red-800 mb-2">
                    Durante emergencias reales, sus datos pueden ser compartidos automáticamente con:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-xs text-red-800">
                    <li>Policía Nacional de Colombia</li>
                    <li>Cuerpo de Bomberos local</li>
                    <li>Servicios médicos de emergencia (Cruz Roja, ambulancias)</li>
                    <li>Defensa Civil</li>
                    <li>Sus contactos de emergencia configurados</li>
                  </ul>
                </div>
                <p className="text-xs">
                  Esta compartición está amparada por el Código Nacional de Seguridad y Convivencia Ciudadana 
                  (Ley 1801 de 2016) para la protección de la vida e integridad de las personas.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Legal Framework */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <h3 className="font-medium text-gray-900 mb-3">Marco Legal</h3>
          <div className="space-y-2 text-xs text-gray-600">
            <p><strong>Ley 1581 de 2012:</strong> Régimen General de Protección de Datos Personales</p>
            <p><strong>Decreto 1377 de 2013:</strong> Reglamentación de la Ley 1581</p>
            <p><strong>Ley 1273 de 2009:</strong> Protección de la información y los datos</p>
            <p><strong>Ley 1801 de 2016:</strong> Código Nacional de Seguridad y Convivencia Ciudadana</p>
          </div>
        </div>

        {/* Contact Information */}
        <div className="p-4 border-t border-gray-200">
          <h3 className="font-medium text-gray-900 mb-3">Contacto para Privacidad</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Oficial de Privacidad:</span>
              <span className="text-blue-600">privacidad@alertaciudadana.co</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Teléfono:</span>
              <span className="text-green-600">01-8000-ALERTA</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Dirección:</span>
              <span className="text-gray-900">Calle 93 #13-24, Bogotá D.C.</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">SIC (Reclamos):</span>
              <span className="text-purple-600">www.sic.gov.co</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 text-center bg-gray-100">
          <p className="text-xs text-gray-500">
            Esta política puede actualizarse periódicamente. 
            Los cambios importantes serán notificados con 30 días de anticipación.
          </p>
        </div>
      </div>
    </div>
  );
}