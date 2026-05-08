import React, { useState, useEffect } from 'react';
import { ArrowLeft, User, Bell, Shield, Info, LogOut, Phone, Loader2, CheckCircle, ChevronRight } from 'lucide-react';
import { Button }  from '../ui/button';
import { Input }   from '../ui/input';
import { Switch }  from '../ui/switch';
import { getUserProfile, updateUserProfile } from '../../services/profileService';
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
}

export function ProfileScreen({
  user,
  onBack,
  onUpdateUser,
  onNavigateToEmergencyContact,
  onNavigateToAbout,
  onNavigateToPrivacy,
  onLogout,
}: ProfileScreenProps) {
  const [name,            setName]            = useState(user.name || '');
  const [phone,           setPhone]           = useState('');
  const [notifications,   setNotifications]   = useState(true);
  const [emergencyAlerts, setEmergencyAlerts] = useState(true);
  const [locationSharing, setLocationSharing] = useState(user.hasLocationPermission);
  const [loading,         setLoading]         = useState(true);
  const [saving,          setSaving]          = useState(false);
  const [saved,           setSaved]           = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await getUserProfile();
      if (error) {
        toast.error('No se pudo cargar el perfil');
      } else if (data) {
        setName( (data as any).full_name ?? user.name ?? '');
        setPhone((data as any).phone     ?? '');
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    const { data, error } = await updateUserProfile('', {
      full_name: name.trim() || null,
      phone:     phone.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error('Error al guardar', { description: error }); return; }
    if ((data as any)?.full_name) onUpdateUser({ name: (data as any).full_name });
    setSaved(true);
    toast.success('Perfil guardado');
    setTimeout(() => setSaved(false), 2500);
  };

  const initials = name.trim()
    ? name.trim().split(' ').map(n => n[0] ?? '').join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <div className="h-full bg-gray-50 flex flex-col">

      {/* ── Header con gradiente ───────────────────────────────── */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 px-4 pt-12 pb-6 relative">
        {/* Botón atrás */}
        <button
          onClick={onBack}
          className="absolute top-4 left-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        {/* Botón guardar */}
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="absolute top-4 right-4 px-4 h-9 flex items-center gap-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white text-sm font-medium disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <CheckCircle className="w-4 h-4" />
          ) : null}
          {saving ? 'Guardando' : saved ? 'Guardado' : 'Guardar'}
        </button>

        {/* Avatar + nombre */}
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
          <h1 className="text-xl font-bold text-white">{name || 'Mi Perfil'}</h1>
          <p className="text-blue-100 text-sm mt-0.5">Ciudadano</p>
        </div>
      </div>

      {/* ── Contenido ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto -mt-3">

        {/* Tarjeta: Datos personales */}
        <div className="mx-4 mb-4 bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Datos personales
            </p>
          </div>
          <div className="px-4 pb-4 space-y-3">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Nombre completo</label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Tu nombre"
                className="bg-gray-50 border-gray-200"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Teléfono</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+57 300 000 0000"
                  type="tel"
                  className="pl-9 bg-gray-50 border-gray-200"
                />
              </div>
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
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Notificaciones
              </p>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            <div className="flex items-center justify-between px-4 py-3.5">
              <div>
                <p className="text-sm font-medium text-gray-900">Notificaciones push</p>
                <p className="text-xs text-gray-500 mt-0.5">Recibe alertas en tu dispositivo</p>
              </div>
              <Switch checked={notifications} onCheckedChange={setNotifications} />
            </div>
            <div className="flex items-center justify-between px-4 py-3.5">
              <div>
                <p className="text-sm font-medium text-gray-900">Alertas de emergencia</p>
                <p className="text-xs text-gray-500 mt-0.5">Solo emergencias críticas</p>
              </div>
              <Switch checked={emergencyAlerts} onCheckedChange={setEmergencyAlerts} />
            </div>
          </div>
        </div>

        {/* Tarjeta: Privacidad */}
        <div className="mx-4 mb-4 bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                <Shield className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Privacidad
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-gray-900">Compartir ubicación</p>
              <p className="text-xs text-gray-500 mt-0.5">Para alertas más precisas</p>
            </div>
            <Switch checked={locationSharing} onCheckedChange={setLocationSharing} />
          </div>
        </div>

        {/* Tarjeta: Estado */}
        <div className="mx-4 mb-4 bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                <Info className="w-4 h-4 text-gray-600" />
              </div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Estado de la app
              </p>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {[
              { label: 'Versión',   value: '1.0.0' },
              { label: 'Conexión',  value: '● En línea', color: 'text-green-600' },
              { label: 'Ubicación', value: locationSharing ? '● Activa' : '● Desactivada', color: locationSharing ? 'text-green-600' : 'text-gray-400' },
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
            { label: 'Contactos de Emergencia', icon: Phone,  color: 'bg-red-100 text-red-600',    action: onNavigateToEmergencyContact },
            { label: 'Acerca de AlertaCiudadana', icon: Info, color: 'bg-purple-100 text-purple-600', action: onNavigateToAbout },
            { label: 'Política de Privacidad',  icon: Shield, color: 'bg-blue-100 text-blue-600',  action: onNavigateToPrivacy },
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

        {/* Cerrar sesión */}
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
