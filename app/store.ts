"use client";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Session = { id: string; ids: string[]; mode: 'practice' | 'exam'; index: number; answers: Record<string, number>; expiresAt: number | null; duration: number; startedAt: number; finished: boolean; focus?: string };
export type Result = { id: string; date: string; total: number; correct: number; mode: string; seconds: number };
type StudyState = {
  theme: "light" | "dark"; setTheme: (theme: "light" | "dark") => void;
  name: string; bookmarks: string[]; known: string[]; seenSlides: Record<string, number>; responses: Record<string, { selected: number; correct: boolean; date: string }>; history: Result[]; session: Session | null; minutes: number;
  setName: (name: string) => void; setMinutes: (minutes: number) => void; toggleBookmark: (id: string) => void; markKnown: (id: string, value: boolean) => void; readSlide: (lecture: number, slide: number) => void;
  start: (ids: string[], mode: 'practice' | 'exam', minutes: number, focus?: string) => void; answer: (id: string, selected: number, correct: boolean) => void; navigate: (index: number) => void; finish: (correct: number) => void; clearSession: () => void;
};
export const useStudy = create<StudyState>()(persist((set) => ({
  theme: "light", setTheme: theme => set({ theme }),
  name: 'Student', bookmarks: [], known: [], seenSlides: {}, responses: {}, history: [], session: null, minutes: 30,
  setName: name => set({ name: name.trim() || 'Student' }), setMinutes: minutes => set({ minutes }),
  toggleBookmark: id => set(s => ({ bookmarks: s.bookmarks.includes(id) ? s.bookmarks.filter(x => x !== id) : [...s.bookmarks, id] })),
  markKnown: (id, value) => set(s => ({ known: value ? [...new Set([...s.known, id])] : s.known.filter(x => x !== id) })),
  readSlide: (lecture, slide) => set(s => ({ seenSlides: { ...s.seenSlides, [lecture]: slide } })),
  start: (ids, mode, minutes, focus) => set({ session: { id: crypto.randomUUID(), ids, mode, index: 0, answers: {}, expiresAt: minutes ? Date.now() + minutes * 60000 : null, duration: minutes * 60, startedAt: Date.now(), finished: false, focus } }),
  answer: (id, selected, correct) => set(s => ({ session: s.session ? { ...s.session, answers: { ...s.session.answers, [id]: selected } } : null, responses: { ...s.responses, [id]: { selected, correct, date: new Date().toISOString() } } })),
  navigate: index => set(s => ({ session: s.session ? { ...s.session, index } : null })),
  finish: correct => set(s => {
    if (!s.session || s.session.finished) return {};
    return { session: { ...s.session, finished: true }, history: [{ id: s.session.id, date: new Date().toISOString(), total: s.session.ids.length, correct, mode: s.session.mode, seconds: Math.max(0, Math.floor((Math.min(Date.now(), s.session.expiresAt || Date.now()) - s.session.startedAt) / 1000)) }, ...s.history].slice(0, 100) };
  }),
  clearSession: () => set({ session: null }),
}), { name: 'radia-study-v1', version: 1 }));
