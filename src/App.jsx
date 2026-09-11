import { useEffect, useState } from "react";
import { Users, PlusCircle, ClipboardList, Bell, UserCircle2, BookOpen, Images, CalendarRange, NotebookPen } from "lucide-react";
import { C, THEMES } from "./theme.js";
import { useAuthSession } from "./hooks/useAuthSession.js";
import { Sidebar, PageHeader, BottomNav } from "./components/common.jsx";
import { api } from "./api.js";
import { registerPush, unregisterPush } from "./native/push.js";
import { onBackButton, exitApp, setStatusBarTheme } from "./native/index.js";
import LoginScreen from "./screens/LoginScreen.jsx";
import ProfileScreen from "./screens/ProfileScreen.jsx";
import NotificationsScreen from "./screens/NotificationsScreen.jsx";
import AdminUsersScreen from "./screens/admin/AdminUsersScreen.jsx";
import AdminPhotosScreen from "./screens/admin/AdminPhotosScreen.jsx";
import TeacherStudentsScreen from "./screens/teacher/TeacherStudentsScreen.jsx";
import StudentOverviewScreen from "./screens/teacher/StudentOverviewScreen.jsx";
import AssignmentCreateScreen from "./screens/teacher/AssignmentCreateScreen.jsx";
import PlanScreen from "./screens/teacher/PlanScreen.jsx";
import AssignmentListScreen from "./screens/teacher/AssignmentListScreen.jsx";
import AssignmentDetailScreen from "./screens/teacher/AssignmentDetailScreen.jsx";
import StudentHomeScreen from "./screens/student/StudentHomeScreen.jsx";
import AssignmentSubmitScreen from "./screens/student/AssignmentSubmitScreen.jsx";
import StudyLogScreen from "./screens/student/StudyLogScreen.jsx";
import ReportScreen from "./screens/ReportScreen.jsx";

const DEFAULT_SCREEN_BY_ROLE = { ADMIN: "users", TEACHER: "students", STUDENT: "myAssignments" };

// Kompozisyon kökü: router yok, `screen` string state'i hangi ekranın render edileceğini belirler
// (PP'deki HalisahaApp.jsx ile aynı desen). Düzen: sol kenar çubuğu (rol'e göre sekmeler) + sağda
// sayfa başlığı + içerik.
// localStorage tek başına güvenilir değil (bkz. api.js), ama bir tema tercihi kaybolursa yalnızca
// varsayılana (light) döner — auth token'ın aksine veri kaybı riski yok, bu yüzden Preferences köprüsü
// gerektirmeden doğrudan burada okunur/yazılır.
function readStoredTheme() {
  try { return localStorage.getItem("kocluk-theme") || "light"; } catch (_) { return "light"; }
}

