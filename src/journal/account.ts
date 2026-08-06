/**
 * Ce qui se passe entre « quelqu'un se connecte » et « la synchronisation demarre ».
 *
 * Un seul sujet : **le journal deja present sur cet appareil**. `sync.ts` a decide quoi en
 * penser (`decideAdoption`, trois cas) ; ce module range le resultat quelque part et fait
 * le versement quand il est autorise.
 *
 * Pur au sens du depot : le stockage est **injecte**, donc tout se teste sans navigateur.
 */

import { mergeJournals } from '../domain/journal';
import { LocalJournalStore, accountStorageKey, type StorageLike } from './local';
import { decideAdoption, OWNER_KEY, type AdoptionDecision } from './sync';

/**
 * Ou l'on note qu'un compte a **refuse** le journal de cet appareil.
 *
 * ## 🔴 Sans cette trace, le refus ne tient pas une page
 *
 * `decideAdoption` reposerait la question a chaque ouverture, indefiniment. Or une question
 * qui revient sans cesse **s'apprend a fermer** : on finit par cliquer la reponse qui la
 * fait disparaitre, et la reponse qui fait disparaitre une invitation est « oui ». Le
 * garde-fou de l'appareil partage serait alors defait par l'usure, pas par une decision.
 *
 * Une cle **par compte** : sur un poste familial, le refus de l'un ne repond pas pour
 * l'autre.
 */
const DECLINED_PREFIX = 'voltface.adoption-declined.v1:';

function declinedKey(userId: string): string {
  return `${DECLINED_PREFIX}${userId}`;
}

/** À qui appartient le journal range sous la cle de l'appareil, si on le sait. */
function readOwner(storage: StorageLike): string | undefined {
  try {
    return storage.getItem(OWNER_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function remember(storage: StorageLike, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Stockage refuse : la question sera reposee, ce qui est le repli sur, puisque le
    // defaut de l'interface est « non ».
  }
}

/**
 * Que faire du journal de cet appareil pour le compte qui se connecte ?
 *
 * Rend `nothing_to_adopt` si la question a deja recu un « non » : ce n'est pas un mensonge,
 * c'est exactement ce que l'appelant doit faire — rien.
 */
export async function adoptionFor(
  storage: StorageLike,
  userId: string,
): Promise<AdoptionDecision> {
  try {
    if (storage.getItem(declinedKey(userId)) !== null) return { kind: 'nothing_to_adopt' };
  } catch {
    // Lecture impossible : on repose la question. Le defaut reste « non ».
  }

  const device = new LocalJournalStore({ storage });
  return decideAdoption(await device.load(), readOwner(storage), userId);
}

/**
 * Verse le journal de l'appareil dans celui du compte.
 *
 * **Fusion, jamais remplacement** : le compte peut deja porter un journal venu d'un autre
 * appareil, et l'ecraser avec celui-ci en perdrait la moitie. `mergeJournals` tranche champ
 * par champ, donc les deux apports survivent.
 *
 * ⚠️ Le journal de l'appareil **n'est pas efface**. Il est desormais lie a ce compte
 * (`OWNER_KEY`), donc il ne sera plus reproposé ; l'effacer ne gagnerait que quelques
 * kilo-octets et transformerait chaque defaut de cette fonction en perte definitive.
 */
export async function adopt(storage: StorageLike, userId: string): Promise<void> {
  const device = new LocalJournalStore({ storage });
  const account = new LocalJournalStore({ storage, key: accountStorageKey(userId) });

  const merged = mergeJournals(await account.load(), await device.load());
  await account.save(merged);
  remember(storage, OWNER_KEY, userId);
}

/**
 * Refuse le versement, une fois pour toutes.
 *
 * Le journal de l'appareil reste **intact et a sa place** : il appartient toujours a la
 * personne qui l'a depose, et elle le retrouvera en se deconnectant. C'est ce qui rend ce
 * refus reparable, la ou une fusion par erreur ne l'est pas — une fois fusionne, on ne sait
 * plus quoi appartenait a qui.
 */
export function decline(storage: StorageLike, userId: string): void {
  remember(storage, declinedKey(userId), 'no');
}
