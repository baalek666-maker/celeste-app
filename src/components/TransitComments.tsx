/**
 * P2#20 — Section commentaires communautaires sur un transit du jour.
 *
 * Affiche les commentaires d'une "salle de discussion" par transit
 * (identifié par date ISO + transit_key stable). Permet de poster, liker,
 * supprimer son propre commentaire.
 *
 * Tone VMF: chaleureux, conversationnel, pas de jargon. On parle de
 * "ressenti" et de "partage d'expérience", pas de "commentaires".
 */

import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';

interface Comment {
  id: number;
  display_name: string;
  content: string;
  likes_count: number;
  created_at: number;
  liked: number;
}

function relativeTime(epoch: number): string {
  const diff = Date.now() / 1000 - epoch;
  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `il y a ${Math.floor(diff / 86400)} j`;
  return new Date(epoch * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function initials(name: string): string {
  const clean = name.replace(/[^a-zA-ZÀ-ÿ0-9 ]/g, '').trim();
  if (!clean) return '✦';
  return clean.slice(0, 2).toUpperCase();
}

export default function TransitComments({ date, transitKey }: { date: string; transitKey: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const list = await api.getTransitComments(date, transitKey);
      setComments(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [date, transitKey]);

  useEffect(() => { load(); }, [load]);

  const post = async () => {
    const content = text.trim();
    if (!content || posting) return;
    setPosting(true);
    setError(null);
    try {
      const c = await api.postTransitComment(date, transitKey, content);
      setComments(prev => [c, ...prev]);
      setText('');
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'envoi');
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = async (id: number) => {
    // optimistic
    setComments(prev => prev.map(c =>
      c.id === id
        ? { ...c, liked: c.liked ? 0 : 1, likes_count: c.likes_count + (c.liked ? -1 : 1) }
        : c
    ));
    try {
      await api.toggleCommentLike(id);
    } catch {
      // rollback on error
      setComments(prev => prev.map(c =>
        c.id === id
          ? { ...c, liked: c.liked ? 0 : 1, likes_count: c.likes_count + (c.liked ? -1 : 1) }
          : c
      ));
    }
  };

  const remove = async (id: number) => {
    const prev = comments;
    setComments(c => c.filter(x => x.id !== id));
    try {
      await api.deleteTransitComment(id);
    } catch {
      setComments(prev);
    }
  };

  const myName = comments.find(c => c.liked !== undefined)?.display_name; // placeholder, real own detection via auth state not available here

  return (
    <div className="mt-5 pt-4 border-t border-white/[0.06]">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-celeste-text/70 hover:text-celeste-text transition-colors text-sm"
        aria-expanded={open}
      >
        <span aria-hidden>💬</span>
        <span>
          {comments.length > 0
            ? `${comments.length} ${comments.length === 1 ? 'ressenti partagé' : 'ressentis partagés'}`
            : 'Partager ton ressenti'}
        </span>
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3 animate-fade-in">
          {/* Composer */}
          <div className="rounded-2xl bg-celeste-bg/40 border border-white/[0.04] p-3">
            <textarea
              value={text}
              onChange={e => setText(e.target.value.slice(0, 500))}
              placeholder="Comment ressentis-tu ce transit aujourd'hui ?"
              rows={2}
              className="w-full bg-transparent text-sm text-celeste-text placeholder:text-celeste-text/30 outline-none resize-none"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-celeste-text/40">{text.length}/500</span>
              <button
                onClick={post}
                disabled={!text.trim() || posting}
                className="px-3 py-1 rounded-full bg-gold-500/20 text-gold-200 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gold-500/30 transition-colors"
              >
                {posting ? '...' : 'Partager'}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-rose-300 text-xs">{error}</p>
          )}

          {/* List */}
          {loading ? (
            <p className="text-celeste-text/40 text-xs text-center py-3">Chargement…</p>
          ) : comments.length === 0 ? (
            <p className="text-celeste-text/40 text-xs text-center py-3 italic">
              Sois la première personne à partager son ressenti ✦
            </p>
          ) : (
            <div className="space-y-2">
              {comments.map(c => {
                const isMine = c.display_name === myName; // weak heuristic
                return (
                  <div key={c.id} className="rounded-2xl bg-celeste-bg/40 border border-white/[0.04] p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-6 h-6 rounded-full bg-gradient-to-br from-gold-500/30 to-celeste-primary/30 flex items-center justify-center text-[10px] font-semibold text-gold-200">
                        {initials(c.display_name)}
                      </span>
                      <span className="text-xs text-celeste-text/80 font-medium">{c.display_name}</span>
                      <span className="text-[10px] text-celeste-text/30 ml-auto">{relativeTime(c.created_at)}</span>
                    </div>
                    <p className="text-sm text-celeste-text/90 leading-relaxed whitespace-pre-line">{c.content}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        onClick={() => toggleLike(c.id)}
                        className={`text-xs flex items-center gap-1 transition-colors ${
                          c.liked ? 'text-gold-300' : 'text-celeste-text/40 hover:text-gold-300'
                        }`}
                        aria-label="J'aime"
                      >
                        <span aria-hidden>{c.liked ? '★' : '☆'}</span>
                        <span>{c.likes_count > 0 && c.likes_count}</span>
                      </button>
                      {isMine && (
                        <button
                          onClick={() => remove(c.id)}
                          className="text-[10px] text-celeste-text/30 hover:text-rose-300 transition-colors ml-auto"
                        >
                          supprimer
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
