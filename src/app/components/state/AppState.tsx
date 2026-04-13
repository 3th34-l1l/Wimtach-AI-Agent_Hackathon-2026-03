"use client";

import React, { createContext, useContext, useMemo, useState } from "react";
import type {
  EntityRecord,
  RelationshipRecord,
} from "@/lib/intelligence/types";
import type { ContactMethod } from "@/lib/intelligence/types";
type ProjectCompany = {
  company_id: string | number;
  company_name: string;
  company_ticker?: string | null;
  industry?: string | null;
  country?: string | null;
};

type ProjectMetric = {
  facility_type?: string | null;
  parameter?: string | null;
  unit_value?: string | number | null;
  unit_name?: string | null;
  product_name?: string | null;
};

type ProjectContextState = {
  projectId?: string | number | null;
  projectName?: string | null;
  projectSummary?: string | null;
  projectStage?: string | null;
  projectLocation?: string | null;
  sectorRoot?: string | null;
  coordinationBurden?: string | null;
  reviewSensitivity?: string | null;
  environment?: string | null;
  complexity?: string | null;
  projectInsights: string[];
  projectCompanies: ProjectCompany[];
  projectMetrics: ProjectMetric[];
};


type OpportunitySignal = {
  id: string;
  title: string;
  category:
    | "detailing"
    | "charter"
    | "maintenance"
    | "fbo"
    | "operator_outreach"
    | "other";
  confidenceScore: number;
  status: "open" | "watch" | "qualified" | "archived";
  notes?: string;
};

type IntelligenceContextState = {
  matchedEntities: EntityRecord[];
  relationshipSignals: RelationshipRecord[];
  contactMethods: ContactMethod[];
  opportunitySignals: OpportunitySignal[];
};

type StatusValue = "GOOD" | "BAD";
export type ShiftRow = {
  date?: string;
  start?: string;
  end?: string;
  unit?: string;
  team?: string;
};

export type FormKey = "occurrence" | "teddy";
export type FormData = {
  occurrence: Record<string, string>;
  teddy: Record<string, string>;
};

export type TaskType = "occurrence" | "teddy" | "status" | "shift" | "none";
export type TaskState = {
  type: TaskType;
  title: string;
  status: "idle" | "active" | "done";
  step?: string;
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
  | { type: "SET_FIELD_VALUE"; id: string; value: string }
  | { type: "CLEAR_FORM"; form: FormKey }
  | { type: "START_TASK"; task: Omit<TaskState, "status" | "startedAt"> }
  | { type: "UPDATE_TASK_STEP"; step: string }
  | { type: "COMPLETE_TASK" }
  | { type: "RESET_TASK" }
  | { type: "SET_MENTIONED_EMAILS"; emails: string[] };

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

  focusField: string;
  setFocusField: (id: string) => void;

  formData: FormData;
  getFieldValue: (id: string) => string;
  setFieldValue: (id: string, value: string) => void;

  task: TaskState;

  mentionedEmails: string[];
  setMentionedEmails: (emails: string[]) => void;

  projectId: string | number | null;
  projectName: string | null;
  projectSummary: string | null;
  projectStage: string | null;
  projectLocation: string | null;
  sectorRoot: string | null;
  coordinationBurden: string | null;
  reviewSensitivity: string | null;
  environment: string | null;
  complexity: string | null;
  projectInsights: string[];
  projectCompanies: ProjectCompany[];
  projectMetrics: ProjectMetric[];
  setProjectContext: (payload: Partial<ProjectContextState>) => void;
  clearProjectContext: () => void;

  matchedEntities: EntityRecord[];
  relationshipSignals: RelationshipRecord[];
  contactMethods: ContactMethod[];
  opportunitySignals: OpportunitySignal[];
  setIntelligenceContext: (payload: Partial<IntelligenceContextState>) => void;
  clearIntelligenceContext: () => void;

  dispatchAction: (a: Action) => void;
};

const Ctx = createContext<AppStateValue | null>(null);

function parseFieldId(id: string) {
  const [form, ...rest] = String(id || "").split(".");
  return { form: (form || "") as string, key: rest.join(".") || "" };
}

