import React, { useState } from 'react';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { AuthInput } from '../auth/AuthInput';
import { AuthCheckbox } from '../auth/AuthCheckbox';
import { signUp } from '../../services/authService';
import { sendVerificationEmail } from '../../utils/verificationCode';
import { toast } from 'sonner';

interface RegisterScreenProps {
  onBack: () => void;
  onRegister: (name: string, email: string, password: string) => void;
  onNavigateToLogin: () => void;
  onNavigateToEmailVerification: (email: string, name: string) => void;
}

export function RegisterScreen({
  onBack,
  onRegister,
  onNavigateToLogin,
  onNavigateToEmailVerification
}: RegisterScreenProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    phone?: string;
    password?: string;
    confirmPassword?: string;
    terms?: string;
    general?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);

  const isEmailValid = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const canSubmit = 
    name.length > 0 && 
    email.length > 0 && 
    phone.length > 0 &&
    password.length > 0 && 
    confirmPassword.length > 0 && 
    termsAccepted;

  const handleSubmit = async () => {
    const newErrors: typeof errors = {};
    
    // Validación de nombre
    if (!name || name.trim().length < 2) {
      newErrors.name = 'Ingresa tu nombre completo';
    }
    
    // Validación de email
    if (!email) {
      newErrors.email = 'Ingresa tu correo electrónico';
    } else if (!isEmailValid(email)) {
      newErrors.email = 'Ingresa un correo válido';
    }
    
    // Validación de teléfono
    if (!phone || phone.length < 10) {
      newErrors.phone = 'Ingresa un número de teléfono válido';
    }
    
    // Validación de contraseña
    if (!password) {
      newErrors.password = 'Ingresa una contraseña';
    } else if (password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
    }
    
    // Validación de confirmación de contraseña
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Confirma tu contraseña';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
    }
    
    // Validación de términos
    if (!termsAccepted) {
      newErrors.terms = 'Debes aceptar los términos y condiciones';
    }
    
    setErrors(newErrors);
    
    if (Object.keys(newErrors).length > 0) {
      return;
    }
    
    // Registro real con Supabase
    setIsLoading(true);
    setErrors({});
    
    try {
      console.log('🚀 Starting registration for:', email);
      
      const result = await signUp({ email, password, name, phone });
      
      if (result.error) {
        setIsLoading(false);
        setErrors({ general: result.error });
        return;
      }
      
      // Usuario creado exitosamente, ahora verificar email
      if (result.data?.user) {
        console.log('✅ Usuario creado, navegando a verificación de email');
        toast.success('Cuenta creada', {
          description: result.localCode 
            ? 'Usa el código que aparecerá en pantalla'
            : 'Revisa tu correo electrónico para verificar tu cuenta'
        });
        
        // Navegar a verificación pasando email Y nombre
        onNavigateToEmailVerification(email, name);
      } else {
        setIsLoading(false);
        setErrors({ general: 'Error al crear la cuenta. Intenta de nuevo.' });
      }
    } catch (err: any) {
      console.error('❌ Register error:', err);
      setErrors({ general: 'Error al crear la cuenta. Por favor intenta de nuevo.' });
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
        <h1 className="text-gray-900">Crear cuenta</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-md mx-auto space-y-6">
          {/* Welcome message */}
          <div className="text-center mb-8">
            <h2 className="text-gray-900 mb-2">Únete a AlertaCiudadana</h2>
            <p className="text-gray-600">Crea tu cuenta para comenzar</p>
          </div>

          {/* Error general */}
          {errors.general && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-800">{errors.general}</p>
            </div>
          )}

          {/* Form */}
          <div className="space-y-4">
            <AuthInput
              type="text"
              label="Nombre completo"
              value={name}
              onChange={setName}
              placeholder="Juan Pérez"
              error={errors.name}
              required
            />

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
              type="text"
              label="Teléfono"
              value={phone}
              onChange={setPhone}
              placeholder="3001234567"
              error={errors.phone}
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

            <AuthInput
              type="password"
              label="Confirmar contraseña"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Repite tu contraseña"
              error={errors.confirmPassword}
              required
            />

            {/* Terms and conditions */}
            <AuthCheckbox
              checked={termsAccepted}
              onChange={setTermsAccepted}
              error={errors.terms}
              label={
                <span>
                  Acepto los{' '}
                  <span className="text-blue-600">Términos y Condiciones</span> y la{' '}
                  <span className="text-blue-600">Política de Privacidad</span>
                </span>
              }
            />
          </div>

          {/* Submit button */}
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:text-gray-500"
            size="lg"
          >
            {isLoading ? 'Creando cuenta...' : 'Crear cuenta'}
          </Button>

          {/* Login link */}
          <div className="text-center pt-4">
            <p className="text-gray-600">
              ¿Ya tienes cuenta?{' '}
              <button
                onClick={onNavigateToLogin}
                className="text-blue-600 hover:text-blue-700"
              >
                Iniciar sesión
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}