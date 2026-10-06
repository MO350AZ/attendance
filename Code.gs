// نظام حضور وحفظ — قاعدة محلية + مزامنة Google Sheets.
// شغّل setupSpreadsheet() مرة واحدة بعد لصق الكود، ثم انشر Web App.

const SHEETS = {
  STUDENTS: 'الطلاب',
  RECORDS: 'السجلات',
  CONFIG: 'الإعدادات',
  DASHBOARD: 'لوحة التحكم',
  DETAIL: 'تفاصيل الطالب',
  PAYMENTS: 'الدفعات'
};
const OLD_SHEETS = {
  STUDENTS: 'Students', RECORDS: 'Records', CONFIG: 'Config', DASHBOARD: 'Dashboard', DETAIL: 'Student Details'
};
const STUDENT_HEADERS = ['المعرف','الاسم','العمر','المجموعة','الهاتف','هاتف ولي الأمر','آخر تحديث'];
const RECORD_HEADERS = ['معرف السجل','التاريخ','معرف الطالب','الحالة','الحفظ','آخر تحديث'];
const CONFIG_HEADERS = ['المفتاح','القيمة'];
const PAYMENT_HEADERS = ['معرف الدفعة','التاريخ','الفترة','النوع','الطلاب','المبلغ الإجمالي','المجموعة','ملاحظات','آخر تحديث'];

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || 'ping');
    if (action === 'ping') return json_({success:true, serverTime:new Date().toISOString()}, e.parameter.callback);
    if (action === 'sync') return json_(sync_(decodePayload_(e.parameter.payload || '')), e.parameter.callback);
    if (action === 'pull') return json_(pull_(e.parameter.since || ''), e.parameter.callback);
    if (action === 'fullPull') return json_(pull_(''), e.parameter.callback);
    if (action === 'clearRecords') return json_(clearRecords_(), e.parameter.callback);
    if (action === 'clearAll') return json_(clearAll_(), e.parameter.callback);
    return json_({success:false,message:'إجراء غير معروف'}, e.parameter.callback);
  } catch (err) {
    return json_({success:false,message:String(err && err.message || err)}, e.parameter.callback);
  }
}

function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const action = String(body.action || 'ping');
    let result;
    if (action === 'ping') result = {success:true,serverTime:new Date().toISOString()};
    else if (action === 'sync') result = sync_(body.payload || {});
    else if (action === 'pull') result = pull_(body.since || '');
    else if (action === 'fullPull') result = pull_('');
    else if (action === 'clearRecords') result = clearRecords_();
    else if (action === 'clearAll') result = clearAll_();
    else result = {success:false,message:'إجراء غير معروف'};
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({success:false,message:String(err && err.message || err)})).setMimeType(ContentService.MimeType.JSON);
  }
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
  const config = ss.getSheetByName(SHEETS.CONFIG);
  if (config.getLastRow() < 2) config.getRange(2,1,1,2).setValues([['التطبيق','حضور وحفظ']]);
  config.hideSheet();
  ensureDashboard_(ss);
  ensureDetail_(ss);
  formatBaseSheets_(ss);
  try { ss.setSpreadsheetLocale('en_US'); } catch (_) {}
  rebuildDashboard_();
  return 'جاهز';
}

function migrateOldSheet_(ss, oldName, newName) {
  const old = ss.getSheetByName(oldName);
  const target = ss.getSheetByName(newName);
  if (old && !target) old.setName(newName);
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.getRange(1,1,1,headers.length).setValues([headers]);
  return sh;
}

