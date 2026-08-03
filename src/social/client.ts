/**
 * Le social, en `fetch` brut sur PostgREST.
 *
 * Meme choix que `src/journal/remote.ts`, et pour la meme raison : lire et ecrire quelques
 * lignes, c'est un GET et un POST. Le SDK n'apporterait qu'une syntaxe, pour ~40 Ko.
 * L'exception reste l'authentification, ou l'on ne reecrit pas des jetons a la main.
 *
 * **Ce module ne decide rien.** Il transporte, et **ne leve jamais** : une panne du social
 * ne doit pas interrompre un produit dont tout le reste est local.
 */

import type { ActivityItem } from '../domain/activity';

export interface SocialOptions {
  readonly url: string;
  readonly anonKey: string;
  /** Relu a chaque appel : un jeton se rafraichit. */
  readonly accessToken: () => string | undefined;
  readonly fetchImpl?: typeof fetch;
}

export type Visibility = 'private' | 'followers' | 'public';

export interface Profile {
  readonly userId: string;
  readonly handle: string;
  readonly displayName?: string;
  readonly visibility: Visibility;
}

/** Ce qui peut arriver quand on reclame un nom. */
export type ClaimOutcome =
  | { readonly kind: 'claimed'; readonly profile: Profile }
  /** Deja pris, ou reserve. Les deux se disent pareil : le nom n'est pas disponible. */
  | { readonly kind: 'taken' }
  | { readonly kind: 'failed' };

/** Un fait du fil, tel qu'il revient du serveur — augmente de son auteur. */
export interface FeedItem extends ActivityItem {
  readonly handle: string;
  /** L'auteur du fait — necessaire pour pouvoir le signaler. */
  readonly authorId: string;
}

function rowToProfile(row: Record<string, unknown>): Profile {
  return {
    userId: String(row['user_id']),
    handle: String(row['handle']),
    ...(typeof row['display_name'] === 'string' ? { displayName: row['display_name'] } : {}),
    visibility: (row['visibility'] as Visibility) ?? 'followers',
  };
}

export class SocialClient {
  readonly #options: SocialOptions;
  readonly #fetch: typeof fetch;

  constructor(options: SocialOptions) {
    this.#options = options;
    this.#fetch = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  #headers(extra: Record<string, string> = {}): Record<string, string> {
    const token = this.#options.accessToken();
    return {
      apikey: this.#options.anonKey,
      Authorization: `Bearer ${token ?? this.#options.anonKey}`,
      'Content-Type': 'application/json',
      ...extra,
    };
  }

