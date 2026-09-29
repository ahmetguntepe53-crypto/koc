import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { UserPlus, Upload, Trash2, Search, X } from "lucide-react";
import { C, bodyFont, monoFont } from "../../theme.js";
import { lastSeenInfo } from "../../work.js";
import { Card, Button, Input, Select, Pill, Chip, Modal, EmptyState, Avatar, roleLabel, LoadingState, confirmDialog, StatCard, StatGrid, SectionHeader, AlertBox, ListRow, ListGroup } from "../../components/common.jsx";
import { api } from "../../api.js";
import { GRADE_OPTIONS, GRADE_LEVELS, BRANCHES, BOARD_BRANCHES, boardBranchOf, trackForGrade } from "../../subjects.js";
import { FIELD_OPTIONS, FIELD_SHORT, normalizeField } from "../../studentField.js";
// Tembel yükleme: okul analizi rapor modelini (reportModel.js, ~100 KB) kullanır — yalnızca sekme açılınca insin,
// herkesin açılış paketine girmesin (App.jsx > ReportScreen ile aynı gerekçe).
const AdminAnalytics = lazy(() => import("./AdminAnalytics.jsx"));
const AdminActivity = lazy(() => import("./AdminActivity.jsx"));
const AdminLeaderboard = lazy(() => import("./AdminLeaderboard.jsx"));

// Admin — Kurulum (şartname Z6). Sekmeler: Koç eşleştirme (varsayılan) · Hesaplar · Branşlar · Aktivite ·
// Sıralama · Okul analizi · Sistem. "Okul analizi": okul geneli ödevlerin toplu sonuçları (öğrenci adı
// YOK) — bkz. AdminAnalytics.jsx. "Sıralama": öğrenci ADIYLA genel başarı sıralaması, bilinçli okul
// kararıyla — bkz. AdminLeaderboard.jsx. "Aktivite": günlük/haftalık giriş sayıları — bkz. AdminActivity.jsx.
const TABS = [
  { id: "coaches", label: "Koç eşleştirme" },
  { id: "accounts", label: "Hesaplar" },
  { id: "branches", label: "Branşlar" },
  { id: "activity", label: "Aktivite" },
  { id: "leaderboard", label: "Sıralama" },
  { id: "analytics", label: "Okul analizi" },
  { id: "system", label: "Sistem" },
];
// Önerilen koç kapasitesi — zorlanmaz (okulun kararı), yalnızca yük çubuğunun rengi: dolu kırmızı, %85+ sarı.
const COACH_CAPACITY = 7;

function loadColor(n) {
  if (n >= COACH_CAPACITY) return C.red;
  if (n / COACH_CAPACITY >= 0.85) return C.amber;
  return C.mutedLight;
}

// Branş rozetleri: "BRANŞ · MATEMATİK"; yoksa "yalnızca koç".
function branchLabel(t) {
  return t.isSubjectTeacher && t.teachingSubjects?.length
    ? `BRANŞ · ${t.teachingSubjects.join(" / ").toLocaleUpperCase("tr-TR")}`
    : null;
}

