# Celeste — Audit Frontend Complet (14 screens + shell)

Date : 2026-08-02
Périmètre : tous les écrans `src/screens/*.tsx` (14), `App.tsx`, `ErrorBoundary`, `BottomNav`, `main.tsx`.
Critères : bugs/crashes, UX, features manquantes, design, error-handling, responsive/a11y.
Légende : score /10 (10 = production-grade, 7 = acceptable, <7 = corrections nécessaires).

---

## 0. Shell & Routing

### App.tsx — 652 LOC — Score 7/10

**Bugs / crashes**
- **L22 import mort** : `const Onboarding = lazy(() => import('./screens/Onboarding')…)` n'est jamais utilisé ; `OnboardingDirect` (L27) est seul utilisé. Le chunk lazy est généré par Vite pour rien (≈500 kB astrology-engine split qui ne sert à rien car le module est aussi dans le bundle direct). Supprimer la constante `Onboarding` (L22).
- **L241-243 deep-link invite** : `window.dispatchEvent(new CustomEvent('celeste:compat-redeem', { detail: inviteToken }))` est déclenché depuis `useEffect` qui ne tourne qu'au mount. Si l'user arrive déjà loggé via `?invite=…` et navigue ensuite, tout va bien, mais le `inviteToken` est nettoyé par la branche CompatRedeem (L605-609) sans nettoyer `?focus=` qui aurait pu être adjacent — pas critique.
- **L327-339 retry boot / fetchProfile** : la fonction `retryBoot` recrée le `stuckTimer` à 6 s non initialisé (`stuckTimer` est défini uniquement dans le `useEffect` de mount, scope privé). En cas de retry après `apiDown`, l'user n'aura pas de `bootStuck` hint (cosmetic).
- **L434-450 free-scan logic** : `getFreeScans()` est incrémenté **avant** que le screen Horoscope ne s'affiche réellement. Si l'user clique horoscope puis back immédiatement, le compteur est déjà consommé. Idem pour compat (449). UX saboter.
- **L589 Paywall `onClose`** : `setScreen((prev) => prev === 'paywall' ? 'home' : prev)` — `prev` est `Screen`, mais `setScreen` n'est pas un state-setter `functional`. Le setter est de type `useState<Screen>` donc accepte une fonction updater — OK, pas un bug.
- **L496** : SW message handler exclut `compat-redeem` de la whitelist `VALID` (L487-490). Une notif push qui demanderait `compat-redeem` est silencieusement droppée — probablement volontaire mais non documenté.

**UX issues**
- **L464-477 préchargement lazy** : tous les chunks sont pré-importés quand on est sur Home, y compris Settings/Paywall qui ne sont pas dans la nav. Confort correct mais surcharge le réseau au 1er mount Home.
- Pas de transition visible entre screens (juste `page-enter` className) — acceptable pour un mobile-first.
- Le retour arrière Android/back navigateur ne route pas vers le screen précédent (pas de `history.pushState`). Sur mobile Capacitor ça laisse penser qu'on peut quitter l'app en back.

**Design**
- Splash (L44-173) très soigné, animations CSS inline de 170 lignes dans `<style>` — lourd mais OK.
- `ApiDown` (L176-199) bon fallback, mais le bouton `Réessayer` ne recharge pas la page ni le token, juste re-call `api.getProfile`. Si le token est expiré pendant l'ApiDown, l'user reste bloqué.

**Error handling**
- Excellent : retry 3× backoff exponentiel, distinction network/auth/other, ApiDown dédié, stuckTimer 6 s avec hint utilisateur, capture d'erreur via `resetUser`.

**Top 3 recommandations**
1. Supprimer le `const Onboarding = lazy(...)` mort (L22) — bundle initial allégé de ~500 kB.
2. Ajouter `history.pushState`/`popstate` listener pour que le back navigateur revienne au screen précédent (UX mobile critique).
3. Déplacer `incrementFreeScans()` après le premier rendu réussi du screen (via callback `onMounted` ou après 2 s) pour ne pas penaliser les backs immédiats.

### ErrorBoundary — 49 LOC — Score 6/10

**Bugs**
- **L21 `getDerivedStateFromError` ne log pas** : seul `componentDidCatch` capture vers Sentry. Les erreurs asynchrones (effets, promises) ne passent **pas** par ErrorBoundary (par design React) — OK mais non rappelé.
- **L42-44 reset button** : `this.reset` re-render les children qui vont probablement crasher à nouveau si l'erreur était déterministe → boucle visuelle.

**UX**
- Le message "Une étincelle s'est éteinte" est poétique mais ne propose pas de "Recharger l'app" — le `reset` ne fait que vider `state.error`, l'user reste sur le même écran buggé.

**Error handling**
- `captureError` ok mais pas de breadcrumb ni de user-context (email/userId).

