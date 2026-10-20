// نظام حضور وحفظ — قاعدة محلية + مزامنة Google Sheets.
// شغّل setupSpreadsheet() مرة واحدة بعد لصق الكود، ثم انشر Web App.

const SHEETS = {
  STUDENTS: "الطلاب",
  RECORDS: "السجلات",
  CONFIG: "الإعدادات",
  DASHBOARD: "لوحة التحكم",
  DETAIL: "تفاصيل الطالب",
  PAYMENTS: "الدفعات",
  WARDS: "أوراد الحفظ",
};
const OLD_SHEETS = {
  STUDENTS: "Students",
  RECORDS: "Records",
  CONFIG: "Config",
  DASHBOARD: "Dashboard",
  DETAIL: "Student Details",
};
const STUDENT_HEADERS = [
  "المعرف",
  "الاسم",
  "العمر",
  "المجموعة",
  "الهاتف",
  "هاتف ولي الأمر",
  "آخر تحديث",
  "الأيام",
  "الحالة",
];
const RECORD_HEADERS = [
  "معرف السجل",
  "التاريخ",
  "معرف الطالب",
  "الحالة",
  "الحفظ",
  "آخر تحديث",
  "أوراد الحفظ",
];
const WARD_HEADERS = ["معرف الورد", "معرف السجل", "معرف الطالب", "التاريخ", "النوع", "السورة", "رقم السورة", "من آية", "إلى آية", "عدد آيات السورة", "نهاية السورة", "التقييم", "ملاحظات", "آخر تحديث"];
const CONFIG_HEADERS = ["المفتاح", "القيمة"];
const PAYMENT_HEADERS = [
  "معرف الدفعة",
  "التاريخ",
  "الفترة",
  "النوع",
  "الطلاب",
  "المبلغ الإجمالي",
  "المجموعة",
  "ملاحظات",
  "آخر تحديث",
];

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || "ping");
    if (action === "ping")
      return json_(
        { success: true, serverTime: new Date().toISOString() },
        e.parameter.callback,
      );
    if (action === "sync")
      return json_(
        sync_(decodePayload_(e.parameter.payload || "")),
        e.parameter.callback,
      );
    if (action === "pull")
      return json_(pull_(e.parameter.since || ""), e.parameter.callback);
    if (action === "fullPull") return json_(pull_(""), e.parameter.callback);
    if (action === "clearRecords")
      return json_(clearRecords_(), e.parameter.callback);
    if (action === "clearAll") return json_(clearAll_(), e.parameter.callback);
    return json_(
      { success: false, message: "إجراء غير معروف" },
      e.parameter.callback,
    );
  } catch (err) {
    return json_(
      { success: false, message: String((err && err.message) || err) },
      e.parameter.callback,
    );
  }
}