// ترحيل آمن لجدول الطلاب القديم إلى الشكل الجديد.
// مهم: لا يعتمد على ترتيب الأعمدة؛ يعتمد على أسماء العناوين،
// لذلك لا تتحرك بيانات المجموعة/الهاتف/آخر تحديث إلى أعمدة خاطئة.
function migrateStudentsSchema_(ss) {
  const sh = ss.getSheetByName(SHEETS.STUDENTS);
  if (!sh || sh.getLastRow() < 1) return;

  const lastCol = Math.max(sh.getLastColumn(), 1);
  const headers = sh.getRange(1,1,1,lastCol).getDisplayValues()[0].map(x => String(x || '').trim());
  const rowCount = Math.max(0, sh.getLastRow() - 1);
  const rows = rowCount ? sh.getRange(2,1,rowCount,lastCol).getValues() : [];
  const isTimestamp = v => {
    if (v instanceof Date && !isNaN(v.getTime())) return true;
    const s = String(v == null ? '' : v).trim();
    return /^\d{4}-\d{2}-\d{2}T/.test(s) || /^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}/.test(s) || /^\w{3} \w{3} \d{1,2} \d{4}/.test(s);
  };
  const looksPhone = v => /^0?1[0125]\d{8}$/.test(String(v == null ? '' : v).replace(/[ +()-]/g,''));

  // إصلاح النسخة التي ظهرت فيها المجموعة داخل عمود الهاتف/آخر تحديث.
  // الشكل المتضرر: A=ID, B=الاسم, C=المجموعة(فارغة), D=الهاتف(فارغ), E=آخر تحديث لكن القيمة مجموعة.
  const hasExpectedNewHeaders = STUDENT_HEADERS.every(h => headers.indexOf(h) !== -1);
  const ageMissing = headers.indexOf('العمر') === -1;
  const duplicateUpdated = headers.filter(h => h === 'آخر تحديث').length >= 2;
  let corrupted = false;
  if (ageMissing && duplicateUpdated && rowCount) {
    corrupted = rows.slice(0, Math.min(100, rows.length)).some(r => {
      const c = String(r[2] == null ? '' : r[2]).trim();
      const d = String(r[3] == null ? '' : r[3]).trim();
      const e = r[4];
      const f = String(r[5] == null ? '' : r[5]).trim();
      const g = r[6];
      return !c && !f && !g && String(e || '').trim() !== '' && !isTimestamp(e) && (!d || looksPhone(d));
    });
  }

  if (corrupted) {
    const fixed = rows.map(r => {
      const e = r[4];
      const d = r[3];
      const group = String(r[2] || '').trim() || (!isTimestamp(e) ? String(e || '').trim() : '');
      const phone = looksPhone(d) ? String(d).trim() : '';
      const updated = isTimestamp(r[6]) ? normalizeTimestamp_(r[6]) : (isTimestamp(e) ? normalizeTimestamp_(e) : new Date().toISOString());
      return [r[0], r[1], '', group, phone, String(r[5] || ''), updated];
    });
    sh.getRange(1,1,1,7).setValues([STUDENT_HEADERS]);
    if (fixed.length) sh.getRange(2,1,fixed.length,7).setValues(fixed);
    return;
  }

  // إذا كان الشكل الجديد كاملًا، لا نعيد ترتيب البيانات.
  if (hasExpectedNewHeaders) return;

  // الشكل القديم: المعرف، الاسم، المجموعة، الهاتف، آخر تحديث (+ أعمدة اختيارية).
  const normalized = headers;
  const oldIndex = {};
  normalized.forEach((h,i) => { if (!(h in oldIndex)) oldIndex[h] = i; });
  const aliases = {
    id: ['المعرف','ID','Id','id'], name: ['الاسم','Name','name'], age: ['العمر','Age','age'],
    group: ['المجموعة','Group','group'], phone: ['الهاتف','Phone','phone'],
    guardian: ['هاتف ولي الأمر','رقم ولي الأمر','Guardian Phone','Parent Phone','guardianPhone','parentPhone'],
    updated: ['آخر تحديث','Updated At','updatedAt','Last Updated']
  };
  const findIndex = keys => { for (const k of keys) if (oldIndex[k] !== undefined) return oldIndex[k]; return -1; };
  const idx = {id:findIndex(aliases.id),name:findIndex(aliases.name),age:findIndex(aliases.age),group:findIndex(aliases.group),phone:findIndex(aliases.phone),guardian:findIndex(aliases.guardian),updated:findIndex(aliases.updated)};
  const valueAt = (row,i) => i >= 0 ? row[i] : '';
  const migrated = rows.map(row => [valueAt(row,idx.id),valueAt(row,idx.name),valueAt(row,idx.age),valueAt(row,idx.group),valueAt(row,idx.phone),valueAt(row,idx.guardian),valueAt(row,idx.updated)]);
  sh.getRange(1,1,1,7).setValues([STUDENT_HEADERS]);
  if (migrated.length) sh.getRange(2,1,migrated.length,7).setValues(migrated);
}

