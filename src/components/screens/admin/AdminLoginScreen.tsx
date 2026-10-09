import { useState } from 'react';
import { toUserMessage } from '../../../utils/errors';
import { AlertTriangle, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Alert, AlertDescription } from '../../ui/alert';
import { signIn } from '../../../services/authService';
import { verifyAdminAccess } from '../../../services/adminService';

interface AdminLoginScreenProps {
  onLoginSuccess: (user: any, profile: any, accessToken: string) => void;
}

export function AdminLoginScreen({ onLoginSuccess }: AdminLoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // First, sign in with Supabase Auth
      const { data: authData, error: authError } = await signIn({ email, password });

      if (authError || !authData?.session) {
        setError('Credenciales inválidas');
        setLoading(false);
        return;
      }

      const accessToken = authData.session.access_token;

      // Verify admin access
      const { data: adminData, error: adminError } = await verifyAdminAccess(accessToken);

      if (adminError || !adminData) {
        setError('No tienes permisos de administrador, operador o auditor');
        setLoading(false);
        return;
      }

      // Check if user has admin, operator, or auditor role
      const allowedRoles = ['admin', 'operator', 'auditor'];
      if (!allowedRoles.includes(adminData.profile.role)) {
        setError('Acceso denegado. Necesitas rol de administrador, operador o auditor.');
        setLoading(false);
        return;
      }

      // Success - call parent callback
      onLoginSuccess(adminData.user, adminData.profile, accessToken);
    } catch (err: any) {
      console.error('Admin login error:', err);
      setError(toUserMessage(err, 'Error al iniciar sesión'));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Panel de Administrador
          </h1>
          <p className="text-sm text-gray-600">
            AlertaCiudadana • Sistema de Gestión
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div>
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@alertaciudadana.gov.co"
                required
                className="mt-1.5"
                disabled={loading}
              />
            </div>

            {/* Password with Eye Icon */}
            <div>
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative mt-1.5">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando acceso...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </Button>
          </form>

          {/* Info */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-900 font-medium mb-1">
              Acceso Restringido
            </p>
            <p className="text-xs text-blue-700">
              Solo personal autorizado con roles de administrador, operador o auditor puede acceder a este panel.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-6">
          Alerta Ciudadana © {new Date().getFullYear()} • Ley 1581 de 2012
        </p>
      </div>
    </div>
  );
}