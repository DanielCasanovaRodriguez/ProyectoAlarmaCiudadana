import React, { useState, useEffect } from 'react';
import { ArrowLeft, Bell, Shield, Info, LogOut, Phone, Loader2, CheckCircle, ChevronRight, IdCard, AlertTriangle, Clock } from 'lucide-react';
import { Input }   from '../ui/input';
import { Switch }  from '../ui/switch';
import { getUserProfile, updateUserProfile } from '../../services/profileService';
import { obtenerPreferenciaCercanas, configurarAlertasCercanas } from '../../services/proximityService';
import type { MiIdentidad } from '../../services/identityService';
import { validarNombrePersona } from '../../utils/cedula';
import { normalizarCelular } from './RegisterScreen';
import { useOnlineStatus } from '../../platform/network';
import { isPushAvailable } from '../../platform';
import { APP_VERSION } from '../../config/app';
import { toUserMessage } from '../../utils/errors';
import { toast } from 'sonner';

interface ProfileScreenProps {
  user: {
    name:                   string;
    hasLocationPermission:  boolean;
    hasCompletedOnboarding: boolean;
  };
  onBack:                       () => void;
  onUpdateUser:                 (userData: Partial<{ name: string }>) => void;
  onNavigateToEmergencyContact: () => void;
  onNavigateToAbout:            () => void;
  onNavigateToPrivacy:          () => void;
  onLogout?:                    () => void;
  /** Verificación de identidad (undefined = cargando). */
  identidad?:                   MiIdentidad | null;
  onVerificarIdentidad?:        () => void;
}

