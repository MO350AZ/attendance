from pathlib import Path
p=Path('/mnt/data/dar_work/index.html')
s=p.read_text()
s=s.replace("<button onclick=\"showTab('dashboard')\">📊 الإحصائيات</button>","<button onclick=\"showTab('dashboard')\">📊 الإحصائيات</button><button onclick=\"showTab('payments')\">💰 الدفعات</button>")
needle="</section>\n<section id=\"settings\""
pay='''</section>\n<section id="payments" class="tab"><div class="card"><h2>💰 تسجيل دفعة</h2><div class="notice">الدفعة المشتركة تُسجل كعملية مالية واحدة بالمبلغ الإجمالي. لا يتم تقسيم المبلغ على الطلاب.</div><div class="grid" style="margin-top:10px"><select id="paymentType"><option value="single">طالب واحد</option><option value="shared">دفعة مشتركة لعدة طلاب</option></select><input id="paymentDate" type="text" inputmode="numeric" maxlength="10" placeholder="تاريخ الدفع يوم/شهر/سنة"><input id="paymentPeriod" placeholder="الشهر/الفترة — مثال: أكتوبر 2026"><input id="paymentAmount" type="number" min="0" step="0.01" placeholder="إجمالي المبلغ بالجنيه"><select id="paymentGroup"><option value="">اختر المجموعة</option></select><select id="paymentStudent"></select></div><div id="sharedStudents" class="card hidden" style="margin-top:10px"><b>اختر الطلاب المشاركين في الدفعة</b><div id="sharedStudentList" style="margin-top:8px"></div></div><input id="paymentNotes" placeholder="ملاحظات (اختياري)" style="width:100%;margin-top:10px"><div class="row" style="margin-top:10px"><button id="savePayment">تسجيل الدفعة</button><button class="secondary" id="clearPayment">تفريغ</button></div></div><div class="card"><h2>سجل الدفعات</h2><div class="grid"><input id="paymentSearch" placeholder="بحث بالطالب أو المجموعة أو الفترة"><select id="paymentFilterType"><option value="all">كل الدفعات</option><option value="single">فردية</option><option value="shared">مشتركة</option></select></div><div id="paymentList" style="margin-top:10px"></div></div></section>\n<section id="settings"'''
s=s.replace(needle,pay,1)
s=s.replace("async function data(){return {students:await get('students')||[],records:await get('records')||[]}}","async function data(){return {students:await get('students')||[],records:await get('records')||[],payments:await get('payments')||[]}}")
# insert payment functions before renderToday
marker="async function renderToday(){"
func=r'''function paymentDateISO(){return parseDateInput($('paymentDate').value)||today()}
function money(v){return Number(v||0).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2})+' جنيه'}
function paymentStudentsText(p,students){return (p.studentIds||[]).map(id=>students.find(s=>String(s.id)===String(id))?.name||('ID '+id)).join('، ')}
function refreshPaymentGroups(students){let groups=[...new Set(students.map(s=>s.group).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));let old=$('paymentGroup').value;$('paymentGroup').innerHTML='<option value="">اختر المجموعة</option>'+groups.map(g=>`<option value="${escAttr(g)}">${esc(g)}</option>`).join('');if(groups.includes(old))$('paymentGroup').value=old}
function refreshPaymentStudents(){data().then(d=>{let g=$('paymentGroup').value;let a=d.students.filter(s=>!g||s.group===g);let old=$('paymentStudent').value;$('paymentStudent').innerHTML='<option value="">اختر الطالب</option>'+a.map(s=>`<option value="${escAttr(s.id)}">${esc(s.name)} — ID ${esc(s.id)}</option>`).join('');if(a.some(s=>String(s.id)===old))$('paymentStudent').value=old;$('sharedStudentList').innerHTML=a.map(s=>`<label style="display:block;padding:7px;border-bottom:1px solid #eee"><input type="checkbox" class="sharedStudent" value="${escAttr(s.id)}"> ${esc(s.name)} <span class="small">— ID ${esc(s.id)}</span></label>`).join('')||'<span class="small">اختر مجموعة أولًا.</span>'})}
function togglePaymentType(){let shared=$('paymentType').value==='shared';$('paymentStudent').classList.toggle('hidden',shared);$('sharedStudents').classList.toggle('hidden',!shared);if(shared)refreshPaymentStudents()}
function resetPaymentForm(){ $('paymentDate').value=formatDateDisplay(today());$('paymentPeriod').value='';$('paymentAmount').value='';$('paymentGroup').value='';$('paymentStudent').value='';$('paymentNotes').value='';document.querySelectorAll('.sharedStudent').forEach(x=>x.checked=false);togglePaymentType() }
async function savePayment(){let d=await data(),type=$('paymentType').value,ids=type==='shared'?[...document.querySelectorAll('.sharedStudent:checked')].map(x=>String(x.value)):[String($('paymentStudent').value||'')];if(!ids[0])return alert(type==='shared'?'اختر طالبًا واحدًا على الأقل.':'اختر الطالب.');if(type==='shared'&&ids.length<2)return alert('الدفعة المشتركة يجب أن تضم طالبين أو أكثر.');let amount=Number($('paymentAmount').value);if(!Number.isFinite(amount)||amount<0)return alert('اكتب إجمالي مبلغ صحيح.');let p={id:crypto.randomUUID(),date:paymentDateISO(),period:$('paymentPeriod').value.trim()||formatDateDisplay(paymentDateISO()),type,studentIds:ids,totalAmount:amount,group:$('paymentGroup').value.trim(),notes:$('paymentNotes').value.trim(),updatedAt:now(),synced:false};d.payments.push(p);await set('payments',d.payments);alert(`تم تسجيل ${type==='shared'?'دفعة مشتركة':'دفعة فردية'} بقيمة ${money(amount)} كعملية واحدة.`);resetPaymentForm();renderPayments();renderReport();queueSync()}
async function renderPayments(){let d=await data(),q=($('paymentSearch').value||'').toLowerCase(),ft=$('paymentFilterType').value;let a=d.payments.filter(p=>{let names=paymentStudentsText(p,d.students);return (ft==='all'||p.type===ft)&&(names+' '+(p.group||'')+' '+(p.period||'')+' '+(p.date||'')).toLowerCase().includes(q)}).sort((a,b)=>String(b.date).localeCompare(String(a.date)));$('paymentList').innerHTML=a.map(p=>`<div class="card"><b>${p.type==='shared'?'👥 دفعة مشتركة':'👤 دفعة فردية'}</b> — <strong>${money(p.totalAmount)}</strong><br><span class="small">${esc(formatDateDisplay(p.date))} — ${esc(p.period||'')} ${p.group?'— '+esc(p.group):''}</span><br><span>${esc(paymentStudentsText(p,d.students))}</span>${p.notes?`<br><span class="small">${esc(p.notes)}</span>`:''}</div>`).join('')||'<p class="small">لا توجد دفعات.</p>'}
'''
s=s.replace(marker,func+marker)
# modify showTab
s=s.replace("if(id==='scan')renderToday()","if(id==='scan')renderToday();if(id==='payments')renderPayments()")
# modify student detail to include payment summary
old="let d=await data(),s=d.students.find(x=>x.id===id),r=d.records.filter(x=>x.studentId===id).sort((a,b)=>b.date.localeCompare(a.date));"
new="let d=await data(),s=d.students.find(x=>x.id===id),r=d.records.filter(x=>x.studentId===id).sort((a,b)=>b.date.localeCompare(a.date)),ps=d.payments.filter(p=>(p.studentIds||[]).map(String).includes(String(id)));"
s=s.replace(old,new)
s=s.replace("$('detailStats').innerHTML=`<div class=\"stat\"><b>${p}</b>حضور</div><div class=\"stat\"><b>${ab}</b>غياب</div><div class=\"stat\"><b>${r.length?Math.round(p/r.length*100):0}%</b>نسبة الحضور</div><div class=\"stat\"><b>${avg}%</b>متوسط الحفظ</div>`;","$('detailStats').innerHTML=`<div class=\"stat\"><b>${p}</b>حضور</div><div class=\"stat\"><b>${ab}</b>غياب</div><div class=\"stat\"><b>${r.length?Math.round(p/r.length*100):0}%</b>نسبة الحضور</div><div class=\"stat\"><b>${avg}%</b>متوسط الحفظ</div><div class=\"stat\"><b>${ps.length}</b>دفعات</div>`; ")
# insert payment history after detail body assignment
needle2="$('detailBody').innerHTML=r.map(x=>`<tr><td>${x.date}</td><td>${x.status==='present'?'✅ حاضر':'❌ غائب'}</td><td>${x.memory==null?'-':x.memory+'%'}</td></tr>`).join('')||'<tr><td colspan=\"3\">لا يوجد سجل.</td></tr>';"
repl2=needle2+"$('detailBody').innerHTML += ps.length ? `<tr><td colspan=\"3\"><b>الدفعات:</b> `+ps.map(x=>`${formatDateDisplay(x.date)} — ${money(x.totalAmount)} — ${x.type==='shared'?'دفعة مشتركة':'دفعة فردية'}`).join(' | ')+`</td></tr>` : '';"
s=s.replace(needle2,repl2)
# listeners init
s=s.replace("$('saveStudent').onclick=saveStudent;", "$('saveStudent').onclick=saveStudent;$('paymentType').onchange=togglePaymentType;$('paymentGroup').onchange=refreshPaymentStudents;$('savePayment').onclick=savePayment;$('clearPayment').onclick=resetPaymentForm;$('paymentSearch').oninput=renderPayments;$('paymentFilterType').onchange=renderPayments;$('paymentDate').value=formatDateDisplay(today());")
# init payments render on startup maybe before close
s=s.replace("$('recordDate').value=formatDateDisplay(today());", "$('recordDate').value=formatDateDisplay(today());$('paymentDate').value=formatDateDisplay(today());")
# data clear records should not clear payments
p.write_text(s)

