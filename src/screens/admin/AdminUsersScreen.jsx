import { useEffect, useMemo, useState } from "react";
import { UserPlus, Upload, RotateCcw, KeyRound, Ban, ShieldCheck, Trash2, GraduationCap, Search } from "lucide-react";
import { C, bodyFont } from "../../theme.js";
import { Card, Button, Input, Select, Pill, Chip, Modal, EmptyState, Avatar, roleLabel, LoadingState, confirmDialog } from "../../components/common.jsx";
import { api } from "../../api.js";
import { GRADE_OPTIONS, GRADE_LEVELS, BRANCHES, trackForGrade } from "../../subjects.js";

export default function AdminUsersScreen() {
  const [users, setUsers] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("");
  const [q, setQ] = useState("");
  const [toast, setToast] = useState(null);
  const [addModalRole, setAddModalRole] = useState(null); // "TEACHER" | "STUDENT" | null
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [setPasswordFor, setSetPasswordFor] = useState(null); // user
  const [branchesFor, setBranchesFor] = useState(null); // öğretmen

  const load = async () => {
    setLoading(true);
    try {
      const [u, t] = await Promise.all([
        api.adminListUsers({ role: roleFilter, q }),
        api.adminListTeachers(),
      ]);
      setUsers(u.users);
      setTeachers(t.teachers);
    } catch (e) {
      setToast({ type: "error", text: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [roleFilter]);

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

  const reassignTeacher = withAction((studentId, teacherId) => api.adminReassignTeacher(studentId, teacherId || null));
  const changeGradeLevel = withAction((studentId, gradeLevel) => api.adminUpdateUser(studentId, { gradeLevel }));
  const resendActivation = withAction(async (id) => { await api.adminResendActivation(id); setToast({ type: "ok", text: "Aktivasyon bağlantısı tekrar gönderildi." }); });
  const toggleBan = withAction(async (u) => { u.banned ? await api.adminUnbanUser(u.id) : await api.adminBanUser(u.id); });
  const remove = withAction(async (u) => {
    if (!(await confirmDialog({ title: `${u.name} silinsin mi?`, message: "Hesap kalıcı olarak silinecek. Bu işlem geri alınamaz.", confirmLabel: "Hesabı Sil", danger: true }))) return;
    await api.adminDeleteUser(u.id);
  });

  return (
    <div className="k-page" style={{ padding: 28, maxWidth: 1040, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, auto)", gap: 8, maxWidth: "100%" }}>
          <Button small icon={UserPlus} onClick={() => setAddModalRole("TEACHER")}>Öğretmen Ekle</Button>
          <Button small icon={UserPlus} variant="secondary" onClick={() => setAddModalRole("STUDENT")}>Öğrenci Ekle</Button>
          <Button small icon={Upload} variant="secondary" onClick={() => setBulkModalOpen(true)}>Toplu İçe Aktar</Button>
        </div>
      </div>

      {toast && (
        <div style={{ marginBottom: 16, padding: "11px 15px", borderRadius: C.radiusSm, background: toast.type === "error" ? C.redSoft : C.greenSoft, color: toast.type === "error" ? C.red : C.green, fontSize: 13, fontWeight: 600, fontFamily: bodyFont }}>
          {toast.text}
        </div>
      )}

      <ExamDatesCard />

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
          <Input type="search" enterKeyHint="search" aria-label="İsim veya e-posta ara" placeholder="İsim veya e-posta ara..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div style={{ flex: "0 0 auto" }}><Button variant="secondary" type="submit" icon={Search}>Ara</Button></div>
      </form>

      {loading ? (
        <LoadingState />
      ) : users.length === 0 ? (
        <EmptyState text="Kayıtlı kullanıcı yok." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {users.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              teachers={teachers}
              onReassignTeacher={(teacherId) => reassignTeacher(u.id, teacherId)}
              onChangeGradeLevel={(gradeLevel) => changeGradeLevel(u.id, gradeLevel)}
              onResendActivation={() => resendActivation(u.id)}
              onToggleBan={() => toggleBan(u)}
              onEditBranches={() => setBranchesFor(u)}
              onSetPassword={() => setSetPasswordFor(u)}
              onDelete={() => remove(u)}
            />
          ))}
        </div>
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

// Kart düzeni: üstte kimlik (avatar, ad, rozetler, e-posta), öğrencide altında etiketli iki seçim
// (sınıf düzeyi, koç), en altta işlem düğmeleri — önceden seçimler rozetlerin arasına karışıyor, telefonda
// düzensiz satırlara kırılıyordu; seçimlerin neyi değiştirdiği de etiketsizdi.
function UserRow({ user, teachers, onReassignTeacher, onChangeGradeLevel, onResendActivation, onToggleBan, onEditBranches, onSetPassword, onDelete }) {
  const isStudent = user.role === "STUDENT";
  return (
    <Card hover style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <Avatar name={user.name} size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontFamily: bodyFont, fontSize: 14.5, fontWeight: 700, color: C.text, marginRight: 2 }}>{user.name}</span>
            <Pill tone={isStudent ? "accent" : "muted"}>{roleLabel(user.role)}</Pill>
            {isStudent && user.className && <Pill>{user.className}</Pill>}
            {user.banned && <Pill tone="red">Askıda</Pill>}
            {!user.hasPassword && <Pill tone="amber">Aktivasyon bekleniyor</Pill>}
            {isStudent && !GRADE_LEVELS.includes(user.gradeLevel) && <Pill tone="red">{user.gradeLevel ? "Sınıf düzeyi güncellenmeli" : "Sınıf düzeyi girilmedi"}</Pill>}
            {user.role === "TEACHER" && user.isSubjectTeacher && (
              <Pill tone="accent">{user.teachingSubjects?.length ? `Branş: ${user.teachingSubjects.join(", ")}` : "Ders öğretmeni"}</Pill>
            )}
          </div>
          <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.muted, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[user.username && `Kullanıcı adı: ${user.username}`, user.email].filter(Boolean).join(" · ")}</div>
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
          <Select label="Koç" value={user.teacherId || ""} onChange={(e) => onReassignTeacher(e.target.value)}>
            <option value="">Koç atanmadı</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.studentCount})</option>)}
          </Select>
        </div>
      )}
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap", marginTop: isStudent ? -4 : 12, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
        {!user.hasPassword && (
          <IconButton title="Aktivasyon bağlantısını tekrar gönder" icon={RotateCcw} onClick={onResendActivation} />
        )}
        {user.role === "TEACHER" && (
          <IconButton
            title="Branş (ders öğretmeni — okul çapında ortak ödev gönderebilsin)"
            icon={GraduationCap}
            onClick={onEditBranches}
            active={user.isSubjectTeacher}
          />
        )}
        <IconButton title="Şifreyi doğrudan belirle" icon={KeyRound} onClick={onSetPassword} />
        <IconButton title={user.banned ? "Askıyı kaldır" : "Askıya al"} icon={user.banned ? ShieldCheck : Ban} onClick={onToggleBan} />
        <IconButton title="Sil" icon={Trash2} onClick={onDelete} danger />
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
        width: 38, height: 38, borderRadius: C.radiusSm, border: `1px solid ${active ? C.accent : C.border}`,
        background: active ? C.accentSoft : C.surface2, color: danger ? C.red : active ? C.accent : C.muted, cursor: "pointer",
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
      await api.adminCreateUser({ role, name, email: email.trim() || undefined, username: username.trim() || undefined, phone: phone || undefined, className: className || undefined, gradeLevel: gradeLevel || undefined, teacherId: teacherId || undefined });
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
        const [name, id, gradeLevel, className, teacherEmail] = parts;
        return { name, ...identity(id), gradeLevel: gradeLevel || undefined, className: className || undefined, teacherEmail: teacherEmail || undefined };
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
    const base = { ...r, gradeTrack };
    if (role !== "STUDENT" || !r.teacherEmail) return { ...base, teacherId: undefined, teacherMatch: null };
    const match = teachersByEmail && teachersByEmail[r.teacherEmail.toLowerCase()];
    return { ...base, teacherId: match?.id, teacherMatch: match ? match.name : "eşleşme yok" };
  }), [rows, role, teachersByEmail]);

  const runImport = async () => {
    setImporting(true);
    setImportError("");
    try {
      const payloadRows = resolvedRows.map(({ teacherMatch, teacherEmail, gradeTrack, ...rest }) => rest);
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
            Her satıra bir kullanıcı — Excel/Sheets'ten kopyalayıp yapıştırabilirsin. Sütunlar: {role === "STUDENT" ? "Ad Soyad, Okul No veya E-posta, Sınıf Düzeyi (11 veya 12, zorunlu), Sınıf (opsiyonel), Koçun E-postası / Kullanıcı Adı (opsiyonel)" : "Ad Soyad, E-posta"}.
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={role === "STUDENT" ? "Ayşe Yılmaz\tayse@ornek.com\t8\t8/A\tkoc@ornek.com" : "Mehmet Kaya\tmehmet@ornek.com"}
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