export default function AdminUsersScreen() {
  const [tab, setTab] = useState("coaches");
  const [users, setUsers] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("");
  const [coachFilter, setCoachFilter] = useState(""); // "" | "none" (koçsuz) | öğretmen id
  const [q, setQ] = useState("");
  const [toast, setToast] = useState(null);
  const [addModalRole, setAddModalRole] = useState(null); // "TEACHER" | "STUDENT" | null
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [setPasswordFor, setSetPasswordFor] = useState(null); // user
  const [branchesFor, setBranchesFor] = useState(null); // öğretmen

  const load = async () => {
    setLoading(true);
    try {
      const [u, t, st] = await Promise.all([
        api.adminListUsers({ role: roleFilter, q }),
        api.adminListTeachers(),
        api.adminStats().catch(() => null),
      ]);
      setUsers(u.users);
      setTeachers(t.teachers);
      setStats(st);
    } catch (e) {
      setToast({ type: "error", text: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [roleFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const runSearch = (e) => { e.preventDefault(); load(); };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const withAction = (fn) => async (...args) => {
    try {
      await fn(...args);
      await load();
    } catch (e) {
      setToast({ type: "error", text: e.message });
    }
  };

  const reassignTeacher = withAction(async (studentId, teacherId) => {
    const student = users.find((u) => u.id === studentId);
    if (student?.teacherId && student.teacherId !== teacherId) {
      const ok = await confirmDialog({
        title: "Koç değiştirilsin mi?",
        message: `${student.name} ${teacherId ? "yeni koça geçecek" : "koçsuz kalacak"}. Eski koçunun bu öğrenci hakkında tuttuğu özel notlar silinir (notları yalnızca o koç görebiliyordu).`,
        confirmLabel: "Değiştir",
      });
      if (!ok) return;
    }
    await api.adminReassignTeacher(studentId, teacherId || null);
  });
  const changeGradeLevel = withAction((studentId, gradeLevel) => api.adminUpdateUser(studentId, { gradeLevel }));
  // YKS alanı — "Bilinmiyor" seçilirse silinir (null); rapor o zaman AYT derslerini kayıtlardan tahmin eder.
  const changeField = withAction((studentId, field) => api.adminUpdateUser(studentId, { field: field || null }));
  const resendActivation = withAction(async (id) => { await api.adminResendActivation(id); setToast({ type: "ok", text: "Aktivasyon bağlantısı tekrar gönderildi." }); });
  const toggleBan = withAction(async (u) => {
    if (!u.banned && !(await confirmDialog({ title: `${u.name} askıya alınsın mı?`, message: "Hesap giriş yapamaz, açık oturumları kapanır. Sonradan askıyı kaldırabilirsin.", confirmLabel: "Askıya al", danger: true }))) return;
    u.banned ? await api.adminUnbanUser(u.id) : await api.adminBanUser(u.id);
  });
  const remove = withAction(async (u) => {
    if (!(await confirmDialog({ title: `${u.name} silinsin mi?`, message: "Hesap kalıcı olarak silinecek. Bu işlem geri alınamaz.", confirmLabel: "Hesabı Sil", danger: true }))) return;
    await api.adminDeleteUser(u.id);
  });

  // Koç yükünden ya da "koçu yok" uyarısından Hesaplar'a: o koçun (ya da koçsuz) öğrencileri.
  const showStudentsOf = (coachId) => {
    setTab("accounts");
    setRoleFilter("STUDENT");
    setCoachFilter(coachId);
  };

  const coveredBranches = BOARD_BRANCHES.filter((b) => teachers.some((t) => t.isSubjectTeacher && (t.teachingSubjects || []).some((sub) => boardBranchOf(sub) === b.key))).length;
  const studentCount = stats?.studentCount ?? users.filter((u) => u.role === "STUDENT").length;
  const withoutCoach = stats?.studentsWithoutTeacher ?? 0;
  const visibleUsers = users.filter((u) => {
    if (!coachFilter) return true;
    if (coachFilter === "none") return u.role === "STUDENT" && !u.teacherId;
    return u.teacherId === coachFilter;
  });
  const coachFilterName = coachFilter === "none" ? "Koçu olmayanlar" : teachers.find((t) => t.id === coachFilter)?.name;

  return (
    <div className="k-page" style={{ padding: 28, maxWidth: 1040, margin: "0 auto" }}>
      <div className="k-chip-row" role="group" aria-label="Kurulum bölümleri" style={{ marginBottom: 16 }}>
        {TABS.map((t) => (
          <Chip key={t.id} active={tab === t.id} onClick={() => { setTab(t.id); if (t.id !== "accounts") setCoachFilter(""); }}>{t.label}</Chip>
        ))}
      </div>

      {toast && (
        <div role={toast.type === "error" ? "alert" : "status"} style={{ marginBottom: 16, padding: "11px 15px", borderRadius: 12, background: toast.type === "error" ? C.redSoft : C.greenSoft, color: toast.type === "error" ? C.red : C.green, fontSize: 13, fontWeight: 600, fontFamily: bodyFont }}>
          {toast.text}
        </div>
      )}

      {tab === "coaches" && (
        loading && !teachers.length ? <LoadingState /> : (
          <>
            <StatGrid min={96}>
              <StatCard label="öğrenci" value={studentCount} />
              <StatCard label="öğretmen" value={stats?.teacherCount ?? teachers.length} />
              <StatCard label="branş atandı" value={`${coveredBranches}/${BOARD_BRANCHES.length}`} tone={coveredBranches === BOARD_BRANCHES.length ? "green" : "amber"} />
            </StatGrid>
            {withoutCoach > 0 && (
              <AlertBox style={{ marginTop: 12 }}>
                <span style={{ fontFamily: monoFont }}>{withoutCoach}</span> öğrencinin koçu yok · eşleştirilmeden ödev takibi yapılamaz.{" "}
                <button type="button" onClick={() => showStudentsOf("none")} style={{ background: "none", border: "none", padding: 0, color: "inherit", fontWeight: 700, textDecoration: "underline", cursor: "pointer", fontFamily: bodyFont, fontSize: 13.5 }}>Göster</button>
              </AlertBox>
            )}
            <SectionHeader title="Koç yükü" right={`${studentCount - withoutCoach}/${studentCount} eşleşti`} />
            <div style={{ padding: "12px 16px", borderRadius: 14, background: C.surface, border: `1px solid ${C.border}`, fontFamily: bodyFont, fontSize: 13, color: C.mutedLight, lineHeight: 1.5, marginBottom: 10 }}>
              Bir koça en fazla {COACH_CAPACITY} öğrenci önerilir. Dolu koçlar kırmızı, %85 ve üstü sarı. Koça dokununca öğrencileri açılır.
            </div>
            <ListGroup>
              {teachers.map((t) => (
                <ListRow
                  key={t.id}
                  left={<Avatar name={t.name} size={40} />}
                  title={t.name}
                  subtitle={branchLabel(t) ? <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.8, color: C.text2 }}>{branchLabel(t)}</span> : "yalnızca koç"}
                  right={
                    <span style={{ textAlign: "right", flexShrink: 0 }}>
                      <span style={{ display: "block", fontFamily: monoFont, fontSize: 15, fontWeight: 700, color: t.studentCount >= COACH_CAPACITY * 0.85 ? loadColor(t.studentCount) : C.text }}>{t.studentCount}/{COACH_CAPACITY}</span>
                      <span style={{ display: "block", width: 58, height: 4, borderRadius: 2, background: C.surface2, marginTop: 6, overflow: "hidden" }}>
                        <span style={{ display: "block", height: "100%", width: `${Math.min(100, (t.studentCount / COACH_CAPACITY) * 100)}%`, background: loadColor(t.studentCount), borderRadius: 2 }} />
                      </span>
                    </span>
                  }
                  onClick={() => showStudentsOf(t.id)}
                />
              ))}
            </ListGroup>
          </>
        )
      )}

      {tab === "accounts" && (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            <Button small icon={UserPlus} onClick={() => setAddModalRole("TEACHER")}>Öğretmen ekle</Button>
            <Button small icon={UserPlus} variant="secondary" onClick={() => setAddModalRole("STUDENT")}>Öğrenci ekle</Button>
            <Button small icon={Upload} variant="secondary" onClick={() => setBulkModalOpen(true)}>Toplu içe aktar</Button>
          </div>
          <form onSubmit={runSearch} style={{ display: "flex", gap: 10, marginBottom: 4, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 140px", maxWidth: 200 }}>
              <Select aria-label="Role göre filtrele" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="">Tüm roller</option>
                <option value="ADMIN">Yönetici</option>
                <option value="TEACHER">Öğretmen</option>
                <option value="STUDENT">Öğrenci</option>
              </Select>
            </div>
            <div style={{ flex: "3 1 180px", minWidth: 0 }}>
              <Input type="search" enterKeyHint="search" aria-label="İsim, okul no veya e-posta ara" placeholder="İsim, okul no veya e-posta ara..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div style={{ flex: "0 0 auto" }}><Button variant="secondary" type="submit" icon={Search}>Ara</Button></div>
          </form>
          {coachFilter && (
            <div style={{ marginBottom: 12 }}>
              <button type="button" onClick={() => setCoachFilter("")} className="k-btn" style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 36, padding: "0 12px", borderRadius: 10, background: C.surface2, border: `1px solid ${C.borderStrong}`, color: C.text, fontFamily: bodyFont, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {coachFilter === "none" ? coachFilterName : `Koçu: ${coachFilterName || "—"}`} <X size={14} />
              </button>
            </div>
          )}
          {loading ? (
            <LoadingState />
          ) : visibleUsers.length === 0 ? (
            <EmptyState text={coachFilter ? "Bu süzgece uyan öğrenci yok." : "Kayıtlı kullanıcı yok."} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {visibleUsers.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  teachers={teachers}
                  onReassignTeacher={(teacherId) => reassignTeacher(u.id, teacherId)}
                  onChangeGradeLevel={(gradeLevel) => changeGradeLevel(u.id, gradeLevel)}
                  onChangeField={(field) => changeField(u.id, field)}
                  onResendActivation={() => resendActivation(u.id)}
                  onToggleBan={() => toggleBan(u)}
                  onEditBranches={() => setBranchesFor(u)}
                  onSetPassword={() => setSetPasswordFor(u)}
                  onDelete={() => remove(u)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === "branches" && (
        <>
          <StatGrid min={96}>
            <StatCard label="branş atandı" value={`${coveredBranches}/${BOARD_BRANCHES.length}`} tone={coveredBranches === BOARD_BRANCHES.length ? "green" : "amber"} />
            <StatCard label="branş öğretmeni" value={teachers.filter((t) => t.isSubjectTeacher).length} />
          </StatGrid>
          <SectionHeader title="Öğretmenler" right="dokun, dersini seç" />
          <ListGroup>
            {teachers.map((t) => (
              <ListRow
                key={t.id}
                left={<Avatar name={t.name} size={40} />}
                title={t.name}
                subtitle={t.isSubjectTeacher && t.teachingSubjects?.length ? t.teachingSubjects.join(", ") : "branş yok · yalnızca koç"}
                onClick={() => setBranchesFor(t)}
              />
            ))}
          </ListGroup>
          <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.mutedLight, lineHeight: 1.5, marginTop: 12 }}>
            Branş öğretmeni kendi dersinin yıllık planını yayınlar; ödev okuldaki tüm 11–12. sınıflara gider. Koç ekranı ile branş ekranı ayrı sekmelerdir.
          </div>
        </>
      )}

      {tab === "activity" && <Suspense fallback={<LoadingState />}><AdminActivity /></Suspense>}

      {tab === "leaderboard" && <Suspense fallback={<LoadingState />}><AdminLeaderboard /></Suspense>}

      {tab === "analytics" && <Suspense fallback={<LoadingState />}><AdminAnalytics /></Suspense>}

      {tab === "system" && (
        <>
          <SectionHeader title="Dönem ayarları" style={{ marginTop: 4 }} />
          <ExamDatesCard />
          <AiSettingsCard />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              ["Bildirim sessiz saatleri", "23:00 – 07:00", "Bu aralıkta hiçbir bildirim telefona gitmez; gece yayınlanan ödevin bildirimi sabah 07:00'de tek özet olarak gider."],
              ["Son gün hatırlatması", "Bitiş günü 18:00", "Ödevini bitirmemiş öğrenciye bir kez, tek bildirimde."],
              ["Geciken ödev hatırlatması", "Ödev başına 1 kez", "Süre dolunca öğrenciye bir kez; koça ödev başına bir özet. Pas geçilen ödeve hatırlatma gitmez."],
            ].map(([label, value, detail]) => (
              <Card key={label} style={{ padding: "14px 18px" }}>
                <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.mutedLight }}>{label}</div>
                <div style={{ fontFamily: bodyFont, fontSize: 16, fontWeight: 700, color: C.text, marginTop: 3 }}>{value}</div>
                <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.mutedLight, marginTop: 6, lineHeight: 1.45 }}>{detail}</div>
              </Card>
            ))}
          </div>
          <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.mutedLight, lineHeight: 1.5, marginTop: 12 }}>
            Sessiz saatler ve hatırlatma sayıları sistem kuralıdır — ekrandan değiştirilmez, öğrencileri korumak için sabittir.
          </div>
        </>
      )}

      {addModalRole && (
        <AddUserModal
          role={addModalRole}
          teachers={teachers}
          onClose={() => setAddModalRole(null)}
          onCreated={() => { setAddModalRole(null); load(); }}
        />
      )}
      {bulkModalOpen && (
        <BulkImportModal
          teachers={teachers}
          onClose={() => setBulkModalOpen(false)}
          onDone={() => { setBulkModalOpen(false); load(); }}
        />
      )}
      {branchesFor && (
        <BranchesModal
          user={branchesFor}
          onClose={() => setBranchesFor(null)}
          onDone={() => { setBranchesFor(null); setToast({ type: "ok", text: "Branş kaydedildi." }); load(); }}
        />
      )}
      {setPasswordFor && (
        <SetPasswordModal
          user={setPasswordFor}
          onClose={() => setSetPasswordFor(null)}
          onDone={() => { setSetPasswordFor(null); setToast({ type: "ok", text: "Şifre belirlendi." }); load(); }}
        />
      )}
    </div>
  );
}

