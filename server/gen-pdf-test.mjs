import { generatePortraitPdf } from '/home/ubuntu/celeste-app/server/portrait-pdf.js';
import { writeFileSync } from 'fs';

// Natal chart réaliste hardcoded pour le test (le vrai calcul se fera via getNatalPositions côté serveur)
const natalChart = {
  sun:     { sign: 'Lion',        degree: 22.4, longitude: 142.4, retrograde: false },
  moon:    { sign: 'Sagittaire',  degree: 8.1,  longitude: 248.1, retrograde: false },
  mercury: { sign: 'Vierge',      degree: 15.3, longitude: 165.3, retrograde: false },
  venus:   { sign: 'Balance',     degree: 3.7,  longitude: 183.7, retrograde: false },
  mars:    { sign: 'Sagittaire',  degree: 28.9, longitude: 268.9, retrograde: false },
  jupiter: { sign: 'Sagittaire',  degree: 12.0, longitude: 252.0, retrograde: false },
  saturn:  { sign: 'Poissons',    degree: 5.5,  longitude: 335.5, retrograde: true },
  uranus:  { sign: 'Capricorne',  degree: 19.2, longitude: 289.2, retrograde: true },
  neptune: { sign: 'Capricorne',  degree: 18.8, longitude: 288.8, retrograde: true },
  pluto:   { sign: 'Scorpion',    degree: 24.1, longitude: 234.1, retrograde: true },
};

const birthData = { date: '1995-08-15', time: '14:30', city: 'Paris', country: 'France' };

const portrait = [
  '## Ton essence : Soleil en Lion',
  '',
  'Ton Soleil en Lion illumine ton chemin. Cette position fondamentale définit qui tu es au plus profond de ton être. Tu rayonnes naturellement, tu as besoin d\'être vu et reconnu pour te sentir vivant. Le Lion est un signe de Feu : ta vitalité vient de l\'intérieur et se diffuse vers l\'extérieur. Quand tu es aligné avec ton Soleil, tu inspires les autres par ta simple présence.',
  '',
  '## Ton monde intérieur : Lune en Sagittaire',
  '',
  'Ta Lune en Sagittaire révèle un monde émotionnel tourné vers l\'horizon. Tu ressens le besoin d\'explorer, de comprendre, de donner du sens. Ta joie vient de la liberté et de la découverte. Tu as soif de vérité et d\'aventure intérieure.',
  '',
  '## Ton masque : Ascendant Vierge',
  '',
  'Ton Ascendant Vierge est la première impression que tu donnes au monde. Tu apparais organisé, précis, attentif aux détails avant même que les gens ne découvrent ton cœur de Lion. La Vierge est un signe de Terre : tu montres un visage posé, méthodique, fiable.',
  '',
  '## Mercure en Vierge — Ta façon de penser',
  '',
  'Ton esprit est analytique, précis, méthodique. Tu communiques avec clarté et tu as le sens du détail. Tu tries les informations avec discernement. Quand tu parles, c\'est pesé, juste, utile.',
  '',
  '## Vénus en Balance — Ta façon d\'aimer',
  '',
  'Tu cherches l\'harmonie dans tes relations. L\'amour pour toi est un art d\'équilibre — donner et recevoir, écouter et partager. La beauté t\'émeut profondément. Tu es capable de voir le meilleur chez l\'autre.',
  '',
  '## Mars en Sagittaire — Ta façon d\'agir',
  '',
  'Ton énergie est tournée vers l\'aventure et l\'expansion. Tu agis avec enthousiasme, tu fonces quand tu crois en quelque chose. Ta motivation vient de ta vision. Personne ne t\'arrête quand tu as un objectif.',
  '',
  '## Jupiter en Sagittaire — Ta chance',
  '',
  'Jupiter dans son signe maison : la chance est avec toi. Tu grandis par l\'exploration, l\'apprentissage, la confiance en la vie. Ton optimisme est contagieux.',
  '',
  '## Saturne en Poissons — Ta structure',
  '',
  'Saturne rétrograde en Poissons : tu apprends à structurer ton intuition. La discipline vient de l\'intérieur, pas de l\'extérieur. Tu bâtis sur des fondations invisibles mais solides.',
].join('\n');

const pdf = await generatePortraitPdf({
  portrait,
  name: 'Yo',
  sun: 'leo',
  moon: 'sagittarius',
  rising: 'virgo',
  birthData,
  natalChart,
});

writeFileSync('/tmp/portrait-celeste.pdf', pdf);
console.log('PDF généré :', pdf.length, 'bytes');