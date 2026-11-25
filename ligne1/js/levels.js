"use strict";
/* Les 20 niveaux. Chaque niveau mélange process, matériel et sécurité. */
(() => {
window.TARGETS = window.TARGETS || {};
const seq = (str, base = {}) => [...str].map(ch => {
  const o = Object.assign({ kind: "piece", color: "blue" }, base);
  if (ch === "r") o.color = "red";
  if (ch === "m") { o.metal = true; o.color = "grey"; }
  if (ch === "p") { o.metal = false; o.color = "orange"; }
  if (ch === "d") o.defect = true;
  if (ch === "c") o.kind = "carton";
  if (ch === "B") o.kind = "bottle";
  return o;
});
const LAMPS = [["lamp", { id: "vert", color: "green", label: "Voyant vert : en cycle" }], ["lamp", { id: "rouge", color: "red", label: "Voyant rouge : défaut" }]];
const GREEN = [["lamp", { id: "vert", color: "green", label: "Voyant vert : en cycle" }]];
const ACC = {
  blue: p => p.color === "red" ? "Une pièce rouge est partie chez le client !" : null,
  red: p => p.color !== "red" ? "Une bonne pièce (bleue) est partie au rebut." : null,
  cuit: p => p.ko ? `Pièce ${p.ko} livrée au client !` : !p.q.cuit ? "Pièce pas cuite livrée au client !" : null,
  bottle: p => p.ko ? `Bouteille ${p.ko}.` : p.fill < 0.9 ? "Bouteille pas assez remplie livrée au client." : null,
  bottleLab: p => p.ko ? `Bouteille ${p.ko}.` : p.fill < 0.9 ? "Bouteille pas assez remplie livrée." : !p.q.label ? "Bouteille sans étiquette livrée." : null,
  good: p => p.defect ? "Une pièce défectueuse est partie chez le client !" : null,
  bad: p => !p.defect ? "Une bonne pièce est partie au rebut." : null,
  drilled: p => p.defect ? "Une pièce défectueuse est partie chez le client !" : (p.q.drill || 0) < 0.78 ? "Une pièce pas percée est partie chez le client !" : null,
  badDrill: p => !p.defect ? ((p.q.drill || 0) < 0.78 ? "Une pièce saine mais pas percée est partie au rebut." : "Une bonne pièce est partie au rebut.") : null,
  metal: p => !p.metal ? "Une pièce plastique est tombée dans le bac métal." : null,
  plast: p => p.metal ? "Une pièce métal est tombée dans le bac plastique." : null,
  labeled: p => p.ko ? `Pièce : ${p.ko}.` : !p.q.label ? "Pièce sans étiquette livrée." : null
};

const L = [];

L.push({ title: "Le premier carton", hall: "Hall 1",
  client: "Un carton arrive sur le tapis. Le client veut qu'on appuie <b>une fois</b> sur Marche, puis qu'on lâche : le tapis démarre et s'arrête tout seul quand le carton arrive sous la barrière.",
  goals: ["Marche démarre le tapis, et il continue quand on relâche le bouton.", "La barrière arrête le tapis : le carton ne doit pas tomber.", "Arrêt coupe le tapis à tout moment."],
  hint: "Auto-maintien : sur le barreau du moteur, mets le moteur lui-même en parallèle de Marche, puis Arrêt et la barrière en contacts NF, en série.",
  goal: { stopAt: { sensor: "b1", conv: "c1", t: 2 } }, tmax: 60,
  build: () => [["conv", { id: "c1", x1: 60, x2: 900, y: 300, speed: 150, end: "fall", label: "Moteur tapis" }], ["feed", { id: "f1", conv: "c1", x: 100, seq: seq("c") }], ["sens", { id: "b1", conv: "c1", x: 780, label: "Barrière fin de tapis" }]]
});

L.push({ title: "La cadence", hall: "Hall 1", greenRule: true,
  client: "Un opérateur prend chaque carton arrêté sous la barrière. Le client veut 5 cartons, avec <b>un seul appui sur Marche</b> au début, et un voyant vert allumé quand la ligne est en cycle. Le chef d'équipe va tester ton bouton Arrêt.",
  goals: ["5 cartons expédiés.", "Le tapis repart tout seul quand l'opérateur a pris le carton.", "Après Arrêt, rien ne repart avant le prochain Marche.", "Voyant vert allumé quand le tapis tourne."],
  hint: "Garde « cycle en marche » dans une mémoire M (Marche ∥ M, puis Arrêt NF). Le moteur = la mémoire ET pas de carton sous la barrière.",
  goal: { bins: { exp: 5 } }, tmax: 90, events: [{ kind: "stop", after: 2 }],
  build: () => [["conv", { id: "c1", x1: 60, x2: 900, y: 300, speed: 150, end: "fall", label: "Moteur tapis" }], ["feed", { id: "f1", conv: "c1", x: 100, seq: seq("ccccc") }],
    ["sens", { id: "b1", conv: "c1", x: 780, label: "Barrière fin de tapis" }], ["pick", { id: "op", conv: "c1", x: 780, bin: "exp", side: 1 }], ["bin", { id: "exp", label: "Expédition", x: 780, y: 460, w: 110 }], ...GREEN]
});

L.push({ title: "Coup de poing", hall: "Hall 1", rearm: true, au: true, greenRule: true,
  client: "On ajoute un arrêt d'urgence, câblé en contact NF comme il se doit (1 = tout va bien), et un bouton de réarmement. Quand l'AU est enfoncé, tout s'arrête et le voyant rouge s'allume. Après déverrouillage, on réarme, puis on relance avec Marche.",
  goals: ["6 cartons expédiés.", "AU : le tapis s'arrête immédiatement, voyant rouge allumé.", "Rien ne repart avant Réarmement puis Marche.", "Le réarmement éteint le voyant rouge."],
  hint: "Mémoire de défaut : AU NF → (S) M1.0, Réarmement ET AU → (R) M1.0. Ta mémoire de cycle ne peut s'activer que si M1.0 est à 0.",
  goal: { bins: { exp: 6 } }, tmax: 120, events: [{ kind: "au", after: 2 }, { kind: "stop", after: 4 }],
  build: () => [["conv", { id: "c1", x1: 60, x2: 900, y: 300, speed: 150, end: "fall", label: "Moteur tapis" }], ["feed", { id: "f1", conv: "c1", x: 100, seq: seq("cccccc") }],
    ["sens", { id: "b1", conv: "c1", x: 780, label: "Barrière fin de tapis" }], ["pick", { id: "op", conv: "c1", x: 780, bin: "exp", side: 1 }], ["bin", { id: "exp", label: "Expédition", x: 780, y: 460, w: 110 }], ...LAMPS]
});

L.push({ title: "Le tri couleur", hall: "Hall 1", rearm: true, au: true,
  client: "Les pièces rouges sont des rebuts. Un capteur couleur et un vérin éjecteur les envoient dans le bac rebut, les bleues continuent jusqu'à l'opérateur. Et l'AU peut tomber n'importe quand.",
  goals: ["5 bleues expédiées, 3 rouges au rebut.", "Le vérin ne sort que pour une rouge, et le tapis attend qu'il soit rentré.", "AU : tout s'arrête, y compris le vérin."],
  hint: "Mémorise « éjection en cours » (S) quand présence ET rouge. Le vérin sort tant que cette mémoire est là ET que le cycle tourne ; « éjecteur sorti » la remet à 0. Le tapis attend « éjecteur rentré ».",
  goal: { bins: { bon: 5, rebut: 3 } }, tmax: 150, events: [{ kind: "au", after: 3 }],
  build: () => [["conv", { id: "c1", x1: 60, x2: 900, y: 300, speed: 140, end: "fall", label: "Moteur tapis" }], ["feed", { id: "f1", conv: "c1", x: 100, seq: seq("bbrbrbrb") }],
    ["sens", { id: "b1", conv: "c1", x: 480, label: "Présence poste de tri", tdx: -34 }], ["sens", { id: "col", conv: "c1", x: 480, kind: "red", label: "Capteur couleur : rouge", tdx: 34 }],
    ["push", { id: "e1", conv: "c1", x: 480, side: -1, bin: "rebut" }], ["bin", { id: "rebut", label: "Rebut", x: 480, y: 160, accept: ACC.red }],
    ["sens", { id: "b2", conv: "c1", x: 820, label: "Barrière fin de tapis" }], ["pick", { id: "op", conv: "c1", x: 820, bin: "bon", side: 1 }], ["bin", { id: "bon", label: "Expédition", x: 820, y: 460, w: 110, accept: ACC.blue }], ...LAMPS]
});

L.push({ title: "Le four", hall: "Hall 1", rearm: true,
  client: "Les pièces traversent un four. Elles doivent y passer entre 180 et 230 °C, sinon elles sont mal cuites ou brûlées. À toi de réguler les résistances avec les thermostats, et de ne faire avancer le tapis que quand le four est prêt. Un opérateur va ouvrir la porte du carter.",
  goals: ["6 pièces bien cuites expédiées.", "Four toujours entre 180 et 230 °C quand une pièce est dedans.", "Porte ouverte : le tapis s'arrête (la chauffe peut continuer).", "Au-delà de 260 °C le four se met en sécurité."],
  hint: "Régulation tout ou rien : (S) chauffe quand T < 180, (R) chauffe quand T ≥ 200. Cette régulation doit tourner même quand le cycle est arrêté.",
  goal: { bins: { bon: 6 } }, tmax: 150, events: [{ kind: "door", after: 3 }],
  build: () => [["door", { id: "porte", rect: [290, 190, 320, 220], label: "Porte carter four fermée" }], ["conv", { id: "c1", x1: 60, x2: 900, y: 300, speed: 110, end: "fall", label: "Moteur tapis" }],
    ["feed", { id: "f1", conv: "c1", x: 100, seq: seq("pppppp"), delay: 1.4 }], ["oven", { id: "four", conv: "c1", x1: 330, x2: 570 }],
    ["sens", { id: "b1", conv: "c1", x: 820, label: "Barrière fin de tapis" }], ["pick", { id: "op", conv: "c1", x: 820, bin: "bon", side: 1 }], ["bin", { id: "bon", label: "Expédition", x: 820, y: 460, w: 110, accept: ACC.cuit }], ...LAMPS]
});

L.push({ title: "Le remplissage", hall: "Hall 2", rearm: true, au: true,
  client: "Des bouteilles passent sous un bec de remplissage. Il faut s'arrêter pile dessous, ouvrir la vanne jusqu'au niveau, puis laisser égoutter 1 seconde avant de repartir, sinon ça coule sur l'étiquette. Porte et AU sont surveillés.",
  goals: ["6 bouteilles pleines expédiées.", "Jamais de vanne ouverte sans bouteille dessous.", "1 s d'égouttage après la fermeture de la vanne.", "Porte ou AU : tout s'arrête."],
  hint: "Une mémoire « bouteille remplie » mise à 1 par une tempo d'égouttage (TON 1 s sur « bouteille pleine »), remise à 0 quand la bouteille a quitté le bec. Le tapis tourne si pas de bouteille au bec OU bouteille remplie.",
  goal: { bins: { exp: 6 } }, tmax: 150, events: [{ kind: "door", after: 2 }, { kind: "au", after: 4 }],
  build: () => [["door", { id: "porte", rect: [400, 180, 200, 240], label: "Porte remplisseuse fermée" }], ["conv", { id: "c1", x1: 60, x2: 900, y: 300, speed: 120, end: "fall", label: "Moteur tapis" }],
    ["feed", { id: "f1", conv: "c1", x: 100, seq: seq("BBBBBB"), delay: 1.5 }], ["fill", { id: "f1v", conv: "c1", x: 480 }], ["sens", { id: "b1", conv: "c1", x: 494, label: "Bouteille sous le bec", side: 1 }],
    ["sens", { id: "b2", conv: "c1", x: 820, label: "Barrière fin de tapis" }], ["pick", { id: "op", conv: "c1", x: 820, bin: "exp", side: 1 }], ["bin", { id: "exp", label: "Expédition", x: 820, y: 460, w: 110, accept: ACC.bottle }], ...LAMPS]
});

L.push({ title: "La mise en carton", hall: "Hall 2", rearm: true, au: true,
  client: "Les pièces tombent en bout de tapis dans un carton de 6. Quand il est plein, on l'évacue et on attend le suivant. Le moteur du tapis est protégé par un disjoncteur qui peut déclencher.",
  goals: ["3 cartons de 6 expédiés.", "Jamais de pièce à côté du carton, jamais 7 dans un carton.", "Disjoncteur déclenché : défaut, tout s'arrête, réarmement.", "AU : tout s'arrête."],
  hint: "Compteur CTU sur la barrière de comptage (préréglage 6). Quand il est atteint, laisse 0,5 s à la 6e pièce pour tomber (TON), arrête le tapis et évacue. Remets le compteur à 0 quand le carton n'est plus là.",
  goal: { boxer: { bx: 3 } }, tmax: 180, events: [{ kind: "thermal", target: "c1", after: 7 }, { kind: "au", after: 13 }],
  build: () => [["conv", { id: "c1", x1: 60, x2: 880, y: 300, speed: 120, end: { boxer: "bx" }, thermal: true, label: "Moteur tapis" }], ["feed", { id: "f1", conv: "c1", x: 100, seq: seq("bbbbbbbbbbbbbbbbbb"), delay: 1.2, gap: 170 }],
    ["sens", { id: "b1", conv: "c1", x: 860, label: "Barrière de comptage" }], ["boxer", { id: "bx", x: 925, y: 300, cap: 6 }], ...LAMPS]
});

L.push({ title: "Le bol vibrant", hall: "Hall 2", rearm: true, au: true,
  client: "Un bol vibrant aligne les pièces sur un rail. Un échappement les lâche une par une sur le tapis. Si le vibreur pousse sur un rail plein, ça bourre. Si le bol se vide, la trémie le remplit. Et si tu lâches une pièce sur une autre, c'est l'empilement.",
  goals: ["12 pièces expédiées.", "Vibreur coupé quand le rail est plein.", "Trémie quand le niveau du bol est bas.", "Échappement seulement si la zone de dépose est libre."],
  hint: "L'échappement réagit à un front montant : fais-lui une impulsion avec une tempo courte (pièce prête ET zone libre pendant 0,3 s → sortie échappement).",
  goal: { bins: { exp: 12 } }, tmax: 180, events: [{ kind: "au", after: 5 }],
  build: () => [["conv", { id: "c1", x1: 300, x2: 900, y: 300, speed: 140, end: "fall", label: "Moteur tapis" }], ["bowl", { id: "bol", x: 140, y: 300, conv: "c1", dropX: 330, seq: seq("bbbbbbbbbbbb"), cnt: 5 }],
    ["sens", { id: "z1", conv: "c1", x: 330, kind: "zone", label: "Zone de dépose occupée", tdx: 30 }], ["sens", { id: "b1", conv: "c1", x: 820, label: "Barrière fin de tapis" }],
    ["pick", { id: "op", conv: "c1", x: 820, bin: "exp", side: 1, delay: 1.3 }], ["bin", { id: "exp", label: "Expédition", x: 820, y: 460, w: 110 }], ...LAMPS]
});

L.push({ title: "L'axe de transfert", hall: "Hall 2", rearm: true, au: true,
  client: "Un axe électrique avec vérin Z et pince trie les pièces : métal à gauche, plastique à droite. Il a des positions programmées dans son variateur, mais il refuse de bouger tant qu'il n'a pas fait sa prise d'origine. S'il bouge avec le Z en bas, c'est la casse.",
  goals: ["3 pièces métal et 3 plastique dans le bon bac.", "Prise d'origine avant tout.", "L'axe ne bouge qu'avec le Z en haut.", "Porte ou AU : l'axe s'arrête (Z et pince gardent leur état)."],
  hint: "Fais-le en étapes, comme un Grafcet : une mémoire par étape (aller prendre, descendre, fermer, monter, aller déposer, descendre, ouvrir, monter). Chaque transition : (S) étape suivante puis (R) étape en cours. Mémorise « métal » au moment de la prise.",
  goal: { bins: { bm: 3, bp: 3 } }, tmax: 200, events: [{ kind: "door", after: 2 }, { kind: "au", after: 4 }],
  build: () => [["door", { id: "porte", rect: [440, 200, 580, 280], label: "Porte zone axe fermée" }], ["conv", { id: "c1", x1: 60, x2: 520, y: 340, speed: 120, end: "block", label: "Moteur tapis" }],
    ["feed", { id: "f1", conv: "c1", x: 100, seq: seq("mppmpm"), delay: 1 }], ["sens", { id: "b1", conv: "c1", x: 503, label: "Pièce en bout de tapis", tdx: -30 }], ["sens", { id: "ind", conv: "c1", x: 503, kind: "metal", side: 1, label: "Capteur inductif : métal", tdx: -40 }],
    ["axis", { id: "ax", y: 340, x1: 470, x2: 1000, origin: 990, start: 760, pos: [{ x: 503, label: "prise", pick: "c1" }, { x: 700, label: "bac métal", place: "bm" }, { x: 860, label: "bac plastique", place: "bp" }] }],
    ["bin", { id: "bm", label: "Métal", x: 700, y: 340, w: 70, h: 56, accept: ACC.metal }], ["bin", { id: "bp", label: "Plastique", x: 860, y: 340, w: 70, h: 56, accept: ACC.plast }], ...LAMPS]
});

L.push({ title: "La presse", hall: "Hall 2", rearm: true, au: true,
  client: "Presse à commande bimanuelle : elle ne descend que si l'opérateur appuie sur les deux boutons à moins de 0,5 s d'écart, et remonte dès qu'il lâche une main. L'emboutissage demande 1 s en bas. Méfie-toi : l'opérateur a de l'imagination.",
  goals: ["5 pièces embouties (1 s en bas) expédiées.", "Descente seulement avec les deux mains synchronisées.", "Une main lâchée : la presse remonte.", "La butée ne libère la pièce que presse en haut."],
  hint: "Deux tempos de 0,5 s : « gauche sans droite » et « droite sans gauche ». Si l'une arrive au bout, mémorise un défaut de synchro jusqu'à ce que les deux mains soient relâchées.",
  goal: { bins: { exp: 5 } }, tmax: 200, events: [{ kind: "au", after: 3 }],
  build: () => [["conv", { id: "c1", x1: 60, x2: 900, y: 300, speed: 120, end: "fall", label: "Moteur tapis" }], ["feed", { id: "f1", conv: "c1", x: 100, seq: seq("bbbbb"), delay: 1 }],
    ["stop", { id: "st1", conv: "c1", x: 497, label: "Butée presse : lever", tdy: -40 }], ["sens", { id: "b1", conv: "c1", x: 494, label: "Pièce sous presse", side: 1, tdx: 60 }],
    ["tool", { id: "pr", conv: "c1", x: 480, kind: "press", name: "Presse", lDown: "Presse : descendre", lUp: "Presse en haut", lBas: "Presse en bas" }],
    ["bim", { id: "bim", tool: "pr", patterns: ["ok", "async", "ok", "release", "ok", "ok", "ok", "ok"] }],
    ["sens", { id: "b2", conv: "c1", x: 820, label: "Barrière fin de tapis" }], ["pick", { id: "op", conv: "c1", x: 820, bin: "exp", side: 1 }],
    ["bin", { id: "exp", label: "Expédition", x: 820, y: 460, w: 110, accept: p => (p.q.press || 0) < 0.98 ? "Pièce pas emboutie (moins d'1 s en bas) livrée au client." : null }], ...LAMPS]
});

L.push({ title: "La cellule robot", hall: "Hall 3", rearm: true, au: true,
  client: "Une caméra contrôle chaque pièce en bout de tapis, puis un robot la range : programme A vers les bonnes, programme B vers le rebut. Dialogue robot classique : programme, départ cycle, fin de cycle. Le robot gère sa propre sécurité, mais ton tapis ne doit jamais bouger quand il est dans la zone.",
  goals: ["5 bonnes et 2 défectueuses bien rangées.", "Caméra déclenchée sur une pièce immobile.", "Un seul programme au départ cycle, départ cycle remis à 0 après la fin de cycle.", "Tapis arrêté tant que le robot n'est pas hors zone."],
  hint: "Attends 0,3 s de pièce présente avant de déclencher la caméra (sinon image floue). Mémorise le résultat, choisis A ou B, mets départ cycle à 1, et remets-le à 0 sur « fin de cycle ».",
  goal: { bins: { bon: 5, rebut: 2 } }, tmax: 200, events: [{ kind: "door", after: 2 }, { kind: "au", after: 5 }],
  build: () => [["door", { id: "porte", rect: [500, 100, 500, 390], label: "Porte cellule robot fermée" }], ["conv", { id: "c1", x1: 60, x2: 470, y: 420, speed: 120, end: "block", label: "Moteur tapis" }],
    ["feed", { id: "f1", conv: "c1", x: 100, seq: seq("bbdbbdb"), delay: 1 }], ["sens", { id: "b1", conv: "c1", x: 453, label: "Pièce en position de prise", side: 1 }], ["cam", { id: "cam", conv: "c1", x: 453 }],
    ["robot", { id: "rb", bx: 660, by: 250, pick: { conv: "c1", x: 453 }, A: "bon", B: "rebut" }],
    ["bin", { id: "bon", label: "Bonnes", x: 880, y: 420, accept: ACC.good }], ["bin", { id: "rebut", label: "Rebut", x: 880, y: 170, accept: ACC.bad }], ...LAMPS]
});

L.push({ title: "Perçage et contrôle", hall: "Hall 3", rearm: true, au: true,
  client: "Deux postes sur le même tapis, chacun avec sa butée. Poste 1 : perçage (la broche doit tourner avant d'entrer dans la pièce). Poste 2 : un palpeur mesure la cote. Les pièces mauvaises sont éjectées plus loin, il faut donc se souvenir du résultat pendant le transfert. Le disjoncteur de la broche est capricieux.",
  goals: ["5 pièces percées et bonnes expédiées, 2 défectueuses au rebut.", "Broche en rotation avant la descente.", "Résultat du palpeur mémorisé jusqu'à l'éjecteur.", "Disjoncteur broche ou AU : tout s'arrête."],
  hint: "Une seule pièce à la fois entre le palpeur et l'éjecteur : ne libère la butée 2 que si la zone de transfert est vide, et mémorise « mauvaise » au moment où tu la libères.",
  goal: { bins: { bon: 5, rebut: 2 } }, tmax: 240, events: [{ kind: "thermal", target: "dr", after: 2 }, { kind: "au", after: 4 }],
  build: () => [["conv", { id: "c1", x1: 60, x2: 920, y: 300, speed: 110, end: "fall", label: "Moteur tapis" }], ["feed", { id: "f1", conv: "c1", x: 100, seq: seq("bbbdbbd"), delay: 1 }],
    ["stop", { id: "st1", conv: "c1", x: 317, label: "Butée perçage : lever", tdy: -40 }], ["sens", { id: "b1", conv: "c1", x: 314, label: "Pièce au poste perçage", side: 1, tdy: 30 }],
    ["tool", { id: "dr", conv: "c1", x: 300, kind: "drill", thermal: true, name: "Perceuse", lDown: "Perceuse : descendre", lUp: "Perceuse en haut", lBas: "Perceuse en bas" }],
    ["stop", { id: "st2", conv: "c1", x: 537, label: "Butée contrôle : lever", tdy: -40 }], ["sens", { id: "b2", conv: "c1", x: 534, label: "Pièce au poste contrôle", side: 1, tdy: 30 }],
    ["tool", { id: "pb", conv: "c1", x: 520, kind: "probe", name: "Palpeur", lDown: "Palpeur : descendre", lUp: "Palpeur en haut", lBas: "Palpeur en bas" }],
    ["sens", { id: "b3", conv: "c1", x: 700, label: "Présence poste éjection", tdx: -36 }], ["push", { id: "ej", conv: "c1", x: 700, side: 1, bin: "rebut" }], ["bin", { id: "rebut", label: "Rebut", x: 700, y: 450, accept: ACC.badDrill }],
    ["sens", { id: "b4", conv: "c1", x: 860, label: "Barrière fin de tapis", side: 1 }], ["pick", { id: "op", conv: "c1", x: 860, bin: "bon", side: -1 }], ["bin", { id: "bon", label: "Expédition", x: 860, y: 150, w: 110, accept: ACC.drilled }], ...LAMPS]
});

L.push({ title: "Ligne double", hall: "Hall 3", rearm: true, au: true,
  client: "Bol vibrant, puis deux tapis à des vitesses différentes. Sur le second, une étiqueteuse demande une impulsion entre 0,15 et 0,8 s sur une pièce immobile. Le moteur du tapis 2 a un disjoncteur.",
  goals: ["8 pièces étiquetées expédiées.", "Bol : pas de bourrage, pas d'empilement.", "Étiquette : impulsion entre 0,15 et 0,8 s.", "Disjoncteur tapis 2 ou AU : tout s'arrête."],
  hint: "L'étiqueteuse : TON 0,3 s de pièce présente, puis une impulsion faite avec une deuxième tempo de 0,4 s, puis mémoire « étiquetée » qui libère la butée.",
  goal: { bins: { exp: 8 } }, tmax: 220, events: [{ kind: "thermal", target: "c2", after: 3 }, { kind: "au", after: 6 }],
  build: () => [["conv", { id: "c1", x1: 300, x2: 560, y: 220, speed: 140, end: { to: "c2" }, label: "Moteur tapis 1" }], ["conv", { id: "c2", x1: 560, x2: 930, y: 220, speed: 90, end: "fall", thermal: true, thLabel: "Disjoncteur tapis 2 OK", label: "Moteur tapis 2" }],
    ["bowl", { id: "bol", x: 130, y: 220, conv: "c1", dropX: 330, seq: seq("bbbbbbbb"), cnt: 5 }], ["sens", { id: "z1", conv: "c1", x: 330, kind: "zone", label: "Zone de dépose occupée", tdx: 30 }],
    ["stop", { id: "st", conv: "c2", x: 777, label: "Butée étiqueteuse : lever", tdy: -4 }], ["sens", { id: "b2", conv: "c2", x: 774, label: "Pièce sous l'étiqueteuse", tdx: -50 }], ["label", { id: "lab", conv: "c2", x: 760 }],
    ["sens", { id: "b3", conv: "c2", x: 880, label: "Barrière fin de tapis 2" }], ["pick", { id: "op", conv: "c2", x: 880, bin: "exp", side: 1 }], ["bin", { id: "exp", label: "Expédition", x: 880, y: 400, w: 110, accept: ACC.labeled }], ...LAMPS]
});

L.push({ title: "La cuve", hall: "Hall 3", rearm: true, au: true,
  client: "Les bouteilles se remplissent depuis une cuve. Le produit doit être mélangé (3 s d'agitation après le dernier ajout) et entre 60 et 70 °C. Quand on remplit la cuve, le produit froid casse la température et le mélange. Agitateur et chauffe à sec sont interdits, débordement aussi.",
  goals: ["8 bouteilles conformes expédiées.", "Ne remplir les bouteilles qu'avec un produit prêt.", "Gérer le niveau de la cuve (pompe) sans déborder.", "Pas d'agitation ni de chauffe sous le niveau bas."],
  hint: "Produit prêt = agitateur en marche ET pompe arrêtée depuis 3 s (TON) ET T ≥ 60 °C. Pompe : (S) sous le niveau bas, (R) au niveau haut.",
  goal: { bins: { exp: 8 } }, tmax: 240, events: [{ kind: "au", after: 4 }],
  build: () => [["tank", { id: "tk", x: 170, y: 250 }], ["conv", { id: "c1", x1: 320, x2: 920, y: 420, speed: 120, end: "fall", label: "Moteur tapis" }],
    ["feed", { id: "f1", conv: "c1", x: 360, seq: seq("BBBBBBBB"), delay: 1.2 }], ["fill", { id: "f1v", conv: "c1", x: 560, tank: "tk" }], ["stop", { id: "st", conv: "c1", x: 577, label: "Butée remplissage : lever", tdx: 60 }],
    ["sens", { id: "b1", conv: "c1", x: 574, label: "Bouteille sous le bec", side: 1 }], ["sens", { id: "b2", conv: "c1", x: 860, label: "Barrière fin de tapis", side: 1 }],
    ["pick", { id: "op", conv: "c1", x: 860, bin: "exp", side: -1 }], ["bin", { id: "exp", label: "Expédition", x: 860, y: 270, w: 110, accept: ACC.bottle }], ...LAMPS]
});

L.push({ title: "Capteur en panne", hall: "Hall 4", rearm: true, au: true,
  client: "Bol, tapis, tri couleur. Sauf qu'en cours de production le capteur « éjecteur sorti » va lâcher. Si ta machine attend ce capteur sans rien dire, elle reste bloquée pour toujours. Il faut une surveillance : au-delà de 1,5 s sans le capteur, défaut.",
  goals: ["6 bleues expédiées, 4 rouges au rebut.", "Détecter la panne capteur en moins de 3 s : défaut, tout s'arrête.", "Après réparation + réarmement + Marche, l'éjection reprend.", "Porte de sécurité surveillée."],
  hint: "Une tempo de surveillance sur « éjection en cours ET cycle » : si elle arrive au bout, (S) défaut. Comme le cycle tombe, la tempo se remet à 0 toute seule.",
  goal: { bins: { bon: 6, rebut: 4 } }, tmax: 240, events: [{ kind: "sensor", target: "e1", after: 3 }, { kind: "door", after: 7 }],
  build: () => [["door", { id: "porte", rect: [470, 110, 200, 300], label: "Porte poste de tri fermée" }], ["conv", { id: "c1", x1: 300, x2: 900, y: 300, speed: 140, end: "fall", label: "Moteur tapis" }],
    ["bowl", { id: "bol", x: 140, y: 300, conv: "c1", dropX: 330, seq: seq("brbrbbrbrb"), cnt: 5 }], ["sens", { id: "z1", conv: "c1", x: 330, kind: "zone", label: "Zone de dépose occupée", tdx: 30 }],
    ["sens", { id: "b1", conv: "c1", x: 560, label: "Présence poste de tri", tdx: -34 }], ["sens", { id: "col", conv: "c1", x: 560, kind: "red", label: "Capteur couleur : rouge", tdx: 34 }],
    ["push", { id: "e1", conv: "c1", x: 560, side: -1, bin: "rebut" }], ["bin", { id: "rebut", label: "Rebut", x: 560, y: 160, accept: ACC.red }],
    ["sens", { id: "b2", conv: "c1", x: 820, label: "Barrière fin de tapis" }], ["pick", { id: "op", conv: "c1", x: 820, bin: "bon", side: 1 }], ["bin", { id: "bon", label: "Expédition", x: 820, y: 460, w: 110, accept: ACC.blue }], ...LAMPS]
});

L.push({ title: "Le palettiseur", hall: "Hall 4", rearm: true, au: true,
  client: "L'axe prend les cartons en bout de tapis et les pose sur une palette à 3 emplacements, deux couches. Il faut tourner d'un emplacement à l'autre, compter, évacuer la palette pleine et attendre la suivante.",
  goals: ["2 palettes complètes (6 cartons chacune).", "Jamais 3 cartons sur le même emplacement.", "Attendre la palette avant de déposer.", "Porte ou AU : l'axe s'arrête."],
  hint: "Un anneau de 3 mémoires (A, B, C) qui tourne sur le front montant de l'étape « dépose faite » (contact ↑). Un CTU à 6 déclenche l'évacuation ; remets-le à 0 quand la palette n'est plus là.",
  goal: { pallet: { pal: 2 } }, tmax: 300, events: [{ kind: "door", after: 3 }, { kind: "au", after: 8 }],
  build: () => [["door", { id: "porte", rect: [430, 200, 590, 290], label: "Porte zone palettiseur fermée" }], ["conv", { id: "c1", x1: 60, x2: 480, y: 340, speed: 120, end: "block", label: "Moteur tapis" }],
    ["feed", { id: "f1", conv: "c1", x: 100, seq: seq("cccccccccccc"), delay: 0.8 }], ["sens", { id: "b1", conv: "c1", x: 463, label: "Carton en bout de tapis", tdx: -30 }],
    ["pallet", { id: "pal", y: 340, slots: [640, 740, 840], cap: 2 }],
    ["axis", { id: "ax", y: 340, x1: 430, x2: 1010, origin: 990, start: 700, pos: [{ x: 463, label: "prise", pick: "c1" }, { x: 640, label: "emplacement A", place: "pal" }, { x: 740, label: "emplacement B", place: "pal" }, { x: 840, label: "emplacement C", place: "pal" }] }], ...LAMPS]
});

L.push({ title: "Atelier A : four et tri", hall: "Hall 4", rearm: true, au: true,
  client: "Bol vibrant, tapis qui traverse un four, puis l'axe trie métal et plastique en bout de tapis. Tout ce que tu as appris, en même temps. Les pièces doivent être cuites ET triées.",
  goals: ["4 métal et 4 plastique cuites, dans le bon bac.", "Four régulé, tapis seulement quand le four est prêt.", "Bol sans bourrage ni empilement.", "Axe référencé, jamais de mouvement Z en bas ; porte et AU surveillés."],
  hint: "Reprends tes barreaux des niveaux bol, four et axe. Le tapis peut tourner en continu : il s'arrête tout seul au bout, les pièces s'accumulent… dans le four, qui doit donc rester régulé.",
  goal: { bins: { bm: 4, bp: 4 } }, tmax: 300, events: [{ kind: "door", after: 2 }, { kind: "au", after: 5 }],
  build: () => [["door", { id: "porte", rect: [560, 110, 470, 230], label: "Porte zone axe fermée" }], ["conv", { id: "c1", x1: 300, x2: 620, y: 220, speed: 100, end: "block", label: "Moteur tapis" }],
    ["bowl", { id: "bol", x: 130, y: 220, conv: "c1", dropX: 330, seq: seq("mppmmpmp"), cnt: 5 }], ["sens", { id: "z1", conv: "c1", x: 330, kind: "zone", label: "Zone de dépose occupée", side: 1, tdx: 30 }], ["oven", { id: "four", conv: "c1", x1: 380, x2: 545 }],
    ["sens", { id: "b1", conv: "c1", x: 603, label: "Pièce en bout de tapis", side: 1, tdx: -50, tdy: 40 }], ["sens", { id: "ind", conv: "c1", x: 603, kind: "metal", side: 1, label: "Capteur inductif : métal", tdx: 10, tdy: 40 }],
    ["axis", { id: "ax", y: 220, x1: 570, x2: 1020, origin: 1000, start: 800, pos: [{ x: 603, label: "prise", pick: "c1" }, { x: 780, label: "bac métal", place: "bm" }, { x: 920, label: "bac plastique", place: "bp" }] }],
    ["bin", { id: "bm", label: "Métal", x: 780, y: 220, w: 70, h: 56, accept: p => ACC.metal(p) || ACC.cuit(p) }], ["bin", { id: "bp", label: "Plastique", x: 920, y: 220, w: 70, h: 56, accept: p => ACC.plast(p) || ACC.cuit(p) }], ...LAMPS]
});

L.push({ title: "Atelier B : perçage et robot", hall: "Hall 4", rearm: true, au: true,
  client: "Perçage sur butée, puis caméra et robot en bout de tapis. La caméra refuse les pièces pas percées. Disjoncteur broche, porte de la cellule et AU sont surveillés.",
  goals: ["5 bonnes pièces percées rangées, 2 défectueuses au rebut.", "Broche avant descente, 0,8 s de perçage.", "Dialogue robot propre, tapis arrêté quand le robot est en zone.", "Toutes les sécurités surveillées."],
  hint: "Le robot impose l'arrêt du tapis… et donc du transfert depuis le poste de perçage. Ce n'est pas grave : la butée garde la pièce sur la perceuse.",
  goal: { bins: { bon: 5, rebut: 2 } }, tmax: 300, events: [{ kind: "thermal", target: "dr", after: 2 }, { kind: "door", after: 4 }],
  build: () => [["door", { id: "porte", rect: [560, 80, 460, 420], label: "Porte cellule robot fermée" }], ["conv", { id: "c1", x1: 60, x2: 520, y: 420, speed: 110, end: "block", label: "Moteur tapis" }],
    ["feed", { id: "f1", conv: "c1", x: 100, seq: seq("bdbbbdb"), delay: 1 }],
    ["stop", { id: "st1", conv: "c1", x: 277, label: "Butée perçage : lever", tdy: -40 }], ["sens", { id: "b1", conv: "c1", x: 274, label: "Pièce au poste perçage", side: 1, tdy: 30 }],
    ["tool", { id: "dr", conv: "c1", x: 260, kind: "drill", thermal: true, name: "Perceuse", lDown: "Perceuse : descendre", lUp: "Perceuse en haut", lBas: "Perceuse en bas" }],
    ["sens", { id: "b2", conv: "c1", x: 503, label: "Pièce en position de prise", side: 1 }], ["cam", { id: "cam", conv: "c1", x: 503, needDrill: true }],
    ["robot", { id: "rb", bx: 720, by: 260, pick: { conv: "c1", x: 503 }, A: "bon", B: "rebut" }],
    ["bin", { id: "bon", label: "Bonnes", x: 920, y: 420, accept: ACC.drilled }], ["bin", { id: "rebut", label: "Rebut", x: 920, y: 150, accept: ACC.bad }], ...LAMPS]
});

L.push({ title: "Atelier C : flacons", hall: "Hall 5", rearm: true, au: true,
  client: "Cuve, remplissage, égouttage, étiquetage, puis mise en carton de 4. Le moteur du tapis a un disjoncteur. Une bouteille non conforme dans un carton, et c'est tout le lot qui part à la poubelle.",
  goals: ["2 cartons de 4 bouteilles conformes (remplies, étiquetées).", "Produit prêt avant remplissage.", "Évacuation du carton au bon moment.", "AU et disjoncteur surveillés."],
  hint: "Trois automatismes indépendants (cuve, remplissage, étiquetage) et un comptage en bout. Le tapis s'arrête pendant le changement de carton, mais les butées tiennent les bouteilles en place.",
  goal: { boxer: { bx: 2 } }, tmax: 300, events: [{ kind: "au", after: 3 }, { kind: "thermal", target: "c1", after: 6 }],
  build: () => [["tank", { id: "tk", x: 150, y: 220 }], ["conv", { id: "c1", x1: 280, x2: 720, y: 420, speed: 110, end: { boxer: "bx" }, thermal: true, label: "Moteur tapis" }],
    ["feed", { id: "f1", conv: "c1", x: 320, seq: seq("BBBBBBBB"), delay: 1.2 }],
    ["fill", { id: "f1v", conv: "c1", x: 420, tank: "tk" }], ["stop", { id: "st1", conv: "c1", x: 437, label: "Butée remplissage : lever", tdx: 50 }], ["sens", { id: "b1", conv: "c1", x: 434, label: "Bouteille sous le bec", side: 1 }],
    ["stop", { id: "st2", conv: "c1", x: 597, label: "Butée étiqueteuse : lever", tdy: -4 }], ["sens", { id: "b2", conv: "c1", x: 594, label: "Bouteille sous l'étiqueteuse", tdx: -50 }], ["label", { id: "lab", conv: "c1", x: 580 }],
    ["sens", { id: "b3", conv: "c1", x: 700, label: "Barrière de comptage", tdx: -20 }], ["boxer", { id: "bx", x: 765, y: 420, cap: 4, accept: ACC.bottleLab }], ...LAMPS]
});

L.push({ title: "L'usine", hall: "Hall 5", rearm: true, au: true,
  client: "La ligne complète : bol vibrant, tri couleur, four, second tapis, caméra, robot qui met en carton de 4. Disjoncteur, panne de capteur, porte, AU : tout va arriver. Si tu passes celui-là, tu peux mettre ta ligne en production.",
  goals: ["2 cartons de 4 pièces bleues, cuites et sans défaut.", "Rouges éjectées, défectueuses au rebut par le robot.", "Panne capteur détectée.", "Toutes les sécurités surveillées."],
  hint: "Construis-la bloc par bloc et teste chaque bloc avant d'ajouter le suivant. Le robot dépose directement dans le carton : compte les cycles du programme A.",
  goal: { boxer: { bx: 2 } }, tmax: 360, events: [{ kind: "thermal", target: "c1", after: 2 }, { kind: "sensor", target: "e1", after: 3 }, { kind: "door", after: 6 }, { kind: "au", after: 8 }],
  build: () => [["door", { id: "porte", rect: [650, 110, 380, 470], label: "Porte cellule robot fermée" }],
    ["conv", { id: "c1", x1: 270, x2: 640, y: 200, speed: 120, end: { to: "c2" }, thermal: true, label: "Moteur tapis 1" }], ["conv", { id: "c2", x1: 640, x2: 770, y: 200, speed: 90, end: "block", label: "Moteur tapis 2" }],
    ["bowl", { id: "bol", x: 110, y: 200, conv: "c1", dropX: 300, seq: seq("bbrbbdbrbbrb"), cnt: 5 }], ["sens", { id: "z1", conv: "c1", x: 300, kind: "zone", label: "Zone de dépose occupée", side: 1, tdx: 40 }],
    ["sens", { id: "b1", conv: "c1", x: 420, label: "Présence poste de tri", side: 1, tdx: -34, tdy: 44 }], ["sens", { id: "col", conv: "c1", x: 420, kind: "red", side: 1, label: "Capteur couleur : rouge", tdx: 34, tdy: 44 }],
    ["push", { id: "e1", conv: "c1", x: 420, side: -1, bin: "rebut1" }], ["bin", { id: "rebut1", label: "Rebut rouge", x: 420, y: 70, accept: ACC.red }],
    ["oven", { id: "four", conv: "c1", x1: 470, x2: 625 }],
    ["sens", { id: "b2", conv: "c2", x: 753, label: "Pièce en position de prise", side: 1 }], ["cam", { id: "cam", conv: "c2", x: 753 }],
    ["robot", { id: "rb", bx: 830, by: 380, pick: { conv: "c2", x: 753 }, A: "bx", B: "rebut2" }],
    ["boxer", { id: "bx", x: 960, y: 470, cap: 4, accept: p => p.color === "red" ? "Une pièce rouge dans le carton !" : p.defect ? "Une pièce défectueuse dans le carton !" : ACC.cuit(p) }],
    ["bin", { id: "rebut2", label: "Rebut défaut", x: 720, y: 500, accept: ACC.bad }], ...LAMPS]
});

const TG = {1: {"t": 10, "c": 4}, 2: {"t": 18, "c": 6}, 3: {"t": 25, "c": 12}, 4: {"t": 26, "c": 20}, 5: {"t": 38, "c": 15}, 6: {"t": 48, "c": 25}, 7: {"t": 58, "c": 21}, 8: {"t": 36, "c": 20}, 9: {"t": 40, "c": 70}, 10: {"t": 38, "c": 33}, 11: {"t": 42, "c": 38}, 12: {"t": 46, "c": 66}, 13: {"t": 34, "c": 33}, 14: {"t": 68, "c": 39}, 15: {"t": 31, "c": 34}, 16: {"t": 66, "c": 94}, 17: {"t": 60, "c": 84}, 18: {"t": 49, "c": 59}, 19: {"t": 78, "c": 58}, 20: {"t": 75, "c": 72}};
Object.assign(window.TARGETS, TG);
L.forEach((l, i) => { l.n = i + 1; });
window.LEVELS = L;
})();