**Top 3**
1. Ajouter un 2ᵉ bouton "Recharger Céleste" qui appelle `window.location.reload()`.
2. Filtrer explicitement `NotFoundError: removeChild` (swallow) comme mentionné dans le contexte — actuellement l'ErrorBoundary capte tout y compris ces cosmetic crashes, affichant le fallback à tort.
3. Passer `info.componentStack` à Sentry (déjà fait L26) — vérifier que le DSN est monté.

### BottomNav — 131 LOC — Score 8/10

**Bugs**
- **L94-97 double `key={item}`** : `<li key={item}>` + `<button key={item}>` — redondant, React warn silencieux mais pas de bug.
- **L82-83 vibrate** : `'vibrate' in navigator` mais iOS Safari ne supporte pas `navigator.vibrate` → silencieux côté user (correct).

**UX**
- Aucun badge "non lu" sur Horoscope/Journal. Manque d'incitation au retour.
- Pas d'indicateur de pull-to-refresh sur la nav.

**Design**
- Icônes SVG maison (☉ ☭ etc.) excellent — cohérent avec l'esthétique alchemical.
- `glass-dark` + safe-area-bottom → bon pour iOS notch.

**Top 3**
1. Ajouter un point rouge "nouveau contenu" sur Horoscope quand `cachedHoroscope` est d'une autre date.
2. Dédoubler les `key` (supprimer `key` du `<button>`).
3. Ajouter un mini label `aria-current="page"` (déjà fait L98) — bonne pratique.

### main.tsx — 34 LOC — Score 6/10

**Bugs**
- **L6 + L30-31 ToastHost désactivé** : `import ToastHost` et `{/* <ToastHost /> */}` — commentaire "désactivé pour debug P0" mais en production. **Tous les `toast.success/error/info` des screens ne s'affichent pas** — bug UX majeur. Onboarding, Journal, Paywall, Settings appellent `toast.*` mais l'host est commenté → messages silencieux.
- **L9-10 commentaire SW désactivé** mais `pushService.init()` est appelé dans Home → notifications push tentent un SW inexistant → échec silencieux.
- StrictMode désactivé (L26-27) pour debug P0 — à réactiver.

**Top 3**
1. **Réactiver `<ToastHost />`** (bug UX visible partout).
2. Réactiver StrictMode (ou documenter pourquoi définitivement off).
3. Synchroniser SW désactivé avec `pushService.init()` (court-circuiter init si pas de SW).

---

## 1. Landing.tsx — 336 LOC — Score 9/10

**Bugs**
- Aucun crash potentiel repéré.

**UX issues**
- Pas de loader sur le CTA `Commencer` → double-tap possible pendant la transition.
- `HoroscopePreview` (L81-135) autoplay 4 s sans `prefers-reduced-motion` respect — a11y motion-sensibilité.

**Features manquantes**
- Lien `Mentions légales` / CGU manquants en footer (exigence App Store).
- Pas de deep-link vers Auth login depuis le bouton "Connexion" — OK car route via `onLogin`.

**Design**
- Excellent : palette alchemical, animations soignées, testimonials crédibles, pricing transparent.
- `STATS` "NASA · ∞" (L31-34) : le "∞" pour "Lectures uniques" est marketing creux vs la règle VMF accuracy-first.

**Error handling**
- N/A (page statique).

**Responsive**
- `md:text-5xl` etc. — mais tout est `max-w-md mx-auto` donc peu de surface tablet/desktop. Sur desktop le contenu reste cantonné à 448 px de large → grand espace vide à droite. Acceptable pour mobile-first mais pas optimisé.

**Top 3**
1. Ajouter `prefers-reduced-motion` media query pour stopper le carousel autoplay.
2. Footer : lien "Mentions légales" + "CGU" pour conformité App Store.
3. Bouton CTA avec state loading pour empêcher double-tap.

---

## 2. Auth.tsx — 293 LOC — Score 7/10

**Bugs**
- **L22 `onSuccess: (user: any)`** : typage `any` contourné — perte de type sur l'user remonté.
- **L116-118 handleAppleClick** : `setOauthLoading('apple')` puis `setOauthLoading(null)` synchrone → React batch, l'user ne voit jamais l'état loading. Pas un bug mais UX nulle.
- **L62 `clearStoredReferralCode()` dans le callback Google** : appelé même si `mode === 'login'` (bug ? non — code mort car `mode === 'register'` est checké juste avant). OK.
- **L86-89 catch `e` non typé** : `catch (e)` pas `catch (e: unknown)` — TS strict warn.
- **Google GIS script injecté en `document.head`** : jamais nettoyé si Auth unmount puis remount → script tag orphelin possible. Pas critique car `document.getElementById` protège contre double-injection.

