/**
 * Documentos legales de Alerta Ciudadana (Colombia).
 *
 * Fuentes normativas citadas (verificadas el 2026-10-08):
 *  - Constitución Política, arts. 15 (intimidad y habeas data) y 20.
 *  - Ley Estatutaria 1581 de 2012 (protección de datos personales).
 *  - Decreto 1377 de 2013, compilado en el Decreto Único 1074 de 2015.
 *  - Circular Externa 005 de 2017 de la SIC (transferencias internacionales;
 *    Estados Unidos figura entre los países con nivel adecuado).
 *  - Ley 527 de 1999 (validez de los mensajes de datos).
 *  - Ley 1273 de 2009 (delitos informáticos) y Ley 599 de 2000, art. 296
 *    (falsedad personal).
 *  - Ley 1801 de 2016, art. 35 num. 7 (uso inadecuado de la línea 123).
 *  - Ley 23 de 1982 (derechos de autor).
 */
import type { ReactNode } from 'react';
import { RESPONSABLE, ENCARGADOS, POLITICA_VIGENCIA } from '../config/legal';
import { LINEAS_EMERGENCIA } from '../config/colombia';

export interface SeccionLegal { id: string; titulo: string; cuerpo: ReactNode }
export interface DocumentoLegal { titulo: string; subtitulo: string; secciones: SeccionLegal[] }

const pendiente = (v: string | null) => v ?? 'Pendiente de publicación (mientras tanto usa el canal de la app)';

const Lista = ({ items }: { items: ReactNode[] }) => (
  <ul className="list-disc pl-5 space-y-1">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
);

