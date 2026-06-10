import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";

// ─────────────────────────────────────────────
// Checklist definition
// ─────────────────────────────────────────────
const CHECKLIST = [
  {
    category: "NHÂN VIÊN",
    color: "#2563EB",
    items: [
      { id: "nv1", text: "Chào khi KH ra / vào / đến KV POS — Mời hạng mục / SP mới" },
      { id: "nv2", text: "Tuân thủ tác phong / đồng phục — Vui vẻ thân thiện" },
      { id: "nv3", text: "Ưu tiên phục vụ KH (không để KH chờ quá 2 lượt)" },
    ],
  },
  {
    category: "OPC",
    color: "#7C3AED",
    items: [
      { id: "opc1", text: "ADQ / Order / Sale OPC 2 tuần gần nhất — Face trưng bày đúng SP bán chạy" },
      { id: "opc2", text: "Hàng hóa OPC đầy đủ — Không thiếu Item TOP" },
      { id: "opc3", text: "Hàng hóa đúng POG" },
      { id: "opc4", text: "Bảng giá: Không thiếu" },
      { id: "opc5", text: "POG-OPC hợp lí — Ý kiến CHT để tăng sale OPC" },
    ],
  },
  {
    category: "GONDOLA",
    color: "#059669",
    items: [
      { id: "g1",  text: "Layout gondola thực tế đúng layout file triển khai" },
      { id: "g2",  text: "Gondola hợp lí — Cần relayout để tăng sale / dễ vận hành?" },
      { id: "g3",  text: "Hàng hóa trưng bày đúng POG / điều chỉnh nếu kệ quá tệ" },
      { id: "g4",  text: "Sản phẩm TOP / NEW có hàng đầy đủ" },
      { id: "g5",  text: "Mâm trên cùng ngang hàng — Mâm cùng dãy cùng độ rộng" },
      { id: "g6",  text: "Gondola vệ sinh sạch sẽ (bụi, vệt keo)" },
      { id: "g7",  text: "Hàng hóa không che chắn lối đi" },
      { id: "g8",  text: "Bảng giá: Không thiếu" },
      { id: "g9",  text: "POP đỏ khuyết hàng: Không thiếu trên 2 (trừ tủ kem / nước)" },
      { id: "g10", text: "POP New & Promotion cập nhật ĐÚNG THỜI HẠN & thẩm mỹ" },
      { id: "g11", text: "CVS massage & Face up: dễ thấy / lấy / mua — Sai không quá 3 SP / kệ" },
      { id: "g12", text: "Không có SP hết HẠN BÁN, xì xẹp, biến dạng" },
    ],
  },
  {
    category: "VỆ SINH",
    color: "#D97706",
    items: [
      { id: "vs1", text: "Nước rửa tay / giấy lau tay / bàn chải chà tay đúng quy định" },
    ],
  },
];

const ALL_IDS = CHECKLIST.flatMap(c => c.items.map(i => i.id));

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function calcScore(checks = {}) {
  const total    = ALL_IDS.length;
  const answered = ALL_IDS.filter(id => checks[id]).length;
  const passed   = ALL_IDS.filter(id => checks[id] === "O").length;
  const failed   = ALL_IDS.filter(id => checks[id] === "X").length;
  const pct      = total ? Math.round((passed / total) * 100) : 0;
  return { total, answered, passed, failed, pct };
}

function gradeColor(pct) {
  if (pct >= 90) return "#16A34A";
  if (pct >= 80) return "#D97706";
  return "#DC2626";
}