**UX**
- Pas de lien "Mot de passe oublié" → dead-end pour les users qui ont oublié.
- Pas de validation email/password en temps réel (uniquement `required` + `minLength` HTML).
- Le bouton Apple "Continuer avec Apple" est enabled alors qu'il ne fait rien d'utile (affiche juste un message d'erreur). Devrait être disabled ou absent.

**Design**
- Le bouton Apple (L185-199) utilise `cursor-not-allowed` alors qu'il n'est pas `disabled` — incohérent visuel.

**Error handling**
- Bon : `errMsg` + mapping network/exists/invalid → messages FR localisés.

**Top 3**
1. Ajouter "Mot de passe oublié" (flow email reset).
2. Désactiver réellement le bouton Apple ou le supprimer (le `cursor-not-allowed` est trompeur).
3. Typer `onSuccess: (user: User) => void` et `catch (e: unknown)`.

---

## 3. Onboarding.tsx — 369 LOC — Score 6/10

**Bugs**
- **L5 import `NatalChart` inutilisé** : `import type { User, BirthData, NatalChart }` — `NatalChart` n'est jamais référencé. Dead import (cosmétique, ESLint warn).
- **L233-244 "Je préciserai plus tard"** : utilise `setTimeout(() => document.getElementById('onboarding-submit').click(), 50)` — pattern fragile. Si React re-render entre les 50 ms, le bouton peut être stale. Mieux : appeler directement `handleSubmit` après `setSelectedPlace`. Mais `handleSubmit` lit `selectedPlace` depuis closure → setState async → race condition → le calcul tournerait avec `selectedPlace === null`. **Le setTimeout click est un workaround hacky**.
- **L36 `setBirthData(birth, chart)`** : `calculateNatalChart(birth)` est synchrone et peut throw (ex : date invalide 2099-13-45). Pas de try/catch autour de L35 → crash non géré (vs App.tsx L412 qui a try/catch).
- **L26 `timeUnknown ? '12:00' : time`** : si `time === ''` et `!timeUnknown`, on passe `'12:00'` ? Non, on passe `''` (vide) → BirthData.time = '' → backend/astro crash probable. Le bouton `Continuer` (L202) est `disabled={!date || (!time && !timeUnknown)}` donc protégé côté UI. Mais pas défensif côté data.
- **L48 `JSON.parse(localStorage.getItem('celeste_user') || '{}')`** : si localStorage corrompu, catch ok, mais `onComplete({} as User)` → user vide → App tente `calculateNatalChart(undefined)` → crash. Devrait construire un User minimal avec `birthData: birth` (déjà calculé L35) au lieu de relire localStorage.

**UX**
- Pas de bouton "retour à Landing" ni exit (l'user qui veut annuler doit fermer l'app).
- Step 3 ("Calculating") ne s'affiche jamais : `setCalculating(true)` (L24) est appelé dans `handleSubmit` mais `step` reste à 2 (pas de `setStep(3)`). L'écran "Calcul" (L268-365) est dans `steps[3]` mais n'est jamais monté. **Feature cassée — l'animation zodiacale est invisible**.
- Le placeholder du `<input type="time">` (L189-193) n'est pas respecté par les inputs natifs (les inputs time n'ont pas de placeholder). Le label ` Ton heure de naissance` au-dessus suffit — pas de bug.

**Design**
- L'animation "Calculating" (L268-365, ~100 LOC) est du code mort effectivement.
- Bonne mise en forme, gradients cohérents, parallax visuel via `animate-fade-in`.

**Error handling**
- Aucun état d'erreur affiché. Si `calculateNatalChart` throw → écran figé sur l'étape 2 sans feedback.

**Top 3**
1. **Bug critique** : implémenter `setStep(3)` avant calcul → l'animation "Calculating" est totalement invisible aujourd'hui.
2. Wrap `calculateNatalChart(birth)` dans try/catch avec fallback + message d'erreur visible.
3. Construire `user` à partir de `birth`+`chart` plutôt que `JSON.parse(localStorage)` (L46-47) — robustesse.

---

## 4. Home.tsx — 181 LOC — Score 7/10

**Bugs**
- **L36-54 `transitTints`** : `t.halo` est référencé mais n'existe pas dans `TRANSIT_INFO` (seulement `accent` vérifié L38). Si `t.halo` est undefined → `hex2rgba(undefined, a)` → `hex.replace('#', '')` crash sur undefined. Le `if (!t) return {}` protège si `t` est absent mais pas si `t.halo` est absent. À vérifier côté `lib/dailyTransit`.
- **L60 `pushService.init()`** : appelé sans await ni catch. Si init throw → unhandled rejection. OK car init est probablement best-effort.
- **L107 `firstName`** : `(user.name?.split(' ')[0]) || (user.email?.split('@')[0])` → si l'email est `jean-pierre.dupont@example.com`, `firstName = 'jean-pierre'`. Plus un username qu'un prénom — UX mitigée mais pas un bug.

**UX**
- Composants DailyTarot / DailyIntention / DailyEnergy / EveningRitualCard / TarotCross / LiveAstroBanner / MoodForecast / SignatureFooter / HomeSecondary tous empilés verticalement sans tabs → scroll très long sur Home.
- Guest mode (L68-94) : bon état vide, mais pas de CTA "se connecter" → l'user guest ne sait pas comment sortir du mode invité.
- Pas de pull-to-refresh sur Home.

