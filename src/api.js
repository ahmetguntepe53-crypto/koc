// İnce fetch sarmalayıcı: JWT'yi otomatik ekler, JSON gövdeyi parse eder,
// hata durumunda backend'in { error } mesajını fırlatır.
const API_BASE = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL) || "http://localhost:4100/api";
// Kanıt fotoğrafları /api altında DEĞİL, ayrı bir /uploads yolunda servis edilir (bkz. server/src/app.js)
// — API prod'da kendi alt alan adında olduğu için (api.kocluk.maiakademi.com) bu, sitenin kök adresiyle
// AYNI şey değildir; /api'siz API origin'i buradan türetilir.
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, "");
const TOKEN_KEY = "kocluk:token";

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch (_) { return null; }
}
export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (_) { /* depolamaya erişilemiyor olabilir */ }
  try { tokenMirror?.(token); } catch (_) { /* yansıtma başarısızsa localStorage yine de yazıldı */ }
}

// iOS kabuğunda (WKWebView) localStorage, sistem depolama baskısı altında TEMİZLENEBİLİR — bu
// olduğunda kullanıcı sebepsiz yere çıkış yapmış olur. native.js açılışta Capacitor Preferences'a
// yazan bir yansıtma fonksiyonu takar ve token'ı oradan geri yükler. Web'de kanca takılmaz,
// davranış değişmez — bu yüzden api.js'in Capacitor'a bağımlılığı yoktur (testler de etkilenmez).
let tokenMirror = null;
export function setTokenMirror(fn) { tokenMirror = fn; }

// Oturum sunucu tarafında geçersizleştiğinde (başka cihazda şifre değişti, admin şifre belirledi,
// hesap askıya alındı, 30 günlük süre doldu) uygulama içinde "girişli" kalıp her ekranda hata metni
// göstermek yerine tek noktadan çıkış yapılsın diye — useAuthSession buraya logout'u bağlar.
let unauthorizedHandler = null;
export function setUnauthorizedHandler(fn) { unauthorizedHandler = fn; }

const REQUEST_TIMEOUT_MS = 20000;
const UPLOAD_TIMEOUT_MS = 90000;
export const NETWORK_ERROR_MESSAGE = "Sunucuya bağlanılamadı — internet bağlantını kontrol edip tekrar dene.";

// fetch() ağ hatasında (uçak modu, zayıf okul Wi-Fi'ı, zaman aşımı) tarayıcının ham İngilizce
// mesajıyla ("Failed to fetch" / "Load failed") reddeder — kullanıcıya Türkçe bir mesaj gösterilsin,
// çağıran taraf da err.network ile bunu HTTP hatasından (401/500) ayırt edebilsin diye sarmalanır.
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (_) {
    throw Object.assign(new Error(NETWORK_ERROR_MESSAGE), { network: true });
  } finally {
    clearTimeout(timer);
  }
}

async function handleResponse(res, sentToken) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Sunucuyla iletişim kurulamadı");
    err.data = data;
    err.status = res.status;
    err.code = data.code;
    // Yalnızca requireAuth'un işaretlediği yanıtlar oturumu kapatır — sıradan bir 403 ("bu işlem için
    // yetkin yok") ya da girişteki "şifre hatalı" 401'i kullanıcıyı dışarı atmamalı.
    if (sentToken && (data.code === "SESSION_INVALID" || data.code === "BANNED")) {
      try { unauthorizedHandler?.(err); } catch (_) { /* çıkış akışı hatası isteğin hatasını gölgelemesin */ }
    }
    throw err;
  }
  return data;
}

async function request(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }, REQUEST_TIMEOUT_MS);
  return handleResponse(res, !!token);
}

export function photoUrl(photo) {
  return `${API_ORIGIN}/uploads/assignment-photos/${photo.recipientId}/${photo.filename}`;
}

async function uploadFile(path, file) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const formData = new FormData();
  formData.append("photo", file);
  // Content-Type kasıtlı olarak set edilmiyor — tarayıcı FormData için doğru multipart boundary'yi
  // kendisi ekler, elle "multipart/form-data" yazılırsa boundary eksik kalıp istek bozulur.
  const res = await fetchWithTimeout(`${API_BASE}${path}`, { method: "POST", headers, body: formData }, UPLOAD_TIMEOUT_MS);
  return handleResponse(res, !!token);
}

