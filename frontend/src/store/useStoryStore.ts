import { create } from "zustand";
import type { StoryChapter, StoryLevelDetail, StoryPlayResponse, StarCondition, StorySpecialRules } from "@/types";

interface StoryState {
  chapters: StoryChapter[];
  currentChapter: StoryChapter | null;
  currentLevel: StoryLevelDetail | null;
  currentPlay: StoryPlayResponse | null;
  loading: boolean;
  error: string | null;

  setChapters: (chapters: StoryChapter[]) => void;
  setCurrentChapter: (chapter: StoryChapter | null) => void;
  setCurrentLevel: (level: StoryLevelDetail | null) => void;
  setCurrentPlay: (play: StoryPlayResponse | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useStoryStore = create<StoryState>((set) => ({
  chapters: [],
  currentChapter: null,
  currentLevel: null,
  currentPlay: null,
  loading: false,
  error: null,

  setChapters: (chapters) => set({ chapters }),
  setCurrentChapter: (chapter) => set({ currentChapter: chapter }),
  setCurrentLevel: (level) => set({ currentLevel: level }),
  setCurrentPlay: (play) => set({ currentPlay: play }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  reset: () =>
    set({
      chapters: [],
      currentChapter: null,
      currentLevel: null,
      currentPlay: null,
      loading: false,
      error: null,
    }),
}));
