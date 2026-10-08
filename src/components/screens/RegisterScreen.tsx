import React, { useState } from 'react';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { AuthInput } from '../auth/AuthInput';
import { AuthCheckbox } from '../auth/AuthCheckbox';
import { validarNumeroCedula, validarNombrePersona, soloDigitosCedula, validarFechaExpedicion, hoyISO, FECHA_EXPEDICION_MINIMA, contieneDatoPersonal } from '../../utils/cedula';
import { Lock } from 'lucide-react';
import { LegalDialog, EnlaceLegal, type TipoDocumentoLegal } from '../legal/LegalDocument';

/** Datos del formulario de registro. */
export interface DatosRegistro {
  nombres:   string;
  apellidos: string;
  cedula:    string;   // solo dígitos (será el usuario para ingresar)
  fechaExpedicion: string; // AAAA-MM-DD
  email:     string;
  phone:     string;   // celular colombiano, 10 dígitos
  password:  string;
}

interface RegisterScreenProps {
  onBack: () => void;
  onNavigateToLogin: () => void;
  /** Datos válidos → crear la cuenta (la BD valida y garantiza la cédula única). */
  onContinuar: (datos: DatosRegistro) => Promise<void>;
  /** Para no perder lo escrito si hay que corregir algo. */
  datosIniciales?: Partial<DatosRegistro> | null;
  /** Mensaje de error del paso de creación de la cuenta (p. ej. correo ya registrado). */
  errorInicial?: string | null;
}

type Errores = Partial<Record<keyof DatosRegistro | 'confirmPassword' | 'terms' | 'general', string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Celular colombiano: 10 dígitos que empiezan por 3 (acepta +57 y espacios). */
export function normalizarCelular(s: string): string | null {
  let d = (s ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('57')) d = d.slice(2);
  return /^3\d{9}$/.test(d) ? d : null;
}

