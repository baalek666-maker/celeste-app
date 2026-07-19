/**
 * pushNotificationsNative.ts — stub pour Capacitor Push Notifications.
 *
 * État actuel : INACTIF (le projet Capacitor n'a pas encore :
 *   - de certificat APNs iOS configuré
 *   - de google-services.json / Firebase Admin
 *   - de @capacitor/push-notifications installé
 *
 * Voir `docs/push-native-setup.md` pour le guide d'implémentation complet.
 *
 * Cette fonction est appelée à l'init de l'app mais elle no-op si on est
 * en web (pas d'API PushNotifications globale) ou si la dépendance manque.
 * Quand tu auras les credentials, l'activation se fait en 4 étapes :
 *
 *   1. npm install @capacitor/push-notifications firebase-admin
 *   2. Créer ios/App/App.entitlements + android/app/google-services.json
 *   3. Décommenter le bloc ci-dessous
 *   4. npm install côté serveur : firebase-admin + service account JSON
 */

export const nativePush = {
  async init(): Promise<void> {
    // ─── Stub no-op ─────────────────────────────────────────────
    // Active ce bloc après avoir complété docs/push-native-setup.md
    // et installé @capacitor/push-notifications.

    /*
    import('@capacitor/push-notifications').then(async ({ PushNotifications }) => {
      try {
        const perm = await PushNotifications.requestPermissions();
        if (perm.receive === 'granted') {
          await PushNotifications.register();
        }
        PushNotifications.addListener('registration', async (token) => {
          try {
            await fetch('/api/push-tokens', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('celeste_token')}`,
              },
              body: JSON.stringify({ token: token.value, platform: Capacitor.getPlatform() }),
            });
          } catch (e) {
            console.warn('[push-native] token save failed:', e);
          }
        });
        PushNotifications.addListener('pushReceived', (notif) => {
          console.log('[push-native] received:', notif.title);
        });
        PushNotifications.addListener('pushActionPerformed', (action) => {
          console.log('[push-native] tapped:', action.notification.data);
        });
      } catch (e) {
        // Permission refusée ou plugin manquant — silencieux pour l'utilisateur
        console.info('[push-native] init skipped:', e);
      }
    }).catch(() => {
      // Module absent (web) — silent
    });
    */

    return; // No-op tant que non câblé
  },

  isAvailable(): boolean {
    // Devrait détecter si Capacitor + le plugin sont chargés
    return typeof window !== 'undefined' && 'Capacitor' in window;
  },
};
