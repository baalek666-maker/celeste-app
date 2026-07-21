import { useState, useMemo } from 'react';
import type { User } from '../types';
import {
  CHINESE_ANIMALS, CHINESE_ELEMENTS,
  getChineseZodiac, getChineseElement, getYinYang,
  getCorrectedChineseYear, getHourPillar, getCompatibilityScore,
} from '../data/chinese-astrology';

export default function ChineseAstrology({ user }: { user: User }) {
  const [selectedAnimal, setSelectedAnimal] = useState<number | null>(null);

  // Utiliser l'année corrigée par le Nouvel An lunaire
  const rawBirthDate = user.birthData?.date || '1995-01-28';
  const correctedYear = useMemo(() => getCorrectedChineseYear(rawBirthDate), [rawBirthDate]);
  const birthTime = user.birthData?.time || '';

  const myAnimal = useMemo(() => getChineseZodiac(correctedYear), [correctedYear]);
  const myElement = useMemo(() => getChineseElement(correctedYear), [correctedYear]);
  const myYinYang = useMemo(() => getYinYang(correctedYear), [correctedYear]);
  const hourPillar = useMemo(() => getHourPillar(birthTime), [birthTime]);

  const animal = selectedAnimal !== null ? CHINESE_ANIMALS[selectedAnimal] : myAnimal;
  const compatibleAnimals = animal.compatibility.map(id => CHINESE_ANIMALS.find(a => a.id === id)).filter(Boolean);
  const incompatibleAnimals = animal.incompatible.map(id => CHINESE_ANIMALS.find(a => a.id === id)).filter(Boolean);

  // Score de compatilité entre le signe de l'utilisateur et le signe sélectionné
  const compatScore = selectedAnimal !== null
    ? getCompatibilityScore(myAnimal.id, selectedAnimal)
    : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center pt-2 animate-fade-in">
        <div className="text-6xl mb-2">{myAnimal.emoji}</div>
        <p className="text-night-400 text-xs uppercase tracking-widest mb-1">
          {myYinYang} · {myElement.name}
        </p>
        <h2 className="text-2xl font-bold text-gold-gradient">{myAnimal.name}</h2>
        <p className="text-night-500 text-sm mt-1">{myAnimal.chinese}</p>
      </div>

      {/* Ton signe */}
      <div className="glass rounded-2xl p-5 stagger-card border border-night-700/20" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl glass flex items-center justify-center text-2xl flex-shrink-0">
            {myAnimal.emoji}
          </div>
          <div className="flex-1">
            <p className="text-night-100 font-medium text-base">{myAnimal.name} {myYinYang}</p>
            <p className="text-night-400 text-xs">
              Élément {myElement.name} · Planète {myAnimal.planet}
            </p>
          </div>
        </div>
        <p className="text-night-200 text-sm leading-relaxed">{myAnimal.description}</p>
      </div>

      {/* Traits */}
      <div className="glass rounded-2xl p-5 stagger-card border border-night-700/20" style={{ animationDelay: '0.15s' }}>
        <p className="text-night-400 text-xs uppercase tracking-widest mb-3">Traits dominants</p>
        <div className="flex flex-wrap gap-2">
          {myAnimal.traits.map((t, i) => (
            <span key={i} className="px-3 py-1 rounded-full glass border border-night-700/30 text-gold-300 text-xs">
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Forces / Défis */}
      <div className="grid grid-cols-1 gap-3 stagger-card" style={{ animationDelay: '0.2s' }}>
        <div className="glass rounded-2xl p-4 border border-night-700/20">
          <p className="text-gold-400 text-xs uppercase tracking-wider mb-2">Forces</p>
          <p className="text-night-200 text-sm leading-relaxed">{myAnimal.strengths}</p>
        </div>
        <div className="glass rounded-2xl p-4 border border-night-700/20">
          <p className="text-night-400 text-xs uppercase tracking-wider mb-2">Défis</p>
          <p className="text-night-300 text-sm leading-relaxed">{myAnimal.weaknesses}</p>
        </div>
      </div>

      {/* Numéro chance + couleur + direction */}
      <div className="glass rounded-2xl p-5 stagger-card border border-night-700/20" style={{ animationDelay: '0.22s' }}>
        <p className="text-night-400 text-xs uppercase tracking-widest mb-3">Ta chance</p>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-xl bg-night-800/30">
            <p className="text-2xl font-bold text-gold-300">{myAnimal.luckyNumber}</p>
            <p className="text-night-500 text-[10px] mt-1">Numéro</p>
          </div>
          <div className="p-3 rounded-xl bg-night-800/30">
            <p className="text-sm font-medium text-gold-300">{myAnimal.luckyColor}</p>
            <p className="text-night-500 text-[10px] mt-1">Couleur</p>
          </div>
          <div className="p-3 rounded-xl bg-night-800/30">
            <p className="text-sm font-medium text-gold-300">{myAnimal.luckyDirection}</p>
            <p className="text-night-500 text-[10px] mt-1">Direction</p>
          </div>
        </div>
        <p className="text-night-400 text-[11px] mt-3 text-center">
          Carrière idéale : {myAnimal.bestCareer}
        </p>
      </div>

      {/* Élément */}
      <div className="glass rounded-2xl p-5 stagger-card border border-night-700/20" style={{ animationDelay: '0.25s' }}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">{myElement.emoji}</span>
          <div>
            <p className="text-night-100 font-medium">Élément {myElement.name}</p>
            <p className="text-night-500 text-xs">{myElement.chinese} · Couleur {myElement.color} · Planète {myElement.planet}</p>
          </div>
        </div>
        <p className="text-night-200 text-sm leading-relaxed">{myElement.qualities}</p>
        <div className="flex gap-4 mt-3 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-night-500">Nourrit</span>
            <span className="text-gold-400">{myElement.nourishes}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-night-500">Contrôle</span>
            <span className="text-gold-400">{myElement.controls}</span>
          </div>
        </div>
      </div>

      {/* Bazi — Pilier horaire */}
      {hourPillar && (
        <div className="glass rounded-2xl p-5 stagger-card border border-night-700/20" style={{ animationDelay: '0.27s' }}>
          <p className="text-night-400 text-xs uppercase tracking-widest mb-3">Ton Bazi (heure de naissance)</p>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{hourPillar.emoji}</span>
            <div>
              <p className="text-night-100 font-medium">{hourPillar.animal}</p>
              <p className="text-night-500 text-xs">
                Animal de ton heure de naissance ({birthTime}) — il révèle ta face cachée, ce que tu es quand tu laisses tomber les masques.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Prévision 2025 */}
      <div className="glass rounded-2xl p-5 stagger-card border border-night-700/20" style={{ animationDelay: '0.3s' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🐍</span>
          <p className="text-night-400 text-xs uppercase tracking-widest">Ton année 2025 — Serpent de Bois</p>
        </div>
        <p className="text-night-200 text-sm leading-relaxed">{myAnimal.forecast2025}</p>
      </div>

      {/* Affinités */}
      <div className="glass rounded-2xl p-5 stagger-card border border-night-700/20" style={{ animationDelay: '0.32s' }}>
        <p className="text-night-400 text-xs uppercase tracking-widest mb-3">Affinités naturelles</p>
        <div className="flex flex-wrap gap-3">
          {compatibleAnimals.map(a => a && (
            <button
              key={a.id}
              onClick={() => setSelectedAnimal(a.id === selectedAnimal ? null : a.id)}
              className="flex flex-col items-center gap-1 group"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-all ${selectedAnimal === a.id ? 'glass border border-gold-500/40 scale-110' : 'glass border border-night-700/30 group-hover:scale-105'}`}>
                {a.emoji}
              </div>
              <span className="text-night-300 text-[10px]">{a.name}</span>
              <span className="text-gold-400 text-[9px] font-medium">
                {getCompatibilityScore(myAnimal.id, a.id)}%
              </span>
            </button>
          ))}
        </div>
        <p className="text-night-500 text-[10px] mt-3">Touche un signe pour explorer ta compatibilité</p>
      </div>

      {/* Incompatibilités */}
      {incompatibleAnimals.length > 0 && (
        <div className="glass rounded-2xl p-4 stagger-card border border-night-700/20" style={{ animationDelay: '0.34s' }}>
          <p className="text-night-400 text-xs uppercase tracking-widest mb-2">Signes difficiles</p>
          <div className="flex flex-wrap gap-3">
            {incompatibleAnimals.map(a => a && (
              <button
                key={a.id}
                onClick={() => setSelectedAnimal(a.id === selectedAnimal ? null : a.id)}
                className="flex flex-col items-center gap-1 group"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg glass border border-night-700/30 opacity-60">
                  {a.emoji}
                </div>
                <span className="text-night-400 text-[10px]">{a.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Les 12 animaux */}
      <div className="stagger-card" style={{ animationDelay: '0.35s' }}>
        <p className="text-night-400 text-xs uppercase tracking-widest mb-3 px-1">Les 12 animaux</p>
        <div className="grid grid-cols-4 gap-2">
          {CHINESE_ANIMALS.map(a => (
            <button
              key={a.id}
              onClick={() => setSelectedAnimal(a.id === selectedAnimal ? null : a.id)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${selectedAnimal === a.id ? 'glass border border-gold-500/30 scale-105' : 'glass border border-night-700/20 hover:scale-105'}`}
            >
              <span className="text-xl">{a.emoji}</span>
              <span className="text-night-400 text-[10px]">{a.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Détail animal sélectionné avec score compatibilité */}
      {selectedAnimal !== null && (
        <div className="glass rounded-2xl p-5 animate-fade-in border border-night-700/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{animal.emoji}</span>
              <div>
                <p className="text-night-100 font-medium">{animal.name}</p>
                <p className="text-night-500 text-xs">{animal.chinese} · Élément {animal.element}</p>
              </div>
            </div>
            <button onClick={() => setSelectedAnimal(null)} className="text-night-400 text-xs hover:text-gold-400">
              ✕
            </button>
          </div>

          {compatScore !== null && (
            <div className="mb-3 p-3 rounded-xl bg-night-800/30 border border-night-700/30">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-night-400">Ta compatibilité avec ce signe</span>
                <span className={`text-lg font-bold ${compatScore >= 80 ? 'text-green-400' : compatScore >= 60 ? 'text-gold-400' : 'text-rose-400'}`}>
                  {compatScore}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-night-700/50 overflow-hidden">
                <div
                  className={`h-full rounded-full ${compatScore >= 80 ? 'bg-green-400' : compatScore >= 60 ? 'bg-gold-400' : 'bg-rose-400'}`}
                  style={{ width: `${compatScore}%` }}
                />
              </div>
              <p className="text-night-400 text-[10px] mt-2">
                {compatScore >= 85 ? 'Excellente entente — vous vous complétez naturellement.' :
                 compatScore >= 75 ? 'Très bonne affinité — relation fluide et stimulante.' :
                 compatScore >= 60 ? 'Compatibilité moyenne — à construire avec patience.' :
                 'Relation difficile — demande des efforts de compréhension mutuelle.'}
              </p>
            </div>
          )}

          <p className="text-night-200 text-sm leading-relaxed mb-3">{animal.description}</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {animal.traits.map((t, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full glass border border-night-700/30 text-gold-300 text-[10px]">{t}</span>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-night-400">
            <span>Numéro chance : <span className="text-gold-400">{animal.luckyNumber}</span></span>
            <span>· Couleur : <span className="text-gold-400">{animal.luckyColor}</span></span>
          </div>
        </div>
      )}

      {/* Pont Est-Ouest */}
      <div className="glass rounded-2xl p-5 stagger-card border border-night-700/20" style={{ animationDelay: '0.4s' }}>
        <p className="text-night-400 text-xs uppercase tracking-widest mb-2">Dualité Est-Ouest</p>
        <p className="text-night-200 text-sm leading-relaxed">
          Ton signe chinois <span className="text-gold-300 font-medium">{myAnimal.name}</span> résonne avec le signe occidental <span className="text-gold-300 font-medium">{myAnimal.western}</span>.
          Cette correspondance n'est pas un hasard — les deux traditions, venues d'horizons opposés, identifient la même énergie fondamentale en toi. L'Est voit en toi le {myAnimal.name.toLowerCase()} : {myAnimal.traits[0].toLowerCase()}, {myAnimal.traits[1].toLowerCase()}. L'Ouest voit le {myAnimal.western}. Deux langages, une même vérité.
        </p>
      </div>
    </div>
  );
}