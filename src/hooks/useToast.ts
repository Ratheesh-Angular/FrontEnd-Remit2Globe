"use client";

import * as React from "react";

export type ToastVariant = "success" | "error" | "info";

export type ToastItem = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
};

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 5000;

type Action =
  | { type: "ADD"; toast: ToastItem }
  | { type: "DISMISS"; id: string }
  | { type: "REMOVE"; id: string };

type State = { toasts: ToastItem[] };

const listeners = new Set<(state: State) => void>();
let memoryState: State = { toasts: [] };
const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((l) => l(memoryState));
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };
    case "DISMISS":
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.id),
      };
    case "REMOVE":
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.id),
      };
    default:
      return state;
  }
}

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return `toast-${count}`;
}

function scheduleDismiss(id: string) {
  const existing = dismissTimers.get(id);
  if (existing) clearTimeout(existing);
  dismissTimers.set(
    id,
    setTimeout(() => {
      dispatch({ type: "REMOVE", id });
      dismissTimers.delete(id);
    }, TOAST_REMOVE_DELAY),
  );
}

function show(variant: ToastVariant, title: string, description?: string) {
  const id = genId();
  dispatch({
    type: "ADD",
    toast: { id, title, description, variant },
  });
  scheduleDismiss(id);
  return id;
}

export const toast = {
  success: (title: string, description?: string) =>
    show("success", title, description),
  error: (title: string, description?: string) =>
    show("error", title, description),
  info: (title: string, description?: string) => show("info", title, description),
  dismiss: (id: string) => {
    const t = dismissTimers.get(id);
    if (t) clearTimeout(t);
    dismissTimers.delete(id);
    dispatch({ type: "DISMISS", id });
  },
};

export function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return {
    toasts: state.toasts,
    dismiss: toast.dismiss,
  };
}
