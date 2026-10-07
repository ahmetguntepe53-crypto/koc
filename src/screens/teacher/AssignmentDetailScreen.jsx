import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Bell, TrendingUp, Check, Clock, Star, Pencil, FileDown } from "lucide-react";
import { C, displayFont, bodyFont, SKIP_REASONS } from "../../theme.js";
import { Card, Button, EmptyState, Avatar, Modal, LoadingState, confirmDialog, SegmentBar, Legend, HeaderIconButton, Input, Textarea } from "../../components/common.jsx";
import { HeroHeader, HeroBell, OverlapCard, SegmentFilter, StatusChip, ProgressRing, NUM } from "../../components/brand.jsx";
import { api, photoUrl } from "../../api.js";
import { STATUS_LABELS } from "../../subjects.js";
import { formatDate, daysUntil } from "../../dates.js";

function fmtNet(v) {
  if (v == null || Number.isNaN(v)) return "—";
  return Number(v).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}
const netOf = (s) => (s ? s.correctCount - s.wrongCount / 4 : null);
const DAY_MS = 86400000;
// <input type="date"> değeri — cihazın yerel takvim günü.
const ymd = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const shortDate = (iso) => new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
const monthName = (d) => d.toLocaleDateString("tr-TR", { month: "long" });
function rangeLabel(startIso, endIso) {
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (s.toDateString() === e.toDateString()) return `${e.getDate()} ${monthName(e)}`;
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) return `${s.getDate()}–${e.getDate()} ${monthName(e)}`;
  return `${s.getDate()} ${monthName(s)} – ${e.getDate()} ${monthName(e)}`;
}
function sendLine(a) {
  if (a.status === "SENT") return `${a.sendMode === "MANUAL_NOW" ? "Elle" : "Otomatik"} gönderildi · ${a.sentAt ? formatDate(a.sentAt) : "—"}`;
  if (a.sendMode === "AUTO_ON_DATE") return "Tarihi gelince otomatik gönderilecek";
  if (a.sendMode === "AUTO_DAY_BEFORE") return "Bir gün önceden otomatik gönderilecek";
  return "Elle gönderilecek";
}

