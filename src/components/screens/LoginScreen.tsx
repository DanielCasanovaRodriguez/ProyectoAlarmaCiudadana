import React, { useState } from 'react';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { AuthInput } from '../auth/AuthInput';
import { signIn } from '../../services/authService';
import { getCurrentUserProfile } from '../../services/adminService';
import { toast } from 'sonner';
import { TwoFactorVerificationScreen } from './TwoFactorVerificationScreen';

interface LoginScreenProps {
  onBack: () => void;
  onLogin: (email: string, password: string, userName: string) => void;
  onNavigateToRegister: () => void;
  onNavigateToForgotPassword: () => void;
  onNavigateToCollaboratorPanel?: (role: string, accessToken: string, user: any, profile: any) => void;
}

export function LoginScreen({
  onBack,
  onLogin,
  onNavigateToRegister,
  onNavigateToForgotPassword,
  onNavigateToCollaboratorPanel
}: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [pendingAuth, setPendingAuth] = useState<{
    role: string;
    accessToken: string;
    user: any;
    profile: any;
  } | null>(null);

  const isEmailValid = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const canSubmit = email.length > 0 && password.length > 0;

  const handle2FAComplete = () => {
    if (pendingAuth && onNavigateToCollaboratorPanel) {
      toast.success(`Bienvenido, ${pendingAuth.profile.name || email}`);

      // Save to localStorage
      localStorage.setItem('admin_user', JSON.stringify(pendingAuth.user));
      localStorage.setItem('admin_profile', JSON.stringify(pendingAuth.profile));
      localStorage.setItem('admin_access_token', pendingAuth.accessToken);

      // Redirect based on role
      onNavigateToCollaboratorPanel(
        pendingAuth.role,
        pendingAuth.accessToken,
        pendingAuth.user,
        pendingAuth.profile
      );
    }
  };

  const handle2FABack = () => {
    setShow2FA(false);
    setPendingAuth(null);
  };

  const handleSubmit = async () => {
    setErrors({});
    setShowHelp(false);
    
    // Validación de email
    if (!email) {
      setErrors({ email: 'Ingresa tu correo electrónico' });
      return;
    }
    
    if (!isEmailValid(email)) {
      setErrors({ email: 'Ingresa un correo válido' });
      return;
    }
    
    // Validación de contraseña
    if (!password) {
      setErrors({ password: 'Ingresa tu contraseña' });
      return;
    }
    
    if (password.length < 6) {
      setErrors({ password: 'La contraseña debe tener al menos 6 caracteres' });
      return;
    }
    
    // Autenticación real con Supabase
    setIsLoading(true);
    try {
      const { data, error } = await signIn({ email, password });
      
      if (error) {
        // Si son credenciales inválidas, sugerir crear cuenta
        if (error.includes('Credenciales inválidas') || error.includes('Invalid login credentials')) {
          setErrors({ 
            general: '❌ Estas credenciales no existen en el sistema. Verifica que hayas escrito correctamente tu email y contraseña, o crea una cuenta nueva si es tu primera vez.' 
          });
          setShowHelp(true);
        } else {
          setErrors({ general: error });
        }
        setIsLoading(false);
        return;
      }
      
      if (data) {
        const accessToken = data.session?.access_token;
        const user = data.user;
        const userName = user?.user_metadata?.name || '';
        
        // Check if user has a collaborator role (admin, operator, auditor)
        if (accessToken && onNavigateToCollaboratorPanel) {
          console.log('🔍 Checking user role...');
          try {
            const { data: profile, error: profileError } = await getCurrentUserProfile(accessToken);
            
            if (!profileError && profile) {
              const userRole = profile.role || 'user';
              console.log('✅ User role:', userRole);
              
              // If user is a collaborator, show 2FA before redirecting
              if (['admin', 'operator', 'auditor'].includes(userRole)) {
                console.log('✅ Collaborator detected, showing 2FA verification...');
                
                // Store pending auth data and show 2FA screen
                setPendingAuth({
                  role: userRole,
                  accessToken,
                  user,
                  profile,
                });
                setShow2FA(true);
                setIsLoading(false);
                return;
              }
            }
          } catch (profileErr) {
            console.log('⚠️ Could not fetch profile, treating as regular user');
          }
        }
        
        // Regular user login
        console.log('✅ Regular user login');
        onLogin(email, password, userName);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setErrors({ general: 'Error al iniciar sesión. Intenta de nuevo.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Show 2FA screen if needed
  if (show2FA && pendingAuth) {
    return (
      <TwoFactorVerificationScreen
        email={email}
        onBack={handle2FABack}
        onVerificationComplete={handle2FAComplete}
      />
    );
  }

  return (
    <div className="h-full bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b">
        <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="text-gray-900">Iniciar sesión</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-md mx-auto space-y-6">
          {/* Welcome message */}
          <div className="text-center mb-8">
            <h2 className="text-gray-900 mb-2">¡Bienvenido de nuevo!</h2>
            <p className="text-gray-600">Ingresa tus datos para continuar</p>
          </div>

          {/* Error general */}
          {errors.general && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-red-800">{errors.general}</p>
                {showHelp && (
                  <button
                    onClick={onNavigateToRegister}
                    className="mt-3 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Ir a crear cuenta →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Form */}
          <div className="space-y-4">
            <AuthInput
              type="email"
              label="Correo electrónico"
              value={email}
              onChange={setEmail}
              placeholder="tu@email.com"
              error={errors.email}
              required
            />

            <AuthInput
              type="password"
              label="Contraseña"
              value={password}
              onChange={setPassword}
              placeholder="Mínimo 6 caracteres"
              error={errors.password}
              required
            />

            {/* Forgot password link */}
            <div className="text-right">
              <button
                onClick={onNavigateToForgotPassword}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          </div>

          {/* Submit button */}
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:text-gray-500"
            size="lg"
          >
            {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </Button>

          {/* Register link */}
          <div className="text-center pt-4">
            <p className="text-gray-600">
              ¿No tienes cuenta?{' '}
              <button
                onClick={onNavigateToRegister}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Crear cuenta
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
