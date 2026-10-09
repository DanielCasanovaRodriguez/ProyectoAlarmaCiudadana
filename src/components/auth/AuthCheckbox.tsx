import React from 'react';
import { Check } from 'lucide-react';

interface AuthCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string | React.ReactNode;
  error?: string;
}

export function AuthCheckbox({ checked, onChange, label, error }: AuthCheckboxProps) {
  return (
    <div className="w-full">
      <div className="flex items-start gap-3 cursor-pointer group">
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          aria-invalid={!!error}
          onClick={() => onChange(!checked)}
          className={`min-w-[24px] w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
            checked
              ? 'bg-blue-600 border-blue-600'
              : error
              ? 'border-red-500 bg-red-50'
              : 'border-gray-300 bg-white group-hover:border-blue-400'
          }`}
        >
          {checked && <Check className="w-4 h-4 text-white" />}
        </button>
        <span className="text-sm text-gray-700 flex-1 -mt-0.5" onClick={() => onChange(!checked)}>{label}</span>
      </div>
      {error && (
        <p className="mt-1 ml-9 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
