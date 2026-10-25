// نظام حضور وحفظ — دار الحافظ (الإصدار 2.5.0)
// مزامنة فائقة السرعة (دفعات مجمّعة في الذاكرة) + فصل إعداد وتنسيق الجداول ليكون يدوياً عند الحاجة فقط.
// شغّل setupSpreadsheet() مرة واحدة بعد لصق الكود (أو من قائمة "🕌 دار الحافظ" داخل الشيت)، ثم انشر Web App.

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
  PAYMENTS: "Payments",
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
  "المصروف الشهري",
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
const WARD_HEADERS = [
  "معرف الورد",
  "معرف السجل",
  "معرف الطالب",
  "التاريخ",
  "النوع",
  "السورة",
  "رقم السورة",
  "من آية",
  "إلى آية",
  "عدد آيات السورة",
  "نهاية السورة",
  "التقييم",
  "ملاحظات",
  "آخر تحديث",
];
const CONFIG_HEADERS = ["المفتاح", "القيمة"];
const PAYMENT_HEADERS = [
  "معرف الدفعة",
  "رقم الدفعة",
  "التاريخ",
  "الفترة",
  "النوع",
  "الطلاب",
  "المبلغ الإجمالي",
  "نصيب الفرد",
  "المجموعة",
  "ملاحظات",
  "آخر تحديث",
];

// قائمة يدوية داخل Google Sheets لتشغيل إعداد الصفحات وتحديث التقارير يدوياً بدون إبطاء المزامنة
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu("🕌 دار الحافظ")
      .addItem("⚙️ إعداد وتنسيق جميع الصفحات (يدوي)", "setupSpreadsheet")
      .addItem("📊 تحديث لوحة التحكم وتفاصيل الطالب", "refreshReportsManual")
      .addItem("👤 تحديث ملف الطالب المختار حالياً", "updateStudentDetails")
      .addToUi();
  } catch (_) {}
}

function refreshReportsManual() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  rebuildDashboard_();
  try {
    const detail = ss.getSheetByName(SHEETS.DETAIL);
    if (detail) updateDetailSelector_(ss, detail);
    updateStudentDetails();
  } catch (_) {}
  return { success: true, message: "تم تحديث لوحة التحكم وتفاصيل الطالب بنجاح" };
}

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || "ping");
    const cb = e && e.parameter ? e.parameter.callback : "";
    if (action === "ping")
      return json_({ success: true, serverTime: new Date().toISOString() }, cb);
    if (action === "sync")
      return json_(sync_(decodePayload_(e.parameter.payload || "")), cb);
    if (action === "pull")
      return json_(pull_(e.parameter.since || ""), cb);
    if (action === "fullPull")
      return json_(pull_(""), cb);
    if (action === "setupSheets") {
      setupSpreadsheet();
      return json_({ success: true, serverTime: new Date().toISOString() }, cb);
    }
    if (action === "refreshReports") {
      refreshReportsManual();
      return json_({ success: true, serverTime: new Date().toISOString() }, cb);
    }
    if (action === "clearRecords")
      return json_(clearRecords_(), cb);
    if (action === "clearPayments")
      return json_(clearPayments_(), cb);
    if (action === "clearWards")
      return json_(clearWards_(), cb);
    if (action === "clearAll")
      return json_(clearAll_(), cb);
    return json_({ success: false, message: "إجراء غير معروف" }, cb);
  } catch (err) {
    return json_(
      { success: false, message: String((err && err.message) || err) },
      e && e.parameter ? e.parameter.callback : "",
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
    else if (action === "setupSheets") {
      setupSpreadsheet();
      result = { success: true, serverTime: new Date().toISOString() };
    } else if (action === "refreshReports") {
      refreshReportsManual();
      result = { success: true, serverTime: new Date().toISOString() };
    } else if (action === "clearRecords") result = clearRecords_();
    else if (action === "clearPayments") result = clearPayments_();
    else if (action === "clearWards") result = clearWards_();
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

// فحص خفيف جداً أثناء المزامنة: يتأكد فقط من وجود شيتات البيانات الأساسية وعناوينها
// دون أي عمليات تنسيق أو إعادة بناء للوحة التحكم أو تفاصيل الطالب.
function ensureSyncSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const required = [
    [SHEETS.STUDENTS, STUDENT_HEADERS],
    [SHEETS.RECORDS, RECORD_HEADERS],
    [SHEETS.PAYMENTS, PAYMENT_HEADERS],
    [SHEETS.WARDS, WARD_HEADERS],
  ];
  required.forEach(([name, headers]) => {
    let sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.setFrozenRows(1);
      return;
    }
    const lastRow = sh.getLastRow();
    if (lastRow === 0) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.setFrozenRows(1);
      return;
    }
    const width = Math.max(sh.getLastColumn(), 1);
    const existing = sh
      .getRange(1, 1, 1, width)
      .getDisplayValues()[0]
      .map((v) => String(v || "").trim());
    const missing = headers.filter((h) => existing.indexOf(h) === -1);
    if (missing.length) {
      sh.getRange(1, width + 1, 1, missing.length).setValues([missing]);
    }
  });
}

// الإعداد الكامل والترحيل والتنسيق — يُشغّل يدوياً فقط عند أول مرة أو عند طلب المستخدم
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
    config.getRange(2, 1, 1, 2).setValues([["التطبيق", "دار الحافظ"]]);
  try {
    config.hideSheet();
  } catch (_) {}
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
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sh;
  }
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sh;
  }
  const width = Math.max(sh.getLastColumn(), 1);
  const existing = sh
    .getRange(1, 1, 1, width)
    .getDisplayValues()[0]
    .map((v) => String(v || "").trim());
  const missing = headers.filter((h) => existing.indexOf(h) === -1);
  if (missing.length) {
    sh.getRange(1, width + 1, 1, missing.length).setValues([missing]);
  }
  return sh;
}

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

  if (hasExpectedNewHeaders) return;

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
    fee: ["المصروف الشهري", "Monthly Fee", "monthlyFee"],
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
    fee: findIndex(aliases.fee),
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
    valueAt(row, idx.fee, ""),
  ]);
  sh.getRange(1, 1, 1, STUDENT_HEADERS.length).setValues([STUDENT_HEADERS]);
  if (migrated.length)
    sh.getRange(2, 1, migrated.length, STUDENT_HEADERS.length).setValues(
      migrated,
    );
}

