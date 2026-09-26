import { useState } from 'react';
import { FileText, Download, BarChart3, Table2, Search, FileSearch, Printer, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Alert, AlertDescription } from '../../ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Badge } from '../../ui/badge';
import { Skeleton } from '../../ui/skeleton';
import { generateReport, downloadCSV, getAlertById, printAlertPDF } from '../../../services/adminService';
import type { AdminAlert } from '../../../services/adminService';
import { useSignedMediaUrls } from '../../../hooks/useSignedMediaUrls';
import { toast } from 'sonner';

interface AdminReportsScreenProps {
  accessToken: string;
}

const REPORT_TYPES = [
  { value: 'alerts_by_type',   label: 'Alertas por Tipo'    },
  { value: 'response_time',    label: 'Tiempos de Respuesta' },
  { value: 'alerts_by_date',   label: 'Alertas por Fecha'    },
  { value: 'alerts_by_status', label: 'Alertas por Estado'   },
];

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'destructive' | 'secondary' }> = {
  open:     { label: 'Abierta',    variant: 'destructive' },
  ack:      { label: 'Reconocida', variant: 'default'     },
  resolved: { label: 'Resuelta',   variant: 'secondary'   },
};

const TYPE_LABELS: Record<string, string> = {
  medical:  'Emergencia Médica',
  robbery:  'Robo / Asalto',
  accident: 'Accidente',
  fire:     'Incendio',
  violence: 'Violencia',
};

const SEVERITY_LABELS: Record<number, string> = {
  1: 'Muy baja', 2: 'Baja', 3: 'Media', 4: 'Alta', 5: 'Crítica',
};

