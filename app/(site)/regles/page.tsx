import type { Metadata } from 'next';
import { DEFAULT_LOCALE, t, type Locale } from '@/lib/i18n';
import { alternatesFor } from '@/lib/routes';
import { publisher } from '@/lib/legal';
import { REPORT_GROUNDS, REVIEW_DEADLINE_HOURS } from '@/src/domain/moderation';

/**
 * Les regles, et le point de contact.
 *
 * ## Pourquoi cette page existe avant qu'il y ait quoi que ce soit a moderer
 *
 * C'est, le verrou ⛔ qui tient tout le social — profils publics, fil
 * d'activite, listes, avatars, et jusqu'aux cosmetiques d'A6, qui n'ont de valeur que s'ils
 * sont vus.
 *
 * Une page de regles n'est pas une formalite : **c'est elle qui rend un retrait legitime.**
 * Retirer un contenu sans avoir dit d'avance ce qui est interdit, c'est de l'arbitraire ;
 * l'avoir dit, c'est de la moderation. Et l'ecrire *apres* le premier signalement revient a
 * ecrire la regle pour le cas qu'on a sous les yeux.
 *
 * ## Indexable, et c'est le point
 *
 * Comme `/mentions`, contrairement a `/moi` : quelqu'un qui cherche a qui s'adresser doit
 * pouvoir **trouver** cette page, y compris depuis un moteur. La mettre en `noindex` la
 * rendrait introuvable a ceux-la memes a qui elle s'adresse.
 *
 * ## ⚠️ Elle disait « rien de tout cela n'est encore ouvert », et c'etait devenu faux
 *
 * Cette section affirmait qu'il n'existait « aucun profil public, aucun commentaire, aucune
 * liste partagee ». Le lot 8 a livre les trois. La phrase est corrigee ici comme elle l'a ete
 * dans la page : **une page dont le role est de dire ce que le produit heberge se relit a
 * chaque fois qu'il heberge quelque chose de nouveau.** Elle porte desormais les deux voies
 * de recours — signaler, qui demande qu'on regarde, et bloquer, qui ne demande rien a
 * personne — et ce que son auteur peut defaire lui-meme.
 *
 * > ⚖️ **Textes a faire relire.** Le cadre general vient du DSA ; je ne suis pas une source
 * > juridique. Ce qui est sur, c'est qu'improviser au moment du premier signalement est pire.
 */
export const dynamic = 'force-static';

/** L'ordre d'affichage : du plus grave au moins grave, comme le triage les traite. */
const GROUND_KEY = {
  illegal: 'rules.ground.illegal',
  abuse: 'rules.ground.abuse',
  privacy: 'rules.ground.privacy',
  spam: 'rules.ground.spam',
  spoiler: 'rules.ground.spoiler',
} as const;

export function rulesMetadata(locale: Locale): Metadata {
  return {
    title: t(locale, 'rules.title'),
    alternates: alternatesFor('/regles', locale),
  };
}

export const metadata: Metadata = rulesMetadata(DEFAULT_LOCALE);

