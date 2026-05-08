import React from 'react';
import { Bell } from 'lucide-react';

interface AlarmButtonProps {
  onClick: () => void;
  className?: string;
}

export function AlarmButton({ onClick, className }: AlarmButtonProps) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <button
        onClick={onClick}
        className="
          relative w-32 h-32 bg-gradient-to-br from-red-500 to-red-600 
          hover:from-red-600 hover:to-red-700 active:from-red-700 active:to-red-800
          rounded-full shadow-2xl
          flex items-center justify-center
          transform transition-all duration-300
          hover:scale-105 active:scale-95
          border-8 border-white
          group
        "
        aria-label="Reportar alarma de emergencia"
      >
        {/* Outer pulsing ring */}
        <div className="absolute -inset-4 bg-red-400 rounded-full opacity-20 animate-ping"></div>
        
        {/* Inner pulsing ring */}
        <div className="absolute -inset-2 bg-red-500 rounded-full opacity-30 animate-ping" style={{ animationDelay: '0.5s' }}></div>
        
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-red-400 to-transparent opacity-40"></div>
        
        {/* Icon */}
        <Bell className="w-14 h-14 text-white relative z-10 drop-shadow-lg group-hover:animate-pulse" />
      </button>
      
      {/* Emergency text */}
      <div className="mt-4 px-6 py-2 bg-red-50 rounded-full border-2 border-red-200">
        <span className="text-sm text-red-700">REPORTAR ALARMA</span>
      </div>
    </div>
  );
}