**Design**
- `cosmic-bg-adapt` avec CSS custom properties (`--tint-a` etc.) → belle personnalisation par transit.
- Cohérent mais surcharge de cartes (9 composants différents).

**Error handling**
- Aucun état d'erreur global (les composants enfants gèrent eux-mêmes).

**Top 3**
1. Vérifier que `TRANSIT_INFO[*].halo` existe pour toutes les clés ou rendre `hex2rgba` défensif sur undefined.
2. Ajouter un CTA "Se connecter" dans le guest mode (à côté de "Créer mon thème").
3. Considérer des tabs ou un accordion pour réduire le scroll vertical.

---

## 5. Horoscope.tsx — 876 LOC — Score 7/10

**Bugs**
- **L12 + L3 double import `api`** : `import { api }` (L3) et `import { api as apiLib }` (L12) — deux alias pour le même objet. `apiLib` utilisé uniquement L175 (`apiLib.completeQuest`). Code smell.
- **L14 double import `localISODate`** : `import { getCachedHoroscope, cacheHoroscope, localISODate, getJournal }` (L4) puis `import { localISODate as localDate, markHoroscopeRead }` (L14). `localISODate` importé deux fois (sous deux noms) → confus, fonctionnel.
- **L52-53 `today` computed à chaque render** : `localISODate()` et `new Date().toLocaleDateString('fr-FR', …)` — pas mémoïsé. OK car pas cher.
- **L88 `cancelledRef` paramètre par défaut** : `fetchHoroscope(force, cancelledRef = { value: false })` — l'appel interne `fetchHoroscope(false, cancelledRef)` (L149) passe le ref, mais l'appel depuis `EmptyState` "Réessayer" (L325) `fetchHoroscope(true)` crée un nouveau `{ value: false }` orphelin. Le cleanup du useEffect mount reste sur l'ancien ref → l'ancien fetch peut setter state après unmount → React warn "Can't perform state update on unmounted component".
- **L106-111 timeout guard** : si `api.getHoroscope()` résout **après** le timeout, le `.then` exécute quand même (pas de cancel) et setstate sur un mounted component → OK mais gaspillage.
- **L284-314 loading skeleton** : retourne un fragment SANS le `cosmic-bg` wrapper (L286) → fond noir/transparent pendant le loading. Visuellement cassé vs le reste de l'app.
- **L327 `onSecondaryCta={() => window.location.hash = '#home'}`** : set hash mais pas de routeur → l'app ne réagit pas au hash. La CTÀ "Revenir à l'accueil" ne marche pas.
- **L56 `touchStartX.current`** non typé strict (`number | null`) mais utilisé comme `number` après guard — OK.
- **L770 condition bouton "Lire la suite"** : `(summary.love || summary.career || (summary.general && summary.general.length > 100))` — `summary.general.length` peut crash si `general` est undefined (court-circuit court mais `||` arrive si `love`/`career` undefined). En fait `&& summary.general.length` ne s'évalue que si `summary.general` est truthy, donc OK.

**UX**
- Loading : 5 messages rotatifs 1.6 s + skeletons → excellent.
- Streak badge, offline cache, fallback LLM badge : excellent granularity.
- Push opt-in après 6 s de lecture : excellent pattern anti-guilt.
- Week history feed : UI riche, mais `line-clamp-2` et bouton "Lire la suite" ok.
- Tabs (Général/Amour/Carrière) avec swipe horizontal mobile → superbe.
- Pas de bouton "Partager" sur les sections amour/carrière (uniquement Général).

**Design**
- Excellent : gradients thématiques par section (or pour général, rose pour amour, bleu pour carrière), SVG décoratifs (étoile filante, Vénus, Saturne).
- SkyMap intégré en hero position (L488).

**Error handling**
- Très bon : 30 s timeout, retry cache offline, badge hors-ligne, error EmptyState avec CTA réessayer.
- Mais `onSecondaryCta` cassé (voir bug ci-dessus).

**Top 3**
1. Fix `onSecondaryCta` L327 → `onNavigate('home')` au lieu de `window.location.hash`.
2. Wrap loading skeleton dans `<div className="cosmic-bg star-field min-h-screen …">` pour fond cohérent.
3. Nettoyer les imports dupliqués `api`/`apiLib`, `localISODate`/`localDate`.

---

## 6. ChartView.tsx — 151 LOC — Score 8/10