// Öğrenci ana ekranındaki "sınava kaç gün kaldı" sayacının kaynağı — resmi ÖSYM/MEB takvimi
// açıklanınca (ya da değişince) admin burada güncelleyebilsin diye koda gömülü değil.
function ExamDatesCard() {
  const [yksExamDate, setYksExamDate] = useState("");
  const [loading, setLoading] = useState(true);
  // Mevcut tarihler yüklenemediyse alanlar boş görünür — o haldeyken "Kaydet" dokunulmayan tarihi de
  // null gönderip siliyordu. Yükleme başarısızsa kaydetme kapatılır, hata ve "tekrar dene" gösterilir.
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const loadSettings = () => {
    setLoading(true);
    setLoadError("");
    api.adminGetSettings()
      .then(({ yksExamDate }) => {
        setYksExamDate(yksExamDate ? yksExamDate.slice(0, 10) : "");
      })
      .catch((e) => setLoadError(e.message || "Sınav tarihleri yüklenemedi"))
      .finally(() => setLoading(false));
  };
  useEffect(loadSettings, []);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await api.adminUpdateSettings({ yksExamDate: yksExamDate || null });
      setMsg({ type: "ok", text: "Kaydedildi." });
    } catch (e) {
      setMsg({ type: "error", text: e.message || "Kaydedilemedi" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  if (loadError) {
    return (
      <Card style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ fontFamily: bodyFont, fontSize: 13.5, fontWeight: 800, color: C.text, marginBottom: 6 }}>Sınav Tarihleri</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: C.red, fontWeight: 600 }}>{loadError}</span>
          <Button small variant="secondary" onClick={loadSettings}>Tekrar dene</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ padding: 18, marginBottom: 16 }}>
      <div style={{ fontFamily: bodyFont, fontSize: 13.5, fontWeight: 800, color: C.text, marginBottom: 3 }}>YKS Tarihi</div>
      <div style={{ fontFamily: bodyFont, fontSize: 12, color: C.muted, marginBottom: 14 }}>
        Öğrenci ana ekranındaki "YKS'ye kalan" sayacı için — TYT oturumunun günü (sayaç 10.15'e göre sayar). ÖSYM takvimi açıklanınca buradan güncelleyin.
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ minWidth: 180 }}>
          <Input label="YKS (TYT) Tarihi" type="date" value={yksExamDate} onChange={(e) => setYksExamDate(e.target.value)} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <Button small disabled={saving} onClick={save}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
        </div>
      </div>
      {msg && <div style={{ fontSize: 12.5, fontWeight: 600, color: msg.type === "error" ? C.red : C.green }}>{msg.text}</div>}
    </Card>
  );
}

