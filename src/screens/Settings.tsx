import { useState, useEffect } from 'react';
import type { User, BirthData } from '../types';
import { logout, setBirthData } from '../lib/storage';
import { ZODIAC_SIGNS } from '../data/zodiac';
import { calculateNatalChart } from '../lib/astrology';
import { api } from '../lib/api';
import { useNotifications } from '../lib/useNotifications';
import { useFavorites } from '../lib/useFavorites';
import { ProfilesScreen } from './ProfilesScreen';
import PremiumBadge from '../components/PremiumBadge';
import { toast } from '../components/Toast';

// ─── P6: Manage Subscription (Stripe portal) ──────────────────────────────
// Shows a "manage subscription" button for premium users.
// Uses /api/premium/status to detect premium, /api/billing/portal to redirect.
function ManageSubscriptionButton() {
  const [status, setStatus] = useState<{ isPremium: boolean; plan: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getPremiumStatus().then(s => setStatus({ isPremium: s.isPremium, plan: s.plan })).catch(() => undefined);
  }, []);

  const handleManage = async () => {
    setLoading(true);
    try {
      const { url } = await api.openPortal();
      window.location.href = url;
    } catch (err: any) {
      toast.error(err.message || 'Impossible d\'ouvrir le portail de gestion');
      setLoading(false);
    }
  };

  // Only render for premium users
  if (!status || !status.isPremium) return null;

  return (
    <button
      onClick={handleManage}
      disabled={loading}
      className="w-full glass rounded-2xl p-4 flex items-center justify-between text-left hover:border-gold-500/30 border border-transparent transition-all disabled:opacity-50"
    >
      <div>
        <span className="text-gold-400 text-sm font-medium">💳 Gérer mon abonnement{status.plan === 'lifetime' ? ' (à vie)' : ''}</span>
        <p className="text-night-500 text-xs mt-0.5">Modifier, suspendre ou annuler</p>
      </div>
      <span className="text-gold-400">{loading ? '⏳' : '→'}</span>
    </button>
  );
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Vite resolves this to the package.json version at build time.
import pkg from '../../package.json';

// Top-12 villes FR + principales villes internationales (subset pour le mode édition).
// Même format que la liste Onboarding — dupliquer était l'option la plus sûre.
const EDIT_CITIES = [
  { city: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522, tz: 2 },
  { city: 'Lyon', country: 'France', lat: 45.7640, lng: 4.8357, tz: 2 },
  { city: 'Marseille', country: 'France', lat: 43.2965, lng: 5.3698, tz: 2 },
  { city: 'Toulouse', country: 'France', lat: 43.6047, lng: 1.4442, tz: 2 },
  { city: 'Bordeaux', country: 'France', lat: 44.8378, lng: -0.5792, tz: 2 },
  { city: 'Lille', country: 'France', lat: 50.6292, lng: 3.0573, tz: 2 },
  { city: 'Strasbourg', country: 'France', lat: 48.5734, lng: 7.7521, tz: 2 },
  { city: 'Nice', country: 'France', lat: 43.7102, lng: 7.2620, tz: 2 },
  { city: 'Nantes', country: 'France', lat: 47.2184, lng: -1.5536, tz: 2 },
  { city: 'Rennes', country: 'France', lat: 48.1173, lng: -1.6778, tz: 2 },
  { city: 'Bruxelles', country: 'Belgique', lat: 50.8503, lng: 4.3517, tz: 2 },
  { city: 'Genève', country: 'Suisse', lat: 46.2044, lng: 6.1432, tz: 2 },
  { city: 'Montréal', country: 'Canada', lat: 45.5017, lng: -73.5673, tz: -4 },
  { city: 'Fort-de-France', country: 'Martinique', lat: 14.6042, lng: -61.0667, tz: -4 },
];

