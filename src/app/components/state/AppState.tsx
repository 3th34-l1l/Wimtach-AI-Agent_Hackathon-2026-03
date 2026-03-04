"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

type StatusValue = "GOOD" | "BAD";
type ShiftRow = { date?: string; start?: string; end?: string; unit?: string; team?: string };

type Action =
  | { type: "SET_ACTIVE_PAGE"; page: string }
  | { type: "SET_SELECTED_FORM"; form: string }
  | { type: "SET_WEATHER"; text: string }
  | { type: "SET_NARRATIVE"; text: string }
  | { type: "PATCH_STATUS"; patch: Record<string, StatusValue> }
  | { type: "SET_SHIFT_SCHEDULE"; rows: ShiftRow[] }
  | { type: "APPEND_CHAT_NOTE"; text: string };

type AppStateValue = {
  activePage: string;
  setActivePage: (page: string) => void;

  selectedForm: string;
  setSelectedForm: (form: string) => void;

  weatherSummary: string;
  setWeatherSummary: (t: string) => void;

  narrative: string;
  setNarrative: (t: string) => void;

  statusMap: Record<string, StatusValue>;
  patchStatus: (patch: Record<string, StatusValue>) => void;

  shiftSchedule: ShiftRow[];
  setShiftSchedule: (rows: ShiftRow[]) => void;

  dispatchAction: (a: Action) => void;
};

const Ctx = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [activePage, setActivePage] = useState("/chat");

  const [selectedForm, setSelectedForm] = useState("—");
  const [weatherSummary, setWeatherSummary] = useState("—");
  const [narrative, setNarrative] = useState("—");

  // ✅ Form 4 live map
  const [statusMap, setStatusMap] = useState<Record<string, StatusValue>>({});

  // ✅ Form 3 schedule rows
  const [shiftSchedule, setShiftSchedule] = useState<ShiftRow[]>([]);

  function patchStatus(patch: Record<string, StatusValue>) {
    setStatusMap((prev) => ({ ...prev, ...patch }));
  }

  function dispatchAction(a: Action) {
    switch (a.type) {
      case "SET_ACTIVE_PAGE":
        setActivePage(a.page);
        return;
      case "SET_SELECTED_FORM":
        setSelectedForm(a.form);
        return;
      case "SET_WEATHER":
        setWeatherSummary(a.text);
        return;
      case "SET_NARRATIVE":
        setNarrative(a.text);
        return;
      case "PATCH_STATUS":
        patchStatus(a.patch);
        return;
      case "SET_SHIFT_SCHEDULE":
        setShiftSchedule(a.rows);
        return;
      case "APPEND_CHAT_NOTE":
        setNarrative((prev) => (prev === "—" ? a.text : `${prev}\n\n${a.text}`));
        return;
    }
  }

  const value = useMemo(
    () => ({
      activePage,
      setActivePage,

      selectedForm,
      setSelectedForm,

      weatherSummary,
      setWeatherSummary,

      narrative,
      setNarrative,

      statusMap,
      patchStatus,

      shiftSchedule,
      setShiftSchedule,

      dispatchAction,
    }),
    [activePage, selectedForm, weatherSummary, narrative, statusMap, shiftSchedule]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppState must be used inside AppStateProvider");
  return v;
}