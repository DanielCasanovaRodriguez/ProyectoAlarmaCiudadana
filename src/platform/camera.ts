import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export class FotoCanceladaError extends Error {
  constructor() { super('Foto cancelada'); this.name = 'FotoCanceladaError'; }
}

/**
 * Toma una foto para documentos.
 * - Android: cámara nativa (enfoque y resolución completos), sin galería.
 * - Web: selector del navegador; en el celular abre la cámara trasera,
 *   en el computador permite elegir una foto ya tomada.
 * Devuelve null si el usuario cancela.
 */
export async function capturarFotoDocumento(nombre: string): Promise<File | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      const permiso = await Camera.checkPermissions();
      if (permiso.camera !== 'granted') {
        const r = await Camera.requestPermissions({ permissions: ['camera'] });
        if (r.camera !== 'granted') {
          throw new Error('Necesitamos permiso de cámara para fotografiar tu cédula. Actívalo en Ajustes > Apps > Alerta Ciudadana > Permisos.');
        }
      }
      const foto = await Camera.getPhoto({
        source: CameraSource.Camera,
        resultType: CameraResultType.Uri,
        quality: 92,
        width: 2400,
        correctOrientation: true,
        saveToGallery: false,
        allowEditing: false,
      });
      if (!foto.webPath) return null;
      const blob = await (await fetch(foto.webPath)).blob();
      const tipo = blob.type || `image/${foto.format === 'png' ? 'png' : 'jpeg'}`;
      return new File([blob], `${nombre}.${tipo.includes('png') ? 'png' : 'jpg'}`, { type: tipo });
    } catch (err: any) {
      if (/cancel/i.test(String(err?.message ?? err))) return null;
      throw err;
    }
  }

  // Web
  return new Promise<File | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.setAttribute('capture', 'environment');
    input.style.display = 'none';
    let resuelto = false;
    const terminar = (f: File | null) => {
      if (resuelto) return;
      resuelto = true;
      input.remove();
      resolve(f);
    };
    input.addEventListener('change', () => terminar(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => terminar(null));
    document.body.appendChild(input);
    input.click();
  });
}
