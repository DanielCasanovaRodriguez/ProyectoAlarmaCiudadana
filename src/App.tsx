import React, { useState, useEffect, useRef } from 'react';
import { toUserMessage, isOfflineError } from './utils/errors';
import { WelcomeScreen } from './components/screens/WelcomeScreen';
import { OnboardingScreen } from './components/screens/OnboardingScreen';
import { LocationPermissionScreen } from './components/screens/LocationPermissionScreen';
import { MainMapScreen } from './components/screens/MainMapScreen';
import { AlertHistoryScreen } from './components/screens/AlertHistoryScreen';
import { AlertDetailScreen } from './components/screens/AlertDetailScreen';
import { ProfileScreen } from './components/screens/ProfileScreen';
import { AlertConfirmationScreen } from './components/screens/AlertConfirmationScreen';
import { TutorialScreen } from './components/screens/TutorialScreen';
import { EmergencyContactScreen } from './components/screens/EmergencyContactScreen';
import { AboutAppScreen } from './components/screens/AboutAppScreen';
import { PrivacyPolicyScreen } from './components/screens/PrivacyPolicyScreen';
import { LoginScreen } from './components/screens/LoginScreen';
import { RegisterScreen } from './components/screens/RegisterScreen';
import { EmailVerificationScreen } from './components/screens/EmailVerificationScreen';
import { ForgotPasswordScreen } from './components/screens/ForgotPasswordScreen';
import { OTPVerificationScreen } from './components/screens/OTPVerificationScreen';
import { ResetPasswordScreen } from './components/screens/ResetPasswordScreen';
import { DataConsentScreen } from './components/screens/DataConsentScreen';
import { AuthWelcomeScreen } from './components/screens/AuthWelcomeScreen';
import { CollaboratorLoginScreen } from './components/screens/CollaboratorLoginScreen';
import { OperatorDashboard } from './components/screens/operator/OperatorDashboard';
import { OperatorSettingsScreen } from './components/screens/operator/OperatorSettingsScreen';
import { AdminPanel } from './components/screens/admin/AdminPanel';
import { Toaster } from './components/ui/sonner';
import { ConnectionBanner } from './components/ConnectionBanner';
import { toast } from 'sonner';
import {
  getUserAlertHistory,
  getActiveAlerts,
  createAlert as createAlertDB,
  updateAlertMediaUrls,
  cancelAlert as cancelAlertDB,
} from './services/alertService.ts';
import { completeRegistration, sendPasswordResetOTP, cerrarSesion } from './services/authService.ts';
import { uploadMultipleFiles } from './services/mediaService';
import { getCurrentLocation, hasLocationPermission, initNativeShell, registerForPush, unregisterPush, watchLocation } from './platform';
import { supabase } from './utils/supabase/client';

// ================================================================
// TIPOS GLOBALES
// ================================================================

export interface Alert {
  id:           string;
  type:         'medical' | 'robbery' | 'accident' | 'fire' | 'violence';
  location:     { lat: number; lng: number };
  timestamp:    Date;
  description?: string;
  mediaUrls?:   string[];
  status?:      'open' | 'ack' | 'resolved';
}

export type Screen =
  | 'welcome'
  | 'onboarding'
  | 'auth-welcome'
  | 'login'
  | 'register'
  | 'email-verification'
  | 'forgot-password'
  | 'otp-verification'
  | 'reset-password'
  | 'data-consent'
  | 'location-permission'
  | 'main-map'
  | 'alert-history'
  | 'alert-detail'
  | 'profile'
  | 'alert-confirmation'
  | 'tutorial'
  | 'emergency-contact'
  | 'about-app'
  | 'privacy-policy'
  | 'operator-login'
  | 'operator-registration'
  | 'operator-dashboard'
  | 'operator-settings'
  | 'admin-panel';

export interface AppState {
  currentScreen:    Screen;
  onboardingStep:   number;
  auth: {
    isLoggedIn:  boolean;
    email:       string;
    password:    string;
    resetEmail:  string;
  };
  user: {
    name:                   string;
    hasLocationPermission:  boolean;
    hasCompletedOnboarding: boolean;
  };
  // Alertas propias del usuario — para historial y detalle
  alerts:     Alert[];
  // Alertas activas de toda el área — para el mapa (E5)
  areaAlerts: Alert[];
  lastCreatedAlert:    Alert | null;
  selectedAlertId:     string | null;
  pendingVerification: { email: string; localCode?: string; name?: string } | null;
  userLocation:        { lat: number; lng: number } | null;
}

