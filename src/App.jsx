import { useEffect, useState } from "react";
import { Users, PlusCircle, ClipboardList, Bell, UserCircle2, BookOpen, Images, CalendarRange, BarChart3, GraduationCap } from "lucide-react";
import { C, THEMES, DEFAULT_THEME, bodyFont, monoFont } from "./theme.js";
import { useAuthSession } from "./hooks/useAuthSession.js";
import { Sidebar, PageHeader, BottomNav, Button, closeTopModal, DialogHost, HeaderIconButton, HeaderTextButton, HEADER_SLOT_ID } from "./components/common.jsx";
import { api } from "./api.js";
import { registerPush, unregisterPush, ensurePushRegistered } from "./native/push.js";
import { setAppBadge } from "./native/badge.js";
import { onBackButton, exitApp, setStatusBarTheme } from "./native/index.js";
import LoginScreen from "./screens/LoginScreen.jsx";
import ForcePasswordScreen from "./screens/ForcePasswordScreen.jsx";
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
import BranchScreen from "./screens/teacher/BranchScreen.jsx";

const DEFAULT_SCREEN_BY_ROLE = { ADMIN: "users", TEACHER: "students", STUDENT: "myAssignments" };

// Kompozisyon kökü: router yok, `screen` string state'i hangi ekranın render edileceğini belirler
// (PP'deki HalisahaApp.jsx ile aynı desen). Düzen: sol kenar çubuğu (rol'e göre sekmeler) + sağda
// sayfa başlığı + içerik.
// localStorage tek başına güvenilir değil (bkz. api.js), ama bir tema tercihi kaybolursa yalnızca
// varsayılana (koyu) döner — auth token'ın aksine veri kaybı riski yok, bu yüzden Preferences köprüsü
// gerektirmeden doğrudan burada okunur/yazılır.
function readStoredTheme() {
  try {
    const t = localStorage.getItem("kocluk-theme");
    return THEMES[t] ? t : DEFAULT_THEME;
  } catch (_) { return DEFAULT_THEME; }
}

