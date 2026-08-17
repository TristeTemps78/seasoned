import { expect, it } from 'vitest';
import { codeOf, filesUnder, pathOf } from './sources';

/**
 * **Aucun ecran n'affirme un vide qu'il n'a pas mesure.**
 *
 * ## 🔴 Ce que la mesure du 2026-08-18 a trouve, sur dix surfaces
 *
 * `SocialClient` **ne leve jamais** — c'est sa premiere phrase, et elle est juste : une panne
 * du social ne doit pas interrompre un produit dont tout le reste est local. Le prix est
 * ecrit dans le meme fichier : *« l'ecran d'un defaut est identique a celui d'un demarrage a
 * froid »*. Une lecture ratee rend `undefined` ou `[]`, exactement comme une absence.
 *
 * Mesure sur la production, connexion coupee depuis la console :
 *
 * - `/amis` : « Choisissez votre nom » — a un compte qui en a un depuis des semaines ;
 * - `/u/<nom>` : « ce profil n'existe pas » ;
 * - `/u/<nom>/liste/<slug>` : « cette liste ne s'ouvre pas » ;
 * - une fiche serie portant **cinq** critiques : « Personne n'a encore ecrit sur cette
 *   serie. La votre serait la premiere » ;
 * - `/compte` : « Vous n'avez bloque personne » — la phrase qu'on vient verifier quand on se
 *   demande si on est protege de quelqu'un.
 *
 * Ces ecrans ne se taisaient pas : ils **affirmaient** le contraire de ce qui s'etait passe,
 * et deux d'entre eux invitaient a un geste qui n'avait aucun sens.
 *
 * ## Ce que cette garde exige, et ce qu'elle ne peut pas voir
 *
 * Un composant qui lit le social **et** qui affiche une phrase de vide doit passer par
 * {@link useSocialRead} — le seul crochet qui distingue « rien » de « je n'ai pas pu lire ».
 * Elle lit la source, comme `no-orphan-component` : elle ne prouve pas que la phrase juste
 * s'affiche, elle rend impossible d'oublier de se poser la question.
 *
 * ⚠️ **Les exemptions sont des silences, pas des affirmations.** Un composant qui rend
 * `null` quand il n'a rien ne ment pas — il se tait, et `CLAUDE.md` nomme ce cas (« ce qui
 * n'a litteralement rien derriere sur une page par ailleurs pleine »). C'est pourquoi la
 * liste ci-dessous est courte et se justifie ligne a ligne.
 */

/** Les phrases qui **affirment** un vide. Une chaine de dictionnaire, pas un mot de code. */
const AFFIRME_UN_VIDE = /EmptyState|\.none'|\.nobody'|\.empty'|\.noneOther'|AccountGate/;

/** Le crochet qui sait distinguer, et le seul. */
const SAIT_DISTINGUER = /useSocialRead/;

/** Qui lit le social, sous une forme ou une autre. */
const LIT_LE_SOCIAL = /useSocial\s*\(/;

it('un ecran qui lit le social et annonce un vide sait s il a pu lire', () => {
  const fautes = filesUnder('app')
    .filter((file) => pathOf(file).endsWith('.tsx'))
    .filter((file) => {
      const code = codeOf(file);
      return (
        LIT_LE_SOCIAL.test(code) &&
        AFFIRME_UN_VIDE.test(code) &&
        !SAIT_DISTINGUER.test(code)
      );
    })
    .map((file) => pathOf(file));

  expect(
    fautes,
    'une lecture ratee rend `[]` comme une absence : sans `useSocialRead`, l ecran affirme un vide qu il n a pas mesure',
  ).toEqual([]);
});

it('l ancrage : le crochet est reellement employe, et pas seulement importe', () => {
  // Sans cet ancrage, la garde resterait verte le jour ou `useSocialRead` disparaitrait —
  // et les dix ecrans redeviendraient menteurs en silence. C'est la meme precaution que
  // `no-dead-message` prend pour la cle de repli.
  const porteurs = filesUnder('app')
    .filter((file) => pathOf(file).endsWith('.tsx'))
    .filter((file) => /unreadable/.test(codeOf(file)))
    .map((file) => pathOf(file));

  expect(porteurs.length).toBeGreaterThanOrEqual(8);
});
