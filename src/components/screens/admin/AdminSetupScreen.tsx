import { useState, useEffect } from 'react';
import { toUserMessage } from '../../../utils/errors';
import { Shield, CheckCircle2, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Alert, AlertDescription } from '../../ui/alert';
import { supabase } from '../../../utils/supabase/client';

interface AdminSetupScreenProps {
  onSetupComplete: () => void;
}

export function AdminSetupScreen({ onSetupComplete }: AdminSetupScreenProps) {
  const [loading,      setLoading]      = useState(false);
  const [success,      setSuccess]      = useState(false);
  const [error,        setError]        = useState('');
  const [checking,     setChecking]     = useState(true);
  const [setupNeeded,  setSetupNeeded]  = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Credenciales del primer administrador
  const adminEmail    = 'mrshyn@outlook.com';
  const adminPassword = 'ArbolRojo1!';
  const adminName     = 'Administrador Principal';

  useEffect(() => {
    checkSetupStatus();
  }, []);

  // Verifica si ya existe un admin en la tabla profiles
  const checkSetupStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        // Ya existe un admin — ir directo al login
        onSetupComplete();
      } else {
        // No hay admin — mostrar formulario de setup
        setSetupNeeded(true);
      }
    } catch (err: any) {
      console.error('Error verificando setup:', err);
      // Si hay error de permisos (RLS), asumir que se necesita setup
      setSetupNeeded(true);
    } finally {
      setChecking(false);
    }
  };

  // Crea el primer administrador directamente en Supabase Auth
  const handleSetup = async () => {
    setError('');
    setLoading(true);

    try {
      // 1. Crear el usuario en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email:    adminEmail,
        password: adminPassword,
        options: {
          data: {
            full_name: adminName,
            role:      'admin',
          },
        },
      });

      if (authError) {
        // Si el usuario ya existe, continuar al login
        if (authError.message.includes('already registered')) {
          setSuccess(true);
          setTimeout(() => onSetupComplete(), 2000);
          return;
        }
        throw authError;
      }

      if (!authData.user) throw new Error('No se pudo crear el usuario administrador.');

      // 2. Asegurarse de que el perfil tenga role='admin'
      // (el trigger lo crea con 'citizen' por defecto si el metadata no lo sobreescribe)
      await supabase
        .from('profiles')
        .update({ role: 'admin', status: 'active' })
        .eq('id', authData.user.id);

      setSuccess(true);
      setTimeout(() => onSetupComplete(), 2000);

    } catch (err: any) {
      console.error('Error en setup:', err);
      setError(toUserMessage(err, 'Error al configurar el administrador'));
      setLoading(false);
    }
  };

  // ── Pantalla de carga ─────────────────────────────────────────────
  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
          <p className="text-lg">Verificando configuración...</p>
        </div>
      </div>
    );
  }

  if (!setupNeeded) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Encabezado */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl">
            <Shield className="w-12 h-12 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Configuración Inicial
          </h1>
          <p className="text-blue-100">
            Panel de Administrador • AlertaCiudadana
          </p>
        </div>

        {/* Tarjeta principal */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {success ? (
            // Estado de éxito
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                ¡Configuración Exitosa!
              </h2>
              <p className="text-gray-600 mb-6">
                El administrador ha sido creado correctamente.
              </p>
              <div className="bg-green-50 rounded-lg p-4 text-left space-y-2">
                <p className="text-sm text-green-900">
                  <strong>Email:</strong> {adminEmail}
                </p>
                <p className="text-sm text-green-900">
                  <strong>Contraseña:</strong> {adminPassword}
                </p>
              </div>
              <p className="text-xs text-gray-400 mt-4">Redirigiendo al login...</p>
            </div>
          ) : (
            // Formulario de setup
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-1">
                  Crear Primer Administrador
                </h2>
                <p className="text-sm text-gray-500">
                  Se creará el usuario administrador principal del sistema.
                </p>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    value={adminEmail}
                    readOnly
                    disabled
                    className="mt-1.5 bg-gray-50"
                  />
                </div>

                <div>
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={adminPassword}
                      readOnly
                      disabled
                      className="bg-gray-50 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      tabIndex={-1}
                    >
                      {showPassword
                        ? <EyeOff className="w-5 h-5" />
                        : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="name">Nombre</Label>
                  <Input
                    id="name"
                    type="text"
                    value={adminName}
                    readOnly
                    disabled
                    className="mt-1.5 bg-gray-50"
                  />
                </div>
              </div>

              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="bg-blue-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-900 font-medium mb-2">
                  ℹ️ Información Importante
                </p>
                <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                  <li>Este es el administrador principal del sistema</li>
                  <li>Podrás cambiar la contraseña después del login</li>
                  <li>Desde el panel podrás crear más usuarios</li>
                  <li>Guarda estas credenciales en un lugar seguro</li>
                </ul>
              </div>

              <Button
                onClick={handleSetup}
                className="w-full"
                size="lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Configurando sistema...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-5 w-5" />
                    Crear Administrador
                  </>
                )}
              </Button>
            </>
          )}
        </div>

        <p className="text-center text-white/70 text-xs mt-6">
          AlertaCiudadana © 2025 • Conforme a la Ley 1581/2012
        </p>
      </div>
    </div>
  );
}
