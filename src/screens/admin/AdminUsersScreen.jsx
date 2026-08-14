import { useEffect, useMemo, useState } from "react";
import { UserPlus, Upload, RotateCcw, KeyRound, Ban, ShieldCheck, Trash2 } from "lucide-react";
import { C, bodyFont } from "../../theme.js";
import { Card, Button, Input, Select, Pill, Modal, EmptyState, roleLabel } from "../../components/common.jsx";
import { api } from "../../api.js";
import { GRADE_OPTIONS, trackForGrade } from "../../subjects.js";

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
    if (!window.confirm(`${u.name} silinsin mi? Bu işlem geri alınamaz.`)) return;
    await api.adminDeleteUser(u.id);
  });

  return (
    <div style={{ padding: 28, maxWidth: 1040, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8 }}>
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

      <form onSubmit={runSearch} style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ minWidth: 160 }}>
          <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">Tüm roller</option>
            <option value="ADMIN">Yönetici</option>
            <option value="TEACHER">Öğretmen</option>
            <option value="STUDENT">Öğrenci</option>
          </Select>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <Input placeholder="İsim veya e-posta ara..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button small variant="secondary" type="submit">Ara</Button>
      </form>

      {loading ? (
        <EmptyState text="Yükleniyor..." />
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
      {setPasswordFor && (
        <SetPasswordModal
          user={setPasswordFor}
          onClose={() => setSetPasswordFor(null)}
          onDone={() => { setSetPasswordFor(null); setToast({ type: "ok", text: "Şifre belirlendi." }); }}
        />
      )}
    </div>
  );
}

function UserRow({ user, teachers, onReassignTeacher, onChangeGradeLevel, onResendActivation, onToggleBan, onSetPassword, onDelete }) {
  return (
    <Card hover style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: bodyFont, fontSize: 14.5, fontWeight: 700, color: C.text }}>{user.name}</span>
            <Pill tone={user.role === "STUDENT" ? "accent" : "muted"}>{roleLabel(user.role)}</Pill>
            {user.banned && <Pill tone="red">Askıda</Pill>}
            {!user.hasPassword && <Pill tone="amber">Aktivasyon bekleniyor</Pill>}
          </div>
          <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.muted, marginTop: 3 }}>{user.email}</div>
          {user.role === "STUDENT" && (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {user.className && <Pill>{user.className}</Pill>}
              <Pill tone={trackForGrade(user.gradeLevel) === "LGS" ? "amber" : trackForGrade(user.gradeLevel) === "YKS" ? "green" : "red"}>
                {user.gradeLevel ? `${user.gradeLevel}. Sınıf (${trackForGrade(user.gradeLevel)})` : "Sınıf düzeyi girilmedi"}
              </Pill>
              <Select value={user.gradeLevel || ""} onChange={(e) => onChangeGradeLevel(e.target.value)} style={{ minWidth: 150 }}>
                <option value="" disabled>Sınıf düzeyi...</option>
                {GRADE_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </Select>
              <Select value={user.teacherId || ""} onChange={(e) => onReassignTeacher(e.target.value)} style={{ minWidth: 160 }}>
                <option value="">Koç atanmadı</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.studentCount})</option>)}
              </Select>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {!user.hasPassword && (
            <IconButton title="Aktivasyon bağlantısını tekrar gönder" icon={RotateCcw} onClick={onResendActivation} />
          )}
          <IconButton title="Şifreyi doğrudan belirle" icon={KeyRound} onClick={onSetPassword} />
          <IconButton title={user.banned ? "Askıyı kaldır" : "Askıya al"} icon={user.banned ? ShieldCheck : Ban} onClick={onToggleBan} />
          <IconButton title="Sil" icon={Trash2} onClick={onDelete} danger />
        </div>
      </div>
    </Card>
  );
}

function IconButton({ icon: Icon, onClick, title, danger }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="k-icon-btn"
      style={{
        width: 34, height: 34, borderRadius: C.radiusSm, border: `1px solid ${C.border}`,
        background: C.surface2, color: danger ? C.red : C.muted, cursor: "pointer",
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
  const [phone, setPhone] = useState("");
  const [className, setClassName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (role === "STUDENT" && !gradeLevel) { setError("Sınıf düzeyi seçmelisin — sistem buna göre LGS ya da TYT/AYT gösterir"); return; }
    setSaving(true);
    try {
      await api.adminCreateUser({ role, name, email, phone: phone || undefined, className: className || undefined, gradeLevel: gradeLevel || undefined, teacherId: teacherId || undefined });
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
        <Input label="E-posta" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
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
          Kullanıcıya şifresini belirlemesi için bir e-posta gönderilecek.
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

function parseBulkText(text, role) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const sep = line.includes("\t") ? "\t" : ",";
      const parts = line.split(sep).map((p) => p.trim());
      if (role === "STUDENT") {
        const [name, email, gradeLevel, className, teacherEmail] = parts;
        return { name, email, gradeLevel: gradeLevel || undefined, className: className || undefined, teacherEmail: teacherEmail || undefined };
      }
      const [name, email] = parts;
      return { name, email };
    });
}

function BulkImportModal({ teachers, onClose, onDone }) {
  const [role, setRole] = useState("STUDENT");
  const [text, setText] = useState("");
  const [results, setResults] = useState(null);
  const [importing, setImporting] = useState(false);
  const [teachersByEmail, setTeachersByEmail] = useState(null);

  useEffect(() => {
    if (role !== "STUDENT") return;
    api.adminListUsers({ role: "TEACHER" }).then(({ users }) => {
      setTeachersByEmail(Object.fromEntries(users.map((t) => [t.email.toLowerCase(), t])));
    });
  }, [role]);

  const rows = useMemo(() => parseBulkText(text, role), [text, role]);
  const resolvedRows = useMemo(() => rows.map((r) => {
    const gradeTrack = role === "STUDENT" ? trackForGrade(Number(r.gradeLevel)) : null;
    const base = { ...r, gradeTrack };
    if (role !== "STUDENT" || !r.teacherEmail) return { ...base, teacherId: undefined, teacherMatch: null };
    const match = teachersByEmail && teachersByEmail[r.teacherEmail.toLowerCase()];
    return { ...base, teacherId: match?.id, teacherMatch: match ? match.name : "eşleşme yok" };
  }), [rows, role, teachersByEmail]);

  const runImport = async () => {
    setImporting(true);
    try {
      const payloadRows = resolvedRows.map(({ teacherMatch, teacherEmail, gradeTrack, ...rest }) => rest);
      const res = await api.adminBulkImport(role, payloadRows);
      setResults(res.results);
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
            Her satıra bir kullanıcı — Excel/Sheets'ten kopyalayıp yapıştırabilirsin. Sütunlar: {role === "STUDENT" ? "Ad Soyad, E-posta, Sınıf Düzeyi (7-12, zorunlu), Sınıf (opsiyonel), Koçun E-postası (opsiyonel)" : "Ad Soyad, E-posta"}.
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
                  <span>{r.name} · {r.email}{r.className ? ` · ${r.className}` : ""}</span>
                  <span style={{ display: "flex", gap: 8 }}>
                    {role === "STUDENT" && (
                      <span style={{ color: r.gradeTrack ? C.muted : C.red }}>{r.gradeTrack ? `${r.gradeLevel}. sınıf (${r.gradeTrack})` : "sınıf düzeyi geçersiz"}</span>
                    )}
                    {role === "STUDENT" && r.teacherEmail && (
                      <span style={{ color: r.teacherMatch === "eşleşme yok" ? C.red : C.muted }}>{r.teacherMatch}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
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