// ================================================================
// HELPER: convertir alerta de BD al formato de App
// ================================================================
function convertDbAlert(dbAlert: any): Alert {
  return {
    id:          dbAlert.id,
    type:        dbAlert.type_code,
    location:    { lat: dbAlert.lat, lng: dbAlert.lng },
    timestamp:   new Date(dbAlert.created_at),
    description: dbAlert.description,
    mediaUrls:   dbAlert.media_urls ?? [],
    status:      dbAlert.status,
  };
}

// ================================================================
// COMPONENTE PRINCIPAL
// ================================================================

// Último perfil conocido (solo nombre, rol y estado) para abrir la app sin conexión
type PerfilLocal = { full_name: string | null; role: string | null; status: string };
const PERFIL_LOCAL_KEY = 'ac_perfil_local';
function guardarPerfilLocal(userId: string, p: PerfilLocal) {
  try { localStorage.setItem(PERFIL_LOCAL_KEY, JSON.stringify({ userId, ...p })); } catch { /* sin almacenamiento */ }
}
function leerPerfilLocal(userId: string): PerfilLocal | null {
  try {
    const v = JSON.parse(localStorage.getItem(PERFIL_LOCAL_KEY) ?? 'null');
    return v && v.userId === userId ? { full_name: v.full_name, role: v.role, status: v.status } : null;
  } catch { return null; }
}