function sync_(payload) {
  setupSpreadsheet();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const studentSheet = ss.getSheetByName(SHEETS.STUDENTS);
    const recordSheet = ss.getSheetByName(SHEETS.RECORDS);
    const paymentSheet = ss.getSheetByName(SHEETS.PAYMENTS);
    const students = Array.isArray(payload.students) ? payload.students : [];
    const records = Array.isArray(payload.records) ? payload.records : [];
    const studentMap = readMap_(studentSheet, 1);
    const recordMap = readMap_(recordSheet, 1);
    const paymentMap = readMap_(paymentSheet, 1);
    const payments = Array.isArray(payload.payments) ? payload.payments : [];
    let studentsChanged = 0, recordsChanged = 0, paymentsChanged = 0;

    students.forEach(s => {
      if (!s || !s.id || !s.updatedAt) return;
      const row = studentMap[String(s.id)];
      const values = [String(s.id), String(s.name || ''), s.age == null || s.age === '' ? '' : Number(s.age), String(s.group || ''), String(s.phone || ''), String(s.guardianPhone || s.parentPhone || ''), String(s.updatedAt)];
      if (row) {
        const old = studentSheet.getRange(row,1,1,7).getValues()[0];
        if (String(old[6] || '') < String(s.updatedAt)) {
          studentSheet.getRange(row,1,1,7).setValues([values]); studentsChanged++;
        }
      } else {
        studentSheet.appendRow(values); studentsChanged++;
      }
    });

    records.forEach(r => {
      if (!r || !r.id || !r.updatedAt || !r.studentId || !r.date) return;
      const row = recordMap[String(r.id)];
      const status = String(r.status || '').toLowerCase() === 'absent' || String(r.status) === 'غائب' ? 'غائب' : 'حاضر';
      const values = [String(r.id), String(r.date), String(r.studentId), status, r.memory == null ? '' : Number(r.memory), String(r.updatedAt)];
      if (row) {
        const old = recordSheet.getRange(row,1,1,6).getValues()[0];
        if (String(old[5] || '') < String(r.updatedAt)) {
          recordSheet.getRange(row,1,1,6).setValues([values]); recordsChanged++;
        }
      } else {
        recordSheet.appendRow(values); recordsChanged++;
      }
    });


    payments.forEach(p => {
      if (!p || !p.id || !p.updatedAt) return;
      const studentIds = Array.isArray(p.studentIds) && p.studentIds.length
        ? p.studentIds.map(String)
        : (p.studentId ? [String(p.studentId)] : []);
      if (!studentIds.length) return;
      const type = p.type === 'shared' || studentIds.length > 1 ? 'shared' : 'single';
      const totalAmount = p.totalAmount != null && p.totalAmount !== '' ? Number(p.totalAmount) : Number(p.amount || 0);
      const notes = p.notes != null ? String(p.notes) : String(p.note || '');
      const row = paymentMap[String(p.id)];
      const values = [String(p.id), String(p.date||''), String(p.period||''), type, studentIds.join(','), Number.isFinite(totalAmount) ? totalAmount : 0, String(p.group||''), notes, String(p.updatedAt)];
      if (row) {
        const old = paymentSheet.getRange(row,1,1,9).getValues()[0];
        if (String(old[8] || '') < String(p.updatedAt)) { paymentSheet.getRange(row,1,1,9).setValues([values]); paymentsChanged++; }
      } else { paymentSheet.appendRow(values); paymentsChanged++; }
    });
    rebuildDashboard_();
    return {success:true, studentsChanged, recordsChanged, paymentsChanged, serverTime:new Date().toISOString()};
  } finally { lock.releaseLock(); }
}

function clearRecords_() {
  setupSpreadsheet();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SHEETS.RECORDS);
    if (sh && sh.getLastRow() > 1) sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).clearContent();
    const cfg = ss.getSheetByName(SHEETS.CONFIG);
    if (cfg) cfg.getRange('D1:E2').setValues([['آخر حذف','النوع'],[new Date().toISOString(),'سجل الحضور']]);
    rebuildDashboard_();
    const detail = ss.getSheetByName(SHEETS.DETAIL);
    if (detail) { detail.getRange('B3').clearContent(); detail.getRange('B5:B10').clearContent(); detail.getRange('A14:D1000').clearContent(); updateDetailSelector_(ss, detail); }
    return {success:true,serverTime:new Date().toISOString()};
  } finally { lock.releaseLock(); }
}

