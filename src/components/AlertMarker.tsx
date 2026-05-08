import React from 'react';
import { Alert } from '../App';
import { AlertTriangle, Car, Shield, Flame, Users } from 'lucide-react';

interface AlertMarkerProps {
  alert: Alert;
  style?: React.CSSProperties;
}

const alertConfig = {
  medical: {
    icon: AlertTriangle,
    color: 'bg-red-500',
    label: 'Emergencia Médica'
  },
  robbery: {
    icon: Shield,
    color: 'bg-orange-500',
    label: 'Robo'
  },
  accident: {
    icon: Car,
    color: 'bg-yellow-500',
    label: 'Accidente'
  },
  fire: {
    icon: Flame,
    color: 'bg-red-600',
    label: 'Incendio'
  },
  violence: {
    icon: Users,
    color: 'bg-purple-500',
    label: 'Violencia'
  }
};

export function AlertMarker({ alert, style }: AlertMarkerProps) {
  const config = alertConfig[alert.type];
  const Icon = config.icon;
  
  const timeAgo = Math.floor((Date.now() - alert.timestamp.getTime()) / (1000 * 60));

  return (
    <div style={style} className="cursor-pointer">
      <div className="relative group">
        {/* Pulsing ring */}
        <div className={`absolute -inset-2 ${config.color} rounded-full opacity-30 animate-ping`}></div>
        
        {/* Main marker */}
        <div className={`relative w-8 h-8 ${config.color} rounded-full flex items-center justify-center shadow-lg border-2 border-white`}>
          <Icon className="w-4 h-4 text-white" />
        </div>

        {/* Tooltip */}
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          <div className="bg-black text-white text-xs rounded px-2 py-1 whitespace-nowrap">
            <div>{config.label}</div>
            <div className="text-gray-300">Hace {timeAgo}m</div>
            {alert.description && (
              <div className="text-gray-300 max-w-24 truncate">{alert.description}</div>
            )}
          </div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black"></div>
        </div>
      </div>
    </div>
  );
}