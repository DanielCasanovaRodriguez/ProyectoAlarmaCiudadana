import React, { useState, useEffect } from 'react';
import { ArrowLeft, Phone, Plus, X, AlertTriangle, Info, Loader2, Bell, ChevronRight } from 'lucide-react';
import { Button }    from '../ui/button';
import { Input }     from '../ui/input';
import { Switch }    from '../ui/switch';
import { getEmergencyContacts, saveEmergencyContacts } from '../../services/profileService';
import type { EmergencyContactInput } from '../../services/profileService';
import { toast } from 'sonner';

interface LocalContact extends EmergencyContactInput {
  _localId: string;
}

const RELATIONSHIPS = ['Familiar', 'Amigo', 'Vecino', 'Compañero de trabajo', 'Médico', 'Otro'];

const EMERGENCY_NUMBERS = [
  { label: 'Policía Nacional',       num: '123', color: 'bg-blue-100',   text: 'text-blue-700' },
  { label: 'Bomberos',               num: '119', color: 'bg-red-100',    text: 'text-red-700'  },
  { label: 'Cruz Roja / Ambulancia', num: '132', color: 'bg-green-100',  text: 'text-green-700'},
  { label: 'Defensa Civil',          num: '144', color: 'bg-orange-100', text: 'text-orange-700'},
  { label: 'Línea de Emergencias',   num: '112', color: 'bg-purple-100', text: 'text-purple-700'},
];

interface EmergencyContactScreenProps {
  onBack: () => void;
}