function clearAll_() {
  setupSpreadsheet();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    [SHEETS.STUDENTS,SHEETS.RECORDS,SHEETS.PAYMENTS].forEach(name => {
      const sh=ss.getSheetByName(name);
      if(sh && sh.getLastRow()>1) sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).clearContent();
    });
    const cfg = ss.getSheetByName(SHEETS.CONFIG);
    if (cfg) cfg.getRange('D1:E2').setValues([['آخر حذف','النوع'],[new Date().toISOString(),'كل البيانات']]);
    rebuildDashboard_();
    const detail = ss.getSheetByName(SHEETS.DETAIL);
    if (detail) { detail.getRange('B3').clearContent(); detail.getRange('B5:B10').clearContent(); detail.getRange('A14:D1000').clearContent(); updateDetailSelector_(ss, detail); }
    return {success:true,serverTime:new Date().toISOString()};
  } finally { lock.releaseLock(); }
}

function normalizeDate_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) {
    const tz = Session.getScriptTimeZone() || 'Africa/Cairo';
    return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  }
  const s = String(v == null ? '' : v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (!s) return '';
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const tz = Session.getScriptTimeZone() || 'Africa/Cairo';
    return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
  }
  return s;
}

function normalizeTimestamp_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString();
  const s = String(v == null ? '' : v).trim();
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toISOString();
}

function pull_(since) {
  setupSpreadsheet();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const students = rowsToObjects_(ss.getSheetByName(SHEETS.STUDENTS), STUDENT_HEADERS)
    .filter(x => !since || normalizeTimestamp_(x['آخر تحديث']) > String(since))
    .map(x => ({id:String(x['المعرف']),name:String(x['الاسم']||''),age:x['العمر']===''||x['العمر']==null?'':Number(x['العمر']),group:String(x['المجموعة']||''),phone:String(x['الهاتف']||''),guardianPhone:String(x['هاتف ولي الأمر']||''),updatedAt:normalizeTimestamp_(x['آخر تحديث'])}));
  const records = rowsToObjects_(ss.getSheetByName(SHEETS.RECORDS), RECORD_HEADERS)
    .filter(x => !since || normalizeTimestamp_(x['آخر تحديث']) > String(since))
    .map(x => ({id:String(x['معرف السجل']),date:normalizeDate_(x['التاريخ']),studentId:String(x['معرف الطالب']),status:String(x['الحالة']||'') === 'غائب' ? 'absent' : 'present',memory:x['الحفظ']===''||x['الحفظ']==null?null:Number(x['الحفظ']),updatedAt:normalizeTimestamp_(x['آخر تحديث'])}));
  const payments = rowsToObjects_(ss.getSheetByName(SHEETS.PAYMENTS), PAYMENT_HEADERS)
    .filter(x => !since || normalizeTimestamp_(x['آخر تحديث']) > String(since))
    .map(x => ({id:String(x['معرف الدفعة']),date:normalizeDate_(x['التاريخ']),period:String(x['الفترة']||''),type:String(x['النوع']||'single'),studentIds:String(x['الطلاب']||'').split(',').map(v=>v.trim()).filter(Boolean),totalAmount:Number(x['المبلغ الإجمالي']||0),group:String(x['المجموعة']||''),notes:String(x['ملاحظات']||''),updatedAt:normalizeTimestamp_(x['آخر تحديث'])}));
  return {success:true,students,records,payments,serverTime:new Date().toISOString()};
}

function ensureDashboard_(ss) {
  let sh = ss.getSheetByName(SHEETS.DASHBOARD);
  if (!sh) sh = ss.insertSheet(SHEETS.DASHBOARD);
  sh.clear();
  sh.getRange('A1:J1').merge().setValue('📊 لوحة متابعة الطلاب');
  sh.getRange('A1').setFontSize(18).setFontWeight('bold');
  sh.getRange('A2').setValue('تتحدث تلقائيًا من الطلاب والسجلات بعد المزامنة');
  sh.getRange('A4:J4').setValues([['المعرف','الطالب','المجموعة','حاضر','غائب','نسبة الحضور','متوسط الحفظ','أعلى حفظ','أقل حفظ','آخر تاريخ']]);
  sh.getRange('A4:J4').setFontWeight('bold');
  sh.setFrozenRows(4);
  if (sh.getFilter()) sh.getFilter().remove();
  sh.getRange('A4:J4').createFilter();
}

