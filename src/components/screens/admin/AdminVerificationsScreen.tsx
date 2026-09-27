import { useEffect, useState } from 'react';
import { IdCard, RefreshCw, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Textarea } from '../../ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Skeleton } from '../../ui/skeleton';
import { EmptyState } from '../../admin/EmptyState';
import {
  listarVerificaciones, detalleVerificacion, revisarVerificacion, type VerificacionAdmin,
} from '../../../services/identityService';
import type { EstadoIdentidad } from '../../../types/database.types';
import { toUserMessage } from '../../../utils/errors';
import { toast } from 'sonner';

const ESTADO_BADGE: Record<EstadoIdentidad, string> = {
  pendiente:  'bg-blue-100 text-blue-800',
  verificada: 'bg-green-100 text-green-800',
  rechazada:  'bg-red-100 text-red-800',
};
const METODO: Record<string, string> = {
  pdf417: 'Código de barras (cédula amarilla)',
  mrz:    'Texto MRZ (cédula digital)',
  manual: 'Sin lectura automática',
};

function fecha(s: string) {
  return new Date(s).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface Props { puedeRevisar: boolean }

/** Revisión de verificaciones de identidad (cédula). Admin: aprueba/rechaza; auditor: solo lectura. */
export function AdminVerificationsScreen({ puedeRevisar }: Props) {
  const [filtro, setFiltro] = useState<'pendiente' | 'todas' | EstadoIdentidad>('pendiente');
  const [filas, setFilas] = useState<VerificacionAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [seleccion, setSeleccion] = useState<VerificacionAdmin | null>(null);
  const [detalle, setDetalle] = useState<Awaited<ReturnType<typeof detalleVerificacion>> | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    const { data, error } = await listarVerificaciones(filtro === 'todas' ? null : filtro);
    if (error) toast.error('No se pudieron cargar las verificaciones', { description: error });
    setFilas(data);
    setCargando(false);
  };

  useEffect(() => { cargar(); }, [filtro]);

  const abrir = async (v: VerificacionAdmin) => {
    setSeleccion(v); setDetalle(null); setMotivo('');
    if (!puedeRevisar) return; // el auditor no descifra el número ni ve las fotos
    setCargandoDetalle(true);
    try {
      setDetalle(await detalleVerificacion(v.user_id));
    } catch (err) {
      toast.error('No se pudo cargar el detalle', { description: toUserMessage(err) });
    } finally {
      setCargandoDetalle(false);
    }
  };

  const revisar = async (estado: 'verificada' | 'rechazada') => {
    if (!seleccion) return;
    if (estado === 'rechazada' && !motivo.trim()) { toast.error('Escribe el motivo del rechazo'); return; }
    setGuardando(true);
    try {
      await revisarVerificacion(seleccion.user_id, estado, motivo.trim() || undefined);
      toast.success(estado === 'verificada' ? 'Identidad verificada' : 'Verificación rechazada');
      setSeleccion(null);
      cargar();
    } catch (err) {
      toast.error('No se pudo guardar la revisión', { description: toUserMessage(err) });
    } finally {
      setGuardando(false);
    }
  };

  const datos = detalle?.datos as Record<string, string | null> | null | undefined;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <CardTitle className="flex items-center gap-2"><IdCard className="w-5 h-5" /> Verificaciones de identidad</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filtro} onValueChange={(v) => setFiltro(v as typeof filtro)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendiente">Pendientes</SelectItem>
                <SelectItem value="verificada">Verificadas</SelectItem>
                <SelectItem value="rechazada">Rechazadas</SelectItem>
                <SelectItem value="todas">Todas</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={cargar}><RefreshCw className="w-4 h-4" /> Actualizar</Button>
          </div>
        </CardHeader>
        <CardContent>
          {cargando ? (
            <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : filas.length === 0 ? (
            <EmptyState icon={IdCard} title="Sin verificaciones" description="No hay verificaciones con este filtro." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Cédula</TableHead>
                    <TableHead>Lectura</TableHead>
                    <TableHead>Coincide</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Actualizada</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.map(v => (
                    <TableRow key={v.user_id} className="cursor-pointer hover:bg-gray-50" onClick={() => abrir(v)}>
                      <TableCell>
                        <div className="font-medium">{[v.nombres, v.apellidos].filter(Boolean).join(' ') || 'Sin nombre'}</div>
                        <div className="text-xs text-gray-500">{v.email}</div>
                      </TableCell>
                      <TableCell className="font-mono">••••{v.ultimos_digitos}</TableCell>
                      <TableCell className="text-xs">{METODO[v.metodo_lectura] ?? v.metodo_lectura}</TableCell>
                      <TableCell className="text-xs">
                        Número {v.coincide_numero ? '✓' : '✗'} · Nombre {v.coincide_nombre ? '✓' : '✗'}
                      </TableCell>
                      <TableCell><Badge className={ESTADO_BADGE[v.estado]}>{v.estado}</Badge></TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{fecha(v.updated_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!seleccion} onOpenChange={(o) => !o && setSeleccion(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{[seleccion?.nombres, seleccion?.apellidos].filter(Boolean).join(' ') || 'Verificación'}</DialogTitle>
            <DialogDescription>
              {seleccion?.email} · Intentos: {seleccion?.intentos} · {seleccion && METODO[seleccion.metodo_lectura]}
            </DialogDescription>
          </DialogHeader>

          {!puedeRevisar ? (
            <p className="text-sm text-gray-600">Como auditor puedes ver el estado, pero no el número completo ni las fotos del documento.</p>
          ) : cargandoDetalle ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
          ) : detalle && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[['Frente', detalle.frenteUrl], ['Reverso', detalle.reversoUrl]].map(([t, url]) => (
                  <figure key={t} className="space-y-1">
                    <figcaption className="text-xs font-semibold text-gray-500 uppercase">{t}</figcaption>
                    {url ? <img src={url} alt={`${t} de la cédula`} className="w-full rounded-lg border" /> : <div className="h-40 rounded-lg border bg-gray-50" />}
                  </figure>
                ))}
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <dt className="text-gray-500">Número digitado</dt><dd className="font-mono">{detalle.numero}</dd>
                {datos && <>
                  <dt className="text-gray-500">Número en el documento</dt><dd className="font-mono">{datos.numero ?? '—'}</dd>
                  <dt className="text-gray-500">Nombre en el documento</dt>
                  <dd>{[datos.primerNombre, datos.segundoNombre, datos.primerApellido, datos.segundoApellido].filter(Boolean).join(' ') || '—'}</dd>
                  <dt className="text-gray-500">Nacimiento / sexo</dt><dd>{datos.fechaNacimiento ?? '—'} · {datos.sexo ?? '—'}</dd>
                </>}
                <dt className="text-gray-500">Nombre registrado</dt><dd>{[seleccion?.nombres, seleccion?.apellidos].filter(Boolean).join(' ')}</dd>
              </dl>
              {seleccion?.estado === 'rechazada' && seleccion.motivo_rechazo && (
                <p className="text-sm text-red-700">Motivo del rechazo anterior: {seleccion.motivo_rechazo}</p>
              )}
              <div>
                <label htmlFor="motivo-rechazo" className="text-sm font-medium text-gray-700">Motivo (obligatorio para rechazar)</label>
                <Textarea id="motivo-rechazo" value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={300}
                  placeholder="Ej.: la foto está borrosa; el nombre no coincide con el documento" className="mt-1" />
              </div>
            </div>
          )}

          {puedeRevisar && detalle && (
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => revisar('rechazada')} disabled={guardando} className="text-red-700">
                <XCircle className="w-4 h-4" /> Rechazar
              </Button>
              <Button onClick={() => revisar('verificada')} disabled={guardando} className="bg-green-600 hover:bg-green-700 text-white">
                <CheckCircle2 className="w-4 h-4" /> Aprobar
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
