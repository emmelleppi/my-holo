import create from "zustand";

export const usePipeline = create((set) => ({
  pipeline: [],
  setPipeline: (pipeline) => set({ pipeline }),
}));