function rebuildDashboard_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const students = ss.getSheetByName(SHEETS.STUDENTS);
  const records = ss.getSheetByName(SHEETS.RECORDS);
  if (!students || !records) return;
  let dash = ss.getSheetByName(SHEETS.DASHBOARD);
  if (!dash) { ensureDashboard_(ss); dash = ss.getSheetByName(SHEETS.DASHBOARD); }
  if (dash.getFilter()) dash.getFilter().remove();
  if (dash.getMaxRows() > 4) dash.getRange(5,1,dash.getMaxRows()-4,10).clearContent();

  const studentRows = rowsToObjects_(students, STUDENT_HEADERS);
  const recordRows = rowsToObjects_(records, RECORD_HEADERS);
  const byStudent = {};
  recordRows.forEach(r => {
    const id = String(r['معرف الطالب'] || '');
    if (!id) return;
    if (!byStudent[id]) byStudent[id] = [];
    byStudent[id].push(r);
  });

  const out = studentRows.map(s => {
    const id = String(s['المعرف'] || '');
    const rs = byStudent[id] || [];
    const present = rs.filter(r => statusPresent_(r['الحالة'])).length;
    const absent = rs.filter(r => statusAbsent_(r['الحالة'])).length;
    const memories = rs.map(r => Number(r['الحفظ'])).filter(n => !isNaN(n));
    const avg = memories.length ? memories.reduce((a,b)=>a+b,0)/memories.length : '';
    const best = memories.length ? Math.max.apply(null, memories) : '';
    const worst = memories.length ? Math.min.apply(null, memories) : '';
    const dates = rs.map(r => String(r['التاريخ'] || '')).filter(Boolean).sort();
    const total = present + absent;
    return [id, String(s['الاسم']||''), String(s['المجموعة']||''), present, absent, total ? present/total : '', avg, best, worst, dates.length ? dates[dates.length-1] : ''];
  });
  if (out.length) dash.getRange(5,1,out.length,10).setValues(out);
  if (out.length) {
    dash.getRange(5,6,out.length,1).setNumberFormat('0.0%');
    dash.getRange(5,7,out.length,3).setNumberFormat('0.##');
  }
  dash.getRange('A4:J4').createFilter();
  dash.autoResizeColumns(1,10);
  dash.setFrozenRows(4);
}

function ensureDetail_(ss) {
  let sh = ss.getSheetByName(SHEETS.DETAIL);
  if (!sh) sh = ss.insertSheet(SHEETS.DETAIL);
  sh.clear();
  sh.getRange('A1:D1').merge().setValue('👤 تفاصيل الطالب');
  sh.getRange('A1').setFontSize(18).setFontWeight('bold');
  sh.getRange('A3').setValue('اختيار الطالب (ID أو الاسم)');
  sh.getRange('B3').setValue('');
  sh.getRange('A5:B10').setValues([
    ['الاسم',''],['المجموعة',''],['الحضور',''],['الغياب',''],['نسبة الحضور',''],['متوسط الحفظ','']
  ]);
  sh.getRange('A12:D12').setValues([['التاريخ','الحالة','الحفظ','آخر تحديث']]);
  sh.getRange('A12:D12').setFontWeight('bold');
  sh.setFrozenRows(12);
  sh.getRange('A14:D1000').clearContent();
  updateDetailSelector_(ss, sh);
  sh.autoResizeColumns(1,4);
}

function updateDetailSelector_(ss, sh) {
  const students = rowsToObjects_(ss.getSheetByName(SHEETS.STUDENTS), STUDENT_HEADERS);
  const choices = students.map(s => {
    const id = String(s['المعرف'] || '').trim();
    const name = String(s['الاسم'] || '').trim();
    return id && name ? `${id} — ${name}` : id || name;
  }).filter(Boolean);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(choices.length ? choices : [''], true)
    .setAllowInvalid(true).build();
  sh.getRange('B3').setDataValidation(rule);
  sh.getRange('B3').setNote('يمكن اختيار الطالب أو كتابة الـID أو الاسم ثم الضغط Enter.');
}