// Yapay zekâ incelemesi (aylık raporda koça öneriler) — varsayılan KAPALI. Açılınca koçun isteğiyle kimliği
// çıkarılmış aylık sonuç özetleri (ders/konu adları ve sayılar; ad, numara, sınıf şubesi YOK) yurt dışındaki bir
// hizmete (Anthropic) gider — okulun KVKK açısından onayı gerekir, bu yüzden açarken ayrıca onay istenir.
function AiSettingsCard() {
  const [state, setState] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    api.adminGetSettings().then((s) => setState({ enabled: !!s.aiEnabled, configured: !!s.aiConfigured })).catch(() => setState(null));
  }, []);
  if (!state) return null;
  const toggle = async () => {
    const next = !state.enabled;
    if (next) {
      const ok = await confirmDialog({
        title: "Yapay zekâ incelemesi açılsın mı?",
        message: "Koçlar bir öğrencinin aylık raporu için inceleme istediğinde, öğrencinin kimliği çıkarılmış aylık sonuç özeti (ders ve konu adları, doğru/yanlış/boş sayıları, ödev düzeni) yurt dışındaki yapay zekâ hizmetine (Anthropic, ABD) gönderilir. Ad, okul numarası, sınıf şubesi ve koç adı gönderilmez.\n\nBu, kişisel verilerin yurt dışına aktarımı sayılabilir: açmadan önce okulun KVKK açısından onayını ve aydınlatma metninin güncellendiğini doğrulayın.",
        confirmLabel: "Onaylıyorum, aç",
      });
      if (!ok) return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const s = await api.adminUpdateSettings({ aiEnabled: next });
      setState({ enabled: !!s.aiEnabled, configured: !!s.aiConfigured });
      setMsg({ type: "ok", text: next ? "Açıldı." : "Kapatıldı." });
    } catch (e) {
      setMsg({ type: "error", text: e.message || "Kaydedilemedi" });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card style={{ padding: 18, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
        <div style={{ fontFamily: bodyFont, fontSize: 13.5, fontWeight: 800, color: C.text, flex: 1 }}>Yapay zekâ incelemesi</div>
        <Pill tone={state.enabled ? "green" : "muted"}>{state.enabled ? "Açık" : "Kapalı"}</Pill>
      </div>
      <div style={{ fontFamily: bodyFont, fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>
        Aylık raporda koça öğrenci için güçlü yönler, gelişim alanları ve somut adımlar önerir. Kimliği çıkarılmış aylık özet yurt dışındaki hizmete gider; okul onayı olmadan açmayın.
        {!state.configured && " Sunucuda yapay zekâ anahtarı tanımlı değil — açılsa da çalışmaz."}
      </div>
      <Button small variant={state.enabled ? "secondary" : "primary"} disabled={saving} onClick={toggle}>{saving ? "Kaydediliyor..." : state.enabled ? "Kapat" : "Aç"}</Button>
      {msg && <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 8, color: msg.type === "error" ? C.red : C.green }}>{msg.text}</div>}
    </Card>
  );
}

// Kart düzeni: üstte kimlik (avatar, ad, rozetler, kullanıcı adı), öğrencide altında etiketli üç seçim
// (sınıf düzeyi, YKS alanı, koç), en altta etiketli işlem düğmeleri — yıkıcı işlem (askıya al) ayrı renkte.
function UserRow({ user, teachers, onReassignTeacher, onChangeGradeLevel, onChangeField, onResendActivation, onToggleBan, onEditBranches, onSetPassword, onDelete }) {
  const isStudent = user.role === "STUDENT";
  const teacherName = isStudent && user.teacher?.name;
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <Avatar name={user.name} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontFamily: bodyFont, fontSize: 15, fontWeight: 700, color: C.text, marginRight: 2 }}>{user.name}</span>
            <Pill>{roleLabel(user.role)}</Pill>
            {isStudent && user.className && <Pill>{user.className}</Pill>}
            {user.banned && <Pill tone="red">Askıda</Pill>}
            {!user.hasPassword && <Pill tone="amber">Aktivasyon bekleniyor</Pill>}
            {isStudent && !GRADE_LEVELS.includes(user.gradeLevel) && <Pill tone="red">{user.gradeLevel ? "Sınıf düzeyi güncellenmeli" : "Sınıf düzeyi girilmedi"}</Pill>}
            {user.role === "TEACHER" && user.isSubjectTeacher && (
              <Pill>{user.teachingSubjects?.length ? `Branş: ${user.teachingSubjects.join(", ")}` : "Ders öğretmeni"}</Pill>
            )}
          </div>
          <div style={{ fontFamily: monoFont, fontSize: 12, color: C.mutedLight, marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {[user.username && (isStudent ? `no ${user.username}` : user.username), user.email, teacherName].filter(Boolean).join(" · ")}
          </div>
          <div style={{ fontFamily: bodyFont, fontSize: 12, color: user.role !== "ADMIN" && lastSeenInfo(user.lastSeenAt, user.createdAt).inactive ? C.amber : C.mutedLight, marginTop: 3 }}>
            {lastSeenInfo(user.lastSeenAt, user.createdAt).never ? lastSeenInfo(user.lastSeenAt, user.createdAt).label : `son giriş: ${lastSeenInfo(user.lastSeenAt, user.createdAt).label}`}
          </div>
        </div>
      </div>
      {isStudent && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", columnGap: 10, marginTop: 14 }}>
          <Select label="Sınıf düzeyi" value={user.gradeLevel || ""} onChange={(e) => onChangeGradeLevel(e.target.value)}>
            <option value="" disabled>Seç...</option>
            {/* Artık seçilemeyen eski bir düzey (ör. 9, 10, 8) kayıtlıysa görünür kalsın — admin 11/12'ye çeksin. */}
            {user.gradeLevel && !GRADE_LEVELS.includes(user.gradeLevel) && <option value={user.gradeLevel} disabled>{user.gradeLevel}. Sınıf (güncellenmeli)</option>}
            {GRADE_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </Select>
          <Select label="Alan" value={user.field || ""} onChange={(e) => onChangeField(e.target.value)}>
            <option value="">Bilinmiyor</option>
            {FIELD_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </Select>
          <Select label="Koçunu değiştir" value={user.teacherId || ""} onChange={(e) => onReassignTeacher(e.target.value)}>
            <option value="">Koç atanmadı</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.studentCount}/{COACH_CAPACITY})</option>)}
          </Select>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: isStudent ? -2 : 14, paddingTop: 12, borderTop: `1px solid ${C.divider}` }}>
        {!user.hasPassword && user.email && <Button small variant="secondary" onClick={onResendActivation}>Aktivasyonu yeniden gönder</Button>}
        <Button small variant="secondary" onClick={onSetPassword}>Şifre sıfırla</Button>
        {user.role === "TEACHER" && <Button small variant="secondary" onClick={onEditBranches}>Branş</Button>}
        <Button small variant={user.banned ? "secondary" : "danger"} onClick={onToggleBan}>{user.banned ? "Askıyı kaldır" : "Askıya al"}</Button>
        <span style={{ flex: 1 }} />
        <IconButton title="Hesabı sil" icon={Trash2} onClick={onDelete} danger />
      </div>
    </Card>
  );
}

