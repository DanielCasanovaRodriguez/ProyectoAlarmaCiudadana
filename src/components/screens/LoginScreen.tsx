import React, { useState } from 'react';
import { ArrowLeft, AlertCircle, Mail } from 'lucide-react';
import { Button } from '../ui/button';
import { AuthInput } from '../auth/AuthInput';
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
 * Ciudadanos: CÉDULA + contraseña (la cédula es el usuario).
 * Cuentas anteriores que aún no registran su cédula: pueden entrar con su
 * correo; la app les pide registrar la cédula después.
 */
export function LoginScreen({
  onBack,
  onLogin,
  onNavigateToRegister,
  onNavigateToForgotPassword,
  onNavigateToCollaboratorPanel,
}: LoginScreenProps) {
  const [modo, setModo] = useState<'cedula' | 'correo'>('cedula');
  const [cedula, setCedula] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [codigo, setCodigo] = useState('');
  const [confirmando, setConfirmando] = useState<{ emailEnmascarado: string } | null>(null);
  const [errors, setErrors] = useState<{ cedula?: string; email?: string; password?: string; codigo?: string; general?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const canSubmit = (modo === 'cedula' ? cedula.length > 0 : email.length > 0) && password.length > 0;

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
    const e = validarNumeroCedula(cedula);
    if (e) { setErrors({ cedula: e }); return; }
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

  const confirmarCodigo = async () => {
    if (codigo.replace(/\D/g, '').length < 6) { setErrors({ codigo: 'Ingresa el código que te enviamos' }); return; }
    setIsLoading(true);
    try {
      const sesion = await confirmarCorreoConCedula(soloDigitosCedula(cedula), codigo.replace(/\D/g, ''));
      toast.success('Correo confirmado');
      await continuarConSesion(sesion.user, sesion.session?.access_token);
    } catch (err) {
      setErrors({ codigo: err instanceof AccesoCedulaError ? err.message : toUserMessage(err) });
    } finally {
      setIsLoading(false);
    }
  };

  const ingresarConCorreo = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErrors({ email: 'Ingresa un correo válido' }); return; }
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
              <AuthInput label="Código de verificación" value={codigo} onChange={setCodigo} placeholder="12345678"
                error={errors.codigo} inputMode="numeric" maxLength={10} autoComplete="one-time-code" />
              <Button onClick={confirmarCodigo} disabled={isLoading} size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                {isLoading ? 'Confirmando…' : 'Confirmar e ingresar'}
              </Button>
            </div>
          ) : (
            <>
              <div className="text-center">
                <h2 className="text-gray-900 mb-2">¡Bienvenido de nuevo!</h2>
                <p className="text-gray-600">
                  {modo === 'cedula' ? 'Ingresa con tu número de cédula' : 'Ingresa con el correo de tu cuenta'}
                </p>
              </div>

              <div className="space-y-4">
                {modo === 'cedula' ? (
                  <AuthInput label="Número de cédula" value={cedula} onChange={setCedula} placeholder="1012345678"
                    error={errors.cedula} required inputMode="numeric" maxLength={14} autoComplete="username" />
                ) : (
                  <AuthInput type="email" label="Correo electrónico" value={email} onChange={setEmail}
                    placeholder="tu@email.com" error={errors.email} required autoComplete="email" />
                )}
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

              <div className="text-center">
                <button
                  onClick={() => { setModo(modo === 'cedula' ? 'correo' : 'cedula'); setErrors({}); }}
                  className="text-sm text-gray-600 underline underline-offset-2"
                >
                  {modo === 'cedula'
                    ? '¿Tu cuenta es anterior y aún no registras tu cédula? Ingresa con tu correo'
                    : 'Ingresar con mi número de cédula'}
                </button>
              </div>

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