// =====================================================================
// POLÍTICA DE TRATAMIENTO DE DATOS PERSONALES
// =====================================================================
export const POLITICA_DATOS: DocumentoLegal = {
  titulo: 'Política de Tratamiento de Datos Personales',
  subtitulo: `Vigente desde el ${POLITICA_VIGENCIA}. Ley 1581 de 2012 y Decreto 1377 de 2013 (Decreto 1074 de 2015).`,
  secciones: [
    {
      id: 'responsable', titulo: '1. Responsable del Tratamiento',
      cuerpo: (
        <Lista items={[
          <><strong>Nombre:</strong> {RESPONSABLE.nombre} ({RESPONSABLE.naturaleza}).</>,
          <><strong>Domicilio:</strong> {RESPONSABLE.domicilio}.</>,
          <><strong>Dirección:</strong> {pendiente(RESPONSABLE.direccion)}.</>,
          <><strong>Correo electrónico:</strong> {pendiente(RESPONSABLE.correo)}.</>,
          <><strong>Teléfono:</strong> {pendiente(RESPONSABLE.telefono)}.</>,
          <><strong>Atención de consultas y reclamos:</strong> {RESPONSABLE.canal}. Allí las solicitudes quedan
            registradas con su fecha y el plazo legal de respuesta.</>,
        ]} />
      ),
    },
    {
      id: 'marco', titulo: '2. Marco legal',
      cuerpo: (
        <Lista items={[
          'Constitución Política de Colombia, artículo 15 (intimidad y habeas data) y artículo 20.',
          'Ley Estatutaria 1581 de 2012, régimen general de protección de datos personales.',
          'Decreto 1377 de 2013, compilado en el Decreto Único Reglamentario 1074 de 2015.',
          'Circular Externa 005 de 2017 de la Superintendencia de Industria y Comercio (SIC), sobre transferencias internacionales.',
          'Ley 527 de 1999: las autorizaciones dadas en la app (mensajes de datos) tienen plena validez.',
          'Ley 1273 de 2009: protección penal de la información y de los datos.',
        ]} />
      ),
    },
    {
      id: 'definiciones', titulo: '3. Definiciones',
      cuerpo: (
        <Lista items={[
          <><strong>Titular:</strong> la persona cuyos datos se tratan (tú).</>,
          <><strong>Tratamiento:</strong> recolección, almacenamiento, uso, circulación o supresión de datos.</>,
          <><strong>Autorización:</strong> tu consentimiento previo, expreso e informado.</>,
          <><strong>Encargado:</strong> quien trata datos por cuenta del Responsable (p. ej. el proveedor de la base de datos).</>,
          <><strong>Dato sensible:</strong> el que afecta tu intimidad o puede generar discriminación (salud, datos biométricos, entre otros).</>,
        ]} />
      ),
    },
    {
      id: 'datos', titulo: '4. Datos que tratamos',
      cuerpo: (
        <>
          <Lista items={[
            <><strong>Identificación:</strong> nombres, apellidos, número de cédula de ciudadanía y fecha de expedición.
              La cédula y su fecha se guardan <strong>cifradas</strong>; solo un administrador puede consultar el número
              completo y cada consulta queda registrada.</>,
            <><strong>Contacto:</strong> correo electrónico y, si lo das, número de celular.</>,
            <><strong>Ubicación:</strong> las coordenadas del lugar de cada alerta y, si activas los avisos de alertas
              cercanas, tu última ubicación conocida (se reemplaza en cada actualización; no guardamos tu recorrido).</>,
            <><strong>Contenido de las alertas:</strong> tipo de emergencia, descripción y las fotos, videos o audios que adjuntes.</>,
            <><strong>Contactos de emergencia:</strong> nombre y teléfono de las personas que registres. Al agregarlas declaras
              que te autorizaron a hacerlo.</>,
            <><strong>Datos técnicos y de seguridad:</strong> identificador del celular para notificaciones, registro de
              actividad (auditoría) e intentos de acceso. La dirección IP se guarda transformada (huella irreversible).</>,
          ]} />
          <p className="mt-2">
            <strong>Datos sensibles.</strong> Las fotos, videos o audios pueden mostrar rostros, voces o el estado de salud de
            personas. Adjuntarlos es <strong>opcional</strong>: no estás obligado a autorizar el tratamiento de datos sensibles
            (Ley 1581, art. 6; Decreto 1377, art. 6). Evita incluir datos personales en la descripción.
          </p>
        </>
      ),
    },
    {
      id: 'finalidades', titulo: '5. Finalidades',
      cuerpo: (
        <Lista items={[
          'Recibir, mostrar y gestionar tus reportes de emergencia y su estado.',
          'Avisar al personal que atiende las alertas y a las personas que están a 1 km o menos del lugar. Ellas ven el tipo, la descripción y el lugar de la alerta, nunca tu nombre, tu cédula ni tus evidencias.',
          'Verificar que cada cuenta corresponde a una sola cédula y prevenir reportes falsos, suplantación y abuso del servicio.',
          'Darte acceso seguro a tu cuenta (inicio de sesión con cédula o correo, recuperación de contraseña).',
          'Atender tus consultas, reclamos y solicitudes como titular.',
          'Cumplir órdenes de autoridades judiciales o administrativas competentes.',
          'Elaborar estadísticas sin datos que te identifiquen.',
        ]} />
      ),
    },
    {
      id: 'autorizacion', titulo: '6. Autorización',
      cuerpo: (
        <>
          <p>
            La autorización se otorga al crear la cuenta y al aceptar esta política en la app, marcando las casillas
            correspondientes. El silencio no se entiende como autorización. Guardamos la versión aceptada y la fecha
            como prueba (Decreto 1377, art. 8). Si esta política cambia de forma sustancial, te la volveremos a presentar.
          </p>
          <p className="mt-2">
            No se requiere autorización en los casos del artículo 10 de la Ley 1581: información requerida por una entidad
            pública o administrativa en ejercicio de sus funciones legales o por orden judicial, datos de naturaleza pública,
            casos de urgencia médica o sanitaria, tratamiento autorizado por la ley para fines históricos, estadísticos o
            científicos, y datos del Registro Civil.
          </p>
        </>
      ),
    },
    {
      id: 'derechos', titulo: '7. Tus derechos como titular',
      cuerpo: (
        <Lista items={[
          'Conocer, actualizar y rectificar tus datos (también frente a datos parciales, inexactos o incompletos).',
          'Solicitar prueba de la autorización que nos diste.',
          'Ser informado sobre el uso que le damos a tus datos.',
          'Presentar quejas ante la Superintendencia de Industria y Comercio (SIC), después de agotar el trámite ante nosotros.',
          'Revocar la autorización y pedir la supresión de tus datos, cuando no exista un deber legal o contractual de conservarlos.',
          'Acceder gratuitamente a tus datos personales.',
        ]} />
      ),
    },
    {
      id: 'procedimiento', titulo: '8. Cómo ejercer tus derechos',
      cuerpo: (
        <>
          <p>Desde la app: <strong>Perfil → Mis datos y derechos</strong>. Recibirás una respuesta dentro de los plazos legales:</p>
          <Lista items={[
            <><strong>Consultas:</strong> máximo 10 días hábiles desde su recibo; si no es posible, te informaremos el motivo
              y la nueva fecha, que no superará 5 días hábiles adicionales (Ley 1581, art. 14).</>,
            <><strong>Reclamos</strong> (corrección, actualización, supresión, revocatoria o incumplimiento): máximo 15 días
              hábiles desde el día siguiente a su recibo, prorrogables hasta por 8 días hábiles informándote el motivo
              (Ley 1581, art. 15). Si el reclamo está incompleto te pediremos completarlo dentro de los 5 días siguientes;
              si pasan 2 meses sin hacerlo, se entenderá que desististe.</>,
            'Para acudir a la SIC primero debes haber agotado este trámite (Ley 1581, art. 16).',
          ]} />
        </>
      ),
    },
    {
      id: 'circulacion', titulo: '9. Con quién compartimos tus datos',
      cuerpo: (
        <>
          <p>No vendemos ni cedemos tus datos con fines comerciales o publicitarios. Los conocen:</p>
          <Lista items={[
            'El personal autorizado del servicio (operadores y administradores), solo para atender las alertas y la seguridad del sistema.',
            'Las autoridades que los soliciten en ejercicio de sus funciones legales o por orden judicial.',
            <>Encargados que prestan la infraestructura:
              <ul className="list-[circle] pl-5 mt-1 space-y-0.5">
                {ENCARGADOS.map(e => <li key={e.nombre}>{e.nombre}: {e.servicio} — {e.pais}.</li>)}
              </ul>
            </>,
          ]} />
          <p className="mt-2">
            Esto implica una transmisión internacional de datos a Estados Unidos, país que la SIC reconoce con nivel adecuado
            de protección (Circular Externa 005 de 2017; Ley 1581, art. 26).
          </p>
        </>
      ),
    },
    {
      id: 'seguridad', titulo: '10. Seguridad',
      cuerpo: (
        <Lista items={[
          'Conexiones cifradas (HTTPS) y datos de identificación cifrados en la base de datos.',
          'Cada persona solo puede ver sus propios datos; el personal ve únicamente lo necesario para su función.',
          'Bloqueo temporal ante intentos repetidos de acceso y límites de envío de alertas.',
          'Registro de auditoría de las acciones sensibles.',
          'Ante un incidente de seguridad que afecte tus datos, lo informaremos a la SIC y a los titulares afectados.',
        ]} />
      ),
    },
    {
      id: 'conservacion', titulo: '11. Conservación y supresión',
      cuerpo: (
        <p>
          Conservamos tus datos mientras tu cuenta esté activa. Si pides la supresión, eliminamos tu cuenta, tu cédula,
          tus contactos, tus dispositivos, tu ubicación y tus alertas con sus evidencias. Solo conservamos, sin vínculo a tu
          cuenta, el registro de auditoría y la constancia de tu solicitud, como prueba de que fue atendida. Si un deber
          legal o una orden de autoridad exige conservar alguna información, te lo indicaremos en la respuesta.
        </p>
      ),
    },
    {
      id: 'menores', titulo: '12. Niños, niñas y adolescentes',
      cuerpo: (
        <p>
          El servicio es para personas con cédula de ciudadanía, es decir, mayores de edad. No recolectamos
          intencionalmente datos de menores (Ley 1581, art. 7). Si un niño, niña o adolescente necesita ayuda, debe llamar
          a la Línea 123 o al ICBF (141).
        </p>
      ),
    },
    {
      id: 'vigencia', titulo: '13. Vigencia y cambios',
      cuerpo: (
        <p>
          Esta política rige desde el {POLITICA_VIGENCIA} y mientras se presten los servicios. Los cambios sustanciales
          se informarán en la app antes de aplicarse y se pedirá de nuevo tu autorización cuando corresponda.
        </p>
      ),
    },
  ],
};

