'use client';

import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/app/auth/AuthProvider';
import { useT } from '@/app/i18n/LocaleProvider';
import { Avatar } from '@/app/components/Avatar';
import { QuizBars } from '@/app/components/QuizBars';
import { QuizChoices, QuizVerdictLine } from '@/app/components/QuizChoices';
import {
  type SocialClient,
  type QuizScore,
  type QuizServed,
  type QuizVerdict,
} from '@/src/social/client';
import { socialFrom } from '@/app/social/socialFrom';

/**
 * La manche du jour : les memes questions pour tout le monde, chronometrees.
 *
 * ## Ce qui se passe cote serveur, et pourquoi ce composant est si maigre
 *
 * Il ne calcule **aucun score** et ne mesure **aucun temps**. Il demande une question,
 * l'affiche, renvoie un numero de choix, et lit ce que la base repond. Le chronometre
 * qu'il dessine est purement decoratif : celui qui compte est `now()` cote Postgres, entre
 * l'instant ou la question a ete servie et celui ou la reponse arrive.
 *
 * C'est ce qui rend la triche perdante plutot qu'impossible : chercher la reponse ailleurs
 * **coute des secondes**, donc des points. Verrouiller davantage serait payer cher pour un
 * jeu entre gens qui se suivent.
 *
 * ## ⚠️ Une question a la fois, et jamais deux fois
 *
 * On ne demande la suivante qu'apres avoir repondu. Precharger les six d'un coup
 * demarrerait six chronometres en meme temps, et les cinq dernieres seraient perdues avant
 * d'etre lues.
 */
/**
 * Les six familles, et la question posee pour chacune.
 *
 * ⚠️ **Derive d'une table et non d'un gabarit** : `t(\`round.ask.${kind}\`)` compilerait sur
 * n'importe quelle chaine, alors que le serveur peut etre en avance sur ce navigateur —
 * c'est exactement ce qu'a fait `005_liked.sql` en ajoutant un genre d'activite. Un genre
 * inconnu tombe donc sur une question generique au lieu d'afficher une cle brute.
 */
const ASK = {
  cast: 'round.ask.cast',
  rating: 'round.ask.rating',
  seasons: 'round.ask.seasons',
  episodes: 'round.ask.episodes',
  poster: 'round.ask.poster',
  dates: 'round.ask.dates',
} as const;

function askFor(kind: string): (typeof ASK)[keyof typeof ASK] {
  return Object.hasOwn(ASK, kind) ? ASK[kind as keyof typeof ASK] : ASK.poster;
}

