import { useState, useEffect } from 'react';
import type { User } from '../../types';
import { ZODIAC_SIGNS } from '../../data/zodiac';
import { api } from '../../lib/api';
import { useNotifications } from '../../lib/useNotifications';
import PremiumBadge from '../../components/PremiumBadge';
import { toast } from '../../components/Toast';
import { DeleteAccountConfirm } from './DeleteAccountConfirm';
import EmailVerificationBanner from '../../components/EmailVerificationBanner';
import ReferralCard from '../../components/ReferralCard';
import { YearlyRecapCollapsible } from '../../components/YearlyRecap';
import ExpertModeToggle from '../../components/ExpertModeToggle';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Vite resolves this to the package.json version at build time.
import pkg from '../../../package.json';

// ─── ManageSubscriptionButton (Stripe portal) ──────────────────
function ManageSubscriptionButton() {
  const [status, setStatus] = useState<{ isPremium: boolean; plan: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    api.getPremiumStatus().then(s => {
      if (alive) setStatus({ isPremium: s.isPremium, plan: s.plan });
    }).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const handleManage = async () => {
    setLoading(true);
    try {
      const { url } = await api.openPortal();
      window.location.href = url;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Impossible d'ouvrir le portail de gestion");
      setLoading(false);
    }
  };

  const openAppStore = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      window.location.href = 'itms-apps://apps.apple.com/account/subscriptions';
    } else if (/android/.test(userAgent)) {
      window.location.href = 'https://play.google.com/store/account/subscriptions';
    } else {
      toast.info("Ouvre l'App Store ou Google Play pour gérer ton abonnement.");
    }
  };

  if (status && status.isPremium) {
    return (
      <button
        onClick={handleManage}
        disabled={loading}
        className="w-full glass rounded-2xl p-4 flex items-center justify-between text-left hover:border-gold-500/30 border border-transparent transition-all disabled:opacity-50"
      >
        <div>
          <span className="text-gold-400 text-sm font-medium">💳 Gérer mon abonnement{status.plan === 'lifetime' ? ' (à vie)' : ''}</span>
          <p className="text-night-500 text-xs mt-0.5">Annuler, changer de carte, voir les factures</p>
        </div>
        <span className="text-gold-400">{loading ? '⏳' : '→'}</span>
      </button>
    );
  }

  if (status && !status.isPremium) {
    return (
      <button
        onClick={openAppStore}
        className="w-full glass rounded-2xl p-4 flex items-center justify-between text-left hover:border-night-600 border border-transparent transition-all"
      >
        <div>
          <span className="text-night-200 text-sm">📱 Mes abonnements (App Store / Google Play)</span>
          <p className="text-night-500 text-xs mt-0.5">Annuler ou modifier un abonnement existant</p>
        </div>
        <span className="text-night-400">→</span>
      </button>
    );
  }

  return null;
}