export function ProfileScreen({
  user,
  onBack,
  onUpdateUser,
  onNavigateToEmergencyContact,
  onNavigateToAbout,
  onNavigateToPrivacy,
  onLogout,
  identidad,
  onVerificarIdentidad,
}: ProfileScreenProps) {
  const [nombres,   setNombres]   = useState('');
  const [apellidos, setApellidos] = useState('');
  const [phone,     setPhone]     = useState('');
  const [errores,   setErrores]   = useState<{ nombres?: string; apellidos?: string; phone?: string }>({});
  const [cercanas,  setCercanas]  = useState(true);
  const [guardandoCercanas, setGuardandoCercanas] = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const online = useOnlineStatus();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await getUserProfile();
      if (error) {
        toast.error('No se pudo cargar el perfil', { description: error });
      } else if (data) {
        setNombres(data.nombres ?? (data.full_name ?? user.name ?? '').split(' ')[0] ?? '');
        setApellidos(data.apellidos ?? '');
        setPhone(data.phone ?? '');
      }
      obtenerPreferenciaCercanas().then(setCercanas).catch(() => undefined);
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    const e: typeof errores = {};
    const eN = validarNombrePersona(nombres, 'nombres');     if (eN) e.nombres = eN;
    const eA = validarNombrePersona(apellidos, 'apellidos'); if (eA) e.apellidos = eA;
    const cel = phone.trim() ? normalizarCelular(phone) : null;
    if (phone.trim() && !cel) e.phone = 'Ingresa un celular colombiano de 10 dígitos';
    setErrores(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    setSaved(false);
    const { data, error } = await updateUserProfile('', {
      nombres:   nombres.trim().replace(/\s+/g, ' '),
      apellidos: apellidos.trim().replace(/\s+/g, ' '),
      phone:     cel,
    });
    setSaving(false);
    if (error) { toast.error('Error al guardar', { description: error }); return; }
    if (data?.full_name) onUpdateUser({ name: data.full_name });
    setSaved(true);
    toast.success('Perfil guardado');
    setTimeout(() => setSaved(false), 2500);
  };

  const cambiarCercanas = async (v: boolean) => {
    setCercanas(v);
    setGuardandoCercanas(true);
    try {
      await configurarAlertasCercanas(v);
      toast.success(v ? 'Te avisaremos de alertas cerca de ti' : 'Ya no recibirás avisos de alertas cercanas');
    } catch (err) {
      setCercanas(!v);
      toast.error('No se pudo guardar', { description: toUserMessage(err) });
    } finally {
      setGuardandoCercanas(false);
    }
  };

  const nombreCompleto = `${nombres} ${apellidos}`.trim();
  const initials = nombreCompleto
    ? [nombres.trim()[0], apellidos.trim()[0]].filter(Boolean).join('').toUpperCase()
    : '?';

  const tarjetaIdentidad = (() => {
    if (identidad === undefined) return { icono: Loader2, color: 'bg-gray-100 text-gray-500', titulo: 'Consultando verificación…', texto: '', accion: false, girar: true };
    if (identidad === null) return { icono: AlertTriangle, color: 'bg-amber-100 text-amber-700', titulo: 'Identidad sin verificar', texto: 'Verifica tu cédula para poder reportar alertas.', accion: true };
    if (identidad.estado === 'verificada') return { icono: CheckCircle, color: 'bg-green-100 text-green-700', titulo: 'Identidad verificada', texto: `Cédula terminada en ${identidad.ultimos_digitos}`, accion: false };
    if (identidad.estado === 'pendiente') return { icono: Clock, color: 'bg-blue-100 text-blue-700', titulo: 'Verificación en revisión', texto: `Cédula terminada en ${identidad.ultimos_digitos}. Ya puedes reportar alertas.`, accion: false };
    return { icono: AlertTriangle, color: 'bg-red-100 text-red-700', titulo: 'Verificación rechazada', texto: identidad.motivo_rechazo ? `Motivo: ${identidad.motivo_rechazo}` : 'Envía nuevas fotos de tu cédula.', accion: true };
  })();

  return (
    <div className="h-full bg-gray-50 flex flex-col">

      {/* ── Header con gradiente ───────────────────────────────── */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 px-4 pt-12 pb-6 relative">
        <button
          onClick={onBack}
          aria-label="Volver"
          className="absolute top-4 left-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="absolute top-4 right-4 px-4 h-9 flex items-center gap-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white text-sm font-medium disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : null}
          {saving ? 'Guardando' : saved ? 'Guardado' : 'Guardar'}
        </button>

        <div className="flex flex-col items-center mt-2">
          {loading ? (
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mb-3">
              <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full bg-white/25 border-2 border-white/40 flex items-center justify-center mb-3 shadow-lg">
              <span className="text-2xl font-bold text-white">{initials}</span>
            </div>
          )}
          <h1 className="text-xl font-bold text-white text-center">{nombreCompleto || 'Mi Perfil'}</h1>
          <p className="text-blue-100 text-sm mt-0.5">Ciudadano</p>
        </div>
      </div>

      {/* ── Contenido ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto -mt-3">

        {/* Tarjeta: Identidad */}
        <div className="mx-4 mb-4 bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${tarjetaIdentidad.color}`}>
              {React.createElement(tarjetaIdentidad.icono, { className: `w-4 h-4 ${tarjetaIdentidad.girar ? 'animate-spin' : ''}` })}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5"><IdCard className="w-3.5 h-3.5 text-gray-400" aria-hidden /> {tarjetaIdentidad.titulo}</p>
              {tarjetaIdentidad.texto && <p className="text-xs text-gray-500 mt-0.5">{tarjetaIdentidad.texto}</p>}
            </div>
            {tarjetaIdentidad.accion && onVerificarIdentidad && (
              <button onClick={onVerificarIdentidad} className="text-sm font-semibold text-blue-600 flex-shrink-0">Verificar</button>
            )}
          </div>
        </div>

        {/* Tarjeta: Datos personales */}
        <div className="mx-4 mb-4 bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Datos personales</p>
          </div>
          <div className="px-4 pb-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="perfil-nombres" className="text-xs text-gray-500 font-medium block mb-1">Nombres</label>
                <Input id="perfil-nombres" value={nombres} onChange={e => setNombres(e.target.value)} placeholder="Tus nombres"
                  className="bg-gray-50 border-gray-200" maxLength={60} autoComplete="given-name" aria-invalid={!!errores.nombres} />
                {errores.nombres && <p className="text-xs text-red-600 mt-1">{errores.nombres}</p>}
              </div>
              <div>
                <label htmlFor="perfil-apellidos" className="text-xs text-gray-500 font-medium block mb-1">Apellidos</label>
                <Input id="perfil-apellidos" value={apellidos} onChange={e => setApellidos(e.target.value)} placeholder="Tus apellidos"
                  className="bg-gray-50 border-gray-200" maxLength={60} autoComplete="family-name" aria-invalid={!!errores.apellidos} />
                {errores.apellidos && <p className="text-xs text-red-600 mt-1">{errores.apellidos}</p>}
              </div>
            </div>
            <div>
              <label htmlFor="perfil-telefono" className="text-xs text-gray-500 font-medium block mb-1">Celular</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input id="perfil-telefono" value={phone} onChange={e => setPhone(e.target.value)} placeholder="3001234567"
                  type="tel" inputMode="tel" className="pl-9 bg-gray-50 border-gray-200" aria-invalid={!!errores.phone} />
              </div>
              {errores.phone && <p className="text-xs text-red-600 mt-1">{errores.phone}</p>}
            </div>
          </div>
        </div>

        {/* Tarjeta: Notificaciones */}
        <div className="mx-4 mb-4 bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center">
                <Bell className="w-4 h-4 text-orange-600" />
              </div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Notificaciones</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-gray-900">Alertas cerca de mí</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Aviso cuando alguien reporta una alerta a 1 km o menos de tu última ubicación.
                {!isPushAvailable() && ' En este dispositivo lo verás mientras la app esté abierta.'}
              </p>
            </div>
            <Switch checked={cercanas} disabled={guardandoCercanas || loading} onCheckedChange={cambiarCercanas} aria-label="Alertas cerca de mí" />
          </div>
        </div>

        {/* Tarjeta: Estado */}
        <div className="mx-4 mb-4 bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                <Info className="w-4 h-4 text-gray-600" />
              </div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Estado de la app</p>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {[
              { label: 'Versión',   value: APP_VERSION },
              { label: 'Conexión',  value: online ? '● En línea' : '● Sin conexión', color: online ? 'text-green-600' : 'text-red-600' },
              { label: 'Ubicación', value: user.hasLocationPermission ? '● Activa' : '● Desactivada', color: user.hasLocationPermission ? 'text-green-600' : 'text-gray-400' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-600">{row.label}</span>
                <span className={`text-sm font-medium ${row.color ?? 'text-gray-900'}`}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tarjeta: Navegación */}
        <div className="mx-4 mb-4 bg-white rounded-2xl shadow-sm overflow-hidden">
          {[
            { label: 'Contactos de Emergencia',   icon: Phone,  color: 'bg-red-100 text-red-600',       action: onNavigateToEmergencyContact },
            { label: 'Acerca de AlertaCiudadana', icon: Info,   color: 'bg-purple-100 text-purple-600', action: onNavigateToAbout },
            { label: 'Política de Privacidad',    icon: Shield, color: 'bg-blue-100 text-blue-600',     action: onNavigateToPrivacy },
          ].map((item, i, arr) => (
            <button
              key={item.label}
              onClick={item.action}
              className={`w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-50 transition-colors text-left ${i < arr.length - 1 ? 'border-b border-gray-100' : ''}`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${item.color}`}>
                <item.icon className="w-4 h-4" />
              </div>
              <span className="flex-1 text-sm font-medium text-gray-900">{item.label}</span>
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </button>
          ))}
        </div>

        {onLogout && (
          <div className="mx-4 mb-8">
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 py-4 bg-white rounded-2xl shadow-sm text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Cerrar Sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