export default function App() {
  const [authUser, setAuthUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  // Açılışta oturum doğrulanamadıysa (ağ/sunucu hatası — token korunur, bkz. useAuthSession) giriş
  // ekranı yerine "Tekrar dene" gösterilir. sessionNotice: oturum sunucu tarafından sonlandırılınca
  // giriş ekranında nedenini göstermek için.
  const [authError, setAuthError] = useState("");
  const [authRetrying, setAuthRetrying] = useState(false);
  const [sessionNotice, setSessionNotice] = useState("");
  // "light" | "dark" — profilden değiştirilir. HalisahaApp.jsx ile AYNI desen: Object.assign(C, ...)
  // doğrudan render gövdesinde (bir effect İÇİNDE DEĞİL) çağrılır, böylece theme state'i her
  // değiştiğinde App zaten yeniden render olur ve TÜM alt bileşenler bir sonraki render'da C'nin
  // güncel değerlerini görür — ayrı bir Context/"temayı yaydır" mekanizması gerekmez.
  const [theme, setThemeState] = useState(readStoredTheme);
  Object.assign(C, THEMES[theme] || THEMES[DEFAULT_THEME]);
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
    const root = document.documentElement.style;
    root.setProperty("--focus-color", C.mutedLight);
    root.setProperty("--focus-glow", theme === "dark" ? "rgba(140,149,163,0.18)" : "rgba(94,103,117,0.16)");
    root.setProperty("--surface-hover", C.surfaceHover);
    root.setProperty("--border-strong", C.borderStrong);
    document.body.style.background = C.bg;
  }, [theme]);
  // null = henüz role uygun bir varsayılan atanmadı (mount'ta oturum geri yüklenirken YA DA
  // logout()'un bıraktığı "login" değerinden sonra) — aşağıdaki effect authUser hazır olur olmaz
  // buna role uygun bir başlangıç ekranı atar.
  const [screen, setScreen] = useState(null);
  // Ekranın kendi başlığı/bağlam satırı (ör. branş ekranında ders adı, koç panosunda öğrenci sayısı) —
  // ekran değişince sıfırlanır; ekran veriyi yükleyince setHeader ile doldurur.
  const [headerOverride, setHeaderOverride] = useState(null);
  useEffect(() => { setHeaderOverride(null); }, [screen]);
  // Ödev/atama detay ekranlarına geçerken hangi kaydın açılacağını taşır — ayrı bir route
  // parametresi olmadığı için (router yok) en basit çözüm bu paylaşılan state.
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(null);
  // Ödev Detayı'na Öğrencilerim listesinden mi yoksa Öğrenci Özeti'nden mi girildiğini tutar — "geri"
  // ait olduğu ekrana dönsün diye (aksi halde özetten açılan bir ödev her zaman listeye dönerdi).
  const [assignmentDetailReturnTo, setAssignmentDetailReturnTo] = useState("assignments");
  const [selectedRecipientId, setSelectedRecipientId] = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [selectedStudentName, setSelectedStudentName] = useState(null);
  const [coachNoteOpen, setCoachNoteOpen] = useState(false);
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

  const { login, logout: endSession, forgotPassword, retrySession } = useAuthSession({ setAuthUser, setAuthChecked, setScreen, setAuthError, setSessionNotice });

  // Çıkışta cihazın push token'ı sunucudan silinir; aksi halde telefon, çıkmış kullanıcının
  // bildirimlerini almaya devam ederdi. Ağ hatası çıkışı ENGELLEMEZ.
  const logout = () => { unregisterPush().catch(() => {}); setAppBadge(0); endSession(); };

  const retryAuth = () => {
    if (authRetrying) return;
    setAuthRetrying(true);
    retrySession().finally(() => setAuthRetrying(false));
  };
  // Bağlantı hatası ekranındayken internet geri gelince ya da uygulama arka plandan dönünce
  // kullanıcının "Tekrar dene"ye basmasını beklemeden otomatik yeniden denenir.
  useEffect(() => {
    if (!authError) return;
    window.addEventListener("online", retryAuth);
    window.addEventListener("kocluk:resume", retryAuth);
    return () => {
      window.removeEventListener("online", retryAuth);
      window.removeEventListener("kocluk:resume", retryAuth);
    };
  }, [authError, authRetrying]); // eslint-disable-line react-hooks/exhaustive-deps

  // Çıkışta (elle ya da oturum sunucu tarafından sonlandırıldığında) gezinme seçimleri sıfırlanır —
  // aynı cihazda başka bir hesapla girilince önceki kullanıcının seçili öğrencisine/ödevine düşülmesin.
  useEffect(() => {
    if (authUser) return;
    setSelectedAssignmentId(null);
    setAssignmentDetailReturnTo("assignments");
    setSelectedRecipientId(null);
    setSelectedStudentId(null);
    setSelectedStudentName(null);
    setCoachNoteOpen(false);
    setAssignmentCreateInitialStudentId(null);
    setAssignmentCreateReturnTo("assignments");
  }, [authUser]);

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
    if (!authUser || authUser.mustChangePassword) return;
    api.listNotifications().then(({ unreadCount }) => setUnreadCount(unreadCount)).catch(() => {});
  }, [authUser, screen, notificationsRefreshKey]);

  // Uygulama ikonundaki sayı okunmamış sayısını izler — bildirimler uygulamada okununca ikonda takılı
  // kalmasın; oturum kapanınca (elle ya da sunucu sonlandırınca) sıfırlanır.
  useEffect(() => {
    setAppBadge(authUser && !authUser.mustChangePassword ? unreadCount : 0);
  }, [authUser, unreadCount]);

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
    // Arka plandan dönünce / yeni push gelince açık liste de tazelenir (yalnızca rozet değil) — aksi
    // halde öğrenci ana ekranı eski ödevlerle ve bayat "X gün kaldı" rozetleriyle kalıyordu. Sayaçlar
    // yalnızca o an ekranda olan liste bileşenini yeniden yükletir.
    const refreshAll = () => {
      // Öğrenci bildirim iznini Ayarlar'dan yeni açtıysa token hemen sunucuya yazılsın.
      ensurePushRegistered().catch(() => {});
      refresh();
      setMyAssignmentsRefreshKey((k) => k + 1);
      setAssignmentsRefreshKey((k) => k + 1);
    };
    const onPushOpen = (e) => { refresh(); goToNotificationTarget(e.detail); };
    window.addEventListener("kocluk:resume", refreshAll);
    window.addEventListener("kocluk:push", refreshAll);
    window.addEventListener("kocluk:push-open", onPushOpen);
    return () => {
      window.removeEventListener("kocluk:resume", refreshAll);
      window.removeEventListener("kocluk:push", refreshAll);
      window.removeEventListener("kocluk:push-open", onPushOpen);
    };
  }, [authUser]);

  // Bir bildirimin hedef ekranına git — hem push'a dokununca (bkz. yukarıdaki effect) hem Bildirimler
  // ekranındaki bir satıra dokununca kullanılır. data: sunucudaki notifyUser'ın yazdığı { screen, ... }.
  function goToNotificationTarget(data) {
    if (data?.screen === "assignmentSubmit" && data?.recipientId) {
      setSelectedRecipientId(data.recipientId);
      setScreen("assignmentSubmit");
    } else if (data?.screen === "assignmentDetail" && data?.assignmentId) {
      setSelectedAssignmentId(data.assignmentId);
      // Önceki bir gezinmeden "studentOverview" kalmışsa geri tuşu seçili öğrencisi olmayan boş bir
      // ekrana düşüyordu — bildirimden açılan ödev her zaman ödev listesine döner.
      setAssignmentDetailReturnTo("assignments");
      setScreen("assignmentDetail");
    } else if (data?.screen === "home") {
      // Gruplanmış bildirim (ör. "Ayşe Yılmaz sana 6 ödev gönderdi") tek bir ödeve değil listeye gider.
      setScreen(DEFAULT_SCREEN_BY_ROLE[authUser?.role] || "profile");
    } else {
      setScreen("notifications");
    }
  }

  // Android donanım geri tuşu: bir detay ekranındaysak liste ekranına dön, bir sekme (kök) ekranındaysak
  // uygulamadan çık — aksi halde Capacitor varsayılanı hiçbir şey yapmaz ve tuş "ölü" görünür.
  useEffect(() => {
    if (!authUser || !screen) return;
    return onBackButton(() => {
      // Açık bir pencere (form, fotoğraf, not) varsa geri tuşu önce onu kapatır.
      if (closeTopModal()) return;
      if (screen === "assignmentCreate" && assignmentCreateReturnTo === "studentOverview" && selectedStudentId) {
        // Öğrenci özetindeki "Yeni Ödev Ata"dan açıldıysa sekme kökü sayılmaz — özete geri döner,
        // uygulamadan çıkıp yarım formu kaybettirmez.
        setAssignmentCreateInitialStudentId(null);
        setAssignmentCreateReturnTo("assignments");
        setScreen("studentOverview");
        return;
      }
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
      if (screen === "reports" && reportReturnTo !== "tab") {
        setScreen(reportReturnTo);
        return;
      }
      if (screen === "plan" && authUser.role === "TEACHER" && authUser.isSubjectTeacher) {
        setScreen("branch");
        return;
      }
      const tabIds = [...tabsFor(authUser).map((t) => t.id), "profile"];
      if (tabIds.includes(screen)) {
        exitApp();
        return;
      }
      setScreen(DEFAULT_SCREEN_BY_ROLE[authUser.role] || "profile");
    });
  }, [authUser, screen, assignmentDetailReturnTo, reportReturnTo, assignmentCreateReturnTo, selectedStudentId]);

  if (!authChecked) {
    return <div style={{ minHeight: "100vh", background: C.bg }} />;
  }

  if (!authUser && authError) {
    return (
      <div style={{
        minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 16, textAlign: "center", fontFamily: bodyFont,
        padding: "calc(env(safe-area-inset-top) + 24px) 24px calc(env(safe-area-inset-bottom) + 24px)",
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, maxWidth: 320 }}>{authError}</div>
        <div style={{ fontSize: 12.5, color: C.muted, maxWidth: 320 }}>Oturumun açık kalıyor — bağlantı gelince yeniden şifre girmene gerek yok.</div>
        <Button disabled={authRetrying} onClick={retryAuth}>{authRetrying ? "Bağlanıyor..." : "Tekrar dene"}</Button>
      </div>
    );
  }

  if (!authUser) {
    return <LoginScreen onLogin={login} onForgotPassword={forgotPassword} notice={sessionNotice} />;
  }

  // İlk şifresi tahmin edilebilir hesap (okul no / geçici şifre) önce kendi şifresini belirler —
  // sunucu da bu hesaba başka hiçbir isteği yanıtlamıyor (PASSWORD_CHANGE_REQUIRED).
  if (authUser.mustChangePassword) {
    return <ForcePasswordScreen user={authUser} onDone={setAuthUser} onLogout={logout} />;
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

  const openStudent = (id, name) => { setSelectedStudentId(id); setSelectedStudentName(name); setCoachNoteOpen(false); setScreen("studentOverview"); };
  const backToStudents = () => { setSelectedStudentId(null); setSelectedStudentName(null); setScreen("students"); };
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
    if (id === "reports") setReportReturnTo("tab");
    setScreen(id);
  };

  const tabs = [...tabsFor(authUser), { id: "profile", label: "Ben", icon: UserCircle2 }];
  // Başlıktaki geri düğmesi — detay ekranlarında (sayfa içindeki "← … dön" bağlantılarının yerine).
  const backToOverviewFromCreate = () => {
    setAssignmentCreateInitialStudentId(null);
    setAssignmentCreateReturnTo("assignments");
    setScreen("studentOverview");
  };
  const headerBack = screen === "assignmentSubmit" ? backToMyAssignments
    : screen === "assignmentDetail" ? backToAssignments
    : screen === "studentOverview" ? backToStudents
    : screen === "reports" && reportReturnTo !== "tab" ? backFromReport
    : screen === "plan" && authUser.role === "TEACHER" && authUser.isSubjectTeacher ? () => setScreen("branch")
    : screen === "assignmentCreate" && assignmentCreateReturnTo === "studentOverview" && selectedStudentId ? backToOverviewFromCreate
    : undefined;
  // Detay ekranlarındayken de ait olduğu liste sekmesi kenar çubuğunda aktif görünsün diye.
  const activeTabId = screen === "assignmentDetail" ? (assignmentDetailReturnTo === "studentOverview" ? "students" : "assignments")
    : screen === "assignmentSubmit" ? "myAssignments"
    : screen === "studentOverview" ? "students"
    : screen === "reports" ? (reportReturnTo === "studentOverview" ? "students" : reportReturnTo === "tab" ? "reports" : "profile")
    : screen === "plan" && authUser.isSubjectTeacher ? "branch"
    : screen;

  return (
    <div className="k-app-root" style={{ minHeight: "100vh", background: C.bg, display: "flex" }}>
      <Sidebar user={authUser} tabs={tabs} activeId={activeTabId} onSelect={selectTab} onLogout={logout} />
      <div className="k-content-col" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <PageHeader
          title={headerOverride?.title || screenTitle(screen, authUser.role, { selectedStudentName, reportReturnTo })}
          subtitle={headerOverride?.subtitle ?? screenSubtitle(screen, authUser)}
          onBack={headerBack}
          right={
            <>
              {/* Öğrenci özetinde başlığın sağında Rapor ve Notlar (zil yerine) — Rapor o öğrencinin
                  raporunu açar, Notlar StudentOverviewScreen.jsx'te "Özel notlarım" bölümüne kaydırır. */}
              {screen === "studentOverview" && selectedStudentId && (
                <HeaderTextButton label="Rapor" onClick={() => openReport("studentOverview", selectedStudentId, selectedStudentName)} />
              )}
              {screen === "studentOverview" && (
                <HeaderTextButton label="Notlar" onClick={() => setCoachNoteOpen(true)} />
              )}
              {/* Ekranın kendi başlık düğmeleri için yuva — ör. ReportScreen PDF düğmesini buraya
                  createPortal ile yerleştirir (düğmenin durumu/işlevi ekranın içinde kalır). */}
              <div id={HEADER_SLOT_ID} style={{ display: "contents" }} />
              {!["notifications", "studentOverview", "reports"].includes(screen) && (
                <HeaderIconButton icon={Bell} label="Bildirimler" onClick={() => setScreen("notifications")}>
                  {unreadCount > 0 && (
                    <span style={{
                      position: "absolute", top: -5, right: -5, background: C.red, color: C.onRed, fontSize: 10, fontWeight: 800, fontFamily: monoFont,
                      borderRadius: 999, minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px",
                      boxShadow: `0 0 0 2px ${C.bg}`,
                    }}>{unreadCount}</span>
                  )}
                </HeaderIconButton>
              )}
            </>
          }
        />
        {/* key={screen}: ekran değişince hafif belirme animasyonu (index.html > .k-screen). */}
        <div key={screen} className="k-screen" style={{ flex: 1 }}>
          {renderScreen({
            screen, authUser, logout, theme, setTheme,
            selectedAssignmentId, assignmentsRefreshKey, openAssignment, backToAssignments, onAssignmentCreated, assignmentDetailReturnTo,
            selectedRecipientId, myAssignmentsRefreshKey, openRecipient, backToMyAssignments,
            selectedStudentId, openStudent, backToStudents, createAssignmentForStudent, assignmentCreateInitialStudentId,
            selectedStudentName, reportReturnTo, openReport, backFromReport,
            coachNoteOpen, onCloseNote: () => setCoachNoteOpen(false),
            openNotificationTarget: goToNotificationTarget,
            setHeader: setHeaderOverride,
            openStudyLog: () => setScreen("studyLog"),
            openPlan: () => setScreen("plan"),
          })}
        </div>
      </div>
      <BottomNav tabs={tabs} activeId={activeTabId} onSelect={selectTab} />
      <DialogHost />
    </div>
  );
}

