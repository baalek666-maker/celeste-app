import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { toast } from '../components/Toast';

const MOODS = [
  { emoji: '😔', score: 1, label: 'Difficile' },
  { emoji: '😕', score: 2, label: 'Mitigé' },
  { emoji: '😐', score: 3, label: 'Neutre' },
  { emoji: '🙂', score: 4, label: 'Bien' },
  { emoji: '😄', score: 5, label: 'Excellent' },
];

const ENERGY = [
  { emoji: '🔋', score: 1, label: 'Vide' },
  { emoji: '🪫', score: 2, label: 'Bas' },
  { emoji: '⚖️', score: 3, label: 'OK' },
  { emoji: '⚡', score: 4, label: 'Frais' },
  { emoji: '🚀', score: 5, label: 'Au top' },
];

type Stats = {
  totalCheckins: number;
  avgMood?: number;
  avgEnergy?: number;
  checkins?: Array<{ date: string; mood_emoji: string; mood_score: number; energy_score: number; note?: string }>;
  insights?: {
    type: string;
    bestElement: string;
    bestAvgMood: number;
    worstElement: string;
    worstAvgMood: number;
    insight: string;
  } | null;
};

export default function MoodCheckin() {
  const [checkedIn, setCheckedIn] = useState(false);
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [selectedEnergy, setSelectedEnergy] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [todayData, setTodayData] = useState<{ moodEmoji?: string; moodScore?: number; energyScore?: number } | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.getMoodToday().catch((): { checkedIn: boolean; moodEmoji?: string; moodScore?: number; energyScore?: number } => ({ checkedIn: false })),
      api.getMoodStats(30).catch(() => ({ totalCheckins: 0, insights: null })),
    ]).then(([today, s]) => {
      if (!alive) return;
      setCheckedIn(today.checkedIn);
      if (today.checkedIn && today.moodScore) {
        setTodayData({ moodEmoji: today.moodEmoji, moodScore: today.moodScore, energyScore: today.energyScore });
      }
      setStats(s as Stats);
    });
    return () => { alive = false; };
  }, []);

  const submit = async () => {
    if (selectedMood === null || selectedEnergy === null) return;
    setBusy(true);
    try {
      const mood = MOODS.find(m => m.score === selectedMood)!;
      await api.moodCheckin(mood.emoji, selectedMood, selectedEnergy, note.trim() || undefined);
      setCheckedIn(true);
      setTodayData({ moodEmoji: mood.emoji, moodScore: selectedMood, energyScore: selectedEnergy });
      // Refresh stats
      api.getMoodStats(30).then(setStats).catch(() => { /* refresh secondaire : silencieux */ });
    } catch (err) {
      toast.error('Check-in non enregistré — réessaie dans quelques secondes.');
    }
    finally { setBusy(false); }
  };

  const sparkData = stats?.checkins?.slice(-14).map(c => c.mood_score) || [];
  const maxSpark = 5;

  return (
    <div className="glass rounded-3xl p-5 mb-5 stagger-card card-glow animate-fade-in" style={{ animationDelay: '0.25s' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-gold-400 text-xs uppercase tracking-widest font-medium">Check-in</p>
          <p className="text-night-100 text-sm font-semibold">Comment te sens-tu ?</p>
        </div>
        {stats && stats.totalCheckins > 0 && (
          <div className="text-right">
            <p className="text-night-500 text-[10px]">Total</p>
            <p className="text-gold-300 text-lg font-bold">{stats.totalCheckins}</p>
          </div>
        )}
      </div>

      {!checkedIn ? (
        /* ── Check-in flow ── */
        <div className="space-y-4">
          {/* Mood selection */}
          <div>
            <p className="text-night-400 text-xs mb-2">Humeur</p>
            <div className="flex justify-between gap-1.5">
              {MOODS.map(m => (
                <button
                  key={m.score}
                  onClick={() => setSelectedMood(m.score)}
                  className={`flex-1 py-2.5 rounded-xl text-center transition-all ${
                    selectedMood === m.score
                      ? 'glass-gold scale-105 border border-gold-500/30'
                      : 'glass border border-transparent hover:border-night-600/30'
                  }`}
                >
                  <span className={`text-xl block ${selectedMood === m.score ? 'scale-110' : 'opacity-60'}`}>{m.emoji}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Energy selection */}
          <div>
            <p className="text-night-400 text-xs mb-2">Énergie</p>
            <div className="flex justify-between gap-1.5">
              {ENERGY.map(e => (
                <button
                  key={e.score}
                  onClick={() => setSelectedEnergy(e.score)}
                  className={`flex-1 py-2.5 rounded-xl text-center transition-all ${
                    selectedEnergy === e.score
                      ? 'glass-gold scale-105 border border-gold-500/30'
                      : 'glass border border-transparent hover:border-night-600/30'
                  }`}
                >
                  <span className={`text-xl block ${selectedEnergy === e.score ? 'scale-110' : 'opacity-60'}`}>{e.emoji}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Optional note */}
          {showNote && (
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Une note ? (optionnel)"
              maxLength={500}
              rows={2}
              className="w-full bg-night-900/50 text-night-100 text-sm rounded-lg p-2.5 border border-night-700/50 focus:border-gold-500/40 focus:outline-none resize-none placeholder:text-night-600 animate-fade-in"
            />
          )}
          {!showNote && (
            <button onClick={() => setShowNote(true)} className="text-night-500 text-xs hover:text-night-300 transition">
              + Ajouter une note
            </button>
          )}

          {/* Submit */}
          <button
            onClick={submit}
            disabled={selectedMood === null || selectedEnergy === null || busy}
            className="w-full glass-gold rounded-xl py-3 text-sm font-medium text-gold-300 hover:scale-[1.01] disabled:opacity-30 disabled:hover:scale-100 transition"
          >
            {busy ? 'Sauvegarde…' : 'Valider ✓'}
          </button>
        </div>
      ) : (
        /* ── Already checked in: show summary + stats ── */
        <div className="space-y-3">
          <div className="glass rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{todayData?.moodEmoji}</span>
              <div>
                <p className="text-night-100 text-sm font-medium">Check-in fait ✓</p>
                <p className="text-night-500 text-[10px]">Humeur {todayData?.moodScore}/5 · Énergie {todayData?.energyScore}/5</p>
              </div>
            </div>
            <button
              onClick={() => { setCheckedIn(false); setSelectedMood(todayData?.moodScore ?? null); setSelectedEnergy(todayData?.energyScore ?? null); }}
              className="text-night-500 text-xs hover:text-gold-300 transition"
            >
              Modifier
            </button>
          </div>

          {/* Sparkline */}
          {sparkData.length >= 3 && (
            <div className="glass rounded-xl p-3">
              <p className="text-night-500 text-[10px] uppercase tracking-wider mb-2">14 derniers jours</p>
              <div className="flex items-end gap-1 h-12">
                {sparkData.map((v, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-sm bg-gradient-to-t from-gold-500/30 to-gold-400/60"
                    style={{ height: `${(v / maxSpark) * 100}%` }}
                    title={`${v}/5`}
                  />
                ))}
              </div>
              <div className="flex justify-between text-night-600 text-[9px] mt-1">
                <span>il y a {sparkData.length}j</span>
                <span>aujourd'hui</span>
              </div>
            </div>
          )}

          {/* Astro insight */}
          {stats?.insights && (
            <div className="glass rounded-xl p-3 border border-purple-500/20 animate-fade-in">
              <p className="text-purple-300 text-[10px] uppercase tracking-wider font-medium mb-1">🔬 Insight personnalisé</p>
              <p className="text-night-200 text-xs leading-relaxed">{stats.insights.insight}</p>
            </div>
          )}

          {/* Averages */}
          {stats && stats.totalCheckins >= 3 && (
            <div className="flex gap-2">
              <div className="glass rounded-lg p-2.5 flex-1 text-center">
                <p className="text-night-500 text-[9px] uppercase">Humeur moy.</p>
                <p className="text-gold-300 text-lg font-bold">{stats.avgMood?.toFixed(1)}</p>
              </div>
              <div className="glass rounded-lg p-2.5 flex-1 text-center">
                <p className="text-night-500 text-[9px] uppercase">Énergie moy.</p>
                <p className="text-gold-300 text-lg font-bold">{stats.avgEnergy?.toFixed(1)}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
