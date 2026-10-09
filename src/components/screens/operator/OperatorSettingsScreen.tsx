import React, { useState, useEffect } from 'react';
import { validarNombrePersona } from '../../../utils/cedula';
import { ArrowLeft, User, Bell, Save, Loader2, CheckCircle, LogOut } from 'lucide-react';
import { Button }    from '../../ui/button';
import { Input }     from '../../ui/input';
import { Label }     from '../../ui/label';
import { isPushAvailable } from '../../../platform';
import { probarNotificaciones } from '../../../services/notificacionesService';
import { getUserProfile, updateUserProfile } from '../../../services/profileService';
import { toast } from 'sonner';

interface OperatorSettingsScreenProps {
  onBack: () => void;
  onSave: () => void;
  onLogout?: () => void;
}

export function OperatorSettingsScreen({ onBack, onSave, onLogout }: OperatorSettingsScreenProps) {
  // ── Perfil del operador ───────────────────────────────────────
  const [nombres,      setNombres]      = useState('');
  const [apellidos,    setApellidos]    = useState('');
  const [phone,        setPhone]        = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);

  // ── Prueba de notificaciones (Android) ────────────────────────
  const [probando, setProbando] = useState(false);
  const probar = async () => {
    setProbando(true);
    try {
      const r = await probarNotificaciones();
      if (r.ok) toast.success('Prueba enviada', { description: 'En unos segundos debe llegar la notificación.' });
      else toast.error('No se pudo enviar la prueba', {
        description: r.motivo === 'sin_permiso' ? 'Activa las notificaciones de la app en los ajustes del teléfono.'
          : r.motivo === 'espera' ? 'Espera un minuto antes de otra prueba.'
          : 'No pudimos registrar este celular. Intenta de nuevo.',
      });
    } catch (err) {
      toast.error('No se pudo enviar la prueba');
    } finally {
      setProbando(false);
    }
  };

  // ── Cargar perfil desde Supabase ──────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoadingProfile(true);
      const { data, error } = await getUserProfile();
      if (error) {
        toast.error('No se pudo cargar el perfil');
      } else if (data) {
        setNombres(data.nombres ?? data.full_name ?? '');
        setApellidos(data.apellidos ?? '');
        setPhone(data.phone     ?? '');
      }
      setLoadingProfile(false);
    };
    load();
  }, []);

  // ── Guardar perfil en Supabase ────────────────────────────────
  const handleSave = async () => {
    setSaved(false);

    if (validarNombrePersona(nombres, 'nombres') || validarNombrePersona(apellidos, 'apellidos')) {
      toast.error('Revisa tu nombre', { description: validarNombrePersona(nombres, 'nombres') ?? validarNombrePersona(apellidos, 'apellidos') ?? '' });
      return;
    }
    setSaving(true);
    const { error } = await updateUserProfile('', {
      nombres:   nombres.trim().replace(/\s+/g, ' '),
      apellidos: apellidos.trim().replace(/\s+/g, ' '),
      phone:     phone.trim() || null,
    });

    setSaving(false);

    if (error) {
      toast.error('Error al guardar perfil', { description: error });
      return;
    }

    setSaved(true);
    toast.success('Configuración guardada');
    setTimeout(() => { setSaved(false); onSave(); }, 1200);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">

      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-3 sm:px-6 py-2.5 sm:py-4"
        style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 sm:gap-4 min-w-0">
            <Button variant="ghost" size="sm" onClick={onBack} aria-label="Volver al panel" className="px-2">
              <ArrowLeft className="w-5 h-5 sm:mr-2" />
              <span className="hidden sm:inline">Volver al panel</span>
            </Button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-gray-900 truncate">Configuración</h1>
              <p className="hidden sm:block text-sm text-gray-500">Tu perfil y notificaciones</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving || loadingProfile} className="bg-blue-600 hover:bg-blue-700 flex-shrink-0">
            {saving ? (
              <><Loader2 className="w-4 h-4 sm:mr-2 animate-spin" /><span className="hidden sm:inline">Guardando…</span></>
            ) : saved ? (
              <><CheckCircle className="w-4 h-4 mr-2" />Guardado</>
            ) : (
              <><Save className="w-4 h-4 mr-2" />Guardar</>
            )}
          </Button>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-auto p-3 sm:p-6">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Perfil — conectado a Supabase */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <User className="w-4 h-4 text-blue-600" />
              </div>
              <h2 className="text-base font-semibold text-gray-900">Perfil</h2>
            </div>

            {loadingProfile ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Cargando datos del perfil...
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="op-nombres" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombres</Label>
                    <Input id="op-nombres" value={nombres} onChange={e => setNombres(e.target.value)} placeholder="Tus nombres" className="mt-1.5" maxLength={60} />
                  </div>
                  <div>
                    <Label htmlFor="op-apellidos" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Apellidos</Label>
                    <Input id="op-apellidos" value={apellidos} onChange={e => setApellidos(e.target.value)} placeholder="Tus apellidos" className="mt-1.5" maxLength={60} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Teléfono
                  </Label>
                  <Input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+57 300 000 0000"
                    type="tel"
                    className="mt-1.5"
                  />
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-blue-700">
                    Para cambiar tu correo o contraseña, usa la opción "Olvidé mi contraseña" en la pantalla de login.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Notificaciones */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Bell className="w-4 h-4 text-yellow-600" />
              </div>
              <h2 className="text-base font-semibold text-gray-900">Notificaciones</h2>
            </div>
            <ul className="text-sm text-gray-700 space-y-1.5 mb-4">
              <li>• Recibes un aviso por <strong>cada alerta nueva</strong> del país, al instante.</li>
              <li>• Tocar el aviso abre el incidente en tu panel.</li>
              <li>• Cada alerta se cierra sola 1 hora después de reportada.</li>
            </ul>
            {isPushAvailable() ? (
              <>
                <Button onClick={probar} disabled={probando} variant="outline" className="w-full">
                  {probando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bell className="w-4 h-4 mr-2" />}
                  Probar notificaciones
                </Button>
                <p className="text-xs text-gray-500 mt-2">
                  Para que lleguen con la app cerrada: permite las notificaciones y pon la batería de la app en "Sin restricciones".
                </p>
              </>
            ) : (
              <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
                En la web los avisos aparecen mientras el panel está abierto. Para recibirlos con el celular bloqueado, usa la app Android.
              </p>
            )}
          </div>

          {onLogout && (
            <Button onClick={onLogout} variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50">
              <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión
            </Button>
          )}

        </div>
      </div>
    </div>
  );
}