// ─── Notification Panel (Feature 3) ─────────────────────────────
function NotificationPanel() {
  const { status, loading, error, subscribe, unsubscribe, updateHour, test, refresh } = useNotifications();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ sent: number; total: number } | null>(null);

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
          className={`relative w-12 h-7 rounded-full transition-colors ${status.enabled ? 'bg-cosmic-500' : 'bg-night-700'}`}
        >
          <span
            className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all ${status.enabled ? 'left-5' : 'left-0.5'}`}
          />
        </button>
      </div>

      {status.enabled && (
        <>
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

// ─── SettingsMenu (main view) ────────────────────────────────────
export interface SettingsMenuProps {
  user: User;
  onUpdate: (u: User) => void;
  onPaywall?: () => void;
  onEditBirthData: () => void;
  onShowLegal: () => void;
  onShowFavorites: () => void;
  onShowProfiles: () => void;
  onLogout: () => void;
}

export function SettingsMenu({
  user,
  onUpdate,
  onPaywall,
  onEditBirthData,
  onShowLegal,
  onShowFavorites,
  onShowProfiles,
  onLogout,
}: SettingsMenuProps) {
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExportData = async () => {
    setExporting(true);
    try {
      const local: Record<string, unknown> = {
        exportedAt: new Date().toISOString(),
        source: 'celeste.web',
        version: pkg.version,
        profile: {
          email: user.email,
          name: user.name,
          isPremium: user.isPremium,
          premiumUntil: user.premiumUntil,
          scansRemaining: user.scansRemaining,
        },
        birthData: user.birthData ?? null,
        natalChart: user.natalChart ?? null,
        journal: localStorage.getItem('celeste-journal') ? JSON.parse(localStorage.getItem('celeste-journal')!) : [],
        favorites: localStorage.getItem('celeste-favorites') ? JSON.parse(localStorage.getItem('celeste-favorites')!) : [],
        notifications: localStorage.getItem('celeste-notifs') ? JSON.parse(localStorage.getItem('celeste-notifs')!) : null,
      };

      const blob = new Blob([JSON.stringify(local, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `celeste-mes-donnees-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Tes données ont été téléchargées ✨');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export impossible');
    } finally {
      setExporting(false);
    }
  };

  const chart = user.natalChart;
  const sun = chart ? ZODIAC_SIGNS[chart.sun] : null;

  return (
    <div className="px-5 pt-12 pb-4">
      <EmailVerificationBanner email={user.email} />
      <h1 className="text-2xl font-bold mb-6 text-gold-gradient">Profil</h1>

      <div className="glass rounded-3xl p-5 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cosmic-500/30 to-gold-500/30 flex items-center justify-center">
            <span className="text-2xl">{sun?.emoji}</span>
          </div>
          <div className="flex-1">
            <p className="text-night-100 font-semibold">{user.email || 'Invité'}</p>
            <p className="text-night-400 text-sm">{sun ? `Soleil ${sun.name}` : '—'}</p>
            {user.birthData && (
              <p className="text-night-500 text-xs mt-0.5">
                {user.birthData.city}, {user.birthData.date}
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-night-700">
          <PremiumBadge onUpgrade={onPaywall} />
        </div>
      </div>

      <div className="mt-2">
        <ManageSubscriptionButton />
      </div>

      <div className="mt-2">
        <ReferralCard />
      </div>

      {/* P2#15 — Yearly Recap (dépliable) */}
      <YearlyRecapCollapsible />

      {/* P2#18 — Vue détaillée (mode expert) */}
      <ExpertModeToggle />

      <div className="space-y-2">
        <NotificationPanel />
        {user.birthData && (
          <button onClick={onEditBirthData}
            className="w-full glass rounded-2xl p-4 flex items-center justify-between text-left hover:border-night-600 border border-transparent transition-all">
            <span className="text-night-200 text-sm">Modifier mes données de naissance</span>
            <span className="text-night-400">→</span>
          </button>
        )}
        <button onClick={onShowFavorites}
          className="w-full glass rounded-2xl p-4 flex items-center justify-between text-left hover:border-night-600 border border-transparent transition-all">
          <span className="text-night-200 text-sm">⭐ Mes favoris</span>
          <span className="text-night-400">→</span>
        </button>
        <button onClick={onShowProfiles}
          className="w-full glass rounded-2xl p-4 flex items-center justify-between text-left hover:border-night-600 border border-transparent transition-all">
          <span className="text-night-200 text-sm">👥 Profils (famille, ami·es)</span>
          <span className="text-night-400">→</span>
        </button>
        <button onClick={onShowLegal}
          className="w-full glass rounded-2xl p-4 flex items-center justify-between text-left hover:border-cosmic-500/40 border border-transparent transition-all">
          <span className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-cosmic-500/15 border border-cosmic-500/25 flex items-center justify-center text-cosmic-300">📜</span>
            <span className="text-night-200 text-sm">Informations légales</span>
          </span>
          <span className="text-night-400">→</span>
        </button>
        <button onClick={onLogout}
          className="w-full glass rounded-2xl p-4 flex items-center justify-between text-left border border-transparent hover:border-red-900/50 transition-all">
          <span className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-night-700/40 flex items-center justify-center text-night-300">🔓</span>
            <span className="text-red-400 text-sm">Se déconnecter / Réinitialiser</span>
          </span>
          <span className="text-red-400">→</span>
        </button>

        <button
          onClick={handleExportData}
          disabled={exporting}
          className="w-full glass rounded-2xl p-4 flex items-center justify-between text-left border border-transparent hover:border-cosmic-500/40 transition-all"
        >
          <span className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-cosmic-500/15 border border-cosmic-500/25 flex items-center justify-center text-cosmic-300">📦</span>
            <span className="flex-1">
              <span className="text-night-200 text-sm block">Exporter mes données (RGPD)</span>
              <span className="text-night-500 text-xs">{exporting ? 'Préparation…' : 'Reçois un JSON complet : profil, thème natal, journal…'}</span>
            </span>
          </span>
          <span className="text-night-400">{exporting ? '⏳' : '⬇'}</span>
        </button>

        {!showDeleteAccount ? (
          <button
            onClick={() => setShowDeleteAccount(true)}
            className="w-full glass rounded-2xl p-4 flex items-center justify-between text-left border border-transparent hover:border-red-500/30 transition-all mt-2"
          >
            <span className="text-red-300 text-sm">🗑️ Supprimer mon compte (RGPD)</span>
            <span className="text-red-300">→</span>
          </button>
        ) : (
          <DeleteAccountConfirm
            user={user}
            onUpdate={onUpdate}
            onBack={() => setShowDeleteAccount(false)}
          />
        )}
      </div>

      <p className="text-night-600 text-xs text-center mt-8">Céleste · v{pkg.version}</p>
    </div>
  );
}

export default SettingsMenu;
