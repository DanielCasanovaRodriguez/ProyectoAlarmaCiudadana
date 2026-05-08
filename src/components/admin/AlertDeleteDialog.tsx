import { useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteAdminAlert } from '../../services/adminService';
import { getAlertTypeLabel } from '../../services/alertService';

interface AlertDeleteDialogProps {
  open:         boolean;
  onOpenChange: (open: boolean) => void;
  alert:        any | null;
  accessToken:  string;
  onSuccess:    () => void;
}

export function AlertDeleteDialog({ open, onOpenChange, alert, onSuccess }: AlertDeleteDialogProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!alert) return;

    setDeleting(true);

    const { error } = await deleteAdminAlert(alert.id);

    if (error) {
      // Si RLS no permite DELETE, informar con instrucción clara
      if (error.includes('permission') || error.includes('policy') || error.includes('42501')) {
        toast.error('Sin permiso para eliminar alertas', {
          description: 'Agrega una política DELETE para admin en la tabla alerts desde el panel de Supabase.',
        });
      } else {
        toast.error('Error al eliminar', { description: error });
      }
      setDeleting(false);
      return;
    }

    toast.success('Alerta eliminada correctamente');
    onSuccess();
    onOpenChange(false);
    setDeleting(false);
  };

  if (!alert) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar esta alerta?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span>
              Estás a punto de eliminar permanentemente la alerta de tipo{' '}
              <strong>{getAlertTypeLabel(alert.type)}</strong> creada el{' '}
              {new Date(alert.createdAt).toLocaleDateString('es-CO')}.
            </span>
            <br />
            <strong className="text-red-600">Esta acción no se puede deshacer.</strong>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleDelete(); }}
            disabled={deleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {deleting
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Eliminando...</>
              : 'Eliminar Alerta'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
