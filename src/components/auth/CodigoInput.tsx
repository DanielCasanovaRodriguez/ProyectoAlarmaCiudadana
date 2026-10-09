import { useEffect, useRef, useState } from 'react';

interface CodigoInputProps {
  /** Cantidad de dígitos (Supabase envía 6 u 8). */
  length:      number;
  value:       string;
  onChange:    (valor: string) => void;
  /** Se llama al completar todos los dígitos (p. ej. para verificar solo). */
  onComplete?: (valor: string) => void;
  error?:      boolean;
  disabled?:   boolean;
  autoFocus?:  boolean;
  etiqueta?:   string;
}

/**
 * Casillas de código adaptables a cualquier pantalla.
 *
 * Un único <input> real (invisible) recibe lo que se escribe o pega, y las
 * casillas solo lo muestran: así funcionan pegar el código completo, el
 * autocompletado del teclado (one-time-code) y el borrado, y las casillas
 * se reparten el ancho disponible (8 caben en un celular de 320 px).
 */
export function CodigoInput({
  length, value, onChange, onComplete, error, disabled, autoFocus = true, etiqueta = 'Código de verificación',
}: CodigoInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enfocado, setEnfocado] = useState(false);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const cambiar = (texto: string) => {
    const limpio = texto.replace(/\D/g, '').slice(0, length);
    onChange(limpio);
    if (limpio.length === length) onComplete?.(limpio);
  };

  const activa = Math.min(value.length, length - 1);

  return (
    <div className="relative w-full max-w-sm mx-auto" onClick={() => inputRef.current?.focus()}>
      <div
        className="grid gap-1.5 sm:gap-2"
        style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}
        aria-hidden
      >
        {Array.from({ length }, (_, i) => {
          const digito = value[i] ?? '';
          const esActiva = enfocado && i === activa;
          return (
            <div
              key={i}
              className={`h-12 sm:h-14 rounded-lg border-2 flex items-center justify-center text-xl sm:text-2xl font-semibold select-none transition-colors ${
                error ? 'border-red-400 bg-red-50 text-red-700'
                : esActiva ? 'border-blue-600 bg-white ring-2 ring-blue-200'
                : digito ? 'border-blue-500 bg-blue-50 text-gray-900'
                : 'border-gray-300 bg-white'
              } ${disabled ? 'opacity-60' : ''}`}
            >
              {digito || (esActiva ? <span className="w-0.5 h-6 bg-blue-600 animate-pulse" /> : '')}
            </div>
          );
        })}
      </div>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        maxLength={length}
        value={value}
        disabled={disabled}
        aria-label={etiqueta}
        aria-invalid={!!error}
        onChange={e => cambiar(e.target.value)}
        onFocus={() => setEnfocado(true)}
        onBlur={() => setEnfocado(false)}
        className="absolute inset-0 w-full h-full opacity-[0.01] text-transparent caret-transparent bg-transparent cursor-pointer"
        style={{ fontSize: 16 /* evita el zoom automático en iOS */ }}
      />
    </div>
  );
}
