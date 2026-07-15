// 22 Major Arcana — French esoteric tradition
export interface TarotCard {
  id: number;
  name: string;
  roman: string;
  emoji: string;
  archetype: string;
  upright: string;
  reversed: string;
  question: string; // prompt for daily reflection
}

export const MAJOR_ARCANA: TarotCard[] = [
  { id: 0, name: 'Le Fou', roman: '0', emoji: '🃏', archetype: 'Liberté, commencement, spontanéité', upright: 'Un nouveau départ t'appelle. Ose le saut dans l\'inconnu avec confiance.', reversed: 'L\'impulsivité risque de égarer. Prends un instant avant d\'agir.', question: 'Qu\'est-ce qui demande ton audace aujourd\'hui ?' },
  { id: 1, name: 'Le Bateleur', roman: 'I', emoji: '🎩', archetype: 'Créativité, habileté, initiative', upright: 'Tu as tous les outils en main. Manifeste tes idées avec adresse.', reversed: 'Attention aux illusions ou aux demi-mesures. Sois authentique.', question: 'Quel talent souhaites-tu exprimer aujourd\'hui ?' },
  { id: 2, name: 'La Papesse', roman: 'II', emoji: '🌙', archetype: 'Intuition, savoir caché, mystère', upright: 'Écoute ta voix intérieure. Les réponses sont en toi.', reversed: 'Tu ignores ta sagesse. Prends un moment de silence.', question: 'Qu\'est-ce que ton intuition murmure ?' },
  { id: 3, name: 'L\'Impératrice', roman: 'III', emoji: '👑', archetype: 'Fécondité, abondance, création', upright: 'La créativité coule. Donne vie à tes projets avec joie.', reversed: 'Une étouffe ou un blocage créatif. Retrouve ton flux.', question: 'Qu\'est-ce qui demande d\'être créé aujourd\'hui ?' },
  { id: 4, name: 'L\'Empereur', roman: 'IV', emoji: '🏛️', archetype: 'Autorité, structure, maîtrise', upright: 'C\'est le moment de prendre les rennes. Structure tes ambitions.', reversed: 'Le contrôle devient rigidité. Assouplissez ton prise.', question: 'Où as-tu besoin de poser un cadre ?' },
  { id: 5, name: 'Le Pape', roman: 'V', emoji: '🔑', archetype: 'Sagesse, enseignement, spiritualité', upright: 'Un guide ou un enseignement précieux croise ton chemin.', reversed: 'Remets en question les croyances héritées. Trouve ton propre voie.', question: 'Qu\'est-ce que tu apprends en ce moment ?' },
  { id: 6, name: 'L\'Amoureux', roman: 'VI', emoji: '💕', archetype: 'Choix du cœur, union, dualité', upright: 'Un choix de cœur se présente. Suis ce qui résonne vraiment.', reversed: 'Une indécision sentimentale. Clarifie tes désirs profonds.', question: 'Quel choix du cœur se présente à toi ?' },
  { id: 7, name: 'Le Chariot', roman: 'VII', emoji: '⚔️', archetype: 'Victoire, volonté, maîtrise', upright: 'Ta détermination te mène à la victoire. Avance avec force.', reversed: 'L\'agitation te disperse. Recentrez-tu sur un seul objectif.', question: 'Qu\'est-ce qui mérite ton pleine volonté ?' },
  { id: 8, name: 'La Justice', roman: 'VIII', emoji: '⚖️', archetype: 'Équilibre, vérité, justesse', upright: 'L\'équité prévaut. Tes actes justes portent leurs fruits.', reversed: 'Un déséquilibre à corriger. Sois honnête avec toi-même.', question: 'Où l\'équilibre doit-il être rétabli ?' },
  { id: 9, name: 'L\'Ermite', roman: 'IX', emoji: '🏮', archetype: 'Introspection, retraite, lumière intérieure', upright: 'Retirez-tu un instant du bruit. Ta lumière intérieure guide.', reversed: 'L\'isolement devient repli. Reste connecté aux autres.', question: 'De quel silence as-tu besoin aujourd\'hui ?' },
  { id: 10, name: 'La Roue de Fortune', roman: 'X', emoji: '🎡', archetype: 'Cycles, destin, changement', upright: 'La roue tourne en ton faveur. Saisissez l\'opportunité.', reversed: 'Un cycle se ferme. Acceptez le changement de phase.', question: 'Quel cycle se met en mouvement ?' },
  { id: 11, name: 'La Force', roman: 'XI', emoji: '🦁', archetype: 'Courage, douceur, maîtrise de soi', upright: 'Ta force intérieure dompte les obstacles. Avance avec douceur.', reversed: 'Le doute affaiblit ta détermination. Retrouve ta courage.', question: 'Où dois-tu faire preuve de douceur-force ?' },
  { id: 12, name: 'Le Pendu', roman: 'XII', emoji: '🙃', archetype: 'Lâcher prise, vision nouvelle, sacrifice', upright: 'Voir les choses sous un autre angle te libère.', reversed: 'La stagnation te frustre. Lâchez ce qui te retient.', question: 'Qu\'est-ce qui mérite d\'être vu autrement ?' },
  { id: 13, name: 'L\'Arcane sans nom', roman: 'XIII', emoji: '🦋', archetype: 'Transformation, fin, renaissance', upright: 'Une transformation profonde est en cours. Accueille le changement.', reversed: 'Tu résistez à une fin nécessaire. Laissez partir.', question: 'Qu\'est-ce qui doit mourir pour renaître ?' },
  { id: 14, name: 'Tempérance', roman: 'XIV', emoji: '🕊️', archetype: 'Harmonie, patience, alchimie', upright: 'Trouve le juste milieu. L\'équilibre est ton allié.', reversed: 'L\'excès déséquilibre. Modère tes excès.', question: 'Où as-tu besoin de plus d\'équilibre ?' },
  { id: 15, name: 'Le Diable', roman: 'XV', emoji: '🔥', archetype: 'Désir, attachement, ombre', upright: 'Confronte tes peurs et attachements. La lumière est plus forte.', reversed: 'Tu te libères d\'une chaîne. La libération est proche.', question: 'Qu\'est-ce qui t'enchaîne sans raison ?' },
  { id: 16, name: 'La Maison Dieu', roman: 'XVI', emoji: '⚡', archetype: 'Changement soudain, révélation, éclaircie', upright: 'Un éclair de vérité bouscule tes certitudes. Accueille-le.', reversed: 'Tu évitez un changement nécessaire. Affronte la tempête.', question: 'Qu\'est-ce qui se révèle brutalement aujourd\'hui ?' },
  { id: 17, name: 'L\'Étoile', roman: 'XVII', emoji: '⭐', archetype: 'Espoir, inspiration, guidance', upright: 'L\'espoir revient. Suis ton étoile avec foi.', reversed: 'Le découragement voile ta lumière. Reconnecte-tu à tes rêves.', question: 'Qu\'est-ce qui te donne de l\'espoir ?' },
  { id: 18, name: 'La Lune', roman: 'XVIII', emoji: '🌛', archetype: 'Illusion, rêves, inconscient', upright: 'Tes rêves contiennent des messages. Écoute ton monde intérieur.', reversed: 'Les peurs se dissipent. La clarté revient.', question: 'Qu\'est-ce qui se cache derrière tes peurs ?' },
  { id: 19, name: 'Le Soleil', roman: 'XIX', emoji: '🌞', archetype: 'Joie, succès, vitalité', upright: 'La joie et le succès rayonnent. Brille pleinement aujourd\'hui.', reversed: 'Une ombre voile ton enthousiasme. Retrouve ta lumière.', question: 'Qu\'est-ce qui tu fait rayonner ?' },
  { id: 20, name: 'Le Jugement', roman: 'XX', emoji: '📯', archetype: 'Renaissance, appel, rédemption', upright: 'Un appel à toi élever. Réponds à ton vocation.', reversed: 'Un doute persiste. Pardonne-tu et avance.', question: 'Vers quoi êtes-tu appelé ?' },
  { id: 21, name: 'Le Monde', roman: 'XXI', emoji: '🌍', archetype: 'Achèvement, plénitude, accomplissement', upright: 'Un cycle s\'achève dans la plénitude. Célèbre ton parcours.', reversed: 'La finalité est proche mais pas atteinte. Persévère.', question: 'Qu\'est-ce qui s\'accomplit en toi ?' },
];