function EditBirthData({ user, onUpdate, onCancel }: {
  user: User;
  onUpdate: (u: User) => void;
  onCancel: () => void;
}) {
  const initial = user.birthData!;
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [cityIdx, setCityIdx] = useState(
    EDIT_CITIES.findIndex(c => c.city === initial.city && c.country === initial.country)
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSave = async () => {
    setErr('');
    if (!date) return setErr('Date manquante.');
    if (!time) return setErr('Heure manquante.');
    if (cityIdx < 0) return setErr('Ville manquante.');
    const c = EDIT_CITIES[cityIdx];
    const birth: BirthData = {
      date, time, city: c.city, country: c.country,
      latitude: c.lat, longitude: c.lng, timezone: c.tz,
    };
    setSaving(true);
    try {
      // Recompute locally first (instant feedback)
      const newChart = calculateNatalChart(birth);
      // Persist locally
      setBirthData(birth, newChart);
      // Sync to backend (best-effort)
      try {
        await api.saveBirthData(birth);
        toast.success('Thème natal mis à jour ✨');
      } catch {
        toast.info('Sauvegardé localement — sync dès que possible');
      }
      onUpdate({ ...user, birthData: birth, natalChart: newChart });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'inconnue';
      setErr(`Erreur : ${msg}`);
      toast.error(`Recalcul impossible : ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-5 pt-12 pb-4">
      <button onClick={onCancel} className="text-night-400 text-sm mb-4">← Retour</button>
      <h1 className="text-xl font-bold mb-2 text-gold-gradient">Modifier mes données</h1>
      <p className="text-night-400 text-xs mb-6">
        Tout changement recalcule votre thème natal et met à jour vos horoscopes.
      </p>

      <label className="block text-night-300 text-xs uppercase tracking-widest mb-2">Date de naissance</label>
      <input
        type="date" value={date} onChange={e => setDate(e.target.value)}
        className="w-full py-3 px-4 rounded-xl glass border border-night-700 text-night-100 mb-4 focus:outline-none focus:border-cosmic-500"
      />

      <label className="block text-night-300 text-xs uppercase tracking-widest mb-2">Heure de naissance</label>
      <input
        type="time" value={time} onChange={e => setTime(e.target.value)}
        className="w-full py-3 px-4 rounded-xl glass border border-night-700 text-night-100 mb-6 focus:outline-none focus:border-cosmic-500"
      />

      <label className="block text-night-300 text-xs uppercase tracking-widest mb-2">Ville de naissance</label>
      <select
        value={cityIdx}
        onChange={e => setCityIdx(Number(e.target.value))}
        className="w-full py-3 px-4 rounded-xl glass border border-night-700 text-night-100 mb-6 focus:outline-none focus:border-cosmic-500"
      >
        {EDIT_CITIES.map((c, i) => (
          <option key={i} value={i} className="bg-night-800">
            {c.city} — {c.country}
          </option>
        ))}
      </select>

      {err && <p className="text-red-400 text-sm mb-3">{err}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cosmic-600 to-cosmic-700 disabled:opacity-50 text-night-950 font-semibold transition-all font-display tracking-wide"
      >
        {saving ? 'Recalcul…' : 'Enregistrer et recalculer'}
      </button>
    </div>
  );
}

export function Settings({ user, onUpdate }: { user: User; onUpdate: (u: User) => void }) {
  const [showLegal, setShowLegal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showProfiles, setShowProfiles] = useState(false);

  const handleLogout = () => {
    const u = logout();
    onUpdate(u);
    toast.info('À bientôt ✨');
    window.location.reload();
  };

  if (editing && user.birthData) {
    return <EditBirthData user={user} onUpdate={onUpdate} onCancel={() => setEditing(false)} />;
  }

  if (showLegal) {
    return (
      <div className="px-5 pt-12 pb-4">
        <button onClick={() => setShowLegal(false)} className="text-night-400 text-sm mb-4">← Retour</button>
        <h1 className="text-xl font-bold mb-6 text-gold-gradient">Informations légales</h1>

        <div className="glass rounded-2xl p-5 mb-4">
          <h2 className="text-night-100 font-semibold mb-2">Mentions légales</h2>
          <p className="text-night-400 text-sm leading-relaxed">
            Céleste est une application d'astrologie personnalisée éditée à titre informatif et de divertissement.
            Les contenus proposés ne constituent ni un conseil médical, ni un conseil financier, ni un conseil juridique.
            En cas de besoin professionnel, consultez un spécialiste qualifié.
          </p>
        </div>

        <div className="glass rounded-2xl p-5 mb-4">
          <h2 className="text-night-100 font-semibold mb-2">Confidentialité (RGPD)</h2>
          <p className="text-night-400 text-sm leading-relaxed">
            Vos données de naissance (date, heure, lieu) sont stockées localement sur votre appareil.
            Elles ne sont jamais transmises à des tiers ni utilisées à des fins publicitaires.
            Vous pouvez les supprimer à tout moment en vous déconnectant.
          </p>
        </div>

        <div className="glass rounded-2xl p-5 mb-4">
          <h2 className="text-night-100 font-semibold mb-2">Conditions d'abonnement</h2>
          <p className="text-night-400 text-sm leading-relaxed">
            • Essai gratuit de 3 jours sur l'offre annuelle, sans engagement.<br/>
            • Rappel par notification 24h avant le premier prélèvement.<br/>
            • Annulation possible à tout moment dans les réglages de l'App Store / Google Play.<br/>
            • Droit de rétractation de 14 jours (sauf contenu numérique déjà consommé).<br/>
            • Pas de remboursement pour la période en cours.
          </p>
        </div>
      </div>
    );
  }

  const chart = user.natalChart;
  const sun = chart ? ZODIAC_SIGNS[chart.sun] : null;

  if (showFavorites) {
    return <FavoritesView onBack={() => setShowFavorites(false)} />;
  }

  if (showProfiles) {
    return <ProfilesScreen user={user} onClose={() => setShowProfiles(false)} />;
  }

  return (
    <div className="px-5 pt-12 pb-4">
      <h1 className="text-2xl font-bold mb-6 text-gold-gradient">Profil</h1>

      {/* User card */}
      <div className="glass rounded-3xl p-5 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cosmic-500/30 to-gold-500/30 flex items-center justify-center">
            <span className="text-2xl">{sun?.emoji}</span>
          </div>
          <div className="flex-1">
            <p className="text-night-100 font-semibold">{user.email || 'Invité'}</p>
            <p className="text-night-400 text-sm">
              {sun ? `Soleil ${sun.name}` : '—'}
            </p>
            {user.birthData && (
              <p className="text-night-500 text-xs mt-0.5">
                {user.birthData.city}, {user.birthData.date}
              </p>
            )}
          </div>
        </div>

        {/* Premium badge (Feature A3) — uses /api/premium/status with full benefits list */}
        <div className="mt-4 pt-4 border-t border-night-700">
          <PremiumBadge />
        </div>
      </div>

      {/* P6 — Subscription management (Stripe portal) — visible only for premium users */}
      <div className="mt-2">
        <ManageSubscriptionButton />
      </div>

      {/* Actions */}
      <div className="space-y-2">
        {/* Notifications push (Feature 3) */}
        <NotificationPanel />
        {user.birthData && (
          <button onClick={() => setEditing(true)}
            className="w-full glass rounded-2xl p-4 flex items-center justify-between text-left hover:border-night-600 border border-transparent transition-all">
            <span className="text-night-200 text-sm">Modifier mes données de naissance</span>
            <span className="text-night-400">→</span>
          </button>
        )}
        <button onClick={() => setShowFavorites(true)}
          className="w-full glass rounded-2xl p-4 flex items-center justify-between text-left hover:border-night-600 border border-transparent transition-all">
          <span className="text-night-200 text-sm">⭐ Mes favoris</span>
          <span className="text-night-400">→</span>
        </button>
        <button onClick={() => setShowProfiles(true)}
          className="w-full glass rounded-2xl p-4 flex items-center justify-between text-left hover:border-night-600 border border-transparent transition-all">
          <span className="text-night-200 text-sm">👥 Profils (famille, ami·es)</span>
          <span className="text-night-400">→</span>
        </button>
        <button onClick={() => setShowLegal(true)}
          className="w-full glass rounded-2xl p-4 flex items-center justify-between text-left hover:border-night-600 border border-transparent transition-all">
          <span className="text-night-200 text-sm">Informations légales</span>
          <span className="text-night-400">→</span>
        </button>
        <button onClick={handleLogout}
          className="w-full glass rounded-2xl p-4 flex items-center justify-between text-left border border-transparent hover:border-red-900/50 transition-all">
          <span className="text-red-400 text-sm">Se déconnecter / Réinitialiser</span>
          <span className="text-red-400">→</span>
        </button>
      </div>

      <p className="text-night-600 text-xs text-center mt-8">Céleste · v{pkg.version}</p>
    </div>
  );
}

// ─── Notification Panel (Feature 3) ───────────────────────
function NotificationPanel() {
  const { status, loading, error, subscribe, unsubscribe, updateHour, test, refresh } = useNotifications();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ sent: number; total: number } | null>(null);

  // Initial load failed (status never resolved) — surface a retry instead of
  // an infinite "Chargement…". Distinguish from the brief flicker before first
  // fetch resolves.
  if (!status && error) {
    return (
      <div className="glass rounded-2xl p-4">
        <p className="text-night-200 text-sm font-medium mb-1">🔔 Notifications quotidiennes</p>
        <p className="text-red-400 text-xs mb-3">Impossible de charger le statut ({error})</p>
        <button
          onClick={() => { void refresh(); }}
          className="text-xs px-3 py-1.5 rounded-lg bg-cosmic-500/20 text-cosmic-200 border border-cosmic-500/40 hover:bg-cosmic-500/30"
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="glass rounded-2xl p-4 text-night-400 text-sm">Chargement…</div>
    );
  }

  if (!status.supported) {
    return (
      <div className="glass rounded-2xl p-4 text-left">
        <p className="text-night-200 text-sm font-medium mb-1">🔔 Notifications</p>
        <p className="text-night-500 text-xs">Non supporté sur ce navigateur.</p>
      </div>
    );
  }

  const hours = Array.from({ length: 24 }, (_, h) => h);

  const handleToggle = async () => {
    setTestResult(null);
    if (status.enabled) await unsubscribe();
    else await subscribe(status.hour);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const r = await test();
    if (r) {
      setTestResult(r);
      if (r.sent === r.total && r.total > 0) {
        toast.success(`Notification test envoyée ✓ (${r.sent}/${r.total})`);
      } else if (r.sent > 0) {
        toast.info(`Partiel : ${r.sent}/${r.total} envoyées`);
      } else {
        toast.error('Aucune notification envoyée — vérifie la permission');
      }
    }
    setTesting(false);
  };

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-night-200 text-sm font-medium">🔔 Notifications quotidiennes</p>
          <p className="text-night-500 text-xs mt-0.5">
            {status.enabled
              ? `Activé${status.subscriptionCount > 1 ? ` (${status.subscriptionCount} appareils)` : ''}`
              : 'Rappel chaque matin avant ton horoscope'}
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={loading}
          className={`relative w-12 h-7 rounded-full transition-colors ${
            status.enabled ? 'bg-cosmic-500' : 'bg-night-700'
          }`}
        >
          <span
            className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all ${
              status.enabled ? 'left-5' : 'left-0.5'
            }`}
          />
        </button>
      </div>

      {status.enabled && (
        <>
          {/* Heure */}
          <div className="flex items-center justify-between pt-3 border-t border-night-700">
            <span className="text-night-300 text-xs">Heure du rappel</span>
            <select
              value={status.hour}
              onChange={(e) => updateHour(parseInt(e.target.value, 10))}
              className="bg-night-800 text-night-100 text-xs rounded-lg px-2 py-1 border border-night-700"
            >
              {hours.map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}h00
                </option>
              ))}
            </select>
          </div>

          {/* Test */}
          <div className="flex items-center justify-between pt-3 border-t border-night-700">
            <div>
              <span className="text-night-300 text-xs">Tester maintenant</span>
              {testResult && (
                <p className="text-night-500 text-xs mt-0.5">
                  {testResult.sent}/{testResult.total} envoyée(s)
                </p>
              )}
            </div>
            <button
              onClick={handleTest}
              disabled={testing}
              className="text-xs px-3 py-1 rounded-lg bg-cosmic-500/20 text-cosmic-200 border border-cosmic-500/40 hover:bg-cosmic-500/30 disabled:opacity-50"
            >
              {testing ? '…' : 'Envoyer'}
            </button>
          </div>
        </>
      )}

      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

      {status.permission === 'denied' && (
        <p className="text-amber-400 text-xs mt-2">
          Permission refusée. Autorise les notifications dans les paramètres du navigateur.
        </p>
      )}
    </div>
  );
}