// =====================================================================
// TÉRMINOS Y CONDICIONES DE USO
// =====================================================================
export const TERMINOS: DocumentoLegal = {
  titulo: 'Términos y Condiciones de Uso',
  subtitulo: `Vigentes desde el ${POLITICA_VIGENCIA}. Ley aplicable: República de Colombia.`,
  secciones: [
    {
      id: 'objeto', titulo: '1. Qué es Alerta Ciudadana',
      cuerpo: (
        <>
          <p>
            Alerta Ciudadana es una herramienta comunitaria para reportar situaciones de riesgo y avisar al personal que
            las atiende y a las personas cercanas. Es un proyecto académico de seguridad ciudadana.
          </p>
          <p className="mt-2 font-semibold text-red-700">
            Alerta Ciudadana NO reemplaza a la Línea Única de Emergencias 123 ni a las autoridades. Si hay una vida en
            riesgo, llama primero al 123.
          </p>
        </>
      ),
    },
    {
      id: 'usuarios', titulo: '2. Quién puede usarla',
      cuerpo: (
        <Lista items={[
          'Personas mayores de edad con cédula de ciudadanía colombiana. Cada cédula puede tener una sola cuenta.',
          'Los datos que registras deben ser verdaderos y propios. Suplantar a otra persona puede constituir el delito de falsedad personal (Código Penal, Ley 599 de 2000, art. 296).',
          'El servicio solo recibe alertas ubicadas en el territorio colombiano.',
        ]} />
      ),
    },
    {
      id: 'cuenta', titulo: '3. Tu cuenta',
      cuerpo: (
        <Lista items={[
          'Puedes ingresar con tu número de cédula o con tu correo, siempre con tu contraseña.',
          'Tu contraseña es personal: no la compartas. Eres responsable de lo que se haga con tu cuenta.',
          'Si notas un uso que no reconoces, cambia tu contraseña y avísanos desde Perfil → Mis datos y derechos.',
          'Tras varios intentos fallidos el acceso se bloquea temporalmente para protegerte.',
        ]} />
      ),
    },
    {
      id: 'uso', titulo: '4. Uso adecuado',
      cuerpo: (
        <>
          <p>Te comprometes a reportar solo situaciones reales. Está prohibido:</p>
          <Lista items={[
            'Enviar alertas falsas, de broma o para molestar a otras personas.',
            'Publicar contenido ilegal, violento sin relación con la emergencia, discriminatorio o que viole la intimidad de terceros.',
            'Incluir datos personales de otras personas en las descripciones sin necesidad.',
            'Intentar acceder a cuentas o datos ajenos o afectar el funcionamiento del sistema (Ley 1273 de 2009).',
          ]} />
          <p className="mt-2">
            Usar indebidamente la Línea 123 se sanciona con multa general tipo 4 y participación en actividad pedagógica
            (Ley 1801 de 2016, art. 35, num. 7).
          </p>
        </>
      ),
    },
    {
      id: 'antiabuso', titulo: '5. Medidas contra el abuso',
      cuerpo: (
        <Lista items={[
          'Límite de envío: 1 alerta por minuto, 3 cada 10 minutos y 10 por día.',
          'El personal puede marcar una alerta como falsa. Con 3 alertas falsas en 30 días, los reportes se suspenden 7 días.',
          'Ante abusos graves o reiterados la cuenta puede ser suspendida. Puedes pedir la revisión desde Mis datos y derechos.',
        ]} />
      ),
    },
    {
      id: 'contenido', titulo: '6. Contenido que envías',
      cuerpo: (
        <p>
          Sigues siendo titular de las fotos, videos, audios y textos que envías (Ley 23 de 1982). Nos autorizas a usarlos
          solo para atender la alerta, para la seguridad del servicio y para entregarlos a autoridades competentes cuando
          lo soliciten. Respeta la intimidad de las demás personas que aparezcan en ellos.
        </p>
      ),
    },
    {
      id: 'servicio', titulo: '7. Alcance y limitaciones del servicio',
      cuerpo: (
        <Lista items={[
          'El servicio depende de tu conexión a internet, del GPS y de los permisos del celular. Sin ellos las alertas pueden demorarse o no enviarse.',
          'Las notificaciones dependen de servicios de terceros (Firebase) y de la configuración de tu celular.',
          'No garantizamos tiempos de atención: el personal atiende las alertas según su disponibilidad.',
          'Tus contactos de emergencia no se notifican de forma automática: tras enviar una alerta puedes avisarles con un toque por SMS o WhatsApp.',
        ]} />
      ),
    },
    {
      id: 'lineas', titulo: '8. Líneas de atención en Colombia',
      cuerpo: <Lista items={LINEAS_EMERGENCIA.map(l => <><strong>{l.numero}</strong> — {l.nombre}: {l.uso}.</>)} />,
    },
    {
      id: 'datos', titulo: '9. Datos personales',
      cuerpo: <p>El tratamiento de tus datos se rige por la Política de Tratamiento de Datos Personales, que forma parte de estos términos.</p>,
    },
    {
      id: 'cambios', titulo: '10. Cambios, ley aplicable y contacto',
      cuerpo: (
        <p>
          Podemos actualizar estos términos; los cambios importantes se avisarán en la app. Se rigen por las leyes de la
          República de Colombia. Contacto: {RESPONSABLE.canal}.
        </p>
      ),
    },
  ],
};
