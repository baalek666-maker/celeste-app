import { useState, useMemo } from 'react';
import type { User } from '../types';
import { CHINESE_ANIMALS, CHINESE_ELEMENTS, getChineseZodiac, getChineseElement, getYinYang } from '../data/chinese-astrology';

export default function ChineseAstrology({ user }: { user: User }) {
  const [selectedAnimal, setSelectedAnimal] = useState<number | null>(null);

  const birthYear = user.birthData?.date ? new Date(user.birthData.date).getFullYear() : 1995;
  const myAnimal = useMemo(() => getChineseZodiac(birthYear), [birthYear]);
  const myElement = useMemo(() => getChineseElement(birthYear), [birthYear]);
  const myYinYang = useMemo(() => getYinYang(birthYear), [birthYear]);

  const animal = selectedAnimal !== null ? CHINESE_ANIMALS[selectedAnimal] : myAnimal;
  const compatibleAnimals = animal.compatibility.map(id => CHINESE_ANIMALS.find(a => a.id === id)).filter(Boolean);
  const incompatibleAnimals = animal.incompatible.map(id => CHINESE_ANIMALS.find(a => a.id === id)).filter(Boolean);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center pt-2 animate-fade-in">
        <div className="text-6xl mb-2">{myAnimal.emoji}</div>
        <p className="text-night-400 text-xs uppercase tracking-widest mb-1">
          {myYinYang} \u00B7 {myElement.name}
        </p>
        <h2 className="text-2xl font-bold text-gold-gradient">{myAnimal.name}</h2>
        <p className="text-night-500 text-sm mt-1">{myAnimal.chinese}</p>
      </div>

      {/* Your sign card */}
      <div className="glass rounded-2xl p-5 stagger-card" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-14 h-14 rounded-full glass-gold flex items-center justify-center text-3xl flex-shrink-0">
            {myAnimal.emoji}
          </div>
          <div className="flex-1">
            <p className="text-gold-300 font-bold text-lg">{myAnimal.name} {myYinYang}</p>
            <p className="text-night-400 text-xs">
              Element {myElement.name} \u00B7 Planete {myAnimal.planet} \u00B7 ~ {myAnimal.western}
            </p>
          </div>
        </div>
        <p className="text-night-200 text-sm leading-relaxed">{myAnimal.description}</p>
      </div>

      {/* Traits */}
      <div className="glass rounded-2xl p-5 stagger-card" style={{ animationDelay: '0.15s' }}>
        <p className="text-night-400 text-xs uppercase tracking-widest mb-3">Traits dominants</p>
        <div className="flex flex-wrap gap-2">
          {myAnimal.traits.map((t, i) => (
            <span key={i} className="px-3 py-1 rounded-full glass-gold text-gold-300 text-xs font-medium">
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Strengths / Weaknesses */}
      <div className="grid grid-cols-1 gap-3 stagger-card" style={{ animationDelay: '0.2s' }}>
        <div className="glass rounded-2xl p-4 border border-gold-500/10">
          <p className="text-gold-400 text-xs font-bold uppercase tracking-wider mb-2">+ Forces</p>
          <p className="text-night-200 text-sm leading-relaxed">{myAnimal.strengths}</p>
        </div>
        <div className="glass rounded-2xl p-4 border border-night-500/10">
          <p className="text-night-400 text-xs font-bold uppercase tracking-wider mb-2">- Defis</p>
          <p className="text-night-300 text-sm leading-relaxed">{myAnimal.weaknesses}</p>
        </div>
      </div>

      {/* Element detail */}
      <div className="glass rounded-2xl p-5 stagger-card" style={{ animationDelay: '0.25s' }}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">{myElement.emoji}</span>
          <div>
            <p className="text-gold-300 font-bold">Element {myElement.name}</p>
            <p className="text-night-500 text-xs">{myElement.chinese} \u00B7 Couleur {myElement.color} \u00B7 {myElement.planet}</p>
          </div>
        </div>
        <p className="text-night-200 text-sm">{myElement.qualities}</p>
        <div className="flex gap-4 mt-3 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-night-500">Nourrit</span>
            <span className="text-gold-400 font-semibold">{myElement.nourishes}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-night-500">Controle</span>
            <span className="text-gold-400 font-semibold">{myElement.controls}</span>
          </div>
        </div>
      </div>

      {/* Compatibility */}
      <div className="glass rounded-2xl p-5 stagger-card" style={{ animationDelay: '0.3s' }}>
        <p className="text-night-400 text-xs uppercase tracking-widest mb-3">Affinites</p>
        <div className="flex flex-wrap gap-3">
          {compatibleAnimals.map(a => a && (
            <button
              key={a.id}
              onClick={() => setSelectedAnimal(a.id === selectedAnimal ? null : a.id)}
              className="flex flex-col items-center gap-1 group"
            >
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl transition-all ${selectedAnimal === a.id ? 'glass-gold scale-110' : 'glass group-hover:scale-105'}`}>
                {a.emoji}
              </div>
              <span className="text-night-300 text-xs">{a.name}</span>
            </button>
          ))}
        </div>
        <p className="text-night-500 text-xs mt-3">Touchez un signe pour explorer</p>
      </div>

      {/* All 12 animals */}
      <div className="stagger-card" style={{ animationDelay: '0.35s' }}>
        <p className="text-night-400 text-xs uppercase tracking-widest mb-3 px-1">Les 12 animaux</p>
        <div className="grid grid-cols-4 gap-3">
          {CHINESE_ANIMALS.map(a => (
            <button
              key={a.id}
              onClick={() => setSelectedAnimal(a.id === selectedAnimal ? null : a.id)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${selectedAnimal === a.id ? 'glass-gold scale-105' : 'glass hover:scale-105'}`}
            >
              <span className="text-2xl">{a.emoji}</span>
              <span className="text-night-400 text-[10px]">{a.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Selected animal detail */}
      {selectedAnimal !== null && (
        <div className="glass rounded-2xl p-5 animate-fade-in border border-gold-500/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{animal.emoji}</span>
              <div>
                <p className="text-gold-300 font-bold text-lg">{animal.name}</p>
                <p className="text-night-500 text-xs">{animal.chinese} \u00B7 {animal.element}</p>
              </div>
            </div>
            <button onClick={() => setSelectedAnimal(null)} className="text-night-400 text-xs hover:text-gold-400">
              Fermer
            </button>
          </div>
          <p className="text-night-200 text-sm leading-relaxed mb-3">{animal.description}</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {animal.traits.map((t, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full glass text-gold-300 text-[10px]">{t}</span>
            ))}
          </div>
          {compatibleAnimals.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-night-500">Compatible avec:</span>
              {compatibleAnimals.map(a => a && <span key={a.id} className="text-gold-400">{a.emoji} {a.name}</span>)}
            </div>
          )}
        </div>
      )}

      {/* Cross-reference with Western astrology */}
      <div className="glass-gold rounded-2xl p-5 stagger-card" style={{ animationDelay: '0.4s' }}>
        <p className="text-gold-400 text-xs font-bold uppercase tracking-widest mb-2">Pont Est-Ouest</p>
        <p className="text-night-100 text-sm">
          Votre signe chinois <span className="text-gold-300 font-semibold">{myAnimal.name}</span> correspond au signe occidental <span className="text-gold-300 font-semibold">{myAnimal.western}</span>.
          Cette resonance entre les deux traditions revele une double cle de lecture de votre personnalite.
        </p>
      </div>
    </div>
  );
}