export function RulesView({ locale }: { readonly locale: Locale }) {
  const contact = publisher().email;

  return (
    <div className="text-page">
      <h1 className="page-title">{t(locale, 'rules.title')}</h1>
      <p className="text-(--color-muted)">{t(locale, 'rules.intro')}</p>

      {/* 🔴 Ici vivait un encart « Rien de tout cela n'est encore ouvert », qui annoncait
          au public qu'il n'existait « aucun profil public, aucun commentaire, aucune liste
          partagee ». Le lot 8 a livre les critiques publiques, les profils et le fil : la
          phrase est devenue fausse, sur la page meme dont le role est de dire la verite sur
          ce que le produit heberge, et qui est indexable et liee depuis tous les pieds de
          page. Elle est retiree plutot que reecrite — son propos etait d'expliquer pourquoi
          des regles arrivent avant le contenu, et ce propos n'a plus d'objet. */}

      <section className="space-y-3">
        <h2 className="section-heading">{t(locale, 'rules.grounds.title')}</h2>
        <p className="meta">{t(locale, 'rules.grounds.intro')}</p>
        {/* La liste vient de `REPORT_GROUNDS`, pas d'une enumeration recopiee ici : un motif
            ajoute au domaine sans etre publie serait un motif qu'on applique sans l'avoir
            annonce — exactement l'arbitraire que cette page existe pour empecher. */}
        <ul className="space-y-2">
          {REPORT_GROUNDS.map((ground) => (
            <li key={ground} className="text-sm">
              {t(locale, GROUND_KEY[ground])}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="section-heading">{t(locale, 'rules.how.title')}</h2>
        <p className="meta">
          {contact === undefined ? t(locale, 'rules.how.noContact') : t(locale, 'rules.how.body')}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="section-heading">{t(locale, 'rules.delay.title')}</h2>
        {/* Le chiffre vient du domaine : annoncer ici un delai different de celui que le
            triage applique serait une promesse que le code ne tient pas. */}
        <p className="text-sm">
          {t(locale, 'rules.delay.body', { hours: String(REVIEW_DEADLINE_HOURS) })}
        </p>
        <p className="meta">{t(locale, 'rules.delay.why')}</p>
      </section>

      <section className="space-y-2">
        <h2 className="section-heading">
          {t(locale, 'rules.decision.title')}
        </h2>
        <ul className="space-y-2 text-sm">
          <li>{t(locale, 'rules.decision.hidden')}</li>
          <li>{t(locale, 'rules.decision.told')}</li>
          <li>{t(locale, 'rules.decision.contest')}</li>
        </ul>
      </section>

      {/* 🔴 **La page des recours n'en annoncait qu'un.** Signaler demande qu'on regarde ;
          depuis le 2026-08-17 il existe un geste qu'une personne fait seule, immediatement,
          sans que personne ne tranche. Une voie de recours qui n'est ecrite nulle part est
          une voie que seuls ceux qui explorent l'interface trouvent — et ce sont rarement
          ceux qui en ont besoin. */}
      <section className="space-y-2">
        <h2 className="section-heading">{t(locale, 'rules.block.title')}</h2>
        <p className="text-sm">
          {t(locale, 'rules.block.body', { hours: String(REVIEW_DEADLINE_HOURS) })}
        </p>
        <p className="meta">{t(locale, 'rules.block.limits')}</p>
      </section>

      {/* 🔴 **La regle qui manquait pour qu'un geste puisse exister.** `unpublishReview()` a
          ete retiree du client le 2026-08-07 avec ce motif ecrit noir sur blanc : *« la phrase
          publique sur le retrait d'une critique par son auteur n'est pas encore ecrite : on
          avait donc du code qui supprime, et aucune regle publiee qui dise ce qu'il fait »*.
          Consequence mesuree le 2026-08-17 : `reviews_delete` existait dans la base depuis le
          premier jour, **sans aucun appelant**, et une critique publiee etait definitive pour
          la personne qui l'avait ecrite.

          ⚠️ La distinction porte tout : « on masque, on ne supprime jamais » parle de ce que
          **la moderation** retire — une erreur doit rester reparable et une contestation
          examinable. Ce que son auteur defait lui-meme n'a ni erreur ni contestation a
          preserver. C'est deja ce que `deleteList` et « Retirer ma reponse » (024) font. */}
      <section className="space-y-2">
        <h2 className="section-heading">{t(locale, 'rules.yours.title')}</h2>
        <p className="text-sm">{t(locale, 'rules.yours.body')}</p>
        <p className="meta">{t(locale, 'rules.yours.journal')}</p>
      </section>

      <section className="space-y-2">
        <h2 className="section-heading">
          {t(locale, 'rules.contact.title')}
        </h2>
        {contact !== undefined ? (
          <p className="text-sm">
            <a className="underline underline-offset-2" href={`mailto:${contact}`}>
              {contact}
            </a>
          </p>
        ) : (
          <p className="text-sm text-(--color-warn)">{t(locale, 'rules.how.noContact')}</p>
        )}
      </section>
    </div>
  );
}

export default function RulesPage() {
  return <RulesView locale={DEFAULT_LOCALE} />;
}
