import React, { useEffect, useRef, useState } from 'react';
import { hapticNotify, hapticTap } from '../platform';

interface HoldToConfirmButtonProps {
  onConfirm:   () => void;
  disabled?:   boolean;
  holdMs?:     number;
  className?:  string;
  children:    React.ReactNode;
  holdingText?: React.ReactNode;
}

/**
 * Botón que solo se activa tras mantenerlo presionado `holdMs` milisegundos.
 * Evita envíos accidentales de alertas (bolsillo, toque involuntario).
 * Funciona con dedo, mouse y teclado (mantener Enter o Espacio).
 */
export function HoldToConfirmButton({
  onConfirm,
  disabled = false,
  holdMs = 1500,
  className = '',
  children,
  holdingText = 'Mantén presionado…',
}: HoldToConfirmButtonProps) {
  const [progress, setProgress] = useState(0);
  const startRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  const stop = () => {
    startRef.current = null;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    setProgress(0);
  };

  const tick = () => {
    if (startRef.current === null) return;
    const p = Math.min(1, (performance.now() - startRef.current) / holdMs);
    setProgress(p);
    if (p >= 1) {
      stop();
      hapticNotify('warning');
      onConfirm();
      return;
    }
    frameRef.current = requestAnimationFrame(tick);
  };

  const start = () => {
    if (disabled || startRef.current !== null) return;
    hapticTap();
    startRef.current = performance.now();
    frameRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => stop, []);
  useEffect(() => { if (disabled) stop(); }, [disabled]);

  const holding = progress > 0;

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label="Mantén presionado para enviar la alarma"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); start(); }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); start(); } }}
      onKeyUp={(e) => { if (e.key === 'Enter' || e.key === ' ') stop(); }}
      onContextMenu={(e) => e.preventDefault()}
      className={`relative overflow-hidden select-none touch-none rounded-md px-4 py-2 text-sm font-medium
        disabled:opacity-50 disabled:pointer-events-none ${className}`}
      style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-black/25"
        style={{ width: `${progress * 100}%` }}
      />
      <span className="relative">{holding ? holdingText : children}</span>
    </button>
  );
}
