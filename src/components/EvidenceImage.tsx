import React, { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';

interface EvidenceImageProps {
  /** URL firmada; undefined/'' mientras se obtiene. */
  src?: string;
  alt: string;
  className?: string;
  /** Tamaño del ícono de carga/error. */
  compact?: boolean;
}

/**
 * Imagen de evidencia con URL firmada.
 *
 * No renderiza <img> hasta tener la URL: un <img src=""> dispara `error`
 * de inmediato y, si se ocultaba en ese momento, la imagen quedaba en
 * blanco aunque luego llegara la URL correcta.
 */
export function EvidenceImage({ src, alt, className = '', compact = false }: EvidenceImageProps) {
  const [estado, setEstado] = useState<'cargando' | 'lista' | 'error'>('cargando');

  // Si cambia la URL (p. ej. llega la firmada o se renueva), se reintenta.
  useEffect(() => { setEstado('cargando'); }, [src]);

  const icono = compact ? 'w-4 h-4' : 'w-6 h-6';

  return (
    <div className={`relative w-full h-full ${className}`}>
      {src && estado !== 'error' && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={`w-full h-full object-cover transition-opacity ${estado === 'lista' ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setEstado('lista')}
          onError={() => setEstado('error')}
        />
      )}
      {estado === 'cargando' && (
        <div className="absolute inset-0 flex items-center justify-center" aria-label="Cargando evidencia">
          <div className={`${icono} border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin`} />
        </div>
      )}
      {estado === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-gray-400">
          <ImageOff className={icono} />
          {!compact && <span className="text-[10px]">No disponible</span>}
        </div>
      )}
    </div>
  );
}
