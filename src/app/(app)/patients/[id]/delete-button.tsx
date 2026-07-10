"use client";

import { useTransition } from "react";
import { deletePatient } from "../actions";

export default function DeletePatientButton({
  id,
  label,
  buttonText,
  deletingText,
  confirmPrefix,
  confirmSuffix,
}: {
  id: string;
  label: string;
  buttonText: string;
  deletingText: string;
  confirmPrefix: string;
  confirmSuffix: string;
}) {
  const [pending, startTransition] = useTransition();

  function onDelete() {
    const ok = window.confirm(`${confirmPrefix} ${label}${confirmSuffix}`);
    if (!ok) return;
    startTransition(async () => {
      // On success the action redirects to /patients; only errors return here.
      const res = await deletePatient(id);
      if (res?.error) alert(res.error);
    });
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={pending}
      className="rounded-lg border border-red-300 dark:border-red-900/60 text-red-700 dark:text-red-400 px-4 py-2.5 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-60"
    >
      {pending ? deletingText : buttonText}
    </button>
  );
}