export default function App() {
  const [appState, setAppState] = useState<AppState>({
    currentScreen:    'welcome',
    onboardingStep:   0,
    auth: {
      isLoggedIn: false,
      email:      '',
      password:   '',
      resetEmail: '',
    },
    user: {
      name:                   '',
      hasLocationPermission:  false,
      hasCompletedOnboarding: false,
    },
    alerts:              [],
    areaAlerts:          [],
    lastCreatedAlert:    null,
    selectedAlertId:     null,
    pendingVerification: null,
    userLocation:        null,
  });

  // ── Cargar historial propio del usuario ──────────────────────────
  // Se ejecuta en las pantallas donde el ciudadano consulta sus alertas
  useEffect(() => {
    const loadUserAlerts = async () => {
      if (
        appState.auth.isLoggedIn &&
        (appState.currentScreen === 'main-map'      ||
         appState.currentScreen === 'alert-history' ||
         appState.currentScreen === 'alert-detail')
      ) {
        try {
          const alertas = await getUserAlertHistory();
          setAppState(prev => ({
            ...prev,
            alerts: alertas.map(convertDbAlert),
          }));
        } catch (error) {
          console.error('Error cargando historial de alertas:', error);
        }
      }
    };

    loadUserAlerts();
    const id = setInterval(loadUserAlerts, 30_000);
    return () => clearInterval(id);
  }, [appState.auth.isLoggedIn, appState.currentScreen]);

  // ── E5: Cargar alertas activas del área para el mapa ────────────
  // Solo se ejecuta cuando el ciudadano está en el mapa.
  // Incluye alertas de TODOS los usuarios, no solo las propias.
  // Usa Supabase Realtime para actualizaciones instantáneas entre usuarios
  // + polling de respaldo cada 15 s.
  useEffect(() => {
    if (!appState.auth.isLoggedIn || appState.currentScreen !== 'main-map') return;

    const loadAreaAlerts = async () => {
      try {
        const activas = await getActiveAlerts();
        setAppState(prev => ({
          ...prev,
          areaAlerts: activas.map(convertDbAlert),
        }));
      } catch (error) {
        console.error('Error cargando alertas del área:', error);
      }
    };

    // Carga inicial inmediata
    loadAreaAlerts();

    // Polling de respaldo cada 15 s (por si Realtime falla)
    const intervalId = setInterval(loadAreaAlerts, 15_000);

    // ── Suscripción Realtime — actualizaciones instantáneas ────────
    // Escucha INSERT, UPDATE y DELETE en la tabla alerts.
    // Cuando cualquier usuario crea o modifica una alerta, todos los
    // clientes en la pantalla del mapa reciben la actualización de inmediato.
    const channel = supabase
      .channel('public-area-alerts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alerts' },
        (_payload) => {
          // Recargar lista completa para mantener consistencia
          loadAreaAlerts();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime conectado — alertas del área');
        }
      });

    return () => {
      clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [appState.auth.isLoggedIn, appState.currentScreen]);

  // ── Historial de pantallas (botón atrás de Android) ─────────────
  // Pantallas raíz: "atrás" minimiza la app. Pantallas transitorias
  // (verificaciones, confirmación): no se vuelve a ellas con "atrás".
  const ROOT_SCREENS: Screen[] = ['welcome', 'auth-welcome', 'main-map', 'operator-dashboard', 'admin-panel'];
  const TRANSIENT_SCREENS: Screen[] = ['email-verification', 'otp-verification', 'reset-password', 'alert-confirmation', 'location-permission'];
  const historyRef   = useRef<Screen[]>([]);
  const prevScreen   = useRef<Screen>(appState.currentScreen);
  const goingBackRef = useRef(false);

  useEffect(() => {
    const current = appState.currentScreen;
    const prev    = prevScreen.current;
    if (current === prev) return;
    if (ROOT_SCREENS.includes(current)) {
      historyRef.current = [];
    } else if (!goingBackRef.current && !TRANSIENT_SCREENS.includes(prev)) {
      historyRef.current.push(prev);
    }
    goingBackRef.current = false;
    prevScreen.current   = current;
  }, [appState.currentScreen]);

  const currentScreenRef = useRef(appState.currentScreen);
  currentScreenRef.current = appState.currentScreen;

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    initNativeShell(() => {
      if (ROOT_SCREENS.includes(currentScreenRef.current)) return false;
      const target = historyRef.current.pop()
        ?? (appState.auth.isLoggedIn ? 'main-map' : 'auth-welcome');
      goingBackRef.current = true;
      setAppState(prev => ({ ...prev, currentScreen: target }));
      return true;
    }).then(fn => { cleanup = fn; });
    return () => cleanup?.();
  }, [appState.auth.isLoggedIn]);

  // ── Sesión persistente ───────────────────────────────────────────
  // Al abrir la app (web o Android) se recupera la sesión guardada por
  // Supabase y se lleva al usuario a su pantalla según el rol en la BD.
  const [restoringSession, setRestoringSession] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: perfilBD, error: perfilError } = await supabase
          .from('profiles')
          .select('full_name, role, status')
          .eq('id', session.user.id)
          .single();

        // Sin conexión: se usa el último perfil conocido en este dispositivo
        // para no sacar al usuario de su sesión (la BD lo revalida al volver la red).
        let perfil: PerfilLocal | null = perfilBD;
        if (perfilError && isOfflineError(perfilError)) {
          perfil = leerPerfilLocal(session.user.id);
        } else if (perfilBD) {
          guardarPerfilLocal(session.user.id, perfilBD);
        }

        if (cancelled) return;
        if (!perfil) return; // sin datos para decidir: pantalla de inicio, sesión intacta
        if (perfil.status !== 'active') {
          await supabase.auth.signOut();
          return;
        }

        if (perfil.role === 'admin') {
          setAppState(prev => ({ ...prev, currentScreen: 'admin-panel' }));
          return;
        }
        if (perfil.role === 'operator' || perfil.role === 'auditor') {
          setAppState(prev => ({ ...prev, currentScreen: 'operator-dashboard' }));
          return;
        }

        // Ciudadano: ubicación real del dispositivo si el permiso ya existe
        let location: { lat: number; lng: number } | null = null;
        if (await hasLocationPermission()) {
          try {
            const c = await getCurrentLocation({ highAccuracy: true, timeoutMs: 10_000, maxAgeMs: 60_000 });
            location = { lat: c.lat, lng: c.lng };
          } catch (err) {
            console.warn('No se pudo obtener la ubicación al restaurar la sesión:', err);
          }
        }
        if (cancelled) return;
        setAppState(prev => ({
          ...prev,
          auth: { ...prev.auth, isLoggedIn: true, email: session.user.email ?? '' },
          user: { ...prev.user, name: perfil.full_name ?? '', hasLocationPermission: !!location },
          userLocation: location,
          currentScreen: location ? 'main-map' : 'location-permission',
        }));
      } catch (err) {
        console.warn('No se pudo restaurar la sesión:', err);
      } finally {
        if (!cancelled) setRestoringSession(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Si la sesión se cierra o caduca (en otro dispositivo, token revocado),
  // se vuelve a la pantalla de acceso.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setAppState(prev => {
          const enZonaPrivada = ['main-map', 'alert-history', 'alert-detail', 'profile', 'alert-confirmation',
            'emergency-contact', 'operator-dashboard', 'operator-settings', 'admin-panel'].includes(prev.currentScreen);
          return enZonaPrivada
            ? { ...prev, auth: { ...prev.auth, isLoggedIn: false }, currentScreen: 'auth-welcome' }
            : prev;
        });
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Ubicación real en vivo mientras el mapa está visible ─────────
  // Solo si el permiso ya fue concedido (no vuelve a preguntar) y se
  // detiene al salir del mapa para ahorrar batería.
  useEffect(() => {
    if (appState.currentScreen !== 'main-map') return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    hasLocationPermission().then(async (granted) => {
      if (!granted || cancelled) return;
      stop = await watchLocation(
        (c) => setAppState(prev => ({ ...prev, userLocation: { lat: c.lat, lng: c.lng } })),
        (err) => console.warn('Seguimiento de ubicación:', err.message),
      );
      if (cancelled) stop();
    }).catch(() => undefined);
    return () => { cancelled = true; stop?.(); };
  }, [appState.currentScreen]);

  // ── Notificaciones push (Android, cuando Firebase está configurado) ──
  const pushRegistered = useRef(false);
  useEffect(() => {
    const enSesion = ['main-map', 'operator-dashboard', 'admin-panel'].includes(appState.currentScreen);
    if (!enSesion || pushRegistered.current) return;
    pushRegistered.current = true;
    registerForPush((data) => {
      if (data.alert_id) {
        setAppState(prev => ({ ...prev, selectedAlertId: String(data.alert_id), currentScreen: 'alert-detail' }));
      }
    }).catch(err => console.warn('Push no disponible:', err));
  }, [appState.currentScreen]);

  // ── Helpers de navegación y estado ──────────────────────────────
  const navigateToScreen = (screen: Screen) => {
    setAppState(prev => ({ ...prev, currentScreen: screen }));
  };

  const updateAppState = (updates: Partial<AppState>) => {
    setAppState(prev => ({ ...prev, ...updates }));
  };

  // ================================================================
  // CREAR ALERTA SOS — Flujo completo multimedia
  // ================================================================
  const createAlert = async (
    type:        Alert['type'],
    description: string,
    files:       File[] = []
  ): Promise<void> => {

    // 1. Ubicación fresca del GPS en el momento del SOS. Si no se puede
    //    obtener, se usa la última conocida (o la zona elegida manualmente).
    let location = appState.userLocation;
    try {
      const fresh = await getCurrentLocation({ highAccuracy: true, timeoutMs: 8_000, maxAgeMs: 30_000 });
      location = { lat: fresh.lat, lng: fresh.lng };
      setAppState(prev => ({ ...prev, userLocation: location }));
    } catch (err) {
      console.warn('No se obtuvo ubicación fresca, se usa la última conocida:', err);
    }

    if (!location) {
      // AlarmSheet muestra este error y mantiene el formulario para reintentar
      throw new Error('Activa la ubicación de tu dispositivo para enviar una alerta.');
    }

    // 2. Guardar en la BD. Solo se confirma al usuario cuando el servidor
    //    respondió; si falla, el error llega a AlarmSheet para reintentar.
    const alertaCreada = await createAlertDB({
      type_code:   type,
      lat:         location.lat,
      lng:         location.lng,
      description: description || undefined,
      media_urls:  [],
    });

    const alertaGuardada: Alert = {
      id:          alertaCreada.id,
      type,
      location,
      timestamp:   new Date(alertaCreada.created_at),
      description: description || undefined,
      mediaUrls:   [],
      status:      'open',
    };

    setAppState(prev => ({
      ...prev,
      alerts:           [alertaGuardada, ...prev.alerts.filter(a => a.id !== alertaGuardada.id)],
      areaAlerts:       [alertaGuardada, ...prev.areaAlerts.filter(a => a.id !== alertaGuardada.id)],
      lastCreatedAlert: alertaGuardada,
      currentScreen:    'alert-confirmation',
    }));

    // 3. Evidencias: se suben después de confirmar la alerta, para no
    //    retrasar el SOS. Un fallo aquí no invalida la alerta.
    if (files.length === 0) return;

    try {
      toast.info('Subiendo evidencia...', {
        description: `${files.length} archivo${files.length > 1 ? 's' : ''}`,
      });

      const uploadResult = await uploadMultipleFiles(files, alertaCreada.id);

      if (uploadResult.urls.length > 0) {
        const mediaUrls = uploadResult.urls;
        await updateAlertMediaUrls(alertaCreada.id, mediaUrls);
        const conEvidencia = { ...alertaGuardada, mediaUrls };
        setAppState(prev => ({
          ...prev,
          lastCreatedAlert: prev.lastCreatedAlert?.id === conEvidencia.id ? conEvidencia : prev.lastCreatedAlert,
          alerts:     prev.alerts.map(a => a.id === conEvidencia.id ? conEvidencia : a),
          areaAlerts: prev.areaAlerts.map(a => a.id === conEvidencia.id ? conEvidencia : a),
        }));
        toast.success('Evidencia guardada', {
          description: `${mediaUrls.length} archivo${mediaUrls.length > 1 ? 's' : ''} adjunto${mediaUrls.length > 1 ? 's' : ''}`,
        });
      }

      if (uploadResult.errors.length > 0) {
        toast.warning('Algunos archivos no se pudieron subir', {
          description: uploadResult.errors.join(', '),
        });
      }
    } catch (error: any) {
      console.error('Error subiendo evidencias:', error);
      toast.warning('La alerta se envió, pero la evidencia no se pudo adjuntar', {
        description: toUserMessage(error),
      });
    }
  };

  // ── E4: Seleccionar alerta para ver el detalle ───────────────────
  const handleSelectAlert = (alertId: string) => {
    updateAppState({ selectedAlertId: alertId });
    navigateToScreen('alert-detail');
  };

  // ── E4: Cancelar alerta propia ───────────────────────────────────
  const handleCancelAlert = async (alertId: string): Promise<void> => {
    await cancelAlertDB(alertId);

    setAppState(prev => ({
      ...prev,
      alerts:     prev.alerts.map(a =>
        a.id === alertId ? { ...a, status: 'resolved' as const } : a
      ),
      areaAlerts: prev.areaAlerts.filter(a => a.id !== alertId),
    }));

    toast.success('Alerta cancelada', {
      description: 'La alerta fue marcada como cancelada correctamente.',
    });

    navigateToScreen('alert-history');
  };

  // ================================================================
  // HANDLERS DE AUTENTICACIÓN
  // ================================================================

  const handleLogin = (email: string, _password: string, userName: string) => {
    updateAppState({
      user: { ...appState.user, name: userName },
      auth: { ...appState.auth, isLoggedIn: true, email, password: '' },
    });
    navigateToScreen('location-permission');
  };

  const handleRegister = (name: string, email: string, _password: string) => {
    updateAppState({
      user: { ...appState.user, name },
      auth: { ...appState.auth, email, password: '' },
    });
    navigateToScreen('data-consent');
  };

  const handleDataConsentAccept = () => {
    updateAppState({ auth: { ...appState.auth, isLoggedIn: true } });
    navigateToScreen('location-permission');
  };

  const handleSendPasswordResetCode = (email: string) => {
    updateAppState({ auth: { ...appState.auth, resetEmail: email } });
    navigateToScreen('otp-verification');
  };

  // Cierre de sesión real: borra el token push del dispositivo, cierra la
  // sesión en Supabase (antes solo cambiaba de pantalla) y limpia el estado.
  const handleLogout = async () => {
    try { await unregisterPush(); } catch { /* sin push */ }
    try { await cerrarSesion(); } catch (err) { console.warn('Error al cerrar sesión:', err); }
    ['admin_user', 'admin_profile', 'admin_token', 'admin_access_token', PERFIL_LOCAL_KEY].forEach(k => localStorage.removeItem(k));
    pushRegistered.current = false;
    updateAppState({
      auth:            { isLoggedIn: false, email: '', password: '', resetEmail: '' },
      user:            { name: '', hasLocationPermission: false, hasCompletedOnboarding: false },
      userLocation:    null,
      alerts:          [],
      areaAlerts:      [],
      selectedAlertId: null,
      onboardingStep:  0,
      currentScreen:   'auth-welcome',
    });
  };

  // ================================================================
  // IDs de alertas propias activas — para distinguirlas en el mapa
  // ================================================================
  const ownActiveAlertIds = appState.alerts
    .filter(a => a.status === 'open' || a.status === 'ack')
    .map(a => a.id);

  // ================================================================
  // RENDERIZADO
  // ================================================================
  const renderCurrentScreen = () => {
    switch (appState.currentScreen) {

      case 'welcome':
        return <WelcomeScreen onNext={() => navigateToScreen('onboarding')} />;

      case 'onboarding':
        return (
          <OnboardingScreen
            step={appState.onboardingStep}
            onSkip={() => navigateToScreen('auth-welcome')}
            onNext={() => {
              if (appState.onboardingStep < 2) {
                updateAppState({ onboardingStep: appState.onboardingStep + 1 });
              } else {
                navigateToScreen('auth-welcome');
              }
            }}
            onBack={() => {
              if (appState.onboardingStep > 0) {
                updateAppState({ onboardingStep: appState.onboardingStep - 1 });
              } else {
                navigateToScreen('welcome');
              }
            }}
          />
        );

      case 'auth-welcome':
        return (
          <AuthWelcomeScreen
            onNavigateToLogin={() => navigateToScreen('login')}
            onNavigateToRegister={() => navigateToScreen('register')}
            onNavigateToCollaboratorLogin={() => navigateToScreen('operator-login')}
          />
        );

      case 'login':
        return (
          <LoginScreen
            onBack={() => navigateToScreen('auth-welcome')}
            onLogin={handleLogin}
            onNavigateToRegister={() => navigateToScreen('register')}
            onNavigateToForgotPassword={() => navigateToScreen('forgot-password')}
            onNavigateToCollaboratorPanel={() => navigateToScreen('operator-login')}
          />
        );

      case 'register':
        return (
          <RegisterScreen
            onBack={() => navigateToScreen('auth-welcome')}
            onRegister={handleRegister}
            onNavigateToLogin={() => navigateToScreen('login')}
            onNavigateToEmailVerification={(email: string, name: string) => {
              updateAppState({ pendingVerification: { email, name } });
              navigateToScreen('email-verification');
            }}
          />
        );

      case 'email-verification':
        if (!appState.pendingVerification) {
          navigateToScreen('register');
          return null;
        }
        return (
          <EmailVerificationScreen
            email={appState.pendingVerification.email}
            onBack={() => navigateToScreen('register')}
            onVerify={async (session) => {
              const emailParaRegistro = appState.pendingVerification?.email ?? '';
              const result = await completeRegistration(emailParaRegistro);
              if (result.success) {
                if (session?.user) {
                  const meta = session.user.user_metadata;
                  handleRegister(meta.name || '', session.user.email || '', '');
                } else {
                  handleRegister(
                    appState.pendingVerification!.name ?? '',
                    appState.pendingVerification!.email,
                    ''
                  );
                }
              } else {
                toast.error('Error al completar el registro', {
                  description: result.error || 'Por favor intenta nuevamente',
                });
              }
            }}
            title="Verificación de correo"
            subtitle="Ingresa el código de 8 dígitos enviado a tu correo"
            isAdminLogin={false}
            verificationType="signup"
          />
        );

      case 'forgot-password':
        return (
          <ForgotPasswordScreen
            onBack={() => navigateToScreen('login')}
            onCodeSent={handleSendPasswordResetCode}
          />
        );

      case 'otp-verification':
        return (
          <OTPVerificationScreen
            email={appState.auth.resetEmail}
            verificationType="password-reset"
            onBack={() => navigateToScreen('forgot-password')}
            onVerified={() => navigateToScreen('reset-password')}
            onResendCode={async () => {
              const result = await sendPasswordResetOTP(appState.auth.resetEmail);
              if (result.success) {
                toast.success('Código reenviado', { description: 'Revisa tu correo' });
              } else {
                toast.error('Error', { description: result.error || 'No se pudo reenviar' });
              }
            }}
          />
        );

      case 'reset-password':
        return (
          <ResetPasswordScreen
            email={appState.auth.resetEmail}
            onBack={() => navigateToScreen('otp-verification')}
            onSuccess={() => {
              toast.success('Contraseña actualizada', {
                description: 'Ahora puedes iniciar sesión',
              });
              navigateToScreen('login');
            }}
          />
        );

      case 'data-consent':
        return (
          <DataConsentScreen
            userName={appState.user.name}
            onAccept={handleDataConsentAccept}
          />
        );

      case 'location-permission':
        return (
          <LocationPermissionScreen
            onLocationGranted={(coords) => {
              console.log('📍 Ubicación real guardada:', coords);
              updateAppState({
                userLocation: coords,
                user: {
                  ...appState.user,
                  hasLocationPermission:  true,
                  hasCompletedOnboarding: true,
                },
              });
              navigateToScreen('main-map');
            }}
            onLocationDenied={(fallbackCoords) => {
              updateAppState({
                userLocation: fallbackCoords ?? null,
                user: {
                  ...appState.user,
                  hasLocationPermission:  false,
                  hasCompletedOnboarding: true,
                },
              });
              navigateToScreen('main-map');
            }}
          />
        );

      case 'main-map':
        return (
          <MainMapScreen
            alerts={appState.alerts}
            areaAlerts={appState.areaAlerts}
            ownActiveAlertIds={ownActiveAlertIds}
            userLocation={appState.userLocation}
            onCreateAlert={createAlert}
            onNavigateToHistory={() => navigateToScreen('alert-history')}
            onNavigateToProfile={() => navigateToScreen('profile')}
            onNavigateToTutorial={() => navigateToScreen('tutorial')}
          />
        );

      case 'alert-history':
        return (
          <AlertHistoryScreen
            alerts={appState.alerts}
            onBack={() => navigateToScreen('main-map')}
            onSelectAlert={handleSelectAlert}
          />
        );

      case 'alert-detail': {
        const selectedId    = appState.selectedAlertId;
        const localAlertObj = selectedId
          ? appState.alerts.find(a => a.id === selectedId) ?? null
          : null;

        if (!selectedId) {
          navigateToScreen('alert-history');
          return null;
        }

        return (
          <AlertDetailScreen
            alertId={selectedId}
            localAlert={localAlertObj}
            onBack={() => navigateToScreen('alert-history')}
            onCancelAlert={handleCancelAlert}
          />
        );
      }

      case 'alert-confirmation':
        return (
          <AlertConfirmationScreen
            alert={appState.lastCreatedAlert!}
            onBackToMap={() => navigateToScreen('main-map')}
            onViewHistory={() => navigateToScreen('alert-history')}
          />
        );

      case 'profile':
        return (
          <ProfileScreen
            user={appState.user}
            onBack={() => navigateToScreen('main-map')}
            onUpdateUser={(userData) => {
              updateAppState({ user: { ...appState.user, ...userData } });
            }}
            onNavigateToEmergencyContact={() => navigateToScreen('emergency-contact')}
            onNavigateToAbout={() => navigateToScreen('about-app')}
            onNavigateToPrivacy={() => navigateToScreen('privacy-policy')}
            onLogout={handleLogout}
          />
        );

      case 'tutorial':
        return <TutorialScreen onComplete={() => navigateToScreen('main-map')} />;

      case 'emergency-contact':
        return <EmergencyContactScreen onBack={() => navigateToScreen('profile')} />;

      case 'about-app':
        return <AboutAppScreen onBack={() => navigateToScreen('profile')} />;

      case 'privacy-policy':
        return <PrivacyPolicyScreen onBack={() => navigateToScreen('profile')} />;

      case 'operator-login':
        return (
          <CollaboratorLoginScreen
            onBack={() => navigateToScreen('auth-welcome')}
            onLoginSuccess={(role: string) => {
              if (role === 'admin') {
                navigateToScreen('admin-panel');
              } else if (role === 'operator' || role === 'auditor') {
                navigateToScreen('operator-dashboard');
              } else {
                navigateToScreen('auth-welcome');
              }
            }}
          />
        );

      case 'operator-dashboard':
        return (
          <OperatorDashboard
            onNavigateToSettings={() => navigateToScreen('operator-settings')}
            onLogout={handleLogout}
            accessToken={localStorage.getItem('admin_access_token') || undefined}
          />
        );

      case 'operator-settings':
        return (
          <OperatorSettingsScreen
            onBack={() => navigateToScreen('operator-dashboard')}
            onSave={() => navigateToScreen('operator-dashboard')}
          />
        );

      case 'admin-panel':
        return (
          <AdminPanel
            onLogout={handleLogout}
          />
        );

      default:
        return <WelcomeScreen onNext={() => navigateToScreen('onboarding')} />;
    }
  };

  if (restoringSession) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white gap-3">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-gray-100">
      <ConnectionBanner />
      {renderCurrentScreen()}
      <Toaster />
    </div>
  );
}
