import { create } from 'zustand';
import { safeStorage } from '@/services/storage';

export interface TodayAttendanceRecord {
  programId: string;
  status: 'started' | 'completed';
  date: string; // YYYY-MM-DD in IST
  startAt?: string;
  endAt?: string;
}

interface CommunityAttendanceState {
  records: Record<string, TodayAttendanceRecord>;
  hasLoaded: boolean;
  loadFromStorage: () => Promise<void>;
  markStarted: (programId: string, startAt?: string) => Promise<void>;
  markCompleted: (programId: string, endAt?: string) => Promise<void>;
  getRecord: (programId: string) => TodayAttendanceRecord | null;
  isLive: (programId: string) => boolean;
  isCompleted: (programId: string) => boolean;
}

export const getTodayDateIST = (): string => {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(new Date()); // "YYYY-MM-DD"
  } catch {
    return new Date().toISOString().split('T')[0];
  }
};

const STORAGE_KEY = 'arenova_coach_community_attendance_records';

export const useCommunityAttendanceStore = create<CommunityAttendanceState>((set, get) => ({
  records: {},
  hasLoaded: false,

  loadFromStorage: async () => {
    try {
      const stored = await safeStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const today = getTodayDateIST();
        // Filter to only retain today's records
        const freshRecords: Record<string, TodayAttendanceRecord> = {};
        if (parsed && typeof parsed === 'object') {
          for (const [pId, rec] of Object.entries(parsed)) {
            const r = rec as TodayAttendanceRecord;
            if (r && r.date === today) {
              freshRecords[pId] = r;
            }
          }
        }
        set({ records: freshRecords, hasLoaded: true });
        return;
      }
    } catch (_) {}
    set({ hasLoaded: true });
  },

  markStarted: async (programId: string, startAt?: string) => {
    const today = getTodayDateIST();
    const newRecord: TodayAttendanceRecord = {
      programId,
      status: 'started',
      date: today,
      startAt: startAt || new Date().toISOString()
    };
    const updated = { ...get().records, [programId]: newRecord };
    set({ records: updated });
    try {
      await safeStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (_) {}
  },

  markCompleted: async (programId: string, endAt?: string) => {
    const today = getTodayDateIST();
    const existing = get().records[programId];
    const newRecord: TodayAttendanceRecord = {
      programId,
      status: 'completed',
      date: today,
      startAt: existing?.startAt || new Date().toISOString(),
      endAt: endAt || new Date().toISOString()
    };
    const updated = { ...get().records, [programId]: newRecord };
    set({ records: updated });
    try {
      await safeStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (_) {}
  },

  getRecord: (programId: string) => {
    const today = getTodayDateIST();
    const record = get().records[programId];
    if (record && record.date === today) {
      return record;
    }
    return null;
  },

  isLive: (programId: string) => {
    const rec = get().getRecord(programId);
    return rec?.status === 'started';
  },

  isCompleted: (programId: string) => {
    const rec = get().getRecord(programId);
    return rec?.status === 'completed';
  }
}));

// Initialize storage on module load
useCommunityAttendanceStore.getState().loadFromStorage();
