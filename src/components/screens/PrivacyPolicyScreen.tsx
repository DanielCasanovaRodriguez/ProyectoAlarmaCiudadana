import { LegalScreen } from '../legal/LegalDocument';

/** Política de Tratamiento de Datos Personales (contenido en src/legal/documentos.tsx). */
export function PrivacyPolicyScreen({ onBack }: { onBack: () => void }) {
  return <LegalScreen tipo="privacidad" onBack={onBack} />;
}
