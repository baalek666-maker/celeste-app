import { useState } from 'react';
import type { User, JournalEntry } from '../types';
import { getJournal, addJournalEntry } from '../lib/storage';

export function Journal({ user }: { user: User }) {
  const [entries, setEntries] = useState<JournalEntry[]>(getJournal());
  const [note, setNote] = useState('');
  const [rating, setRating] = useState(0);
  const today = new Date().toISOString().split('T')[0];
  const todayFr = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  const handleSave = () => {
    if (!note.trim()) return;
    const entry: JournalEntry = {
      id: today,
      date: today,
      horoscopeSummary: '',
      userNote: note.trim(),
      userRating: rating,
    };
    addJournalEntry(entry);
    setEntries(getJournal());
    setNote('');
    setRating(0);
  };

  return (
    <div className="px-5 pt-12 pb-4">
      <h1 className="text-2xl font-bold mb-1 text-gold-gradient">Journal</h1>
      <p className="text-night-400 text-sm mb-6">Vos ressentis et votre parcours astral</p>

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
            {entries.map(e => (
              <div key={e.id} className="glass rounded-2xl p-4">
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