  #url(path: string): string {
    return `${this.#options.url.replace(/\/$/, '')}/rest/v1/${path}`;
  }

  async #json<T>(path: string): Promise<T | undefined> {
    try {
      const response = await this.#fetch(this.#url(path), { headers: this.#headers() });
      if (!response.ok) return undefined;
      return (await response.json()) as T;
    } catch {
      return undefined;
    }
  }

  /** Mon profil, ou `undefined` si je n'en ai pas encore reclame un. */
  async myProfile(userId: string): Promise<Profile | undefined> {
    const rows = await this.#json<Record<string, unknown>[]>(
      `profiles?user_id=eq.${encodeURIComponent(userId)}&select=*`,
    );
    const row = rows?.[0];
    return row === undefined ? undefined : rowToProfile(row);
  }

  /**
   * Reclame un nom.
   *
   * ⚠️ La disponibilite **n'est pas verifiee avant** : entre la verification et l'ecriture,
   * quelqu'un d'autre peut prendre le nom. C'est l'unicite de la base qui tranche, et le
   * conflit qui remonte ici — verifier d'abord ne ferait que rendre la course plus rare,
   * donc le defaut plus difficile a reproduire.
   */
  async claim(userId: string, handle: string, visibility: Visibility): Promise<ClaimOutcome> {
    try {
      const response = await this.#fetch(this.#url('profiles'), {
        method: 'POST',
        headers: this.#headers({ Prefer: 'return=representation' }),
        body: JSON.stringify({ user_id: userId, handle, visibility }),
      });
      if (response.ok) {
        const rows = (await response.json()) as Record<string, unknown>[];
        const row = rows[0];
        return row === undefined
          ? { kind: 'failed' }
          : { kind: 'claimed', profile: rowToProfile(row) };
      }
      // 409 : unicite. 400 : le declencheur des noms reserves, ou la forme refusee.
      return response.status === 409 || response.status === 400
        ? { kind: 'taken' }
        : { kind: 'failed' };
    } catch {
      return { kind: 'failed' };
    }
  }

  async setVisibility(userId: string, visibility: Visibility): Promise<boolean> {
    try {
      const response = await this.#fetch(
        this.#url(`profiles?user_id=eq.${encodeURIComponent(userId)}`),
        { method: 'PATCH', headers: this.#headers(), body: JSON.stringify({ visibility }) },
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Cherche quelqu'un par son nom.
   *
   * ⚠️ Correspondance **exacte**, jamais partielle : une recherche approchante sur les
   * profils est un annuaire, c'est-a-dire un moyen de parcourir les gens. Ici on ne trouve
   * que quelqu'un dont on connait deja le nom.
   */
  async findByHandle(handle: string): Promise<Profile | undefined> {
    const rows = await this.#json<Record<string, unknown>[]>(
      `profiles?handle=eq.${encodeURIComponent(handle)}&select=*`,
    );
    const row = rows?.[0];
    return row === undefined ? undefined : rowToProfile(row);
  }

  async follow(followerId: string, followeeId: string): Promise<boolean> {
    try {
      const response = await this.#fetch(this.#url('follows'), {
        method: 'POST',
        headers: this.#headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify({ follower_id: followerId, followee_id: followeeId }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async unfollow(followerId: string, followeeId: string): Promise<boolean> {
    try {
      const response = await this.#fetch(
        this.#url(
          `follows?follower_id=eq.${encodeURIComponent(followerId)}&followee_id=eq.${encodeURIComponent(followeeId)}`,
        ),
        { method: 'DELETE', headers: this.#headers() },
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  /** Les profils que je suis. */
  async following(followerId: string): Promise<readonly Profile[]> {
    const rows = await this.#json<{ followee_id: string }[]>(
      `follows?follower_id=eq.${encodeURIComponent(followerId)}&select=followee_id`,
    );
    if (rows === undefined || rows.length === 0) return [];
    const ids = rows.map((row) => row.followee_id);
    const profiles = await this.#json<Record<string, unknown>[]>(
      `profiles?user_id=in.(${ids.map(encodeURIComponent).join(',')})&select=*`,
    );
    return (profiles ?? []).map(rowToProfile);
  }

  /**
   * Le fil.
   *
   * Un seul appel, jointure cote PostgREST : sans elle il faudrait une requete par personne
   * suivie, c'est-a-dire un cout qui grandit avec le nombre d'amis — exactement le cout
   * marginal par utilisateur que ce produit refuse partout ailleurs.
   *
   * RLS fait le filtrage : on demande tout, la base ne rend que le visible.
   */
  async feed(limit = 50): Promise<readonly FeedItem[]> {
    const rows = await this.#json<Record<string, unknown>[]>(
      `activity?select=kind,subject,season,stars,happened_on,profiles!inner(handle,user_id)&order=happened_on.desc&limit=${limit}`,
    );
    return (rows ?? []).flatMap((row) => {
      const author = row['profiles'] as { handle?: unknown; user_id?: unknown } | undefined;
      if (typeof author?.handle !== 'string' || typeof author.user_id !== 'string') return [];
      const season = row['season'];
      const stars = row['stars'];
      return [
        {
          kind: row['kind'] as FeedItem['kind'],
          subject: row['subject'] as FeedItem['subject'],
          happenedOn: String(row['happened_on']),
          handle: author.handle,
          authorId: author.user_id,
          ...(typeof season === 'number' ? { season } : {}),
          ...(stars === null || stars === undefined
            ? {}
            : { stars: Number(stars) as FeedItem['stars'] }),
        } as FeedItem,
      ];
    });
  }

  /**
   * Pousse mon activite.
   *
   * `merge-duplicates` sur la cle naturelle : republier les memes faits ne duplique rien,
   * ce qui permet de pousser **tout** ce qui est publiable a chaque fois plutot que de
   * tenir un journal de ce qui a deja ete envoye — un etat de plus a synchroniser, et donc
   * un etat de plus a desynchroniser.
   */
  async publish(userId: string, items: readonly ActivityItem[]): Promise<boolean> {
    if (items.length === 0) return true;
    try {
      const response = await this.#fetch(this.#url('activity'), {
        method: 'POST',
        headers: this.#headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(
          items.map((item) => ({
            user_id: userId,
            kind: item.kind,
            subject: item.subject,
            season: item.season ?? null,
            stars: item.stars ?? null,
            happened_on: item.happenedOn,
          })),
        ),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Signale quelqu'un.
   *
   * ⚠️ **Rien ne revient, et c'est voulu.** La table n'a aucune politique de lecture : un
   * signalement relisible par son auteur devient un accuse de reception, donc une promesse
   * de suivi a tenir dans l'interface. La reponse passe par l'adresse annoncee sur
   * `/regles`. Ici on rend seulement « c'est parti » ou « ca n'est pas parti ».
   */
  async report(reporterId: string, subjectId: string, ground: string, note?: string): Promise<boolean> {
    try {
      const response = await this.#fetch(this.#url('reports'), {
        method: 'POST',
        headers: this.#headers({ Prefer: 'return=minimal' }),
        body: JSON.stringify({
          reporter_id: reporterId,
          subject_id: subjectId,
          ground,
          ...(note === undefined || note.trim().length === 0 ? {} : { note: note.trim() }),
        }),
      });
      // 409 : deja signale pour ce motif. Le dire comme un echec serait pousser a
      // recommencer ; c'est un succes du point de vue de la personne.
      return response.ok || response.status === 409;
    } catch {
      return false;
    }
  }
}
