import { safeStorage } from '@/services/storage';

const STORAGE_KEY = 'deleted_pending_tournament_registrations';
const CONFIRMED_KEY = 'locally_confirmed_tournament_registrations';

export const getDeletedPendingTournamentIds = async (): Promise<string[]> => {
  try {
    const raw = await safeStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

export const markPendingTournamentAsDeleted = async (regId: string): Promise<void> => {
  if (!regId) return;
  try {
    const list = await getDeletedPendingTournamentIds();
    if (!list.includes(regId)) {
      list.push(regId);
      await safeStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }
  } catch (err) {
    console.warn('[deletedTournaments] Failed to persist deleted registration ID:', err);
  }
};

export const markMultiplePendingTournamentsAsDeleted = async (regIds: string[]): Promise<void> => {
  if (!regIds || regIds.length === 0) return;
  try {
    const list = await getDeletedPendingTournamentIds();
    const set = new Set([...list, ...regIds]);
    await safeStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch (err) {
    console.warn('[deletedTournaments] Failed to persist multiple deleted registration IDs:', err);
  }
};

export const unmarkPendingTournamentAsDeleted = async (regId: string): Promise<void> => {
  if (!regId) return;
  try {
    const list = await getDeletedPendingTournamentIds();
    const updated = list.filter(id => id !== regId);
    await safeStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('[deletedTournaments] Failed to unmark registration ID:', err);
  }
};

export const getConfirmedTournamentIds = async (): Promise<string[]> => {
  try {
    const raw = await safeStorage.getItem(CONFIRMED_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

export const markTournamentAsConfirmed = async (regId: string, tournamentId?: string): Promise<void> => {
  try {
    const list = await getConfirmedTournamentIds();
    const set = new Set(list);
    if (regId) set.add(regId);
    if (tournamentId) set.add(tournamentId);
    await safeStorage.setItem(CONFIRMED_KEY, JSON.stringify(Array.from(set)));
  } catch (err) {
    console.warn('[deletedTournaments] Failed to mark tournament as confirmed:', err);
  }
};

export * from './tournamentHelpers';
