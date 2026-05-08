import React from 'react';
import { Button } from '../ui/button';
import { ArrowLeft, Shield, Users, MapPin, Bell, Phone, Star, Globe } from 'lucide-react';

interface AboutAppScreenProps {
  onBack: () => void;
}

export function AboutAppScreen({ onBack }: AboutAppScreenProps) {
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
          <h1 className="text-lg">Acerca de AlertaCiudadana</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* App Logo & Info */}
        <div className="p-6 text-center border-b border-gray-200">
          <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">AlertaCiudadana</h2>
          <p className="text-sm text-gray-600 mb-2">Versión 1.0.0</p>
          <p className="text-xs text-gray-500">Desarrollado para Colombia</p>
        </div>

        {/* Mission */}
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-medium text-gray-900 mb-3">Nuestra Misión</h3>
          <p className="text-sm text-gray-700 leading-relaxed">
            AlertaCiudadana es una plataforma de seguridad ciudadana colaborativa que conecta 
            a los colombianos para crear comunidades más seguras. Facilitamos la comunicación 
            rápida y efectiva durante emergencias, cumpliendo con las normativas nacionales 
            de seguridad y protección de datos.
          </p>
        </div>

        {/* Features */}
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-medium text-gray-900 mb-4">Características Principales</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center mt-0.5">
                <Bell className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-900">Alertas Instantáneas</h4>
                <p className="text-xs text-gray-600">
                  Reporta emergencias médicas, robos, accidentes, incendios y situaciones de violencia 
                  con un solo toque
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mt-0.5">
                <MapPin className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-900">Geolocalización Precisa</h4>
                <p className="text-xs text-gray-600">
                  Comparte tu ubicación exacta con autoridades y contactos de emergencia 
                  para respuesta rápida
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mt-0.5">
                <Users className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-900">Red Comunitaria</h4>
                <p className="text-xs text-gray-600">
                  Ve alertas de otros usuarios en tiempo real y mantente informado sobre 
                  tu zona y alrededores
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mt-0.5">
                <Phone className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-900">Contactos de Emergencia</h4>
                <p className="text-xs text-gray-600">
                  Notificación automática a familiares y contactos de confianza durante emergencias
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Compliance */}
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-medium text-gray-900 mb-3">Cumplimiento Normativo</h3>
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <h4 className="text-sm font-medium text-blue-900 mb-1">Ley 1273 de 2009</h4>
              <p className="text-xs text-blue-800">
                Protección de la información y los datos - Cumplimos con todas las disposiciones 
                sobre tratamiento de datos personales
              </p>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <h4 className="text-sm font-medium text-green-900 mb-1">Ley 1581 de 2012</h4>
              <p className="text-xs text-green-800">
                Régimen General de Protección de Datos Personales (Habeas Data) - 
                Garantizamos el derecho fundamental de habeas data
              </p>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <h4 className="text-sm font-medium text-purple-900 mb-1">Decreto 1377 de 2013</h4>
              <p className="text-xs text-purple-800">
                Reglamentación de la Ley 1581 - Implementamos medidas técnicas y 
                administrativas para la protección de datos
              </p>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-medium text-gray-900 mb-4">Impacto en Colombia</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center bg-gray-50 rounded-lg p-3">
              <div className="text-lg font-bold text-blue-600">24/7</div>
              <div className="text-xs text-gray-600">Disponibilidad</div>
            </div>
            <div className="text-center bg-gray-50 rounded-lg p-3">
              <div className="text-lg font-bold text-green-600">32 Dptos</div>
              <div className="text-xs text-gray-600">Departamentos</div>
            </div>
            <div className="text-center bg-gray-50 rounded-lg p-3">
              <div className="text-lg font-bold text-purple-600">1100+</div>
              <div className="text-xs text-gray-600">Municipios</div>
            </div>
            <div className="text-center bg-gray-50 rounded-lg p-3">
              <div className="text-lg font-bold text-red-600">&lt; 2min</div>
              <div className="text-xs text-gray-600">Tiempo respuesta</div>
            </div>
          </div>
        </div>

        {/* Contact & Support */}
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-medium text-gray-900 mb-3">Soporte y Contacto</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Email de soporte:</span>
              <span className="text-blue-600">soporte@alertaciudadana.co</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Línea de ayuda:</span>
              <span className="text-green-600">01-8000-ALERTA</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Horario de atención:</span>
              <span className="text-gray-900">24 horas, 7 días</span>
            </div>
          </div>
        </div>

        {/* Recognition */}
        <div className="p-4">
          <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-500" />
            Reconocimientos
          </h3>
          <div className="space-y-2 text-xs text-gray-600">
            <p>• Alianza con Policía Nacional de Colombia</p>
            <p>• Certificación ISO 27001 en Seguridad de la Información</p>
            <p>• Reconocimiento MinTIC 2024 - Innovación Digital</p>
            <p>• Partner oficial Cruz Roja Colombiana</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Globe className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-600">www.alertaciudadana.co</span>
          </div>
          <p className="text-xs text-gray-500">
            © 2024 AlertaCiudadana. Todos los derechos reservados.
            <br />
            Hecho con ❤️ para Colombia
          </p>
        </div>
      </div>
    </div>
  );
}