function doPost(e) {
  try {
    const body =
      e && e.postData && e.postData.contents
        ? JSON.parse(e.postData.contents)
        : {};
    const action = String(body.action || "ping");
    let result;
    if (action === "ping")
      result = { success: true, serverTime: new Date().toISOString() };
    else if (action === "sync") result = sync_(body.payload || {});
    else if (action === "pull") result = pull_(body.since || "");
    else if (action === "fullPull") result = pull_("");
    else if (action === "clearRecords") result = clearRecords_();
    else if (action === "clearAll") result = clearAll_();
    else result = { success: false, message: "إجراء غير معروف" };
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(
      ContentService.MimeType.JSON,
    );
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({
        success: false,
        message: String((err && err.message) || err),
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// تحقق خفيف للاستخدام أثناء المزامنة: لا يعيد بناء لوحة التحكم أو يمسح تفاصيل الطالب.
// التهيئة والترحيل الكاملان يظلان في setupSpreadsheet() للتشغيل اليدوي عند الحاجة.
function ensureSyncSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const required = [
    [SHEETS.STUDENTS, STUDENT_HEADERS],
    [SHEETS.RECORDS, RECORD_HEADERS],
    [SHEETS.PAYMENTS, PAYMENT_HEADERS],
    [SHEETS.CONFIG, CONFIG_HEADERS],
  ];
  required.push([SHEETS.WARDS, WARD_HEADERS]);
  required.forEach(([name, headers]) => {
    let sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.setFrozenRows(1);
      return;
    }
    // Add newly introduced columns by header name without overwriting existing rows.
    const width = Math.max(sh.getLastColumn(), 1);
    const existing = sh.getRange(1, 1, 1, width).getDisplayValues()[0].map(v => String(v || "").trim());
    headers.forEach(header => {
      if (existing.indexOf(header) === -1) {
        const col = sh.getLastColumn() + 1;
        sh.getRange(1, col).setValue(header);
        existing.push(header);
      }
    });
    sh.setFrozenRows(1);
  });
  const config = ss.getSheetByName(SHEETS.CONFIG);
  if (config.getLastRow() < 2)
    config.getRange(2, 1, 1, 2).setValues([["التطبيق", "حضور وحفظ"]]);
  try {
    config.hideSheet();
  } catch (_) {}
}

function setupSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  migrateOldSheet_(ss, OLD_SHEETS.STUDENTS, SHEETS.STUDENTS);
  migrateOldSheet_(ss, OLD_SHEETS.RECORDS, SHEETS.RECORDS);
  migrateOldSheet_(ss, OLD_SHEETS.CONFIG, SHEETS.CONFIG);
  migrateOldSheet_(ss, OLD_SHEETS.DASHBOARD, SHEETS.DASHBOARD);
  migrateOldSheet_(ss, OLD_SHEETS.DETAIL, SHEETS.DETAIL);
  migrateOldSheet_(ss, OLD_SHEETS.PAYMENTS, SHEETS.PAYMENTS);
  migrateStudentsSchema_(ss);

  ensureSheet_(ss, SHEETS.STUDENTS, STUDENT_HEADERS);
  ensureSheet_(ss, SHEETS.RECORDS, RECORD_HEADERS);
  ensureSheet_(ss, SHEETS.CONFIG, CONFIG_HEADERS);
  ensureSheet_(ss, SHEETS.PAYMENTS, PAYMENT_HEADERS);
  ensureSheet_(ss, SHEETS.WARDS, WARD_HEADERS);
  const config = ss.getSheetByName(SHEETS.CONFIG);
  if (config.getLastRow() < 2)
    config.getRange(2, 1, 1, 2).setValues([["التطبيق", "حضور وحفظ"]]);
  config.hideSheet();
  ensureDashboard_(ss);
  ensureDetail_(ss);
  formatBaseSheets_(ss);
  try {
    ss.setSpreadsheetLocale("en_US");
  } catch (_) {}
  rebuildDashboard_();
  return "جاهز";
}

function migrateOldSheet_(ss, oldName, newName) {
  const old = ss.getSheetByName(oldName);
  const target = ss.getSheetByName(newName);
  if (old && !target) old.setName(newName);
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sh;
}

// ترحيل آمن لجدول الطلاب القديم إلى الشكل الجديد.
// مهم: لا يعتمد على ترتيب الأعمدة؛ يعتمد على أسماء العناوين،
// لذلك لا تتحرك بيانات المجموعة/الهاتف/آخر تحديث إلى أعمدة خاطئة.
function migrateStudentsSchema_(ss) {
  const sh = ss.getSheetByName(SHEETS.STUDENTS);
  if (!sh || sh.getLastRow() < 1) return;

  const lastCol = Math.max(sh.getLastColumn(), 1);
  const headers = sh
    .getRange(1, 1, 1, lastCol)
    .getDisplayValues()[0]
    .map((x) => String(x || "").trim());
  const rowCount = Math.max(0, sh.getLastRow() - 1);
  const rows = rowCount ? sh.getRange(2, 1, rowCount, lastCol).getValues() : [];
  const isTimestamp = (v) => {
    if (v instanceof Date && !isNaN(v.getTime())) return true;
    const s = String(v == null ? "" : v).trim();
    return (
      /^\d{4}-\d{2}-\d{2}T/.test(s) ||
      /^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}/.test(s) ||
      /^\w{3} \w{3} \d{1,2} \d{4}/.test(s)
    );
  };
  const looksPhone = (v) =>
    /^0?1[0125]\d{8}$/.test(String(v == null ? "" : v).replace(/[ +()-]/g, ""));

  // إصلاح النسخة التي ظهرت فيها المجموعة داخل عمود الهاتف/آخر تحديث.
  // الشكل المتضرر: A=ID, B=الاسم, C=المجموعة(فارغة), D=الهاتف(فارغ), E=آخر تحديث لكن القيمة مجموعة.
  const hasExpectedNewHeaders = STUDENT_HEADERS.slice(0, 7).every(
    (h) => headers.indexOf(h) !== -1,
  );
  const ageMissing = headers.indexOf("العمر") === -1;
  const duplicateUpdated = headers.filter((h) => h === "آخر تحديث").length >= 2;
  let corrupted = false;
  if (ageMissing && duplicateUpdated && rowCount) {
    corrupted = rows.slice(0, Math.min(100, rows.length)).some((r) => {
      const c = String(r[2] == null ? "" : r[2]).trim();
      const d = String(r[3] == null ? "" : r[3]).trim();
      const e = r[4];
      const f = String(r[5] == null ? "" : r[5]).trim();
      const g = r[6];
      return (
        !c &&
        !f &&
        !g &&
        String(e || "").trim() !== "" &&
        !isTimestamp(e) &&
        (!d || looksPhone(d))
      );
    });
  }

  if (corrupted) {
    const fixed = rows.map((r) => {
      const e = r[4];
      const d = r[3];
      const group =
        String(r[2] || "").trim() ||
        (!isTimestamp(e) ? String(e || "").trim() : "");
      const phone = looksPhone(d) ? String(d).trim() : "";
      const updated = isTimestamp(r[6])
        ? normalizeTimestamp_(r[6])
        : isTimestamp(e)
          ? normalizeTimestamp_(e)
          : new Date().toISOString();
      return [r[0], r[1], "", group, phone, String(r[5] || ""), updated];
    });
    sh.getRange(1, 1, 1, 7).setValues([STUDENT_HEADERS.slice(0, 7)]);
    if (fixed.length) sh.getRange(2, 1, fixed.length, 7).setValues(fixed);
    return;
  }

  // إذا كان الشكل الجديد كاملًا، لا نعيد ترتيب البيانات.
  if (hasExpectedNewHeaders) return;

  // الشكل القديم: المعرف، الاسم، المجموعة، الهاتف، آخر تحديث (+ أعمدة اختيارية).
  const normalized = headers;
  const oldIndex = {};
  normalized.forEach((h, i) => {
    if (!(h in oldIndex)) oldIndex[h] = i;
  });
  const aliases = {
    id: ["المعرف", "ID", "Id", "id"],
    name: ["الاسم", "Name", "name"],
    age: ["العمر", "Age", "age"],
    group: ["المجموعة", "Group", "group"],
    phone: ["الهاتف", "Phone", "phone"],
    guardian: [
      "هاتف ولي الأمر",
      "رقم ولي الأمر",
      "Guardian Phone",
      "Parent Phone",
      "guardianPhone",
      "parentPhone",
    ],
    updated: ["آخر تحديث", "Updated At", "updatedAt", "Last Updated"],
    days: ["الأيام", "Days", "days"],
    status: ["الحالة", "Status", "status"],
  };
  const findIndex = (keys) => {
    for (const k of keys) if (oldIndex[k] !== undefined) return oldIndex[k];
    return -1;
  };
  const idx = {
    id: findIndex(aliases.id),
    name: findIndex(aliases.name),
    age: findIndex(aliases.age),
    group: findIndex(aliases.group),
    phone: findIndex(aliases.phone),
    guardian: findIndex(aliases.guardian),
    updated: findIndex(aliases.updated),
    days: findIndex(aliases.days),
    status: findIndex(aliases.status),
  };
  const valueAt = (row, i, def = "") =>
    i >= 0 && row[i] !== undefined && row[i] !== "" ? row[i] : def;
  const migrated = rows.map((row) => [
    valueAt(row, idx.id),
    valueAt(row, idx.name),
    valueAt(row, idx.age),
    valueAt(row, idx.group),
    valueAt(row, idx.phone),
    valueAt(row, idx.guardian),
    valueAt(row, idx.updated),
    valueAt(row, idx.days, "[]"),
    valueAt(row, idx.status, "نشط"),
  ]);
  sh.getRange(1, 1, 1, STUDENT_HEADERS.length).setValues([STUDENT_HEADERS]);
  if (migrated.length)
    sh.getRange(2, 1, migrated.length, STUDENT_HEADERS.length).setValues(
      migrated,
    );
}

