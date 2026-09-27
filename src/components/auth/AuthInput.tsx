import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface AuthInputProps {
  type?:        'text' | 'email' | 'password';
  label:        string;
  value:        string;
  onChange:     (value: string) => void;
  onBlur?:      (value: string) => void;
  placeholder?: string;
  error?:       string;
  required?:    boolean;
  disabled?:    boolean;
  inputMode?:   React.HTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string;
  maxLength?:   number;
  hint?:        string;
}

export function AuthInput({
  type = 'text',
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  required = false,
  disabled = false,
  inputMode,
  autoComplete,
  maxLength,
  hint,
}: AuthInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused,    setIsFocused]    = useState(false);

  const inputType = type === 'password' && showPassword ? 'text' : type;
  const hasError  = !!error;
  const isFilled  = value.length > 0;

  /* ─── Clases de fondo y borde según estado ─────────────────── */
  const stateClass = hasError
    ? 'border-red-500 bg-red-50 focus:border-red-600'
    : isFocused
    ? 'border-blue-500 bg-white'
    : isFilled
    ? 'border-gray-300 bg-white'
    : 'border-gray-300 bg-gray-50';

  return (
    <div className="w-full">
      <label className="block mb-2 text-gray-700 text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <div className="relative">
        <input
          disabled={disabled}
          type={inputType}
          inputMode={inputMode}
          autoComplete={autoComplete}
          maxLength={maxLength}
          aria-invalid={!!error}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={e => {
            setIsFocused(false);
            if (onBlur) onBlur(e.target.value);
          }}
          placeholder={placeholder}
          className={`
            w-full px-4 py-3 border rounded-lg transition-all outline-none
            text-gray-900 font-normal caret-gray-900
            placeholder:text-gray-400
            ${stateClass}
            ${type === 'password' ? 'pr-11' : ''}
          `}
        />

        {type === 'password' && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {showPassword
              ? <EyeOff className="w-5 h-5" />
              : <Eye    className="w-5 h-5" />}
          </button>
        )}
      </div>

      {error ? (
        <p className="mt-1.5 text-sm text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-gray-500">{hint}</p>
      ) : null}
    </div>
  );
}