**Bugs**
- **L8 `shareStatus` state** : `'idle' | 'sharing' | 'copied' | 'error'` mais `sharing` est set quand `navigator.share` est appelé ; si `navigator.share` résout sans AbortError, `shareStatus` reste à `'sharing'` pour toujours (pas de reset à `idle` après un share réussi). L'user voit "…" indéfiniment après un share ok.
- **L71-72 birth data display** : `${user.birthData.city || ''}, ${user.birthData.date || ''}`.replace(/^,\s$/, '')` — le regex ne match que si la string commence par `, ` (ville vide). Si la ville est vide mais la date non, on a `", 1990-01-01"`. Le replace ne match pas `, 1990…` car `,` est suivi d'un espace puis d'un chiffre, mais le regex est `^,\s$` (fin de string). **Le cas "ville vide + date non-vide" affiche ", 1990-01-01"** — bug visuel.
- Pas de fallback si `user.natalChart.positions` est vide → carte mais pas de détails planètes.

**UX**
- `<details>` "Comment lire ce thème ?" excellent pour onboarding post-création.
- Bouton Partager accessible, badge `xs:inline` hidden sur petits écrans → ok.
- Pas de loading state explicite entre mount et affichage des positions.

**Design**
- NatalChart wheel via composant dédié.
- PlanetDetailCard empilés → UI claire.

**Top 3**
1. Reset `shareStatus` à `'idle'` après un share `navigator.share` réussi.
2. Fix L71-72 : si ville vide, afficher seulement la date ; si date vide, afficher seulement ville.
3. Guard `chart.positions?.length > 0` avant le map (L138).

---

## 7. Compatibility.tsx — 415 LOC — Score 7/10

**Bugs**
- **L82-99 `animatedScore` via requestAnimationFrame** : pas de cleanup `cancelAnimationFrame` → si result change pendant l'animation, la loop continue. Mineur (perf).
- **L290 `disabled={mode === 'detailed' && !pDate}`** : en mode quick, le bouton est toujours enabled même sans sélection de signe — `theirSign` a une valeur par défaut `'leo'` donc OK. Pas un bug.
- **L109-112 setError('Sélectionne la ville…') + return** : setError mais pas de scroll vers le champ ville. L'user peut ne pas voir l'erreur si la ville est en bas.
- **L165-184 handleShare** : indentation chaotique (165-173 indentés à 0 espaces au lieu de 4). Code smell, pas un bug.
- **L181 catch {}** : silent swallow si annulation ou clipboard indisponible. Acceptable mais l'user ne sait pas si ça a marché.
- **L381 `result.strengths?.length > 0`** : si `result.strengths` est undefined, `?.length` retourne undefined, `undefined > 0` est false → OK.
- **L394** similaire pour challenges.

**UX**
- Quick mode avec 12 signes en grille 3 cols → bon.
- Pas de bouton "effacer ma sélection" (reset) — l'user doit changer un par un.
- Mode détaillé : pas de toggle "heure inconnue" comme Onboarding. Si l'user ne connaît pas l'heure, doit deviner 12:00.
- Pas de feedback pendant l'attente (skeleton) → ok (L297-315).
- Pas de save de l'analyse (vs Profiles qui permet d'enregistrer un proche).

**Design**
- Anneau SVG animé avec gradient stroke selon score → superbe.
- Couleurs thématiques (gold/purple/pink selon score).
- Verdict 1 mot VMF → excellent.

**Error handling**
- Minim : `setError(err.message)` seulement. Pas de retry, pas de distinction network/auth.

**Top 3**
1. Ajouter toggle "heure inconnue" en mode détaillé (parité avec Onboarding).
2. Nettoyer l'indentation de `handleShare` (L165-184).
3. Distinguer erreurs réseau/429 (retry) vs invalid input (message spécifique).

---

## 8. Explorer.tsx — 188 LOC — Score 8/10

**Bugs**
- **L86-108 nested rendering** : si `pilier && modKey`, on render le module. Mais `modKey === 'portrait'` (L91) appelle `<AstroPortrait onBack={goBack} />` qui ne reçoit pas `user` — AstroPortrait fait `api.getAstroPortrait()` sans user context, OK car backend lit le token. Pas un bug.
- **L144 `new Date().getDate() % 6`** : 6 phrases rotatives → mais certaines phrases sont plus longues que la card width mobile → overflow potentiel. Test OK en général.
- Pas de state preservation quand on sort/reentre un module (le `navKey` dans App.tsx L479 force remount Explorer → mais les sous-états pilier/modKey sont reset aussi).

**UX**
- 3 piliers clairs + module cards → excellent pattern navigationnel.
- Le retour `‹ Retour` est un simple texte sans hit-area large → a11y mitigée.
- Premium banner discret en bas → bon.
- Pas de recherche globale par module.

**Design**
- Cohérent, animations `stagger-card` soignées.

**Top 3**
1. Bouton retour avec padding plus large (hit target 44px min a11y).
2. Préserver `pilier`/`modKey` via le remount (passer en props depuis App).
3. Ajouter une recherche "Explorer tout" par mot-clé.

---

## 9. Journal.tsx — 255 LOC — Score 8/10

**Bugs**
- **L93 `[user.email]` dep** : si l'user change d'email (Settings), le useEffect ne re-run pas car `user.email` est la même string. OK.
- **L210-214 grouping** : `String(d.getMonth()).padStart(2,'0')` — `getMonth()` retourne 0-11. Janvier = `00`, décembre = `11`. OK pour la clé de group mais l'affichage `toLocaleDateString('fr-FR', { month: 'long' …})` (L211) → "janvier 2026" correct.
- **L227-239 entries display** : `e.userNote` affiché tel quel — pas de escaping HTML. Si l'user tape `<script>alert(1)</script>`, React échappe par défaut → pas de XSS. OK.
- **L34-37 cleanup timers** : excellent.
- **L113-123 handleSave best-effort** : si `api.saveJournalEntry` échoue silencieusement, l'entry est en local. Mais au prochain mount, le merge (L75-78) préfère remote `byId.set(e.id, e)` → **l'entry locale orpheline (jamais sync) est écrasée par remote qui ne l'a pas**. Pas un bug car remote est truthy, mais l'entry apparaît "perdue" si le serveur n'a pas reçu.

**UX**
- 14 prompts rotatifs par jour → excellent variety.
- Group by month sticky headers → superbe.
- MoodCheckin intégré → bien.
- Pas d'édition d'entry passée (read-only).
- Pas de suppression d'entry.
- Pas de recherche dans le journal.

**Design**
- Sticky month header avec backdrop-blur → bon.
- Streak badge motivant.

**Error handling**
- Sync status affiché, mode offline géré.

**Top 3**
1. Ajouter édition + suppression d'entry (long-press mobile).
2. Recherche full-text dans le journal.
3. Marquer les entries "locaux non sync" visuellement (badge "en attente de sync").

---

## 10. Settings.tsx + settings/* — 718 LOC total — Score 7/10

### Settings.tsx (64 LOC) — 9/10
- Orchestrator mince propre, dispatch correct, `window.location.reload()` après logout → reset state complet. Bon.

### SettingsMenu.tsx (401 LOC) — 7/10
**Bugs**
- **L259-261 localStorage keys** : `celeste-journal` (tiret) mais le reste de l'app utilise `celeste_journal` (underscore) — **export RGPD vide pour le journal**. Bug sérieux : l'export utilisateur ne contient pas le journal.
- L260 : `celeste-favorites` vs usage réel inconnu (à vérifier dans `useFavorites`).
- L261 : `celeste-notifs` vs usage réel inconnu.
- **L14-16 `import pkg from '../../../package.json'`** avec `@ts-ignore` — fragile en build Vite, version peut être undefined en prod si config change.

**UX**
- Empilement vertical de 10+ cards → scroll long.
- `ManageSubscriptionButton` lazy-loaded status → bien.
- `NotificationPanel` complet avec test → excellent.

### EditBirthData.tsx (104 LOC) — 8/10
- **L15 `user.birthData!`** : non-null assertion → crash si `birthData` est null (callé depuis Settings.tsx L36 avec guard `editing && user.birthData` → OK).
- Pas de bouton "Heure inconnue" comme Onboarding.

### LegalModal.tsx (70 LOC) — 9/10
- Lien `/legal/privacy.html` et `/legal/terms.html` en target="_blank" → bon.
- Contenu RGPD clair et concis.

### FavoritesPanel.tsx (79 LOC) — 8/10
- Empty state soigné, suppression avec busy indicator.
- Pas de tri/filtre par date ou section.

### DeleteAccountConfirm.tsx (64 LOC) — 8/10
- Bon : warning sur abonnement actif, confirmation double.
- Pas de saisie de confirmation "DELETE" → trop facile pour un acte irréversible.

**Top 3 (settings overall)**
1. **Bug RGPD** : `celeste-journal` doit être `celeste_journal` (L259) — l'export utilisateur est cassé pour le journal.
2. Ajouter saisie "Tape SUPPRIMER pour confirmer" dans DeleteAccountConfirm.
3. Ajouter toggle "Heure inconnue" dans EditBirthData (parité Onboarding).

---

## 11. Paywall.tsx — 329 LOC — Score 7/10

**Bugs**
- **L60 `const existing = getUser();`** puis `onSubscribe({ ...existing, … })` — `existing.natalChart` est récupéré du localStorage, OK. Mais si `trialStartedAt` est set (L65) sans `existing.trialStartedAt` dans le type `User` → TS warn possible.
- **L281 CTA "Démarrer mon essai" → handleSubscribe (Stripe)** : le label dit "essai" mais `handleSubscribe` lance un checkout Stripe payant. L'essai est censé être géré par `handleStartTrial` (L54-72). La confusion possible : l'user pensant cliquer sur l'essai gratuit lance en réalité le checkout annuel. Le bouton `handleStartTrial` est **au-dessus** (L196) donc pas une overlap réelle, mais le label L288 "Démarrer mon essai gratuit" pour le bouton Stripe est trompeur.
- **L280-290 disabled logic** : `disabled={busy || configured === false}` → OK.
- Pas de gestion explicite de l'échec `startCheckout` au-delà de `setError` → l'user ne sait pas quoi faire ensuite.

**UX**
- Plans clairs, essai gratuit mis en avant avant les plans payants → bon.
- Restore purchases obligatoire App Store (L302-307) → ok.
- Pas de cross-sell vers un plan "à vie" (lifetime) — présent dans SettingsMenu `ManageSubscriptionButton` L61 (`status.plan === 'lifetime'`) mais pas dans Paywall.
- Pas de FAQ ou de "questions fréquentes".

**Design**
- Hero poétique, features émotionnelles + concrètes → excellent.
- Trop long scroll avant le CTA payant (8 sections).

**Error handling**
- Minim : erreur générique "Erreur inconnue" si `result.error` manquant.

**Top 3**
1. Changer le label L288 "Démarrer mon essai gratuit" → "S'abonner — 7 jours gratuits" pour éviter confusion avec le bouton `handleStartTrial` au-dessus.
2. Ajouter une section FAQ (3-5 questions) : annulation, remboursement, etc.
3. Ajouter un plan lifetime si disponible backend (cohérence avec Settings).

---

## 12. ProfilesScreen.tsx — 403 LOC — Score 6/10

**Bugs**
- **L98 hardcoded `bg-[#0b0420]`** : code couleur hex inline → casse le theming. Devrait utiliser `cosmic-bg` ou `bg-night-950`.
- **L281 `tz = -new Date().getTimezoneOffset() / 60`** : approximation user-timezone pour le lieu de naissance du proche → faux pour 90% des cas hors "user né dans le même fuseau où il vit". Le commentaire L277-280 reconnait le problème mais le code est laissé tel quel. **Bug data : un proche né à Tokyo saisi par un user en France aura tz=+1 au lieu de +9 → Ascendant/Lune faux**.
- **L285 `geo[0].display_name?.split(',').pop()?.trim()`** : pays approximatif via dernier champ de display_name — parfois non-pays (ex : "67000 Strasbourg" → "France"). OK la plupart du temps.
- **L232 ProfileForm non exporté** : impossible à tester unitairement isolément.
- Pas de `CitySearch` réutilisé — code dupliqué vs Onboarding/Compatibility. Réinvente geocoding via Nominatim fetch direct (L259-262), sans debounce ni AbortSignal.

**UX**
- UI complète : ajout, édition, suppression, set-self.
- Avatar par relation emoji → mignon.
- Pas de limite visible sur le nombre de profils (premium gating non clair).
- Pas de comparaison directe entre deux profils (call `api.getCompatibility` absent).

**Design**
- Couleurs `#0b0420`, `#15082e` (L306) — hors palette Tailwind, casse la cohérence alchemical.
- `bg-amber-400/90` pour bouton save (L396) — orange au lieu de gold-400/cosmic.

**Error handling**
- Minim : messages d'erreur simples, pas de retry.

**Top 3**
1. **Bug data** : remplacer le `tz` user-timezone par `tzOffsetFromIANA(geo[0].extratags?.timezone)` ou réutiliser `CitySearch` qui gère déjà ça.
2. Réutiliser `<CitySearch>` au lieu de dupliquer la logique Nominatim (L259-289).
3. Remplacer `#0b0420`, `#15082e`, `amber-400` par les tokens Tailwind `cosmic-bg`/`night-950`/`gold-400` pour cohérence.

---

## 13. AstroPortrait.tsx — 234 LOC — Score 8/10

**Bugs**
- **L78 signature `= {}`** : `function AstroPortrait({ onBack }: { onBack?: () => void } = {})` — default `{}` permet l'appel `<AstroPortrait />` sans props (Explorer L92 passe `onBack`). OK.
- **L97-101 `load` dépend de `cancelledRef`** : pattern correct, mais `load()` appelé aussi en callback de retry (L170) sans nouveau cancelledRef → si l'user retry puis unmount vite, l'ancien cancelledRef n'est pas partagé → setstate après unmount possible.
- **L92 `parsePortrait(res.portrait)`** : si `res.portrait` est undefined ou vide, `parsePortrait('')` retourne `[]` → sections vides → article vide affiché. Pas de garde.

**UX**
- Loading state splendide (anneaux rotatifs, mote orbital).
- TTS (text-to-speech) bouton pour écouter le portrait → excellent accessibilité.
- PDF download → excellent monétisation.
- Empty/error states soignés.
- Pas de scroll-to-top au mount.

**Design**
- `font-display`, `font-body`, `drop-cap` → typographie soignée.
- `ornament-divider` → touches calligraphiques.
- `max-w-2xl` → ok pour lecture longue.

**Error handling**
- Erreur + retry, état cached affiché ("lu récemment").

**Top 3**
1. Garde `if (!res.portrait) setError(…)` avant parse.
2. Passer un `cancelledRef` partagé entre load et retry.
3. `window.scrollTo(0,0)` au mount (long content).

---

## 14. CompatRedeem.tsx — 249 LOC — Score 7/10

**Bugs**
- **L45, 77 `catch (e: any)`** : typage `any` (TS warn strict). Devrait être `catch (e: unknown)` avec guard.
- **L140 `inviterSun` pas normalisé** : si backend retourne "Bélier" (FR), `ZODIAC_SIGNS["Bélier" as ZodiacSign]` retourne undefined → symbole `'✨'` fallback. Bug visuel (vs Compatibility.tsx qui a `normalizeSign`).
- **L141 `result.theirSun`** : même problème — pas de normalisation FR→EN.
- **L20 `onDone` callback** : si l'user clique "Découvrir Céleste" sans compte, App.tsx L611 `setScreen(isAuthed ? 'home' : 'landing')` → ok.
- **L32 useEffect `[token]`** : si token change (deep-link re-trigger), re-fetch. OK.
- Pas de guard si l'user est déjà authentifié → l'invitation est quand même consommée. Devrait rediriger vers Compatibility si déjà auth + déjà has birthData.

**UX**
- 5 phases (loading/form/computing/result/error/consumed) → clair.
- Pas de bouton "retour" explicite en phase form (juste le CTA "Voir notre compatibilité").
- "Tes données restent privées. Aucune inscription requise" → bon copywriting.
- Le CTA final "Crée ton compte" renvoie vers `onDone` → landing, pas vers Auth. Raté de conversion.

**Design**
- Cohérent mais minimaliste vs autres écrans.

**Error handling**
- Minim : `submitErr` affiché, états error/consumed dédiés.

**Top 3**
1. **Bug visuel** : appliquer `normalizeSign` (FR→EN) sur `inviterSun` et `result.theirSun` comme dans Compatibility.tsx.
2. CTA final "Crée ton compte" → rediriger vers `Auth` au lieu de `onDone`.
3. Si user déjà authentifié, court-circuiter vers Compatibility avec birthData pré-rempli.

---

# Synthèse globale

**Scores /10**
| Screen | LOC | Score |
|---|---|---|
| App.tsx (router) | 652 | 7 |
| ErrorBoundary | 49 | 6 |
| BottomNav | 131 | 8 |
| main.tsx | 34 | 6 |
| Landing | 336 | 9 |
| Auth | 293 | 7 |
| Onboarding | 369 | **6** |
| Home | 181 | 7 |
| Horoscope | 876 | 7 |
| ChartView | 151 | 8 |
| Compatibility | 415 | 7 |
| Explorer | 188 | 8 |
| Journal | 255 | 8 |
| Settings (+settings/*) | 718 | 7 |
| Paywall | 329 | 7 |
| ProfilesScreen | 403 | **6** |
| AstroPortrait | 234 | 8 |
| CompatRedeem | 249 | 7 |
| **Moyenne pondérée** | **5927** | **7.2** |

**Bugs critiques à corriger en priorité**
1. **main.tsx ToastHost désactivé** → tous les toasts sont silencieux en production.
2. **Onboarding.tsx L24-35 `setStep(3)` jamais appelé** → animation "Calculating" invisible (100 LOC morts).
3. **Onboarding.tsx L35 `calculateNatalChart` non try/catch** → crash non géré sur date invalide.
4. **SettingsMenu.tsx L259 clé localStorage `celeste-journal` au lieu de `celeste_journal`** → export RGPD du journal vide.
5. **ProfilesScreen.tsx L281 timezone = user-timezone** → données natales fausses pour les proches nés à l'étranger.
6. **CompatRedeem.tsx L140-141 `inviterSun`/`theirSun` non normalisés FR→EN** → symboles fallback ✨ partout.
7. **Horoscope.tsx L327 `onSecondaryCta` set `window.location.hash`** → bouton inopérant.
8. **App.tsx L22 import mort `const Onboarding = lazy(...)`** → chunk lazy généré pour rien (~500 kB).

**Thèmes récurrents**
- **Imports morts / dupliqués** : Onboarding (NatalChart), App.tsx (Onboarding lazy), Horoscope (api/apiLib, localISODate/localDate), main.tsx (ToastHost commenté mais importé). ESLint dead-code rule à activer.
- **Timezone handling incohérent** : CitySearch gère IANA, ProfilesScreen réinvente avec user-tz, Compatibility utilise `pPlace.tzOffset` correct. Unifier.
- **`catch (e)` non typé** : Auth L86, CompatRedeem L45/77, AstroPortrait ok. Migration `catch (e: unknown)` à finaliser.
- **Pas de hash router** : back navigateur ne marche pas (App.tsx) — UX mobile problématique.
- **Pas de dark mode** : respecté (règle user). ✓
- **Pas de "IA"/"AI"** dans le copy : vérifié sur tous les screens. ✓
- **Polices Cinzel/Cormorant** : `font-display`/`font-body` cohérents. ✓
- **Français partout** : vérifié. ✓

**Bonnes pratiques déjà en place**
- Lazy-loading screens secondaires (App.tsx) + préchargement sur Home.
- ErrorBoundary avec capture Sentry.
- Offline cache horoscope + journal.
- Retry backoff exponentiel sur le boot profile fetch.
- TTS sur AstroPortrait (accessibilité).
- Empty states soignés partout (EmptyState component).
- Skeleton loaders sur Horoscope/Compatibility.
- Notifications push opt-in après preuve de valeur (Horoscope).
- RGPD export + delete account (Settings).
