import { useEffect, useState } from "react";
import { Users, PlusCircle, ClipboardList, Bell, UserCircle2, BookOpen } from "lucide-react";
import { C } from "./theme.js";
import { useAuthSession } from "./hooks/useAuthSession.js";
import { Sidebar, PageHeader } from "./components/common.jsx";
import { api } from "./api.js";
import LoginScreen from "./screens/LoginScreen.jsx";
import ProfileScreen from "./screens/ProfileScreen.jsx";
import NotificationsScreen from "./screens/NotificationsScreen.jsx";
import AdminUsersScreen from "./screens/admin/AdminUsersScreen.jsx";
import TeacherStudentsScreen from "./screens/teacher/TeacherStudentsScreen.jsx";
import AssignmentCreateScreen from "./screens/teacher/AssignmentCreateScreen.jsx";
import AssignmentListScreen from "./screens/teacher/AssignmentListScreen.jsx";
import AssignmentDetailScreen from "./screens/teacher/AssignmentDetailScreen.jsx";
import StudentHomeScreen from "./screens/student/StudentHomeScreen.jsx";
import AssignmentSubmitScreen from "./screens/student/AssignmentSubmitScreen.jsx";
import StudyLogScreen from "./screens/student/StudyLogScreen.jsx";

const DEFAULT_SCREEN_BY_ROLE = { ADMIN: "users", TEACHER: "students", STUDENT: "myAssignments" };

// Kompozisyon kökü: router yok, `screen` string state'i hangi ekranın render edileceğini belirler
// (PP'deki HalisahaApp.jsx ile aynı desen). Düzen: sol kenar çubuğu (rol'e göre sekmeler) + sağda
// sayfa başlığı + içerik.
export default function App() {
  const [authUser, setAuthUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  // null = henüz role uygun bir varsayılan atanmadı (mount'ta oturum geri yüklenirken YA DA
  // logout()'un bıraktığı "login" değerinden sonra) — aşağıdaki effect authUser hazır olur olmaz
  // buna role uygun bir başlangıç ekranı atar.
  const [screen, setScreen] = useState(null);
  // Ödev/atama detay ekranlarına geçerken hangi kaydın açılacağını taşır — ayrı bir route
  // parametresi olmadığı için (router yok) en basit çözüm bu paylaşılan state.
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(null);
  const [selectedRecipientId, setSelectedRecipientId] = useState(null);
  // İlgili liste ekranları kendi useEffect'inde yükleniyor; bir kayıt oluşturulduğunda/güncellendiğinde
  // ya da detaydan dönüldüğünde listenin BAYAT veriyle kalmaması için bu sayaçlar artırılıp yeniden yükleme tetiklenir.
  const [assignmentsRefreshKey, setAssignmentsRefreshKey] = useState(0);
  const [myAssignmentsRefreshKey, setMyAssignmentsRefreshKey] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  const { login, logout, forgotPassword } = useAuthSession({ setAuthUser, setAuthChecked, setScreen });

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
  }, [authUser, screen]);

  if (!authChecked) {
    return <div style={{ minHeight: "100vh", background: C.bg }} />;
  }

  if (!authUser) {
    return <LoginScreen onLogin={login} onForgotPassword={forgotPassword} />;
  }

  if (!screen) {
    return <div style={{ minHeight: "100vh", background: C.bg }} />;
  }

  const openAssignment = (id) => { setSelectedAssignmentId(id); setScreen("assignmentDetail"); };
  const backToAssignments = () => { setSelectedAssignmentId(null); setAssignmentsRefreshKey((k) => k + 1); setScreen("assignments"); };
  const onAssignmentCreated = () => { setAssignmentsRefreshKey((k) => k + 1); setScreen("assignments"); };

  const openRecipient = (id) => { setSelectedRecipientId(id); setScreen("assignmentSubmit"); };
  const backToMyAssignments = () => { setSelectedRecipientId(null); setMyAssignmentsRefreshKey((k) => k + 1); setScreen("myAssignments"); };

  const tabs = [...(TABS_BY_ROLE[authUser.role] || []), { id: "profile", label: "Profilim", icon: UserCircle2 }]
    .map((t) => (t.id === "notifications" ? { ...t, badge: unreadCount } : t));
  // Detay ekranlarındayken de ait olduğu liste sekmesi kenar çubuğunda aktif görünsün diye.
  const activeTabId = screen === "assignmentDetail" ? "assignments" : screen === "assignmentSubmit" ? "myAssignments" : screen;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex" }}>
      <Sidebar user={authUser} tabs={tabs} activeId={activeTabId} onSelect={setScreen} onLogout={logout} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <PageHeader title={screenTitle(screen, authUser.role)} subtitle={screenSubtitle(screen, authUser)} />
        <div style={{ flex: 1 }}>
          {renderScreen({
            screen, authUser, logout,
            selectedAssignmentId, assignmentsRefreshKey, openAssignment, backToAssignments, onAssignmentCreated,
            selectedRecipientId, myAssignmentsRefreshKey, openRecipient, backToMyAssignments,
          })}
        </div>
      </div>
    </div>
  );
}

