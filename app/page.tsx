import { SearchForm } from '@/app/components/SearchForm';

export default function HomePage() {
  return (
    <div className="mx-auto max-w-2xl py-12 space-y-10">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          Une série n’est pas un long film.
        </h1>
        <p className="text-(--color-muted) leading-relaxed">
          On ne demande pas à une série si elle est bien. On demande{' '}
          <em>si elle le reste</em> — combien de temps elle prend, où elle décroche,
          et si elle est encore vivante.
        </p>
      </div>

      <SearchForm autoFocus />

      {/* Ces trois promesses sont tenues des la phase 1, sans un seul utilisateur :
          elles sont derivees de donnees publiques. C'est la reponse au demarrage a
          froid (`ROADMAP.md` §0.1). */}
      <ul className="space-y-3 text-sm text-(--color-muted)">
        <li>
          <strong className="text-(--color-text)">Où elle en est vraiment.</strong>{' '}
          En diffusion, entre deux saisons, ou annoncée comme revenant sans un épisode
          depuis deux ans.
        </li>
        <li>
          <strong className="text-(--color-text)">Ce qu’elle vous demande.</strong>{' '}
          Le temps total, en heures.
        </li>
        <li>
          <strong className="text-(--color-text)">Jusqu’où elle tient.</strong>{' '}
          Bientôt&nbsp;: la trajectoire saison par saison, et où les gens s’arrêtent.
        </li>
      </ul>
    </div>
  );
}
