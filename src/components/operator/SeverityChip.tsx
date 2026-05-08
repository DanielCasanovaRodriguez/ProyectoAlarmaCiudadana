import React from 'react';
import { Badge } from '../ui/badge';

export type Severity = 'BAJA' | 'MEDIA' | 'ALTA';

interface SeverityChipProps {
  severity: Severity;
  className?: string;
}

export function SeverityChip({ severity, className = '' }: SeverityChipProps) {
  const variants = {
    BAJA: { label: 'Baja', color: 'bg-green-100 text-green-800 border-green-300' },
    MEDIA: { label: 'Media', color: 'bg-orange-100 text-orange-800 border-orange-300' },
    ALTA: { label: 'Alta', color: 'bg-red-100 text-red-800 border-red-300' }
  };

  const variant = variants[severity];

  return (
    <Badge 
      className={`${variant.color} border ${className}`}
    >
      {variant.label}
    </Badge>
  );
}
