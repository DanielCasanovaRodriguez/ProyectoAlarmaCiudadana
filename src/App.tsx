import React, { useState, useEffect } from 'react';
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
import { toast } from 'sonner';
import {
  getUserAlertHistory,
  getActiveAlerts,
  createAlert as createAlertDB,
  updateAlertMediaUrls,
  cancelAlert as cancelAlertDB,
} from './services/alertService.ts';
import { completeRegistration, sendPasswordResetOTP } from './services/authService.ts';
import { uploadMultipleFiles } from './services/mediaService';
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

    if (!appState.userLocation) {
      toast.error('Ubicación no disponible', {
        description: 'Activa la ubicación de tu dispositivo para enviar una alerta.',
      });
      return;
    }

    const location = appState.userLocation;
    const tempId   = `local_${Date.now()}`;

    const alertaLocal: Alert = {
      id:          tempId,
      type,
      location,
      timestamp:   new Date(),
      description: description || undefined,
      mediaUrls:   [],
      status:      'open',
    };

    // Navegar a confirmación inmediatamente (UX fluida)
    setAppState(prev => ({
      ...prev,
      alerts:           [alertaLocal, ...prev.alerts],
      areaAlerts:       [alertaLocal, ...prev.areaAlerts],
      lastCreatedAlert: alertaLocal,
      currentScreen:    'alert-confirmation',
    }));

    try {
      const alertaCreada = await createAlertDB({
        type_code:   type,
        lat:         location.lat,
        lng:         location.lng,
        description: description || undefined,
        media_urls:  [],
      });

      console.log('✅ Alerta creada en BD:', alertaCreada.id);

      let mediaUrls: string[] = [];

      if (files.length > 0) {
        toast.info('Subiendo evidencia...', {
          description: `${files.length} archivo${files.length > 1 ? 's' : ''}`,
        });

        const uploadResult = await uploadMultipleFiles(files, alertaCreada.id);

        if (uploadResult.urls.length > 0) {
          mediaUrls = uploadResult.urls;
          await updateAlertMediaUrls(alertaCreada.id, mediaUrls);
          console.log('✅ media_urls actualizados:', mediaUrls);
          toast.success('Evidencia guardada', {
            description: `${mediaUrls.length} archivo${mediaUrls.length > 1 ? 's' : ''} adjunto${mediaUrls.length > 1 ? 's' : ''}`,
          });
        }

        if (uploadResult.errors.length > 0) {
          toast.warning('Algunos archivos no se pudieron subir', {
            description: uploadResult.errors.join(', '),
          });
        }
      }

      const alertaFinal: Alert = {
        id:          alertaCreada.id,
        type,
        location,
        timestamp:   new Date(alertaCreada.created_at),
        description: description || undefined,
        mediaUrls,
        status:      'open',
      };

      // Reemplazar el ID temporal en ambas listas
      setAppState(prev => ({
        ...prev,
        lastCreatedAlert: alertaFinal,
        alerts:     prev.alerts.map(a => a.id === tempId ? alertaFinal : a),
        areaAlerts: prev.areaAlerts.map(a => a.id === tempId ? alertaFinal : a),
      }));

    } catch (error: any) {
      console.error('❌ Error creando alerta:', error);
      toast.error('Alerta mostrada localmente, pero falló al guardar en la base de datos', {
        description: error.message,
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

  const handleLogin = (email: string, password: string, userName: string) => {
    updateAppState({
      user: { ...appState.user, name: userName },
      auth: { ...appState.auth, isLoggedIn: true, email, password },
    });
    navigateToScreen('location-permission');
  };

  const handleRegister = (name: string, email: string, password: string) => {
    updateAppState({
      user: { ...appState.user, name },
      auth: { ...appState.auth, email, password },
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

  const handleLogout = () => {
    updateAppState({
      auth:            { isLoggedIn: false, email: '', password: '', resetEmail: '' },
      user:            { name: '', hasLocationPermission: false, hasCompletedOnboarding: false },
      userLocation:    null,
      alerts:          [],
      areaAlerts:      [],
      selectedAlertId: null,
      onboardingStep:  0,
    });
    navigateToScreen('welcome');
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
            onNavigateToCollaboratorPanel={(role: string) => {
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
            onLogout={() => {
              localStorage.removeItem('admin_user');
              localStorage.removeItem('admin_profile');
              localStorage.removeItem('admin_access_token');
              navigateToScreen('welcome');
            }}
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
            onLogout={() => {
              localStorage.removeItem('admin_user');
              localStorage.removeItem('admin_profile');
              localStorage.removeItem('admin_token');
              localStorage.removeItem('admin_access_token');
              navigateToScreen('welcome');
            }}
          />
        );

      default:
        return <WelcomeScreen onNext={() => navigateToScreen('onboarding')} />;
    }
  };

  return (
    <div className="h-screen w-full bg-gray-100">
      {renderCurrentScreen()}
      <Toaster />
    </div>
  );
}
