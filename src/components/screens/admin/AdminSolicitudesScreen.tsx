import { useEffect, useState } from 'react';
import { Scale, RefreshCw, Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Textarea } from '../../ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Skeleton } from '../../ui/skeleton';
import { EmptyState } from '../../admin/EmptyState';
import {
  listarSolicitudesAdmin, responderSolicitud, suprimirTitular, TIPOS_SOLICITUD, ESTADOS_SOLICITUD,
  type SolicitudAdmin,
} from '../../../services/legalService';
import { toUserMessage } from '../../../utils/errors';
import { toast } from 'sonner';

const fecha = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
  .toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
const hoy = () => new Date().toISOString().slice(0, 10);

/**
 * Solicitudes de titulares (habeas data). Admin responde y ejecuta
 * supresiones; auditor solo consulta. Plazos: Ley 1581, arts. 14 y 15.
 */
export function AdminSolicitudesScreen({ esAdmin }: { esAdmin: boolean }) {
  const [filas, setFilas] = useState<SolicitudAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sel, setSel] = useState<SolicitudAdmin | null>(null);
  const [respuesta, setRespuesta] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [confirmarSupresion, setConfirmarSupresion] = useState(false);

  const cargar = async () => {
    setCargando(true);
    try { setFilas(await listarSolicitudesAdmin()); }
    catch (e) { toast.error('No se pudieron cargar las solicitudes', { description: toUserMessage(e) }); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const abrir = (s: SolicitudAdmin) => { setSel(s); setRespuesta(s.respuesta ?? ''); setConfirmarSupresion(false); };

  const guardar = async (estado: 'en_tramite' | 'respondida' | 'cerrada') => {
    if (!sel) return;
    setGuardando(true);
    try {
      await responderSolicitud(sel.id, estado, respuesta);
      toast.success(estado === 'en_tramite' ? 'Marcada en trámite' : 'Respuesta registrada');
      setSel(null);
      cargar();
    } catch (e) {
      toast.error('No se pudo guardar', { description: toUserMessage(e) });
    } finally {
      setGuardando(false);
    }
  };

  const suprimir = async () => {
    if (!sel?.user_id) return;
    if (respuesta.trim().length < 10) { toast.error('Escribe la respuesta para el titular (mínimo 10 caracteres)'); return; }
    setGuardando(true);
    try {
      await suprimirTitular(sel.user_id, sel.id, respuesta.trim());
      toast.success('Datos suprimidos', { description: 'La cuenta y sus datos fueron eliminados. Queda la constancia de la solicitud.' });
      setSel(null);
      cargar();
    } catch (e) {
      toast.error('No se pudo suprimir', { description: toUserMessage(e) });
    } finally {
      setGuardando(false);
    }
  };

  const abiertas = filas.filter(f => f.estado === 'recibida' || f.estado === 'en_tramite');
  const vencidas = abiertas.filter(f => f.fecha_limite < hoy());

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="w-5 h-5 text-blue-600" aria-hidden /> Solicitudes de titulares (habeas data)
          </CardTitle>
          <Button variant="outline" size="sm" onClick={cargar} disabled={cargando}>
            <RefreshCw className={`w-4 h-4 mr-1 ${cargando ? 'animate-spin' : ''}`} /> Actualizar
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            Plazos legales: consultas 10 días hábiles (art. 14) y reclamos 15 días hábiles (art. 15, Ley 1581 de 2012).
            {abiertas.length > 0 && <> Abiertas: <strong>{abiertas.length}</strong>.</>}
          </p>
          {vencidas.length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800" role="alert">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden />
              {vencidas.length} solicitud{vencidas.length > 1 ? 'es' : ''} superó el plazo legal. Respóndela{vencidas.length > 1 ? 's' : ''} cuanto antes.
            </div>
          )}

          {cargando ? (
            <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : filas.length === 0 ? (
            <EmptyState icon={Scale} title="Sin solicitudes" description="Cuando un titular envíe una solicitud aparecerá aquí." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titular</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Recibida</TableHead>
                    <TableHead>Plazo</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.map(f => {
                    const abierta = f.estado === 'recibida' || f.estado === 'en_tramite';
                    const vencida = abierta && f.fecha_limite < hoy();
                    return (
                      <TableRow key={f.id} className="cursor-pointer hover:bg-gray-50" onClick={() => abrir(f)}>
                        <TableCell>
                          <div className="text-sm font-medium">{f.nombre ?? (f.user_id ? '—' : 'Cuenta eliminada')}</div>
                          <div className="text-xs text-gray-500">{f.email ?? ''}</div>
                        </TableCell>
                        <TableCell className="text-sm">{TIPOS_SOLICITUD.find(t => t.valor === f.tipo)?.titulo ?? f.tipo}</TableCell>
                        <TableCell className="text-sm">{fecha(f.creada_en)}</TableCell>
                        <TableCell className={`text-sm ${vencida ? 'text-red-600 font-semibold' : ''}`}>{fecha(f.fecha_limite)}</TableCell>
                        <TableCell>
                          <Badge variant={abierta ? (vencida ? 'destructive' : 'secondary') : 'outline'}>
                            {ESTADOS_SOLICITUD[f.estado]}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!sel} onOpenChange={o => { if (!o) setSel(null); }}>
        {sel && (
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{TIPOS_SOLICITUD.find(t => t.valor === sel.tipo)?.titulo ?? sel.tipo}</DialogTitle>
              <DialogDescription>
                {sel.nombre ?? 'Titular'} · recibida el {fecha(sel.creada_en)} · plazo {fecha(sel.fecha_limite)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-md p-3 text-sm whitespace-pre-wrap break-words">{sel.mensaje}</div>
              {esAdmin ? (
                <>
                  <Textarea value={respuesta} onChange={e => setRespuesta(e.target.value.slice(0, 4000))}
                    placeholder="Respuesta para el titular (la verá en la app)" rows={4} />
                  {(sel.tipo === 'supresion' || sel.tipo === 'revocatoria') && sel.user_id && (sel.estado === 'recibida' || sel.estado === 'en_tramite') && (
                    <div className="border border-red-200 bg-red-50 rounded-md p-3 space-y-2">
                      <p className="text-sm text-red-800">
                        Suprimir elimina definitivamente la cuenta, la cédula, los contactos, la ubicación y las alertas con
                        sus evidencias. No se puede deshacer. Antes verifica que no exista un deber legal u orden de
                        autoridad que obligue a conservar algún dato.
                      </p>
                      {!confirmarSupresion ? (
                        <Button variant="destructive" size="sm" onClick={() => setConfirmarSupresion(true)} disabled={guardando}>
                          <Trash2 className="w-4 h-4 mr-1" /> Suprimir datos del titular
                        </Button>
                      ) : (
                        <Button variant="destructive" size="sm" onClick={suprimir} disabled={guardando}>
                          {guardando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
                          Confirmar supresión definitiva
                        </Button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                sel.respuesta && <div className="bg-blue-50 rounded-md p-3 text-sm whitespace-pre-wrap">{sel.respuesta}</div>
              )}
            </div>
            {esAdmin && (
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => guardar('en_tramite')} disabled={guardando}>En trámite</Button>
                <Button onClick={() => guardar('respondida')} disabled={guardando} className="bg-blue-600 hover:bg-blue-700 text-white">
                  Responder
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
