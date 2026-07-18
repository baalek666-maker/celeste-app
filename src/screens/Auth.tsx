import { useState } from 'react';
import { api, errMsg } from '../lib/api';
import { getStoredReferralCode, clearStoredReferralCode } from '../lib/referral-storage';

export function Auth({ onSuccess }: { onSuccess: (user: any) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
