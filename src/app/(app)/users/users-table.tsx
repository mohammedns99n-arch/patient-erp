"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getT, type Locale } from "@/lib/i18n";
import { updateUserPermission, updateUserRole } from "./actions";

export type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "admin" | "staff";
  can_view_financials: boolean;
  can_delete: boolean;
};

function Switch({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        checked ? "bg-green-600" : "bg-black/25 dark:bg-white/25"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export default function UsersTable({
  users,
  currentUserId,
  locale,
}: {
  users: UserRow[];
  currentUserId: string;
  locale: Locale;
}) {
  const router = useRouter();
  const t = getT(locale);
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState<UserRow[]>(users);

  function apply(userId: string, patch: Partial<UserRow>) {
    setRows((rs) => rs.map((r) => (r.id === userId ? { ...r, ...patch } : r)));
  }

  function togglePermission(
    user: UserRow,
    field: "can_view_financials" | "can_delete",
    value: boolean
  ) {
    const prev = user[field];
    apply(user.id, { [field]: value });
    startTransition(async () => {
      const res = await updateUserPermission(user.id, field, value);
      if (res.error) {
        apply(user.id, { [field]: prev });
        alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  function changeRole(user: UserRow, role: "admin" | "staff") {
    const prev = user.role;
    apply(user.id, { role });
    startTransition(async () => {
      const res = await updateUserRole(user.id, role);
      if (res.error) {
        apply(user.id, { role: prev });
        alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
      <table className="w-full text-sm">
        <thead className="bg-black/5 dark:bg-white/5 text-black/60 dark:text-white/60">
          <tr>
            <th className="text-start px-4 py-2 font-medium">{t("colUser")}</th>
            <th className="text-start px-4 py-2 font-medium">{t("colRole")}</th>
            <th className="text-center px-4 py-2 font-medium">{t("colViewFinancials")}</th>
            <th className="text-center px-4 py-2 font-medium">{t("colDeleteRecords")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => {
            const isSelf = u.id === currentUserId;
            const isAdmin = u.role === "admin";
            // Admins implicitly have every permission.
            const viewFin = isAdmin || u.can_view_financials;
            const canDel = isAdmin || u.can_delete;
            return (
              <tr key={u.id} className="border-t border-black/5 dark:border-white/5">
                <td className="px-4 py-3">
                  <div className="font-medium">
                    {u.full_name || u.email || u.id}
                    {isSelf && <span className="ms-2 text-xs text-black/50 dark:text-white/50">{t("youSuffix")}</span>}
                  </div>
                  {u.full_name && u.email && (
                    <div className="text-xs text-black/50 dark:text-white/50">{u.email}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    disabled={isSelf || pending}
                    onChange={(e) => changeRole(u, e.target.value as "admin" | "staff")}
                    title={isSelf ? t("cantChangeOwnRole") : undefined}
                    className="rounded-md border border-black/15 dark:border-white/15 bg-transparent px-2 py-1.5 text-sm disabled:opacity-50"
                  >
                    <option value="staff">{t("roleStaff")}</option>
                    <option value="admin">{t("roleAdmin")}</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center">
                    <Switch
                      label={`Allow ${u.email ?? "user"} to view financial totals`}
                      checked={viewFin}
                      disabled={isAdmin || pending}
                      onChange={(v) => togglePermission(u, "can_view_financials", v)}
                    />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center">
                    <Switch
                      label={`Allow ${u.email ?? "user"} to delete records`}
                      checked={canDel}
                      disabled={isAdmin || pending}
                      onChange={(v) => togglePermission(u, "can_delete", v)}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
