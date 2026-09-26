import { useEffect, useState } from 'react';
import { getSignedMediaUrls } from '../services/mediaService';

/**
 * Convierte los valores guardados en media_urls en URLs firmadas temporales.
 * Mientras se firman se devuelve una lista vacía de la misma longitud lógica.
 */
export function useSignedMediaUrls(values: string[] | null | undefined): string[] {
  const key = (values ?? []).join('|');
  const [signed, setSigned] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    if (!values?.length) { setSigned([]); return; }
    getSignedMediaUrls(values).then(urls => { if (active) setSigned(urls); });
    return () => { active = false; };
  }, [key]);

  return signed;
}
