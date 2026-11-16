"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartLine = { variantId: string; quantity: number };
type CartState = {
  lines: CartLine[];
  code: string;
  open: boolean;
  add: (variantId: string, quantity?: number) => void;
  setQty: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  replace: (lines: CartLine[]) => void;
  setCode: (code: string) => void;
  setOpen: (open: boolean) => void;
  clear: () => void;
};

/** The cart only stores variant ids + quantities. Prices always come from the server. */
export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [], code: "", open: false,
      add: (variantId, quantity = 1) => set((s) => {
        const ex = s.lines.find((l) => l.variantId === variantId);
        return { open: true, lines: ex ? s.lines.map((l) => (l === ex ? { ...l, quantity: Math.min(10, l.quantity + quantity) } : l)) : [...s.lines, { variantId, quantity }] };
      }),
      setQty: (variantId, quantity) => set((s) => ({ lines: quantity <= 0 ? s.lines.filter((l) => l.variantId !== variantId) : s.lines.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.min(10, quantity) } : l)) })),
      remove: (variantId) => set((s) => ({ lines: s.lines.filter((l) => l.variantId !== variantId) })),
      replace: (lines) => set({ lines }),
      setCode: (code) => set({ code }),
      setOpen: (open) => set({ open }),
      clear: () => set({ lines: [], code: "" }),
    }),
    { name: "samr-cart", partialize: (s) => ({ lines: s.lines, code: s.code }) },
  ),
);
