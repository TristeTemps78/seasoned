/**
 * Le dictionnaire francais — **la source du typage**.
 *
 * ⚠️ `MessageKey` vaut `keyof typeof FR` : ce fichier ne porte pas seulement des phrases,
 * il **definit l'ensemble des cles du produit**. Une cle ajoutee ici et absente de
 * `en.ts` ne compile pas, et c'est la garantie qui rend l'international tenable — le
 * typage garantit la presence, pas la traduction, mais la presence est deja beaucoup.
 *
 * Sorti de `lib/i18n.ts` le 2026-08-07 : les deux dictionnaires y occupaient **84 %** du
 * fichier (1222 lignes sur 1465), ce qui rendait le moteur — negociation de langue,
 * pluriels, interpolation — invisible au milieu des phrases.
 */

export const FR = {
  // Les libelles du differenciateur. Ce sont eux qui sont indexes, donc eux qui
  // decident si l'international rapporte quelque chose.
  'status.airing': 'En diffusion',
  'status.between_seasons': 'Entre deux saisons',
  'status.awaiting_renewal': 'Sans nouvelle',
  'status.ended': 'Terminée',
  'status.cancelled': 'Annulée',
  'status.upcoming': 'À venir',
  'status.unknown': 'Statut inconnu',

  'say.airing.today': 'Nouvel épisode aujourd’hui.',
  'say.airing.tomorrow': 'Nouvel épisode demain.',
  'say.airing.inDays.one': 'Nouvel épisode dans {n} jour.',
  'say.airing.inDays.other': 'Nouvel épisode dans {n} jours.',
  'say.airing.justAired': 'Un épisode vient de sortir.',
  'say.airing.lastAired.one': 'Dernier épisode il y a {n} jour.',
  'say.airing.lastAired.other': 'Dernier épisode il y a {n} jours.',
  'say.airing.plain': 'Des épisodes sortent en ce moment.',
  'say.between.plain': 'Saison terminée, la suite est attendue.',
  'say.between.since.one': 'Saison terminée il y a {n} mois. La suite est attendue.',
  'say.between.since.other': 'Saison terminée il y a {n} mois. La suite est attendue.',
  'say.awaiting.plain': 'Annoncée comme revenant, sans signe de vie.',
  'say.awaiting.since.one': 'Annoncée comme revenant, mais aucun épisode depuis {n} mois.',
  'say.awaiting.since.other': 'Annoncée comme revenant, mais aucun épisode depuis {n} mois.',
  // Ces deux phrases ne s'affichent **jamais seules** : `StatusBadge` les colle a la
  // pastille, qui dit deja « Terminee » / « Annulee ». Elles le repetaient mot pour mot —
  // vu a l'ecran le 2026-08-07, « Terminee · Terminee. Elle a une fin. ». La pastille dit
  // l'etat, la phrase dit ce qu'il **implique pour le spectateur** ; c'est son seul travail.
  'say.ended': 'Elle a une fin.',
  'say.cancelled': 'Elle peut s’arrêter sans conclusion.',
  'say.upcoming': 'Annoncée, rien n’a encore été diffusé.',
  'say.unknown': 'Données de diffusion insuffisantes pour trancher.',

  'chip.today': 'ép. aujourd’hui',
  'chip.tomorrow': 'ép. demain',
  'chip.inDays.one': 'ép. dans {n} j',
  'chip.inDays.other': 'ép. dans {n} j',
  'chip.airing': 'en cours',
  'chip.waiting': 'en attente',
  'chip.waitingSince.one': 'en attente · {n} mois',
  'chip.waitingSince.other': 'en attente · {n} mois',
  'chip.silent': 'sans nouvelle',
  'chip.silentSince.one': 'sans nouvelle · {n} mois',
  'chip.silentSince.other': 'sans nouvelle · {n} mois',
  'chip.cancelled': 'annulée',
  'chip.upcoming': 'à venir',


  'commit.underHour': 'moins d’une heure',
  'commit.hours.one': '{n} heure',
  'commit.hours.other': '{n} heures',
  'commit.days.one': '{n} heures — {d} jour plein',
  'commit.days.other': '{n} heures — {d} jours pleins',
  'commit.daysAndHours.one': '{n} heures — {d} jour et {r} h',
  'commit.daysAndHours.other': '{n} heures — {d} jours et {r} h',

  // Espaces compris : c'est un separateur, pas un mot. « et » en francais, « and » en
  // anglais — et la langue suivante pourrait n'avoir ni l'un ni l'autre.
  'join.and': ' et ',
  'series.unavailableTitle': 'Série indisponible',
  'series.unavailableHeading': 'Catalogue indisponible',
  'series.unavailableBody':
    'Impossible de récupérer cette série pour le moment. Réessayez dans un instant.',
  'series.seasons.one': '{n} saison',
  'series.seasons.other': '{n} saisons',
  'series.episodes.one': '{n} épisode',
  'series.episodes.other': '{n} épisodes',
  'series.airsOn': 'le {date}',
  'series.demands': 'Ce que la série demande',
  'series.sameCreator': 'Du même créateur',
  'cast.title': 'À l’écran',
  'cast.why': 'Les rôles principaux, toutes saisons confondues.',
  'stat.seasons': 'Saisons',
  'stat.episodes': 'Épisodes',
  'stat.commitment': 'Engagement',
  'stat.lastEpisode': 'Dernier épisode',

  'meta.description':
    'Où en est une série, combien de temps elle demande, et jusqu’où elle reste bonne.',
  'nav.tagline': 'est-ce que ça vaut le coup ?',
  'nav.library': 'Ma bibliothèque',
  'nav.language.aria': 'Langue',
  // Les faces du cube. Une face existe si elle repond a une question qu'on se pose a un
  // moment different — pas a un contenu different.
  'face.discover': 'Découvrir',
  'face.library': 'Ma bibliothèque',
  'face.calendar': 'Calendrier',
  'face.tally': 'Mon bilan',
  'faces.aria': 'Navigation principale',
  // L'ecran calendrier, distinct de l'export .ics qui vit dans la bibliotheque.
  'agenda.title': 'Ce qui revient',
  'agenda.lede': 'Les dates que le catalogue annonce, pour les séries que vous suivez.',
  'agenda.empty.title': 'Aucune date annoncée',
  'agenda.empty.body':
    'Rien à afficher tant qu’aucune série suivie n’a de retour annoncé. C’est le cas le plus fréquent : une date n’existe qu’une fois la diffusion programmée.',
  'agenda.today': 'aujourd’hui',
  'agenda.tomorrow': 'demain',
  'agenda.inDays.one': 'dans {n} jour',
  'agenda.inDays.other': 'dans {n} jours',
  'legal.title': 'Mentions légales',
  'legal.publisher': 'Éditeur',
  'legal.director': 'Directeur de la publication',
  'legal.host': 'Hébergeur',
  'legal.contact': 'Contact',
  'legal.incomplete.title': 'Ces mentions sont incomplètes',
  'legal.incomplete.body':
    'L’identité de l’éditeur n’est pas encore renseignée. Elle doit l’être avant l’ouverture des comptes, et en tout état de cause avant toute activité commerciale.',
  'legal.tmdb': 'Les données de séries proviennent de TMDB, qui n’approuve ni ne cautionne ce site.',

  // Le compte. ⚠️ Aucun de ces textes ne promet la synchronisation : elle n'existe pas
  // encore, et annoncer une fonctionnalite absente est la seule chose qu'on ne rattrape
  // pas — quelqu'un fermerait son navigateur en croyant ses notes en securite ailleurs.
  'account.title': 'Mon compte',
  'account.lede':
    'Un compte sert à retrouver vos notes ailleurs. Tout le reste du site fonctionne sans.',
  'account.aria': 'Connexion et compte',
  'account.nav': 'Compte',
  'account.email.label': 'Votre adresse e-mail',
  'account.email.placeholder': 'vous@exemple.fr',
  // ⚠️ Le seuil est interpole depuis `MINIMUM_AGE`, jamais recopie : meme procede que les
  // motifs de `/regles`. Changer le domaine sans changer le texte publie serait annoncer
  // une regle qu'on n'applique pas.
  'account.age': 'J’ai {age} ans ou plus',
  'account.ageWhy':
    'Nous ne demandons pas votre date de naissance : une déclaration suffit, et un âge exact serait une donnée de plus à protéger.',
  'account.send': 'Recevoir un lien de connexion',
  'account.sending': 'Envoi…',
  'account.sent':
    'Regardez vos e-mails. Le lien est à ouvrir dans ce navigateur-ci — c’est ce qui fait qu’il ne peut servir à personne d’autre.',
  'account.rateLimited':
    'Trop d’envois pour le moment. Réessayez dans quelques minutes.',
  'account.failed': 'L’envoi a échoué. Réessayez dans un instant.',
  'account.google': 'Continuer avec Google',
  'account.google.failed':
    'La connexion avec Google n’a pas pu démarrer. Utilisez le lien par e-mail ci-dessus.',
  'account.or': 'ou',
  'account.code.label': 'Ou saisissez le code reçu par e-mail',
  'account.code.placeholder': '123456',
  'account.code.submit': 'Valider le code',
  'account.code.failed': 'Ce code n’est pas valide, ou il a expiré.',
  'account.code.why':
    'Utile si vous lisez vos e-mails sur un autre appareil que celui-ci.',
  'account.signedInAs': 'Connecté en tant que {email}.',
  'account.signOut': 'Se déconnecter',
  'account.unavailable.title': 'Les comptes ne sont pas encore ouverts',
  'account.unavailable.body':
    'Cette installation n’est pas reliée à une base de données. Vos notes restent dans ce navigateur, et la bibliothèque fonctionne normalement.',
  'account.notSynced':
    'Vos notes suivent désormais votre compte : elles restent dans ce navigateur et une copie part sur nos serveurs, pour les retrouver sur vos autres appareils. Si le serveur est injoignable, rien ne s’arrête — tout continue ici.',
  // La question de l'appareil partagé. Le défaut est **non**, et le texte doit rendre ce
  // « non » confortable : garder un journal hors d'un compte se répare, l'y avoir versé
  // par erreur ne se répare pas.
  'report.open': 'Signaler',
  'report.which': 'Pour quel motif ? Cette liste est celle des règles, et rien d’autre ne se retire.',
  'report.cancel': 'Annuler',
  'report.sent': 'Signalement reçu. Nous répondons sous 72 h, à l’adresse des règles.',
  'report.failed': 'Le signalement n’est pas parti. Réessayez, ou écrivez-nous.',
  'face.friends': 'Mes amis',
  'face.lists': 'Mes listes',

  'discover.aria': 'Des gens à découvrir',
  'discover.title': 'Des gens à découvrir',
  // ⚠️ La phrase dit POURQUOI ces gens-là et pas d'autres. Sans elle, la section
  // ressemblerait à un annuaire — ce que ce produit s'interdit.
  'discover.why':
    'Ces personnes ont choisi de rendre leur profil public. Personne d’autre n’apparaît ici.',
  // Ce qu'il y a à lire chez quelqu'un — critiques et listes confondues. Absent quand il
  // n'y a rien : on ne compte pas zéro.
  'discover.wrote.one': '{n} à lire',
  'discover.wrote.other': '{n} à lire',

  'year.aria': 'Mon année',
  'year.title': 'Votre {year}',
  'year.pick': 'Choisir une année',
  'year.finished.one': '{n} série menée au bout.',
  'year.finished.other': '{n} séries menées au bout.',
  'year.rated.one': '{n} saison notée.',
  'year.rated.other': '{n} saisons notées.',
  'year.written.one': '{n} critique écrite.',
  'year.written.other': '{n} critiques écrites.',
  'year.liked.one': '{n} coup de cœur.',
  'year.liked.other': '{n} coups de cœur.',
  // ⚠️ « ce que pèsent les séries terminées », jamais « ce que vous avez regardé » : un
  // visionnage achevé en janvier a pu commencer l'année d'avant. Le journal ne sait pas
  // quand chaque épisode a été vu, et ce produit ne comble pas ce qu'il ignore.
  'year.weight': 'Les séries terminées cette année-là pèsent {commitment}.',
  'year.best': 'La saison que vous avez le mieux notée :',
  'year.thin': 'Peu de choses cette année-là.',

  // --- Les listes (8.13) ---------------------------------------------------
  // Le premier objet que ce produit fabrique POUR QUELQU'UN D'AUTRE : une note, une
  // position, une critique parlent de soi ; une liste se tend.
  'listsPage.title': 'Mes listes',
  'listsPage.intro':
    'Ce que vous rangez pour plus tard, ou pour quelqu’un. Vos listes sont visibles par les mêmes personnes que votre profil.',
  'lists.new': 'Nouvelle liste',
  'lists.newAria': 'Créer une liste',
  'lists.titleLabel': 'Titre de la liste',
  'lists.titlePlaceholder': 'À faire voir à ma mère',
  'lists.noteLabel': 'Une phrase, si vous voulez',
  'lists.notePlaceholder': 'Pourquoi celles-là (facultatif)',
  'lists.create': 'Créer la liste',
  'lists.none': 'Vous n’avez pas encore de liste.',
  'lists.noneOther': 'Aucune liste à lire ici pour l’instant.',
  'lists.count.one': '{n} série',
  'lists.count.other': '{n} séries',
  'lists.open': 'Voir',
  'lists.close': 'Replier',
  'lists.empty': 'Cette liste est vide. Ajoutez-y une série depuis sa fiche.',
  'lists.remove': 'Retirer',
  'lists.delete': 'Supprimer la liste',
  'lists.needAccount':
    'Créez un compte pour tenir des listes — c’est la seule partie du produit qui en demande un, parce qu’une liste que personne ne peut lire n’est pas une liste.',
  'lists.error.empty': 'Une liste a besoin d’un titre.',
  'lists.error.too_long': 'Ce titre est trop long.',
  'lists.error.note_too_long': 'Cette phrase est trop longue.',
  'lists.error.unusable_title':
    'Ce titre ne donne aucune adresse lisible. Ajoutez-y au moins deux lettres ou chiffres.',
  'lists.error.failed': 'La liste n’a pas pu être créée. Réessayez.',
  'addToList.label': 'Ajouter à une liste',
  'addToList.added': '{title} ✓',
  'addToList.none': 'Vous n’avez pas encore de liste.',
  'addToList.goToLists': 'En créer une',
  'friendsPage.title': 'Mes amis',
  'friendsPage.lede':
    'Ce que vos proches regardent, sans que rien ne vous dévoile la suite de ce que vous n’avez pas vu.',
  'friends.signedOut':
    'Créez un compte pour suivre vos proches. Tout le reste du site fonctionne sans.',
  'friends.claim.title': 'Choisissez votre nom',
  'friends.claim.body':
    'C’est ainsi que vos proches vous trouveront. Trois à vingt caractères, lettres minuscules, chiffres et tirets bas. Il ne se change pas : un nom rendu ne peut pas être repris par quelqu’un d’autre sans casser les liens qui pointaient vers vous.',
  'friends.claim.placeholder': 'votrenom',
  'friends.claim.submit': 'Prendre ce nom',
  'friends.claim.taken': 'Ce nom n’est pas disponible.',
  'friends.claim.shape':
    'Trois à vingt caractères : lettres minuscules, chiffres et tirets bas uniquement.',
  'friends.claim.failed': 'Impossible pour l’instant. Réessayez.',
  'friends.you': 'Vous êtes @{handle}. Votre activité n’est visible que par ceux qui vous suivent.',
  'friends.follow.placeholder': 'sonnom',
  'friends.follow.submit': 'Suivre',
  'friends.follow.notFound':
    'Personne sous ce nom. On ne cherche que par nom exact : il n’y a pas d’annuaire ici, et c’est voulu.',
  'friends.following': 'Vous suivez {list}',
  'friends.feed.title': 'Ce qu’ils font',
  'friends.feed.empty':
    'Rien pour l’instant. Suivez quelqu’un, ou donnez-lui votre nom — le fil se remplit à mesure.',
  // ⚠️ Ce texte existe parce qu'un fil vide et un fil illisible donnaient le MÊME écran, et
  // que c'est ce qui a laissé 10.0 invisible trois sessions durant. Il ne s'excuse pas et ne
  // promet rien : il dit ce qu'on sait, c'est-à-dire qu'on ne sait pas.
  'friends.feed.unreadable':
    'Le fil n’a pas pu être chargé. Ce n’est pas qu’il est vide — réessayez dans un instant.',
  'friends.item.rated_season': 'a noté',
  'friends.item.finished': 'a terminé une série',
  'friends.item.started': 'a commencé une série',
  'friends.item.wanted': 'veut voir une série',
  'friends.item.liked': 'aime une série',
  // ⚠️ Le seul fait du fil qui nomme l'œuvre, parce que c'est le seul qui la porte : le
  // titre vient de l'instantané local du lecteur, sans un appel de plus. Les autres disent
  // « une série » faute de pouvoir le payer.
  'friends.item.reviewed': 'a écrit sur',
  // Le quiz personnel. ⚠️ Il se calcule sur le journal local : aucune de ces phrases ne
  // doit promettre un score ou un classement — il n'y en a pas, et il ne peut pas y en
  // avoir sans un calcul serveur.
  'quiz.title': 'Une question pour vous',
  'quiz.onDay': 'Quelle série regardiez-vous le {date} ?',
  'quiz.byCurve': 'Quelle série a cette trajectoire ?',
  'quiz.byEpisodes': 'Quelle série est-ce, épisode par épisode ?',
  // La manche du jour — les mêmes questions pour tout le monde, chronométrées.
  'friendQuiz.title': 'Votre monde',
  'friendQuiz.liked': 'Quelle série @{handle} a-t-il aimée ?',
  'friendQuiz.curve': 'Quelle série @{handle} a-t-il notée ainsi ?',
  'round.title': 'La manche du jour',
  'round.progress': 'Question {n}',
  'round.board': 'Le classement du jour',
  // ⚠️ Ce texte sert AUSSI quand aucune manche n'a été construite : il ne doit donc
  // jamais promettre un classement qui existerait ailleurs.
  'round.empty': 'Rien à afficher pour aujourd’hui.',
  'round.right': 'Juste — {points} points.',
  'round.wrong': 'Raté.',
  'round.next': 'Question suivante',
  'round.ask.cast': 'Quelle série ces acteurs jouent-ils ?',
  'round.ask.rating': 'Quelle série a cette note globale ?',
  'round.ask.seasons': 'Quelle série a ces notes de saison ?',
  'round.ask.episodes': 'Quelle série a ces notes d’épisode ?',
  'round.ask.poster': 'Quelle série est-ce ?',
  'round.ask.dates': 'Quelle série a ces dates de diffusion ?',
  'quiz.right': 'C’est bien ça.',
  'quiz.wrong': 'Non — c’était {title}.',
  'friends.followingLabel': 'Vous suivez',
  'friends.unfollow': 'ne plus suivre',
  'friends.followersLabel': 'Vous suivent',
  'friends.followBack': 'suivre en retour',
  'friends.visibility': 'Qui peut voir ce que vous publiez',
  'friends.visibility.private': 'Personne',
  'friends.visibility.followers': 'Ceux qui vous suivent',
  'friends.visibility.public': 'Tout le monde',
  'friends.item.season': 'la saison {season} — {stars} ★',
  'sync.adopt.title': 'Un journal existe déjà sur cet appareil',
  'sync.adopt.body.one':
    'Il contient {n} série. Est-il à vous ? Si cet appareil est partagé, répondez non : ce journal restera où il est.',
  'sync.adopt.body.other':
    'Il contient {n} séries. Est-il à vous ? Si cet appareil est partagé, répondez non : ce journal restera où il est.',
  'sync.adopt.yes': 'Oui, c’est le mien',
  'sync.adopt.no': 'Non, le laisser ici',
  'account.delete.title': 'Supprimer mon compte',
  'account.delete.body':
    'Immédiatement, sans délai de grâce. Exportez d’abord vos notes : elles vivent dans ce navigateur et n’en partiront pas, mais votre compte, lui, ne se rétablit pas.',
  'account.delete.confirm': 'Supprimer définitivement',
  'account.delete.failed': 'La suppression a échoué. Réessayez, ou écrivez-nous.',
  'account.callback.working': 'Connexion en cours…',
  'account.callback.done': 'C’est bon, vous êtes connecté.',
  'account.callback.wrongBrowser':
    'Ce lien a été demandé depuis un autre navigateur. Ouvrez-le là où vous l’avez demandé, ou saisissez le code à six chiffres du même e-mail.',
  'account.callback.expired':
    'Ce lien a expiré ou a déjà servi. Demandez-en un nouveau.',
  'account.callback.nothing': 'Il n’y a rien à valider ici.',
  'account.callback.back': 'Retour à mon compte',
  'privacy.title': 'Confidentialité',
  'privacy.updated': 'À jour du 10 août 2026.',
  'privacy.now.title': 'Sans compte, vos notes ne quittent pas ce navigateur',
  'privacy.now.body':
    'Il n’y a ni traceur, ni mesure d’audience, ni cookie publicitaire. Vos positions, vos notes et vos décisions sont écrites dans le stockage local de cet appareil. Sans compte, elles ne sont envoyées nulle part — et vous pouvez le vérifier : la politique de sécurité du site n’autorise le navigateur à contacter aucun serveur en dehors du nôtre.',
  'privacy.account.title': 'Si vous créez un compte',
  'privacy.account.body':
    'Le compte est facultatif : tout le site se visite et s’utilise sans. Si vous en créez un, nous traitons votre adresse e-mail — c’est elle qui reçoit le lien de connexion, et il n’y a pas de mot de passe à retenir. Elle est conservée par notre hébergeur de base de données, dans l’Union européenne, et ne sert qu’à vous reconnaître. Supprimer votre compte l’efface immédiatement, sans délai ni condition.',
  'privacy.sync.title': 'Ce que la synchronisation envoie',
  'privacy.sync.body':
    'Avec un compte, une copie de votre journal — positions, notes, décisions — est envoyée à cette même base, pour que vous le retrouviez sur vos autres appareils. Elle reste lisible par vous seul : la base refuse toute lecture qui ne vient pas de votre compte. L’original, lui, reste dans ce navigateur, et c’est lui qui fait foi : si nos serveurs tombent, le site continue de fonctionner.',
  'privacy.stops.title': 'La carte des abandons',
  'privacy.stops.body':
    'Avec un compte, une seconde donnée part : pour chaque série, jusqu’où vous êtes allé et, si vous l’avez abandonnée, à quelle saison. Elle est enregistrée séparément, sans votre nom, dans une table que personne ne peut lire — pas même vous, pas même depuis votre propre compte. Elle ne sert qu’à un total : « sur ceux qui arrivent à la saison 4, tant s’y arrêtent », et ce total ne s’affiche qu’à partir de cinq personnes. Vous pouvez ne pas y participer depuis la page Compte ; le refus retire aussi ce qui y avait déjà été posé.',
  'privacy.tmdb.title': 'Ce qui vient d’ailleurs',
  'privacy.tmdb.body':
    'Les fiches de séries et les affiches proviennent de TMDB. Charger une affiche adresse une requête à leur serveur d’images, qui voit donc votre adresse IP — comme pour toute image sur le web. Nous ne leur transmettons rien d’autre.',
  'privacy.hosting.title': 'Hébergement',
  'privacy.hosting.body':
    'Le site est hébergé par Vercel, qui conserve des journaux techniques de connexion. Nous n’y ajoutons aucune mesure d’audience et n’installons aucun cookie.',
  'privacy.rights.title': 'Vos données, et comment les récupérer',
  'privacy.rights.body':
    'L’export intégral est immédiat et sans condition : il se trouve dans votre bibliothèque, et il est calculé ici, sans rien demander à personne. Sans compte, effacer les données du navigateur suffit à tout supprimer. Avec un compte, il faut aussi supprimer le compte — c’est ce qui efface la copie conservée sur nos serveurs, et cela se fait en un clic depuis la page Compte.',
  'privacy.next.title': 'Ce qui changera ensuite',
  'privacy.next.body':
    'Viendront ensuite les profils et le fil d’activité : ce que vous choisirez de rendre visible à d’autres personnes. Rien de ce que vous écrivez aujourd’hui ne le deviendra sans que vous le décidiez, et cette page sera mise à jour avant, pas après. C’est ainsi que la phrase « rien ne sort de ce navigateur » a été retirée le jour où les comptes sont arrivés, et non le jour où quelqu’un l’aurait remarqué.',
  'tallyPage.title': 'Mon bilan',
  'tallyPage.lede': 'Ce que vos séries disent de vous. Calculé ici, dans ce navigateur.',
  'tallyPage.empty.title': 'Rien à mesurer pour l’instant',
  // ⚠️ Le texte du dessous s'adressait à quelqu'un qui n'a rien fait. Celui-ci s'adresse à
  // quelqu'un qui a TOUT fait et à qui il manque le catalogue — le cas de l'import, donc le
  // parcours d'arrivée le plus important. Lui dire « vous n'avez rien noté » serait faux.
  'tallyPage.empty.uncounted.one':
    '{n} série est suivie, mais le catalogue ne l’a pas encore renseignée : ouvrez sa fiche une fois et les heures se comptent.',
  'tallyPage.empty.uncounted.other':
    '{n} séries sont suivies, mais le catalogue ne les a pas encore renseignées : ouvrez leur fiche une fois et les heures se comptent.',
  'tallyPage.empty.body':
    'Le bilan apparaît dès que vous avez noté ou positionné quelques séries. Il ne demande aucun compte et ne quitte pas cet appareil.',
  'agenda.thisWeek': 'Cette semaine',
  'agenda.thisMonth': 'Ce mois-ci',
  'agenda.later': 'Plus tard',
  'nav.convert': 'Vous venez de TV Time, Trakt ou Simkl ? Reprenez votre historique.',
  'footer.disclaimer': 'Ce produit utilise l’API TMDB sans être approuvé ni certifié par TMDB.',

  'home.h1': 'Une série n’est pas un long film.',
  // Decoupe en trois parce que le milieu est en italique. Une seule chaine avec du
  // balisage dedans obligerait a faire confiance au traducteur sur du HTML.
  'home.lede.before': 'On ne demande pas à une série si elle est bien. On demande ',
  'home.lede.em': 'si elle le reste',
  'home.lede.after':
    ' — combien de temps elle prend, où elle décroche, et depuis combien de temps on attend la suite.',
  'home.waiting.title': 'En attente',
  'home.waiting.subtitle': 'Depuis combien de temps, exactement.',
  'home.week.title': 'Cette semaine',
  'home.week.subtitle': 'Ce dont tout le monde parle en ce moment.',
  'home.airing.title': 'En cours de diffusion',
  'home.airing.subtitle': 'Le prochain épisode arrive vraiment.',
  'home.unavailable':
    'Le catalogue est momentanément indisponible. La recherche fonctionne peut-être encore.',

  'safety.title': 'Ces notes ne vivent que dans ce navigateur',
  'safety.body':
    'Rien n’est envoye ailleurs — c’est voulu. Mais un navigateur oublie : effacer les donnees de navigation, ou simplement ne pas revenir pendant quelques jours sur iPhone, suffit a tout perdre.',
  'safety.install': 'Installer l’application',
  // ⚠️ Ces deux lignes etaient sans accents — « Installee sur l'ecran » —, et c'est la
  // premiere chose que lit quelqu'un qui a des notes sans compte. Trouve **sur une capture
  // d'ecran**, le 2026-08-05 : ni le typage, ni la suite de tests, ni le build ne voient qu'un
  // texte francais a perdu ses accents. C'est exactement ce que la passe « a l'oeil » du
  // lot 7 existe pour trouver, et les deux sessions precedentes n'avaient pu prendre
  // aucune capture.
  'safety.installWhy': 'Installée sur l’écran d’accueil, elle garde vos notes.',
  'safety.iosHint': 'Sur iPhone : bouton Partager, puis « Sur l’écran d’accueil ».',
  'safety.export': 'Enregistrer une copie',
  'safety.later': 'Plus tard',
  'safety.done': 'C’est fait — vos notes sont a l’abri.',

  // --- Saisons -------------------------------------------------------------
  'seasons.title': 'Saisons',
  'seasons.none': 'Rien n’a encore été diffusé.',
  'seasons.seasonN': 'Saison {n}',
  'seasons.specials': 'Épisodes spéciaux disponibles, hors de la continuité principale.',
  'seasons.warn.split.one':
    'Saison {list} probablement diffusée en deux parties — le découpage du catalogue peut différer de celui du diffuseur.',
  'seasons.warn.split.other':
    'Saisons {list} probablement diffusées en deux parties — le découpage du catalogue peut différer de celui du diffuseur.',
  'seasons.warn.unaired.one': 'Saison {list} annoncée mais pas encore diffusée.',
  'seasons.warn.unaired.other': 'Saisons {list} annoncées mais pas encore diffusées.',
  'seasons.warn.single': 'Mini-série : une seule saison, et c’est toute l’histoire.',

  // --- Courbe --------------------------------------------------------------
  'chart.aria': 'Note par saison',
  'chart.seasonTitle': 'Saison {n} — {v}/5',
  'chart.shape': 'Forme',
  'chart.peak': 'Pic',
  'chart.consistency': 'Constance',
  'shape.masterpiece': 'Tenue de bout en bout',
  'shape.steady': 'Constante',
  'shape.decline': 'Décroche en route',
  'shape.grower': 'S’améliore',
  'shape.erratic': 'En dents de scie',
  'shape.undifferentiated': 'Trop homogène pour conclure',
  'shape.insufficient_data': 'Pas assez de saisons notées',
  'chart.break.one':
    'Décrochage après la saison {after} — {drop} étoile de moins à la saison {before}{gap}.',
  'chart.break.other':
    'Décrochage après la saison {after} — {drop} étoiles de moins à la saison {before}{gap}.',
  'chart.break.gap': ' (saisons non contiguës)',

  // --- Hors ligne et page introuvable --------------------------------------
  'offline.title': 'Hors ligne',
  'offline.heading': 'Pas de réseau',
  'offline.body':
    'Le catalogue a besoin d’une connexion. Votre bibliothèque, elle, est gardée dans ce navigateur : elle reste consultable.',
  'offline.open': 'Ouvrir ma bibliothèque',
  'notFound.heading': 'Rien ici.',
  'notFound.body': 'Cette série n’existe pas dans le catalogue, ou son identifiant a changé.',

  // --- Recherche -----------------------------------------------------------
  'search.placeholder': 'Chercher une série…',
  'search.submit': 'Chercher',
  'search.title': 'Recherche',
  // Les guillemets font partie de la traduction : le francais met des chevrons et une
  // espace insecable, l'anglais des guillemets courbes colles au mot.
  'search.titleQuery': '« {q} »',
  'search.prompt': 'Tapez le nom d’une série.',
  'search.unavailable': 'Le catalogue est momentanément indisponible. Réessayez dans un instant.',
  'search.none': 'Aucun résultat pour « {q} ».',
  'search.count.one': '{n} résultat pour « {q} »',
  'search.count.other': '{n} résultats pour « {q} »',

  // --- Noter ---------------------------------------------------------------
  'rating.of': 'Note de {what}',
  'rating.stars': '{n} sur 5',
  'rating.season': 'la saison {n}',
  'rating.episode': 'l’épisode S{s}E{e}',

  // --- Ma progression ------------------------------------------------------
  'progress.aria': 'Ma progression',
  'progress.title': 'Où j’en suis',
  'lives.local': 'gardé sur cet appareil, rien n’est envoyé',
  'lives.synced': 'gardé sur cet appareil, et sur votre compte',
  'progress.want': 'Je veux la voir',
  'progress.wanted': '✓ Dans ma liste',
  'progress.like': 'J’aime',
  'progress.liked': 'Aimée',
  'review.write': 'Écrire ce que j’en ai pensé',
  'review.edit': 'Modifier ma critique',
  'review.onSeries': 'Sur la série',
  'review.onSeason': 'Sur la saison {n}',
  'review.placeholder': 'Ce que vous en avez pensé, pour vous — et pour ceux qui hésitent.',
  'review.save': 'Enregistrer',
  'review.noSpoiler': 'Sans spoiler',
  'review.spoilerThrough': 'Va jusqu’à la saison {n}',
  'review.tooLong': 'Trop long : {n} caractères au maximum.',
  'review.publishLocked': 'Publier n’est pas encore possible : la voie de signalement n’est pas ouverte.',
  'review.hidden': 'Écrit sur la saison {n} — au-delà de là où vous en êtes.',
  'review.hiddenSeries': 'Contient des révélations sur la suite.',
  'review.reveal': 'Afficher quand même',
  'review.none': 'Personne n’a encore écrit sur cette série.',

  // ⚠️ Une seule phrase pour « ce nom n'existe pas » ET « ce profil ne vous est pas
  // visible ». Les distinguer ferait de la page un oracle : on testerait des noms un par un
  // pour savoir lesquels sont pris. La visibilité par défaut étant `followers`, presque tous
  // les profils sont invisibles à un inconnu — l'oracle marcherait donc sur tout le monde.
  'profile.unknown': 'Ce nom ne correspond à personne, ou ce profil n’est pas visible pour vous.',
  // ⚠️ Distinct de `profile.reviews` : constaté au navigateur, l'onglet s'intitulait « Ce
  // qu'elle ou il a écrit », ce qui ne désigne pas une page. Un titre nomme la page, une
  // section nomme son contenu — les confondre marche tant qu'on ne regarde pas l'onglet.
  'profile.title': 'Profil',
  'profile.lists': 'Ses listes',
  'profile.reviews': 'Ce qu’elle ou il a écrit',
  'profile.none': 'Rien de public à lire ici pour l’instant.',
  'profile.follow': 'Suivre',
  'profile.unfollow': 'Ne plus suivre',
  'profile.self': 'C’est vous.',
  'profile.followsYou': 'vous suit',
  'profile.needName': 'Prenez un nom pour suivre',
  // Les trois faces (9.1). ⚠️ Ce sont des LIBELLÉS, pas des noms de baptême : les vrais
  // noms des trois équipes sont un choix de Tristan. Ils décrivent le comportement observé,
  // ce qui est au moins vrai en attendant.
  'face.finisher': 'Va au bout',
  'face.cutter': 'Coupe net',
  'face.rewatcher': 'Revient toujours',
  'face.title': 'Votre face',
  'face.why.finisher': 'Vous menez au bout ce que vous commencez.',
  'face.why.cutter': 'Vous coupez tôt, et sans regret.',
  'face.why.rewatcher': 'Vous revenez à celles que vous aimez.',
  // ⚠️ Ce texte est le seul écran de la face au démarrage à froid, et il doit dire « pas
  // encore », jamais « rien ». Une identité ne se refuse pas, elle se mérite.
  'face.pending':
    'Votre face se découvre. Elle apparaîtra quand vous aurez mené assez de séries jusqu’à une décision — terminée, abandonnée, ou revue.',
  // 9.3 — l'annonce de la bascule. Deux phrases parce que ce ne sont pas deux moments :
  // découvrir sa face pour la première fois n'est pas basculer, et dire « vous avez
  // basculé » à quelqu'un qui n'avait rien serait faux.
  'face.switch.first': 'Votre face est apparue.',
  'face.switch.changed': 'Vous avez fait volte-face.',
  'people.title': 'Qui d’autre l’a vue',
  'people.liked': 'l’aime',
  'people.finished': 'l’a terminée',
  'review.title': 'Ce qu’en disent les gens que vous suivez',
  'progress.start': 'Je l’ai commencée',
  'progress.season': 'Saison',
  'progress.episode': 'Épisode',
  'progress.orGrid': 'ou cliquez un épisode dans la grille',
  'progress.seasonRatings': 'Mes notes de saison',
  'progress.seasonN': 'Saison {n}',
  'progress.suggest': 'vos épisodes donnent {v}',
  'progress.remaining': 'Il vous reste {episodes} · {time}',
  // 🔴 Disait « Vous venez de finir la saison {n} », et `seasonToRate` refuse explicitement
  // de verifier ça : il rend « la saison la plus récente entièrement vue et non notée »,
  // et son propre commentaire explique pourquoi le critère strict serait inutilisable (la
  // fenêtre se refermerait dès l'épisode suivant). Vu à l'écran le 2026-08-11 : position
  // S5E16, saison 5 notée, et le rappel annonçait « vous venez de finir la saison 4 ».
  // Le texte affirmait ce que le code avait décidé de ne pas savoir.
  'progress.rateSeason': 'Vous avez vu la saison {n} et vous ne l’avez pas notée — elle valait combien ?',
  'decision.continuing': 'Je continue',
  'decision.paused': 'En pause',
  'decision.abandoned': 'J’abandonne',
  'decision.completed': 'Terminée',

  // --- Grille d'episodes ---------------------------------------------------
  'grid.public': 'Notes du public',
  'grid.mine': 'Mes notes',
  'grid.captionMine': 'Vos notes par épisode, saison par saison',
  'grid.captionPublic': 'Note du public par épisode, saison par saison',
  'grid.cell': 'Saison {s}, épisode {e} : {v} sur 10',
  'grid.cellMine': ', votre note {n} sur 5',
  'grid.here': 'J’en suis là',
  'grid.skip': 'Sauté',
  'grid.ahead': 'Vu en avance',
  'grid.publicShort': 'public',
  'grid.you': 'vous',
  'grid.scaleStars': '5 étoiles',
  'grid.scaleCeiling': '{n}/10 et plus',

  // --- Ma bibliotheque -----------------------------------------------------
  'library.title': 'Ma bibliothèque',
  'library.lede': 'Ce que vous suivez, ce qui revient, et ce que vous vous étiez promis.',
  'library.returning.title': 'Ça revient',
  'library.returning.subtitle': 'Ce que vous suivez et qui repasse bientôt.',
  'library.resuming.title': 'Reprendre',
  'library.resuming.subtitle': 'Là où vous vous étiez arrêté.',
  'library.wanted.title': 'À voir',
  'library.wanted.subtitle': 'Ce que vous vous êtes promis.',
  'library.finished.title': 'Terminées et abandonnées',
  'library.finished.subtitle': 'Ce qui est derrière vous.',
  'library.empty.title': 'Rien ici pour l’instant',
  'library.empty.before': 'Ouvrez une série et dites ',
  'library.empty.em': '« je veux la voir »',
  'library.empty.after':
    ', ou cliquez un épisode pour marquer où vous en êtes.',
  'library.empty.browse': 'Parcourir',
  'library.empty.search': 'Chercher une série',
  'library.card.tracked': 'Série suivie',
  'library.card.today': 'nouvel épisode aujourd’hui',
  'library.card.tomorrow': 'nouvel épisode demain',
  'library.card.inDays.one': 'nouvel épisode dans {n} j',
  'library.card.inDays.other': 'nouvel épisode dans {n} j',
  'library.card.toWatch': 'à voir',

  // --- Reprendre (accueil) -------------------------------------------------
  'resume.returning': 'Ça revient',
  'resume.resume': 'Reprendre',
  'resume.yourSeries': 'votre série en cours',
  'resume.today': 'aujourd’hui',
  'resume.tomorrow': 'demain',
  'resume.inDays.one': 'dans {n} jour',
  'resume.inDays.other': 'dans {n} jours',
  'resume.at': 'vous en étiez à S{s}E{e}',
  'resume.library': 'ma bibliothèque →',

  // --- Sauvegarde ----------------------------------------------------------
  'backup.aria': 'Sauvegarde',
  'backup.title': 'Sauvegarder, ou changer d’appareil',
  'backup.body.before': 'Votre bibliothèque est gardée ',
  'backup.body.em': 'dans ce navigateur',
  'backup.body.after':
    ', et nulle part ailleurs. Elle ne suit pas d’un appareil à l’autre, et vider les données du navigateur l’efface. Le fichier ci-dessous est votre copie : il se relit ici même, ou sur un autre appareil — l’import complète, il ne remplace pas.',
  'backup.export': 'Exporter mon journal',
  'backup.import': 'Importer un fichier',
  'backup.exported.one': '{n} série exportée.',
  'backup.exported.other': '{n} séries exportées.',
  'backup.unreadable': 'Ce fichier ne contient pas de journal lisible. Rien n’a été modifié.',
  'backup.merged.one': 'Fusionné. Votre bibliothèque compte {n} série.',
  'backup.merged.other': 'Fusionné. Votre bibliothèque compte {n} séries.',

  // --- Reprendre un historique venu d'ailleurs ------------------------------
  'convert.title': 'Reprendre votre historique',
  'convert.lede':
    'TV Time a fermé le 15 juillet 2026, et vingt-six millions de personnes y ont perdu leur historique. Si vous en avez sauvé un fichier — de TV Time, Trakt, Simkl, ou d’ailleurs — vous pouvez le déposer ici.',
  'convert.aria': 'Import',
  'convert.pick': 'Choisir un fichier',
  'convert.local':
    'Le fichier est lu dans votre navigateur. Il n’est envoyé nulle part, et nous n’en gardons rien.',
  'convert.imported.one': '{n} série reprise.',
  'convert.imported.other': '{n} séries reprises.',
  'convert.skipped.one':
    '{n} série n’a pas pu être reprise : son identifiant TMDB manque dans le fichier.',
  'convert.skipped.other':
    '{n} séries n’ont pas pu être reprises : leur identifiant TMDB manque dans le fichier.',
  'convert.unreadable':
    'Rien de reconnaissable dans ce fichier. Votre bibliothèque est intacte — rien n’a été modifié.',
  'convert.tooBig': 'Ce fichier est trop volumineux pour être un export de séries.',
  'convert.honestTitle': 'Ce qui marche, et ce qui ne marche pas',
  'convert.honestBody':
    'Nous ne prétendons connaître aucun format en particulier : nous cherchons des identifiants TMDB partout où ils se trouvent, dans un JSON comme dans un tableau. Une série sans identifiant n’est pas reprise — la retrouver par son titre demanderait une recherche par série, et se tromperait sur les remakes, qui portent le même nom. Le compte de ce qui n’est pas passé s’affiche : gardez votre fichier d’origine.',
  'convert.mergeTitle': 'L’import complète, il ne remplace pas',
  'convert.mergeBody':
    'Importer sur un appareil déjà utilisé n’efface rien de ce que vous y avez fait. Vous pouvez donc importer plusieurs fichiers à la suite.',

  // --- Calendrier ----------------------------------------------------------
  'calendar.aria': 'Calendrier',
  'calendar.title': 'Les retours, dans mon agenda',
  'calendar.body':
    'Une saison sort tous les trois mois, et personne ne revient entre-temps. Ce fichier dépose les dates connues dans le calendrier que vous avez déjà : il vous rappellera la suite même si vous ne rouvrez pas ce site. Rien n’est envoyé nulle part, et aucune autorisation ne vous est demandée.',
  'calendar.download': 'Ajouter à mon calendrier',
  'calendar.count.one': '{n} date connue',
  'calendar.count.other': '{n} dates connues',
  'calendar.saved': 'Fichier enregistré.',

  // --- Mon gout ------------------------------------------------------------
  'taste.aria': 'Mon goût',
  'taste.title': 'La forme de mon goût',
  'taste.average': 'Ma moyenne',
  'taste.vsPublic': 'Face au public',
  'taste.aligned': 'aligné',
  'taste.onSeries.one': 'sur {n} série',
  'taste.onSeries.other': 'sur {n} séries',
  'taste.severe': 'plus sévère',
  'taste.generous': 'plus généreux',
  'taste.completedLabel': 'Menées au bout',
  'taste.finished.one': '{n} finie',
  'taste.finished.other': '{n} finies',
  'taste.dropped.one': '{n} abandonnée',
  'taste.dropped.other': '{n} abandonnées',
  'taste.abandonAt': 'J’abandonne en',
  'taste.seasonN': 'saison {n}',
  'taste.median': 'en médiane',
  'taste.basis.one': 'Calculé sur votre {n} note de saison{extra}. Rien de tout cela ne quitte ce navigateur.',
  'taste.basis.other': 'Calculé sur vos {n} notes de saison{extra}. Rien de tout cela ne quitte ce navigateur.',
  'taste.basisEpisodes.one': ' et {n} d’épisode',
  'taste.basisEpisodes.other': ' et {n} d’épisode',

  // --- Mes plateformes -----------------------------------------------------
  // Mes pays. ⚠️ Le texte ne promet pas de deviner : on choisit, on n'est pas devine.
  // Choisir son affiche. ⚠️ Aucun texte ne doit suggérer qu'on peut *envoyer* une image :
  // on ne propose que ce que le catalogue porte déjà.
  // ⚠️ « Masqué » et non « désactivé » : le calcul continue, seul l'affichage se tait.
  // Le cœur d'une critique. ⚠️ Libellés d'accessibilité : le symbole seul n'apprend rien
  // à un lecteur d'écran, et « aimer » n'est pas « noter ».
  'shareReview.save': 'Partager en image',
  'review.like': 'J’aime cette critique',
  'review.unlike': 'Retirer mon cœur',
  'convert.missedTitle': 'Voir lesquelles',
  'tally.hide': 'Masquer ce chiffre',
  'tally.hidden': 'Le temps passé est masqué.',
  'tally.show': 'L’afficher à nouveau',
  'artwork.aria': 'Choisir l’affiche',
  'artwork.open': 'Changer l’affiche',
  'artwork.close': 'Fermer',
  'artwork.poster': 'Affiche',
  'artwork.backdrop': 'Bannière',
  'artwork.default': 'Par défaut',
  'regions.aria': 'Mes pays',
  'regions.title': 'Mes pays',
  'regions.subtitle':
    'Où vous regardez. Choisissez-en plusieurs si vous voyagez — on ne devine rien.',
  'platforms.aria': 'Mes plateformes',
  'platforms.title': 'Mes abonnements',
  'platforms.subtitle':
    'Pour repérer d’un coup d’œil ce que vous pouvez regarder tout de suite.',

  // --- Ou la regarder ------------------------------------------------------
  'watch.aria': 'Où regarder',
  'watch.title': 'Où la regarder',
  'watch.youHave': 'Vous l’avez déjà : {list}.',
  'watch.flatrate': 'Inclus dans l’abonnement',
  'watch.free': 'Gratuit',
  'watch.ads': 'Gratuit avec publicité',
  'watch.rent': 'En location',
  'watch.buy': 'À l’achat',
  'watch.region': 'Disponibilité : {region}.',

  // --- Regles et moderation (5.0a) -----------------------------------------
  //
  // ⚖️ Textes a faire relire par quelqu'un dont c'est le metier. Ce qui est certain :
  // improviser au moment ou le premier signalement arrive est la pire des options.
  'rules.title': 'Les règles, et comment signaler',
  'rules.intro':
    'Ce que vous écrivez ici est visible par d’autres. Ces règles disent ce qui est retiré, comment le signaler, et ce que vous pouvez faire si vous n’êtes pas d’accord.',
  'rules.grounds.title': 'Ce qui est retiré',
  'rules.grounds.intro': 'Cette liste est courte, et c’est délibéré : ce qui n’y figure pas ne se retire pas.',
  'rules.ground.illegal': 'Contenu illicite — ce qui relève de la loi, pas de nos goûts.',
  'rules.ground.abuse': 'Harcèlement, menace, incitation à la haine visant une personne.',
  'rules.ground.privacy': 'Divulgation de la vie privée d’autrui : adresse, identité, image.',
  'rules.ground.spam': 'Spam, publicité, contenu automatisé.',
  'rules.ground.spoiler':
    'Révéler l’intrigue au-delà de ce qui est annoncé. Ailleurs c’est une impolitesse ; ici c’est une atteinte à la promesse du produit.',
  'rules.how.title': 'Comment signaler',
  'rules.how.body':
    'Écrivez à l’adresse de contact ci-dessous, en indiquant la page concernée et le motif. Un formulaire arrivera en même temps que les contenus publics.',
  'rules.how.noContact':
    'L’adresse de contact n’est pas encore renseignée. Tant qu’elle manque, aucun contenu public ne sera ouvert.',
  'rules.delay.title': 'Le délai',
  'rules.delay.body':
    'Réponse sous {hours} heures. Les signalements pour contenu illicite, harcèlement ou vie privée sont traités sans attendre ce délai.',
  'rules.delay.why':
    'Ce délai est celui d’une personne seule qui peut être absente un week-end. Annoncer plus court serait une promesse qu’un seul déplacement casse.',
  'rules.decision.title': 'Ce qui se passe ensuite',
  'rules.decision.hidden':
    'Un contenu retiré est **masqué, jamais supprimé** : son auteur le voit toujours, et une erreur de notre part reste réparable.',
  'rules.decision.told':
    'Son auteur est informé, avec le motif — pas seulement « votre contenu a été retiré ».',
  'rules.decision.contest':
    'Il peut contester à la même adresse. Un dispositif qui sait retirer mais pas rendre n’est pas de la modération.',
  'rules.contact.title': 'Point de contact',

  // --- Decoupages concurrents (4.4) ----------------------------------------
  //
  // Formulation deliberee : **on annonce la convention suivie, on ne crie pas a
  // l'erreur**. Nos chiffres ne sont pas faux — ils suivent l'ordre de diffusion de
  // TMDB. Ce qui serait faux est de laisser croire qu'il n'y en a qu'un, alors que
  // quelqu'un qui regarde sur Netflix compte autrement. Regle 8 : on signale.
  'ordering.title': 'Ce découpage n’est pas le seul',
  'ordering.explain':
    'Les chiffres de cette page suivent l’ordre de diffusion : {seasons} · {episodes}.',
  'ordering.seasons.one': '{n} saison',
  'ordering.seasons.other': '{n} saisons',
  'ordering.episodes.one': '{n} épisode',
  'ordering.episodes.other': '{n} épisodes',
  'ordering.alsoKnown': 'Elle existe aussi en :',
  'ordering.entry': '{name} — {seasons}, {episodes}',
  'ordering.more.one': 'et {n} autre découpage.',
  'ordering.more.other': 'et {n} autres découpages.',
  'ordering.caution':
    'Si vous la suivez dans un autre découpage, vos numéros de saison ne correspondent pas à ceux-ci.',

  // --- Revisionnage --------------------------------------------------------
  'rewatch.done.one': 'Vue une fois, en entier.',
  'rewatch.done.other': 'Vue {n} fois, en entier.',
  'rewatch.again.one': 'Vous la revoyez.',
  'rewatch.again.other': '{n}e visionnage.',
  'taste.rewatched': 'Ma série-refuge',
  'taste.rewatchedTimes.one': 'vue {n} fois',
  'taste.rewatchedTimes.other': 'vue {n} fois',

  // --- Le temps passé ------------------------------------------------------
  // « Au moins », toujours : les instantanés expirent, les séries visitées avant que le
  // journal mémorise la forme des séries ne sont pas comptées, et le catalogue ignore
  // souvent la durée d'un épisode. Le chiffre est un minorant et le dit.
  'tally.aria': 'Mon temps passé',
  'tally.title': 'Le temps que j’y ai passé',
  'tally.atLeast': 'Au moins {commitment}.',
  'tally.episodes.one': '{n} épisode',
  'tally.episodes.other': '{n} épisodes',
  'tally.onSeries.one': '{episodes}, sur {n} série comptée',
  'tally.onSeries.other': '{episodes}, sur {n} séries comptées',
  'tally.heaviest': 'Surtout',
  'tally.heaviestOnce': '{title} : {commitment}',
  'tally.heaviestPasses.one': '{title} : {commitment}, vue {n} fois',
  'tally.heaviestPasses.other': '{title} : {commitment}, vue {n} fois',
  'tally.missing.one':
    '{n} série suivie n’a pas pu être comptée : son instantané a expiré, ou le catalogue ignore la durée de ses épisodes. Le vrai total est plus élevé.',
  'tally.missing.other':
    '{n} séries suivies n’ont pas pu être comptées : leur instantané a expiré, ou le catalogue ignore la durée de leurs épisodes. Le vrai total est plus élevé.',
  // 9.0 — la provenance. Ces heures-là, le produit ne les a pas vues passer : il les a
  // lues dans un fichier importé. Le taire ferait passer un historique repris d'ailleurs
  // pour du temps vécu ici.
  // ⚠️ **Aucun accord ne porte sur `{commitment}`**, et c'est une contrainte, pas un
  // style : `formatCommitment` rend « 30 heures » (féminin pluriel) comme « 2 jours et
  // 12 h » (masculin). Le participe s'accorde donc avec « historique » et « temps », qui
  // sont écrits ici. Même règle que la ponctuation française de 9.6 — on compose sur le
  // modèle, jamais sur la valeur interpolée.
  'tally.declared':
    'Dont {commitment} d’historique repris d’un import — du temps que vous n’avez pas passé ici.',
  'tally.private': 'Calculé ici, sur cet appareil — ce chiffre ne part nulle part.',

  // --- Saison en cours -----------------------------------------------------
  'season.aired.one': '{n} épisode sorti',
  'season.aired.other': '{n} épisodes sortis',
  // Un fait sur ce qui est diffusé, jamais un pronostic sur la suite.
  'season.below':
    'Saison {season} — {episodes}, notés {current}/10, soit {gap} sous la moyenne de la série.',
  'season.above':
    'Saison {season} — {episodes}, notés {current}/10, soit {gap} au-dessus de la moyenne de la série.',

  // --- Rattrapage ----------------------------------------------------------
  'catchup.days.one': '{n} jour',
  'catchup.days.other': '{n} jours',
  'catchup.pace': '{episodes} en {days} avant la suite — {time} par jour.',
  // Formulation distincte quand le rythme ne tient pas dans une soirée : « il faudrait »
  // reconnaît que ce n'est pas un plan, au lieu de le présenter comme tel.
  'catchup.tight': '{episodes} en {days} avant la suite — il faudrait {time} par jour.',
  'catchup.plain': '{episodes} en {days} avant la suite.',

  // --- Point d'entree ------------------------------------------------------
  'entry.title': 'Elle démarre lentement',
  'entry.body.one':
    'Le premier épisode est noté {before}/10 ; la suite, {after}/10. Ça décolle à S{s}E{e}.',
  'entry.body.other':
    'Les {n} premiers épisodes sont notés {before}/10 ; la suite, {after}/10. Ça décolle à S{s}E{e}.',

  // --- Trajectoire ---------------------------------------------------------
  'traj.aria': 'Trajectoire',
  'traj.srTitle': 'Trajectoire saison par saison',
  'traj.yours': 'Jusqu’où vous en êtes',
  'traj.seasonsTo': 'saisons 1 à {n}',
  'traj.hidden.one': '{n} saison au-delà de votre position n’est pas affichée.',
  'traj.hidden.other': '{n} saisons au-delà de votre position ne sont pas affichées.',
  'traj.seeMore': 'Voir la suite de la trajectoire',
  'traj.seeAll': 'Voir la trajectoire saison par saison',
  'traj.warning': 'contient un jugement sur les saisons suivantes',
  'traj.episodeByEpisode': 'Épisode par épisode',
  'traj.clickHint': 'Cliquez un épisode pour dire où vous en êtes, ou le noter.',
  'traj.stop.before': 'S’arrêter après la saison {n} ramène la série à ',
  'traj.stop.after': ', au lieu de ~ {full}.',
  'traj.source':
    'Établie à partir des notes du public TMDB, saison par saison — pas des notes de ce site. Ces notes se ressemblent beaucoup d’une saison à l’autre : les écarts comptent plus que les valeurs.',
  // --- La carte des abandons -----------------------------------------------
  // ⚠️ Le mot « abandon » est assume : c'est ce que le geste dit, et l'adoucir
  // (« interruption », « pause ») rendrait la mesure incomprehensible.
  'stops.aria': 'Où l’on décroche',
  'stops.title': 'Où l’on décroche',
  'stops.verdict': '{rate} % de ceux qui arrivent à la saison {s} s’y arrêtent.',
  'stops.basis': 'mesuré sur {people}',
  'stops.people.one': '1 personne',
  'stops.people.other': '{n} personnes',
  'stops.hidden': 'Il se passe quelque chose plus loin.',
  'stops.seeAll': 'Voir la carte entière',
  'stops.warning': 'contient la saison où l’on décroche',
  'stops.reached.one': '1 arrivé',
  'stops.reached.other': '{n} arrivés',
  'stops.left.one': '1 s’arrête',
  'stops.left.other': '{n} s’arrêtent',
  // ⚠️ Cette phrase est la raison d'etre de tout l'encart : elle dit **pourquoi** ce chiffre
  // n'est pas le meme que celui du dessus, et sans elle les deux se contredisent sans
  // explication.
  'stops.source':
    'Calculé sur les abandons déclarés ici, jamais sur les notes du public — celles-ci ne recueillent que l’avis de ceux qui ont persévéré.',
  'stops.opt.title': 'La carte des abandons',
  'stops.opt.body':
    'Jusqu’où vous allez dans une série, et où vous vous arrêtez, entrent sans votre nom dans une statistique que personne ne peut relire ligne à ligne. C’est elle qui permet de dire où une série perd son public — ce qu’aucune note ne dit, puisque seuls ceux qui sont restés notent.',
  'stops.opt.leave': 'Ne pas y participer',
  'stops.opt.left':
    'Vous n’entrez pas dans la carte des abandons, et ce qui y avait été posé a été retiré.',
  'stops.opt.rejoin': 'Y participer à nouveau',

  'traj.youAndPublic': 'Vous, et le public',
  'traj.you': 'vous {v}',
  'traj.publicIs': 'public {v}',
  'traj.likeMore': 'vous aimez plus',
  'traj.likeLess': 'vous aimez moins',
  'share.save': 'Enregistrer cette courbe en image',
  'share.saved': 'Image enregistrée.',
  'share.caption': 'saison par saison',
  'share.legendMine': 'mes notes · le public en gris',
  'share.legendPublic': 'notes du public TMDB',
} as const;

/**
 * Le jeu de cles du produit — **defini par le francais**, et par lui seul.
 *
 * ⚠️ Il vit ici et non dans `lib/i18n.ts` depuis 8.10, et le deplacement n'est pas cosmetique :
 * le moteur (`engine.ts`) a besoin de ce type, et l'aller chercher dans `lib/i18n.ts`
 * l'aurait fait dependre du module qui importe **les deux** dictionnaires. Un `import type`
 * s'efface a la compilation, mais la regle qu'on veut tenir est plus simple a verifier ainsi :
 * le moteur ne nomme aucun dictionnaire.
 */
export type MessageKey = keyof typeof FR;