function screenTitle(screen, role, { selectedStudentName } = {}) {
  if (screen === "studentOverview" && selectedStudentName) return selectedStudentName;
  if (screen === "reports" && role === "TEACHER" && selectedStudentName) return `${selectedStudentName} — Rapor`;
  const titles = {
    profile: "Ben", notifications: "Bildirimler", users: "Kurulum", photos: "Kanıt fotoğrafları",
    students: "Öğrencilerim", assignmentCreate: "Ödev ata", assignments: "Ödevlerim", branch: "Branş",
    assignmentDetail: "Ödev detayı", myAssignments: "Bu hafta", assignmentSubmit: "Ödev",
    studyLog: "Serbest çalışma", plan: "Yıllık plan", studentOverview: "Öğrenci",
    reports: role === "STUDENT" ? "Gelişimim" : "Raporlar",
  };
  return titles[screen] || (role === "ADMIN" ? "Yönetici Paneli" : role === "TEACHER" ? "Koç Paneli" : "Öğrenci Paneli");
}

// Başlığın üstündeki bağlam satırı — kısa, tek satır (uzun açıklama cümleleri telefonda iki satıra taşıyordu).
function screenSubtitle(screen, authUser) {
  if (screen === "myAssignments") {
    return [authUser.name, authUser.className, authUser.coach?.name && `Koçun: ${authUser.coach.name}`].filter(Boolean).join(" · ");
  }
  if (screen === "users") return "Okul yönetimi · 2026–27 dönemi";
  if (screen === "students" || screen === "assignmentCreate" || screen === "assignments" || screen === "plan") return authUser.name;
  if (screen === "studyLog") return "Ödev dışı kendi çalışmaların";
  if (screen === "reports" && authUser.role === "STUDENT") return "Ders ders doğru, yanlış ve net";
  return null;
}