function sync_(payload) {
  ensureSyncSheets_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const studentSheet = ss.getSheetByName(SHEETS.STUDENTS);
    const recordSheet = ss.getSheetByName(SHEETS.RECORDS);
    const paymentSheet = ss.getSheetByName(SHEETS.PAYMENTS);
    const wardSheet = ss.getSheetByName(SHEETS.WARDS);
    const students = Array.isArray(payload.students) ? payload.students : [];
    const records = Array.isArray(payload.records) ? payload.records : [];
    const studentMap = readMap_(studentSheet, 1);
    const recordMap = readMap_(recordSheet, 1);
    const paymentMap = readMap_(paymentSheet, 1);
    const wardMap = readMap_(wardSheet, 1);
    const payments = Array.isArray(payload.payments) ? payload.payments : [];
    let studentsChanged = 0,
      recordsChanged = 0,
      paymentsChanged = 0,
      wardsChanged = 0;

    students.forEach((s) => {
      if (!s || !s.id || !s.updatedAt) return;
      const row = studentMap[String(s.id)];
      const statusText = s.archived ? "مؤرشف" : "نشط";
      const values = [
        String(s.id),
        String(s.name || ""),
        s.age == null || s.age === "" ? "" : Number(s.age),
        String(s.group || ""),
        String(s.phone || ""),
        String(s.guardianPhone || s.parentPhone || ""),
        String(s.updatedAt),
        JSON.stringify(Array.isArray(s.days) ? s.days.map(Number) : []),
        statusText,
      ];
      if (row) {
        const oldUpdatedAt = getCellByHeader_(studentSheet, row, "آخر تحديث");
        if (String(oldUpdatedAt || "") < String(s.updatedAt)) {
          writeRowByHeaders_(studentSheet, row, STUDENT_HEADERS, values);
          studentsChanged++;
        }
      } else {
        appendRowByHeaders_(studentSheet, STUDENT_HEADERS, values);
        studentsChanged++;
      }
    });

    records.forEach((r) => {
      if (!r || !r.id || !r.updatedAt || !r.studentId || !r.date) return;
      const row = recordMap[String(r.id)];
      const status =
        String(r.status || "").toLowerCase() === "absent" ||
        String(r.status) === "غائب"
          ? "غائب"
          : "حاضر";
      const values = [
        String(r.id),
        String(r.date),
        String(r.studentId),
        status,
        r.memory == null ? "" : Number(r.memory),
        String(r.updatedAt),
        JSON.stringify(Array.isArray(r.memorizationWards) ? r.memorizationWards : []),
      ];
      if (row) {
        const oldUpdatedAt = getCellByHeader_(recordSheet, row, "آخر تحديث");
        if (String(oldUpdatedAt || "") < String(r.updatedAt)) {
          writeRowByHeaders_(recordSheet, row, RECORD_HEADERS, values);
          recordsChanged++;
        }
      } else {
        appendRowByHeaders_(recordSheet, RECORD_HEADERS, values);
        recordsChanged++;
      }
    });

    records.forEach((r) => {
      if (!r || !r.id || !r.studentId || !r.date) return;
      (Array.isArray(r.memorizationWards) ? r.memorizationWards : []).forEach((w, index) => {
        if (!w) return;
        const wardId = String(w.id || (String(r.id) + "-ward-" + index));
        const row = wardMap[wardId];
        const values = [wardId, String(r.id), String(r.studentId), String(r.date), String(w.type || ""), String(w.surah || ""), Number(w.surahNo || 0), Number(w.from || 0), Number(w.to || 0), Number(w.ayahCount || 0), w.endsSurah === true || String(w.endsSurah) === "TRUE", String(w.rating || ""), String(w.notes || ""), String(r.updatedAt || "")];
        if (row) {
          const oldUpdatedAt = getCellByHeader_(wardSheet, row, "آخر تحديث");
          if (String(oldUpdatedAt || "") < String(r.updatedAt || "")) { writeRowByHeaders_(wardSheet, row, WARD_HEADERS, values); wardsChanged++; }
        } else { appendRowByHeaders_(wardSheet, WARD_HEADERS, values); wardsChanged++; }
      });
    });

    payments.forEach((p) => {
      if (!p || !p.id || !p.updatedAt) return;
      const studentIds =
        Array.isArray(p.studentIds) && p.studentIds.length
          ? p.studentIds.map(String)
          : p.studentId
            ? [String(p.studentId)]
            : [];
      if (!studentIds.length) return;
      const type =
        p.type === "shared" || studentIds.length > 1 ? "shared" : "single";
      const totalAmount =
        p.totalAmount != null && p.totalAmount !== ""
          ? Number(p.totalAmount)
          : Number(p.amount || 0);
      const notes = p.notes != null ? String(p.notes) : String(p.note || "");
      const row = paymentMap[String(p.id)];
      const values = [
        String(p.id),
        String(p.date || ""),
        String(p.period || ""),
        type,
        studentIds.join(","),
        Number.isFinite(totalAmount) ? totalAmount : 0,
        String(p.group || ""),
        notes,
        String(p.updatedAt),
      ];
      if (row) {
        const oldUpdatedAt = getCellByHeader_(paymentSheet, row, "آخر تحديث");
        if (String(oldUpdatedAt || "") < String(p.updatedAt)) {
          writeRowByHeaders_(paymentSheet, row, PAYMENT_HEADERS, values);
          paymentsChanged++;
        }
      } else {
        appendRowByHeaders_(paymentSheet, PAYMENT_HEADERS, values);
        paymentsChanged++;
      }
    });
    rebuildDashboard_();
    try { updateStudentDetails(); } catch (_) {}
    return {
      success: true,
      studentsChanged,
      recordsChanged,
      paymentsChanged,
      wardsChanged,
      serverTime: new Date().toISOString(),
    };
  } finally {
    lock.releaseLock();
  }
}

