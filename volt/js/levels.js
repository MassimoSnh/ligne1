"use strict";
/* Volt : les niveaux. Chaque niveau est construit sur une grille 40 x 22. */
(function (root) {
function grid(f) {
  const g = Array.from({ length: 22 }, () => Array(40).fill(" "));
  const R = (x1, y1, x2, y2, ch = "#") => { for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) if (x >= 0 && x < 40 && y >= 0 && y < 22) g[y][x] = ch; };
  const P = (x, y, ch) => { g[y][x] = ch; };
  f(R, P);
  return g.map(r => r.join(""));
}
const LEVELS = [
  { name: "Premiers pas", par: 9, tip: "Flèches pour courir, Espace pour sauter. Plus tu restes appuyé, plus tu sautes haut.",
    map: grid((R, P) => {
      R(0, 20, 9, 21); R(13, 20, 19, 21); R(22, 20, 39, 21); R(23, 19, 23, 19);
      R(14, 18, 17, 18); P(15, 17, "*"); P(11, 18, "*");
      R(27, 17, 29, 17); R(31, 14, 34, 14); P(32, 13, "*");
      P(2, 19, "P"); P(37, 19, "E");
    }) },
  { name: "Attention aux pics", par: 11, tip: "Les pics tuent au contact. Si tu meurs, tu recommences le niveau, étoiles comprises.",
    map: grid((R, P) => {
      R(0, 20, 39, 21); R(27, 20, 29, 21, " ");
      R(7, 19, 10, 19, "^"); R(16, 19, 20, 19, "^");
      R(7, 17, 11, 17); P(9, 16, "*");
      R(21, 17, 23, 17); R(23, 14, 27, 14); P(25, 13, "*"); P(28, 18, "*");
      P(2, 19, "P"); P(37, 19, "E");
    }) },
  { name: "Le dash", par: 10, tip: "X (ou Shift) pour dasher dans la direction des flèches. Un seul dash en l'air, il se recharge en touchant le sol.",
    map: grid((R, P) => {
      R(0, 20, 9, 21); R(18, 20, 39, 21);
      P(13, 17, "*"); P(4, 13, "*");
      R(26, 14, 30, 14); P(28, 13, "*");
      P(2, 19, "P"); P(36, 19, "E");
    }) },
  { name: "La cheminée", par: 14, tip: "Contre un mur, appuie sur Saut pour rebondir dessus. Enchaîne les murs pour grimper.",
    map: grid((R, P) => {
      R(0, 20, 39, 21);
      R(16, 4, 16, 17); R(21, 4, 21, 19); R(21, 4, 39, 4);
      P(18, 12, "*"); P(19, 7, "*");
      R(6, 7, 12, 7); P(9, 6, "*");
      P(3, 19, "P"); P(37, 3, "E");
    }) },
  { name: "Cristaux", par: 12, tip: "Un cristal vert recharge ton dash en plein vol. Enchaîne-les pour traverser.",
    map: grid((R, P) => {
      R(0, 20, 6, 21); R(33, 20, 39, 21);
      for (let x = 10; x <= 30; x += 4) P(x, 16, "o");
      P(16, 13, "*"); P(24, 18, "*");
      R(34, 14, 38, 14); P(36, 13, "*");
      P(2, 19, "P"); P(38, 19, "E");
    }) },
  { name: "Ressorts", par: 13, tip: "Un ressort te propulse très haut et recharge ton dash.",
    map: grid((R, P) => {
      R(0, 20, 39, 21);
      P(8, 19, "s"); R(10, 12, 16, 12); P(13, 11, "*");
      R(17, 7, 21, 7, "v");
      R(22, 12, 27, 12); P(27, 11, "s");
      R(18, 19, 19, 19, "^"); R(21, 19, 22, 19, "^"); P(20, 18, "*");
      R(31, 6, 38, 6); P(33, 5, "*");
      P(2, 19, "P"); P(37, 5, "E");
    }) },
  { name: "Effondrement", par: 12, tip: "Les blocs fissurés s'effondrent peu après que tu marches dessus. Ne traîne pas.",
    map: grid((R, P) => {
      R(0, 20, 39, 21); R(6, 19, 33, 19, "^");
      R(8, 16, 11, 16, "c"); R(15, 14, 18, 14, "c"); R(22, 16, 25, 16, "c"); R(28, 15, 31, 15, "c");
      P(16, 12, "*"); P(20, 17, "*"); P(29, 12, "*"); P(20, 11, "o");
      P(2, 19, "P"); P(37, 19, "E");
    }) },
  { name: "Précision", par: 14, tip: "Des piliers d'une case au-dessus des pics. Dose tes sauts.",
    map: grid((R, P) => {
      R(0, 20, 39, 21); R(4, 19, 35, 19, "^"); R(0, 19, 3, 19); R(36, 19, 39, 19);
      R(8, 16, 8, 18); R(13, 14, 13, 18); R(18, 16, 18, 18); R(23, 12, 23, 18); R(28, 15, 28, 18); R(33, 13, 33, 18);
      P(16, 12, "*"); P(26, 17, "*"); P(30, 9, "*");
      P(1, 18, "P"); P(38, 18, "E");
    }) },
  { name: "La tour", par: 16, tip: "Ressort, cheminée, cristal : tout pour monter.",
    map: grid((R, P) => {
      R(0, 20, 39, 21);
      P(13, 19, "s"); R(15, 12, 19, 12, "-");
      R(20, 3, 20, 9); R(24, 2, 24, 19); R(24, 2, 39, 2);
      P(14, 5, "o"); P(12, 4, "*"); P(22, 6, "*");
      R(6, 15, 10, 15); P(8, 14, "*");
      P(3, 19, "P"); P(36, 1, "E");
    }) },
  { name: "Le grand final", par: 18, tip: "Tout ce que tu as appris, d'une traite.",
    map: grid((R, P) => {
      R(0, 20, 5, 21); R(0, 19, 5, 19);
      R(6, 21, 39, 21, "^");
      R(9, 16, 12, 16, "c"); P(15, 13, "o"); R(18, 15, 20, 15); P(19, 14, "s");
      R(23, 5, 23, 13); R(27, 3, 27, 15); R(23, 13, 25, 13, "c");
      R(28, 3, 39, 3); P(10, 13, "*"); P(25, 7, "*"); P(21, 3, "*");
      P(2, 18, "P"); P(37, 2, "E");
    }) },
  { name: "Zigzag", par: 20, tip: "Monte entre les murs, plonge sous les plafonds, recharge-toi sur les cristaux.",
    map: grid((R, P) => {
      R(0, 20, 39, 21); R(3, 19, 36, 19, "^"); R(0, 19, 2, 19); R(37, 19, 39, 19);
      R(8, 0, 8, 13); R(20, 0, 20, 13); R(32, 0, 32, 13);
      R(14, 8, 14, 18); R(26, 8, 26, 18);
      P(8, 16, "o"); P(20, 16, "o"); P(32, 16, "o");
      P(11, 3, "*"); P(17, 17, "*"); P(29, 4, "*");
      P(1, 18, "P"); P(38, 18, "E");
    }) },
  { name: "Volt maximum", par: 24, tip: "Le dernier. Respire, et fonce.",
    map: grid((R, P) => {
      R(0, 20, 4, 21); R(0, 21, 39, 21, "^"); R(5, 20, 15, 20, "^");
      R(6, 17, 8, 17, "c"); R(11, 17, 13, 17, "c"); P(10, 19, "*");
      R(16, 19, 18, 20); P(17, 18, "s");
      R(19, 2, 19, 12); R(23, 2, 23, 16); P(21, 5, "*");
      R(26, 6, 36, 6, "-"); R(26, 10, 36, 10, "-"); R(26, 14, 36, 14, "-");
      R(27, 11, 30, 11, "v"); P(31, 12, "*"); P(25, 8, "o");
      R(35, 20, 39, 21);
      P(1, 19, "P"); P(37, 19, "E");
    }) }
];
root.VOLT_LEVELS = LEVELS;
if (typeof module !== "undefined") module.exports = LEVELS;
})(typeof window !== "undefined" ? window : globalThis);