export default function App() {
  const [authUser, setAuthUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  // "light" | "dark" — profilden değiştirilir. HalisahaApp.jsx ile AYNI desen: Object.assign(C, ...)
  // doğrudan render gövdesinde (bir effect İÇİNDE DEĞİL) çağrılır, böylece theme state'i her
  // değiştiğinde App zaten yeniden render olur ve TÜM alt bileşenler bir sonraki render'da C'nin
  // güncel değerlerini görür — ayrı bir Context/"temayı yaydır" mekanizması gerekmez.
  const [theme, setThemeState] = useState(readStoredTheme);
  Object.assign(C, THEMES[theme] || THEMES.light);
  const setTheme = (t) => {
    setThemeState(t);
    try { localStorage.setItem("kocluk-theme", t); } catch (_) { /* tercih kalıcı olmasa da uygulama çalışmaya devam eder */ }
  };
  // Durum çubuğu şeridi ve (native'de) sistem durum çubuğu simgeleri, ayrıca index.html'deki inline
  // style'larla ifade edilemeyen birkaç CSS kuralı (:focus/:hover/::selection — bkz. index.html üstteki
  // not) C.* içinde DEĞİL, imperatif bir DOM/native yan etki olduğu için render gövdesi yerine
  // effect'te, yalnızca theme değişince güncellenir.
  useEffect(() => {
    setStatusBarTheme(theme === "dark");
    document.documentElement.style.setProperty("--accent-color", C.accent);
    document.documentElement.style.setProperty("--accent-glow", C.accentSoft);
  }, [theme]);
  // null = henüz role uygun bir varsayılan atanmadı (mount'ta oturum geri yüklenirken YA DA
  // logout()'un bıraktığı "login" değerinden sonra) — aşağıdaki effect authUser hazır olur olmaz
  // buna role uygun bir başlangıç ekranı atar.
  const [screen, setScreen] = useState(null);
  // Ödev/atama detay ekranlarına geçerken hangi kaydın açılacağını taşır — ayrı bir route
  // parametresi olmadığı için (router yok) en basit çözüm bu paylaşılan state.
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(null);
  // Ödev Detayı'na Öğrencilerim listesinden mi yoksa Öğrenci Özeti'nden mi girildiğini tutar — "geri"
  // ait olduğu ekrana dönsün diye (aksi halde özetten açılan bir ödev her zaman listeye dönerdi).
  const [assignmentDetailReturnTo, setAssignmentDetailReturnTo] = useState("assignments");
  const [selectedRecipientId, setSelectedRecipientId] = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [selectedStudentName, setSelectedStudentName] = useState(null);
  // Öğrenci Özeti'ndeki "Yeni Ödev Ata" kısayolu Ödev Oluştur'u bu öğrenci önceden tikli açar,
  // oluşturulunca da tüm listeye değil doğrudan bu öğrencinin özetine geri döner.
  const [assignmentCreateInitialStudentId, setAssignmentCreateInitialStudentId] = useState(null);
  const [assignmentCreateReturnTo, setAssignmentCreateReturnTo] = useState("assignments");
  // Rapor artık kalıcı bir sekme değil — öğretmen bir öğrencinin özetinden, öğrenci ise kendi
  // profilinden açar; "geri" hangisinden açıldıysa oraya dönsün diye bu tutulur.
  const [reportReturnTo, setReportReturnTo] = useState("studentOverview");
  // İlgili liste ekranları kendi useEffect'inde yükleniyor; bir kayıt oluşturulduğunda/güncellendiğinde
  // ya da detaydan dönüldüğünde listenin BAYAT veriyle kalmaması için bu sayaçlar artırılıp yeniden yükleme tetiklenir.
  const [assignmentsRefreshKey, setAssignmentsRefreshKey] = useState(0);
  const [myAssignmentsRefreshKey, setMyAssignmentsRefreshKey] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  // Native kabuk olayları (arka plandan dönüş / gelen push) rozeti tazelemek için bu sayacı artırır.
  const [notificationsRefreshKey, setNotificationsRefreshKey] = useState(0);

  const { login, logout: endSession, forgotPassword } = useAuthSession({ setAuthUser, setAuthChecked, setScreen });

  // Çıkışta cihazın push token'ı sunucudan silinir; aksi halde telefon, çıkmış kullanıcının
  // bildirimlerini almaya devam ederdi. Ağ hatası çıkışı ENGELLEMEZ.
  const logout = () => { unregisterPush().catch(() => {}); endSession(); };

  // logout() kasıtlı olarak screen'i "login"a çeker (LoginScreen zaten !authUser'a bakarak
  // gösteriliyor olsa da tutarlı bir "sıfırlanmış" durum bırakmak için) — bir sonraki başarılı
  // girişte bu değer üzerinde kalırsa hiçbir ekran eşleşmez. Aynı şey sayfa TAM yenilendiğinde de
  // olur: screen mount'ta null'dan başlar, oturum token'dan geri yüklenir ama hiçbir kullanıcı
  // eylemi "login" değerini bırakmaz — o yüzden hem null hem "login" burada ele alınır.
  useEffect(() => {
    if (authUser && (screen === "login" || screen === null)) {
      setScreen(DEFAULT_SCREEN_BY_ROLE[authUser.role] || "profile");
    }
  }, [authUser, screen]);

  // Bildirimler ekranı okunmamışları okundu işaretler — o ekrandan her ayrılışta rozet sayısı tazelenir.
  useEffect(() => {
    if (!authUser) return;
    api.listNotifications().then(({ unreadCount }) => setUnreadCount(unreadCount)).catch(() => {});
  }, [authUser, screen, notificationsRefreshKey]);

  // Push aboneliği giriş yapıldıktan SONRA kurulur: /api/push/subscribe kimlik doğrulaması ister
  // ve token oturum sahibi kullanıcıya yazılır. Web'de no-op.
  useEffect(() => {
    if (!authUser) return;
    registerPush();
  }, [authUser]);

  // Native kabuk olayları: uygulama arka plandan döndüğünde ya da ön plandayken push geldiğinde
  // rozeti tazele; bildirime dokunularak açıldıysa data.screen'e göre ilgili ekrana git (sunucudaki
  // notifyUser çağrıları bkz. scheduler.js/assignments.js — yalnızca bu iki şekil üretiliyor).
  useEffect(() => {
    if (!authUser) return;
    const refresh = () => setNotificationsRefreshKey((k) => k + 1);
    const goToNotificationTarget = (data) => {
      refresh();
      if (data?.screen === "assignmentSubmit" && data?.recipientId) {
        setSelectedRecipientId(data.recipientId);
        setScreen("assignmentSubmit");
      } else if (data?.screen === "assignmentDetail" && data?.assignmentId) {
        setSelectedAssignmentId(data.assignmentId);
        setScreen("assignmentDetail");
      } else {
        setScreen("notifications");
      }
    };
    const onPushOpen = (e) => goToNotificationTarget(e.detail);
    window.addEventListener("kocluk:resume", refresh);
    window.addEventListener("kocluk:push", refresh);
    window.addEventListener("kocluk:push-open", onPushOpen);
    return () => {
      window.removeEventListener("kocluk:resume", refresh);
      window.removeEventListener("kocluk:push", refresh);
      window.removeEventListener("kocluk:push-open", onPushOpen);
    };
  }, [authUser]);

  // Android donanım geri tuşu: bir detay ekranındaysak liste ekranına dön, bir sekme (kök) ekranındaysak
  // uygulamadan çık — aksi halde Capacitor varsayılanı hiçbir şey yapmaz ve tuş "ölü" görünür.
  useEffect(() => {
    if (!authUser || !screen) return;
    return onBackButton(() => {
      if (screen === "assignmentDetail") {
        setSelectedAssignmentId(null);
        if (assignmentDetailReturnTo === "studentOverview") { setScreen("studentOverview"); return; }
        setAssignmentsRefreshKey((k) => k + 1);
        setScreen("assignments");
        return;
      }
      if (screen === "assignmentSubmit") {
        setSelectedRecipientId(null);
        setMyAssignmentsRefreshKey((k) => k + 1);
        setScreen("myAssignments");
        return;
      }
      if (screen === "studentOverview") {
        setSelectedStudentId(null);
        setScreen("students");
        return;
      }
      if (screen === "reports") {
        setScreen(reportReturnTo);
        return;
      }
      const tabIds = [...(TABS_BY_ROLE[authUser.role] || []).map((t) => t.id), "profile"];
      if (tabIds.includes(screen)) {
        exitApp();
        return;
      }
      setScreen(DEFAULT_SCREEN_BY_ROLE[authUser.role] || "profile");
    });
  }, [authUser, screen, assignmentDetailReturnTo, reportReturnTo]);

  if (!authChecked) {
    return <div style={{ minHeight: "100vh", background: C.bg }} />;
  }

  if (!authUser) {
    return <LoginScreen onLogin={login} onForgotPassword={forgotPassword} />;
  }

  if (!screen) {
    return <div style={{ minHeight: "100vh", background: C.bg }} />;
  }

  const openAssignment = (id, returnTo = "assignments") => { setSelectedAssignmentId(id); setAssignmentDetailReturnTo(returnTo); setScreen("assignmentDetail"); };
  const backToAssignments = () => {
    setSelectedAssignmentId(null);
    if (assignmentDetailReturnTo === "studentOverview") { setScreen("studentOverview"); return; }
    setAssignmentsRefreshKey((k) => k + 1);
    setScreen("assignments");
  };
  const onAssignmentCreated = () => {
    setAssignmentCreateInitialStudentId(null);
    if (assignmentCreateReturnTo === "studentOverview") { setScreen("studentOverview"); return; }
    setAssignmentsRefreshKey((k) => k + 1);
    setScreen("assignments");
  };

  const openRecipient = (id) => { setSelectedRecipientId(id); setScreen("assignmentSubmit"); };
  const backToMyAssignments = () => { setSelectedRecipientId(null); setMyAssignmentsRefreshKey((k) => k + 1); setScreen("myAssignments"); };

  const openStudent = (id) => { setSelectedStudentId(id); setScreen("studentOverview"); };
  const backToStudents = () => { setSelectedStudentId(null); setScreen("students"); };
  const createAssignmentForStudent = (studentId) => {
    setAssignmentCreateInitialStudentId(studentId);
    setAssignmentCreateReturnTo("studentOverview");
    setScreen("assignmentCreate");
  };
  // Rapor artık sekme değil — öğretmen tarafında bir öğrencinin özetinden (id/isim birlikte), öğrenci
  // tarafında ise doğrudan kendi profilinden (id/isim gerekmez, ReportScreen kendi verisini yükler) açılır.
  const openReport = (returnTo, studentId, studentName) => {
    if (studentId) { setSelectedStudentId(studentId); setSelectedStudentName(studentName); }
    setReportReturnTo(returnTo);
    setScreen("reports");
  };
  const backFromReport = () => setScreen(reportReturnTo);
  // Sekmelerden normal şekilde Ödev Oluştur'a gidilince az önceki "tek öğrenci" ön seçimi yapışıp kalmasın diye.
  const selectTab = (id) => {
    if (id === "assignmentCreate") { setAssignmentCreateInitialStudentId(null); setAssignmentCreateReturnTo("assignments"); }
    setScreen(id);
  };

  const tabs = [...(TABS_BY_ROLE[authUser.role] || []), { id: "profile", label: "Profilim", icon: UserCircle2 }];
  // Detay ekranlarındayken de ait olduğu liste sekmesi kenar çubuğunda aktif görünsün diye.
  const activeTabId = screen === "assignmentDetail" ? (assignmentDetailReturnTo === "studentOverview" ? "students" : "assignments")
    : screen === "assignmentSubmit" ? "myAssignments"
    : screen === "studentOverview" ? "students"
    : screen === "reports" ? (reportReturnTo === "studentOverview" ? "students" : "profile")
    : screen;

  return (
    <div className="k-app-root" style={{ minHeight: "100vh", background: C.bg, display: "flex" }}>
      <Sidebar user={authUser} tabs={tabs} activeId={activeTabId} onSelect={selectTab} onLogout={logout} />
      <div className="k-content-col" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <PageHeader
          title={screenTitle(screen, authUser.role)}
          subtitle={screenSubtitle(screen, authUser)}
          right={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Yalnızca bir öğrencinin profilindeyken görünür — CoachNoteCard'a (bkz.
                  StudentOverviewScreen.jsx > #coach-note-section) kaydırıp not alanına odaklanır. */}
              {screen === "studentOverview" && (
                <button
                  onClick={() => {
                    document.getElementById("coach-note-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
                    document.getElementById("coach-note-textarea")?.focus();
                  }}
                  aria-label="Notlarım"
                  style={{
                    background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 999,
                    width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", flexShrink: 0,
                  }}
                >
                  <NotebookPen size={18} color={C.muted} />
                </button>
              )}
              {screen !== "notifications" && (
                <button
                  onClick={() => setScreen("notifications")}
                  aria-label="Bildirimler"
                  style={{
                    position: "relative", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 999,
                    width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", flexShrink: 0,
                  }}
                >
                  <Bell size={17} color={C.muted} />
                  {unreadCount > 0 && (
                    <span style={{
                      position: "absolute", top: -3, right: -3, background: C.red, color: "#fff", fontSize: 9.5, fontWeight: 800,
                      borderRadius: 999, minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
                    }}>{unreadCount}</span>
                  )}
                </button>
              )}
            </div>
          }
        />
        <div style={{ flex: 1 }}>
          {renderScreen({
            screen, authUser, logout, theme, setTheme,
            selectedAssignmentId, assignmentsRefreshKey, openAssignment, backToAssignments, onAssignmentCreated,
            selectedRecipientId, myAssignmentsRefreshKey, openRecipient, backToMyAssignments,
            selectedStudentId, openStudent, backToStudents, createAssignmentForStudent, assignmentCreateInitialStudentId,
            selectedStudentName, reportReturnTo, openReport, backFromReport,
          })}
        </div>
      </div>
      <BottomNav tabs={tabs} activeId={activeTabId} onSelect={selectTab} />
    </div>
  );
}

function screenTitle(screen, role) {
  const titles = {
    profile: "Profilim", notifications: "Bildirimler", users: "Kullanıcı Yönetimi", photos: "Kanıt Fotoğrafları",
    students: "Öğrencilerim", assignmentCreate: "Ödev Ekle / Atama Yap", assignments: "Ödevlerim",
    assignmentDetail: "Ödev Detayı", myAssignments: "Ödevlerim", assignmentSubmit: "Ödev",
    studyLog: "Serbest Çalışma", plan: "Takvim", studentOverview: "Öğrenci Özeti",
    reports: role === "STUDENT" ? "Raporlarım" : "Raporlar",
  };
  return titles[screen] || (role === "ADMIN" ? "Yönetici Paneli" : role === "TEACHER" ? "Koç Paneli" : "Öğrenci Paneli");
}

function screenSubtitle(screen, authUser) {
  if (screen === "users") return "Öğretmen ve öğrenci hesaplarını yönet";
  if (screen === "photos") return "Tüm öğrencilerin yüklediği kanıt fotoğrafları";
  if (screen === "students") return "Koçluk grubundaki öğrenciler";
  if (screen === "assignmentCreate") return "Öğrencilerine yeni bir ödev planla";
  if (screen === "assignments") return "Oluşturduğun ödevler ve gönderim durumları";
  if (screen === "plan") return "Takvimden gün seçip yıl boyunca ödev planla, zamanı gelince yayınla";
  if (screen === "myAssignments") return "Sana atanan ödevler";
  if (screen === "studyLog") return "Ödev dışı kendi çalışmalarını kaydet";
  if (screen === "studentOverview") return "Ödevleri ve serbest çalışma geçmişi";
  if (screen === "reports") return "Ders ve dönem bazlı doğru/yanlış/net dökümü";
  return null;
}

const TABS_BY_ROLE = {
  ADMIN: [
    { id: "users", label: "Kullanıcılar", icon: Users },
    { id: "photos", label: "Kanıt Fotoğrafları", icon: Images },
  ],
  TEACHER: [
    { id: "students", label: "Öğrencilerim", icon: Users },
    { id: "assignmentCreate", label: "Ödev Oluştur", icon: PlusCircle },
    { id: "assignments", label: "Ödevlerim", icon: ClipboardList },
    { id: "plan", label: "Takvim", icon: CalendarRange },
  ],
  STUDENT: [
    { id: "myAssignments", label: "Ödevlerim", icon: ClipboardList },
    { id: "studyLog", label: "Serbest Çalışma", icon: BookOpen },
  ],
};

function renderScreen({
  screen, authUser, logout, theme, setTheme,
  selectedAssignmentId, assignmentsRefreshKey, openAssignment, backToAssignments, onAssignmentCreated,
  selectedRecipientId, myAssignmentsRefreshKey, openRecipient, backToMyAssignments,
  selectedStudentId, openStudent, backToStudents, createAssignmentForStudent, assignmentCreateInitialStudentId,
  selectedStudentName, reportReturnTo, openReport, backFromReport,
}) {
  if (screen === "profile") return <ProfileScreen user={authUser} onLogout={logout} onOpenReport={() => openReport("profile")} theme={theme} onChangeTheme={setTheme} />;
  if (screen === "notifications") return <NotificationsScreen />;
  if (screen === "reports" && (authUser.role !== "TEACHER" || selectedStudentId)) {
    return (
      <ReportScreen
        user={authUser}
        studentId={selectedStudentId}
        studentName={selectedStudentName}
        onBack={backFromReport}
        backLabel={reportReturnTo === "studentOverview" ? "Öğrenci Özetine Dön" : "Profilime Dön"}
      />
    );
  }
  if (authUser.role === "ADMIN" && screen === "users") return <AdminUsersScreen />;
  if (authUser.role === "ADMIN" && screen === "photos") return <AdminPhotosScreen />;
  if (authUser.role === "TEACHER") {
    if (screen === "students") return <TeacherStudentsScreen onOpen={openStudent} />;
    if (screen === "studentOverview" && selectedStudentId) return <StudentOverviewScreen studentId={selectedStudentId} onBack={backToStudents} onOpenAssignment={openAssignment} onCreateAssignment={createAssignmentForStudent} onOpenReport={(id, name) => openReport("studentOverview", id, name)} />;
    if (screen === "assignmentCreate") return <AssignmentCreateScreen onCreated={onAssignmentCreated} initialStudentId={assignmentCreateInitialStudentId} />;
    if (screen === "assignments") return <AssignmentListScreen onOpen={openAssignment} refreshKey={assignmentsRefreshKey} />;
    if (screen === "assignmentDetail" && selectedAssignmentId) return <AssignmentDetailScreen assignmentId={selectedAssignmentId} onBack={backToAssignments} />;
    if (screen === "plan") return <PlanScreen user={authUser} />;
  }
  if (authUser.role === "STUDENT") {
    if (screen === "myAssignments") return <StudentHomeScreen user={authUser} onOpen={openRecipient} refreshKey={myAssignmentsRefreshKey} />;
    if (screen === "assignmentSubmit" && selectedRecipientId) return <AssignmentSubmitScreen recipientId={selectedRecipientId} onBack={backToMyAssignments} />;
    if (screen === "studyLog") return <StudyLogScreen user={authUser} />;
  }
  return (
    <div style={{ padding: 40, textAlign: "center", color: C.muted }}>
      Bu rol için ekranlar henüz eklenmedi.
    </div>
  );
}