// قراءة الجدول بالكامل في الذاكرة لسرعة التحديث والكتابة دفعة واحدة
function readSheetDataInMemory_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  if (lastRow < 1) {
    return { headers: [], colMap: {}, rows: [], idToRowIdx: {} };
  }
  const allValues = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = allValues[0].map((h) => String(h || "").trim());
  const colMap = {};
  headers.forEach((h, idx) => {
    if (h && colMap[h] === undefined) colMap[h] = idx;
  });
  const rows = allValues.slice(1);
  const idToRowIdx = {};
  rows.forEach((r, idx) => {
    const idVal = String(r[0] == null ? "" : r[0]).trim();
    if (idVal) idToRowIdx[idVal] = idx;
  });
  return { headers, colMap, rows, idToRowIdx, lastCol };
}

function writeRowToMemory_(mem, rowIdx, headerValueMap) {
  const row = mem.rows[rowIdx];
  Object.keys(headerValueMap).forEach((h) => {
    const cIdx = mem.colMap[h];
    if (cIdx !== undefined) {
      row[cIdx] = headerValueMap[h];
    }
  });
}

function buildNewRowForMemory_(mem, headerValueMap) {
  const row = new Array(mem.lastCol).fill("");
  Object.keys(headerValueMap).forEach((h) => {
    const cIdx = mem.colMap[h];
    if (cIdx !== undefined) {
      row[cIdx] = headerValueMap[h];
    }
  });
  return row;
}

function flushMemoryToSheet_(sheet, mem, hadDeletions, dirtyExisting, appendedRows) {
  if (hadDeletions) {
    const oldDataRows = Math.max(0, sheet.getLastRow() - 1);
    if (oldDataRows > 0) {
      sheet.getRange(2, 1, oldDataRows, mem.lastCol).clearContent();
    }
    const finalRows = mem.rows.concat(appendedRows);
    if (finalRows.length > 0) {
      sheet.getRange(2, 1, finalRows.length, mem.lastCol).setValues(finalRows);
    }
    return;
  }
  if (dirtyExisting && mem.rows.length > 0) {
    sheet.getRange(2, 1, mem.rows.length, mem.lastCol).setValues(mem.rows);
  }
  if (appendedRows.length > 0) {
    const startRow = mem.rows.length + 2;
    sheet.getRange(startRow, 1, appendedRows.length, mem.lastCol).setValues(appendedRows);
  }
}

