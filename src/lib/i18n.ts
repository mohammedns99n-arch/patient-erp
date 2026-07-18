// Client-safe i18n: pure data + helpers only (no next/headers here, so this
// module can be imported by both Server and Client Components).
// Server-only locale reading lives in ./i18n.server.

export type Locale = "en" | "ar";
export const LOCALES: Locale[] = ["en", "ar"];
export const LOCALE_COOKIE = "locale";

export function dir(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

const en = {
  appName: "Patient Insurance Tracking",
  language: "Language",
  english: "English",
  arabic: "العربية",
  home: "Home",
  menu: "Menu",
  close: "Close",
  prevPage: "Previous",
  nextPage: "Next",
  allPatients: "All patients",
  cancel: "Cancel",
  all: "All",
  yes: "yes",
  no: "no",

  // Auth
  signIn: "Sign in",
  signInToContinue: "Sign in to continue",
  email: "Email",
  password: "Password",
  signingIn: "Signing in…",
  signOut: "Sign out",

  // Roles
  roleAdmin: "admin",
  roleStaff: "staff",

  // Home / nav
  patients: "Patients",
  newPatient: "New patient",
  dashboard: "Dashboard",
  financialTotals: "Financial totals",
  usersPermissions: "Users & permissions",
  yourAccess: "Your access",
  role: "Role",
  viewFinancials: "View financial totals",
  deleteCases: "Delete cases",
  manageUsers: "Manage users",

  // Status labels (status_code 0..3)
  status_0: "Visit",
  status_1: "Treated",
  status_2: "Invoice Submitted",
  status_3: "Payment Received",

  // Case types
  ct_Medical: "Medical",
  ct_Surgical: "Surgical",

  // Patients list
  searchLabel: "Search name / doctor / phone / ERP ID",
  searchPlaceholder: "Search…",
  doctor: "Doctor",
  statusWord: "Status",
  typeWord: "Type",
  visitFrom: "Visit from",
  visitTo: "Visit to",
  apply: "Apply",
  clear: "Clear",
  patientsWord: "patients",
  caseDeleted: "Case deleted.",
  exportExcel: "Export to Excel",
  noRowsToExport: "No rows to export",
  exportTitle: "Export the current filtered list to Excel",
  exporting: "Exporting…",
  errorWord: "Error",

  // Table headers
  colCase: "Case",
  colErpId: "ERP ID",
  colPatient: "Patient",
  colPhone: "Phone",
  colAge: "Age",
  colType: "Type",
  colDoctor: "Doctor",
  colDiagnosis: "Diagnosis",
  colTotal: "Total (IQD)",
  colStatus: "Status",
  colFirstVisit: "First visit",
  colLastUpdated: "Last updated",
  noPatientsMatch: "No patients match these filters.",
  addAPatient: "Add a patient",
  changeStatus: "Change status",

  // Form
  secPatient: "Patient",
  secCase: "Case details",
  secCost: "Cost breakdown (IQD)",
  secRevenue: "Revenue Collection (IQD)",
  secClinical: "Clinical notes (optional)",
  fErpId: "Patient ERP ID",
  errErpIdRequired: "Patient ERP ID is required.",
  fRevenueTotal: "Revenue total",
  fRevenuePatientPaid: "Patient paid (amount or %)",
  fRevenueInsuranceDue: "Insurance due",
  revenueHint: "Enter an amount (e.g. 800,000) or a percentage (e.g. 15%).",
  revenuePctOf: "of revenue total",
  iqd: "IQD",
  fPatientName: "Patient name",
  fPhone: "Phone number",
  fAge: "Age",
  fCaseType: "Case type",
  fDoctor: "Treating doctor",
  fProcedure: "Procedure type",
  fDiagnosis: "Diagnosis",
  fStatus: "Status",
  fTotal: "Total cost",
  fMaterials: "Materials share",
  fHospital: "Hospital share",
  fDoctorShare: "Doctor share",
  fLab: "Lab investigations",
  fImaging: "Imaging studies",
  fNotes: "Notes",
  selectPlaceholder: "Select…",
  sharesAddUpTo: "Shares add up to",
  butTotalIs: "but total cost is",
  canStillSave: "You can still save — fix it later if needed.",
  sharesMatch: "✓ Shares match the total.",
  savePatient: "Save patient",
  saveChanges: "Save changes",
  saving: "Saving…",

  // New / edit patient
  newPatientTitle: "New patient",
  savedBannerA: "Patient saved. Case ID",
  savedBannerB: "was created. You can add another below.",
  changesSaved: "Changes saved.",
  roCaseId: "Case ID",
  roFirstVisit: "First visit",
  roLastUpdated: "Last updated",
  roEnteredBy: "Entered by",
  dangerZone: "Danger zone",
  deleteDesc: "Permanently delete this case. This cannot be undone.",
  deleteCase: "Delete case",
  deleting: "Deleting…",
  confirmDeletePrefix: "Delete",
  confirmDeleteSuffix:
    "? This permanently removes the case and cannot be undone.",

  // Dashboard
  viewAllPatients: "View all patients",
  noPatientsYet: "No patients yet.",
  addTheFirst: "Add the first one",
  patientsByStatus: "Patients by status",
  recentlyUpdated: "Recently updated",
  totalWord: "total",
  byCaseType: "By case type",
  doctorsClick: "Doctors · click to see their patients",
  noDoctorsYet: "No doctors yet.",
  monthlyVolume: "Monthly patient volume (by first visit)",
  financialSummary: "Financial summary (IQD)",
  totalBilled: "Total billed (status 2)",
  totalReceived: "Total received (status 3)",
  outstanding: "Outstanding with Ministry",
  billedWord: "billed",
  receivedWord: "received",
  outstandingWord: "outstanding",
  colMonth: "Month",
  colBilled: "Billed",
  colReceived: "Received",
  colOutstanding: "Outstanding",
  financialsHidden:
    "Financial totals are hidden for your account. Ask an admin to grant “view financial totals” if you need them.",

  // Doctor page
  noPatientsForDoctor: "No patients found for this doctor.",
  backToDashboard: "Back to dashboard",
  summaryHeading:
    "Summary (IQD) · Paid = payment received · Expected = across all statuses",
  paid: "Paid",
  expected: "Expected",
  monthlyBreakdown:
    "Monthly breakdown (by first visit) · Paid / Expected",
  patientsHeading: "Patients",
  colPayment: "Payment",
  moneyHidden: "Money columns are hidden for your account.",

  // Users page
  usersDesc:
    "Toggle what each staff member can access. Admins always have full access.",
  colUser: "User",
  colRole: "Role",
  colViewFinancials: "View financials",
  colDeleteRecords: "Delete records",
  youSuffix: "(you)",
  usersFooter:
    "New accounts are created in the Supabase dashboard (Authentication → Users); they appear here automatically as staff with no extra permissions.",
  cantChangeOwnRole: "You can't change your own role",
  colViewStatistics: "View statistics",

  // Sidebar + new pages
  statistics: "Statistics",
  financials: "Financials",
  showDetails: "Show details",
  showLess: "Show less",

  // Statistics page
  statsDesc: "Trends across your patient cases. Tap a card to open its chart.",
  statSurgicalVsMedical: "Surgical vs Medical",
  statPatientsPerMonth: "Patients per month",
  statYoY: "Year-over-year",
  statPerDoctor: "Patients per doctor",
  statByStatus: "Patients by status",
  statNoData: "Not enough data yet.",
  thisYear: "this year",
  topDoctor: "Top doctor",
  vsPrevYear: "vs previous year",

  // Financials page
  finDesc: "Ministry billing and collection overview.",
  finOutstanding: "Outstanding with the Ministry",
  finOutstandingDesc: "Billed (invoice submitted) but not yet received.",
  finAmountCollected: "Amount collected from the Ministry",
  finAmountCollectedDesc: "Total received (payment received).",
  finCollectionRate: "Collection rate",
  finCollectionDesc: "Submitted invoices that have been received.",
  finBillingByMonth: "Billing by month",
  finBillingByMonthDesc: "Segment size = amount billed. Blue = fully paid, yellow = has pending. Hover a month for details.",
  finMonthlyBreakdown: "Monthly breakdown",
  finMonthlyBreakdownDesc: "By invoice submission month. Tap a month to see its totals.",
  finTotalWorked: "Total worked / billed",
  finHospitalShare: "Hospital's share",
  selectMonthPrompt: "Select a month to see its totals.",
  legendFullyPaid: "Fully paid",
  legendHasPending: "Has pending",
  finOldestPending: "Oldest pending invoices",
  finOldestPendingDesc: "Submitted more than a month ago and still unpaid (status 2), longest-waiting first.",
  colInvoiceSubmitted: "Invoice submitted",
  colDaysWaiting: "Days waiting",
  daysWord: "days",
  monthWord: "month",
  invoicesWord: "invoices",
  noPendingInvoices: "No invoices have been pending for more than a month.",

  // Monthly status-count tables (Financials + Statistics)
  monthLabel: "Month",
  totalCountCol: "Total",
  noPatientsInStatus: "No patients in this status.",
  loadingWord: "Loading…",
  finMonthlyStatus: "Monthly status counts",
  finMonthlyStatusDesc: "By invoice submission month. Click a count to see the patients.",
  statMonthlyStatus: "Monthly status counts",
  statMonthlyStatusDesc: "By first visit month. Click a count to see the patients.",

  // Money received by month (by payment date) table
  finMoneyReceived: "Money received by month",
  finMoneyReceivedDesc: "By payment date — the month the money arrived. Click a count to see the patients.",
  colAmountReceived: "Amount received",
  colCases: "Cases",

  // Processing time
  finProcessingTime: "Processing time",
  finProcessingDesc: "Average days across the case lifecycle.",
  procVisitToInvoice: "First visit → invoice submitted",
  procInvoiceToPayment: "Invoice submitted → payment received",
  procVisitToPayment: "First visit → payment received",
  procVisitToInvoiceHint: "how fast we invoice",
  procInvoiceToPaymentHint: "how long the Ministry takes to pay",
  procVisitToPaymentHint: "full cycle",
  procByMonth: "Break down by month",
  procMonthlyNote: "Grouped by first visit month.",
  avgWord: "avg",
  casesWord: "cases",

  // Server-action errors
  errRequiredFields: "Please fill in all required fields (marked with *).",
  errAge: "Age must be a whole number between 0 and 150.",
  errCaseType: "Case type must be Medical or Surgical.",
  errNoDeletePerm: "You don't have permission to delete records.",
} as const;

type Keys = keyof typeof en;

const ar: Record<Keys, string> = {
  appName: "متابعة الضمان الصحي للمرضى",
  language: "اللغة",
  english: "English",
  arabic: "العربية",
  home: "الرئيسية",
  menu: "القائمة",
  close: "إغلاق",
  prevPage: "السابق",
  nextPage: "التالي",
  allPatients: "كل المرضى",
  cancel: "إلغاء",
  all: "الكل",
  yes: "نعم",
  no: "لا",

  signIn: "تسجيل الدخول",
  signInToContinue: "سجّل الدخول للمتابعة",
  email: "البريد الإلكتروني",
  password: "كلمة المرور",
  signingIn: "جارٍ تسجيل الدخول…",
  signOut: "تسجيل الخروج",

  roleAdmin: "مدير",
  roleStaff: "موظف",

  patients: "المرضى",
  newPatient: "مريض جديد",
  dashboard: "لوحة المعلومات",
  financialTotals: "المجاميع المالية",
  usersPermissions: "المستخدمون والصلاحيات",
  yourAccess: "صلاحياتك",
  role: "الدور",
  viewFinancials: "عرض المجاميع المالية",
  deleteCases: "حذف السجلات",
  manageUsers: "إدارة المستخدمين",

  status_0: "زيارة",
  status_1: "تمت المعالجة",
  status_2: "تم تقديم الفاتورة",
  status_3: "تم استلام الدفع",

  ct_Medical: "طبّي",
  ct_Surgical: "جراحي",

  searchLabel: "بحث بالاسم / الطبيب / الهاتف / معرّف ERP",
  searchPlaceholder: "بحث…",
  doctor: "الطبيب",
  statusWord: "الحالة",
  typeWord: "النوع",
  visitFrom: "من تاريخ الزيارة",
  visitTo: "إلى تاريخ الزيارة",
  apply: "تطبيق",
  clear: "مسح",
  patientsWord: "مريض",
  caseDeleted: "تم حذف السجل.",
  exportExcel: "تصدير إلى Excel",
  noRowsToExport: "لا توجد سجلات للتصدير",
  exportTitle: "تصدير القائمة المُصفّاة الحالية إلى Excel",
  exporting: "جارٍ التصدير…",
  errorWord: "خطأ",

  colCase: "الحالة",
  colErpId: "معرّف ERP",
  colPatient: "المريض",
  colPhone: "الهاتف",
  colAge: "العمر",
  colType: "النوع",
  colDoctor: "الطبيب",
  colDiagnosis: "التشخيص",
  colTotal: "الإجمالي (د.ع)",
  colStatus: "الحالة",
  colFirstVisit: "أول زيارة",
  colLastUpdated: "آخر تحديث",
  noPatientsMatch: "لا يوجد مرضى مطابقون لهذه المرشحات.",
  addAPatient: "أضف مريضاً",
  changeStatus: "تغيير الحالة",

  secPatient: "المريض",
  secCase: "تفاصيل الحالة",
  secCost: "تفصيل التكلفة (د.ع)",
  secRevenue: "تحصيل الإيرادات (د.ع)",
  secClinical: "ملاحظات سريرية (اختياري)",
  fErpId: "معرّف ERP للمريض",
  errErpIdRequired: "معرّف ERP للمريض مطلوب.",
  fRevenueTotal: "إجمالي الإيراد",
  fRevenuePatientPaid: "دفع المريض (مبلغ أو %)",
  fRevenueInsuranceDue: "المستحق على التأمين",
  revenueHint: "أدخل مبلغاً (مثل 800,000) أو نسبة مئوية (مثل 15%).",
  revenuePctOf: "من إجمالي الإيراد",
  iqd: "د.ع",
  fPatientName: "اسم المريض",
  fPhone: "رقم الهاتف",
  fAge: "العمر",
  fCaseType: "نوع الحالة",
  fDoctor: "الطبيب المعالج",
  fProcedure: "نوع الإجراء",
  fDiagnosis: "التشخيص",
  fStatus: "الحالة",
  fTotal: "التكلفة الإجمالية",
  fMaterials: "حصة المواد",
  fHospital: "حصة المستشفى",
  fDoctorShare: "حصة الطبيب",
  fLab: "الفحوصات المختبرية",
  fImaging: "الدراسات الشعاعية",
  fNotes: "ملاحظات",
  selectPlaceholder: "اختر…",
  sharesAddUpTo: "مجموع الحصص",
  butTotalIs: "لكن التكلفة الإجمالية",
  canStillSave: "يمكنك الحفظ الآن وتصحيحها لاحقاً.",
  sharesMatch: "✓ الحصص تطابق الإجمالي.",
  savePatient: "حفظ المريض",
  saveChanges: "حفظ التغييرات",
  saving: "جارٍ الحفظ…",

  newPatientTitle: "مريض جديد",
  savedBannerA: "تم حفظ المريض. رقم الحالة",
  savedBannerB: "تم إنشاؤه. يمكنك إضافة مريض آخر أدناه.",
  changesSaved: "تم حفظ التغييرات.",
  roCaseId: "رقم الحالة",
  roFirstVisit: "أول زيارة",
  roLastUpdated: "آخر تحديث",
  roEnteredBy: "أُدخل بواسطة",
  dangerZone: "منطقة الخطر",
  deleteDesc: "حذف هذه الحالة نهائياً. لا يمكن التراجع عن ذلك.",
  deleteCase: "حذف الحالة",
  deleting: "جارٍ الحذف…",
  confirmDeletePrefix: "حذف",
  confirmDeleteSuffix: "؟ سيؤدي هذا إلى إزالة الحالة نهائياً ولا يمكن التراجع.",

  viewAllPatients: "عرض كل المرضى",
  noPatientsYet: "لا يوجد مرضى بعد.",
  addTheFirst: "أضف أول مريض",
  patientsByStatus: "المرضى حسب الحالة",
  recentlyUpdated: "آخر التحديثات",
  totalWord: "الإجمالي",
  byCaseType: "حسب نوع الحالة",
  doctorsClick: "الأطباء · انقر لعرض مرضاهم",
  noDoctorsYet: "لا يوجد أطباء بعد.",
  monthlyVolume: "عدد المرضى شهرياً (حسب أول زيارة)",
  financialSummary: "الملخص المالي (د.ع)",
  totalBilled: "إجمالي المُفوتر (الحالة 2)",
  totalReceived: "إجمالي المُستلم (الحالة 3)",
  outstanding: "المستحق لدى الوزارة",
  billedWord: "مُفوتر",
  receivedWord: "مُستلم",
  outstandingWord: "مستحق",
  colMonth: "الشهر",
  colBilled: "المُفوتر",
  colReceived: "المُستلم",
  colOutstanding: "المستحق",
  financialsHidden:
    "المجاميع المالية مخفية لحسابك. اطلب من المدير منح صلاحية «عرض المجاميع المالية» إذا احتجتها.",

  noPatientsForDoctor: "لا يوجد مرضى لهذا الطبيب.",
  backToDashboard: "العودة إلى لوحة المعلومات",
  summaryHeading:
    "الملخص (د.ع) · المدفوع = تم استلام الدفع · المتوقع = عبر كل الحالات",
  paid: "المدفوع",
  expected: "المتوقع",
  monthlyBreakdown: "التفصيل الشهري (حسب أول زيارة) · المدفوع / المتوقع",
  patientsHeading: "المرضى",
  colPayment: "الدفع",
  moneyHidden: "أعمدة المبالغ مخفية لحسابك.",

  usersDesc:
    "حدّد ما يمكن لكل موظف الوصول إليه. المدراء لديهم دائماً صلاحية كاملة.",
  colUser: "المستخدم",
  colRole: "الدور",
  colViewFinancials: "عرض المالية",
  colDeleteRecords: "حذف السجلات",
  youSuffix: "(أنت)",
  usersFooter:
    "تُنشأ الحسابات الجديدة من لوحة Supabase (Authentication ← Users)؛ وتظهر هنا تلقائياً كموظف بدون صلاحيات إضافية.",
  cantChangeOwnRole: "لا يمكنك تغيير دورك",
  colViewStatistics: "عرض الإحصائيات",

  statistics: "الإحصائيات",
  financials: "الأمور المالية",
  showDetails: "عرض التفاصيل",
  showLess: "عرض أقل",

  statsDesc: "اتجاهات حالات المرضى. اضغط على البطاقة لعرض مخططها.",
  statSurgicalVsMedical: "جراحي مقابل طبّي",
  statPatientsPerMonth: "المرضى شهرياً",
  statYoY: "مقارنة سنوية",
  statPerDoctor: "المرضى حسب الطبيب",
  statByStatus: "المرضى حسب الحالة",
  statNoData: "لا توجد بيانات كافية بعد.",
  thisYear: "هذه السنة",
  topDoctor: "الأكثر مرضى",
  vsPrevYear: "مقارنة بالسنة السابقة",

  finDesc: "نظرة عامة على الفوترة والتحصيل مع الوزارة.",
  finOutstanding: "المستحق لدى الوزارة",
  finOutstandingDesc: "مفوتر (تم تقديم الفاتورة) ولم يُستلم بعد.",
  finAmountCollected: "المبلغ المُحصّل من الوزارة",
  finAmountCollectedDesc: "إجمالي المُستلم (تم استلام الدفع).",
  finCollectionRate: "نسبة التحصيل",
  finCollectionDesc: "الفواتير المقدَّمة التي تم استلامها.",
  finBillingByMonth: "الفوترة حسب الشهر",
  finBillingByMonthDesc: "حجم القطاع = المبلغ المُفوتر. الأزرق = مدفوعة بالكامل، الأصفر = توجد معلّقة. مرّر فوق الشهر للتفاصيل.",
  finMonthlyBreakdown: "التفصيل الشهري",
  finMonthlyBreakdownDesc: "حسب شهر تقديم الفاتورة. اضغط على شهر لعرض مجاميعه.",
  finTotalWorked: "إجمالي المُنجز / المُفوتر",
  finHospitalShare: "حصة المستشفى",
  selectMonthPrompt: "اختر شهراً لعرض مجاميعه.",
  legendFullyPaid: "مدفوعة بالكامل",
  legendHasPending: "توجد معلّقة",
  finOldestPending: "أقدم الفواتير المعلّقة",
  finOldestPendingDesc: "قُدّمت قبل أكثر من شهر ولا تزال غير مدفوعة (الحالة 2)، الأطول انتظاراً أولاً.",
  colInvoiceSubmitted: "تاريخ تقديم الفاتورة",
  colDaysWaiting: "أيام الانتظار",
  daysWord: "يوم",
  monthWord: "شهر",
  invoicesWord: "فواتير",
  noPendingInvoices: "لا توجد فواتير معلّقة لأكثر من شهر.",

  monthLabel: "الشهر",
  totalCountCol: "الإجمالي",
  noPatientsInStatus: "لا يوجد مرضى في هذه الحالة.",
  loadingWord: "جارٍ التحميل…",
  finMonthlyStatus: "أعداد الحالات الشهرية",
  finMonthlyStatusDesc: "حسب شهر تقديم الفاتورة. اضغط على العدد لعرض المرضى.",
  statMonthlyStatus: "أعداد الحالات الشهرية",
  statMonthlyStatusDesc: "حسب شهر أول زيارة. اضغط على العدد لعرض المرضى.",

  finMoneyReceived: "الأموال المستلمة شهرياً",
  finMoneyReceivedDesc: "حسب تاريخ الدفع — الشهر الذي وصل فيه المبلغ. اضغط على العدد لعرض المرضى.",
  colAmountReceived: "المبلغ المستلم",
  colCases: "الحالات",

  finProcessingTime: "زمن المعالجة",
  finProcessingDesc: "متوسط الأيام عبر دورة حياة الحالة.",
  procVisitToInvoice: "أول زيارة ← تقديم الفاتورة",
  procInvoiceToPayment: "تقديم الفاتورة ← استلام الدفع",
  procVisitToPayment: "أول زيارة ← استلام الدفع",
  procVisitToInvoiceHint: "سرعة إصدار الفاتورة",
  procInvoiceToPaymentHint: "المدة التي تستغرقها الوزارة للدفع",
  procVisitToPaymentHint: "الدورة الكاملة",
  procByMonth: "تفصيل شهري",
  procMonthlyNote: "مجمّعة حسب شهر أول زيارة.",
  avgWord: "متوسط",
  casesWord: "حالة",

  errRequiredFields: "يرجى تعبئة جميع الحقول المطلوبة (المميّزة بـ *).",
  errAge: "يجب أن يكون العمر رقماً صحيحاً بين 0 و150.",
  errCaseType: "يجب أن يكون نوع الحالة طبّي أو جراحي.",
  errNoDeletePerm: "ليست لديك صلاحية حذف السجلات.",
};

const dict: Record<Locale, Record<Keys, string>> = { en, ar };

export type TranslateFn = (key: Keys) => string;

export function getT(locale: Locale): TranslateFn {
  return (key) => dict[locale][key] ?? en[key] ?? String(key);
}

// --- Localized enums / months ----------------------------------------
export function statusLabel(locale: Locale, code: number): string {
  const key = `status_${code}` as Keys;
  return dict[locale][key] ?? dict.en[key] ?? String(code);
}

export function caseTypeLabel(locale: Locale, ct: string): string {
  const key = `ct_${ct}` as Keys;
  return dict[locale][key] ?? ct;
}

const MONTHS_SHORT: Record<Locale, string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
};

export function monthName(locale: Locale, index: number): string {
  return MONTHS_SHORT[locale][index] ?? MONTHS_SHORT.en[index] ?? String(index + 1);
}