export function EmergencyContactScreen({ onBack }: EmergencyContactScreenProps) {
  const [contacts,    setContacts]    = useState<LocalContact[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContact,  setNewContact]  = useState<EmergencyContactInput>({
    name: '', phone: '', relation: 'Familiar', notificar_sos: true,
  });
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await getEmergencyContacts();
      if (error) {
        toast.error('No se pudieron cargar los contactos', { description: error });
      } else if (data) {
        setContacts(data.map(c => ({
          _localId:      String(c.id),
          name:          c.name,
          phone:         c.phone,
          relation:      c.relation ?? 'Familiar',
          notificar_sos: c.notificar_sos,
        })));
      }
      setLoading(false);
    };
    load();
  }, []);

  const persist = async (updated: LocalContact[]) => {
    setSaving(true);
    const { data, error } = await saveEmergencyContacts('', updated.map(c => ({
      name: c.name, phone: c.phone, relation: c.relation, notificar_sos: c.notificar_sos,
    })));
    setSaving(false);
    if (error) { toast.error('Error al guardar', { description: error }); return false; }
    if (data) {
      setContacts(data.map(c => ({
        _localId: String(c.id), name: c.name, phone: c.phone,
        relation: c.relation ?? 'Familiar', notificar_sos: c.notificar_sos,
      })));
    }
    return true;
  };

  const handleAdd = async () => {
    if (!newContact.name.trim() || !newContact.phone.trim()) return;
    const formatted: LocalContact = {
      _localId:      `tmp_${Date.now()}`,
      name:          newContact.name.trim(),
      phone:         newContact.phone.trim().startsWith('+57') ? newContact.phone.trim() : `+57 ${newContact.phone.trim()}`,
      relation:      newContact.relation || 'Familiar',
      notificar_sos: newContact.notificar_sos,
    };
    const updated = [...contacts, formatted];
    setContacts(updated);
    setNewContact({ name: '', phone: '', relation: 'Familiar', notificar_sos: true });
    setShowAddForm(false);
    if (await persist(updated)) toast.success('Contacto guardado');
  };

  const handleRemove = async (localId: string) => {
    const updated = contacts.filter(c => c._localId !== localId);
    setContacts(updated);
    if (await persist(updated)) toast.success('Contacto eliminado');
  };

  const handleToggle = async (localId: string, value: boolean) => {
    const updated = contacts.map(c => c._localId === localId ? { ...c, notificar_sos: value } : c);
    setContacts(updated);
    await persist(updated);
  };

  return (
    <div className="h-full bg-gray-50 flex flex-col">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-red-600 to-red-800 px-4 pt-12 pb-8 relative">
        <button
          onClick={onBack}
          className="absolute top-4 left-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        {saving && (
          <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 h-9 bg-white/20 rounded-full">
            <Loader2 className="w-4 h-4 text-white animate-spin" />
            <span className="text-white text-xs">Guardando...</span>
          </div>
        )}

        <div className="mt-2 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Phone className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Contactos de Emergencia</h1>
          <p className="text-red-100 text-sm mt-1">Serán notificados automáticamente al activar SOS</p>
        </div>
      </div>

      {/* ── Contenido ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto -mt-3">

        {/* Números de emergencia Colombia */}
        <div className="mx-4 mb-4 bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-2 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Números de Emergencia · Colombia
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {EMERGENCY_NUMBERS.map(e => (
              <div key={e.num} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-700">{e.label}</span>
                <span className={`text-base font-bold font-mono px-2.5 py-0.5 rounded-lg ${e.color} ${e.text}`}>
                  {e.num}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Contactos personales */}
        <div className="mx-4 mb-4 bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                <Phone className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Mis Contactos
              </p>
            </div>
            {!showAddForm && contacts.length < 5 && (
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-full hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar
              </button>
            )}
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Cargando...</span>
            </div>
          )}

          {/* Lista de contactos */}
          {!loading && contacts.length > 0 && (
            <div className="divide-y divide-gray-100">
              {contacts.map(contact => (
                <div key={contact._localId} className="px-4 py-3.5">
                  <div className="flex items-start justify-between mb-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-gray-500">
                          {contact.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{contact.name}</p>
                        <p className="text-xs text-gray-500 font-mono">{contact.phone}</p>
                        {contact.relation && (
                          <span className="inline-block mt-0.5 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {contact.relation}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(contact._localId)}
                      className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Bell className="w-3.5 h-3.5 text-gray-500" />
                      <span className="text-xs text-gray-600 font-medium">Notificar en SOS</span>
                    </div>
                    <Switch
                      checked={contact.notificar_sos}
                      onCheckedChange={v => handleToggle(contact._localId, v)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && contacts.length === 0 && !showAddForm && (
            <div className="flex flex-col items-center py-8 text-gray-400">
              <Phone className="w-10 h-10 opacity-30 mb-2" />
              <p className="text-sm">Sin contactos de emergencia</p>
              <p className="text-xs mt-0.5">Toca "Agregar" para añadir uno</p>
            </div>
          )}

          {contacts.length >= 5 && (
            <p className="text-xs text-gray-400 text-center pb-3">Máximo 5 contactos</p>
          )}

          {/* Formulario agregar */}
          {showAddForm && (
            <div className="mx-4 mb-4 p-4 border border-blue-200 rounded-xl bg-blue-50">
              <h4 className="text-sm font-semibold text-blue-900 mb-3">Nuevo contacto</h4>
              <div className="space-y-3">
                <Input
                  placeholder="Nombre completo *"
                  value={newContact.name}
                  onChange={e => setNewContact({ ...newContact, name: e.target.value })}
                  className="bg-white border-blue-200"
                />
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Teléfono *"
                    value={newContact.phone}
                    onChange={e => setNewContact({ ...newContact, phone: e.target.value })}
                    type="tel"
                    className="pl-9 bg-white border-blue-200"
                  />
                </div>
                <select
                  className="w-full p-2.5 border border-blue-200 rounded-md text-sm bg-white"
                  value={newContact.relation ?? 'Familiar'}
                  onChange={e => setNewContact({ ...newContact, relation: e.target.value })}
                >
                  {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 border border-blue-200">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium">Notificar en SOS</p>
                      <p className="text-xs text-gray-500">Recibirá aviso al activar alerta</p>
                    </div>
                  </div>
                  <Switch
                    checked={newContact.notificar_sos}
                    onCheckedChange={v => setNewContact({ ...newContact, notificar_sos: v })}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAdd}
                    disabled={!newContact.name.trim() || !newContact.phone.trim() || saving}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setNewContact({ name: '', phone: '', relation: 'Familiar', notificar_sos: true });
                    }}
                    className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Aviso legal */}
        <div className="mx-4 mb-8">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-amber-800 mb-1">Aviso de privacidad</p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Al agregar contactos autorizas el envío de avisos automáticos al activar una alerta SOS,
                  conforme a la Ley 1273 de 2009.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
