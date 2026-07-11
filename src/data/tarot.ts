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
  { id: 0, name: 'Le Fou', roman: '0', emoji: '🃏', archetype: 'Liberté, commencement, spontanéité', upright: 'Un nouveau départ vous appelle. Osez le saut dans l\'inconnu avec confiance.', reversed: 'L\'impulsivité risque de vous égarer. Prenez un instant avant d\'agir.', question: 'Qu\'est-ce qui demande votre audace aujourd\'hui ?' },
  { id: 1, name: 'Le Bateleur', roman: 'I', emoji: '🎩', archetype: 'Créativité, habileté, initiative', upright: 'Vous avez tous les outils en main. Manifestez vos idées avec adresse.', reversed: 'Attention aux illusions ou aux demi-mesures. Soyez authentique.', question: 'Quel talent souhaitez-vous exprimer aujourd\'hui ?' },
  { id: 2, name: 'La Papesse', roman: 'II', emoji: '🌙', archetype: 'Intuition, savoir caché, mystère', upright: 'Écoutez votre voix intérieure. Les réponses sont en vous.', reversed: 'Vous ignorez votre sagesse. Prenez un moment de silence.', question: 'Qu\'est-ce que votre intuition vous murmure ?' },
  { id: 3, name: 'L\'Impératrice', roman: 'III', emoji: '👑', archetype: 'Fécondité, abondance, création', upright: 'La créativité coule. Donnez vie à vos projets avec joie.', reversed: 'Une étouffe ou un blocage créatif. Retrouvez votre flux.', question: 'Qu\'est-ce qui demande d\'être créé aujourd\'hui ?' },
  { id: 4, name: 'L\'Empereur', roman: 'IV', emoji: '🏛️', archetype: 'Autorité, structure, maîtrise', upright: 'C\'est le moment de prendre les rennes. Structurez vos ambitions.', reversed: 'Le contrôle devient rigidité. Assouplissez votre prise.', question: 'Où avez-vous besoin de poser un cadre ?' },
  { id: 5, name: 'Le Pape', roman: 'V', emoji: '🔑', archetype: 'Sagesse, enseignement, spiritualité', upright: 'Un guide ou un enseignement précieux croise votre chemin.', reversed: 'Remettez en question les croyances héritées. Trouvez votre propre voie.', question: 'Qu\'est-ce que vous apprenez en ce moment ?' },
  { id: 6, name: 'L\'Amoureux', roman: 'VI', emoji: '💕', archetype: 'Choix du cœur, union, dualité', upright: 'Un choix de cœur se présente. Suivez ce qui résonne vraiment.', reversed: 'Une indécision sentimentale. Clarifiez vos désirs profonds.', question: 'Quel choix du cœur se présente à vous ?' },
  { id: 7, name: 'Le Chariot', roman: 'VII', emoji: '⚔️', archetype: 'Victoire, volonté, maîtrise', upright: 'Votre détermination vous mène à la victoire. Avancez avec force.', reversed: 'L\'agitation vous disperse. Recentrez-vous sur un seul objectif.', question: 'Qu\'est-ce qui mérite votre pleine volonté ?' },
  { id: 8, name: 'La Justice', roman: 'VIII', emoji: '⚖️', archetype: 'Équilibre, vérité, justesse', upright: 'L\'équité prévaut. Vos actes justes portent leurs fruits.', reversed: 'Un déséquilibre à corriger. Soyez honnête avec vous-même.', question: 'Où l\'équilibre doit-il être rétabli ?' },
  { id: 9, name: 'L\'Ermite', roman: 'IX', emoji: '🏮', archetype: 'Introspection, retraite, lumière intérieure', upright: 'Retirez-vous un instant du bruit. Votre lumière intérieure guide.', reversed: 'L\'isolement devient repli. Restez connecté aux autres.', question: 'De quel silence avez-vous besoin aujourd\'hui ?' },
  { id: 10, name: 'La Roue de Fortune', roman: 'X', emoji: '🎡', archetype: 'Cycles, destin, changement', upright: 'La roue tourne en votre faveur. Saisissez l\'opportunité.', reversed: 'Un cycle se ferme. Acceptez le changement de phase.', question: 'Quel cycle se met en mouvement ?' },
  { id: 11, name: 'La Force', roman: 'XI', emoji: '🦁', archetype: 'Courage, douceur, maîtrise de soi', upright: 'Votre force intérieure dompte les obstacles. Avancez avec douceur.', reversed: 'Le doute affaiblit votre détermination. Retrouvez votre courage.', question: 'Où devez-vous faire preuve de douceur-force ?' },
  { id: 12, name: 'Le Pendu', roman: 'XII', emoji: '🙃', archetype: 'Lâcher prise, vision nouvelle, sacrifice', upright: 'Voir les choses sous un autre angle vous libère.', reversed: 'La stagnation vous frustre. Lâchez ce qui vous retient.', question: 'Qu\'est-ce qui mérite d\'être vu autrement ?' },
  { id: 13, name: 'L\'Arcane sans nom', roman: 'XIII', emoji: '🦋', archetype: 'Transformation, fin, renaissance', upright: 'Une transformation profonde est en cours. Accueillez le changement.', reversed: 'Vous résistez à une fin nécessaire. Laissez partir.', question: 'Qu\'est-ce qui doit mourir pour renaître ?' },
  { id: 14, name: 'Tempérance', roman: 'XIV', emoji: '🕊️', archetype: 'Harmonie, patience, alchimie', upright: 'Trouvez le juste milieu. L\'équilibre est votre allié.', reversed: 'L\'excès déséquilibre. Modérez vos excès.', question: 'Où avez-vous besoin de plus d\'équilibre ?' },
  { id: 15, name: 'Le Diable', roman: 'XV', emoji: '🔥', archetype: 'Désir, attachement, ombre', upright: 'Confrontez vos peurs et attachements. La lumière est plus forte.', reversed: 'Vous vous libérez d\'une chaîne. La libération est proche.', question: 'Qu\'est-ce qui vous enchaîne sans raison ?' },
  { id: 16, name: 'La Maison Dieu', roman: 'XVI', emoji: '⚡', archetype: 'Changement soudain, révélation, éclaircie', upright: 'Un éclair de vérité bouscule vos certitudes. Accueillez-le.', reversed: 'Vous évitez un changement nécessaire. Affrontez la tempête.', question: 'Qu\'est-ce qui se révèle brutalement aujourd\'hui ?' },
  { id: 17, name: 'L\'Étoile', roman: 'XVII', emoji: '⭐', archetype: 'Espoir, inspiration, guidance', upright: 'L\'espoir revient. Suivez votre étoile avec foi.', reversed: 'Le découragement voile votre lumière. Reconnectez-vous à vos rêves.', question: 'Qu\'est-ce qui vous donne de l\'espoir ?' },
  { id: 18, name: 'La Lune', roman: 'XVIII', emoji: '🌛', archetype: 'Illusion, rêves, inconscient', upright: 'Vos rêves contiennent des messages. Écoutez votre monde intérieur.', reversed: 'Les peurs se dissipent. La clarté revient.', question: 'Qu\'est-ce qui se cache derrière vos peurs ?' },
  { id: 19, name: 'Le Soleil', roman: 'XIX', emoji: '🌞', archetype: 'Joie, succès, vitalité', upright: 'La joie et le succès rayonnent. Brillez pleinement aujourd\'hui.', reversed: 'Une ombre voile votre enthousiasme. Retrouvez votre lumière.', question: 'Qu\'est-ce qui vous fait rayonner ?' },
  { id: 20, name: 'Le Jugement', roman: 'XX', emoji: '📯', archetype: 'Renaissance, appel, rédemption', upright: 'Un appel à vous élever. Répondez à votre vocation.', reversed: 'Un doute persiste. Pardonnez-vous et avancez.', question: 'Vers quoi êtes-vous appelé ?' },
  { id: 21, name: 'Le Monde', roman: 'XXI', emoji: '🌍', archetype: 'Achèvement, plénitude, accomplissement', upright: 'Un cycle s\'achève dans la plénitude. Célébrez votre parcours.', reversed: 'La finalité est proche mais pas atteinte. Persévérez.', question: 'Qu\'est-ce qui s\'accomplit en vous ?' },
];
