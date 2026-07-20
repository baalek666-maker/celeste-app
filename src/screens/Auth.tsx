import { useState } from 'react';
import { api, errMsg } from '../lib/api';
import { getStoredReferralCode, clearStoredReferralCode } from '../lib/referral-storage';

export function Auth({ onSuccess }: { onSuccess: (user: any) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null);

  // Fric-#1 — OAuth (Sign in with Apple + Google)
  // MVP web : on ne charge PAS le SDK Google ici (trop lourd), on simule
  // un idToken factice pour montrer le flow. En prod, charger
  // accounts.google.com/gsi/client ou Apple ID JS et passer le vrai idToken.
  const handleOAuth = async (provider: 'google' | 'apple') => {
    setOauthLoading(provider);
    setError('');
    try {
      // Placeholder ID token pour démo. En prod, récupérer le vrai token
      // via accounts.google.com/gsi/client (Google) ou AppleID.auth.signIn().
      // On inclut l'email fictif pour que le backend puisse créer/raccorder.
      const mockEmail = `${provider}.demo@gmail.com`;
      const result = await api.oauthLogin({
        provider,
        idToken: 'mock.' + btoa(JSON.stringify({
          sub: `${provider}_demo_${Date.now()}`,
          email: mockEmail,
          name: provider === 'google' ? 'Demo Google' : 'Demo Apple',
          picture: null,
          iss: provider === 'google' ? 'https://accounts.google.com' : 'appleid.apple.com',
          aud: 'celeste-app-demo',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        })).replace(/=/g, '.').replace(/\+/g, '-').replace(/\//g, '_'),
        email: mockEmail,
        displayName: provider === 'google' ? 'Demo Google' : 'Demo Apple',
      });
      if (mode === 'register') clearStoredReferralCode();
      onSuccess(result.user);
    } catch (err: unknown) {
      setError(errMsg(err, `Connexion ${provider} indisponible.`));
    } finally {
      setOauthLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = mode === 'register'
        ? await api.register(email, password, getStoredReferralCode() ?? undefined)
        : await api.login(email, password);
      // Réinitialise le code parrain après usage (une seule fois).
      if (mode === 'register') clearStoredReferralCode();
      onSuccess(res.user);
    } catch (err: unknown) {
      // Friendlier, localized error messages
      const raw = errMsg(err, '').toLowerCase();
      let msg = 'Oups, vérifie tes identifiants ✦';
      if (raw.includes('network') || raw.includes('failed to fetch') || raw.includes('load failed')) {
        msg = 'Impossible de contacter les étoiles. Vérifie ta connexion.';
      } else if (raw.includes('already') || raw.includes('exists')) {
        msg = 'Un compte existe déjà avec cet email. Essayez de tu connecter.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cosmic-bg star-field min-h-screen text-night-100 flex items-center justify-center px-6 relative">
      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-10 animate-fade-in-scale">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full glass-gold border border-gold-500/20 mb-4 animate-float-slow">
            <svg width="40" height="40" viewBox="0 0 40 40" className="animate-spin-slow">
              <circle cx="20" cy="20" r="16" fill="none" stroke="#fbbf24" strokeWidth="0.5" opacity="0.4" />
              <circle cx="20" cy="20" r="10" fill="none" stroke="#c084fc" strokeWidth="0.5" opacity="0.3" />
              <circle cx="20" cy="3" r="1.5" fill="#fbbf24" />
              <circle cx="37" cy="20" r="1" fill="#c084fc" />
              <circle cx="20" cy="20" r="2.5" fill="#fcd34d" opacity="0.7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gold-gradient">Céleste</h1>
          <p className="text-night-400 text-sm mt-2">Ta carte du ciel, ton destin</p>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-6 p-1 glass rounded-2xl animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <button
            onClick={() => setMode('register')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${mode === 'register' ? 'bg-gradient-to-r from-cosmic-600 to-cosmic-700 text-white shadow-lg shadow-cosmic-900/40' : 'text-night-400'}`}
          >
            Créer un compte
          </button>
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${mode === 'login' ? 'bg-gradient-to-r from-cosmic-600 to-cosmic-700 text-white shadow-lg shadow-cosmic-900/40' : 'text-night-400'}`}
          >
            Se connecter
          </button>
        </div>

        {/* Form */}
        {/* Fric-#1 — Sign in with Apple + Google buttons */}
        <div className="space-y-3 mb-6 animate-fade-in" style={{ animationDelay: '0.05s' }}>
          <button
            type="button"
            onClick={() => handleOAuth('apple')}
            disabled={oauthLoading !== null || loading}
            aria-label="Se connecter avec Apple"
            className="w-full py-3.5 rounded-2xl bg-black text-white font-semibold flex items-center justify-center gap-2 hover:bg-neutral-900 transition-all active:scale-[0.99] disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12 7.25c-.15-2.6 1.92-4.86 4.4-5.04.12 2.66-2.43 4.96-4.4 5.04z"/>
            </svg>
            {oauthLoading === 'apple' ? 'Connexion…' : 'Continuer avec Apple'}
          </button>
          <button
            type="button"
            onClick={() => handleOAuth('google')}
            disabled={oauthLoading !== null || loading}
            aria-label="Se connecter avec Google"
            className="w-full py-3.5 rounded-2xl bg-white text-neutral-800 font-semibold flex items-center justify-center gap-2 hover:bg-neutral-50 transition-all active:scale-[0.99] disabled:opacity-50 border border-neutral-200"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {oauthLoading === 'google' ? 'Connexion…' : 'Continuer avec Google'}
          </button>
        </div>

        {/* Separator */}
        <div className="flex items-center gap-3 mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="flex-1 h-px bg-night-700/60" />
          <span className="text-night-500 text-xs uppercase tracking-widest">ou avec email</span>
          <div className="flex-1 h-px bg-night-700/60" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div>
            <label className="text-night-400 text-xs uppercase tracking-widest mb-2 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="toi@exemple.com"
              required
              className="w-full px-4 py-3.5 rounded-2xl glass border border-night-700 text-night-100 placeholder:text-night-500 focus:border-gold-500/50 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-night-400 text-xs uppercase tracking-widest mb-2 block">Mot de passe</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? '6 caractères minimum' : '••••••'}
              required
              minLength={mode === 'register' ? 6 : 1}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              className="w-full px-4 py-3.5 rounded-2xl glass border border-night-700 text-night-100 placeholder:text-night-500 focus:border-gold-500/50 focus:outline-none transition-colors"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 animate-fade-in" role="alert">
              <span className="text-red-400 text-sm leading-relaxed">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cosmic-600 via-cosmic-600 to-cosmic-700 text-white font-semibold text-lg transition-all duration-300 disabled:opacity-70 shadow-lg shadow-cosmic-900/40 hover:shadow-cosmic-700/50 hover:scale-[1.01] active:scale-[0.99]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" />
                </svg>
                {mode === 'register' ? 'Création du compte...' : 'Connexion...'}
              </span>
            ) : mode === 'register' ? 'Commencer ✦' : 'Se connecter'}
          </button>

          {mode === 'register' && !loading && (
            <p className="text-gold-300 text-xs text-center mt-3 animate-fade-in flex items-center justify-center gap-1.5">
              <span>✨</span>
              <span className="font-medium">7 jours gratuits Constellation</span>
              <span className="text-night-500">· sans carte bancaire</span>
            </p>
          )}
        </form>

        <p className="text-night-500 text-xs text-center mt-6 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          {mode === 'register' ? 'Déjà un compte ? ' : 'Pas encore de compte ? '}
          <button
            onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}
            className="text-cosmic-300 font-medium hover:text-cosmic-200 transition-colors"
          >
            {mode === 'register' ? 'Se connecter' : 'Créer un compte'}
          </button>
        </p>
      </div>
    </div>
  );
}
