import { useState } from 'react';
import { toUserMessage } from '../../utils/errors';
import { Shield, Mail, Lock, Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { iniciarSesionColaborador, cerrarSesion } from '../../services/authService';
import { getCurrentUserProfile } from '../../services/adminService';
import { toast } from 'sonner';
import { EmailVerificationScreen } from './EmailVerificationScreen';
import { sendLoginOTP } from '../../utils/verificationCode';
import { tiempoDesdeEnvio, VIGENCIA_REUTILIZABLE_MS } from '../../utils/envioCodigos';
import { APP_VERSION } from '../../config/app';

// ================================================================
// TIPOS
// ================================================================

interface CollaboratorLoginScreenProps {
  onBack: () => void;
  // App.tsx solo usa el primer argumento (role), pero lo declaramos
  // completo para no romper el contrato con el componente padre.
  onLoginSuccess: (role: string, accessToken: string, user: any, profile: any) => void;
}

// ================================================================
// COMPONENTE
// ================================================================

export function CollaboratorLoginScreen({ onBack, onLoginSuccess }: CollaboratorLoginScreenProps) {
  const [email,                  setEmail]                  = useState('');
  const [password,               setPassword]               = useState('');
  const [showPassword,           setShowPassword]           = useState(false);
  const [loading,                setLoading]                = useState(false);
  const [showEmailVerification,  setShowEmailVerification]  = useState(false);
  const [avisoCodigo,            setAvisoCodigo]            = useState<string | undefined>();
  const [esperaCodigo,           setEsperaCodigo]           = useState<number | undefined>();
  const [pendingAuth,            setPendingAuth]            = useState<{
    role:        string;
    accessToken: string;
    user:        any;
    profile:     any;
  } | null>(null);

  // ── SUBMIT ────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    setLoading(true);

    try {
      // ── PASO 1: Login con función específica de colaboradores ────
      // iniciarSesionColaborador ya:
      //   • Verifica email/password con Supabase
      //   • Lee la fila de profiles y comprueba role y status
      //   • Hace signOut y lanza error si el rol no es operator/admin/auditor
      //   • Hace signOut y lanza error si el status no es 'active'
      const authData = await iniciarSesionColaborador(email, password);

      const accessToken = authData.session?.access_token;
      const user        = authData.user;
      const userRole    = authData.role as string; // ya validado dentro de la función

      if (!accessToken || !user) {
        console.error('❌ No se recibió token o usuario');
        toast.error('Error de autenticación. Intenta de nuevo.');
        setLoading(false);
        return;
      }

      console.log('✅ Autenticación exitosa. Rol:', userRole);

      // ── PASO 2: Obtener perfil completo (para mostrar nombre, etc.) ─
      const { data: profile, error: profileError } = await getCurrentUserProfile(accessToken);

      if (profileError || !profile) {
        console.error('❌ Error al obtener perfil:', profileError);
        toast.error('Error al obtener perfil de usuario');
        setLoading(false);
        return;
      }


      // ── PASO 3: Segundo factor ────────────────────────────────────
      // La contraseña ya fue validada. Se cierra esa sesión para que el
      // acceso solo exista después de verificar el código enviado por
      // Supabase al correo (verifyOtp crea la sesión definitiva).
      await cerrarSesion();

      // Si ya se envió un código hace poco, se reutiliza (sigue vigente) en
      // lugar de gastar otro correo; siempre se puede pedir uno nuevo.
      const hace = tiempoDesdeEnvio(email);
      if (hace != null && hace < VIGENCIA_REUTILIZABLE_MS) {
        const min = Math.max(1, Math.round(hace / 60000));
        setEsperaCodigo(undefined);
        setAvisoCodigo(`Usa el código que te enviamos hace ${hace < 60000 ? 'menos de 1 minuto' : `${min} min`}. Si no lo encuentras, pide otro.`);
      } else {
        const otpResult = await sendLoginOTP(email);
        if (!otpResult.success && !otpResult.esperaS) {
          toast.error('No se pudo enviar el código de verificación', { description: otpResult.error });
          setLoading(false);
          return;
        }
        // El servidor pidió esperar: se entra igual a la pantalla del código
        // (el último código recibido sigue sirviendo) con la cuenta regresiva.
        setAvisoCodigo(otpResult.success ? undefined : otpResult.error);
        setEsperaCodigo(otpResult.success ? undefined : otpResult.esperaS);
      }

      // ── PASO 4: Guardar auth pendiente y mostrar pantalla 2FA ────
      setPendingAuth({ role: userRole, accessToken, user, profile });
      setShowEmailVerification(true);
      setLoading(false);

    } catch (error: any) {
      console.error('❌ Error en login colaborador:', error.message);

      // Mensajes de error claros según el tipo de fallo
      if (
        error.message?.includes('Email not confirmed') ||
        error.message?.includes('email not confirmed')
      ) {
        toast.error('Correo no verificado', {
          description:
            'Revisa tu bandeja de entrada y confirma tu correo antes de ingresar. ' +
            'Si no recibiste el correo, contacta al administrador.',
        });
      } else if (error.message?.includes('permisos')) {
        toast.error('Sin permisos de colaborador', {
          description: toUserMessage(error),
        });
      } else if (error.message?.includes('activa') || error.message?.includes('activo')) {
        toast.error('Cuenta inactiva', {
          description: toUserMessage(error),
        });
      } else if (
        error.message?.includes('Invalid login credentials') ||
        error.message?.includes('Credenciales')
      ) {
        toast.error('Credenciales inválidas', {
          description: 'Verifica tu correo y contraseña.',
        });
      } else {
        toast.error('Error al iniciar sesión', {
          description: toUserMessage(error, 'Por favor intenta de nuevo.'),
        });
      }

      setLoading(false);
    }
  };

  // ── 2FA COMPLETADA ─────────────────────────────────────────────
  const handleEmailVerificationComplete = (session?: any) => {
    if (!pendingAuth || !session?.access_token) {
      toast.error('No se pudo completar la verificación. Intenta de nuevo.');
      return;
    }
    const accessToken: string = session.access_token;

    toast.success(`Bienvenido, ${pendingAuth.profile.name || pendingAuth.profile.full_name || email}`);

    // Guardar en localStorage para que AdminPanel y OperatorDashboard
    // encuentren la sesión al montar.
    localStorage.setItem('admin_user',         JSON.stringify(pendingAuth.user));
    localStorage.setItem('admin_profile',      JSON.stringify(pendingAuth.profile));
    localStorage.setItem('admin_access_token', accessToken);

    onLoginSuccess(
      pendingAuth.role,
      accessToken,
      pendingAuth.user,
      pendingAuth.profile,
    );
  };

  // ── VOLVER DESDE 2FA ───────────────────────────────────────────
  const handleEmailVerificationBack = () => {
    setShowEmailVerification(false);
    setPendingAuth(null);
  };

  // ── PANTALLA DE VERIFICACIÓN 2FA ───────────────────────────────
  if (showEmailVerification && pendingAuth) {
    return (
      <EmailVerificationScreen
        email={email}
        onBack={handleEmailVerificationBack}
        onVerify={handleEmailVerificationComplete}
        title="Verificación de seguridad"
        subtitle="Ingresa el código de 8 dígitos para acceder al panel"
        isAdminLogin={true}
        verificationType="email"
        aviso={avisoCodigo}
        esperaInicialS={esperaCodigo}
      />
    );
  }

  // ── FORMULARIO DE LOGIN ────────────────────────────────────────
  return (
    <div className="h-full bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 flex flex-col">

      {/* Header */}
      <div className="flex-shrink-0 p-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-white hover:text-white/90 transition-colors"
          disabled={loading}
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Volver</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-5 sm:p-8">

          {/* Logo y título */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              Acceso Colaboradores
            </h1>
            <p className="text-sm text-gray-600">
              Panel de operadores y administradores
            </p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email */}
            <div>
              <Label htmlFor="email" className="text-gray-700">
                Correo Electrónico
              </Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11 text-base"
                  disabled={loading}
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                />
              </div>
            </div>

            {/* Contraseña */}
            <div>
              <Label htmlFor="password" className="text-gray-700">
                Contraseña
              </Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-11 text-base"
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors z-10"
                  disabled={loading}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Botón submit */}
            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Verificando...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </Button>
          </form>

          {/* Nota informativa */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-xs text-blue-900 leading-relaxed">
                <strong>Nota:</strong> Este acceso es exclusivo para colaboradores del sistema
                (operadores, auditores y administradores). Si eres ciudadano,
                por favor regresa y usa &quot;Crear cuenta&quot; o &quot;Iniciar sesión&quot;.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 text-center p-4 sm:p-6 text-white/70 text-xs" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <p>Alerta Ciudadana v{APP_VERSION}</p>
        <p className="mt-1">Sistema de gestión de alertas ciudadanas</p>
      </div>
    </div>
  );
}
