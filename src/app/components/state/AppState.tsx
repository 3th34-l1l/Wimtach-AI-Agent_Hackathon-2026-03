/* ===========================
FILE: /components/state/AppState.tsx
(or /src/app/components/state/AppState.tsx)
FULL DROP-IN (task + focus + form fill)
✅ activePage + navigation intent support
✅ focusField highlight support
✅ generic form storage (occurrence + teddy)
✅ set field values via dispatchAction (SET_FIELD_VALUE)
✅ clear per-form (CLEAR_FORM)
✅ STATUS map + shiftSchedule preserved
=========================== */

"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

type StatusValue = "GOOD" | "BAD";
export type ShiftRow = { date?: string; start?: string; end?: string; unit?: string; team?: string };

// ✅ Stored form buckets (add more forms later)
export type FormKey = "occurrence" | "teddy";
export type FormData = {
  occurrence: Record<string, string>;
  teddy: Record<string, string>;
};

// ✅ Optional: global “task” controller (you can wire this into Voice later)
export type TaskType = "occurrence" | "teddy" | "status" | "shift" | "none";
export type TaskState = {
  type: TaskType;
  title: string;
  status: "idle" | "active" | "done";
  step?: string; // usually equals focusField e.g. "occurrence.callNumber"
  startedAt?: number;
};

export type Action =
  | { type: "SET_ACTIVE_PAGE"; page: string }
  | { type: "SET_SELECTED_FORM"; form: string }
  | { type: "SET_WEATHER"; text: string }
  | { type: "SET_NARRATIVE"; text: string }
  | { type: "PATCH_STATUS"; patch: Record<string, StatusValue> }
  | { type: "SET_SHIFT_SCHEDULE"; rows: ShiftRow[] }
  | { type: "APPEND_CHAT_NOTE"; text: string }
  | { type: "SET_FOCUS_FIELD"; id: string }
  // ✅ NEW: generic form fill
  | { type: "SET_FIELD_VALUE"; id: string; value: string }
  | { type: "CLEAR_FORM"; form: FormKey }
  // ✅ NEW: task/session
  | { type: "START_TASK"; task: Omit<TaskState, "status" | "startedAt"> }
  | { type: "UPDATE_TASK_STEP"; step: string }
  | { type: "COMPLETE_TASK" }
  | { type: "RESET_TASK" };

export type AppStateValue = {
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

  // ✅ Focus support
  focusField: string;
  setFocusField: (id: string) => void;

  // ✅ Form values
  formData: FormData;
  getFieldValue: (id: string) => string;
  setFieldValue: (id: string, value: string) => void;

  // ✅ Task/session
  task: TaskState;

  dispatchAction: (a: Action) => void;
};

const Ctx = createContext<AppStateValue | null>(null);

function parseFieldId(id: string) {
  // supports "occurrence.callNumber" => { form: "occurrence", key: "callNumber" }
  const [form, ...rest] = String(id || "").split(".");
  return { form: (form || "") as string, key: rest.join(".") || "" };
}

function isFormKey(x: string): x is FormKey {
  return x === "occurrence" || x === "teddy";
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [activePage, setActivePage] = useState("/chat");

  const [selectedForm, setSelectedForm] = useState("—");
  const [weatherSummary, setWeatherSummary] = useState("—");
  const [narrative, setNarrative] = useState("—");

  const [statusMap, setStatusMap] = useState<Record<string, StatusValue>>({});
  const [shiftSchedule, setShiftSchedule] = useState<ShiftRow[]>([]);

  const [focusField, setFocusField] = useState<string>("");

  // ✅ NEW: actual form storage (Occurrence + Teddy)
  const [formData, setFormData] = useState<FormData>({
    occurrence: {},
    teddy: {},
  });

  // ✅ NEW: task/session controller
  const [task, setTask] = useState<TaskState>({
    type: "none",
    title: "",
    status: "idle",
  });

  function patchStatus(patch: Record<string, StatusValue>) {
    setStatusMap((prev) => ({ ...prev, ...patch }));
  }

  function getFieldValue(id: string) {
    const { form, key } = parseFieldId(id);
    if (!form || !key) return "";
    if (!isFormKey(form)) return "";
    const bucket = formData[form];
    return typeof bucket?.[key] === "string" ? bucket[key] : "";
  }

  function setFieldValue(id: string, value: string) {
    const { form, key } = parseFieldId(id);
    if (!form || !key) return;
    if (!isFormKey(form)) return;

    setFormData((prev) => {
      const next: FormData = { ...prev, [form]: { ...prev[form] } };
      next[form][key] = String(value ?? "");
      return next;
    });
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

      case "SET_FOCUS_FIELD":
        setFocusField(a.id);
        // keep task step aligned if active
        setTask((prev) => (prev.status === "active" ? { ...prev, step: a.id } : prev));
        return;

      // ✅ NEW: generic form fill
      case "SET_FIELD_VALUE":
        setFieldValue(a.id, a.value);
        return;

      case "CLEAR_FORM":
        setFormData((prev) => ({ ...prev, [a.form]: {} }));
        return;

      // ✅ NEW: task/session
      case "START_TASK":
        setTask({
          ...a.task,
          status: "active",
          startedAt: Date.now(),
          step: a.task.step || "",
        });
        return;

      case "UPDATE_TASK_STEP":
        setTask((prev) => ({ ...prev, status: "active", step: a.step }));
        return;

      case "COMPLETE_TASK":
        setTask((prev) => ({ ...prev, status: "done" }));
        return;

      case "RESET_TASK":
        setTask({ type: "none", title: "", status: "idle" });
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

      focusField,
      setFocusField,

      formData,
      getFieldValue,
      setFieldValue,

      task,

      dispatchAction,
    }),
    [
      activePage,
      selectedForm,
      weatherSummary,
      narrative,
      statusMap,
      shiftSchedule,
      focusField,
      formData,
      task,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppState must be used inside AppStateProvider");
  return v;
}