function IconButton({ icon: Icon, onClick, title, danger, active }) {
  return (
    <button
      title={title}
      aria-label={title}
      aria-pressed={active === undefined ? undefined : !!active}
      onClick={onClick}
      className="k-icon-btn"
      style={{
        width: 40, height: 40, borderRadius: C.radiusSm, border: `1px solid ${danger ? `${C.red}55` : C.border}`,
        background: danger ? C.redSoft : C.surface2, color: danger ? C.red : active ? C.text : C.muted, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <Icon size={15} />
    </button>
  );
}

function AddUserModal({ role, teachers, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [className, setClassName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [field, setField] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (role === "STUDENT" && !gradeLevel) { setError("Sınıf düzeyi seçmelisin (11 veya 12. sınıf)"); return; }
    if (!email.trim() && !username.trim()) { setError(role === "STUDENT" ? "Okul numarası ya da e-posta gir" : "Kullanıcı adı ya da e-posta gir"); return; }
    setSaving(true);
    try {
      await api.adminCreateUser({ role, name, email: email.trim() || undefined, username: username.trim() || undefined, phone: phone || undefined, className: className || undefined, gradeLevel: gradeLevel || undefined, field: field || undefined, teacherId: teacherId || undefined });
      onCreated();
    } catch (err) {
      setError(err.message || "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={role === "TEACHER" ? "Öğretmen Ekle" : "Öğrenci Ekle"} onClose={onClose}>
      <form onSubmit={submit}>
        <Input label="Ad Soyad" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input
          label={role === "STUDENT" ? "Okul numarası (kullanıcı adı)" : "Kullanıcı adı (ör. ali.cihangir)"}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          inputMode={role === "STUDENT" ? "numeric" : undefined}
          autoCapitalize="none"
          placeholder={role === "STUDENT" ? "ör. 621" : "ör. ali.cihangir"}
        />
        <Input label="E-posta (opsiyonel)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Telefon (opsiyonel)" value={phone} onChange={(e) => setPhone(e.target.value)} />
        {role === "STUDENT" && (
          <>
            <Select label="Sınıf Düzeyi" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} required>
              <option value="" disabled>Seçiniz...</option>
              {GRADE_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </Select>
            <Select label="Alan (opsiyonel)" value={field} onChange={(e) => setField(e.target.value)}>
              <option value="">Bilinmiyor (sonra girilebilir)</option>
              {FIELD_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </Select>
            <Input label="Sınıf (opsiyonel, ör. 12/A)" value={className} onChange={(e) => setClassName(e.target.value)} />
            <Select label="Koç" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              <option value="">Koç atanmadı (sonra atanabilir)</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.studentCount})</option>)}
            </Select>
          </>
        )}
        {error && <div style={{ color: C.red, fontSize: 12.5, marginBottom: 12 }}>{error}</div>}
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
          {email.trim()
            ? "Kullanıcıya şifresini belirlemesi için bir e-posta gönderilecek."
            : `E-posta girilmezse ilk şifre ${role === "STUDENT" ? "okul numarasıyla" : "kullanıcı adıyla"} aynı olur; kullanıcı girdikten sonra Profilim'den değiştirebilir.`}
        </div>
        <Button full type="submit" disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
      </form>
    </Modal>
  );
}

function SetPasswordModal({ user, onClose, onDone }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.adminSetPassword(user.id, password);
      onDone();
    } catch (err) {
      setError(err.message || "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`${user.name} — Şifre Belirle`} onClose={onClose}>
      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 12 }}>
        Bu kullanıcı için şifreyi doğrudan sen belirliyorsun — bunu güvenli bir şekilde kendisine ilet. Normal akış e-posta ile kendi şifresini belirlemesidir.
      </div>
      <form onSubmit={submit}>
        <Input label="Yeni şifre (en az 8 karakter)" type="text" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <div style={{ color: C.red, fontSize: 12.5, marginBottom: 12 }}>{error}</div>}
        <Button full type="submit" disabled={saving}>{saving ? "Kaydediliyor..." : "Şifreyi Belirle"}</Button>
      </form>
    </Modal>
  );
}