// focusStudentId: ödev bir öğrencinin sayfasından (koç/müdür) açıldıysa yalnızca o öğrencinin sonucu gösterilir —
// KULLANICI İSTEĞİ (2026-10-07): "o ödevden sadece Ayşe Betül'ün durumunu görmeliyim, kaç soru çözdü, kaç boş, fotoğraf".
export default function AssignmentDetailScreen({ assignmentId, onBack, unreadCount = 0, onOpenNotifications, focusStudentId = null }) {
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { photos, index }
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const load = () => {
    setLoading(true);
    setLoadError("");
    api.getAssignment(assignmentId)
      .then(({ assignment }) => setAssignment(assignment))
      .catch((e) => setLoadError(e.message || "Ödev yüklenemedi"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [assignmentId]);

  const sendNow = async () => {
    if (!(await confirmDialog({ title: "Ödev şimdi gönderilsin mi?", message: "Öğrencilere hemen bildirim gidecek. Gönderildikten sonra ödev düzenlenemez.", confirmLabel: "Şimdi Gönder" }))) return;
    setActionError("");
    setBusy(true);
    try { await api.sendAssignmentNow(assignmentId); load(); } catch (e) { setActionError(e.message); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!(await confirmDialog({ title: "Taslak silinsin mi?", message: "Bu taslak ödev kalıcı olarak silinecek.", confirmLabel: "Sil", danger: true }))) return;
    setActionError("");
    setBusy(true);
    try { await api.deleteAssignment(assignmentId); onBack(); } catch (e) { setActionError(e.message); setBusy(false); }
  };

  // Ödevi yapan/yapmayan öğrencilerin durum listesi (PDF) — durum tanımı aşağıdaki `rows` ile aynı.
  const downloadPdf = async () => {
    if (pdfBusy || !assignment) return;
    setPdfBusy(true);
    setActionError("");
    try {
      const ended = daysUntil(assignment.endDate) < 0;
      const list = assignment.recipients.map((r) => ({
        name: r.student.name, className: r.student.className,
        state: r.submission ? "done" : r.skippedAt ? "skipped" : ended ? "overdue" : "waiting",
      }));
      const { downloadAssignmentPdf } = await import("../../reportPdf.js");
      await downloadAssignmentPdf({ assignment, rows: list });
    } catch (e) {
      setActionError(e.message || "Rapor oluşturulamadı");
    } finally {
      setPdfBusy(false);
    }
  };

  const header = (
    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
      <HeaderIconButton onBrand icon={ChevronLeft} label="Geri" onClick={onBack} />
      <h1 style={{ flex: 1, minWidth: 0, margin: 0, fontFamily: displayFont, fontSize: 17, fontWeight: 600, color: C.onBrand }}>Ödev detayı</h1>
      {assignment && !assignment.readOnly && <HeaderIconButton onBrand icon={Pencil} label="Ödevi düzenle" onClick={() => setEditing(true)} />}
      {assignment?.status === "SENT" && <HeaderIconButton onBrand icon={FileDown} label={pdfBusy ? "Rapor hazırlanıyor" : "Rapor (PDF)"} onClick={downloadPdf} />}
      <HeroBell unreadCount={unreadCount} onClick={onOpenNotifications} />
    </div>
  );

  if (loading || loadError || !assignment) {
    return (
      <div>
        <HeroHeader compact>{header}</HeroHeader>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "20px 16px" }}>
          {loading ? <LoadingState /> : loadError ? <EmptyState text={loadError} /> : null}
        </div>
      </div>
    );
  }

  // readOnly: başka bir öğretmenin verdiği ödev (koç, öğrencisinin özetinden açtı) ya da admin
  // görünümü — gönder/sil yalnızca ödevin sahibi öğretmene açık (bkz. server > GET /assignments/:id).
  const readOnly = !!assignment.readOnly;
  const isSent = assignment.status === "SENT";
  const expired = isSent && daysUntil(assignment.endDate) < 0;
  const Q = assignment.questionCount;

  // Sınıf başarısı / ortalama net sunucudan (successStats — yalnızca teslim edenler); öğrenci başarısı
  // aynı formülle: net (D − Y/4) / soru sayısı.
  const rows = assignment.recipients.map((r) => {
    const net = netOf(r.submission);
    const state = r.submission ? "done" : r.skippedAt ? "skipped" : expired ? "overdue" : "waiting";
    return { r, net, pct: net != null && Q ? Math.round((net / Q) * 100) : null, state };
  }).sort((x, y) => (y.net ?? -Infinity) - (x.net ?? -Infinity) || x.r.student.name.localeCompare(y.r.student.name, "tr"));
  const doneCount = rows.filter((x) => x.state === "done").length;
  const overdueCount = rows.filter((x) => x.state === "overdue").length;
  const bestNet = doneCount >= 2 ? Math.max(...rows.filter((x) => x.state === "done").map((x) => x.net)) : null;
  const visible = filter === "all" ? rows : rows.filter((x) => x.state === filter);

  const start = new Date(assignment.scheduledDate).getTime();
  const end = new Date(assignment.endDate).getTime();
  const progress = !isSent ? 0 : end > start ? Math.max(0, Math.min(1, (Date.now() - start) / (end - start))) : 1;
  const daysLeft = daysUntil(assignment.endDate);
  const timeTitle = !isSent ? "Henüz gönderilmedi" : expired ? "Süre doldu" : daysLeft === 0 ? "Son gün bugün" : `${daysLeft} gün kaldı`;
  const footer = [sendLine(assignment), readOnly && assignment.teacher?.name].filter(Boolean).join(" · ");
  const focus = focusStudentId ? rows.find((x) => x.r.studentId === focusStudentId || x.r.student?.id === focusStudentId) : null;

  return (
    <div>
      <HeroHeader>
        {header}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14, marginTop: 20 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <StatusChip tone="lime">{assignment.subject}</StatusChip>
              <StatusChip tone="onBrand">{assignment.examType}</StatusChip>
              {assignment.pageRange && <StatusChip tone="onBrand">{assignment.pageRange}</StatusChip>}
              {!isSent && <StatusChip tone="onBrand">{STATUS_LABELS[assignment.status]}</StatusChip>}
            </div>
            <h2 style={{ margin: "10px 0 4px", fontFamily: displayFont, fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1, color: C.onBrand, textWrap: "balance", overflowWrap: "anywhere" }}>{assignment.topic}</h2>
            <div style={{ ...NUM, fontSize: 13, color: C.onBrandMuted }}>
              {[assignment.sourceBook, rangeLabel(assignment.scheduledDate, assignment.endDate)].filter(Boolean).join(" · ")}
            </div>
          </div>
          {(() => {
            const v = focus ? focus.pct : assignment.successPct;
            const who = focus ? "başarısı" : "sınıf başarısı";
            return (
              <ProgressRing
                size={104} stroke={10} value={v == null ? null : Math.max(0, v) / 100}
                color={C.lime} track={C.onBrandTrack}
                label={v == null ? `${focus ? focus.r.student.name : "Sınıf"} başarısı: henüz teslim yok` : `${focus ? focus.r.student.name : "Sınıf"} başarısı yüzde ${v}`}
              >
                <span style={{ ...NUM, fontSize: 26, fontWeight: 800, lineHeight: 1, color: C.onBrand }}>{v == null ? "—" : `%${v}`}</span>
                <span style={{ fontFamily: bodyFont, fontSize: 11, fontWeight: 500, marginTop: 4, color: C.onBrand }}>{who}</span>
              </ProgressRing>
            );
          })()}
        </div>
      </HeroHeader>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 16px 24px" }}>
        <OverlapCard>
          {focus ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar name={focus.r.student.name} size={44} tint avatar={focus.r.student.avatar} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: bodyFont, fontSize: 16, fontWeight: 800, color: C.inkText }}>{focus.r.student.name}</div>
                <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.inkMuted, marginTop: 2 }}>{[focus.r.student.className, "bu ödevdeki durumu"].filter(Boolean).join(" · ")}</div>
              </div>
            </div>
          ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            <StatBox icon={TrendingUp} tint={C.brandTint} color={C.brand} label="Ortalama net" value={fmtNet(assignment.avgNet)} />
            <StatBox icon={Check} tint={C.successTint} color={C.success} label="Teslim etti" value={<>{doneCount}<span style={{ color: C.inkMuted }}>/{rows.length}</span></>} />
            <StatBox icon={Clock} tint={C.dangerTint} color={C.danger} label="Gecikti" value={overdueCount} />
          </div>
          )}

          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: 600, color: C.inkText }}>{timeTitle}</span>
              <span style={{ ...NUM, fontSize: 12.5, color: C.inkMuted }}>{shortDate(assignment.scheduledDate)} → {shortDate(assignment.endDate)}</span>
            </div>
            <div role="img" aria-label={`Süre: ${timeTitle}`} style={{ height: 8, borderRadius: 4, background: C.track, overflow: "hidden", marginTop: 8 }}>
              <div style={{ width: `${progress * 100}%`, height: "100%", background: C.cta, borderRadius: 4 }} />
            </div>
            <div style={{ ...NUM, fontSize: 12, color: C.inkMuted, marginTop: 8 }}>{footer}</div>
          </div>

          {assignment.note && (
            <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.inkText, marginTop: 12, whiteSpace: "pre-wrap" }}>{assignment.note}</div>
          )}
          {assignment.status === "DRAFT" && !readOnly && (
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <Button small disabled={busy} onClick={sendNow}>Şimdi Gönder</Button>
              <Button small variant="danger" disabled={busy} onClick={remove}>Sil</Button>
            </div>
          )}
          {actionError && <div style={{ color: C.danger, fontSize: 12.5, marginTop: 10 }}>{actionError}</div>}
        </OverlapCard>

        {focus ? (
          <StudentResult
            {...focus} Q={Q} isSent={isSent} endDate={assignment.endDate}
            onPhoto={(i) => setLightbox({ photos: focus.r.photos, index: i })}
          />
        ) : (
          <>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "22px 0 12px" }}>
          <h3 style={{ margin: 0, fontFamily: displayFont, fontSize: 19, fontWeight: 800, color: C.inkText }}>Öğrenciler</h3>
          <span style={{ fontFamily: bodyFont, fontSize: 12, color: C.inkMuted }}>Nete göre sıralı</span>
        </div>
        <SegmentFilter
          label="Öğrencileri filtrele"
          value={filter}
          onChange={setFilter}
          style={{ marginBottom: 12 }}
          options={[
            { id: "all", label: "Tümü", count: rows.length },
            { id: "done", label: "Teslim", count: doneCount },
            { id: "overdue", label: "Gecikti", count: overdueCount },
          ]}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visible.length === 0 && <EmptyState compact text="Bu filtrede öğrenci yok." />}
          {visible.map(({ r, net, pct, state }) => (
            <StudentCard
              key={r.id} r={r} net={net} pct={pct} state={state} Q={Q} isSent={isSent}
              best={bestNet != null && net === bestNet} endDate={assignment.endDate}
              assignmentId={assignment.id} canRemind={!readOnly}
              onPhoto={(i) => setLightbox({ photos: r.photos, index: i })}
            />
          ))}
        </div>
          </>
        )}
      </div>

      {editing && (
        <EditAssignmentModal
          assignment={assignment}
          onClose={() => setEditing(false)}
          onSaved={(updated) => { setAssignment((prev) => ({ ...prev, ...updated })); setEditing(false); }}
        />
      )}

      {lightbox && (
        <Modal title={`Kanıt Fotoğrafı (${lightbox.index + 1}/${lightbox.photos.length})`} onClose={() => setLightbox(null)}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              aria-label="Önceki fotoğraf"
              onClick={() => setLightbox((l) => ({ ...l, index: (l.index - 1 + l.photos.length) % l.photos.length }))}
              disabled={lightbox.photos.length < 2}
              style={{ background: "none", border: "none", cursor: lightbox.photos.length < 2 ? "default" : "pointer", opacity: lightbox.photos.length < 2 ? 0.3 : 1, flexShrink: 0 }}
            >
              <ChevronLeft size={22} color={C.text} />
            </button>
            <img
              src={photoUrl(lightbox.photos[lightbox.index])}
              alt="Kanıt fotoğrafı"
              style={{ width: "100%", maxHeight: "65vh", objectFit: "contain", borderRadius: C.radiusSm, background: C.surface2 }}
            />
            <button
              type="button"
              aria-label="Sonraki fotoğraf"
              onClick={() => setLightbox((l) => ({ ...l, index: (l.index + 1) % l.photos.length }))}
              disabled={lightbox.photos.length < 2}
              style={{ background: "none", border: "none", cursor: lightbox.photos.length < 2 ? "default" : "pointer", opacity: lightbox.photos.length < 2 ? 0.3 : 1, flexShrink: 0 }}
            >
              <ChevronRight size={22} color={C.text} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StatBox({ icon: Icon, tint, color, label, value }) {
  return (
    <div style={{ minWidth: 0, background: tint, borderRadius: 16, padding: 12 }}>
      <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 9, background: color, color: C.onBrand, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={15} strokeWidth={2.6} />
      </span>
      <div style={{ ...NUM, fontSize: 22, fontWeight: 800, lineHeight: 1.1, color: C.numText, marginTop: 10, whiteSpace: "nowrap" }}>{value}</div>
      <div style={{ fontFamily: bodyFont, fontSize: 12, color: C.inkMuted, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function StudentCard({ r, net, pct, state, Q, isSent, best, endDate, onPhoto, assignmentId, canRemind }) {
  const [remindedAt, setRemindedAt] = useState(r.manualReminderSentAt);
  const [reminding, setReminding] = useState(false);
  const [remindError, setRemindError] = useState("");
  const reminded = remindedAt && Date.now() - new Date(remindedAt).getTime() < DAY_MS;
  const remind = async () => {
    setReminding(true);
    setRemindError("");
    try {
      const res = await api.remindRecipient(assignmentId, r.id);
      setRemindedAt(res.manualReminderSentAt);
    } catch (e) {
      setRemindError(e.message || "Hatırlatma gönderilemedi");
    } finally {
      setReminding(false);
    }
  };
  const sub = r.submission;
  const overdue = state === "overdue";
  const meta = sub ? `${shortDate(r.completedAt || sub.createdAt)} teslim`
    : state === "skipped" ? "pas geçti"
    : overdue ? "teslim etmedi"
    : isSent ? "henüz teslim etmedi" : "ödev henüz gönderilmedi";
  const answered = sub ? sub.correctCount + sub.wrongCount + sub.blankCount : 0;
  const parts = sub ? [
    { label: "doğru", value: sub.correctCount, color: C.success },
    { label: "yanlış", value: sub.wrongCount, color: C.barWrong },
    { label: "boş", value: sub.blankCount, color: C.barEmpty },
  ] : [];

  return (
    <Card style={{ padding: 14, borderRadius: 20, border: overdue ? `1px solid ${C.dangerBorder}` : "none", background: overdue ? C.dangerTint : C.surface }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Avatar name={r.student.name} size={44} tint avatar={r.student.avatar} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: bodyFont, fontSize: 15, fontWeight: 700, color: C.inkText }}>{r.student.name}</span>
            {best && <StatusChip tone="lime"><Star size={11} strokeWidth={2.4} fill="currentColor" aria-hidden="true" />En iyi</StatusChip>}
          </div>
          <div style={{ ...NUM, fontSize: 12.5, color: overdue ? C.dangerText : C.inkMuted, marginTop: 2 }}>
            {[r.student.className, meta].filter(Boolean).join(" · ")}
          </div>
        </div>
        {state === "done" ? (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ ...NUM, fontSize: 22, fontWeight: 800, color: C.numText, lineHeight: 1 }}>{fmtNet(net)}</div>
            <div style={{ fontFamily: bodyFont, fontSize: 11, color: C.inkMuted, marginTop: 3 }}>net</div>
          </div>
        ) : overdue ? <StatusChip tone="danger">Gecikti</StatusChip>
          : state === "skipped" ? <StatusChip tone="track">Pas geçti</StatusChip>
          : <StatusChip tone={isSent ? "warning" : "track"}>{isSent ? "Bekliyor" : "Gönderilmedi"}</StatusChip>}
      </div>

      {sub && (
        <div style={{ marginTop: 12 }}>
          <SegmentBar height={10} gap={3} radius={5} parts={Q && Q > answered ? [...parts, { label: "cevapsız", value: Q - answered, color: C.track }] : parts} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 10 }}>
            <Legend items={parts} numFont={bodyFont} labelColor={C.inkMuted} valueColor={C.inkText} fontSize={12} style={{ columnGap: 12 }} />
            {pct != null && <StatusChip tone={pct >= 65 ? "success" : "warning"}>%{pct}</StatusChip>}
          </div>
        </div>
      )}

      {overdue && (
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <span style={{ ...NUM, fontSize: 12.5, color: C.dangerText }}>Son gün {shortDate(endDate)} geçti, teslim yok</span>
          {/* Öğretmen günde bir kez elle hatırlatabilir (server > .../remind); sunucunun kendi otomatik gecikme
              hatırlatması ayrıca gider. */}
          {canRemind && (reminded ? (
            <span role="status" style={{
              minHeight: 44, padding: "0 16px", borderRadius: 999, background: C.surface, color: C.dangerText,
              display: "inline-flex", alignItems: "center", gap: 6, fontFamily: bodyFont, fontSize: 13.5, fontWeight: 700,
            }}>
              <Check size={15} strokeWidth={2.6} aria-hidden="true" />Hatırlatıldı
            </span>
          ) : (
            <button
              type="button"
              onClick={remind}
              disabled={reminding}
              className="k-btn"
              style={{
                minHeight: 44, padding: "0 18px", borderRadius: 999, border: "none", cursor: reminding ? "default" : "pointer",
                background: C.danger, color: C.onBrand, opacity: reminding ? 0.7 : 1,
                display: "inline-flex", alignItems: "center", gap: 6, fontFamily: bodyFont, fontSize: 13.5, fontWeight: 700,
              }}
            >
              <Bell size={15} strokeWidth={2.4} aria-hidden="true" />{reminding ? "Gönderiliyor…" : "Hatırlat"}
            </button>
          ))}
        </div>
      )}
      {remindError && <div role="alert" style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.dangerText, marginTop: 8 }}>{remindError}</div>}
      {state === "skipped" && r.skipReason && (
        <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.inkMuted, marginTop: 8, fontStyle: "italic" }}>"{SKIP_REASONS[r.skipReason] || r.skipReason}"{r.skipNote ? ` — ${r.skipNote}` : ""}</div>
      )}
      {sub?.note && (
        <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.inkMuted, marginTop: 8, fontStyle: "italic" }}>"{sub.note}"</div>
      )}
      {r.photos?.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {r.photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              aria-label="Kanıt fotoğrafını büyüt"
              onClick={() => onPhoto(i)}
              style={{ width: 44, height: 44, borderRadius: C.radiusSm, overflow: "hidden", border: `1px solid ${C.border}`, padding: 0, cursor: "pointer", flexShrink: 0 }}
            >
              <img src={photoUrl(p)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

// Tek öğrencinin bu ödevdeki sonucu (odak görünümü): durum, D/Y/B ve net, cevapsız soru, teslim zamanı (zamanında/geç),
// yanlış-boş soru numaraları, not, pas sebebi ve kanıt fotoğrafları büyük kutularla.
const TR_GRACE_MS = 21 * 60 * 60 * 1000; // bitiş gününün Türkiye'deki sonu (bkz. server > weekStats.js)
function StudentResult({ r, net, pct, state, Q, isSent, endDate, onPhoto }) {
  const sub = r.submission;
  const answered = sub ? sub.correctCount + sub.wrongCount + sub.blankCount : 0;
  const unanswered = sub && Q && Q > answered ? Q - answered : 0;
  const doneAt = sub ? new Date(r.completedAt || sub.createdAt) : null;
  const lateDays = doneAt ? Math.ceil((doneAt.getTime() - (new Date(endDate).getTime() + TR_GRACE_MS)) / DAY_MS) : 0;
  const status = state === "done" ? { tone: "success", text: "Tamamladı" }
    : state === "skipped" ? { tone: "warning", text: "Pas geçti" }
    : state === "overdue" ? { tone: "danger", text: "Gecikti" }
    : { tone: isSent ? "warning" : "track", text: isSent ? "Bekliyor" : "Gönderilmedi" };
  const parts = sub ? [
    { label: "doğru", value: sub.correctCount, color: C.success },
    { label: "yanlış", value: sub.wrongCount, color: C.barWrong },
    { label: "boş", value: sub.blankCount, color: C.barEmpty },
  ] : [];
  const Box = ({ label, value, color }) => (
    <div style={{ minWidth: 0, padding: "10px 8px", borderRadius: 14, background: C.pageTint, textAlign: "center" }}>
      <div style={{ ...NUM, fontSize: 22, fontWeight: 800, color: color || C.numText, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontFamily: bodyFont, fontSize: 11.5, color: C.inkMuted, marginTop: 3 }}>{label}</div>
    </div>
  );
  const nums = sub?.questionNumbers?.length ? [...sub.questionNumbers].sort((a, b) => a - b) : [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 18 }}>
      <Card style={{ padding: 16, borderRadius: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <h3 style={{ margin: 0, fontFamily: displayFont, fontSize: 17, fontWeight: 800, color: C.inkText }}>Sonuç</h3>
          <StatusChip tone={status.tone}>{status.text}</StatusChip>
        </div>
        {sub ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, marginTop: 14 }}>
              <Box label="doğru" value={sub.correctCount} color={C.success} />
              <Box label="yanlış" value={sub.wrongCount} color={C.danger} />
              <Box label="boş" value={sub.blankCount} color={C.inkMuted} />
              <Box label="net" value={fmtNet(net)} />
            </div>
            <div style={{ marginTop: 14 }}>
              <SegmentBar height={10} gap={3} radius={5} parts={unanswered ? [...parts, { label: "cevapsız", value: unanswered, color: C.track }] : parts} />
            </div>
            <div style={{ ...NUM, display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 12.5, color: C.inkMuted, marginTop: 10 }}>
              <span>{answered}{Q ? `/${Q}` : ""} soru işaretledi</span>
              {unanswered > 0 && <span>{unanswered} soru girilmedi</span>}
              {pct != null && <span>başarı %{pct}</span>}
            </div>
            <div style={{ ...NUM, fontSize: 12.5, marginTop: 10, color: lateDays > 0 ? C.dangerText : C.successText }}>
              {formatDate(doneAt)} teslim · {lateDays > 0 ? `${lateDays} gün geç` : "zamanında"}
            </div>
          </>
        ) : state === "skipped" ? (
          <div style={{ fontFamily: bodyFont, fontSize: 14, color: C.inkText, marginTop: 12, lineHeight: 1.5 }}>
            Sebep: <b>{SKIP_REASONS[r.skipReason] || "Belirtilmedi"}</b>{r.skipNote ? ` — ${r.skipNote}` : ""}
          </div>
        ) : (
          <div style={{ fontFamily: bodyFont, fontSize: 14, color: state === "overdue" ? C.dangerText : C.inkMuted, marginTop: 12, lineHeight: 1.5 }}>
            {state === "overdue" ? `Son gün ${shortDate(endDate)} geçti, sonuç girilmedi.` : isSent ? `Henüz sonuç girmedi · son gün ${shortDate(endDate)}.` : "Ödev henüz gönderilmedi."}
          </div>
        )}
      </Card>

      {nums.length > 0 && (
        <Card style={{ padding: 16, borderRadius: 20 }}>
          <div style={{ fontFamily: bodyFont, fontSize: 14, fontWeight: 800, color: C.inkText }}>Yanlış / boş soru numaraları</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {nums.map((n) => <span key={n} style={{ ...NUM, minWidth: 32, padding: "5px 8px", borderRadius: 10, background: C.dangerTint, color: C.dangerText, fontSize: 13, fontWeight: 800, textAlign: "center" }}>{n}</span>)}
          </div>
        </Card>
      )}

      {sub?.note && (
        <Card style={{ padding: 16, borderRadius: 20 }}>
          <div style={{ fontFamily: bodyFont, fontSize: 14, fontWeight: 800, color: C.inkText }}>Öğrencinin notu</div>
          <div style={{ fontFamily: bodyFont, fontSize: 14, color: C.inkText, marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{sub.note}</div>
        </Card>
      )}

      <Card style={{ padding: 16, borderRadius: 20 }}>
        <div style={{ fontFamily: bodyFont, fontSize: 14, fontWeight: 800, color: C.inkText }}>Fotoğraflar{r.photos?.length ? ` (${r.photos.length})` : ""}</div>
        {r.photos?.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 10 }}>
            {r.photos.map((p, i) => (
              <button key={p.id} type="button" aria-label={`Fotoğraf ${i + 1}: büyüt`} onClick={() => onPhoto(i)}
                style={{ aspectRatio: "1 / 1", width: "100%", borderRadius: 14, overflow: "hidden", border: `1px solid ${C.border}`, padding: 0, cursor: "pointer", background: C.surface2 }}>
                <img src={photoUrl(p)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </button>
            ))}
          </div>
        ) : (
          <div style={{ fontFamily: bodyFont, fontSize: 13, color: C.inkMuted, marginTop: 8 }}>Fotoğraf yüklemedi.</div>
        )}
      </Card>
    </div>
  );
}

