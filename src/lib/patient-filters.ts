export type PatientFilters = {
  q?: string;
  doctor?: string;
  status?: string;
  case_type?: string;
  from?: string;
  to?: string;
};

// Structural type for the bits of a Supabase query builder we use, so this
// helper is reusable by both the list page and the export action without `any`.
type FilterableQuery<T> = {
  eq(column: string, value: unknown): T;
  gte(column: string, value: unknown): T;
  lte(column: string, value: unknown): T;
  or(filters: string): T;
};

/** Applies the shared patient list filters (search + facets) to a query. */
export function applyPatientFilters<T extends FilterableQuery<T>>(
  query: T,
  f: PatientFilters
): T {
  if (f.status && f.status !== "") query = query.eq("status_code", Number(f.status));
  if (f.case_type) query = query.eq("case_type", f.case_type);
  if (f.doctor) query = query.eq("treating_doctor", f.doctor);
  if (f.from) query = query.gte("first_visit_date", f.from);
  if (f.to) query = query.lte("first_visit_date", f.to);
  if (f.q) {
    // Strip characters that would break PostgREST's or() filter grammar.
    const safe = f.q.replace(/[,()]/g, " ").trim();
    if (safe) {
      query = query.or(
        `patient_name.ilike.%${safe}%,treating_doctor.ilike.%${safe}%,phone_number.ilike.%${safe}%,patient_erp_id.ilike.%${safe}%`
      );
    }
  }
  return query;
}

export function hasAnyFilter(f: PatientFilters): boolean {
  return Boolean(f.q || f.doctor || f.status || f.case_type || f.from || f.to);
}

/** Serializes filters (+ optional page) back into a query string. */
export function filtersToQuery(f: PatientFilters, page?: number): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.doctor) p.set("doctor", f.doctor);
  if (f.status) p.set("status", f.status);
  if (f.case_type) p.set("case_type", f.case_type);
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (page && page > 1) p.set("page", String(page));
  const s = p.toString();
  return s ? `?${s}` : "";
}
