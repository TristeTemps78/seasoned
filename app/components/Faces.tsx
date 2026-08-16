'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/app/i18n/LocaleProvider';
import { pathIn } from '@/lib/routes';
import type { Locale } from '@/lib/i18n';

/**
 * Les faces du cube, en barre de navigation.
 *
 * ## Pourquoi quatre et pas six
 *
 * Le cube en a six, et en nomme six. Deux d'entre elles —
 * *Mes amis* et *Les listes* — **n'ont aucun contenu tant qu'il n'y a pas de comptes**.
 *
 * Les livrer en coquilles vides serait exactement ce que le document s'interdit : *« on ne
 * remplit pas une face de faux contenu »*. Et une barre dont un tiers des entrees mene a
 * « bientot » apprend surtout a ne plus cliquer dessus.
 *
 * Elles arrivent donc **avec leur lot**, quand elles auront quelque chose a montrer. Le
 * logo garde ses six faces : la marque n'a pas besoin que la navigation lui obeisse.
 *
 * ## Ce qui n'est pas une face, et pourquoi
 *
 * - **La recherche** est partout. En faire une face ajouterait un clic a l'action la plus
 *   frequente du produit.
 *
 *   🔴 **Cette phrase etait fausse quand elle a ete ecrite, et l'est restee des mois.**
 *   Compte le 2026-08-16 : `SearchForm` etait monte sur **trois routes sur dix-huit** —
 *   l'accueil, `/recherche` et la 404. Depuis une fiche serie, `/moi`, `/calendrier`,
 *   `/bilan`, `/amis` ou `/listes`, chercher demandait de revenir a l'accueil. L'argument
 *   qui ecarte un onglet reposait donc sur un fait qui n'existait pas.
 *
 *   Elle est vraie depuis que l'en-tete porte la recherche sur toutes les pages (voir
 *   `SiteChrome`). C'est le meme genre de defaut que le titre des critiques qui annoncait
 *   un filtre inexistant : **une justification se rememore avec ce qu'elle invoque**.
 * - **`/convertir`** est une porte d'entree indexable, pas une piece : sa valeur entiere
 *   est d'etre trouvee depuis un moteur par les orphelins de TV Time. Dans une barre, elle
 *   occuperait une place pour un geste qu'on fait une fois dans sa vie.
 */
interface Face {
  readonly path: string;
  readonly labelKey:
    | 'face.discover'
    | 'face.library'
    | 'face.calendar'
    | 'face.tally'
    | 'face.lists'
    | 'face.friends';
}

const FACES: readonly Face[] = [
  { path: '/', labelKey: 'face.discover' },
  { path: '/moi', labelKey: 'face.library' },
  { path: '/calendrier', labelKey: 'face.calendar' },
  { path: '/bilan', labelKey: 'face.tally' },
  // ⚠️ La cinquieme face n'apparait qu'ici, et **pas avant aujourd'hui** : elle avait ete
  // ecartee le 2026-08-03 parce qu'une barre dont un tiers mene a « bientot » apprend a ne
  // plus cliquer dessus. Elle mene desormais quelque part — un ecran qui dit quoi faire
  // quand on n'a encore suivi personne, ce qui n'est pas la meme chose que « bientot ».
  { path: '/amis', labelKey: 'face.friends' },
  // La sixieme, pour la meme raison et au meme moment que la cinquieme : les listes ont
  // desormais un ecran qui fait quelque chose. **Le cube est complet** — les six faces de
  // existent enfin toutes.
  { path: '/listes', labelKey: 'face.lists' },
];

/**
 * 🔴 **Quatre faces sur six etaient invisibles sur un telephone.** Mesure le 2026-08-12 en
 * 390 px : la barre montrait « DISCOVER », puis « MY LIBRAR » coupe net au milieu du mot, et
 * plus rien. Le ruban defilait bien — mais aucune barre de defilement ne s'affiche sur un
 * telephone tant qu'on ne l'a pas touche, donc **rien ne disait qu'il y avait autre chose**.
 * Un mot coupe ne se lit pas comme « la suite est a droite », il se lit comme un bug.
 *
 * Trois reponses, dont aucune seule ne suffisait :
 *
 *   1. Un **fondu** sur le bord droit : c'est lui qui dit « ca continue », et c'est la seule
 *      des trois qui parle avant qu'on touche a quoi que ce soit.
 *   2. La face courante **ramenee dans le champ** a l'arrivee. Sans ca, ouvrir `/listes`
 *      depuis un lien affichait une barre ou la face active etait hors de vue : on ne savait
 *      plus ou l'on etait, sur la seule surface qui serve a le dire.
 *   3. Un peu de largeur reprise ailleurs — le mot « Account » passe en icone seule sous
 *      640 px, et l'ecart des onglets se resserre.
 */