// مزامنة فائقة السرعة: تضيف وتحدث وتحذف البيانات في الشيتات الأساسية مباشرة دفعة واحدة
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
    const payments = Array.isArray(payload.payments) ? payload.payments : [];
    const deletedRecords = Array.isArray(payload.deletedRecords)
      ? payload.deletedRecords.map(String)
      : [];
    const deletedPayments = Array.isArray(payload.deletedPayments)
      ? payload.deletedPayments.map(String)
      : [];
    const deletedWards = Array.isArray(payload.deletedWards)
      ? payload.deletedWards.map(String)
      : [];

    let studentsChanged = 0,
      recordsChanged = 0,
      paymentsChanged = 0,
      wardsChanged = 0;

    // 1. مزامنة الطلاب في الذاكرة
    if (students.length > 0) {
      const sMem = readSheetDataInMemory_(studentSheet);
      let sDirty = false;
      const sAppended = [];
      const updCol = sMem.colMap["آخر تحديث"];
      const feeCol = sMem.colMap["المصروف الشهري"];

      students.forEach((s) => {
        if (!s || !s.id || !s.updatedAt) return;
        const id = String(s.id);
        const rIdx = sMem.idToRowIdx[id];
        const statusText = s.archived ? "مؤرشف" : "نشط";
        const existingFee =
          rIdx !== undefined && feeCol !== undefined ? sMem.rows[rIdx][feeCol] : "";
        const feeValue =
          s.monthlyFee !== undefined && s.monthlyFee !== null && s.monthlyFee !== ""
            ? Number(s.monthlyFee)
            : existingFee !== "" && existingFee != null
              ? Number(existingFee)
              : "";
        const rowObj = {
          "المعرف": id,
          "الاسم": String(s.name || ""),
          "العمر": s.age == null || s.age === "" ? "" : Number(s.age),
          "المجموعة": String(s.group || ""),
          "الهاتف": String(s.phone || ""),
          "هاتف ولي الأمر": String(s.guardianPhone || s.parentPhone || ""),
          "آخر تحديث": String(s.updatedAt),
          "الأيام": JSON.stringify(Array.isArray(s.days) ? s.days.map(Number) : []),
          "الحالة": statusText,
          "المصروف الشهري": feeValue,
        };
        if (rIdx !== undefined) {
          const oldUpd = updCol !== undefined ? sMem.rows[rIdx][updCol] : "";
          if (isIncomingNewer_(oldUpd, s.updatedAt)) {
            writeRowToMemory_(sMem, rIdx, rowObj);
            sDirty = true;
            studentsChanged++;
          }
        } else {
          const newRow = buildNewRowForMemory_(sMem, rowObj);
          sMem.idToRowIdx[id] = sMem.rows.length + sAppended.length;
          sAppended.push(newRow);
          studentsChanged++;
        }
      });
      flushMemoryToSheet_(studentSheet, sMem, false, sDirty, sAppended);
    }

    // 2. مزامنة السجلات وحذف السجلات الملغاة
    if (records.length > 0 || deletedRecords.length > 0) {
      const rMem = readSheetDataInMemory_(recordSheet);
      let rDirty = false;
      let rHadDeletions = false;
      const rAppended = [];
      const updCol = rMem.colMap["آخر تحديث"];

      if (deletedRecords.length > 0) {
        const delSet = {};
        deletedRecords.forEach((id) => (delSet[String(id)] = true));
        const beforeLen = rMem.rows.length;
        rMem.rows = rMem.rows.filter(
          (row) => !delSet[String(row[0] == null ? "" : row[0]).trim()],
        );
        if (rMem.rows.length !== beforeLen) {
          rHadDeletions = true;
          rMem.idToRowIdx = {};
          rMem.rows.forEach((r, idx) => {
            const k = String(r[0] == null ? "" : r[0]).trim();
            if (k) rMem.idToRowIdx[k] = idx;
          });
        }
      }

      records.forEach((r) => {
        if (!r || !r.id || !r.updatedAt || !r.studentId || !r.date) return;
        const id = String(r.id);
        const rIdx = rMem.idToRowIdx[id];
        const status =
          String(r.status || "").toLowerCase() === "absent" ||
          String(r.status) === "غائب"
            ? "غائب"
            : "حاضر";
        const rowObj = {
          "معرف السجل": id,
          "التاريخ": String(r.date),
          "معرف الطالب": String(r.studentId),
          "الحالة": status,
          "الحفظ": r.memory == null || r.memory === "" ? "" : Number(r.memory),
          "آخر تحديث": String(r.updatedAt),
          "أوراد الحفظ": JSON.stringify(
            Array.isArray(r.memorizationWards) ? r.memorizationWards : [],
          ),
        };
        if (rIdx !== undefined) {
          const oldUpd = updCol !== undefined ? rMem.rows[rIdx][updCol] : "";
          if (isIncomingNewer_(oldUpd, r.updatedAt)) {
            writeRowToMemory_(rMem, rIdx, rowObj);
            rDirty = true;
            recordsChanged++;
          }
        } else {
          const newRow = buildNewRowForMemory_(rMem, rowObj);
          rMem.idToRowIdx[id] = rMem.rows.length + rAppended.length;
          rAppended.push(newRow);
          recordsChanged++;
        }
      });
      flushMemoryToSheet_(recordSheet, rMem, rHadDeletions, rDirty, rAppended);
    }

    // 3. مزامنة أوراد الحفظ وتنظيف الأوراد المحذوفة تلقائياً
    if (records.length > 0 || deletedRecords.length > 0 || deletedWards.length > 0) {
      const wMem = readSheetDataInMemory_(wardSheet);
      let wDirty = false;
      let wHadDeletions = false;
      const wAppended = [];
      const recIdCol = wMem.colMap["معرف السجل"] !== undefined ? wMem.colMap["معرف السجل"] : 1;
      const updCol = wMem.colMap["آخر تحديث"];

      // بناء خريطة بالأوراد النشطة لكل سجل مرسل، وحذف أي ورد يتيم حُذف من السجل
      const syncedRecordAllowedWards = {};
      records.forEach((r) => {
        if (!r || !r.id) return;
        const allowed = {};
        (Array.isArray(r.memorizationWards) ? r.memorizationWards : []).forEach(
          (w, index) => {
            if (!w) return;
            const wardId = String(w.id || String(r.id) + "-ward-" + index);
            allowed[wardId] = true;
          },
        );
        syncedRecordAllowedWards[String(r.id)] = allowed;
      });
      const delRecSet = {};
      deletedRecords.forEach((id) => (delRecSet[String(id)] = true));
      const delWardSet = {};
      deletedWards.forEach((id) => (delWardSet[String(id)] = true));

      const beforeWLen = wMem.rows.length;
      wMem.rows = wMem.rows.filter((row) => {
        const wId = String(row[0] == null ? "" : row[0]).trim();
        const rId = String(row[recIdCol] == null ? "" : row[recIdCol]).trim();
        if (delWardSet[wId] || delRecSet[rId]) return false;
        if (syncedRecordAllowedWards[rId] !== undefined) {
          return Boolean(syncedRecordAllowedWards[rId][wId]);
        }
        return true;
      });
      if (wMem.rows.length !== beforeWLen) {
        wHadDeletions = true;
        wMem.idToRowIdx = {};
        wMem.rows.forEach((r, idx) => {
          const k = String(r[0] == null ? "" : r[0]).trim();
          if (k) wMem.idToRowIdx[k] = idx;
        });
      }

      records.forEach((r) => {
        if (!r || !r.id || !r.studentId || !r.date) return;
        (Array.isArray(r.memorizationWards) ? r.memorizationWards : []).forEach(
          (w, index) => {
            if (!w) return;
            const wardId = String(w.id || String(r.id) + "-ward-" + index);
            const rIdx = wMem.idToRowIdx[wardId];
            const rowObj = {
              "معرف الورد": wardId,
              "معرف السجل": String(r.id),
              "معرف الطالب": String(r.studentId),
              "التاريخ": String(r.date),
              "النوع": String(w.type || ""),
              "السورة": String(w.surah || ""),
              "رقم السورة": Number(w.surahNo || 0),
              "من آية": Number(w.from || w.fromAyah || 0),
              "إلى آية": Number(w.to || w.toAyah || 0),
              "عدد آيات السورة": Number(w.ayahCount || 0),
              "نهاية السورة": w.endsSurah === true || String(w.endsSurah) === "TRUE",
              "التقييم": String(w.rating || ""),
              "ملاحظات": String(w.notes || ""),
              "آخر تحديث": String(r.updatedAt || ""),
            };
            if (rIdx !== undefined) {
              const oldUpd = updCol !== undefined ? wMem.rows[rIdx][updCol] : "";
              if (isIncomingNewer_(oldUpd, r.updatedAt)) {
                writeRowToMemory_(wMem, rIdx, rowObj);
                wDirty = true;
                wardsChanged++;
              }
            } else {
              const newRow = buildNewRowForMemory_(wMem, rowObj);
              wMem.idToRowIdx[wardId] = wMem.rows.length + wAppended.length;
              wAppended.push(newRow);
              wardsChanged++;
            }
          },
        );
      });
      flushMemoryToSheet_(wardSheet, wMem, wHadDeletions, wDirty, wAppended);
    }

    // 4. مزامنة المدفوعات (مع دعم رقم الدفعة المشتركة ونصيب الفرد وحذف الدفعات الملغاة)
    if (payments.length > 0 || deletedPayments.length > 0) {
      const pMem = readSheetDataInMemory_(paymentSheet);
      let pDirty = false;
      let pHadDeletions = false;
      const pAppended = [];
      const updCol = pMem.colMap["آخر تحديث"];

      if (deletedPayments.length > 0) {
        const delSet = {};
        deletedPayments.forEach((id) => (delSet[String(id)] = true));
        const beforeLen = pMem.rows.length;
        pMem.rows = pMem.rows.filter(
          (row) => !delSet[String(row[0] == null ? "" : row[0]).trim()],
        );
        if (pMem.rows.length !== beforeLen) {
          pHadDeletions = true;
          pMem.idToRowIdx = {};
          pMem.rows.forEach((r, idx) => {
            const k = String(r[0] == null ? "" : r[0]).trim();
            if (k) pMem.idToRowIdx[k] = idx;
          });
        }
      }

      payments.forEach((p) => {
        if (!p || !p.id || !p.updatedAt) return;
        const studentIds =
          Array.isArray(p.studentIds) && p.studentIds.length
            ? p.studentIds.map(String)
            : p.studentId
              ? [String(p.studentId)]
              : [];
        if (!studentIds.length) return;
        const isShared = p.type === "shared" || studentIds.length > 1;
        const type = isShared ? "shared" : "single";
        const totalAmount =
          p.totalAmount != null && p.totalAmount !== ""
            ? Number(p.totalAmount)
            : Number(p.amount || 0);
        const safeTotal = Number.isFinite(totalAmount) ? totalAmount : 0;
        const shareAmount =
          studentIds.length > 0
            ? Math.round((safeTotal / studentIds.length) * 100) / 100
            : safeTotal;
        const paymentCode = String(
          p.paymentCode ||
            (isShared
              ? "SH-" + String(p.id).replace(/[^0-9A-Za-z]/g, "").slice(0, 6).toUpperCase()
              : ""),
        ).trim();
        const notes = p.notes != null ? String(p.notes) : String(p.note || "");
        const id = String(p.id);
        const rIdx = pMem.idToRowIdx[id];
        const rowObj = {
          "معرف الدفعة": id,
          "رقم الدفعة": paymentCode,
          "التاريخ": String(p.date || ""),
          "الفترة": String(p.period || ""),
          "النوع": type,
          "الطلاب": studentIds.join(","),
          "المبلغ الإجمالي": safeTotal,
          "نصيب الفرد": shareAmount,
          "المجموعة": String(p.group || ""),
          "ملاحظات": notes,
          "آخر تحديث": String(p.updatedAt),
        };
        if (rIdx !== undefined) {
          const oldUpd = updCol !== undefined ? pMem.rows[rIdx][updCol] : "";
          if (isIncomingNewer_(oldUpd, p.updatedAt)) {
            writeRowToMemory_(pMem, rIdx, rowObj);
            pDirty = true;
            paymentsChanged++;
          }
        } else {
          const newRow = buildNewRowForMemory_(pMem, rowObj);
          pMem.idToRowIdx[id] = pMem.rows.length + pAppended.length;
          pAppended.push(newRow);
          paymentsChanged++;
        }
      });
      flushMemoryToSheet_(paymentSheet, pMem, pHadDeletions, pDirty, pAppended);
    }

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

