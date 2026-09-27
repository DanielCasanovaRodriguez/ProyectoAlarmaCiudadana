import { toast } from 'sonner';
import { friendlyText } from './errors';

/**
 * Red de seguridad global: si algún aviso de error o advertencia recibe un
 * texto técnico ("TypeError: Failed to fetch", "JWT expired"…), se traduce a
 * un mensaje claro antes de mostrarlo. Los textos ya amigables no cambian.
 */
export function installFriendlyToasts() {
  const envolver = (original: typeof toast.error): typeof toast.error =>
    ((message: any, data?: any) =>
      original(
        friendlyText(message),
        data ? { ...data, description: friendlyText(data.description) } : data,
      )) as typeof toast.error;

  toast.error   = envolver(toast.error);
  toast.warning = envolver(toast.warning);
}
