import React, { useState, useEffect } from 'react';
import { ArrowLeft, User, Bell, Shield, Save, Loader2, CheckCircle } from 'lucide-react';
import { Button }    from '../../ui/button';
import { Input }     from '../../ui/input';
import { Label }     from '../../ui/label';
import { Switch }    from '../../ui/switch';
import { Separator } from '../../ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { getUserProfile, updateUserProfile } from '../../../services/profileService';
import { toast } from 'sonner';

interface OperatorSettingsScreenProps {
  onBack: () => void;
  onSave: () => void;
}

export function OperatorSettingsScreen({ onBack, onSave }: OperatorSettingsScreenProps) {
  // ── Perfil del operador ───────────────────────────────────────
  const [name,         setName]         = useState('');
  const [phone,        setPhone]        = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);

  // ── Preferencias locales (no persisten en BD — no hay tabla para esto) ─
  const [notifNewIncidents, setNotifNewIncidents] = useState(true);
  const [notifHighSeverity, setNotifHighSeverity] = useState(true);
  const [notifSlaWarnings,  setNotifSlaWarnings]  = useState(true);
  const [soundAlerts,       setSoundAlerts]       = useState(true);
  const [autoRefresh,       setAutoRefresh]       = useState(true);
  const [refreshInterval,   setRefreshInterval]   = useState('15');

  // ── Cargar perfil desde Supabase ──────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoadingProfile(true);
      const { data, error } = await getUserProfile();
      if (error) {
        toast.error('No se pudo cargar el perfil');
      } else if (data) {
        setName( data.full_name ?? '');
        setPhone(data.phone     ?? '');
      }
      setLoadingProfile(false);
    };
    load();
  }, []);

  // ── Guardar perfil en Supabase ────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setSaved(false);

    const { error } = await updateUserProfile('', {
      full_name: name.trim() || null,
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
    <div className="h-screen flex flex-col bg-gray-50">

      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="w-5 h-5 mr-2" />
              Volver al panel
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Configuración</h1>
              <p className="text-sm text-gray-500">Ajustes de perfil y preferencias</p>
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving || loadingProfile}
            className="bg-blue-600 hover:bg-blue-700 min-w-[120px]"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</>
            ) : saved ? (
              <><CheckCircle className="w-4 h-4 mr-2" />Guardado</>
            ) : (
              <><Save className="w-4 h-4 mr-2" />Guardar</>
            )}
          </Button>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Perfil — conectado a Supabase */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
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
                <div>
                  <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Nombre completo
                  </Label>
                  <Input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Tu nombre"
                    className="mt-1.5"
                  />
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
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Bell className="w-4 h-4 text-yellow-600" />
              </div>
              <h2 className="text-base font-semibold text-gray-900">Notificaciones</h2>
            </div>

            <div className="space-y-4">
              {[
                { label: 'Nuevos incidentes',     desc: 'Aviso al llegar un incidente nuevo',             value: notifNewIncidents, set: setNotifNewIncidents },
                { label: 'Alta severidad',        desc: 'Prioridad para incidentes críticos',             value: notifHighSeverity, set: setNotifHighSeverity },
                { label: 'Advertencias de SLA',   desc: 'Aviso cuando el tiempo límite está por vencer',  value: notifSlaWarnings,  set: setNotifSlaWarnings  },
              ].map((item, i) => (
                <React.Fragment key={item.label}>
                  {i > 0 && <Separator />}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                    </div>
                    <Switch checked={item.value} onCheckedChange={item.set} />
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Preferencias */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-purple-600" />
              </div>
              <h2 className="text-base font-semibold text-gray-900">Preferencias</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Alertas de sonido</p>
                  <p className="text-xs text-gray-500 mt-0.5">Reproducir sonido en nuevos incidentes</p>
                </div>
                <Switch checked={soundAlerts} onCheckedChange={setSoundAlerts} />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Actualización automática</p>
                  <p className="text-xs text-gray-500 mt-0.5">Refrescar incidentes sin acción manual</p>
                </div>
                <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              </div>

              {autoRefresh && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Intervalo de actualización
                    </Label>
                    <Select value={refreshInterval} onValueChange={setRefreshInterval}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 segundos</SelectItem>
                        <SelectItem value="30">30 segundos</SelectItem>
                        <SelectItem value="60">1 minuto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