// حذف سجل الحضور فقط (مع الحفاظ على بيانات الطلاب الأساسية والمدفوعات والأوراد المستقلة)
function clearRecords_() {
  ensureSyncSheets_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SHEETS.RECORDS);
    if (sh && sh.getLastRow() > 1)
      sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
    const cfg = ss.getSheetByName(SHEETS.CONFIG);
    if (cfg)
      cfg.getRange("D1:E2").setValues([
        ["آخر حذف", "النوع"],
        [new Date().toISOString(), "سجل الحضور فقط"],
      ]);
    return { success: true, serverTime: new Date().toISOString() };
  } finally {
    lock.releaseLock();
  }
}

// حذف المدفوعات فقط (مع الحفاظ على بيانات الطلاب الأساسية والسجلات والأوراد)
function clearPayments_() {
  ensureSyncSheets_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SHEETS.PAYMENTS);
    if (sh && sh.getLastRow() > 1)
      sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
    const cfg = ss.getSheetByName(SHEETS.CONFIG);
    if (cfg)
      cfg.getRange("D1:E2").setValues([
        ["آخر حذف", "النوع"],
        [new Date().toISOString(), "سجل المدفوعات فقط"],
      ]);
    return { success: true, serverTime: new Date().toISOString() };
  } finally {
    lock.releaseLock();
  }
}

// حذف الأوراد فقط (مع الحفاظ على بيانات الطلاب الأساسية وحضورهم ومدفوعاتهم)
function clearWards_() {
  ensureSyncSheets_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const wards = ss.getSheetByName(SHEETS.WARDS);
    if (wards && wards.getLastRow() > 1)
      wards.getRange(2, 1, wards.getLastRow() - 1, wards.getLastColumn()).clearContent();

    // تفريغ عمود أوراد الحفظ داخل شيت السجلات مع الإبقاء على سجلات الحضور والغياب
    const recSheet = ss.getSheetByName(SHEETS.RECORDS);
    if (recSheet && recSheet.getLastRow() > 1) {
      const hMap = headerMap_(recSheet);
      const wardsCol = hMap["أوراد الحفظ"];
      if (wardsCol) {
        const numRows = recSheet.getLastRow() - 1;
        const emptyWards = Array.from({ length: numRows }, () => ["[]"]);
        recSheet.getRange(2, wardsCol, numRows, 1).setValues(emptyWards);
      }
    }
    const cfg = ss.getSheetByName(SHEETS.CONFIG);
    if (cfg)
      cfg.getRange("D1:E2").setValues([
        ["آخر حذف", "النوع"],
        [new Date().toISOString(), "سجل الأوراد فقط"],
      ]);
    return { success: true, serverTime: new Date().toISOString() };
  } finally {
    lock.releaseLock();
  }
}