export function AdminReportsScreen({ accessToken }: AdminReportsScreenProps) {
  // ── Sección: Reporte general ──────────────────────────────────
  const [reportType,  setReportType]  = useState('alerts_by_type');
  const [startDate,   setStartDate]   = useState('');
  const [endDate,     setEndDate]     = useState('');
  const [loading,     setLoading]     = useState(false);
  const [reportData,  setReportData]  = useState<any[]>([]);
  const [reportLabel, setReportLabel] = useState('');

  // ── Sección: Reporte individual por ID ───────────────────────
  const [alertIdInput, setAlertIdInput] = useState('');
  const [searching,    setSearching]    = useState(false);
  const [foundAlert,   setFoundAlert]   = useState<AdminAlert | null>(null);
  const signedFound = useSignedMediaUrls(foundAlert?.mediaUrls);
  const [alertError,   setAlertError]   = useState('');

  // ── Generación de reporte general ─────────────────────────────
  const handleGenerateReport = async () => {
    setLoading(true);
    setReportData([]);

    const { data, error } = await generateReport(accessToken, reportType, {
      startDate: startDate || undefined,
      endDate:   endDate   || undefined,
    });

    if (data) {
      setReportData(data);
      const label = REPORT_TYPES.find(r => r.value === reportType)?.label ?? reportType;
      setReportLabel(label);
      toast.success(`"${label}" — ${data.length} registros`);
    } else {
      toast.error('Error al generar reporte', { description: error ?? '' });
    }
    setLoading(false);
  };

  const handleDownload = () => {
    if (!reportData.length) { toast.error('Primero genera un reporte'); return; }
    downloadCSV(reportData, `reporte-${reportType}`);
    toast.success('CSV descargado');
  };

  // ── Búsqueda de alerta por ID ──────────────────────────────────
  const handleSearchAlert = async () => {
    if (!alertIdInput.trim()) {
      toast.error('Ingresa un ID de alerta');
      return;
    }
    setSearching(true);
    setFoundAlert(null);
    setAlertError('');

    const { data, error } = await getAlertById(alertIdInput.trim());
    if (data) {
      setFoundAlert(data);
    } else {
      setAlertError(error ?? 'No se encontró la alerta');
      toast.error('Alerta no encontrada', { description: error ?? '' });
    }
    setSearching(false);
  };

  const handlePrintPDF = () => {
    if (!foundAlert) return;
    printAlertPDF(foundAlert);
  };

  const columns = reportData.length > 0 ? Object.keys(reportData[0]) : [];

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">

      {/* ── Sección 1: Reporte general ─────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Generador de Reportes
          </CardTitle>
          <CardDescription>Consulta y exporta estadísticas del sistema en CSV</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="report-type">Tipo de Reporte</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger id="report-type" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="start-date">Fecha Inicio (opcional)</Label>
              <Input id="start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="end-date">Fecha Fin (opcional)</Label>
              <Input id="end-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1.5" />
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleGenerateReport} disabled={loading}>
              {loading
                ? <><BarChart3 className="mr-2 h-4 w-4 animate-pulse" />Generando...</>
                : <><BarChart3 className="mr-2 h-4 w-4" />Generar Reporte</>}
            </Button>
            {reportData.length > 0 && (
              <Button variant="outline" onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                Descargar CSV
              </Button>
            )}
          </div>

          {/* Resultado del reporte */}
          {loading && (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          )}

          {!loading && reportData.length > 0 && (
            <div>
              <Alert className="mb-4">
                <AlertDescription>
                  <strong>{reportLabel}</strong> — {reportData.length} registros encontrados
                  {startDate && ` · desde ${startDate}`}
                  {endDate   && ` hasta ${endDate}`}
                </AlertDescription>
              </Alert>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.map(col => <TableHead key={col}>{col}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.map((row, idx) => (
                      <TableRow key={idx}>
                        {columns.map(col => (
                          <TableCell key={col} className="text-sm">{String(row[col] ?? '—')}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {!loading && reportData.length === 0 && reportLabel && (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <Table2 className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">No hay datos para el período seleccionado</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Sección 2: Reporte individual por ID ──────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSearch className="w-5 h-5" />
            Reporte Individual por Alerta
          </CardTitle>
          <CardDescription>
            Busca una alerta por su ID completo o parcial y descarga el reporte en PDF
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Campo de búsqueda */}
          <div>
            <Label htmlFor="alert-id">ID de Alerta</Label>
            <div className="flex gap-2 mt-1.5">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="alert-id"
                  placeholder="Ej: 3fa85f64-5717-4562-b3fc-2c963f66afa6 (o los primeros 8 caracteres)"
                  value={alertIdInput}
                  onChange={e => { setAlertIdInput(e.target.value); setFoundAlert(null); setAlertError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleSearchAlert()}
                  className="pl-9 font-mono text-sm"
                />
              </div>
              <Button onClick={handleSearchAlert} disabled={searching || !alertIdInput.trim()}>
                {searching
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Buscando...</>
                  : <><Search className="mr-2 h-4 w-4" />Buscar</>}
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Puedes pegar el ID completo (UUID) o solo los primeros caracteres
            </p>
          </div>

          {/* Error de búsqueda */}
          {alertError && (
            <Alert variant="destructive">
              <AlertDescription>{alertError}</AlertDescription>
            </Alert>
          )}

          {/* Resultado de la búsqueda */}
          {foundAlert && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">

              {/* Header del resultado */}
              <div className="bg-gray-50 border-b border-gray-200 px-5 py-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-gray-400 font-mono mb-1">{foundAlert.id}</p>
                  <h3 className="text-base font-semibold text-gray-900">
                    {TYPE_LABELS[foundAlert.type] ?? foundAlert.type}
                  </h3>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant={STATUS_BADGE[foundAlert.status]?.variant ?? 'outline'}>
                    {STATUS_BADGE[foundAlert.status]?.label ?? foundAlert.status}
                  </Badge>
                  <Button onClick={handlePrintPDF} size="sm" className="bg-red-600 hover:bg-red-700">
                    <Printer className="w-4 h-4 mr-2" />
                    Descargar PDF
                  </Button>
                </div>
              </div>

              {/* Datos del detalle */}
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">

                  <div>
                    <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-0.5">Tipo</p>
                    <p className="text-gray-900">{TYPE_LABELS[foundAlert.type] ?? foundAlert.type}</p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-0.5">Severidad</p>
                    <p className="text-gray-900">{SEVERITY_LABELS[foundAlert.severity] ?? foundAlert.severity} ({foundAlert.severity}/5)</p>
                  </div>

                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-0.5">Descripción</p>
                    <p className="text-gray-900">{foundAlert.description || <span className="text-gray-400 italic">Sin descripción</span>}</p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-0.5">Latitud</p>
                    <p className="text-gray-900 font-mono">{foundAlert.latitude.toFixed(6)}</p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-0.5">Longitud</p>
                    <p className="text-gray-900 font-mono">{foundAlert.longitude.toFixed(6)}</p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-0.5">Creada</p>
                    <p className="text-gray-900">
                      {new Date(foundAlert.createdAt).toLocaleString('es-CO', {
                        day: '2-digit', month: 'long', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>

                  {foundAlert.resolvedAt && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-0.5">Resuelta</p>
                      <p className="text-gray-900">
                        {new Date(foundAlert.resolvedAt).toLocaleString('es-CO', {
                          day: '2-digit', month: 'long', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-0.5">Anónima</p>
                    <p className="text-gray-900">{foundAlert.anonimo ? 'Sí' : 'No'}</p>
                  </div>

                  {foundAlert.mediaUrls?.length > 0 && (
                    <div className="md:col-span-2">
                      <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-0.5">
                        Archivos adjuntos ({foundAlert.mediaUrls.length})
                      </p>
                      <div className="space-y-1">
                        {foundAlert.mediaUrls.map((url, i) => (
                          <a key={i} href={signedFound[i] ?? '#'} target="_blank" rel="noopener noreferrer"
                            className="block text-blue-600 text-xs hover:underline truncate">
                            {url.split('/').pop()}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                </div>

                {/* Enlace a Google Maps */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <a
                    href={`https://www.google.com/maps?q=${foundAlert.latitude},${foundAlert.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    📍 Ver ubicación en Google Maps
                  </a>
                </div>
              </div>
            </div>
          )}

        </CardContent>
      </Card>

    </div>
  );
}