// Rol'e göre sekmeler. Telefonda alt menü yalnızca yazı (şartname); kenar çubuğunda ikonlar da var.
// Branş öğretmeninde "Takvim" yerine "Branş" sekmesi — yıllık planına branş ekranından girilir
// (hafta hafta plan listesi orada); koç ekranı (6 öğrenci) ile branş ekranı (74 öğrenci) ayrı sekmeler.
function tabsFor(user) {
  if (user.role === "TEACHER" && user.isSubjectTeacher) {
    return [
      { id: "students", label: "Öğrenciler", icon: Users },
      { id: "branch", label: "Branş", icon: GraduationCap },
      { id: "assignmentCreate", label: "Ata", icon: PlusCircle },
      { id: "assignments", label: "Ödevler", icon: ClipboardList },
    ];
  }
  return TABS_BY_ROLE[user.role] || [];
}

const TABS_BY_ROLE = {
  ADMIN: [
    { id: "users", label: "Kurulum", icon: Users },
    { id: "photos", label: "Fotoğraflar", icon: Images },
  ],
  TEACHER: [
    { id: "students", label: "Öğrenciler", icon: Users },
    { id: "assignmentCreate", label: "Ata", icon: PlusCircle },
    { id: "assignments", label: "Ödevler", icon: ClipboardList },
    { id: "plan", label: "Takvim", icon: CalendarRange },
  ],
  STUDENT: [
    { id: "myAssignments", label: "Bu hafta", icon: ClipboardList },
    { id: "studyLog", label: "Çalışmam", icon: BookOpen },
    { id: "reports", label: "Gelişim", icon: BarChart3 },
  ],
};