// Öğretmenin okuttuğu dersler — en az bir ders seçilince "ders öğretmeni" yetkisi açılır (Takvim'den
// okuldaki tüm öğrencilere ortak ödev), hiç seçilmezse kalkar.
function BranchesModal({ user, onClose, onDone }) {
  const [selected, setSelected] = useState(user.teachingSubjects || []);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const toggle = (b) => setSelected((cur) => (cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b]));

  const save = async () => {
    setError("");
    setSaving(true);
    try {
      await api.adminSetTeacherSubjects(user.id, selected);
      onDone();
    } catch (err) {
      setError(err.message || "Kaydedilemedi");
      setSaving(false);
    }
  };

  return (
    <Modal title={`${user.name} — Branş`} onClose={onClose}>
      <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.muted, lineHeight: 1.45, marginBottom: 14 }}>
        Okuttuğu dersleri seç. Branş öğretmeni Takvim'den okuldaki tüm 11-12. sınıflara ortak ödev gönderebilir; hiç ders seçilmezse bu yetki kalkar.
      </div>
      <div role="group" aria-label="Dersler" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
        {BRANCHES.map((b) => <Chip key={b} active={selected.includes(b)} onClick={() => toggle(b)}>{b}</Chip>)}
      </div>
      {user.isSubjectTeacher && selected.length === 0 && (
        <div style={{ fontFamily: bodyFont, fontSize: 12, color: C.amber, fontWeight: 600, marginBottom: 12 }}>Kaydedince ders öğretmeni yetkisi kalkacak.</div>
      )}
      {error && <div role="alert" style={{ color: C.red, fontSize: 12.5, marginBottom: 12 }}>{error}</div>}
      <Button full disabled={saving} onClick={save}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
    </Modal>
  );
}