export function Faces({ locale }: { readonly locale: Locale }) {
  const { t } = useT();
  const pathname = usePathname();
  const rail = useRef<HTMLUListElement>(null);

  /**
   * De quel cote il reste des faces hors du champ.
   *
   * ⚠️ **Mesure, et non point de rupture.** Un fondu pose sous 40 rem par une media query
   * serait faux dans les deux sens : a 639 px les six onglets rentrent parfois — le fondu
   * annoncerait alors une suite qui n'existe pas —, et le jour ou une septieme face
   * s'ajoute, il manquerait au-dessus. `scrollWidth > clientWidth` est la seule source qui
   * ne mente sur aucune des deux.
   */
  useEffect(() => {
    const list = rail.current;
    if (list === null) return;

    const measure = () => {
      // Une marge d'un pixel : les largeurs sont fractionnaires, et `scrollWidth` arrondit.
      // Sans elle, un ruban qui rentre pile porte un fondu permanent d'un cote.
      const left = list.scrollLeft > 1;
      const right = list.scrollLeft + list.clientWidth < list.scrollWidth - 1;
      list.dataset['fade'] = left && right ? 'both' : left ? 'left' : right ? 'right' : 'none';
    };

    measure();
    list.addEventListener('scroll', measure, { passive: true });

    // La largeur du ruban change sans que la fenetre bouge : rotation d'un telephone, mais
    // aussi l'arrivee des polices, qui elargit les libelles apres le premier rendu.
    //
    // ⚠️ Teste avant d'etre construit : `ResizeObserver` n'existe pas dans jsdom, ou tournent
    // les tests de cette barre. Sans la garde, cinq tests qui ne parlent que de langue et de
    // face courante echouaient sur un `ReferenceError` — le fondu est un confort, il ne doit
    // faire tomber ni un test ni un navigateur qui ne connait pas l'API.
    const observer =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(list);

    return () => {
      list.removeEventListener('scroll', measure);
      observer?.disconnect();
    };
  }, [pathname]);

  useEffect(() => {
    const current = rail.current?.querySelector('[aria-current="page"]');
    // ⚠️ `inline: 'nearest'` et **pas** `'center'` : centrer la face active ferait toujours
    // partir la barre du milieu, y compris sur l'accueil ou la premiere face est deja
    // visible — un mouvement gratuit qui donnerait l'impression d'une page qui bouge toute
    // seule. `nearest` ne fait rien quand il n'y a rien a faire.
    // ⚠️ `block: 'nearest'` pour la meme raison, sinon le navigateur fait aussi defiler la
    // **page** pour amener l'en-tete a l'ecran — sur une page deja en haut, c'est sans
    // effet, mais sur un lien profond ca annulerait l'ancre.
    // ⚠️ Meme garde que `ResizeObserver`, et pour la meme raison : jsdom declare la methode
    // absente. Ramener la face active dans le champ est un confort de telephone ; ca ne doit
    // pas decider si les liens de cette barre sont dans la bonne langue.
    if (typeof current?.scrollIntoView === 'function') {
      current.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    }
  }, [pathname]);

  return (
    // ⚠️ Ni bordure ni conteneur propre : cette barre vit **dans** la ligne de l'en-tete
    // depuis le 2026-08-03. Deux rangees de chrome superposees repoussaient le titre de la
    // page a 270 px du haut de l'ecran — avant tout contenu, sur toutes les pages.
    <nav aria-label={t('faces.aria')} className="-mx-1 min-w-0 flex-1">
      {/* ⚠️ Pas d'`overflow-x-auto` ici : il est declare dans `.face-rail`, avec la barre
          qu'il masque. Voir le commentaire de la classe. */}
      <ul ref={rail} className="face-rail flex gap-1">
        {FACES.map((face) => {
          const href = pathIn(face.path, locale);
          // Comparaison exacte : `/moi` ne doit pas s'allumer sur `/moi/quelque-chose`
          // par un `startsWith`, et la racine s'allumerait sur **tout** le site.
          const active = pathname === href;

          return (
            <li key={face.path}>
              <Link
                href={href}
                {...(active ? { 'aria-current': 'page' as const } : {})}
                // ⚠️ Le volt passe **sur le libelle**, pas seulement sous lui : un trait de
                // 2 px sous un mot gris etait la plus faible difference possible, et il
                // fallait chercher ou l'on etait. Deux signaux, dont un non colore.
                // ⚠️ Capitales serrees, 700, 12 px (brief 4.3). Un onglet en minuscules a la
                // taille du corps de texte ne se lit pas comme de la navigation : il se lit
                // comme un lien dans une phrase. Les capitales demandent un interlettrage
                // **positif** — c'est la seule regle universelle de la typographie en capitales.
                // ⚠️ `px-2` sous 640 px : six onglets a `px-3` demandent 30 px de plus que
                // n'en a un telephone de 390. Ce sont exactement les 30 px qui coupaient un
                // mot en deux.
                className={`inline-block border-b-2 px-2 py-4 text-xs font-bold tracking-[0.08em] whitespace-nowrap uppercase transition-colors sm:px-3 ${
                  active
                    ? 'border-(--color-volt) text-(--color-bright)'
                    : 'border-transparent text-(--color-muted) hover:text-(--color-bright)'
                }`}
              >
                {t(face.labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