function resolveDetailStudent_(value, students) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const idPart = raw.split('—')[0].trim();
  return students.find(x => String(x['المعرف'] || '').trim() === idPart)
      || students.find(x => String(x['الاسم'] || '').trim() === raw)
      || students.find(x => String(x['الاسم'] || '').trim().toLowerCase() === raw.toLowerCase())
      || null;
}

function updateStudentDetails(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEETS.DETAIL);
  if (!sh) return;
  const students = rowsToObjects_(ss.getSheetByName(SHEETS.STUDENTS), STUDENT_HEADERS);
  const s = resolveDetailStudent_(sh.getRange('B3').getValue(), students);
  sh.getRange('B5:B10').clearContent();
  sh.getRange('A14:D1000').clearContent();
  if (!s) return;
  const id = String(s['المعرف'] || '');
  const records = rowsToObjects_(ss.getSheetByName(SHEETS.RECORDS), RECORD_HEADERS)
    .filter(x => String(x['معرف الطالب']) === id);
  const present = records.filter(r=>statusPresent_(r['الحالة'])).length;
  const absent = records.filter(r=>statusAbsent_(r['الحالة'])).length;
  const mem = records.map(r=>Number(r['الحفظ'])).filter(n=>!isNaN(n));
  const total = present+absent;
  sh.getRange('B3').setValue(`${id} — ${String(s['الاسم'] || '')}`);
  sh.getRange('B5:B10').setValues([
    [String(s['الاسم']||'')],[String(s['المجموعة']||'')],[present],[absent],
    [total?present/total:''],[mem.length?mem.reduce((a,b)=>a+b,0)/mem.length:'']
  ]);
  sh.getRange('B9').setNumberFormat('0.0%');
  const rows = records.sort((a,b)=>String(a['التاريخ']).localeCompare(String(b['التاريخ'])))
    .map(r=>[String(r['التاريخ']||''),statusPresent_(r['الحالة'])?'حاضر':'غائب',r['الحفظ']===''?'':Number(r['الحفظ']),String(r['آخر تحديث']||'')]);
  if (rows.length) sh.getRange(14,1,rows.length,4).setValues(rows);
  updateDetailSelector_(ss, sh);
}

function onEdit(e) {
  if (e && e.range && e.range.getSheet().getName() === SHEETS.DETAIL && e.range.getA1Notation() === 'B3') {
    updateStudentDetails(e);
  }
}

function formatBaseSheets_(ss) {
  [SHEETS.STUDENTS,SHEETS.RECORDS,SHEETS.PAYMENTS].forEach(name => {
    const sh=ss.getSheetByName(name);
    sh.setFrozenRows(1);
    const lastCol=sh.getLastColumn();
    if(lastCol) sh.getRange(1,1,1,lastCol).setFontWeight('bold');
    sh.autoResizeColumns(1,lastCol);
  });
}
function readMap_(sheet, keyCol) {
  const out = {};
  const n = sheet.getLastRow();
  if (n < 2) return out;
  const vals = sheet.getRange(2,keyCol,n-1,1).getValues();
  vals.forEach((r,i)=>{if(r[0] !== '') out[String(r[0])] = i+2;});
  return out;
}
function rowsToObjects_(sheet, headers) {
  const n=sheet.getLastRow(); if(n<2) return [];
  return sheet.getRange(2,1,n-1,headers.length).getValues().map(row=>{const o={};headers.forEach((h,i)=>o[h]=row[i]);return o;});
}
function statusPresent_(v) { return String(v||'').toLowerCase() === 'present' || String(v||'') === 'حاضر'; }
function statusAbsent_(v) { return String(v||'').toLowerCase() === 'absent' || String(v||'') === 'غائب'; }
function decodePayload_(s) {
  if(!s) return {};
  const bytes=Utilities.base64DecodeWebSafe(s);
  return JSON.parse(Utilities.newBlob(bytes).getDataAsString('UTF-8'));
}
function json_(obj, callback) {
  const body=JSON.stringify(obj);
  if(callback && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) return ContentService.createTextOutput(callback+'('+body+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}
