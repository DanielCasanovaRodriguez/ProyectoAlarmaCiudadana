import React, { useState } from 'react';
import { ArrowLeft, Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { AuthInput } from '../auth/AuthInput';
import { updatePassword } from '../../services/authService';
import { toast } from 'sonner';

interface ResetPasswordScreenProps {
  onBack: () => void;
  onSuccess: () => void;
  email: string;
}

export function ResetPasswordScreen({
  onBack,
  onSuccess,
  email
}: ResetPasswordScreenProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string; general?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  // Validación de contraseña
  const passwordRequirements = {
    minLength: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  };

  const isPasswordValid = Object.values(passwordRequirements).every(Boolean);

  const handleSubmit = async () => {
    setErrors({});
    
    // Validaciones
    if (!password) {
      setErrors({ password: 'Ingresa una contraseña' });
      return;
    }
    
    if (!isPasswordValid) {
      setErrors({ password: 'La contraseña no cumple con los requisitos' });
      return;
    }
    
    if (!confirmPassword) {
      setErrors({ confirmPassword: 'Confirma tu contraseña' });
      return;
    }
    
    if (password !== confirmPassword) {
      setErrors({ confirmPassword: 'Las contraseñas no coinciden' });
      return;
    }
    
    setIsLoading(true);
    
    try {
      console.log('🔐 Actualizando contraseña...');
      
      // Actualizar contraseña en Supabase
      const result = await updatePassword(password);
      
      if (!result.success) {
        setErrors({ general: result.error || 'Error al actualizar la contraseña' });
        toast.error('Error', {
          description: result.error || 'No se pudo actualizar la contraseña'
        });
        setIsLoading(false);
        return;
      }
      
      // Contraseña actualizada exitosamente
      console.log('✅ Contraseña actualizada exitosamente');
      
      toast.success('Contraseña actualizada', {
        description: 'Tu contraseña ha sido cambiada exitosamente',
        duration: 3000
      });
      
      setIsLoading(false);
      
      // Redirigir al login después de un breve delay
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      console.error('Error al actualizar contraseña:', err);
      setErrors({ general: 'Error al actualizar contraseña. Por favor intenta de nuevo.' });
      toast.error('Error', {
        description: 'No se pudo actualizar la contraseña'
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b">
        <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="text-gray-900">Nueva contraseña</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-md mx-auto space-y-6">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <Lock className="w-10 h-10 text-green-600" />
            </div>
          </div>

          {/* Instructions */}
          <div className="text-center mb-8">
            <h2 className="text-gray-900 mb-2">Crea una nueva contraseña</h2>
            <p className="text-gray-600">
              Ingresa una nueva contraseña segura para tu cuenta
            </p>
            <p className="text-sm text-gray-500 mt-2 font-medium">
              {email}
            </p>
          </div>

          {/* General error */}
          {errors.general && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-800">{errors.general}</p>
            </div>
          )}

          {/* Form */}
          <div className="space-y-6">
            {/* New Password Input */}
            <div className="relative">
              <AuthInput
                type={showPassword ? 'text' : 'password'}
                label="Nueva contraseña"
                value={password}
                onChange={setPassword}
                placeholder="Mínimo 8 caracteres"
                error={errors.password}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-10 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Password Requirements */}
            <div className="p-4 bg-gray-50 rounded-lg space-y-2 border border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-2">La contraseña debe tener:</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  {passwordRequirements.minLength ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                  )}
                  <span className={`text-sm ${passwordRequirements.minLength ? 'text-green-700 font-medium' : 'text-gray-600'}`}>
                    Mínimo 8 caracteres
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {passwordRequirements.hasUpperCase ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                  )}
                  <span className={`text-sm ${passwordRequirements.hasUpperCase ? 'text-green-700 font-medium' : 'text-gray-600'}`}>
                    Una letra mayúscula (A-Z)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {passwordRequirements.hasLowerCase ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                  )}
                  <span className={`text-sm ${passwordRequirements.hasLowerCase ? 'text-green-700 font-medium' : 'text-gray-600'}`}>
                    Una letra minúscula (a-z)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {passwordRequirements.hasNumber ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                  )}
                  <span className={`text-sm ${passwordRequirements.hasNumber ? 'text-green-700 font-medium' : 'text-gray-600'}`}>
                    Un número (0-9)
                  </span>
                </div>
              </div>
            </div>

            {/* Confirm Password Input */}
            <div className="relative">
              <AuthInput
                type={showConfirmPassword ? 'text' : 'password'}
                label="Confirmar contraseña"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Repite tu contraseña"
                error={errors.confirmPassword}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-10 text-gray-500 hover:text-gray-700"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Submit button */}
            <Button
              onClick={handleSubmit}
              disabled={!isPasswordValid || !confirmPassword || isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:text-gray-500"
              size="lg"
            >
              {isLoading ? 'Actualizando contraseña...' : 'Cambiar contraseña'}
            </Button>
          </div>

          {/* Success indicator when password is valid */}
          {isPasswordValid && password === confirmPassword && confirmPassword && (
            <div className="flex items-center justify-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Contraseña válida</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
