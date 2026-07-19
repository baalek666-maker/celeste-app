# Push natives iOS/Android — Guide d'implémentation

**Statut** : non câblé (manque credentials externes).
**Effort estimé** : 2-3 jours de travail + $99/an Apple Developer.
**Impact rétention** : ★★★★★ (Co-Star doit ~80% de sa rétention D7 au push).

---

## Pourquoi c'est si gros ?

Capacitor transforme ton site web en app mobile, mais **ne fournit pas le push natives** par défaut. Il faut brancher deux systèmes parallèles :

| Plateforme | Service | Compte requis | Coût |
|---|---|---|---|
| **iOS** | Apple Push Notification service (APNs) | Apple Developer Program | $99/an |
| **Android** | Firebase Cloud Messaging (FCM) | Projet Firebase (gratuit) | $0 |

---

## Étape 1 — Crée les comptes (15 min + délai validation Apple)

### Apple Developer
1. Va sur https://developer.apple.com/account
2. Payer $99/an l'Apple Developer Program (ou renouveler si déjà actif)
3. **Délai** : parfois 24-48h pour validation

### Firebase
1. Va sur https://console.firebase.google.com
2. Crée un projet "Céleste"
3. Ajoute une app iOS (bundleId = `com.celeste.app`)
4. Ajoute une app Android (package = `com.celeste.app`)
5. Télécharge :
   - `GoogleService-Info.plist` → `ios/App/`
   - `google-services.json` → `android/app/`

---

## Étape 2 — Génère le certificat APNs (30 min)

Sur https://developer.apple.com/account → Certificates → **Apple Push Notification service SSL (Sandbox & Production)** :
1. Crée un certificat lié à `com.celeste.app`
2. Télécharge le `.cer`, convertis en `.p12` via `openssl` :
   ```bash
   openssl x509 -in aps.cer -inform DER -out aps.pem
   openssl pkcs12 -export -inkey aps_private.key -in aps.pem -out aps.p12
   ```
3. Upload le `.p12` dans Firebase Console → Project Settings → Cloud Messaging → APNs

---

## Étape 3 — Installe les dépendances Capacitor (15 min)

```bash
cd /home/ubuntu/celeste-app
npm install @capacitor/push-notifications @capacitor/local-notifications
npm install firebase-admin  # côté serveur uniquement
npx cap sync
```

---

## Étape 4 — Configure Android (`android/app/build.gradle`)

Vérifie que la ligne 48 (existante) charge `google-services.json` :
```gradle
def servicesJSON = file('google-services.json')
```
Si le fichier existe, le plugin Google Services s'auto-applique. **Aucune autre modification** côté Android — c'est déjà câblé.

---

## Étape 5 — Configure iOS (`ios/App/App.entitlements`)

Crée le fichier s'il n'existe pas :
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>aps-environment</key>
    <string>development</string>
</dict>
</plist>
```
Et référence-le dans `ios/App/App.xcodeproj/project.pbxproj` (Xcode le fait auto si tu glisses le fichier).

---

## Étape 6 — Hook JS frontend (`src/lib/pushNotificationsNative.ts`)

Nouveau fichier à créer :

```ts
import { PushNotifications } from '@capacitor/push-notifications';
import { api } from './api';

export const nativePush = {
  async init() {
    if (!('PushNotifications' in window)) return; // skip en web
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive === 'granted') {
      await PushNotifications.register();
    }
    PushNotifications.addListener('registration', async (token) => {
      await api.savePushToken(token.value); // POST /api/push-tokens
    });
    PushNotifications.addListener('pushReceived', (notif) => {
      // afficher toast in-app si besoin
      console.log('[push] received:', notif.title);
    });
  }
};
```

Et dans `src/main.tsx` ou `App.tsx`, ajouter :
```ts
import { nativePush } from './lib/pushNotificationsNative';
if (location.protocol !== 'https:' && !['localhost','127.0.0.1'].includes(location.hostname)) {
  nativePush.init(); // skip en dev, init en prod
}
```

---

## Étape 7 — Backend broadcast (`server/routes/push-native.js`)

Nouveau routeur à créer avec Firebase Admin SDK :

```bash
# Récupère la service account JSON depuis Firebase Console → Project Settings → Service Accounts
# Place-la dans server/firebase-service-account.json (gitignored)
# Ajoute server/firebase-service-account.json à .gitignore
```

```js
import admin from 'firebase-admin';
import serviceAccount from '../firebase-service-account.json' assert { type: 'json' };
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const messaging = admin.messaging();

// POST /api/push-tokens — frontend enregistre le token device
router.post('/push-token', auth, (req, res) => {
  const { token, platform } = req.body;
  db.prepare('INSERT OR REPLACE INTO device_push_tokens (user_id, token, platform, updated_at) VALUES (?, ?, ?, ?)')
    .run(req.user.id, token, platform, Math.floor(Date.now()/1000));
  res.json({ ok: true });
});

// Helper : broadcast vers user_id
export async function sendNativePush(userId, { title, body, tag }) {
  const tokens = db.prepare('SELECT token FROM device_push_tokens WHERE user_id = ?').all(userId);
  if (!tokens.length) return { sent: 0 };
  const result = await messaging.sendEachForMulticast({
    tokens: tokens.map(t => t.token),
    notification: { title, body },
    data: { tag: tag || '' },
  });
  return { sent: result.successCount, failed: result.failureCount };
}
```

---

## Étape 8 — Branche le cron existant

Dans `server/server.js`, ligne ~4260, le cron `runDailyPushJob` :
```js
// AVANT : webpush.sendNotification(...) (VAPID web only)
// APRÈS :
const { sendNativePush } = await import('./routes/push-native.js');
await sendNativePush(user.id, {
  title: '...',
  body: '...',
  tag: 'daily-push',
});
// Garder le webpush.sendNotification en fallback (web)
```

---

## Test end-to-end

1. Build + sync : `npm run build && npx cap sync`
2. Ouvrir le projet natif : `npx cap open ios` ou `npx cap open android`
3. Run sur device **physique** (push ne marche pas en simulateur iOS pour APNs)
4. Accepter la permission push au premier lancement
5. Vérifier dans la console JS que le token est envoyé au backend
6. Déclencher le cron `runDailyPushJob` manuellement (ou attendre 7h30)
7. Vérifier que la notif arrive sur l'écran verrouillé du téléphone

---

## Fallback web inchangé

`public/sw.js` continue de fonctionner sur navigateur desktop.
Les deux systèmes coexistent — un user avec navigateur web + Safari mobile reçoit :
- Push web via SW (background) sur desktop
- Push natives via Capacitor sur mobile (background, app fermée)

---

## Effort & coût résumés

| Item | Temps | Coût |
|---|---|---|
| Compte Apple Developer | 24-48h validation | $99/an |
| Projet Firebase | 30 min | Gratuit |
| Certificat APNs | 30 min | Inclus |
| Install deps Capacitor | 15 min | Gratuit |
| Hook JS frontend | 1h | Gratuit |
| Backend broadcast | 2h | Gratuit |
| Test device | 1h | (ton device) |
| **Total** | **2-3 jours wall time** | **$99/an** |