function screenTitle(screen, role) {
  const titles = {
    profile: "Profilim", notifications: "Bildirimler", users: "Kullanıcı Yönetimi",
    students: "Öğrencilerim", assignmentCreate: "Ödev Ekle / Atama Yap", assignments: "Ödevlerim",
    assignmentDetail: "Ödev Detayı", myAssignments: "Ödevlerim", assignmentSubmit: "Ödev",
    studyLog: "Serbest Çalışma",
  };
  return titles[screen] || (role === "ADMIN" ? "Yönetici Paneli" : role === "TEACHER" ? "Koç Paneli" : "Öğrenci Paneli");
}

function screenSubtitle(screen, authUser) {
  if (screen === "users") return "Öğretmen ve öğrenci hesaplarını yönet";
  if (screen === "students") return "Koçluk grubundaki öğrenciler";
  if (screen === "assignmentCreate") return "Öğrencilerine yeni bir ödev planla";
  if (screen === "assignments") return "Oluşturduğun ödevler ve gönderim durumları";
  if (screen === "myAssignments") return "Sana atanan ödevler";
  if (screen === "studyLog") return "Ödev dışı kendi çalışmalarını kaydet";
  return null;
}

const TABS_BY_ROLE = {
  ADMIN: [{ id: "users", label: "Kullanıcılar", icon: Users }],
  TEACHER: [
    { id: "students", label: "Öğrencilerim", icon: Users },
    { id: "assignmentCreate", label: "Ödev Oluştur", icon: PlusCircle },
    { id: "assignments", label: "Ödevlerim", icon: ClipboardList },
    { id: "notifications", label: "Bildirimler", icon: Bell },
  ],
  STUDENT: [
    { id: "myAssignments", label: "Ödevlerim", icon: ClipboardList },
    { id: "studyLog", label: "Serbest Çalışma", icon: BookOpen },
    { id: "notifications", label: "Bildirimler", icon: Bell },
  ],
};

function renderScreen({
  screen, authUser, logout,
  selectedAssignmentId, assignmentsRefreshKey, openAssignment, backToAssignments, onAssignmentCreated,
  selectedRecipientId, myAssignmentsRefreshKey, openRecipient, backToMyAssignments,
}) {
  if (screen === "profile") return <ProfileScreen user={authUser} onLogout={logout} />;
  if (screen === "notifications") return <NotificationsScreen />;
  if (authUser.role === "ADMIN" && screen === "users") return <AdminUsersScreen />;
  if (authUser.role === "TEACHER") {
    if (screen === "students") return <TeacherStudentsScreen />;
    if (screen === "assignmentCreate") return <AssignmentCreateScreen onCreated={onAssignmentCreated} />;
    if (screen === "assignments") return <AssignmentListScreen onOpen={openAssignment} refreshKey={assignmentsRefreshKey} />;
    if (screen === "assignmentDetail" && selectedAssignmentId) return <AssignmentDetailScreen assignmentId={selectedAssignmentId} onBack={backToAssignments} />;
  }
  if (authUser.role === "STUDENT") {
    if (screen === "myAssignments") return <StudentHomeScreen onOpen={openRecipient} refreshKey={myAssignmentsRefreshKey} />;
    if (screen === "assignmentSubmit" && selectedRecipientId) return <AssignmentSubmitScreen recipientId={selectedRecipientId} onBack={backToMyAssignments} />;
    if (screen === "studyLog") return <StudyLogScreen user={authUser} />;
  }
  return (
    <div style={{ padding: 40, textAlign: "center", color: C.muted }}>
      Bu rol için ekranlar henüz eklenmedi.
    </div>
  );
}