export function DailyRound() {
  const { t } = useT();
  const { configured, ready, account } = useAuth();

  const [client, setClient] = useState<SocialClient | undefined>(undefined);
  const [ordinal, setOrdinal] = useState(1);
  const [question, setQuestion] = useState<QuizServed | undefined>(undefined);
  const [verdict, setVerdict] = useState<QuizVerdict | undefined>(undefined);
  // ⚠️ Tenu ici et non deduit du verdict, qui ne dit que juste ou faux : c'est lui qui
  // condamne les boutons des le clic, sinon on repond deux fois pendant l'aller-retour.
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const [board, setBoard] = useState<readonly QuizScore[]>([]);
  const [over, setOver] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const accessToken = account?.accessToken;

  useEffect(() => {
    setClient(socialFrom(accessToken));
  }, [accessToken]);

  const load = useCallback(
    async (social: SocialClient, want: number) => {
      const served = await social.quizServe(today, want);
      if (served === undefined) {
        // Plus de question : la manche est finie. C'est aussi ce qui arrive quand aucune
        // manche n'a ete construite — et dans les deux cas on montre le classement plutot
        // que d'annoncer une panne.
        setOver(true);
        setBoard(await social.quizBoard(today));
        return;
      }
      setQuestion(served);
      setVerdict(undefined);
      // Sans cette remise a zero, la question suivante arrivait avec ses boutons deja
      // condamnes par le choix de la precedente.
      setPicked(undefined);
    },
    [today],
  );

  useEffect(() => {
    if (client === undefined || account === undefined) return;
    void load(client, ordinal);
  }, [client, account, ordinal, load]);

  if (!configured || !ready) return null;
  // Une manche se joue avec un compte : le score doit appartenir a quelqu'un.
  if (account === undefined) return null;

  async function answer(choice: number) {
    if (client === undefined || question === undefined || verdict !== undefined) return;
    setVerdict(await client.quizAnswer(today, ordinal, choice));
  }

  if (over) {
    return (
      <section className="band" aria-label={t('round.board')}>
        <h2 className="row-title">{t('round.board')}</h2>
        {board.length === 0 ? (
          // Mieux vaut se taire que compter zero : un classement vide dit qu'il n'y a
          // rien a montrer, pas que le produit est casse.
          <p className="prose-note">{t('round.empty')}</p>
        ) : (
          <ol className="space-y-1 text-sm">
            {board.map((line, rank) => (
              <li key={line.handle} className="flex items-center gap-2">
                <span className="numeric w-6 text-(--color-muted)">{rank + 1}</span>
                <Avatar handle={line.handle} face={line.face} />
                <span className="flex-1 font-medium">@{line.handle}</span>
                <span className="numeric text-(--color-volt)">{line.score}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    );
  }

  if (question === undefined) return null;

  return (
    <section className="band" aria-label={t('round.title')}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="row-title">{t('round.title')}</h2>
        <span className="meta">
          {t('round.progress', { n: String(ordinal) })}
        </span>
      </div>

      <p className="prose-note">{t(askFor(question.kind))}</p>

      {/* Ce que la question montre. La forme depend de la famille, et chacune se tait
          proprement si le champ attendu manque — parsing tolerant, comme partout. */}
      <QuestionPrompt kind={question.kind} prompt={question.prompt} />

      {/* ⚠️ **Aucun `answer`** : ici c'est Postgres qui juge, et l'envoyer pour colorer la
          bonne reponse la rendrait lisible dans la page. */}
      <QuizChoices
        choices={question.choices.map((title, index) => ({ key: String(index), title }))}
        picked={picked}
        onPick={(key) => {
          setPicked(key);
          void answer(Number(key));
        }}
      />

      <QuizVerdictLine>
        {verdict === undefined
          ? ''
          : verdict.correct
            ? t('round.right', { points: String(verdict.points) })
            : t('round.wrong')}
      </QuizVerdictLine>

      {/* ⚠️ Pas de total cumule ici, et c'est une suppression volontaire : il etait tenu
          en memoire du composant, donc il repartait a zero au rechargement pendant que le
          classement, lui, restait juste. Deux chiffres qui disent la meme chose et ne
          s'accordent pas valent moins qu'un seul. Le score vrai est au classement. */}
      {verdict === undefined ? null : (
        <button type="button" className="btn btn-primary" onClick={() => setOrdinal(ordinal + 1)}>
          {t('round.next')}
        </button>
      )}
    </section>
  );
}

/**
 * Ce qu'une question donne a voir.
 *
 * ⚠️ Chaque famille lit **son** champ et se tait si il manque. Le serveur peut etre en
 * avance sur ce navigateur — c'est exactement ce qui est arrive avec `005_liked.sql` — et
 * une famille inconnue doit laisser une question jouable, pas un ecran casse.
 */
function QuestionPrompt({
  kind,
  prompt,
}: {
  readonly kind: string;
  readonly prompt: Record<string, unknown>;
}) {
  if (kind === 'cast' && Array.isArray(prompt['cast'])) {
    return (
      <ul className="flex flex-wrap gap-2 text-sm">
        {(prompt['cast'] as unknown[]).filter((name) => typeof name === 'string').map((name) => (
          <li key={String(name)} className="panel px-3 py-1">
            {String(name)}
          </li>
        ))}
      </ul>
    );
  }

  if ((kind === 'seasons' || kind === 'episodes') && Array.isArray(prompt['scores'])) {
    const scores = (prompt['scores'] as unknown[]).filter((one) => typeof one === 'number');
    return (
      <QuizBars
        points={scores.map((score, index) => ({
          label: String(index + 1),
          value: Number(score),
        }))}
        // 12 et non 16 : un score va jusqu'a 10, une note d'etoiles s'arrete a 5.
        perUnit={12}
      />
    );
  }

  if (kind === 'rating' && typeof prompt['score'] === 'number') {
    // ⚠️ La taille etait en dur (`text-3xl`) et `no-adhoc-typography` ne pouvait pas la
    // voir : elle n'inspecte que les `<h1..h6>`, or c'est un `<p>`.
    return <p className="tally-figure numeric">{Number(prompt['score']).toFixed(1)}</p>;
  }

  if (kind === 'dates' && Array.isArray(prompt['dates'])) {
    return (
      <ul className="flex flex-wrap gap-2 meta">
        {(prompt['dates'] as unknown[]).filter((one) => typeof one === 'string').map((one) => (
          <li key={String(one)} className="panel px-3 py-1">
            {String(one)}
          </li>
        ))}
      </ul>
    );
  }

  if (kind === 'poster' && typeof prompt['url'] === 'string') {
    // ⚠️ L'affiche vient de TMDB comme partout ailleurs dans le produit — rien n'est
    // heberge ici, donc aucune surface de droit d'auteur nouvelle.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={prompt['url']} alt="" className="max-h-64 rounded" />;
  }

  return null;
}