function renderScreen({
  screen, authUser, logout, theme, setTheme,
  selectedAssignmentId, assignmentsRefreshKey, openAssignment, backToAssignments, onAssignmentCreated, assignmentDetailReturnTo,
  selectedRecipientId, myAssignmentsRefreshKey, openRecipient, backToMyAssignments,
  selectedStudentId, openStudent, backToStudents, createAssignmentForStudent, assignmentCreateInitialStudentId,
  selectedStudentName, reportReturnTo, openReport, backFromReport,
  coachNoteOpen, onCloseNote, openNotificationTarget, setHeader, openStudyLog, openPlan,
}) {
  if (screen === "profile") return <ProfileScreen user={authUser} onLogout={logout} onOpenReport={() => openReport("profile")} theme={theme} onChangeTheme={setTheme} />;
  if (screen === "notifications") return <NotificationsScreen onOpenTarget={openNotificationTarget} />;
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
    if (screen === "students") return <TeacherStudentsScreen user={authUser} onOpen={openStudent} setHeader={setHeader} />;
    if (screen === "branch" && authUser.isSubjectTeacher) return <BranchScreen user={authUser} setHeader={setHeader} onOpenPlan={openPlan} />;
    if (screen === "studentOverview" && selectedStudentId) return <StudentOverviewScreen studentId={selectedStudentId} onBack={backToStudents} onOpenAssignment={openAssignment} onCreateAssignment={createAssignmentForStudent} noteOpen={coachNoteOpen} onCloseNote={onCloseNote} setHeader={setHeader} />;
    if (screen === "assignmentCreate") return <AssignmentCreateScreen onCreated={onAssignmentCreated} initialStudentId={assignmentCreateInitialStudentId} />;
    if (screen === "assignments") return <AssignmentListScreen onOpen={openAssignment} refreshKey={assignmentsRefreshKey} />;
    if (screen === "assignmentDetail" && selectedAssignmentId) return <AssignmentDetailScreen assignmentId={selectedAssignmentId} onBack={backToAssignments} backLabel={assignmentDetailReturnTo === "studentOverview" ? "Öğrenci özetine dön" : "Ödevlerime dön"} />;
    if (screen === "plan") return <PlanScreen user={authUser} />;
  }
  if (authUser.role === "STUDENT") {
    if (screen === "myAssignments") return <StudentHomeScreen user={authUser} onOpen={openRecipient} onOpenStudyLog={openStudyLog} refreshKey={myAssignmentsRefreshKey} />;
    // key: bildirimle başka bir ödeve geçilince bileşen yeniden kullanılıp önceki ödevin D/Y/B
    // değerleri ve notu formda kalıyor, yanlış ödeve gönderilebiliyordu — ödev değişince sıfırdan mount.
    if (screen === "assignmentSubmit" && selectedRecipientId) return <AssignmentSubmitScreen key={selectedRecipientId} user={authUser} recipientId={selectedRecipientId} onBack={backToMyAssignments} setHeader={setHeader} />;
    if (screen === "studyLog") return <StudyLogScreen user={authUser} />;
  }
  return (
    <div style={{ padding: 40, textAlign: "center", color: C.muted }}>
      Bu rol için ekranlar henüz eklenmedi.
    </div>
  );
}
