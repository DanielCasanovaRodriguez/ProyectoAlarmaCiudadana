import { useState, useEffect } from 'react';
import { AdminSidebar }       from '../../admin/AdminSidebar';
import { AdminHeader }        from '../../admin/AdminHeader';
import { AdminProfileDialog } from '../../admin/AdminProfileDialog';
import { AdminOverviewScreen } from './AdminOverviewScreen';
import { AdminUsersScreen }    from './AdminUsersScreen';
import { AdminAlertsScreen }   from './AdminAlertsScreen';
import { AdminAuditScreen }    from './AdminAuditScreen';
import { AdminReportsScreen }  from './AdminReportsScreen';
import { AdminHealthScreen }   from './AdminHealthScreen';
import { AdminConfigScreen }   from './AdminConfigScreen';
import { signOut }             from '../../../services/authService';
import { supabase }            from '../../../utils/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

// ================================================================
// TIPOS
// ================================================================
interface AdminPanelProps {
  onLogout?: () => void;
}

// ================================================================
// HELPERS
// ================================================================

/** Extrae el nombre a mostrar de cualquier forma de objeto de perfil */
function displayName(profile: any, user: any): string {
  return profile?.name
    ?? profile?.full_name
    ?? user?.email
    ?? 'Administrador';
}

/** Extrae el email del usuario */
function displayEmail(user: any, profile: any): string {
  return user?.email ?? profile?.email ?? '';
}

// ================================================================
// COMPONENTE
// ================================================================
export function AdminPanel({ onLogout }: AdminPanelProps = {}) {
  const [initializing,    setInitializing]    = useState(true);
  const [authenticated,   setAuthenticated]   = useState(false);
  const [user,            setUser]            = useState<any>(null);
  const [profile,         setProfile]         = useState<any>(null);
  const [accessToken,     setAccessToken]     = useState('');
  const [currentSection,  setCurrentSection]  = useState('overview');
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  useEffect(() => {
    initializePanel();
  }, []);

  // ── Inicialización: verificar sesión activa ─────────────────────
  const initializePanel = async () => {
    setInitializing(true);

    // 1. Verificar si hay sesión activa en Supabase
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.access_token) {
      // 2. Sesión activa → cargar perfil desde localStorage (ya lo guardó CollaboratorLoginScreen)
      const savedUser    = localStorage.getItem('admin_user');
      const savedProfile = localStorage.getItem('admin_profile');

      if (savedUser && savedProfile) {
        try {
          const parsedUser    = JSON.parse(savedUser);
          const parsedProfile = JSON.parse(savedProfile);

          // Verificar que el rol sigue siendo válido
          if (['admin', 'operator', 'auditor'].includes(parsedProfile?.role)) {
            setUser(parsedUser);
            setProfile(parsedProfile);
            setAccessToken(session.access_token);
            setAuthenticated(true);
            setInitializing(false);
            return;
          }
        } catch {
          // localStorage corrupto → limpiar y redirigir al login
          clearLocalStorage();
        }
      }

      // 3. Hay sesión pero no localStorage → refrescar perfil desde BD
      await refreshProfileFromDB(session.access_token);
    } else {
      // 4. Sin sesión activa → redirigir al login de colaboradores
      clearLocalStorage();
      setAuthenticated(false);
    }

    setInitializing(false);
  };

  /** Carga el perfil directamente desde Supabase (sin Edge Functions) */
  const refreshProfileFromDB = async (token: string) => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { setAuthenticated(false); return; }

      const { data: perfil, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error || !perfil) {
        console.error('No se pudo cargar el perfil:', error?.message);
        setAuthenticated(false);
        return;
      }

      if (!['admin', 'operator', 'auditor'].includes(perfil.role)) {
        await supabase.auth.signOut();
        setAuthenticated(false);
        return;
      }

      const userData    = { id: authUser.id, email: authUser.email };
      const profileData = {
        ...perfil,
        name:  perfil.full_name,
        email: authUser.email,
      };

      setUser(userData);
      setProfile(profileData);
      setAccessToken(token);
      setAuthenticated(true);

      // Persistir para futuras cargas
      localStorage.setItem('admin_user',    JSON.stringify(userData));
      localStorage.setItem('admin_profile', JSON.stringify(profileData));
      localStorage.setItem('admin_access_token', token);
    } catch (err: any) {
      console.error('Error refrescando perfil:', err.message);
      setAuthenticated(false);
    }
  };

  const clearLocalStorage = () => {
    localStorage.removeItem('admin_access_token');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('admin_profile');
  };

  // ── Logout ──────────────────────────────────────────────────────
  const handleLogout = async () => {
    await signOut();
    setAuthenticated(false);
    setUser(null);
    setProfile(null);
    setAccessToken('');
    clearLocalStorage();
    toast.success('Sesión cerrada correctamente');
    if (onLogout) onLogout();
  };

  // ── Titulos de sección ──────────────────────────────────────────
  const SECTION_TITLES: Record<string, string> = {
    overview: 'Dashboard General',
    users:    'Gestión de Usuarios y Roles',
    alerts:   'Gestión de Alertas',
    audit:    'Bitácora de Auditoría',
    reports:  'Reportes y Análisis',
    health:   'Salud del Sistema',
    config:   'Configuración del Sistema',
  };

  // ── Render de sección activa ────────────────────────────────────
  const renderSection = () => {
    switch (currentSection) {
      case 'overview': return <AdminOverviewScreen accessToken={accessToken} />;
      case 'users':    return <AdminUsersScreen    accessToken={accessToken} />;
      case 'alerts':   return <AdminAlertsScreen   accessToken={accessToken} />;
      case 'audit':    return <AdminAuditScreen    accessToken={accessToken} />;
      case 'reports':  return <AdminReportsScreen  accessToken={accessToken} />;
      case 'health':   return <AdminHealthScreen   accessToken={accessToken} />;
      case 'config':   return <AdminConfigScreen   accessToken={accessToken} />;
      default:         return <AdminOverviewScreen accessToken={accessToken} />;
    }
  };

  // ── Pantalla de carga inicial ───────────────────────────────────
  if (initializing) {
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-red-600" />
          <p className="text-sm text-gray-500">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  // ── Sin autenticar → redirigir al login de colaboradores ─────────
  // El componente padre (App.tsx) maneja la navegación; aquí simplemente
  // mostramos un mensaje mientras App.tsx detecta que no hay sesión.
  if (!authenticated) {
    // Notificar al padre para que vuelva al login de colaboradores
    if (onLogout) {
      onLogout();
    }
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-2">Sesión no válida.</p>
          <p className="text-sm text-gray-400">Redirigiendo al login...</p>
        </div>
      </div>
    );
  }

  // ── Panel principal ─────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* Sidebar */}
      <AdminSidebar
        currentSection={currentSection}
        onSectionChange={setCurrentSection}
        userRole={profile?.role ?? 'admin'}
      />

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Header */}
        <AdminHeader
          title={SECTION_TITLES[currentSection] ?? 'Panel de Administrador'}
          userName={displayName(profile, user)}
          userEmail={displayEmail(user, profile)}
          onLogout={handleLogout}
          onProfileClick={() => setProfileDialogOpen(true)}
          onSettingsClick={() => setCurrentSection('config')}
        />

        {/* Área de contenido */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {renderSection()}
        </main>
      </div>

      {/* Diálogo de perfil */}
      <AdminProfileDialog
        open={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
        profile={profile}
        user={user}
      />
    </div>
  );
}
