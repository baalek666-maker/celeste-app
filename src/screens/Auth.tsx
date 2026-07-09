import { useState } from 'react';
import { api, setToken } from '../lib/api';

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
        ? await api.register(email, password)
        : await api.login(email, password);
      setToken(res.token);
      onSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cosmic-bg star-field min-h-screen text-night-100 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full glass border border-gold-500/20 mb-4">
            <span className="text-4xl">✦</span>
          </div>
          <h1 className="text-3xl font-bold text-gold-gradient">Céleste</h1>
          <p className="text-night-400 text-sm mt-2">Votre carte du ciel, votre destin</p>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-6 p-1 glass rounded-2xl">
          <button
            onClick={() => setMode('register')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${mode === 'register' ? 'bg-cosmic-600 text-white' : 'text-night-400'}`}
          >
            Créer un compte
          </button>
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${mode === 'login' ? 'bg-cosmic-600 text-white' : 'text-night-400'}`}
          >
            Se connecter
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-night-400 text-xs uppercase tracking-widest mb-2 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              required
              className="w-full px-4 py-3.5 rounded-2xl glass border border-night-700 text-night-100 placeholder:text-night-500 focus:border-cosmic-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="text-night-400 text-xs uppercase tracking-widest mb-2 block">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? '6 caractères minimum' : '••••••'}
              required
              minLength={mode === 'register' ? 6 : 1}
              className="w-full px-4 py-3.5 rounded-2xl glass border border-night-700 text-night-100 placeholder:text-night-500 focus:border-cosmic-500 focus:outline-none transition-colors"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-cosmic-600 to-cosmic-700 text-white font-semibold text-lg transition-all disabled:opacity-50"
          >
            {loading ? '...' : mode === 'register' ? 'Commencer ✦' : 'Se connecter'}
          </button>
        </form>

        <p className="text-night-500 text-xs text-center mt-6">
          {mode === 'register' ? 'Déjà un compte ? ' : 'Pas encore de compte ? '}
          <button
            onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}
            className="text-cosmic-300 font-medium"
          >
            {mode === 'register' ? 'Se connecter' : 'Créer un compte'}
          </button>
        </p>
      </div>
    </div>
  );
}