function clearAll_() {
  ensureSyncSheets_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    [SHEETS.RECORDS, SHEETS.PAYMENTS, SHEETS.WARDS].forEach((name) => {
      const sh = ss.getSheetByName(name);
      if (sh && sh.getLastRow() > 1)
        sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
    });
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

function isIncomingNewer_(oldVal, newVal) {
  const oldIso = normalizeTimestamp_(oldVal);
  const newIso = normalizeTimestamp_(newVal);
  if (!oldIso) return true;
  if (!newIso) return false;
  const oldMs = new Date(oldIso).getTime();
  const newMs = new Date(newIso).getTime();
  if (!isNaN(oldMs) && !isNaN(newMs)) return newMs >= oldMs;
  return newIso >= oldIso;
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
      monthlyFee:
        x["المصروف الشهري"] === "" || x["المصروف الشهري"] == null
          ? null
          : Number(x["المصروف الشهري"]),
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
      memorizationWards: (function () {
        try {
          const v = JSON.parse(String(x["أوراد الحفظ"] || "[]"));
          return Array.isArray(v) ? v : [];
        } catch (e) {
          return [];
        }
      })(),
      updatedAt: normalizeTimestamp_(x["آخر تحديث"]),
    }));
  const payments = rowsToObjects_(
    ss.getSheetByName(SHEETS.PAYMENTS),
    PAYMENT_HEADERS,
  )
    .filter(
      (x) => !since || normalizeTimestamp_(x["آخر تحديث"]) > String(since),
    )
    .map((x) => {
      const sIds = String(x["الطلاب"] || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      const tot = Number(x["المبلغ الإجمالي"] || 0);
      const isSh = String(x["النوع"] || "single") === "shared" || sIds.length > 1;
      return {
        id: String(x["معرف الدفعة"]),
        paymentCode: String(x["رقم الدفعة"] || ""),
        date: normalizeDate_(x["التاريخ"]),
        period: String(x["الفترة"] || ""),
        type: isSh ? "shared" : "single",
        studentIds: sIds,
        totalAmount: tot,
        shareAmount:
          x["نصيب الفرد"] !== "" && x["نصيب الفرد"] != null
            ? Number(x["نصيب الفرد"])
            : sIds.length > 0
              ? Math.round((tot / sIds.length) * 100) / 100
              : tot,
        group: String(x["المجموعة"] || ""),
        notes: String(x["ملاحظات"] || ""),
        updatedAt: normalizeTimestamp_(x["آخر تحديث"]),
      };
    });
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
  sh.getRange("A1:N1").merge().setValue("📊 لوحة متابعة الطلاب — دار الحافظ");
  sh.getRange("A1").setFontSize(18).setFontWeight("bold");
  sh.getRange("A2").setValue(
    "لتحديث هذه اللوحة يدوياً: افتح قائمة «🕌 دار الحافظ» بالأعلى واختر «تحديث لوحة التحكم»",
  );
  sh.getRange("A4:N4").setValues([
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
      "إجمالي نصيب المدفوعات",
    ],
  ]);
  sh.getRange("A4:N4").setFontWeight("bold");
  sh.setFrozenRows(4);
  if (sh.getFilter()) sh.getFilter().remove();
  sh.getRange("A4:N4").createFilter();
}

function rebuildDashboard_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const students = ss.getSheetByName(SHEETS.STUDENTS);
  const records = ss.getSheetByName(SHEETS.RECORDS);
  const payments = ss.getSheetByName(SHEETS.PAYMENTS);
  if (!students || !records) return;
  let dash = ss.getSheetByName(SHEETS.DASHBOARD);
  if (!dash) {
    ensureDashboard_(ss);
    dash = ss.getSheetByName(SHEETS.DASHBOARD);
  }
  if (dash.getFilter()) dash.getFilter().remove();
  if (dash.getMaxRows() > 4)
    dash.getRange(5, 1, dash.getMaxRows() - 4, 14).clearContent();

  const studentRows = rowsToObjects_(students, STUDENT_HEADERS).filter(
    (s) => String(s["الحالة"] || "").trim() !== "مؤرشف",
  );
  const recordRows = rowsToObjects_(records, RECORD_HEADERS);
  const paymentRows = payments ? rowsToObjects_(payments, PAYMENT_HEADERS) : [];

  const paidByStudent = {};
  paymentRows.forEach((p) => {
    const ids = String(p["الطلاب"] || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (!ids.length) return;
    const total = Number(p["المبلغ الإجمالي"] || 0) || 0;
    const share = total / ids.length;
    ids.forEach((id) => {
      paidByStudent[id] = (paidByStudent[id] || 0) + share;
    });
  });

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
    const memories = rs
      .filter((r) => r["الحفظ"] !== "" && r["الحفظ"] != null)
      .map((r) => Number(r["الحفظ"]))
      .filter((n) => !isNaN(n));
    const avg = memories.length
      ? memories.reduce((a, b) => a + b, 0) / memories.length
      : "";
    const best = memories.length ? Math.max.apply(null, memories) : "";
    const worst = memories.length ? Math.min.apply(null, memories) : "";
    const wards = rs.flatMap((r) => {
      try {
        const v = JSON.parse(String(r["أوراد الحفظ"] || "[]"));
        return Array.isArray(v) ? v : [];
      } catch (_) {
        return [];
      }
    });
    const newWards = wards.filter((w) => w.type === "new").length;
    const reviewWards = wards.filter((w) => w.type === "review").length;
    const dates = rs
      .map((r) => String(r["التاريخ"] || ""))
      .filter(Boolean)
      .sort();
    const total = present + absent;
    const paidShare = Math.round((paidByStudent[id] || 0) * 100) / 100;
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
      paidShare,
    ];
  });
  if (out.length) {
    dash.getRange(5, 1, out.length, 14).setValues(out);
    dash.getRange(5, 6, out.length, 1).setNumberFormat("0.0%");
    dash.getRange(5, 7, out.length, 3).setNumberFormat("0.##");
    dash.getRange(5, 14, out.length, 1).setNumberFormat("#,##0.00");
  }
  dash.getRange("A4:N4").createFilter();
  dash.setFrozenRows(4);
}

