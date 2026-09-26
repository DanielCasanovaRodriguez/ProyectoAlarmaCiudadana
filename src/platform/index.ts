import { Capacitor } from '@capacitor/core';

/**
 * Capa de plataforma: todo lo que depende de si la app corre en el
 * navegador (cliente web) o empaquetada con Capacitor (cliente Android).
 *
 * Las pantallas y servicios usan solo estas funciones; así la lógica
 * de negocio y el acceso a Supabase son idénticos en ambos clientes.
 */
export const isNative   = Capacitor.isNativePlatform();
export const platform   = Capacitor.getPlatform() as 'web' | 'android' | 'ios';

export * from './location';
export * from './device';
export * from './shell';
export * from './push';