function clearRecords_() {
  setupSpreadsheet();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SHEETS.RECORDS);
    if (sh && sh.getLastRow() > 1)
      sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
    const wards = ss.getSheetByName(SHEETS.WARDS);
    if (wards && wards.getLastRow() > 1) wards.getRange(2, 1, wards.getLastRow() - 1, wards.getLastColumn()).clearContent();
    const cfg = ss.getSheetByName(SHEETS.CONFIG);
    if (cfg)
      cfg.getRange("D1:E2").setValues([
        ["آخر حذف", "النوع"],
        [new Date().toISOString(), "سجل الحضور"],
      ]);
    rebuildDashboard_();
    const detail = ss.getSheetByName(SHEETS.DETAIL);
    if (detail) {
      detail.getRange("B3").clearContent();
      detail.getRange("B5:B10").clearContent();
      detail.getRange("A14:D1000").clearContent();
      updateDetailSelector_(ss, detail);
    }
    return { success: true, serverTime: new Date().toISOString() };
  } finally {
    lock.releaseLock();
  }
}

function clearAll_() {
  setupSpreadsheet();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    [SHEETS.STUDENTS, SHEETS.RECORDS, SHEETS.PAYMENTS, SHEETS.WARDS].forEach((name) => {
      const sh = ss.getSheetByName(name);
      if (sh && sh.getLastRow() > 1)
        sh.getRange(
          2,
          1,
          sh.getLastRow() - 1,
          sh.getLastColumn(),
        ).clearContent();
    });
    const cfg = ss.getSheetByName(SHEETS.CONFIG);
    if (cfg)
      cfg.getRange("D1:E2").setValues([
        ["آخر حذف", "النوع"],
        [new Date().toISOString(), "كل البيانات"],
      ]);
    rebuildDashboard_();
    const detail = ss.getSheetByName(SHEETS.DETAIL);
    if (detail) {
      detail.getRange("B3").clearContent();
      detail.getRange("B5:B10").clearContent();
      detail.getRange("A14:D1000").clearContent();
      updateDetailSelector_(ss, detail);
    }
    return { success: true, serverTime: new Date().toISOString() };
  } finally {
    lock.releaseLock();
  }
}

function normalizeDate_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) {
    const tz = Session.getScriptTimeZone() || "Africa/Cairo";
    return Utilities.formatDate(v, tz, "yyyy-MM-dd");
  }
  const s = String(v == null ? "" : v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (!s) return "";
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const tz = Session.getScriptTimeZone() || "Africa/Cairo";
    return Utilities.formatDate(d, tz, "yyyy-MM-dd");
  }
  return s;
}

function normalizeTimestamp_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString();
  const s = String(v == null ? "" : v).trim();
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toISOString();
}