// Gönderilmiş ödevde sunucu yalnızca bu alanları kabul eder (ders/sınav türü/başlangıç kilitli); son gün
// değişirse bitirmemiş öğrencilere bildirim gider.
function EditAssignmentModal({ assignment, onClose, onSaved }) {
  const [topic, setTopic] = useState(assignment.topic);
  const [sourceBook, setSourceBook] = useState(assignment.sourceBook || "");
  const [endDate, setEndDate] = useState(ymd(assignment.endDate));
  const [note, setNote] = useState(assignment.note || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const minEnd = ymd(assignment.scheduledDate);

  const save = async () => {
    if (!topic.trim()) { setError("Konu boş olamaz"); return; }
    if (!endDate || endDate < minEnd) { setError("Son gün başlangıçtan önce olamaz"); return; }
    const patch = {};
    if (topic.trim() !== assignment.topic) patch.topic = topic.trim();
    if (sourceBook.trim() !== (assignment.sourceBook || "")) patch.sourceBook = sourceBook.trim();
    if (note.trim() !== (assignment.note || "")) patch.note = note.trim();
    if (endDate !== ymd(assignment.endDate)) patch.endDate = endDate;
    if (!Object.keys(patch).length) { onClose(); return; }
    setSaving(true);
    setError("");
    try {
      const { assignment: updated } = await api.updateAssignment(assignment.id, patch);
      onSaved(updated);
    } catch (e) {
      setError(e.message || "Kaydedilemedi");
      setSaving(false);
    }
  };

  return (
    <Modal title="Ödevi düzenle" onClose={onClose}>
      <Input label="Konu" value={topic} onChange={(e) => setTopic(e.target.value)} />
      <Input label="Kaynak kitap" value={sourceBook} onChange={(e) => setSourceBook(e.target.value)} placeholder="opsiyonel" />
      <Input label="Son gün" type="date" value={endDate} min={minEnd} onChange={(e) => setEndDate(e.target.value)} />
      <Textarea label="Not" value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="opsiyonel" />
      {assignment.status === "SENT" && (
        <div style={{ fontFamily: bodyFont, fontSize: 12.5, color: C.mutedLight, marginBottom: 14, lineHeight: 1.45 }}>
          Ders ve sınav türü gönderildikten sonra değiştirilemez. Son günü değiştirirsen henüz bitirmemiş öğrencilere bildirim gider.
        </div>
      )}
      {error && <div role="alert" style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Vazgeç</Button>
        <Button onClick={save} disabled={saving} style={{ flex: 1 }}>{saving ? "Kaydediliyor…" : "Kaydet"}</Button>
      </div>
    </Modal>
  );
}
