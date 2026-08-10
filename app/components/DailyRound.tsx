'use client';

import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/app/auth/AuthProvider';
import { useT } from '@/app/i18n/LocaleProvider';
import { authConfigFromEnv } from '@/src/auth/client';
import { FaceDot } from '@/app/components/FaceDot';
import {
  SocialClient,
  type QuizScore,
  type QuizServed,
  type QuizVerdict,
} from '@/src/social/client';

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
  const [board, setBoard] = useState<readonly QuizScore[]>([]);
  const [over, setOver] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const accessToken = account?.accessToken;

  useEffect(() => {
    const config = authConfigFromEnv();
    if (config === undefined) return;
    setClient(
      new SocialClient({
        url: config.url,
        anonKey: config.anonKey,
        accessToken: () => accessToken,
      }),
    );
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
      <section className="card space-y-3" aria-label={t('round.board')}>
        <h2 className="card-title">{t('round.board')}</h2>
        {board.length === 0 ? (
          // Mieux vaut se taire que compter zero : un classement vide dit qu'il n'y a
          // rien a montrer, pas que le produit est casse.
          <p className="prose-note">{t('round.empty')}</p>
        ) : (
          <ol className="space-y-1 text-sm">
            {board.map((line, rank) => (
              <li key={line.handle} className="flex items-center gap-2">
                <span className="w-6 text-(--color-muted)">{rank + 1}</span>
                <FaceDot face={line.face} />
                <span className="flex-1">@{line.handle}</span>
                <span className="font-medium">{line.score}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    );
  }

  if (question === undefined) return null;

  return (
    <section className="card space-y-4" aria-label={t('round.title')}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="card-title">{t('round.title')}</h2>
        <span className="text-sm text-(--color-muted)">
          {t('round.progress', { n: String(ordinal) })}
        </span>
      </div>

      <p className="prose-note">{t(askFor(question.kind))}</p>

      {/* Ce que la question montre. La forme depend de la famille, et chacune se tait
          proprement si le champ attendu manque — parsing tolerant, comme partout. */}
      <QuestionPrompt kind={question.kind} prompt={question.prompt} />

      <ul className="grid gap-2 sm:grid-cols-2">
        {question.choices.map((title, index) => (
          <li key={`${title}-${index}`}>
            <button
              type="button"
              disabled={verdict !== undefined}
              onClick={() => void answer(index)}
              className="btn w-full justify-start"
            >
              {title}
            </button>
          </li>
        ))}
      </ul>

      <p aria-live="polite" className="text-sm">
        {verdict === undefined
          ? ''
          : verdict.correct
            ? t('round.right', { points: String(verdict.points) })
            : t('round.wrong')}
      </p>

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
      <ul className="flex items-end gap-2">
        {scores.map((score, index) => (
          <li key={index} className="flex flex-col items-center gap-1">
            <span
              className="w-6 rounded-t bg-(--color-volt)"
              style={{ height: `${Math.max(4, Number(score) * 12)}px` }}
            />
            <span className="text-xs text-(--color-muted)">{index + 1}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (kind === 'rating' && typeof prompt['score'] === 'number') {
    return <p className="text-3xl font-medium">{Number(prompt['score']).toFixed(1)}</p>;
  }

  if (kind === 'dates' && Array.isArray(prompt['dates'])) {
    return (
      <ul className="flex flex-wrap gap-2 text-sm text-(--color-muted)">
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