function pull_(since) {
  ensureSyncSheets_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const students = rowsToObjects_(
    ss.getSheetByName(SHEETS.STUDENTS),
    STUDENT_HEADERS,
  )
    .filter(
      (x) => !since || normalizeTimestamp_(x["آخر تحديث"]) > String(since),
    )
    .map((x) => ({
      id: String(x["المعرف"]),
      name: String(x["الاسم"] || ""),
      age: x["العمر"] === "" || x["العمر"] == null ? "" : Number(x["العمر"]),
      group: String(x["المجموعة"] || ""),
      phone: String(x["الهاتف"] || ""),
      guardianPhone: String(x["هاتف ولي الأمر"] || ""),
      updatedAt: normalizeTimestamp_(x["آخر تحديث"]),
      days: (function () {
        try {
          const v = JSON.parse(String(x["الأيام"] || "[]"));
          return Array.isArray(v) ? v : [];
        } catch (e) {
          return [];
        }
      })(),
      archived: String(x["الحالة"] || "").trim() === "مؤرشف",
    }));
  const records = rowsToObjects_(
    ss.getSheetByName(SHEETS.RECORDS),
    RECORD_HEADERS,
  )
    .filter(
      (x) => !since || normalizeTimestamp_(x["آخر تحديث"]) > String(since),
    )
    .map((x) => ({
      id: String(x["معرف السجل"]),
      date: normalizeDate_(x["التاريخ"]),
      studentId: String(x["معرف الطالب"]),
      status: String(x["الحالة"] || "") === "غائب" ? "absent" : "present",
      memory:
        x["الحفظ"] === "" || x["الحفظ"] == null ? null : Number(x["الحفظ"]),
      memorizationWards: (function(){try{const v=JSON.parse(String(x["أوراد الحفظ"]||"[]"));return Array.isArray(v)?v:[];}catch(e){return [];}})(),
      updatedAt: normalizeTimestamp_(x["آخر تحديث"]),
    }));
  const payments = rowsToObjects_(
    ss.getSheetByName(SHEETS.PAYMENTS),
    PAYMENT_HEADERS,
  )
    .filter(
      (x) => !since || normalizeTimestamp_(x["آخر تحديث"]) > String(since),
    )
    .map((x) => ({
      id: String(x["معرف الدفعة"]),
      date: normalizeDate_(x["التاريخ"]),
      period: String(x["الفترة"] || ""),
      type: String(x["النوع"] || "single"),
      studentIds: String(x["الطلاب"] || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
      totalAmount: Number(x["المبلغ الإجمالي"] || 0),
      group: String(x["المجموعة"] || ""),
      notes: String(x["ملاحظات"] || ""),
      updatedAt: normalizeTimestamp_(x["آخر تحديث"]),
    }));
  return {
    success: true,
    students,
    records,
    payments,
    serverTime: new Date().toISOString(),
  };
}

function ensureDashboard_(ss) {
  let sh = ss.getSheetByName(SHEETS.DASHBOARD);
  if (!sh) sh = ss.insertSheet(SHEETS.DASHBOARD);
  sh.clear();
  sh.getRange("A1:M1").merge().setValue("📊 لوحة متابعة الطلاب");
  sh.getRange("A1").setFontSize(18).setFontWeight("bold");
  sh.getRange("A2").setValue("تتحدث تلقائيًا من الطلاب والسجلات بعد المزامنة");
  sh.getRange("A4:M4").setValues([
    [
      "المعرف",
      "الطالب",
      "المجموعة",
      "حاضر",
      "غائب",
      "نسبة الحضور",
      "متوسط الحفظ",
      "أعلى حفظ",
      "أقل حفظ",
      "آخر تاريخ",
      "إجمالي الأوراد",
      "حفظ جديد",
      "مراجعة",
    ],
  ]);
  sh.getRange("A4:M4").setFontWeight("bold");
  sh.setFrozenRows(4);
  if (sh.getFilter()) sh.getFilter().remove();
  sh.getRange("A4:M4").createFilter();
}

function rebuildDashboard_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const students = ss.getSheetByName(SHEETS.STUDENTS);
  const records = ss.getSheetByName(SHEETS.RECORDS);
  if (!students || !records) return;
  let dash = ss.getSheetByName(SHEETS.DASHBOARD);
  if (!dash) {
    ensureDashboard_(ss);
    dash = ss.getSheetByName(SHEETS.DASHBOARD);
  }
  if (dash.getFilter()) dash.getFilter().remove();
  if (dash.getMaxRows() > 4)
    dash.getRange(5, 1, dash.getMaxRows() - 4, 13).clearContent();

  const studentRows = rowsToObjects_(students, STUDENT_HEADERS).filter(
    (s) => String(s["الحالة"] || "").trim() !== "مؤرشف",
  );
  const recordRows = rowsToObjects_(records, RECORD_HEADERS);
  const byStudent = {};
  recordRows.forEach((r) => {
    const id = String(r["معرف الطالب"] || "");
    if (!id) return;
    if (!byStudent[id]) byStudent[id] = [];
    byStudent[id].push(r);
  });

  const out = studentRows.map((s) => {
    const id = String(s["المعرف"] || "");
    const rs = byStudent[id] || [];
    const present = rs.filter((r) => statusPresent_(r["الحالة"])).length;
    const absent = rs.filter((r) => statusAbsent_(r["الحالة"])).length;
    const memories = rs.map((r) => Number(r["الحفظ"])).filter((n) => !isNaN(n));
    const avg = memories.length
      ? memories.reduce((a, b) => a + b, 0) / memories.length
      : "";
    const best = memories.length ? Math.max.apply(null, memories) : "";
    const worst = memories.length ? Math.min.apply(null, memories) : "";
    const wards = rs.flatMap(r => { try { const v = JSON.parse(String(r["أوراد الحفظ"] || "[]")); return Array.isArray(v) ? v : []; } catch (_) { return []; } });
    const newWards = wards.filter(w => w.type === "new").length;
    const reviewWards = wards.filter(w => w.type === "review").length;
    const dates = rs
      .map((r) => String(r["التاريخ"] || ""))
      .filter(Boolean)
      .sort();
    const total = present + absent;
    return [
      id,
      String(s["الاسم"] || ""),
      String(s["المجموعة"] || ""),
      present,
      absent,
      total ? present / total : "",
      avg,
      best,
      worst,
      dates.length ? dates[dates.length - 1] : "",
      wards.length,
      newWards,
      reviewWards,
    ];
  });
  if (out.length) dash.getRange(5, 1, out.length, 13).setValues(out);
  if (out.length) {
    dash.getRange(5, 6, out.length, 1).setNumberFormat("0.0%");
    dash.getRange(5, 7, out.length, 3).setNumberFormat("0.##");
  }
  dash.getRange("A4:M4").createFilter();
  dash.autoResizeColumns(1, 13);
  dash.setFrozenRows(4);
}

