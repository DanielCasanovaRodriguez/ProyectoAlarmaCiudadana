import { useEffect, useState } from 'react';
import { MessageSquare, Phone, Users, Loader2 } from 'lucide-react';
import { getEmergencyContacts } from '../services/profileService';
import { enlaceMapa, LINEA_EMERGENCIAS } from '../config/colombia';

interface Props {
  nombreUsuario: string;
  tipoAlerta:    string;
  lat:           number;
  lng:           number;
  /** Abre la pantalla de contactos (cuando aún no hay ninguno). */
  onConfigurar?: () => void;
}

/** Solo dígitos con indicativo 57 (para wa.me y sms:). */
function digitosCO(telefono: string): string {
  const d = telefono.replace(/\D/g, '');
  return d.startsWith('57') ? d : `57${d}`;
}

/**
 * Avisar a los contactos de emergencia después de reportar. No hay envío
 * automático: se abre el SMS, WhatsApp o la llamada en el celular de la
 * persona, con el mensaje y la ubicación listos.
 */
export function AvisarContactos({ nombreUsuario, tipoAlerta, lat, lng, onConfigurar }: Props) {
  const [contactos, setContactos] = useState<{ name: string; phone: string }[] | null>(null);

  useEffect(() => {
    getEmergencyContacts().then(({ data }) => {
      setContactos((data ?? []).filter(c => c.notificar_sos).map(c => ({ name: c.name, phone: c.phone })));
    }).catch(() => setContactos([]));
  }, []);

  const quien = nombreUsuario.split(' ')[0] || 'Tu contacto';
  const mensaje = `🚨 ${quien} reportó una emergencia (${tipoAlerta}) en Alerta Ciudadana. `
    + `Ubicación: ${enlaceMapa(lat, lng)} . Si no responde, llama a la Línea ${LINEA_EMERGENCIAS}.`;
  const texto = encodeURIComponent(mensaje);

  if (contactos === null) {
    return (
      <div className="w-full max-w-sm flex items-center justify-center gap-2 text-sm text-gray-400 py-3">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Cargando contactos…
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-4">
      <p className="text-sm font-semibold text-blue-900 flex items-center gap-2 mb-1">
        <Users className="w-4 h-4" aria-hidden /> Avisa a tus contactos de emergencia
      </p>
      {contactos.length === 0 ? (
        <p className="text-xs text-blue-800">
          No tienes contactos registrados.{' '}
          {onConfigurar && <button onClick={onConfigurar} className="underline font-medium">Agregar contactos</button>}
        </p>
      ) : (
        <>
          <p className="text-xs text-blue-800 mb-3">Se abrirá tu app de mensajes con el aviso y tu ubicación listos para enviar.</p>
          <div className="space-y-2">
            {contactos.map(c => (
              <div key={c.phone} className="bg-white rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                <span className="text-sm text-gray-800 truncate">{c.name}</span>
                <div className="flex gap-1.5 flex-shrink-0">
                  <a href={`sms:+${digitosCO(c.phone)}?body=${texto}`} aria-label={`Enviar SMS a ${c.name}`}
                    className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4" aria-hidden />
                  </a>
                  <a href={`https://wa.me/${digitosCO(c.phone)}?text=${texto}`} target="_blank" rel="noopener noreferrer"
                    aria-label={`Enviar WhatsApp a ${c.name}`}
                    className="h-9 px-3 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-semibold">
                    WhatsApp
                  </a>
                  <a href={`tel:+${digitosCO(c.phone)}`} aria-label={`Llamar a ${c.name}`}
                    className="w-9 h-9 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center">
                    <Phone className="w-4 h-4" aria-hidden />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