export const api = {
  // Zorunlu güncelleme eşiği — kimlik GEREKMEZ, App.jsx açılışta giriş ekranından ÖNCE çağırır
  // (bkz. server/src/routes/appVersion.js).
  appVersion: () => request("/app-version"),

  // --- auth ---
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
  me: () => request("/auth/me"),
  forgotPassword: (email) => request("/auth/forgot-password", { method: "POST", body: { email } }),
  setPassword: (currentPassword, newPassword, acceptedTerms) => request("/auth/set-password", { method: "POST", body: { currentPassword, newPassword, acceptedTerms } }),

  // --- admin: kullanıcı yönetimi ---
  adminStats: () => request("/admin/stats"),
  adminListUsers: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return request(`/admin/users${qs ? `?${qs}` : ""}`);
  },
  adminListTeachers: () => request("/admin/teachers"),
  adminCreateUser: (payload) => request("/admin/users", { method: "POST", body: payload }),
  adminBulkImport: (role, rows) => request("/admin/users/bulk-import", { method: "POST", body: { role, rows } }),
  adminUpdateUser: (id, patch) => request(`/admin/users/${id}`, { method: "PATCH", body: patch }),
  adminReassignTeacher: (studentId, teacherId) => request(`/admin/users/${studentId}/reassign-teacher`, { method: "POST", body: { teacherId } }),
  adminBulkReassignTeacher: (studentIds, teacherId) => request("/admin/users/bulk-reassign-teacher", { method: "POST", body: { studentIds, teacherId } }),
  adminResendActivation: (id) => request(`/admin/users/${id}/resend-activation`, { method: "POST" }),
  adminSetPassword: (id, password) => request(`/admin/users/${id}/set-password`, { method: "POST", body: { password } }),
  adminBanUser: (id) => request(`/admin/users/${id}/ban`, { method: "POST" }),
  adminUnbanUser: (id) => request(`/admin/users/${id}/unban`, { method: "POST" }),
  adminDeleteUser: (id) => request(`/admin/users/${id}`, { method: "DELETE" }),
  adminListPhotos: (q) => request(`/admin/photos${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  adminDeletePhoto: (photoId) => request(`/admin/photos/${photoId}`, { method: "DELETE" }),
  adminGetSettings: () => request("/admin/settings"),
  adminUpdateSettings: (patch) => request("/admin/settings", { method: "PUT", body: patch }),
  // Branş öğretmeninin dersleri — en az bir ders "ders öğretmeni" yetkisini açar, boş liste kapatır.
  adminSetTeacherSubjects: (id, subjects) => request(`/admin/users/${id}/subject-teacher`, { method: "POST", body: { subjects } }),
  // Okul analizi — okul geneli ödevlerin toplu sonuçları (weeks: 4 | 8 | 16; gradeLevel: 11 | 12, boş = tümü).
  adminAnalytics: (weeks, gradeLevel) => request(`/admin/analytics?weeks=${encodeURIComponent(weeks)}${gradeLevel ? `&gradeLevel=${encodeURIComponent(gradeLevel)}` : ""}`),
  // Aktivite — günlük/haftalık giriş sayıları, kim hiç girmedi (days: 7 | 14 | 30).
  adminActivity: (days) => request(`/admin/activity?days=${encodeURIComponent(days)}`),
  // Sıralama — öğrenci adıyla genel başarı sıralaması (tüm zamanlar, tüm dersler toplamı).
  adminLeaderboard: () => request("/admin/leaderboard"),

  // --- okul ayarları (herkese salt-okunur) ---
  getExamDates: () => request("/settings"),

  // --- öğretmen ---
  teacherListStudents: () => request("/teacher/students"),
  teacherStudentOverview: (studentId) => request(`/teacher/students/${studentId}/overview`),
  // Öğrencinin YKS alanı (SAY / EA / SOZ / DIL; null = bilinmiyor) — yalnızca kendi öğrencisi.
  setMyField: (field) => request("/auth/me/field", { method: "PATCH", body: { field } }),
  // Koçun tarihli özel notları — yalnızca yazan koç görür.
  teacherAddNote: (studentId, text) => request(`/teacher/students/${studentId}/notes`, { method: "POST", body: { text } }),
  teacherEditNote: (noteId, text) => request(`/teacher/notes/${noteId}`, { method: "PATCH", body: { text } }),
  teacherDeleteNote: (noteId) => request(`/teacher/notes/${noteId}`, { method: "DELETE" }),

  // --- ödevler ---
  listAssignments: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return request(`/assignments${qs ? `?${qs}` : ""}`);
  },
  getAssignment: (id) => request(`/assignments/${id}`),
  createAssignment: (payload) => request("/assignments", { method: "POST", body: payload }),
  updateAssignment: (id, patch) => request(`/assignments/${id}`, { method: "PATCH", body: patch }),
  deleteAssignment: (id) => request(`/assignments/${id}`, { method: "DELETE" }),
  sendAssignmentNow: (id) => request(`/assignments/${id}/send-now`, { method: "POST" }),
  remindRecipient: (assignmentId, recipientId) => request(`/assignments/${assignmentId}/recipients/${recipientId}/remind`, { method: "POST" }),
  listSourceBooks: (examType) => request(`/assignments/source-books${examType ? `?examType=${encodeURIComponent(examType)}` : ""}`),
  // Branş öğretmeninin ödev gönderebileceği okul genelindeki öğrenciler (yalnızca branş öğretmenleri).
  assignmentAudience: () => request("/assignments/audience"),

  // --- öğretmen: yıllık plan ---
  listPlanEntries: (examType) => request(`/plan-entries?examType=${encodeURIComponent(examType)}`),
  createPlanEntry: (payload) => request("/plan-entries", { method: "POST", body: payload }),
  savePlanEntry: (id, payload) => request(`/plan-entries/${id}`, { method: "PUT", body: payload }),
  deletePlanEntry: (id) => request(`/plan-entries/${id}`, { method: "DELETE" }),
  publishPlanEntry: (id) => request(`/plan-entries/${id}/publish`, { method: "POST" }),
  // "Ertele": { from: "YYYY-MM-DD", weeks, examType?, subject? } — önizleme hiçbir şey yazmaz.
  previewPlanShift: (payload) => request("/plan-entries/shift/preview", { method: "POST", body: payload }),
  shiftPlan: (payload) => request("/plan-entries/shift", { method: "POST", body: payload }),
  restorePlanDates: (items) => request("/plan-entries/restore-dates", { method: "POST", body: { items } }),
  planSchoolWideCount: (examType, gradeLevel) => request(`/plan-entries/school-wide-count?examType=${encodeURIComponent(examType)}${gradeLevel ? `&gradeLevel=${gradeLevel}` : ""}`),

  // --- bildirimler ---
  listNotifications: () => request("/notifications"),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: "POST" }),
  markAllNotificationsRead: () => request("/notifications/read-all", { method: "POST" }),

  // --- öğrenci: atanmış ödevler ---
  listMyAssignments: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== "")).toString();
    return request(`/assignment-recipients/mine${qs ? `?${qs}` : ""}`);
  },
  getRecipient: (id) => request(`/assignment-recipients/${id}`),
  submitRecipient: (id, payload) => request(`/assignment-recipients/${id}/submit`, { method: "POST", body: payload }),
  uploadRecipientPhoto: (id, file) => uploadFile(`/assignment-recipients/${id}/photos`, file),
  deleteRecipientPhoto: (id, photoId) => request(`/assignment-recipients/${id}/photos/${photoId}`, { method: "DELETE" }),
  // "Pas geç": reason KONU | ZAMAN | KAYNAK | DIGER (+ note yalnızca DIGER'de).
  skipRecipient: (id, reason, note) => request(`/assignment-recipients/${id}/skip`, { method: "POST", body: { reason, note } }),
  unskipRecipient: (id) => request(`/assignment-recipients/${id}/skip`, { method: "DELETE" }),

  // --- branş öğretmeni ---
  branchTracks: () => request("/branch/tracks"),
  branchOverview: (examType, subject) => request(`/branch/overview?examType=${encodeURIComponent(examType)}&subject=${encodeURIComponent(subject)}`),
  branchRemindCoaches: (assignmentId) => request(`/branch/assignments/${assignmentId}/remind-coaches`, { method: "POST" }),

  // --- öğrenci: serbest çalışma ---
  createStudySession: (payload) => request("/study-sessions", { method: "POST", body: payload }),
  listStudySessions: () => request("/study-sessions"),
  deleteStudySession: (id) => request(`/study-sessions/${id}`, { method: "DELETE" }),

  // --- deneme sınavları (öğrenci kendisi; koç kendi öğrencisi için studentId ile; admin yalnızca okur) ---
  // payload: { studentId?, examType: "TYT" | "AYT", date: "YYYY-MM-DD", name?, results: [{ subject, correct, wrong, blank }] }
  listPracticeExams: (studentId) => request(`/practice-exams${studentId ? `?studentId=${encodeURIComponent(studentId)}` : ""}`),
  createPracticeExam: (payload) => request("/practice-exams", { method: "POST", body: payload }),
  updatePracticeExam: (id, payload) => request(`/practice-exams/${id}`, { method: "PUT", body: payload }),
  deletePracticeExam: (id) => request(`/practice-exams/${id}`, { method: "DELETE" }),

  // --- özet istatistikler ---
  teacherStats: () => request("/stats/teacher"),
  studentStats: () => request("/stats/student"),
  // Ayrıntılı başarı raporu (ders karnesi, konu analizi, düzen, sınıf karşılaştırması, öneriler) — bkz. src/reportModel.js.
  teacherMonthlyReports: (month) => request(`/teacher/monthly-reports?month=${encodeURIComponent(month)}`),
  // Yapay zekâ incelemesi (yalnızca koç/admin; okulda açık ve sunucuda yapılandırılmışsa).
  getAiAnalysis: (studentId, month) => request(`/ai/analysis?studentId=${encodeURIComponent(studentId)}&month=${encodeURIComponent(month)}`),
  createAiAnalysis: (studentId, month, refresh) => request("/ai/analysis", { method: "POST", body: { studentId, month, refresh } }),
  getFullReport: (studentId) => request(`/stats/full-report${studentId ? `?studentId=${encodeURIComponent(studentId)}` : ""}`),
  getReport: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return request(`/stats/report${qs ? `?${qs}` : ""}`);
  },

  // --- push bildirim aboneliği (yalnızca native kabuk; bkz. src/push.js) ---
  pushSubscribe: (token) => request("/push/subscribe", { method: "POST", body: { token } }),
  pushUnsubscribe: (token) => request("/push/unsubscribe", { method: "POST", body: { token } }),
};