export function RegisterScreen({ onBack, onNavigateToLogin, onContinuar, datosIniciales, errorInicial }: RegisterScreenProps) {
  const [nombres,   setNombres]   = useState(datosIniciales?.nombres ?? '');
  const [apellidos, setApellidos] = useState(datosIniciales?.apellidos ?? '');
  const [cedula,    setCedula]    = useState(datosIniciales?.cedula ?? '');
  const [fechaExp,  setFechaExp]  = useState(datosIniciales?.fechaExpedicion ?? '');
  const [enviando,  setEnviando]  = useState(false);
  const [docLegal,  setDocLegal]  = useState<TipoDocumentoLegal | null>(null);
  const [email,     setEmail]     = useState(datosIniciales?.email ?? '');
  const [phone,     setPhone]     = useState(datosIniciales?.phone ?? '');
  const [password,  setPassword]  = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted,   setTermsAccepted]   = useState(false);
  const [errors, setErrors] = useState<Errores>(errorInicial ? { general: errorInicial } : {});

  const canSubmit =
    nombres.trim().length > 0 && apellidos.trim().length > 0 && cedula.trim().length > 0 && fechaExp.length > 0 &&
    email.length > 0 && phone.length > 0 && password.length > 0 && confirmPassword.length > 0 && termsAccepted;

  const handleSubmit = async () => {
    const e: Errores = {};

    const errN = validarNombrePersona(nombres, 'nombres');     if (errN) e.nombres = errN;
    const errA = validarNombrePersona(apellidos, 'apellidos'); if (errA) e.apellidos = errA;
    const errC = validarNumeroCedula(cedula);                  if (errC) e.cedula = errC;
    const errF = validarFechaExpedicion(fechaExp);             if (errF) e.fechaExpedicion = errF;

    if (!email.trim()) e.email = 'Ingresa tu correo electrónico';
    else if (!EMAIL_RE.test(email.trim())) e.email = 'Ingresa un correo válido';

    const cel = normalizarCelular(phone);
    if (!cel) e.phone = 'Ingresa un celular colombiano de 10 dígitos (ej. 3001234567)';

    if (!password) e.password = 'Ingresa una contraseña';
    else if (password.length < 8) e.password = 'La contraseña debe tener al menos 8 caracteres';
    else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) e.password = 'Usa letras y números en tu contraseña';
    else if (contieneDatoPersonal(password, cedula, fechaExp)) e.password = 'No uses tu cédula ni tu fecha de expedición en la contraseña';

    if (!confirmPassword) e.confirmPassword = 'Confirma tu contraseña';
    else if (password !== confirmPassword) e.confirmPassword = 'Las contraseñas no coinciden';

    if (!termsAccepted) e.terms = 'Debes aceptar los términos y condiciones';

    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setEnviando(true);
    try {
      await onContinuar({
        nombres: nombres.trim().replace(/\s+/g, ' '),
        apellidos: apellidos.trim().replace(/\s+/g, ' '),
        cedula: soloDigitosCedula(cedula),
        fechaExpedicion: fechaExp,
        email: email.trim().toLowerCase(),
        phone: cel!,
        password,
      });
    } catch (err: any) {
      setErrors({ general: err?.message || 'No se pudo crear la cuenta. Intenta de nuevo.' });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="h-full bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b">
        <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full" aria-label="Volver">
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="text-gray-900">Crear cuenta</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-center mb-8">
            <h2 className="text-gray-900 mb-2">Únete a AlertaCiudadana</h2>
            <p className="text-gray-600">Tu número de cédula será tu usuario para ingresar.</p>
          </div>

          {errors.general && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg" role="alert">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-800">{errors.general}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AuthInput label="Nombres" value={nombres} onChange={setNombres} placeholder="Juan Carlos"
                error={errors.nombres} required autoComplete="given-name" maxLength={60} />
              <AuthInput label="Apellidos" value={apellidos} onChange={setApellidos} placeholder="Pérez Gómez"
                error={errors.apellidos} required autoComplete="family-name" maxLength={60} />
            </div>
            <AuthInput label="Número de cédula" value={cedula} onChange={setCedula} placeholder="1012345678"
              error={errors.cedula} required inputMode="numeric" maxLength={14} autoComplete="off"
              hint="Tal como aparece en tu cédula de ciudadanía, sin puntos." />
            <AuthInput type="date" label="Fecha de expedición de la cédula" value={fechaExp} onChange={setFechaExp}
              error={errors.fechaExpedicion} required min={FECHA_EXPEDICION_MINIMA} max={hoyISO()}
              hint="Aparece en el reverso de tu cédula." />
            <div className="flex items-start gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-3">
              <Lock className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" aria-hidden />
              <span>Una cédula = una cuenta, para que las alertas sean confiables. Tu cédula se guarda cifrada y nadie más puede verla.</span>
            </div>
            <AuthInput type="email" label="Correo electrónico" value={email} onChange={setEmail}
              placeholder="tu@email.com" error={errors.email} required autoComplete="email" />
            <AuthInput label="Celular" value={phone} onChange={setPhone} placeholder="3001234567"
              error={errors.phone} required inputMode="tel" autoComplete="tel-national" maxLength={16} />
            <AuthInput type="password" label="Contraseña" value={password} onChange={setPassword}
              placeholder="Mínimo 8 caracteres, letras y números" error={errors.password} required autoComplete="new-password" />
            <AuthInput type="password" label="Confirmar contraseña" value={confirmPassword} onChange={setConfirmPassword}
              placeholder="Repite tu contraseña" error={errors.confirmPassword} required autoComplete="new-password" />

            <AuthCheckbox
              checked={termsAccepted}
              onChange={setTermsAccepted}
              error={errors.terms}
              label={
                <span>
                  Soy mayor de edad, acepto los{' '}
                  <EnlaceLegal tipo="terminos" onAbrir={setDocLegal}>Términos y Condiciones</EnlaceLegal> y autorizo de
                  forma previa, expresa e informada el tratamiento de mis datos personales, incluida mi cédula, según la{' '}
                  <EnlaceLegal tipo="privacidad" onAbrir={setDocLegal}>Política de Tratamiento de Datos</EnlaceLegal>{' '}
                  (Ley 1581 de 2012).
                </span>
              }
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || enviando}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:text-gray-500"
            size="lg"
          >
            {enviando ? 'Creando tu cuenta…' : 'Crear cuenta'}
          </Button>

          <div className="text-center pt-4">
            <p className="text-gray-600">
              ¿Ya tienes cuenta?{' '}
              <button onClick={onNavigateToLogin} className="text-blue-600 hover:text-blue-700">
                Iniciar sesión
              </button>
            </p>
          </div>
        </div>
      </div>
      <LegalDialog tipo={docLegal} onClose={() => setDocLegal(null)} />
    </div>
  );
}
