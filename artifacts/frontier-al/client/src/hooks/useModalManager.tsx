import { useState, useCallback, useMemo } from "react";
import { createContext, useContext } from "react";

export type ModalType =
  | "parcelSheet"
  | "fullLandSheet"
  | "battleWatch"
  | "gamerTag"
  | "strikePanel";

export interface ModalManager {
  open: (type: ModalType) => void;
  close: (type: ModalType) => void;
  toggle: (type: ModalType) => void;
  isOpen: (type: ModalType) => boolean;
  closeAll: () => void;
}

const ModalContext = createContext<ModalManager | null>(null);

export function useModalManager(): ModalManager {
  const ctx = useContext(ModalContext);
  if (!ctx) {
    throw new Error("useModalManager must be used within a ModalProvider");
  }
  return ctx;
}

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [activeModals, setActiveModals] = useState<Set<ModalType>>(new Set());

  const open = useCallback((type: ModalType) => {
    setActiveModals((prev) => new Set(prev).add(type));
  }, []);

  const close = useCallback((type: ModalType) => {
    setActiveModals((prev) => {
      const next = new Set(prev);
      next.delete(type);
      return next;
    });
  }, []);

  const toggle = useCallback((type: ModalType) => {
    setActiveModals((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const closeAll = useCallback(() => {
    setActiveModals(new Set());
  }, []);

  const value = useMemo<ModalManager>(
    () => ({
      open,
      close,
      toggle,
      closeAll,
      isOpen: (type: ModalType) => activeModals.has(type),
    }),
    [open, close, toggle, closeAll, activeModals]
  );

  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
}
