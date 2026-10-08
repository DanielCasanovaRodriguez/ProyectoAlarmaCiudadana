import { useEffect, useState } from 'react';
import { IdCard, RefreshCw, Eye, ShieldOff, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Textarea } from '../../ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Skeleton } from '../../ui/skeleton';
import { EmptyState } from '../../admin/EmptyState';
import { listarCedulas, verCedula, liberarCedula, type CedulaAdmin } from '../../../services/identityService';
import { toUserMessage } from '../../../utils/errors';
import { toast } from 'sonner';

function fecha(s: string) {
  return new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Cédulas registradas. Admin: ver número (auditado) y liberar; auditor: solo lectura. */
export function AdminCedulasScreen({ esAdmin }: { esAdmin: boolean }) {
  const [filas, setFilas] = useState<CedulaAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sel, setSel] = useState<CedulaAdmin | null>(null);
  const [numero, setNumero] = useState<{ numero: string; fecha_expedicion: string | null } | null>(null);
  const [viendo, setViendo] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [liberando, setLiberando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    const { data, error } = await listarCedulas();
    if (error) toast.error('No se pudieron cargar las cédulas', { description: error });
    setFilas(data);
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);

  const abrir = (c: CedulaAdmin) => { setSel(c); setNumero(null); setMotivo(''); };

  const mostrarNumero = async () => {
    if (!sel) return;
    setViendo(true);
    try { setNumero(await verCedula(sel.user_id)); }
    catch (err) { toast.error('No se pudo mostrar', { description: toUserMessage(err) }); }
    finally { setViendo(false); }
  };

  const liberar = async () => {
    if (!sel) return;
    if (!motivo.trim()) { toast.error('Escribe el motivo'); return; }
    setLiberando(true);
    try {
      await liberarCedula(sel.user_id, motivo.trim());
      toast.success('Cédula liberada y cuenta suspendida');
      setSel(null);
      cargar();
    } catch (err) {
      toast.error('No se pudo liberar', { description: toUserMessage(err) });
    } finally {
      setLiberando(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <CardTitle className="flex items-center gap-2"><IdCard className="w-5 h-5" /> Cédulas registradas</CardTitle>
          <Button variant="outline" size="sm" onClick={cargar}><RefreshCw className="w-4 h-4" /> Actualizar</Button>
        </CardHeader>
        <CardContent>
          {cargando ? (
            <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : filas.length === 0 ? (
            <EmptyState icon={IdCard} title="Sin cédulas" description="Aún no hay cuentas con cédula registrada." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Cédula</TableHead>
                    <TableHead>Datos</TableHead>
                    <TableHead>Cuenta</TableHead>
                    <TableHead className="text-right">Reportes falsos</TableHead>
                    <TableHead>Registrada</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.map(c => (
                    <TableRow key={c.user_id} className="cursor-pointer hover:bg-gray-50" onClick={() => abrir(c)}>
                      <TableCell>
                        <div className="font-medium">{[c.nombres, c.apellidos].filter(Boolean).join(' ') || 'Sin nombre'}</div>
                        <div className="text-xs text-gray-500">{c.email}</div>
                      </TableCell>
                      <TableCell className="font-mono">••••{c.ultimos_digitos}</TableCell>
                      <TableCell>{c.completa
                        ? <Badge className="bg-green-100 text-green-800">Completa</Badge>
                        : <Badge className="bg-amber-100 text-amber-800">Falta fecha</Badge>}</TableCell>
                      <TableCell><Badge className={c.estado_cuenta === 'active' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}>{c.estado_cuenta}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums">{c.reportes_falsos}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{fecha(c.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{[sel?.nombres, sel?.apellidos].filter(Boolean).join(' ') || 'Cuenta'}</DialogTitle>
            <DialogDescription>{sel?.email} · Cédula ••••{sel?.ultimos_digitos}</DialogDescription>
          </DialogHeader>

          {!esAdmin ? (
            <p className="text-sm text-gray-600">Como auditor puedes ver el listado, pero no el número completo.</p>
          ) : (
            <div className="space-y-4">
              {numero ? (
                <dl className="grid grid-cols-2 gap-2 text-sm bg-gray-50 rounded-lg p-3">
                  <dt className="text-gray-500">Número</dt><dd className="font-mono">{numero.numero}</dd>
                  <dt className="text-gray-500">Expedición</dt><dd>{numero.fecha_expedicion ?? 'Sin registrar'}</dd>
                </dl>
              ) : (
                <Button variant="outline" onClick={mostrarNumero} disabled={viendo} className="w-full">
                  {viendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />} Mostrar número completo (queda registrado)
                </Button>
              )}
              <div className="border-t pt-4 space-y-2">
                <p className="text-sm font-medium text-gray-900">Suplantación de identidad</p>
                <p className="text-xs text-gray-600">Si el titular real de esta cédula lo denuncia, libera la cédula: la cuenta queda suspendida y la persona podrá registrarse.</p>
                <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={300}
                  placeholder="Motivo (obligatorio), p. ej. denuncia del titular con soporte" aria-label="Motivo" />
              </div>
            </div>
          )}

          {esAdmin && (
            <DialogFooter>
              <Button variant="outline" onClick={liberar} disabled={liberando} className="text-red-700">
                <ShieldOff className="w-4 h-4" /> Liberar cédula y suspender cuenta
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
