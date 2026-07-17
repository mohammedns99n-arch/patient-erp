import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "staff";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  can_view_financials: boolean;
  can_view_statistics: boolean;
  can_delete: boolean;
};

/**
 * Returns the currently logged-in user's profile (role + permissions),
 * or null if not authenticated. Use in Server Components / Server Actions.
 */
export async function getSessionProfile(): Promise<Profile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, can_view_financials, can_view_statistics, can_delete")
    .eq("id", user.id)
    .single();

  // Fall back to a minimal profile if the row isn't there yet (trigger lag).
  if (!profile) {
    return {
      id: user.id,
      email: user.email ?? null,
      full_name: user.email ?? null,
      role: "staff",
      can_view_financials: false,
      can_view_statistics: false,
      can_delete: false,
    };
  }

  return profile as Profile;
}

/** Derived UI permissions from a profile. Admins implicitly get everything. */
export function permissions(profile: Profile) {
  const isAdmin = profile.role === "admin";
  return {
    isAdmin,
    canViewFinancials: isAdmin || profile.can_view_financials,
    canViewStatistics: isAdmin || profile.can_view_statistics,
    canDelete: isAdmin || profile.can_delete,
    canManageUsers: isAdmin,
  };
}