function ensureDetail_(ss) {
  let sh = ss.getSheetByName(SHEETS.DETAIL);
  if (!sh) sh = ss.insertSheet(SHEETS.DETAIL);
  // هذه ورقة تقرير مشتقة من البيانات وليست مصدرًا للبيانات الأصلية.
  sh.clear();
  sh.setRightToLeft(true);
  sh.getRange("A1:H1").merge().setValue("👤 الملف الشامل للطالب | دار الحافظ");
  sh.getRange("A1:H1").setBackground("#173f35").setFontColor("#ffffff").setFontSize(17).setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle");
  sh.setRowHeight(1, 42);
  sh.getRange("A3").setValue("اختيار الطالب").setFontWeight("bold");
  sh.getRange("B3:D3").merge().setValue("").setBackground("#fff4d6").setFontWeight("bold");
  sh.getRange("E3:H3").merge().setValue("اختر الطالب من القائمة لتحديث الملف والإحصائيات").setFontColor("#587168");

  sh.getRange("A5:D5").merge().setValue("بيانات الطالب");
  sh.getRange("A5:D5").setBackground("#dce9df").setFontWeight("bold");
  sh.getRange("A6:B9").setValues([
    ["الاسم", ""], ["المعرف", ""], ["المجموعة", ""], ["العمر", ""]
  ]);
  sh.getRange("C6:D9").setValues([
    ["الهاتف", ""], ["هاتف ولي الأمر", ""], ["الحالة", ""], ["آخر تحديث", ""]
  ]);
  sh.getRange("A6:A9").setFontWeight("bold");
  sh.getRange("C6:C9").setFontWeight("bold");

  sh.getRange("E5:H5").merge().setValue("ملخص الحضور والحفظ");
  sh.getRange("E5:H5").setBackground("#dce9df").setFontWeight("bold");
  sh.getRange("E6:F9").setValues([
    ["أيام الحضور", ""], ["أيام الغياب", ""], ["نسبة الحضور", ""], ["متوسط درجة الحفظ", ""]
  ]);
  sh.getRange("G6:H9").setValues([
    ["إجمالي الأوراد", ""], ["حفظ جديد", ""], ["مراجعة", ""], ["تثبيت", ""]
  ]);
  sh.getRange("E6:E9").setFontWeight("bold");
  sh.getRange("G6:G9").setFontWeight("bold");

  sh.getRange("A11:H11").merge().setValue("📖 تقدم الحفظ والتسميع");
  sh.getRange("A11:H11").setBackground("#173f35").setFontColor("#ffffff").setFontWeight("bold");
  sh.getRange("A12:H12").setValues([["متوسط تقييم الأوراد", "", "السور المختلفة", "", "آخر ورد", "", "المدفوعات المسجلة", ""]]);
  sh.getRange("A12:H12").setFontWeight("bold").setBackground("#f5f0e4");
  sh.getRange("A14:H14").merge().setValue("🗓️ السجل التفصيلي — الحضور وكل ورد في صف مستقل");
  sh.getRange("A14:H14").setBackground("#173f35").setFontColor("#ffffff").setFontWeight("bold");
  sh.getRange("A15:H15").setValues([["التاريخ", "النوع", "السورة / الحالة", "من آية", "إلى آية", "التقييم", "النسبة", "الملاحظات / آخر تحديث"]]);
  sh.getRange("A15:H15").setFontWeight("bold").setBackground("#dce9df").setWrap(true);
  sh.setFrozenRows(15);
  if (sh.getFilter()) sh.getFilter().remove();
  sh.getRange("A15:H15").createFilter();
  sh.getRange("A16:H2000").clearContent();
  updateDetailSelector_(ss, sh);
  sh.setColumnWidths(1, 8, 135);
  sh.setColumnWidth(3, 180);
  sh.setColumnWidth(8, 240);
  sh.getRange("A1:H2000").setVerticalAlignment("middle");
  sh.getRange("A16:H2000").setWrap(true);
}
function updateDetailSelector_(ss, sh) {
  const students = rowsToObjects_(
    ss.getSheetByName(SHEETS.STUDENTS),
    STUDENT_HEADERS,
  );
  const choices = students
    .map((s) => {
      const id = String(s["المعرف"] || "").trim();
      const name = String(s["الاسم"] || "").trim();
      return id && name ? `${id} — ${name}` : id || name;
    })
    .filter(Boolean);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(choices.length ? choices : [""], true)
    .setAllowInvalid(true)
    .build();
  sh.getRange("B3").setDataValidation(rule);
  sh.getRange("B3").setNote(
    "يمكن اختيار الطالب أو كتابة الـID أو الاسم ثم الضغط Enter.",
  );
}

function resolveDetailStudent_(value, students) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const idPart = raw.split("—")[0].trim();
  return (
    students.find((x) => String(x["المعرف"] || "").trim() === idPart) ||
    students.find((x) => String(x["الاسم"] || "").trim() === raw) ||
    students.find(
      (x) =>
        String(x["الاسم"] || "")
          .trim()
          .toLowerCase() === raw.toLowerCase(),
    ) ||
    null
  );
}