// ─────────────────────────────────────────────
// Shared UI primitives
// ─────────────────────────────────────────────
function ProgressBar({ pct, color, height = 5 }) {
  return (
    <div style={{ background: "#E5E7EB", borderRadius: 999, height, overflow: "hidden" }}>
      <div style={{
        width: `${Math.min(pct, 100)}%`, background: color,
        height: "100%", transition: "width .35s ease",
      }} />
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#F0F4FF" }}>
      <div style={{ textAlign: "center", color: "#93C5FD" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
        <div style={{ fontSize: 13 }}>読み込み中… / Loading…</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Supabase helpers
// ─────────────────────────────────────────────
async function fetchRecent() {
  const { data, error } = await supabase
    .from("soi_checks")
    .select("*")
    .order("saved_at", { ascending: false })
    .limit(200);
  if (error) { console.error(error); return []; }
  return data || [];
}

async function upsertRecord(rec) {
  // upsert on (soi, store_id, date)
  const { error } = await supabase.from("soi_checks").upsert(
    {
      soi:      rec.soi,
      store_id: rec.storeId,
      date:     rec.date,
      checks:   rec.checks,
      notes:    rec.notes,
      saved_at: rec.savedAt,
    },
    { onConflict: "soi,store_id,date" }
  );
  if (error) console.error("upsert error:", error);
}

// ─────────────────────────────────────────────
// EntryScreen
// ─────────────────────────────────────────────
function EntryScreen({ records, onStart, onOpenDash }) {
  const [soi,     setSOI]   = useState("");
  const [storeId, setStore] = useState("");
  const [err,     setErr]   = useState("");

  const recent = [...records]
    .sort((a, b) => new Date(b.saved_at) - new Date(a.saved_at))
    .slice(0, 6);

  function go() {
    if (!soi.trim())     { setErr("名前を入力 / Nhập tên SOI"); return; }
    if (!storeId.trim()) { setErr("店舗IDを入力 / Nhập Store ID"); return; }
    setErr("");
    const existing = records.find(
      r => r.soi === soi.trim() && r.store_id === storeId.trim() && r.date === todayStr()
    );
    onStart({ soi: soi.trim(), storeId: storeId.trim() }, existing || null);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F0F4FF", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: "#1E3A5F", padding: "28px 24px 22px" }}>
        <div style={{ fontSize: 12, color: "#93C5FD", fontWeight: 600, marginBottom: 4, letterSpacing: 1 }}>
          Store Operation Inspection
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>SOI Check</div>
        <div style={{ fontSize: 11, color: "#64A0C8", marginTop: 4 }}>{todayStr()}</div>
      </div>

      <div style={{ flex: 1, padding: "22px 18px" }}>
        {/* Input card */}
        <div style={{
          background: "#fff", borderRadius: 16, padding: "22px 18px",
          boxShadow: "0 2px 12px rgba(30,58,95,.10)", marginBottom: 22,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1E3A5F", marginBottom: 16 }}>
            巡回情報を入力 / Nhập thông tin
          </div>

          {[
            { label: "SOI名 / Tên SOI", val: soi, set: setSOI, ph: "Tên SOI / 名前", mode: "text" },
            { label: "店舗ID / Store ID", val: storeId, set: setStore, ph: "Store ID", mode: "text" },
          ].map(f => (
            <div key={f.label} style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", display: "block", marginBottom: 5 }}>
                {f.label}
              </label>
              <input
                value={f.val}
                onChange={e => { f.set(e.target.value); setErr(""); }}
                onKeyDown={e => e.key === "Enter" && go()}
                placeholder={f.ph}
                inputMode={f.mode}
                style={{
                  width: "100%", padding: "13px 14px", borderRadius: 10, fontSize: 15,
                  border: `1.5px solid ${err && !f.val.trim() ? "#FCA5A5" : "#E0E7FF"}`,
                  boxSizing: "border-box", fontFamily: "inherit", color: "#1E3A5F",
                  outline: "none", background: f.val ? "#F0F4FF" : "#fff",
                }}
              />
            </div>
          ))}

          {err && <div style={{ color: "#DC2626", fontSize: 12, marginBottom: 12 }}>⚠ {err}</div>}

          <button onClick={go} style={{
            width: "100%", padding: "15px 0", borderRadius: 12, border: "none",
            background: "#1E3A5F", color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer",
          }}>
            チェック開始 / Bắt đầu →
          </button>
        </div>

        {/* Recent */}
        {recent.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
              最近の記録 / Lịch sử gần đây
            </div>
            {recent.map((rec, i) => {
              const sc = calcScore(rec.checks);
              return (
                <button key={i}
                  onClick={() => onStart({ soi: rec.soi, storeId: rec.store_id }, rec)}
                  style={{
                    width: "100%", background: "#fff", border: "1.5px solid #E5E7EB",
                    borderRadius: 12, padding: "12px 14px", marginBottom: 8,
                    cursor: "pointer", textAlign: "left",
                    display: "flex", alignItems: "center", gap: 12,
                    boxShadow: "0 1px 3px rgba(0,0,0,.05)",
                  }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: gradeColor(sc.pct), flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#1E3A5F" }}>
                      Store {rec.store_id}
                      <span style={{ fontWeight: 400, color: "#9CA3AF", fontSize: 12 }}> · {rec.soi}</span>
                    </div>
                    <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 1 }}>{rec.date}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, fontSize: 17, color: gradeColor(sc.pct) }}>{sc.pct}%</div>
                    <div style={{ fontSize: 10, color: "#9CA3AF" }}>{sc.answered}/{sc.total}</div>
                  </div>
                </button>
              );
            })}
          </>
        )}
      </div>

      {/* Dashboard FAB */}
      <div style={{ padding: "0 18px 28px", textAlign: "right" }}>
        <button onClick={onOpenDash} style={{
          background: "#1E3A5F", color: "#fff", border: "none", borderRadius: 40,
          padding: "12px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer",
          boxShadow: "0 4px 14px rgba(30,58,95,.35)",
        }}>📊 Dashboard</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CheckForm
// ─────────────────────────────────────────────
function CheckForm({ soi, storeId, existing, onSave, onBack }) {
  const [checks,     setChecks]     = useState(existing?.checks || {});
  const [notes,      setNotes]      = useState(existing?.notes  || {});
  const [activeNote, setActiveNote] = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [flash,      setFlash]      = useState(false);

  const sc = calcScore(checks);

  function toggle(id, val) {
    setChecks(p => ({ ...p, [id]: p[id] === val ? undefined : val }));
  }

  async function handleSave() {
    setSaving(true);
    const rec = {
      soi, storeId, date: todayStr(),
      checks, notes, savedAt: new Date().toISOString(),
    };
    await onSave(rec);
    setSaving(false);
    setFlash(true);
    setTimeout(() => setFlash(false), 2200);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC" }}>
      {/* Sticky header */}
      <div style={{
        background: "#1E3A5F", color: "#fff", padding: "14px 18px",
        position: "sticky", top: 0, zIndex: 10,
        boxShadow: "0 2px 8px rgba(0,0,0,.18)",
      }}>
        <button onClick={onBack}
          style={{ background: "none", border: "none", color: "#93C5FD", fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 6 }}>
          ← 戻る / Quay lại
        </button>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>Store {storeId}</div>
            <div style={{ fontSize: 11, color: "#93C5FD" }}>{soi} · {todayStr()}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{
              fontWeight: 800, fontSize: 26, lineHeight: 1,
              color: sc.answered ? gradeColor(sc.pct) : "#64748B",
            }}>
              {sc.answered ? `${sc.pct}%` : "—"}
            </div>
            <div style={{ fontSize: 10, color: "#93C5FD" }}>{sc.answered} / {sc.total}</div>
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <ProgressBar pct={(sc.answered / sc.total) * 100} color="#60A5FA" height={4} />
        </div>
      </div>

      {/* Items */}
      <div style={{ padding: "14px 12px 130px" }}>
        {CHECKLIST.map(cat => (
          <div key={cat.category} style={{ marginBottom: 14 }}>
            <div style={{
              background: cat.color, color: "#fff",
              borderRadius: "10px 10px 0 0", padding: "8px 14px",
              fontWeight: 800, fontSize: 12, letterSpacing: 0.8,
            }}>{cat.category}</div>
            <div style={{ background: "#fff", borderRadius: "0 0 10px 10px", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
              {cat.items.map((item, idx) => {
                const v = checks[item.id];
                return (
                  <div key={item.id} style={{
                    borderTop: idx > 0 ? "1px solid #F1F5F9" : "none",
                    padding: "12px 14px",
                    background: v === "X" ? "#FFF5F5" : v === "O" ? "#F0FDF4" : "#fff",
                    transition: "background .15s",
                  }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <div style={{ flex: 1, fontSize: 13, color: "#374151", lineHeight: 1.5 }}>{item.text}</div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        {["O", "X"].map(btn => (
                          <button key={btn} onClick={() => toggle(item.id, btn)} style={{
                            width: 44, height: 44, borderRadius: 10, border: "none", cursor: "pointer",
                            fontWeight: 800, fontSize: 16, transition: "all .15s",
                            background: v === btn ? (btn === "O" ? "#22C55E" : "#EF4444") : "#EAEAEA",
                            color: v === btn ? "#fff" : "#9CA3AF",
                            transform: v === btn ? "scale(1.08)" : "scale(1)",
                          }}>{btn}</button>
                        ))}
                      </div>
                    </div>
                    <div style={{ marginTop: 5 }}>
                      <button onClick={() => setActiveNote(activeNote === item.id ? null : item.id)}
                        style={{ background: "none", border: "none", fontSize: 11, cursor: "pointer", padding: 0, color: notes[item.id] ? "#7C3AED" : "#9CA3AF" }}>
                        {notes[item.id]
                          ? `📝 ${notes[item.id].length > 40 ? notes[item.id].slice(0, 40) + "…" : notes[item.id]}`
                          : activeNote === item.id ? "▲ 閉じる" : "+ メモ / Ghi chú"}
                      </button>
                    </div>
                    {activeNote === item.id && (
                      <textarea rows={3} placeholder="Ghi chú / メモ…"
                        value={notes[item.id] || ""}
                        onChange={e => setNotes(p => ({ ...p, [item.id]: e.target.value }))}
                        style={{
                          marginTop: 8, width: "100%", padding: "8px 10px", borderRadius: 8,
                          border: "1.5px solid #E0E7FF", fontSize: 12, resize: "none",
                          fontFamily: "inherit", color: "#374151", background: "#F8FAFF",
                          boxSizing: "border-box",
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Save bar */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "#fff", borderTop: "1px solid #E5E7EB", padding: "12px 16px",
      }}>
        {flash && (
          <div style={{ textAlign: "center", fontSize: 12, color: "#16A34A", marginBottom: 8, fontWeight: 600 }}>
            ✓ クラウドに保存しました / Đã lưu lên cloud!
          </div>
        )}
        <button onClick={handleSave} disabled={saving} style={{
          width: "100%", padding: "15px 0", borderRadius: 12, border: "none", cursor: "pointer",
          background: flash ? "#16A34A" : saving ? "#9CA3AF" : "#1E3A5F",
          color: "#fff", fontWeight: 800, fontSize: 15, transition: "background .2s",
        }}>
          {saving ? "保存中… / Đang lưu…" : flash ? "✓ 保存完了！" : "保存する / Lưu kết quả"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Excel (CSV) Export
// ─────────────────────────────────────────────
function exportToCSV(records) {
  const itemList = CHECKLIST.flatMap(c => c.items);

  // Header row
  const headers = [
    "Date", "Store ID", "SOI", "Score(%)", "Answered", "Passed(O)", "Failed(X)",
    ...itemList.map(i => `[${CHECKLIST.find(c => c.items.includes(i)).category}] ${i.text}`),
    ...itemList.map(i => `Note: ${i.text.slice(0, 30)}`),
  ];

  // Data rows
  const rows = records.map(rec => {
    const sc = calcScore(rec.checks);
    return [
      rec.date,
      rec.store_id,
      rec.soi,
      sc.pct,
      sc.answered,
      sc.passed,
      sc.failed,
      ...itemList.map(i => rec.checks?.[i.id] || ""),
      ...itemList.map(i => rec.notes?.[i.id] || ""),
    ];
  });

  const allRows = [headers, ...rows];
  const bom = "﻿"; // UTF-8 BOM for Excel
  const csv = bom + allRows.map(r =>
    r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
  ).join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `SOI_Check_${todayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────
function Dashboard({ records, loading, onRefresh, onBack }) {
  const [dateFilter, setDateFilter] = useState(todayStr());

  const filtered = dateFilter
    ? records.filter(r => r.date === dateFilter)
    : records;

  // Unique dates for filter
  const dates = [...new Set(records.map(r => r.date))].sort().reverse().slice(0, 14);

  const failCounts = {};
  filtered.forEach(rec => {
    Object.entries(rec.checks || {}).forEach(([id, v]) => {
      if (v === "X") failCounts[id] = (failCounts[id] || 0) + 1;
    });
  });

  const itemMap = {};
  CHECKLIST.forEach(cat => cat.items.forEach(item => {
    itemMap[item.id] = { text: item.text, cat: cat.category, color: cat.color };
  }));

  const topFails = Object.entries(failCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([id, count]) => ({ ...itemMap[id], count }));

  const avgPct = filtered.length
    ? Math.round(filtered.reduce((s, r) => s + calcScore(r.checks).pct, 0) / filtered.length) : 0;

  const totalNG = Object.values(failCounts).reduce((a, b) => a + b, 0);

  return (
    <div style={{ minHeight: "100vh", background: "#F0F4FF" }}>
      {/* Header */}
      <div style={{ background: "#1E3A5F", color: "#fff", padding: "16px 18px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={onBack}
            style={{ background: "none", border: "none", color: "#93C5FD", fontSize: 13, cursor: "pointer", padding: 0 }}>
            ← 戻る
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => exportToCSV(filtered)}
              style={{ background: "#16A34A", border: "none", color: "#fff", fontSize: 12, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 700 }}>
              ⬇ Excel
            </button>
            <button onClick={onRefresh}
              style={{ background: "rgba(255,255,255,.12)", border: "none", color: "#fff", fontSize: 12, borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>
              {loading ? "…" : "↻ 更新"}
            </button>
          </div>
        </div>
        <div style={{ fontWeight: 800, fontSize: 18, marginTop: 8 }}>Dashboard</div>
        <div style={{ fontSize: 11, color: "#93C5FD" }}>リアルタイム集計 / Real-time summary</div>
      </div>

      {/* Date filter */}
      <div style={{ background: "#fff", padding: "10px 16px", borderBottom: "1px solid #E5E7EB", display: "flex", gap: 8, overflowX: "auto" }}>
        {["", ...dates].map(d => (
          <button key={d} onClick={() => setDateFilter(d)} style={{
            flexShrink: 0, padding: "5px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600,
            background: dateFilter === d ? "#1E3A5F" : "#F1F5F9",
            color: dateFilter === d ? "#fff" : "#6B7280",
          }}>
            {d || "全期間 / All"}
          </button>
        ))}
      </div>

      <div style={{ padding: "16px 14px 60px" }}>
        {/* KPIs */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          {[
            { label: "巡回済み店舗", en: "Stores checked", val: filtered.length, unit: "店" },
            { label: "平均合格率", en: "Avg pass rate", val: `${avgPct}%`, unit: "", color: gradeColor(avgPct) },
            { label: "NG合計", en: "Total NG items", val: totalNG, unit: "件", color: totalNG > 0 ? "#DC2626" : "#16A34A" },
          ].map(k => (
            <div key={k.label} style={{
              flex: 1, background: "#fff", borderRadius: 12, padding: "12px 6px",
              textAlign: "center", border: "1px solid #E5E7EB",
              boxShadow: "0 1px 4px rgba(0,0,0,.07)",
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: k.color || "#1E3A5F" }}>{k.val}{k.unit}</div>
              <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>{k.label}</div>
              <div style={{ fontSize: 9, color: "#CBD5E1", fontStyle: "italic" }}>{k.en}</div>
            </div>
          ))}
        </div>

        {/* Top NG */}
        {topFails.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#1E3A5F", marginBottom: 8 }}>
              🔴 NG 頻出項目 / Top NG Items
            </div>
            <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
              {topFails.map((item, i) => {
                const maxCount = topFails[0].count;
                return (
                  <div key={i} style={{
                    padding: "10px 14px", borderTop: i > 0 ? "1px solid #F1F5F9" : "none",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: 12, color: "#374151", lineHeight: 1.4 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: item.color, marginRight: 4 }}>[{item.cat}]</span>
                        {item.text}
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 17, color: "#EF4444", flexShrink: 0 }}>{item.count}</div>
                    </div>
                    <ProgressBar pct={(item.count / maxCount) * 100} color={item.color} height={3} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Store scores */}
        {filtered.length > 0 && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#1E3A5F", marginBottom: 8 }}>
              📊 店舗別スコア / Store Scores
            </div>
            {[...filtered]
              .sort((a, b) => calcScore(a.checks).pct - calcScore(b.checks).pct)
              .map((rec, i) => {
                const sc = calcScore(rec.checks);
                return (
                  <div key={i} style={{
                    background: "#fff", borderRadius: 10, padding: "10px 14px", marginBottom: 8,
                    display: "flex", alignItems: "center", gap: 12,
                    boxShadow: "0 1px 3px rgba(0,0,0,.05)",
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: gradeColor(sc.pct), flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#1E3A5F" }}>
                        Store {rec.store_id}
                        <span style={{ fontWeight: 400, color: "#9CA3AF", fontSize: 12 }}> · {rec.soi}</span>
                      </div>
                      <ProgressBar pct={sc.pct} color={gradeColor(sc.pct)} />
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 800, fontSize: 18, color: gradeColor(sc.pct) }}>{sc.pct}%</div>
                      <div style={{ fontSize: 10, color: "#9CA3AF" }}>{sc.failed} NG</div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {filtered.length === 0 && !loading && (
          <div style={{ textAlign: "center", color: "#9CA3AF", paddingTop: 40 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
            <div style={{ fontSize: 14 }}>データなし / No data</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────
export default function App() {
  const [view,    setView]    = useState("entry");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await fetchRecent();
    setRecords(data);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("soi_checks_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "soi_checks" }, () => {
        refresh();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refresh]);

  async function handleSave(rec) {
    await upsertRecord(rec);
    // Optimistic local update
    setRecords(prev => [
      ...prev.filter(r => !(r.soi === rec.soi && r.store_id === rec.storeId && r.date === rec.date)),
      { soi: rec.soi, store_id: rec.storeId, date: rec.date, checks: rec.checks, notes: rec.notes, saved_at: rec.savedAt },
    ]);
  }

  if (loading && records.length === 0) return <Spinner />;

  if (view === "dashboard") return (
    <Dashboard records={records} loading={loading} onRefresh={refresh} onBack={() => setView("entry")} />
  );

  if (view === "check" && session) return (
    <CheckForm
      soi={session.soi}
      storeId={session.storeId}
      existing={session.existing}
      onSave={handleSave}
      onBack={() => setView("entry")}
    />
  );

  return (
    <EntryScreen
      records={records}
      onStart={(info, existing) => { setSession({ ...info, existing }); setView("check"); }}
      onOpenDash={() => setView("dashboard")}
    />
  );
}