p=Path('/mnt/data/dar_work/Code.gs'); c=p.read_text()
c=c.replace("  DETAIL: 'تفاصيل الطالب'\n};", "  DETAIL: 'تفاصيل الطالب',\n  PAYMENTS: 'الدفعات'\n};")
c=c.replace("  DASHBOARD: 'Dashboard', DETAIL: 'Student Details'\n};", "  DASHBOARD: 'Dashboard', DETAIL: 'Student Details', PAYMENTS: 'Payments'\n};")
c=c.replace("const CONFIG_HEADERS = ['المفتاح','القيمة'];", "const CONFIG_HEADERS = ['المفتاح','القيمة'];\nconst PAYMENT_HEADERS = ['معرف الدفعة','التاريخ','الفترة','النوع','الطلاب','المبلغ الإجمالي','المجموعة','ملاحظات','آخر تحديث'];")
c=c.replace("  migrateOldSheet_(ss, OLD_SHEETS.DETAIL, SHEETS.DETAIL);", "  migrateOldSheet_(ss, OLD_SHEETS.DETAIL, SHEETS.DETAIL);\n  migrateOldSheet_(ss, OLD_SHEETS.PAYMENTS, SHEETS.PAYMENTS);")
c=c.replace("  ensureSheet_(ss, SHEETS.CONFIG, CONFIG_HEADERS);", "  ensureSheet_(ss, SHEETS.CONFIG, CONFIG_HEADERS);\n  ensureSheet_(ss, SHEETS.PAYMENTS, PAYMENT_HEADERS);")
c=c.replace("    const recordSheet = ss.getSheetByName(SHEETS.RECORDS);", "    const recordSheet = ss.getSheetByName(SHEETS.RECORDS);\n    const paymentSheet = ss.getSheetByName(SHEETS.PAYMENTS);")
c=c.replace("    const recordMap = readMap_(recordSheet, 1);", "    const recordMap = readMap_(recordSheet, 1);\n    const paymentMap = readMap_(paymentSheet, 1);")
c=c.replace("    let studentsChanged = 0, recordsChanged = 0;", "    const payments = Array.isArray(payload.payments) ? payload.payments : [];\n    let studentsChanged = 0, recordsChanged = 0, paymentsChanged = 0;")
insert="""\n    payments.forEach(p => {\n      if (!p || !p.id || !p.updatedAt || !Array.isArray(p.studentIds) || !p.studentIds.length) return;\n      const row = paymentMap[String(p.id)];\n      const values = [String(p.id), String(p.date||''), String(p.period||''), String(p.type||'single'), p.studentIds.map(String).join(','), Number(p.totalAmount||0), String(p.group||''), String(p.notes||''), String(p.updatedAt)];\n      if (row) {\n        const old = paymentSheet.getRange(row,1,1,9).getValues()[0];\n        if (String(old[8] || '') < String(p.updatedAt)) { paymentSheet.getRange(row,1,1,9).setValues([values]); paymentsChanged++; }\n      } else { paymentSheet.appendRow(values); paymentsChanged++; }\n    });\n"""
pos=c.find("    rebuildDashboard_();", c.find("function sync_(payload)"))
c=c[:pos]+insert+c[pos:]
c=c.replace("return {success:true, studentsChanged, recordsChanged, serverTime:new Date().toISOString()};", "return {success:true, studentsChanged, recordsChanged, paymentsChanged, serverTime:new Date().toISOString()};",1)
# clear all include payments
c=c.replace("[SHEETS.STUDENTS,SHEETS.RECORDS].forEach(name => {", "[SHEETS.STUDENTS,SHEETS.RECORDS,SHEETS.PAYMENTS].forEach(name => {")
# pull payments
needle="  const records = rowsToObjects_(ss.getSheetByName(SHEETS.RECORDS), RECORD_HEADERS)"
idx=c.find(needle)
end=c.find("  return {success:true,students,records,serverTime",idx)
paypull="""  const payments = rowsToObjects_(ss.getSheetByName(SHEETS.PAYMENTS), PAYMENT_HEADERS)\n    .filter(x => !since || String(x['آخر تحديث']) > String(since))\n    .map(x => ({id:String(x['معرف الدفعة']),date:String(x['التاريخ']||''),period:String(x['الفترة']||''),type:String(x['النوع']||'single'),studentIds:String(x['الطلاب']||'').split(',').map(v=>v.trim()).filter(Boolean),totalAmount:Number(x['المبلغ الإجمالي']||0),group:String(x['المجموعة']||''),notes:String(x['ملاحظات']||''),updatedAt:String(x['آخر تحديث']||'')}));\n"""
c=c[:end]+paypull+c[end:]
c=c.replace("return {success:true,students,records,serverTime:new Date().toISOString()};", "return {success:true,students,records,payments,serverTime:new Date().toISOString()};")
p.write_text(c)
