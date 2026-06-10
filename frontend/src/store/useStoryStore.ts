import { create } from "zustand";
import type { StoryChapter, StoryLevelDetail, StoryPlayResponse } from "@/types";

interface StoryState {
  chapters: StoryChapter[];
  loading: boolean;
  error: string | null;

  setChapters: (chapters: StoryChapter[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useStoryStore = create<StoryState>((set) => ({
  chapters: [],
  loading: false,
  error: null,

  setChapters: (chapters) => set({ chapters }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
