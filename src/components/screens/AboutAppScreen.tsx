import { ArrowLeft, Shield, Users, MapPin, Bell, Phone, Lock, Scale } from 'lucide-react';
import { APP_VERSION } from '../../config/app';
import { LINEAS_EMERGENCIA, LINEA_EMERGENCIAS } from '../../config/colombia';
import { RESPONSABLE } from '../../config/legal';

interface AboutAppScreenProps {
  onBack: () => void;
}

/** Información de la app: solo hechos verificables (sin alianzas ni cifras no comprobadas). */
export function AboutAppScreen({ onBack }: AboutAppScreenProps) {
  const funciones = [
    { icon: Bell,   color: 'bg-red-100 text-red-600',       titulo: 'Reporte de emergencias', texto: 'Emergencia médica, robo, accidente, incendio o violencia, con fotos, video o audio opcionales.' },
    { icon: MapPin, color: 'bg-blue-100 text-blue-600',     titulo: 'Ubicación real',          texto: 'Cada alerta lleva la ubicación GPS de tu celular para que el personal sepa dónde ocurre.' },
    { icon: Users,  color: 'bg-green-100 text-green-600',   titulo: 'Avisos a 1 km',           texto: 'Las personas cercanas reciben un aviso con el tipo y el lugar de la alerta, sin tus datos.' },
    { icon: Phone,  color: 'bg-purple-100 text-purple-600', titulo: 'Tus contactos',           texto: 'Tras reportar, avisa a tus contactos de emergencia por SMS, WhatsApp o llamada con un toque.' },
    { icon: Bell,   color: 'bg-blue-100 text-blue-600',     titulo: 'Mapa siempre al día',    texto: 'Cada alerta se ve máximo 1 hora; luego se cierra sola. Puedes mover el mapa a cualquier ciudad.' },
    { icon: Lock,   color: 'bg-amber-100 text-amber-700',   titulo: 'Una cédula, una cuenta',  texto: 'Cédula cifrada, límites de envío y bloqueo de cuentas con alertas falsas.' },
  ];

  return (
    <div className="h-full bg-white flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b">
        <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full" aria-label="Volver">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-base font-semibold text-gray-900">Acerca de Alerta Ciudadana</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 text-center border-b border-gray-200">
          <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-10 h-10 text-white" aria-hidden />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Alerta Ciudadana</h2>
          <p className="text-sm text-gray-600">Versión {APP_VERSION}</p>
          <p className="text-xs text-gray-500 mt-1">{RESPONSABLE.naturaleza} · Colombia</p>
        </div>

        <div className="p-4 border-b border-gray-200">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-900">
            <strong>Alerta Ciudadana no reemplaza a las autoridades.</strong> Si hay una vida en riesgo, llama primero a la{' '}
            <a href={`tel:${LINEA_EMERGENCIAS}`} className="font-bold underline">Línea {LINEA_EMERGENCIAS}</a>.
          </div>
        </div>

        <div className="p-4 border-b border-gray-200">
          <h3 className="font-medium text-gray-900 mb-2">Qué es</h3>
          <p className="text-sm text-gray-700 leading-relaxed">
            Una herramienta comunitaria para reportar situaciones de riesgo en Colombia y avisar al personal que las
            atiende y a las personas que están cerca. Funciona en la web y como aplicación Android.
          </p>
        </div>

        <div className="p-4 border-b border-gray-200">
          <h3 className="font-medium text-gray-900 mb-3">Funciones</h3>
          <div className="space-y-3">
            {funciones.map(f => (
              <div key={f.titulo} className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mt-0.5 flex-shrink-0 ${f.color}`}>
                  <f.icon className="w-4 h-4" aria-hidden />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-900">{f.titulo}</h4>
                  <p className="text-xs text-gray-600">{f.texto}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-b border-gray-200">
          <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Scale className="w-4 h-4 text-gray-500" aria-hidden /> Marco legal
          </h3>
          <ul className="text-xs text-gray-700 space-y-1.5 list-disc pl-4">
            <li><strong>Ley 1581 de 2012</strong> y <strong>Decreto 1377 de 2013</strong>: protección de datos personales (habeas data). Ejerce tus derechos en Perfil → Mis datos y derechos.</li>
            <li><strong>Ley 1273 de 2009</strong>: delitos informáticos; acceder sin permiso a cuentas o datos ajenos es delito.</li>
            <li><strong>Ley 1801 de 2016, art. 35 num. 7</strong>: el uso indebido de la Línea 123 se sanciona con multa.</li>
            <li><strong>Ley 599 de 2000, art. 296</strong>: suplantar a otra persona puede constituir falsedad personal.</li>
          </ul>
        </div>

        <div className="p-4 border-b border-gray-200">
          <h3 className="font-medium text-gray-900 mb-3">Líneas de atención en Colombia</h3>
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
            {LINEAS_EMERGENCIA.map(l => (
              <a key={l.numero} href={`tel:${l.numero}`} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-gray-50">
                <span className="text-xs text-gray-700"><strong>{l.nombre}</strong> · {l.uso}</span>
                <span className="font-mono font-bold text-sm text-blue-700">{l.numero}</span>
              </a>
            ))}
          </div>
        </div>

        <div className="p-4 bg-gray-50 text-center">
          <p className="text-xs text-gray-500">
            Soporte y solicitudes: {RESPONSABLE.canal}.
            <br />© {new Date().getFullYear()} {RESPONSABLE.nombre}
          </p>
        </div>
      </div>
    </div>
  );
}