function isFormKey(x: string): x is FormKey {
  return x === "occurrence" || x === "teddy";
}

const EMPTY_PROJECT_CONTEXT: ProjectContextState = {
  projectId: null,
  projectName: null,
  projectSummary: null,
  projectStage: null,
  projectLocation: null,
  sectorRoot: null,
  coordinationBurden: null,
  reviewSensitivity: null,
  environment: null,
  complexity: null,
  projectInsights: [],
  projectCompanies: [],
  projectMetrics: [],
};

const EMPTY_INTELLIGENCE_CONTEXT: IntelligenceContextState = {
  matchedEntities: [],
  relationshipSignals: [],
  contactMethods: [],
  opportunitySignals: [],
};

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [activePage, setActivePage] = useState("/chat");

  const [selectedForm, setSelectedForm] = useState("—");
  const [weatherSummary, setWeatherSummary] = useState("—");
  const [narrative, setNarrative] = useState("—");

  const [statusMap, setStatusMap] = useState<Record<string, StatusValue>>({});
  const [shiftSchedule, setShiftSchedule] = useState<ShiftRow[]>([]);

  const [focusField, setFocusField] = useState<string>("");

  const [formData, setFormData] = useState<FormData>({
    occurrence: {},
    teddy: {},
  });

  const [task, setTask] = useState<TaskState>({
    type: "none",
    title: "",
    status: "idle",
  });

  const [mentionedEmails, setMentionedEmails] = useState<string[]>([]);

  const [projectContext, setProjectContextState] = useState<ProjectContextState>(
    EMPTY_PROJECT_CONTEXT
  );

  const [intelligenceContext, setIntelligenceContextState] =
    useState<IntelligenceContextState>(EMPTY_INTELLIGENCE_CONTEXT);

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

  function setProjectContext(payload: Partial<ProjectContextState>) {
    setProjectContextState((prev) => ({
      ...prev,
      ...payload,
    }));
  }

  function clearProjectContext() {
    setProjectContextState(EMPTY_PROJECT_CONTEXT);
  }

  function setIntelligenceContext(payload: Partial<IntelligenceContextState>) {
    setIntelligenceContextState((prev) => ({
      ...prev,
      ...payload,
    }));
  }

  function clearIntelligenceContext() {
    setIntelligenceContextState(EMPTY_INTELLIGENCE_CONTEXT);
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
        setTask((prev) => (prev.status === "active" ? { ...prev, step: a.id } : prev));
        return;
      case "SET_FIELD_VALUE":
        setFieldValue(a.id, a.value);
        return;
      case "CLEAR_FORM":
        setFormData((prev) => ({ ...prev, [a.form]: {} }));
        return;
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
      case "SET_MENTIONED_EMAILS":
        setMentionedEmails(a.emails);
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

      mentionedEmails,
      setMentionedEmails,

      projectId: projectContext.projectId ?? null,
      projectName: projectContext.projectName ?? null,
      projectSummary: projectContext.projectSummary ?? null,
      projectStage: projectContext.projectStage ?? null,
      projectLocation: projectContext.projectLocation ?? null,
      sectorRoot: projectContext.sectorRoot ?? null,
      coordinationBurden: projectContext.coordinationBurden ?? null,
      reviewSensitivity: projectContext.reviewSensitivity ?? null,
      environment: projectContext.environment ?? null,
      complexity: projectContext.complexity ?? null,
      projectInsights: projectContext.projectInsights,
      projectCompanies: projectContext.projectCompanies,
      projectMetrics: projectContext.projectMetrics,
      setProjectContext,
      clearProjectContext,

      

      matchedEntities: intelligenceContext.matchedEntities,
      relationshipSignals: intelligenceContext.relationshipSignals,
      contactMethods: intelligenceContext.contactMethods,
      opportunitySignals: intelligenceContext.opportunitySignals,
      setIntelligenceContext,
      clearIntelligenceContext,

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
      mentionedEmails,
      projectContext,
      intelligenceContext,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppState must be used inside AppStateProvider");
  return v;
}