function updateStudentDetails(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEETS.DETAIL);
  if (!sh) return;
  const studentsSheet = ss.getSheetByName(SHEETS.STUDENTS);
  const recordsSheet = ss.getSheetByName(SHEETS.RECORDS);
  if (!studentsSheet || !recordsSheet) return;
  const students = rowsToObjects_(studentsSheet, STUDENT_HEADERS);
  const selectedValue = sh.getRange("B3").getValue();
  const s = resolveDetailStudent_(selectedValue, students);
  // امسح نواتج التقرير فقط؛ لا نلمس أوراق الطلاب أو السجلات الأصلية.
  sh.getRange("B6:B9").clearContent();
  sh.getRange("D6:D9").clearContent();
  sh.getRange("F6:F9").clearContent();
  sh.getRange("H6:H9").clearContent();
  ["B12", "D12", "F12", "H12"].forEach(a1 => sh.getRange(a1).clearContent());
  const lastRow = Math.max(sh.getLastRow(), 16);
  if (lastRow >= 16) sh.getRange(16, 1, lastRow - 15, 8).clearContent();
  if (!s) return;

  const id = String(s["المعرف"] || "");
  const name = String(s["الاسم"] || "");
  const records = rowsToObjects_(recordsSheet, RECORD_HEADERS).filter(x => String(x["معرف الطالب"] || "") === id);
  const presentRecords = records.filter(r => statusPresent_(r["الحالة"]));
  const absentRecords = records.filter(r => statusAbsent_(r["الحالة"]));
  const totalAttendance = presentRecords.length + absentRecords.length;
  const manualScores = records.map(r => Number(r["الحفظ"])).filter(n => Number.isFinite(n) && n >= 0 && n <= 100);
  const allWards = [];
  records.forEach(r => {
    let wards = [];
    try { wards = JSON.parse(String(r["أوراد الحفظ"] || "[]")); } catch (_) { wards = []; }
    if (!Array.isArray(wards)) return;
    wards.forEach(w => allWards.push({ ward: w || {}, record: r }));
  });
  const scoreMap = { "ممتاز":100, "جيد جدًا":90, "جيد جدا":90, "جيد":80, "مقبول":70, "يحتاج مراجعة":60, "ضعيف":50 };
  const wardScore = item => {
    const w = item.ward;
    const n = Number(w.score != null ? w.score : w.percentage);
    if (Number.isFinite(n) && n >= 0 && n <= 100) return n;
    const label = String(w.rating || w.grade || "").replace(/\s*\([^)]*\)\s*/g, "").trim();
    return Object.prototype.hasOwnProperty.call(scoreMap, label) ? scoreMap[label] : null;
  };
  const rated = allWards.map(wardScore).filter(n => n !== null);
  const avgWard = rated.length ? rated.reduce((a,b)=>a+b,0)/rated.length : "";
  const avgManual = manualScores.length ? manualScores.reduce((a,b)=>a+b,0)/manualScores.length : "";
  const typeOf = w => {
    const raw = String(w.type || "").toLowerCase();
    if (["new", "new-hifz", "حفظ جديد", "جديد"].includes(raw)) return "حفظ جديد";
    if (["review", "past", "ماضي", "ماضٍ", "مراجعة"].includes(raw)) return "مراجعة";
    if ([" تثبيت", "ثبات", " تثبيت ", " تثبيت "].includes(raw) || raw.includes("ثبيت") || raw === " تثبيت") return "تثبيت";
    return String(w.type || "ورد");
  };
  const newCount = allWards.filter(x => typeOf(x.ward) === "حفظ جديد").length;
  const reviewCount = allWards.filter(x => typeOf(x.ward) === "مراجعة").length;
  const تثبيتCount = allWards.filter(x => typeOf(x.ward) === "تثبيت").length;
  const surahs = [...new Set(allWards.map(x => String(x.ward.surah || "").trim()).filter(Boolean))];

  sh.getRange("B3").setValue(`${id} — ${name}`);
  sh.getRange("B6:B9").setValues([[name],[id],[String(s["المجموعة"] || "")],[s["العمر"] || ""]]);
  sh.getRange("D6:D9").setValues([[String(s["الهاتف"] || "")],[String(s["هاتف ولي الأمر"] || "")],[String(s["الحالة"] || "نشط")],[String(s["آخر تحديث"] || "")]]);
  sh.getRange("F6:F9").setValues([[presentRecords.length],[absentRecords.length],[totalAttendance ? presentRecords.length/totalAttendance : ""],[avgManual]]);
  sh.getRange("H6:H9").setValues([[allWards.length],[newCount],[reviewCount],[تثبيتCount]]);
  sh.getRange("F8").setNumberFormat("0.0%");
  sh.getRange("F9").setNumberFormat("0.0");
  sh.getRange("B12").setValue(avgWard === "" ? "" : avgWard/100).setNumberFormat("0.0%");
  sh.getRange("D12").setValue(surahs.length);
  const latestWard = allWards.slice().sort((a,b)=>String(b.record["التاريخ"]||"").localeCompare(String(a.record["التاريخ"]||"")))[0];
  sh.getRange("F12").setValue(latestWard ? `${latestWard.ward.surah || ""} ${latestWard.ward.from || ""}${latestWard.ward.to ? "–"+latestWard.ward.to : ""}`.trim() : "—");

  // إجمالي المدفوعات يُحسب فقط من صفوف الدفعات التي تذكر معرف الطالب أو اسمه.
  const paymentsSheet = ss.getSheetByName(SHEETS.PAYMENTS);
  let paidTotal = 0;
  if (paymentsSheet && paymentsSheet.getLastRow() > 1) {
    const paymentRows = rowsToObjects_(paymentsSheet, PAYMENT_HEADERS);
    paymentRows.forEach(p => {
      const who = String(p["الطلاب"] || "");
      if (who.includes(id) || (name && who.includes(name))) paidTotal += Number(p["المبلغ الإجمالي"] || 0) || 0;
    });
  }
  sh.getRange("H12").setValue(paidTotal).setNumberFormat("#,##0.00");

  const timeline = [];
  records.forEach(r => {
    const date = String(r["التاريخ"] || "");
    timeline.push([date, "حضور", statusPresent_(r["الحالة"]) ? "حاضر" : statusAbsent_(r["الحالة"]) ? "غائب" : String(r["الحالة"] || "—"), "", "", r["الحفظ"] === "" ? "" : r["الحفظ"], (r["الحفظ"] === "" || r["الحفظ"] == null) ? "" : Number(r["الحفظ"])/100, String(r["آخر تحديث"] || "")]);
    let wards = [];
    try { wards = JSON.parse(String(r["أوراد الحفظ"] || "[]")); } catch (_) { wards = []; }
    if (!Array.isArray(wards)) return;
    wards.forEach(w => {
      const score = wardScore({ward:w, record:r});
      timeline.push([
        date,
        typeOf(w),
        String(w.surah || "—"),
        w.from == null ? "" : w.from,
        w.to == null ? "" : w.to,
        String(w.rating || w.grade || ""),
        score === null ? "" : score/100,
        [String(w.endsSurah ? "نهاية السورة" : ""), String(w.notes || "")].filter(Boolean).join(" — ")
      ]);
    });
  });
  timeline.sort((a,b)=>String(b[0]).localeCompare(String(a[0])) || String(a[1]).localeCompare(String(b[1])));
  if (timeline.length) sh.getRange(16, 1, timeline.length, 8).setValues(timeline);
  if (timeline.length) {
    sh.getRange(16, 7, timeline.length, 1).setNumberFormat("0.0%");
    sh.getBandings().forEach(b => b.remove());
    sh.getRange(15, 1, timeline.length + 1, 8).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
  }
  updateDetailSelector_(ss, sh);
}
function onEdit(e) {
  if (
    e &&
    e.range &&
    e.range.getSheet().getName() === SHEETS.DETAIL &&
    e.range.getA1Notation() === "B3"
  ) {
    updateStudentDetails(e);
  }
}

