import { createRef } from "react";
import create from "zustand";

export const usePipeline = create((set) => ({
  pipeline: [],
  setPipeline: (pipeline) => set({ pipeline }),
}));
export const betaRef = createRef(0);
export const gammaRef = createRef(0);
export const rotation = createRef();
export const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