function parseBulkText(text, role) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const sep = line.includes("\t") ? "\t" : ",";
      const parts = line.split(sep).map((p) => p.trim());
      // 2. sütun e-posta ya da kullanıcı adı (öğrencide okul numarası) olabilir — "@" içeriyorsa e-posta.
      const identity = (v) => (v && v.includes("@") ? { email: v } : { username: v || undefined });
      if (role === "STUDENT") {
        // 6. sütun (opsiyonel) YKS alanı: "SAY", "EA", "SÖZ", "DİL" ya da tam adı — önizlemede doğrulanır.
        const [name, id, gradeLevel, className, teacherEmail, fieldRaw] = parts;
        return { name, ...identity(id), gradeLevel: gradeLevel || undefined, className: className || undefined, teacherEmail: teacherEmail || undefined, fieldRaw: fieldRaw || undefined };
      }
      const [name, id] = parts;
      return { name, ...identity(id) };
    });
}

function BulkImportModal({ teachers, onClose, onDone }) {
  const [role, setRole] = useState("STUDENT");
  const [text, setText] = useState("");
  const [results, setResults] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [teachersByEmail, setTeachersByEmail] = useState(null);

  useEffect(() => {
    if (role !== "STUDENT") return;
    api.adminListUsers({ role: "TEACHER" }).then(({ users }) => {
      setTeachersByEmail(Object.fromEntries(users.flatMap((t) => [t.email, t.username].filter(Boolean).map((id) => [id.toLowerCase(), t]))));
    });
  }, [role]);

  const rows = useMemo(() => parseBulkText(text, role), [text, role]);
  const resolvedRows = useMemo(() => rows.map((r) => {
    // Yalnızca 11/12 kabul ediliyor (sunucu da bunu doğrular) — diğer değerler önizlemede geçersiz görünür.
    const gradeTrack = role === "STUDENT" && GRADE_LEVELS.includes(Number(r.gradeLevel)) ? trackForGrade(Number(r.gradeLevel)) : null;
    // Tanınmayan alan yazısı olduğu gibi gönderilir: sunucu o satırı açık bir hatayla reddeder, diğerleri eklenir.
    const field = role === "STUDENT" ? normalizeField(r.fieldRaw) : null;
    const base = { ...r, gradeTrack, field: field === undefined ? r.fieldRaw : field || undefined, fieldInvalid: field === undefined };
    if (role !== "STUDENT" || !r.teacherEmail) return { ...base, teacherId: undefined, teacherMatch: null };
    const match = teachersByEmail && teachersByEmail[r.teacherEmail.toLowerCase()];
    return { ...base, teacherId: match?.id, teacherMatch: match ? match.name : "eşleşme yok" };
  }), [rows, role, teachersByEmail]);

  const runImport = async () => {
    setImporting(true);
    setImportError("");
    try {
      const payloadRows = resolvedRows.map(({ teacherMatch, teacherEmail, gradeTrack, fieldRaw, fieldInvalid, ...rest }) => rest);
      const res = await api.adminBulkImport(role, payloadRows);
      setResults(res.results);
    } catch (e) {
      setImportError(e.message || "İçe aktarma başarısız — hiçbir satır eklenmedi");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal title="Toplu Kullanıcı İçe Aktarma" onClose={onClose}>
      {!results ? (
        <>
          <Select label="Rol" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="STUDENT">Öğrenci</option>
            <option value="TEACHER">Öğretmen</option>
          </Select>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
            Her satıra bir kullanıcı — Excel/Sheets'ten kopyalayıp yapıştırabilirsin. Sütunlar: {role === "STUDENT" ? "Ad Soyad, Okul No veya E-posta, Sınıf Düzeyi (11 veya 12, zorunlu), Sınıf (opsiyonel), Koçun E-postası / Kullanıcı Adı (opsiyonel), Alan (opsiyonel: SAY, EA, SÖZ ya da DİL)" : "Ad Soyad, E-posta"}.
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={role === "STUDENT" ? "Ayşe Yılmaz\tayse@ornek.com\t12\t12/A\tkoc@ornek.com\tSAY" : "Mehmet Kaya\tmehmet@ornek.com"}
            style={{ width: "100%", boxSizing: "border-box", fontFamily: "monospace", fontSize: 12.5, padding: 10, borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface2, marginBottom: 12 }}
          />
          {rows.length > 0 && (
            <div style={{ maxHeight: 180, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 14 }}>
              {resolvedRows.map((r, i) => (
                <div key={i} style={{ padding: "6px 10px", fontSize: 12, borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span>{r.name} · {r.email || r.username}{r.className ? ` · ${r.className}` : ""}</span>
                  <span style={{ display: "flex", gap: 8 }}>
                    {role === "STUDENT" && (
                      <span style={{ color: r.gradeTrack ? C.muted : C.red }}>{r.gradeTrack ? `${r.gradeLevel}. sınıf` : "sınıf düzeyi geçersiz (11 veya 12 olmalı)"}</span>
                    )}
                    {role === "STUDENT" && r.fieldRaw && (
                      <span style={{ color: r.fieldInvalid ? C.red : C.muted }}>{r.fieldInvalid ? "alan geçersiz (SAY, EA, SÖZ, DİL)" : FIELD_SHORT[r.field]}</span>
                    )}
                    {role === "STUDENT" && r.teacherEmail && (
                      <span style={{ color: r.teacherMatch === "eşleşme yok" ? C.red : C.muted }}>{r.teacherMatch}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
          {importError && <div style={{ color: C.red, fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>{importError}</div>}
          <Button full disabled={rows.length === 0 || importing} onClick={runImport}>
            {importing ? "İçe aktarılıyor..." : `${rows.length} kayıt içe aktar`}
          </Button>
        </>
      ) : (
        <>
          <div style={{ maxHeight: 260, overflowY: "auto", marginBottom: 14 }}>
            {results.map((r, i) => (
              <div key={i} style={{ padding: "6px 0", fontSize: 12.5, color: r.ok ? C.green : C.red, borderBottom: `1px solid ${C.border}` }}>
                {r.ok ? "✓" : "✗"} {r.email} {r.ok ? "" : `— ${r.error}`}
              </div>
            ))}
          </div>
          <Button full onClick={onDone}>Kapat</Button>
        </>
      )}
    </Modal>
  );
}
