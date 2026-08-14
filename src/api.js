// İnce fetch sarmalayıcı: JWT'yi otomatik ekler, JSON gövdeyi parse eder,
// hata durumunda backend'in { error } mesajını fırlatır.
const API_BASE = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL) || "http://localhost:4100/api";
const TOKEN_KEY = "kocluk:token";

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch (_) { return null; }
}
export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (_) { /* depolamaya erişilemiyor olabilir */ }
}

async function request(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Sunucuyla iletişim kurulamadı");
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  // --- auth ---
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
  me: () => request("/auth/me"),
  forgotPassword: (email) => request("/auth/forgot-password", { method: "POST", body: { email } }),
  setPassword: (currentPassword, newPassword) => request("/auth/set-password", { method: "POST", body: { currentPassword, newPassword } }),

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

  // --- öğretmen ---
  teacherListStudents: () => request("/teacher/students"),

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
  listSourceBooks: (examType) => request(`/assignments/source-books${examType ? `?examType=${encodeURIComponent(examType)}` : ""}`),

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

  // --- öğrenci: serbest çalışma ---
  createStudySession: (payload) => request("/study-sessions", { method: "POST", body: payload }),
  listStudySessions: () => request("/study-sessions"),
  deleteStudySession: (id) => request(`/study-sessions/${id}`, { method: "DELETE" }),

  // --- özet istatistikler ---
  teacherStats: () => request("/stats/teacher"),
  studentStats: () => request("/stats/student"),
};
