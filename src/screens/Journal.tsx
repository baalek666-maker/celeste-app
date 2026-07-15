import { useEffect, useState, useRef } from 'react';
import type { User, JournalEntry } from '../types';
import { getJournal, addJournalEntry, localISODate } from '../lib/storage';
import { api, getToken } from '../lib/api';

function calcStreak(entries: JournalEntry[]): number {
  if (entries.length === 0) return 0;
  const dates = new Set(entries.map(e => e.date));
  let streak = 0;
  const d = new Date();
  // If today not written yet, start from yesterday
  if (!dates.has(localISODate(d))) {
    d.setDate(d.getDate() - 1);
  }
  while (dates.has(localISODate(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function Journal({ user }: { user: User }) {
  const [entries, setEntries] = useState<JournalEntry[]>(() => getJournal());
  const [note, setNote] = useState('');
  const [rating, setRating] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [saveFlash, setSaveFlash] = useState(false);
  const flashTimer = useRef<number | null>(null);
  const syncMsgTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    if (syncMsgTimer.current !== null) window.clearTimeout(syncMsgTimer.current);
  }, []);
  const today = localISODate();
  const todayFr = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const streak = calcStreak(entries);
  const hasToday = entries.some(e => e.date === today);

  // On mount, if logged in, fetch server-side entries and merge with local.
  // Server is source of truth; localStorage acts as offline cache.
  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    (async () => {
      try {
        setSyncing(true);
        const remote = await api.getJournal();
        if (cancelled) return;
        const local = getJournal();
        // Merge: prefer remote entries, fill gaps with local
        const byId = new Map<string, JournalEntry>();
        for (const e of local) byId.set(e.id, e);
        for (const e of remote) byId.set(e.id, e);
        const merged = Array.from(byId.values()).sort((a, b) => b.date.localeCompare(a.date));
        // Persist merged to local cache
        localStorage.setItem('celeste_journal', JSON.stringify(merged));
        setEntries(merged);
        setSyncMsg(`${remote.length} entrées synchronisées.`);
      } catch (e) {
        // Offline / network error — keep local cache
        setSyncMsg('Mode hors-ligne.');
      } finally {
        if (!cancelled) setSyncing(false);
        if (syncMsgTimer.current !== null) window.clearTimeout(syncMsgTimer.current);
        syncMsgTimer.current = window.setTimeout(() => setSyncMsg(''), 3000);
      }
    })();
    return () => { cancelled = true; };
  }, [user.email]);

  const handleSave = async () => {
    if (!note.trim()) return;
    const entry: JournalEntry = {
      id: today,
      date: today,
      horoscopeSummary: '',
      userNote: note.trim(),
      userRating: rating,
    };
    // 1. Save locally (instant, works offline)
    addJournalEntry(entry);
    setEntries(getJournal());
    setNote('');
    setRating(0);
    setSaveFlash(true);
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setSaveFlash(false), 2500);
    // 2. Best-effort sync to backend
    if (getToken()) {
      try {
        await api.saveJournalEntry({
          date: entry.date,
          userNote: entry.userNote,
          userRating: entry.userRating,
        });
      } catch {
        // Swallow — entry is safe locally, will re-sync on next visit
      }
    }
  };

  return (
    <div className="px-5 pt-12 pb-4">
      <h1 className="text-2xl font-bold mb-1 text-gold-gradient">Journal</h1>
      <p className="text-night-400 text-sm mb-4">Vos ressentis et votre parcours astral</p>

      {/* Save flash */}
      {saveFlash && (
        <div className="glass-gold rounded-xl px-4 py-3 mb-4 animate-fade-in border border-gold-500/30 flex items-center gap-3">
          <span className="text-xl">✨</span>
          <div>
            <p className="text-gold-300 text-sm font-semibold">Entrée enregistrée !</p>
            {streak > 0 && streak % 7 === 0 && (
              <p className="text-night-300 text-xs">🔥 Série de {streak} jours — bravo !</p>
            )}
          </div>
        </div>
      )}

      {/* Streak badge */}
      {streak >= 2 && (
        <div className="glass rounded-2xl px-4 py-2.5 mb-4 flex items-center justify-between border border-cosmic-500/20 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="text-lg">{streak >= 7 ? '🔥' : '☾'}</span>
            <span className="text-night-200 text-sm font-medium">
              {streak} jour{streak > 1 ? 's' : ''} de suite
            </span>
          </div>
          {!hasToday && (
            <span className="text-cosmic-400 text-xs">Écrivez aujourd'hui pour continuer !</span>
          )}
        </div>
      )}

      {/* Sync status */}
      {(syncing || syncMsg) && (
        <p className="text-xs text-cosmic-400 mb-3 animate-fade-in">
          {syncing ? '⟳ Synchronisation…' : `✓ ${syncMsg}`}
        </p>
      )}

      {/* Today's entry */}
      <div className="glass rounded-3xl p-5 mb-6">
        <p className="text-night-300 text-sm font-medium mb-3 capitalize">{todayFr}</p>
        <p className="text-night-400 text-sm mb-4">Comment vous sentez-vous aujourd'hui ?</p>

        {/* Rating */}
        <div className="flex gap-2 mb-4">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => setRating(n)}
              className={`text-2xl transition-all ${rating >= n ? 'text-gold-400' : 'text-night-700'}`}>
              {rating >= n ? '★' : '☆'}
            </button>
          ))}
        </div>

        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Notez vos pensées, ressentis, synchronicités..."
          rows={3}
          className="w-full p-3 rounded-xl glass border border-night-700 text-night-100 text-sm placeholder:text-night-600 focus:outline-none focus:border-cosmic-500 resize-none"
        />
        <button onClick={handleSave} disabled={!note.trim()}
          className="w-full mt-3 py-3 rounded-xl bg-gradient-to-r from-cosmic-600 to-cosmic-700 disabled:opacity-30 text-white font-medium transition-all">
          Enregistrer
        </button>
      </div>

      {/* Past entries */}
      {entries.length > 0 && (
        <>
          <p className="text-night-400 text-xs uppercase tracking-widest mb-3">Historique</p>
          <div className="space-y-3">
            {entries.map((e, idx) => (
              <div key={e.id} className="glass rounded-2xl p-4 animate-fade-in card-glow" style={{ animationDelay: `${idx * 0.06}s` }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-night-300 text-sm capitalize">
                    {new Date(e.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </p>
                  {e.userRating > 0 && (
                    <p className="text-gold-400 text-sm">{'★'.repeat(e.userRating)}{'☆'.repeat(5 - e.userRating)}</p>
                  )}
                </div>
                <p className="text-night-200 text-sm">{e.userNote}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {entries.length === 0 && (
        <div className="text-center py-12">
          <p className="text-night-500 text-sm">Aucune entrée pour le moment.</p>
          <p className="text-night-600 text-xs mt-1">Commencez votre journal aujourd'hui ☾</p>
        </div>
      )}
    </div>
  );
}