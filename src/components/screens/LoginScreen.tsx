import React, { useState } from 'react';
import { ArrowLeft, AlertCircle, Mail } from 'lucide-react';
import { Button } from '../ui/button';
import { AuthInput } from '../auth/AuthInput';
import { CodigoInput } from '../auth/CodigoInput';
import {
  signIn, cerrarSesion, iniciarSesionConCedula, confirmarCorreoConCedula, AccesoCedulaError,
} from '../../services/authService';
import { getCurrentUserProfile } from '../../services/adminService';
import { validarNumeroCedula, soloDigitosCedula } from '../../utils/cedula';
import { toUserMessage } from '../../utils/errors';
import { toast } from 'sonner';

interface LoginScreenProps {
  onBack: () => void;
  onLogin: (email: string, password: string, userName: string) => void;
  onNavigateToRegister: () => void;
  onNavigateToForgotPassword: () => void;
  onNavigateToCollaboratorPanel?: (role: string) => void;
}

/**
 * Ciudadanos: un solo campo que acepta el NÚMERO DE CÉDULA o el CORREO,
 * más la contraseña. Con cédula se usa la función acceso-cedula (límite de
 * intentos, no revela el correo); con correo, Supabase Auth directamente.
 */
export function LoginScreen({
  onBack,
  onLogin,
  onNavigateToRegister,
  onNavigateToForgotPassword,
  onNavigateToCollaboratorPanel,
}: LoginScreenProps) {
  const [usuario, setUsuario] = useState('');
  const modo: 'cedula' | 'correo' = usuario.includes('@') ? 'correo' : 'cedula';
  const cedula = usuario;
  const email = usuario.trim().toLowerCase();
  const [password, setPassword] = useState('');
  const [codigo, setCodigo] = useState('');
  const [confirmando, setConfirmando] = useState<{ emailEnmascarado: string } | null>(null);
  const [errors, setErrors] = useState<{ usuario?: string; password?: string; codigo?: string; general?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const canSubmit = usuario.trim().length > 0 && password.length > 0;

  /** Después de iniciar sesión: el personal debe usar el acceso de colaboradores (OTP). */
  const continuarConSesion = async (user: any, accessToken: string | undefined) => {
    const meta = user?.user_metadata ?? {};
    const userName = [meta.nombres, meta.apellidos].filter(Boolean).join(' ') || meta.full_name || '';
    if (accessToken && onNavigateToCollaboratorPanel) {
      const { data: profile } = await getCurrentUserProfile(accessToken);
      if (profile && ['admin', 'operator', 'auditor'].includes(profile.role)) {
        await cerrarSesion();
        toast.info('Acceso de colaborador', {
          description: 'Usa el botón "Soy colaborador" para completar la verificación de seguridad.',
        });
        onNavigateToCollaboratorPanel(profile.role);
        return;
      }
    }
    onLogin(user?.email ?? '', '', userName);
  };

  const ingresarConCedula = async () => {
    if (/[a-z]/i.test(cedula)) {
      setErrors({ usuario: 'Escribe tu número de cédula (solo números) o tu correo completo.' });
      return;
    }
    const e = validarNumeroCedula(cedula);
    if (e) { setErrors({ usuario: e }); return; }
    if (!password) { setErrors({ password: 'Ingresa tu contraseña' }); return; }
    setIsLoading(true);
    try {
      const sesion = await iniciarSesionConCedula(soloDigitosCedula(cedula), password);
      await continuarConSesion(sesion.user, sesion.session?.access_token);
    } catch (err) {
      if (err instanceof AccesoCedulaError && err.codigo === 'correo_sin_confirmar') {
        setConfirmando({ emailEnmascarado: err.emailEnmascarado ?? 'tu correo' });
        setErrors({});
      } else {
        setErrors({ general: err instanceof AccesoCedulaError ? err.message : toUserMessage(err, 'No se pudo iniciar sesión.') });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const confirmarCodigo = async (valor = codigo) => {
    const limpio = valor.replace(/\D/g, '');
    if (limpio.length < 6) { setErrors({ codigo: 'Ingresa el código que te enviamos' }); return; }
    if (isLoading) return;
    setIsLoading(true);
    try {
      const sesion = await confirmarCorreoConCedula(soloDigitosCedula(cedula), limpio);
      toast.success('Correo confirmado');
      await continuarConSesion(sesion.user, sesion.session?.access_token);
    } catch (err) {
      setErrors({ codigo: err instanceof AccesoCedulaError ? err.message : toUserMessage(err) });
    } finally {
      setIsLoading(false);
    }
  };

  const ingresarConCorreo = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErrors({ usuario: 'Ingresa un correo válido' }); return; }
    if (!password) { setErrors({ password: 'Ingresa tu contraseña' }); return; }
    setIsLoading(true);
    try {
      const { data, error } = await signIn({ email, password });
      if (error) { setErrors({ general: error }); return; }
      await continuarConSesion(data?.user, data?.session?.access_token);
    } catch (err) {
      setErrors({ general: toUserMessage(err, 'No se pudo iniciar sesión.') });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = () => {
    setErrors({});
    return modo === 'cedula' ? ingresarConCedula() : ingresarConCorreo();
  };

  return (
    <div className="h-full bg-white flex flex-col">
      <div className="flex items-center gap-4 px-6 py-4 border-b">
        <button onClick={confirmando ? () => setConfirmando(null) : onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full" aria-label="Volver">
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="text-gray-900">{confirmando ? 'Confirma tu correo' : 'Iniciar sesión'}</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-md mx-auto space-y-6">
          {errors.general && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg" role="alert">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-800 flex-1">{errors.general}</p>
            </div>
          )}

          {confirmando ? (
            <div className="space-y-5">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <Mail className="w-8 h-8 text-blue-600" aria-hidden />
                </div>
                <p className="text-gray-700 text-sm">
                  Tu cuenta aún no está confirmada. Te enviamos un código a <strong>{confirmando.emailEnmascarado}</strong>.
                </p>
              </div>
              <CodigoInput length={8} value={codigo}
                onChange={(v) => { setCodigo(v); setErrors(x => ({ ...x, codigo: undefined })); }}
                onComplete={(v) => confirmarCodigo(v)} error={!!errors.codigo} disabled={isLoading} />
              {errors.codigo && <p className="text-sm text-red-600 text-center" role="alert">{errors.codigo}</p>}
              <Button onClick={() => confirmarCodigo()} disabled={isLoading} size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                {isLoading ? 'Confirmando…' : 'Confirmar e ingresar'}
              </Button>
            </div>
          ) : (
            <>
              <div className="text-center">
                <h2 className="text-gray-900 mb-2">¡Bienvenido de nuevo!</h2>
                <p className="text-gray-600">Ingresa con tu número de cédula o con tu correo</p>
              </div>

              <div className="space-y-4">
                <AuthInput label="Cédula o correo electrónico" value={usuario}
                  onChange={(v) => { setUsuario(v); setErrors(x => ({ ...x, usuario: undefined })); }}
                  placeholder="1012345678 o tu@correo.com" error={errors.usuario} required
                  maxLength={120} autoComplete="username" />
                <AuthInput type="password" label="Contraseña" value={password} onChange={setPassword}
                  placeholder="Tu contraseña" error={errors.password} required autoComplete="current-password" />
                <div className="text-right">
                  <button onClick={onNavigateToForgotPassword} className="text-sm text-blue-600 hover:text-blue-700">
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:text-gray-500"
                size="lg"
              >
                {isLoading ? 'Iniciando sesión…' : 'Iniciar sesión'}
              </Button>

              <div className="text-center pt-2">
                <p className="text-gray-600">
                  ¿No tienes cuenta?{' '}
                  <button onClick={onNavigateToRegister} className="text-blue-600 hover:text-blue-700 font-medium">Crear cuenta</button>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
