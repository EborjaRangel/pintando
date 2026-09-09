"use client";

import { useCallback, useEffect, useState } from "react";
import {
  COLONIA_SELECTION_EVENT,
  coloniaSelectionFromName,
  readColoniaSelection,
  writeColoniaSelection,
  type ColoniaSelection,
} from "@/lib/colonia-selection";

export function useColoniaSelection() {
  const [selection, setSelectionState] = useState<ColoniaSelection | null>(null);

  useEffect(() => {
    function sync() {
      setSelectionState(readColoniaSelection());
    }
    sync();
    window.addEventListener(COLONIA_SELECTION_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(COLONIA_SELECTION_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setSelection = useCallback((next: ColoniaSelection | null) => {
    const resolved = next ? coloniaSelectionFromName(next.label) : null;
    writeColoniaSelection(resolved);
    setSelectionState(resolved);
  }, []);

  return { selection, setSelection };
}
