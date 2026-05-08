import React from 'react';
import { Badge } from '../ui/badge';
import type { AlertStatus } from '../../types/database.types';
import { STATUS_LABELS } from './types';

interface StatusBadgeProps {
  status: AlertStatus | string;   // acepta el valor DB o un string desconocido
  className?: string;
}

const STATUS_STYLES: Record<AlertStatus, string> = {
  open:     'bg-yellow-100 text-yellow-800 border-yellow-200',
  ack:      'bg-blue-100  text-blue-800  border-blue-200',
  resolved: 'bg-green-100 text-green-800 border-green-200',
};

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const color = STATUS_STYLES[status as AlertStatus] ?? 'bg-gray-100 text-gray-800 border-gray-200';
  const label = STATUS_LABELS[status as AlertStatus] ?? status;

  return (
    <Badge variant="outline" className={`${color} border ${className}`}>
      {label}
    </Badge>
  );
}
