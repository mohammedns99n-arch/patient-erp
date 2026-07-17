"use server";

import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Result = { error: string | null };

const PERMISSION_FIELDS = ["can_view_financials", "can_view_statistics", "can_delete"] as const;
type PermissionField = (typeof PERMISSION_FIELDS)[number];

async function requireAdmin() {
  const me = await getSessionProfile();
  if (!me) return { me: null, error: "Not signed in." as string | null };
  if (me.role !== "admin") return { me, error: "Admins only." as string | null };
  return { me, error: null as string | null };
}

export async function updateUserPermission(
  userId: string,
  field: PermissionField,
  value: boolean
): Promise<Result> {
  const { error: guard } = await requireAdmin();
  if (guard) return { error: guard };
  if (!PERMISSION_FIELDS.includes(field)) return { error: "Unknown permission." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ [field]: value })
    .eq("id", userId);

  return { error: error ? error.message : null };
}

export async function updateUserRole(
  userId: string,
  role: "admin" | "staff"
): Promise<Result> {
  const { me, error: guard } = await requireAdmin();
  if (guard) return { error: guard };
  if (!["admin", "staff"].includes(role)) return { error: "Invalid role." };
  // Prevent self-lockout: an admin can't change their own role.
  if (me && userId === me.id) {
    return { error: "You can't change your own role." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);

  return { error: error ? error.message : null };
}
