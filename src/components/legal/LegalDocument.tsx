import { useState } from 'react';
import { ArrowLeft, ChevronDown, Scale, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { POLITICA_DATOS, TERMINOS, type DocumentoLegal } from '../../legal/documentos';

export type TipoDocumentoLegal = 'privacidad' | 'terminos';

const DOCUMENTOS: Record<TipoDocumentoLegal, DocumentoLegal> = {
  privacidad: POLITICA_DATOS,
  terminos:   TERMINOS,
};

/** Cuerpo del documento: secciones plegables, la primera abierta. */
function Contenido({ doc }: { doc: DocumentoLegal }) {
  const [abierta, setAbierta] = useState<string | null>(doc.secciones[0]?.id ?? null);
  return (
    <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
      {doc.secciones.map(s => (
        <section key={s.id}>
          <button
            onClick={() => setAbierta(abierta === s.id ? null : s.id)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50"
            aria-expanded={abierta === s.id}
          >
            <span className="text-sm font-semibold text-gray-900">{s.titulo}</span>
            <ChevronDown className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${abierta === s.id ? 'rotate-180' : ''}`} />
          </button>
          {abierta === s.id && (
            <div className="px-4 pb-4 text-sm text-gray-700 leading-relaxed">{s.cuerpo}</div>
          )}
        </section>
      ))}
    </div>
  );
}

/** Pantalla completa (Perfil → Política / Términos). */
export function LegalScreen({ tipo, onBack }: { tipo: TipoDocumentoLegal; onBack: () => void }) {
  const doc = DOCUMENTOS[tipo];
  const Icono = tipo === 'privacidad' ? ShieldCheck : Scale;
  return (
    <div className="h-full bg-white flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b">
        <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full" aria-label="Volver">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-base font-semibold text-gray-900 truncate">{doc.titulo}</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Icono className="w-5 h-5 text-blue-600" aria-hidden />
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">{doc.subtitulo}</p>
          </div>
          <Contenido doc={doc} />
        </div>
      </div>
    </div>
  );
}

/** Ventana sobre el formulario (registro, consentimiento): no se pierde lo escrito. */
export function LegalDialog({ tipo, onClose }: { tipo: TipoDocumentoLegal | null; onClose: () => void }) {
  const doc = tipo ? DOCUMENTOS[tipo] : null;
  return (
    <Dialog open={!!doc} onOpenChange={o => { if (!o) onClose(); }}>
      {doc && (
        <DialogContent className="max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0! gap-0!">
          <div className="px-5 pt-5 pb-3 border-b">
            <DialogTitle className="text-base pr-6">{doc.titulo}</DialogTitle>
            <DialogDescription className="text-xs mt-1">{doc.subtitulo}</DialogDescription>
          </div>
          <div className="min-h-0 overflow-y-auto px-5 py-4">
            <Contenido doc={doc} />
          </div>
          <div className="px-5 py-3 border-t">
            <Button onClick={onClose} className="w-full bg-blue-600 hover:bg-blue-700 text-white">Entendido</Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}

/** Enlace en línea que abre un documento legal. */
export function EnlaceLegal({ tipo, children, onAbrir, className }: {
  tipo: TipoDocumentoLegal; children: React.ReactNode; onAbrir: (t: TipoDocumentoLegal) => void; className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAbrir(tipo); }}
      className={className ?? 'text-blue-600 underline underline-offset-2'}
    >
      {children}
    </button>
  );
}