function ensureDetail_(ss) {
  let sh = ss.getSheetByName(SHEETS.DETAIL);
  if (!sh) sh = ss.insertSheet(SHEETS.DETAIL);
  sh.clear();
  sh.setRightToLeft(true);
  sh.getRange("A1:H1").merge().setValue("👤 الملف الشامل للطالب وبحث الدفعات المشتركة | دار الحافظ");
  sh.getRange("A1:H1")
    .setBackground("#173f35")
    .setFontColor("#ffffff")
    .setFontSize(17)
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  sh.setRowHeight(1, 42);
  sh.getRange("A3").setValue("اختيار الطالب أو رقم الدفعة").setFontWeight("bold");
  sh.getRange("B3:D3").merge().setValue("").setBackground("#fff4d6").setFontWeight("bold");
  sh.getRange("E3:H3")
    .merge()
    .setValue("اختر الطالب من القائمة أو اكتب رقم دفعة مشتركة (مثل SH-1001) للبحث عنها")
    .setFontColor("#587168");

  sh.getRange("A5:D5").merge().setValue("بيانات الطالب");
  sh.getRange("A5:D5").setBackground("#dce9df").setFontWeight("bold");
  sh.getRange("A6:B9").setValues([
    ["الاسم", ""],
    ["المعرف", ""],
    ["المجموعة", ""],
    ["العمر", ""],
  ]);
  sh.getRange("C6:D9").setValues([
    ["الهاتف", ""],
    ["هاتف ولي الأمر", ""],
    ["الحالة", ""],
    ["المصروف الشهري", ""],
  ]);
  sh.getRange("A6:A9").setFontWeight("bold");
  sh.getRange("C6:C9").setFontWeight("bold");

  sh.getRange("E5:H5").merge().setValue("ملخص الحضور والحفظ");
  sh.getRange("E5:H5").setBackground("#dce9df").setFontWeight("bold");
  sh.getRange("E6:F9").setValues([
    ["أيام الحضور", ""],
    ["أيام الغياب", ""],
    ["نسبة الحضور", ""],
    ["متوسط درجة الحفظ", ""],
  ]);
  sh.getRange("G6:H9").setValues([
    ["إجمالي الأوراد", ""],
    ["حفظ جديد", ""],
    ["مراجعة", ""],
    ["تثبيت", ""],
  ]);
  sh.getRange("E6:E9").setFontWeight("bold");
  sh.getRange("G6:G9").setFontWeight("bold");

  sh.getRange("A11:H11").merge().setValue("📖 تقدم الحفظ والمدفوعات (تُقسم الدفعة المشتركة على الأعضاء)");
  sh.getRange("A11:H11").setBackground("#173f35").setFontColor("#ffffff").setFontWeight("bold");
  sh.getRange("A12:H12").setValues([
    ["متوسط تقييم الأوراد", "", "السور المختلفة", "", "آخر ورد", "", "إجمالي نصيب المدفوعات", ""],
  ]);
  sh.getRange("A12:H12").setFontWeight("bold").setBackground("#f5f0e4");
  sh.getRange("A14:H14").merge().setValue("🗓️ السجل التفصيلي — الحضور والأوراد والمدفوعات");
  sh.getRange("A14:H14").setBackground("#173f35").setFontColor("#ffffff").setFontWeight("bold");
  sh.getRange("A15:H15").setValues([
    ["التاريخ", "النوع", "البيان / السورة / الحالة", "من آية / إجمالي", "إلى آية / نصيب الفرد", "التقييم / رقم الدفعة", "النسبة", "الملاحظات / التفاصيل"],
  ]);
  sh.getRange("A15:H15").setFontWeight("bold").setBackground("#dce9df").setWrap(true);
  sh.setFrozenRows(15);
  if (sh.getFilter()) sh.getFilter().remove();
  sh.getRange("A15:H15").createFilter();
  sh.getRange("A16:H2000").clearContent();
  updateDetailSelector_(ss, sh);
  sh.setColumnWidths(1, 8, 135);
  sh.setColumnWidth(3, 190);
  sh.setColumnWidth(8, 250);
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
    "اختر الطالب أو اكتب الـID أو الاسم، أو اكتب رقم الدفعة المشتركة (مثل SH-1001) ثم اضغط Enter.",
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
  const paymentsSheet = ss.getSheetByName(SHEETS.PAYMENTS);
  if (!studentsSheet || !recordsSheet) return;
  const students = rowsToObjects_(studentsSheet, STUDENT_HEADERS);
  const studentNameMap = {};
  students.forEach((st) => {
    studentNameMap[String(st["المعرف"] || "").trim()] = String(st["الاسم"] || "").trim();
  });
  const selectedValue = String(sh.getRange("B3").getValue() || "").trim();

  sh.getRange("B6:B9").clearContent();
  sh.getRange("D6:D9").clearContent();
  sh.getRange("F6:F9").clearContent();
  sh.getRange("H6:H9").clearContent();
  ["B12", "D12", "F12", "H12"].forEach((a1) => sh.getRange(a1).clearContent());
  const lastRow = Math.max(sh.getLastRow(), 16);
  if (lastRow >= 16) sh.getRange(16, 1, lastRow - 15, 8).clearContent();
  if (!selectedValue) return;

  // دعم البحث برقم الدفعة المشتركة مباشرةً في خلية B3 (مثال: SH-1001)
  if (/^SH-/i.test(selectedValue) && paymentsSheet && paymentsSheet.getLastRow() > 1) {
    const paymentRows = rowsToObjects_(paymentsSheet, PAYMENT_HEADERS);
    const matchedPayments = paymentRows.filter(
      (p) =>
        String(p["رقم الدفعة"] || "").trim().toUpperCase() ===
          selectedValue.toUpperCase() ||
        String(p["معرف الدفعة"] || "").trim() === selectedValue,
    );
    if (matchedPayments.length > 0) {
      const p = matchedPayments[0];
      const ids = String(p["الطلاب"] || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      const totalAmt = Number(p["المبلغ الإجمالي"] || 0) || 0;
      const shareAmt = ids.length ? Math.round((totalAmt / ids.length) * 100) / 100 : totalAmt;
      const memberNames = ids
        .map((id) => `${studentNameMap[id] || "طالب"} (#${id})`)
        .join("، ");
      sh.getRange("B6:B9").setValues([
        [`دفعة مشتركة ${p["رقم الدفعة"]}`],
        [String(p["معرف الدفعة"] || "")],
        [String(p["المجموعة"] || "—")],
        [`${ids.length} طلاب مشاركين`],
      ]);
      sh.getRange("D6:D9").setValues([
        [`الإجمالي: ${totalAmt} ج.م`],
        [`نصيب الفرد: ${shareAmt} ج.م`],
        [String(p["الفترة"] || "")],
        [normalizeDate_(p["التاريخ"])],
      ]);
      sh.getRange("H12").setValue(totalAmt).setNumberFormat("#,##0.00");
      const rowsOut = ids.map((id) => [
        normalizeDate_(p["التاريخ"]),
        "دفعة مشتركة",
        `${studentNameMap[id] || "طالب"} (ID: ${id})`,
        totalAmt,
        shareAmt,
        String(p["رقم الدفعة"] || ""),
        "",
        `دفعة مشتركة (${p["رقم الدفعة"]}) — نصيب العضو ${shareAmt} ج.م من إجمالي ${totalAmt} ج.م — ${p["ملاحظات"] || ""}`,
      ]);
      if (rowsOut.length) sh.getRange(16, 1, rowsOut.length, 8).setValues(rowsOut);
      return;
    }
  }

  const s = resolveDetailStudent_(selectedValue, students);
  if (!s) return;

  const id = String(s["المعرف"] || "");
  const name = String(s["الاسم"] || "");
  const records = rowsToObjects_(recordsSheet, RECORD_HEADERS).filter(
    (x) => String(x["معرف الطالب"] || "") === id,
  );
  const presentRecords = records.filter((r) => statusPresent_(r["الحالة"]));
  const absentRecords = records.filter((r) => statusAbsent_(r["الحالة"]));
  const totalAttendance = presentRecords.length + absentRecords.length;
  const manualScores = records
    .filter((r) => r["الحفظ"] !== "" && r["الحفظ"] != null)
    .map((r) => Number(r["الحفظ"]))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 100);
  const allWards = [];
  records.forEach((r) => {
    let wards = [];
    try {
      wards = JSON.parse(String(r["أوراد الحفظ"] || "[]"));
    } catch (_) {
      wards = [];
    }
    if (!Array.isArray(wards)) return;
    wards.forEach((w) => allWards.push({ ward: w || {}, record: r }));
  });
  const scoreMap = {
    "ممتاز": 100,
    "جيد جدًا": 90,
    "جيد جدا": 90,
    "جيد": 80,
    "مقبول": 70,
    "يحتاج مراجعة": 60,
    "ضعيف": 50,
  };
  const wardScore = (item) => {
    const w = item.ward;
    const raw = w.score != null && w.score !== "" ? w.score : w.percentage;
    const n = raw != null && raw !== "" ? Number(raw) : NaN;
    if (Number.isFinite(n) && n >= 0 && n <= 100) return n;
    const label = String(w.rating || w.grade || "")
      .replace(/\s*\([^)]*\)\s*/g, "")
      .trim();
    return Object.prototype.hasOwnProperty.call(scoreMap, label)
      ? scoreMap[label]
      : null;
  };
  const rated = allWards.map(wardScore).filter((n) => n !== null);
  const avgWard = rated.length
    ? rated.reduce((a, b) => a + b, 0) / rated.length
    : "";
  const avgManual = manualScores.length
    ? manualScores.reduce((a, b) => a + b, 0) / manualScores.length
    : "";
  const typeOf = (w) => {
    const raw = String(w.type || "").toLowerCase();
    if (["new", "new-hifz", "حفظ جديد", "جديد"].includes(raw)) return "حفظ جديد";
    if (["review", "past", "ماضي", "ماضٍ", "مراجعة"].includes(raw))
      return "مراجعة";
    if (raw.includes("ثبيت") || raw === "fixation" || raw === "test")
      return "تثبيت";
    return String(w.type || "ورد");
  };
  const newCount = allWards.filter((x) => typeOf(x.ward) === "حفظ جديد").length;
  const reviewCount = allWards.filter((x) => typeOf(x.ward) === "مراجعة").length;
  const fixationCount = allWards.filter((x) => typeOf(x.ward) === "تثبيت").length;
  const surahs = [
    ...new Set(
      allWards.map((x) => String(x.ward.surah || "").trim()).filter(Boolean),
    ),
  ];

  sh.getRange("B3").setValue(`${id} — ${name}`);
  sh.getRange("B6:B9").setValues([
    [name],
    [id],
    [String(s["المجموعة"] || "")],
    [s["العمر"] || ""],
  ]);
  sh.getRange("D6:D9").setValues([
    [String(s["الهاتف"] || "")],
    [String(s["هاتف ولي الأمر"] || "")],
    [String(s["الحالة"] || "نشط")],
    [s["المصروف الشهري"] ? `${s["المصروف الشهري"]} ج.م` : "—"],
  ]);
  sh.getRange("F6:F9").setValues([
    [presentRecords.length],
    [absentRecords.length],
    [totalAttendance ? presentRecords.length / totalAttendance : ""],
    [avgManual],
  ]);
  sh.getRange("H6:H9").setValues([
    [allWards.length],
    [newCount],
    [reviewCount],
    [fixationCount],
  ]);
  sh.getRange("F8").setNumberFormat("0.0%");
  sh.getRange("F9").setNumberFormat("0.0");
  sh.getRange("B12")
    .setValue(avgWard === "" ? "" : avgWard / 100)
    .setNumberFormat("0.0%");
  sh.getRange("D12").setValue(surahs.length);
  const latestWard = allWards
    .slice()
    .sort((a, b) =>
      String(b.record["التاريخ"] || "").localeCompare(
        String(a.record["التاريخ"] || ""),
      ),
    )[0];
  sh.getRange("F12").setValue(
    latestWard
      ? `${latestWard.ward.surah || ""} ${latestWard.ward.from || ""}${latestWard.ward.to ? "–" + latestWard.ward.to : ""}`.trim()
      : "—",
  );

  // حساب نصيب الطالب الفعلي من الدفعات (تقسيم الدفعة المشتركة على الأعضاء المشاركين)
  const timeline = [];
  let paidTotal = 0;
  if (paymentsSheet && paymentsSheet.getLastRow() > 1) {
    const paymentRows = rowsToObjects_(paymentsSheet, PAYMENT_HEADERS);
    paymentRows.forEach((p) => {
      const ids = String(p["الطلاب"] || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      if (ids.indexOf(id) !== -1) {
        const totalAmt = Number(p["المبلغ الإجمالي"] || 0) || 0;
        const isSh = String(p["النوع"] || "") === "shared" || ids.length > 1;
        const shareAmt = ids.length > 0 ? Math.round((totalAmt / ids.length) * 100) / 100 : totalAmt;
        paidTotal += shareAmt;
        const code = String(p["رقم الدفعة"] || "").trim();
        const pDate = normalizeDate_(p["التاريخ"]);
        timeline.push([
          pDate,
          isSh ? "دفعة مشتركة" : "دفعة فردية",
          String(p["الفترة"] || "سداد اشتراك"),
          totalAmt,
          shareAmt,
          code || (isSh ? "مشتركة" : "فردية"),
          "",
          isSh
            ? `دفعة مشتركة ${code ? "(" + code + ") " : ""}— نصيب الطالب: ${shareAmt} ج.م من إجمالي ${totalAmt} ج.م (${ids.length} طلاب) ${p["ملاحظات"] ? "— " + p["ملاحظات"] : ""}`
            : `دفعة فردية: ${shareAmt} ج.م ${p["ملاحظات"] ? "— " + p["ملاحظات"] : ""}`,
        ]);
      }
    });
  }
  sh.getRange("H12").setValue(Math.round(paidTotal * 100) / 100).setNumberFormat("#,##0.00");

  records.forEach((r) => {
    const date = normalizeDate_(r["التاريخ"]);
    timeline.push([
      date,
      "حضور",
      statusPresent_(r["الحالة"])
        ? "حاضر"
        : statusAbsent_(r["الحالة"])
          ? "غائب"
          : String(r["الحالة"] || "—"),
      "",
      "",
      r["الحفظ"] === "" ? "" : r["الحفظ"],
      r["الحفظ"] === "" || r["الحفظ"] == null ? "" : Number(r["الحفظ"]) / 100,
      String(r["آخر تحديث"] || ""),
    ]);
    let wards = [];
    try {
      wards = JSON.parse(String(r["أوراد الحفظ"] || "[]"));
    } catch (_) {
      wards = [];
    }
    if (!Array.isArray(wards)) return;
    wards.forEach((w) => {
      const score = wardScore({ ward: w, record: r });
      timeline.push([
        date,
        typeOf(w),
        String(w.surah || "—"),
        w.from == null ? "" : w.from,
        w.to == null ? "" : w.to,
        String(w.rating || w.grade || ""),
        score === null ? "" : score / 100,
        [String(w.endsSurah ? "نهاية السورة" : ""), String(w.notes || "")]
          .filter(Boolean)
          .join(" — "),
      ]);
    });
  });
  timeline.sort(
    (a, b) =>
      String(b[0]).localeCompare(String(a[0])) ||
      String(a[1]).localeCompare(String(b[1])),
  );
  if (timeline.length) {
    sh.getRange(16, 1, timeline.length, 8).setValues(timeline);
    sh.getRange(16, 7, timeline.length, 1).setNumberFormat("0.0%");
  }
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
  [SHEETS.STUDENTS, SHEETS.RECORDS, SHEETS.PAYMENTS, SHEETS.WARDS].forEach((name) => {
    const sh = ss.getSheetByName(name);
    if (!sh) return;
    sh.setFrozenRows(1);
    const lastCol = sh.getLastColumn();
    if (lastCol) sh.getRange(1, 1, 1, lastCol).setFontWeight("bold");
  });
}

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

function rowsToObjects_(sheet, headers) {
  if (!sheet) return [];
  const n = sheet.getLastRow();
  if (n < 2) return [];
  const width = Math.max(sheet.getLastColumn(), 1);
  const allVals = sheet.getRange(1, 1, n, width).getValues();
  const actualHeaders = allVals[0].map((v) => String(v || "").trim());
  const values = allVals.slice(1);
  return values.map((row) => {
    const o = {};
    actualHeaders.forEach((h, i) => {
      if (h) o[h] = row[i];
    });
    headers.forEach((h) => {
      if (!(h in o)) o[h] = "";
    });
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