function formatBaseSheets_(ss) {
  [SHEETS.STUDENTS, SHEETS.RECORDS, SHEETS.PAYMENTS].forEach((name) => {
    const sh = ss.getSheetByName(name);
    sh.setFrozenRows(1);
    const lastCol = sh.getLastColumn();
    if (lastCol) sh.getRange(1, 1, 1, lastCol).setFontWeight("bold");
    sh.autoResizeColumns(1, lastCol);
  });
}
function readMap_(sheet, keyCol) {
  const out = {};
  const n = sheet.getLastRow();
  if (n < 2) return out;
  const vals = sheet.getRange(2, keyCol, n - 1, 1).getValues();
  vals.forEach((r, i) => {
    if (r[0] !== "") out[String(r[0])] = i + 2;
  });
  return out;
}
// Read by the actual header names, not assumed column positions. This keeps
// older sheets compatible when new columns were appended during migration.
function headerMap_(sheet) {
  const width = Math.max(sheet.getLastColumn(), 1);
  const names = sheet.getRange(1, 1, 1, width).getDisplayValues()[0];
  const out = {};
  names.forEach((name, i) => {
    const key = String(name || "").trim();
    if (key && out[key] == null) out[key] = i + 1;
  });
  return out;
}
function getCellByHeader_(sheet, row, header) {
  const col = headerMap_(sheet)[header];
  return col ? sheet.getRange(row, col).getValue() : "";
}
function writeRowByHeaders_(sheet, row, headers, values) {
  const map = headerMap_(sheet);
  headers.forEach((header, i) => {
    const col = map[header];
    if (col) sheet.getRange(row, col).setValue(values[i]);
  });
}
function appendRowByHeaders_(sheet, headers, values) {
  const row = Math.max(sheet.getLastRow() + 1, 2);
  writeRowByHeaders_(sheet, row, headers, values);
}
function rowsToObjects_(sheet, headers) {
  const n = sheet.getLastRow();
  if (n < 2) return [];
  const width = Math.max(sheet.getLastColumn(), 1);
  const actualHeaders = sheet.getRange(1, 1, 1, width).getDisplayValues()[0].map(v => String(v || "").trim());
  const values = sheet.getRange(2, 1, n - 1, width).getValues();
  return values.map(row => {
    const o = {};
    actualHeaders.forEach((h, i) => { if (h) o[h] = row[i]; });
    // Preserve expected keys even if an old/malformed sheet is missing a header.
    headers.forEach(h => { if (!(h in o)) o[h] = ""; });
    return o;
  });
}
function statusPresent_(v) {
  return (
    String(v || "").toLowerCase() === "present" || String(v || "") === "حاضر"
  );
}
function statusAbsent_(v) {
  return (
    String(v || "").toLowerCase() === "absent" || String(v || "") === "غائب"
  );
}
function decodePayload_(s) {
  if (!s) return {};
  const bytes = Utilities.base64DecodeWebSafe(s);
  return JSON.parse(Utilities.newBlob(bytes).getDataAsString("UTF-8"));
}
function json_(obj, callback) {
  const body = JSON.stringify(obj);
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback))
    return ContentService.createTextOutput(
      callback + "(" + body + ");",
    ).setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(body).setMimeType(
    ContentService.MimeType.JSON,
  );
}
