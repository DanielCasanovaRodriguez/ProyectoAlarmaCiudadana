/**
 * Datos del Responsable del Tratamiento y versión de los documentos legales.
 *
 * Cambiar POLITICA_VERSION hace que la app vuelva a pedir la autorización
 * a cada ciudadano (queda registrada en la BD: aceptar_politica).
 *
 * Los campos en null se muestran como "pendiente" hasta que el Responsable
 * los defina (Decreto 1377 de 2013, art. 13: nombre, domicilio, dirección,
 * correo y teléfono del Responsable).
 */
export const POLITICA_VERSION = '2026-10-08';
export const POLITICA_VIGENCIA = '8 de octubre de 2026';

export const RESPONSABLE = {
  nombre:    'Proyecto Alerta Ciudadana',
  naturaleza: 'Proyecto académico de seguridad ciudadana',
  domicilio: 'Bogotá D.C., Colombia',
  direccion: null as string | null,
  correo:    null as string | null,
  telefono:  null as string | null,
  /** Canal disponible hoy para ejercer los derechos del titular. */
  canal:     'Desde la app: Perfil → Mis datos y derechos',
};

export const ENCARGADOS = [
  { nombre: 'Supabase Inc.', servicio: 'Base de datos, autenticación y almacenamiento de archivos', pais: 'Estados Unidos (Ohio, región us-east-2)' },
  { nombre: 'Google LLC (Firebase Cloud Messaging)', servicio: 'Envío de notificaciones al celular', pais: 'Estados Unidos' },
  { nombre: 'Vercel Inc.', servicio: 'Publicación de la página web', pais: 'Estados Unidos' },
];