// ─── Favorites View (Feature 5) ─────────────────────────────
function FavoritesView({ onBack }: { onBack: () => void }) {
  const { favorites, remove, loading } = useFavorites();
  const [busyId, setBusyId] = useState<number | null>(null);

  const handleRemove = async (id: number) => {
    setBusyId(id);
    try {
      await remove(id);
    } catch (err) {
      console.warn('remove fav failed', err);
    } finally {
      setBusyId(null);
    }
  };

  const sectionLabel = (s: string) => {
    switch (s) {
      case 'general': return '✦ Général';
      case 'love': return '♥ Amour';
      case 'career': return '★ Carrière';
      default: return s;
    }
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso + 'T00:00:00');
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    } catch {
      return iso;
    }
  };

  return (
    <div className="px-5 pt-12 pb-4">
      <button onClick={onBack} className="text-night-400 text-sm mb-4">← Retour</button>
      <h1 className="text-2xl font-bold mb-6 text-gold-gradient">Mes favoris</h1>

      {loading && favorites.length === 0 ? (
        <p className="text-night-400 text-sm">Chargement...</p>
      ) : favorites.length === 0 ? (
        <div className="glass rounded-2xl p-6 text-center">
          <div className="text-4xl mb-3">☆</div>
          <p className="text-night-300 text-sm mb-2">Aucun favori pour l'instant.</p>
          <p className="text-night-500 text-xs">
            Clique sur l'étoile à côté d'une section de ton horoscope pour la sauvegarder ici.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {favorites.map(fav => (
            <div key={fav.id} className="glass rounded-2xl p-4 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-gold-400 text-xs">{sectionLabel(fav.section)}</span>
                  <span className="text-night-500 text-xs">· {formatDate(fav.date)}</span>
                </div>
                <button
                  onClick={() => handleRemove(fav.id)}
                  disabled={busyId === fav.id}
                  className="text-night-500 hover:text-rose-400 text-sm px-2 py-1 transition-colors"
                  aria-label="Supprimer"
                >
                  {busyId === fav.id ? '...' : '✕'}
                </button>
              </div>
              <p className="text-night-100 text-sm leading-relaxed">{fav.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}