import {test} from "node:test";
import assert from "node:assert/strict";
import {initialLedger,memberAccount,billAccount,monthlyReport,cashBalance,applyAction,validateBackup,today} from "../.sites-runtime/test-build/ledger.mjs";
const act=(s,a,p)=>applyAction(s,a,p,crypto.randomUUID()).state;
const pay=(s,memberId,amount)=>act(s,"saveTransaction",{kind:"dues",memberId,amount,date:today(),title:"Iuran kas",method:"Tunai",reference:""});
test("Snapshot asli: 12 anggota, tunggakan 80 ribu, kredit 70 ribu, kas belum diasumsikan",()=>{const s=initialLedger(),a=s.members.map(m=>memberAccount(s,m));assert.equal(s.members.length,12);assert.equal(a.reduce((n,a)=>n+a.arrears,0),80000);assert.equal(a.reduce((n,a)=>n+a.credit,0),70000);assert.equal(a.filter(a=>a.settled).length,10);assert.equal(cashBalance(s),0);assert.equal(s.settings.openingCashConfirmed,false);assert.equal(s.transactions.length,0);});
test("Pembayaran sebagian mengurangi tunggakan dan menambah uang kas tepat satu kali",()=>{let s=initialLedger();s=pay(s,"m-qai",15000);assert.equal(memberAccount(s,s.members.find(m=>m.id==="m-qai")).arrears,25000);assert.equal(cashBalance(s),15000);const requestId=crypto.randomUUID();let result=applyAction(s,"saveTransaction",{kind:"dues",memberId:"m-qai",amount:10000,date:today(),title:"Kas",method:"Transfer"},requestId);const again=applyAction(result.state,"saveTransaction",{},requestId);assert.equal(again.state.transactions.length,2);assert.equal(cashBalance(again.state),25000);});
test("Kelebihan melunasi tagihan berikutnya, tanpa menjadi pemasukan kas baru",()=>{let s=initialLedger();s=act(s,"createBills",{period:"2026-11",amount:10000});const d=s.members.find(m=>m.id==="m-dzuka"),b=s.bills.find(b=>b.memberId===d.id);assert.equal(memberAccount(s,d,"2026-11").credit,0);assert.deepEqual(billAccount(s,b,"2026-11"),{paid:10000,remaining:0});assert.equal(cashBalance(s),0);const mischa=s.members.find(m=>m.id==="m-mischa");assert.equal(memberAccount(s,mischa,"2026-11").credit,10000);assert.equal(memberAccount(s,d,"2026-10").credit,10000);});
test("Pembayaran dialokasikan ke tunggakan paling lama sebelum iuran bulan baru",()=>{let s=initialLedger();s=act(s,"createBills",{period:"2026-11",amount:10000});s=pay(s,"m-qai",45000);const b=s.bills.find(b=>b.memberId==="m-qai");assert.deepEqual(billAccount(s,b,"2026-11"),{paid:5000,remaining:5000});assert.equal(memberAccount(s,s.members.find(m=>m.id==="m-qai"),"2026-11").arrears,5000);assert.equal(cashBalance(s),45000);});
test("Tagihan ganda ditolak; anggota arsip atau belum bergabung tidak ditagih",()=>{let s=initialLedger();s=act(s,"saveMember",{...s.members[0],active:false});s=act(s,"saveMember",{name:"Anggota Baru",division:"Jurnalistik",className:"XI",joinedMonth:"2026-12",active:true,openingDue:0,openingCredit:0});s=act(s,"createBills",{period:"2026-11",amount:10000});assert.equal(s.bills.length,11);assert.throws(()=>act(s,"createBills",{period:"2026-11",amount:10000}),/sudah dibuat/);});
test("Perubahan tarif tidak mengubah tagihan sebelumnya",()=>{let s=act(initialLedger(),"createBills",{period:"2026-11",amount:10000});s=act(s,"settings",{...s.settings,monthlyDue:20000});s=act(s,"createBills",{period:"2026-12",amount:s.settings.monthlyDue});assert.equal(s.bills.filter(b=>b.period==="2026-11").reduce((n,b)=>n+b.amount,0),120000);assert.equal(s.bills.filter(b=>b.period==="2026-12").reduce((n,b)=>n+b.amount,0),240000);});
test("Saldo awal wajib dikonfirmasi dan saldo tidak boleh negatif",()=>{const expense={kind:"expense",amount:10000,date:today(),title:"Konsumsi",category:"Kegiatan",method:"Tunai"};let s=initialLedger();assert.throws(()=>act(s,"saveTransaction",expense),/Konfirmasi/);s=act(s,"settings",{...s.settings,openingCashConfirmed:true,openingCash:5000});assert.throws(()=>act(s,"saveTransaction",expense),/Saldo kas tidak cukup/);assert.equal(cashBalance(s),5000);});
test("Pembatalan mengembalikan tunggakan dan kas, serta mempertahankan bukti",()=>{let s=pay(initialLedger(),"m-qai",40000);const id=s.transactions[0].id;s=act(s,"voidTransaction",{id,reason:"Penerimaan tercatat dua kali"});assert.equal(s.transactions.length,1);assert.ok(s.transactions[0].voidedAt);assert.equal(cashBalance(s),0);assert.equal(memberAccount(s,s.members.find(m=>m.id==="m-qai")).arrears,40000);assert.equal(s.audit.at(-1).action,"Pembatalan transaksi");});
test("Pembatalan penerimaan yang mendanai pengeluaran ditolak tanpa mengubah state",()=>{let s=act(initialLedger(),"settings",{...initialLedger().settings,openingCashConfirmed:true});s=pay(s,"m-qai",40000);s=act(s,"saveTransaction",{kind:"expense",amount:30000,date:today(),title:"Kegiatan",category:"Kegiatan",method:"Tunai"});assert.throws(()=>act(s,"voidTransaction",{id:s.transactions[0].id,reason:"Salah catat"}),/Saldo kas tidak cukup/);assert.equal(cashBalance(s),10000);assert.equal(s.transactions[0].voidedAt,null);});
test("Rekap bulanan memakai transaksi aktual, saldo awal, dan mengabaikan pembatalan",()=>{let s=act(initialLedger(),"settings",{...initialLedger().settings,openingCash:100000,openingCashConfirmed:true});s=pay(s,"m-qai",40000);s=act(s,"saveTransaction",{kind:"expense",amount:25000,date:today(),title:"Peralatan",category:"Perlengkapan",method:"Transfer"});const r=monthlyReport(s,today().slice(0,7));assert.equal(r.opening,100000);assert.equal(r.income,40000);assert.equal(r.expense,25000);assert.equal(r.closing,115000);assert.equal(monthlyReport(s,"2026-11").opening,115000);});
test("Cadangan pulih dengan angka sama dan menolak duplikat / referensi asing / nilai salah",()=>{const s=pay(initialLedger(),"m-qai",10000);const restored=validateBackup(JSON.parse(JSON.stringify(s)));assert.equal(cashBalance(restored),10000);assert.equal(memberAccount(restored,restored.members[1]).arrears,30000);let bad=structuredClone(s);bad.members.push(bad.members[0]);assert.throws(()=>validateBackup(bad),/berulang/);bad=structuredClone(s);bad.transactions[0].memberId="missing";assert.throws(()=>validateBackup(bad),/tidak ditemukan/);bad=structuredClone(s);bad.transactions[0].amount=1.2;assert.throws(()=>validateBackup(bad),/rupiah bulat/);});
test("Nominal negatif, uang pecahan, dan tanggal tidak sah ditolak",()=>{let s=initialLedger();assert.throws(()=>pay(s,"m-qai",-100),/rupiah bulat/);assert.throws(()=>pay(s,"m-qai",100.5),/rupiah bulat/);assert.throws(()=>act(s,"saveTransaction",{kind:"dues",memberId:"m-qai",amount:100,date:"2026-02-30",title:"Kas",method:"Tunai"}),/Tanggal/);assert.throws(()=>act(s,"saveMember",{...s.members[0],openingDue:1000}),/sekaligus/);});

// A malformed timestamp must not break the activity panel after restoring a file.
test("Cadangan menolak timestamp rusak dan dapat memulihkan alasan koreksi panjang",()=>{let s=pay(initialLedger(),"m-qai",10000);let bad=structuredClone(s);bad.audit[0].at="not-a-date";assert.throws(()=>validateBackup(bad),/Waktu/);s=act(s,"voidTransaction",{id:s.transactions[0].id,reason:"Koreksi "+"x".repeat(180)});assert.equal(validateBackup(s).transactions[0].voidReason.length,188);});

test("CRUD anggota menghapus anggota tanpa riwayat dan menjaga referensi keuangan", () => {
  let s = act(initialLedger(), "saveMember", { name: "Anggota Tambahan", division: "Jurnalistik", className: "XI", joinedMonth: "2026-10", active: true, openingDue: 0, openingCredit: 0 });
  const member = s.members.at(-1);
  s = act(s, "saveMember", { ...member, name: "Nama Diperbarui" });
  assert.equal(s.members.at(-1).id, member.id); assert.equal(s.members.at(-1).name, "Nama Diperbarui");
  assert.throws(() => act(s, "deleteMember", { id: member.id, reason: " " }), /Alasan/);
  s = act(s, "deleteMember", { id: member.id, reason: "Salah menambahkan anggota" });
  assert.equal(s.members.length, 12); assert.equal(s.audit.at(-1).action, "Penghapusan anggota");
  assert.throws(() => act(s, "deleteMember", { id: "m-qai", reason: "Keluar" }), /saldo iuran awal/);
  s = pay(s, "m-raffa", 10000);
  assert.throws(() => act(s, "deleteMember", { id: "m-raffa", reason: "Keluar" }), /riwayat/);
  s = act(s, "saveMember", { ...s.members.find(m => m.id === "m-raffa"), active: false });
  assert.equal(s.transactions[0].memberId, "m-raffa"); assert.ok(!s.members.find(m => m.id === "m-raffa").active);
});

test("Edit transaksi menghitung ulang kas dan anggota tanpa menambah transaksi", () => {
  let s = pay(initialLedger(), "m-qai", 40000); const old = { ...s.transactions[0] };
  assert.throws(() => act(s, "saveTransaction", { ...old, amount: 25000 }), /Alasan perubahan/);
  s = act(s, "saveTransaction", { ...old, amount: 25000, reference: "BUKTI-01", correctionReason: "Salah nominal" });
  assert.equal(s.transactions.length, 1); assert.equal(s.transactions[0].createdAt, old.createdAt);
  assert.equal(cashBalance(s), 25000); assert.equal(memberAccount(s, s.members.find(m => m.id === "m-qai")).arrears, 15000);
  assert.match(s.audit.at(-1).detail, /Rp40000/); assert.match(s.audit.at(-1).detail, /Rp25000/); assert.match(s.audit.at(-1).detail, /Salah nominal/);
  s = act(s, "saveTransaction", { ...s.transactions[0], memberId: "m-selma", correctionReason: "Koreksi nama anggota" });
  assert.equal(memberAccount(s, s.members.find(m => m.id === "m-qai")).arrears, 40000);
  assert.equal(memberAccount(s, s.members.find(m => m.id === "m-selma")).arrears, 15000);
  s = act(s, "saveTransaction", { ...s.transactions[0], kind: "income", category: "Donasi", correctionReason: "Koreksi jenis penerimaan" });
  assert.equal(s.transactions[0].memberId, null); assert.equal(cashBalance(s), 25000);
  assert.equal(validateBackup(s).transactions[0].id, old.id);
});

test("Edit penerimaan dan hapus transaksi tidak boleh membuat kas negatif", () => {
  let s = act(initialLedger(), "settings", { ...initialLedger().settings, openingCashConfirmed: true });
  s = pay(s, "m-qai", 40000);
  s = act(s, "saveTransaction", { kind: "expense", amount: 30000, date: today(), title: "Kegiatan", category: "Kegiatan", method: "Tunai" });
  assert.throws(() => act(s, "saveTransaction", { ...s.transactions[0], amount: 20000, correctionReason: "Koreksi nominal" }), /Saldo kas tidak cukup/);
  assert.throws(() => act(s, "deleteTransaction", { id: s.transactions[0].id, reason: "Salah catat" }), /Saldo kas tidak cukup/);
  assert.equal(cashBalance(s), 10000); assert.equal(s.transactions[0].amount, 40000);
  s = act(s, "deleteTransaction", { id: s.transactions[1].id, reason: "Pengeluaran batal" });
  assert.equal(cashBalance(s), 40000); assert.equal(s.transactions.length, 2);
  assert.throws(() => act(s, "saveTransaction", { ...s.transactions[1], correctionReason: "Coba edit" }), /sudah dihapus/);
});

test("CRUD tagihan individual menolak duplikat dan menghitung ulang kredit", () => {
  let s = act(initialLedger(), "saveBill", { memberId: "m-dzuka", period: "2026-11", amount: 10000 });
  const bill = s.bills[0]; assert.deepEqual(billAccount(s, bill), { paid: 10000, remaining: 0 });
  assert.throws(() => act(s, "saveBill", { memberId: "m-dzuka", period: "2026-11", amount: 20000 }), /sudah memiliki/);
  s = act(s, "saveBill", { ...bill, amount: 5000, correctionReason: "Tarif khusus" });
  assert.equal(s.bills.length, 1); assert.equal(s.bills[0].createdAt, bill.createdAt);
  assert.equal(memberAccount(s, s.members[0]).credit, 5000); assert.equal(cashBalance(s), 0);
  s = act(s, "deleteBill", { id: bill.id, reason: "Tagihan salah periode" });
  assert.equal(memberAccount(s, s.members[0]).credit, 10000);
  assert.throws(() => act(s, "saveBill", { ...bill, correctionReason: "Edit catatan dihapus" }), /sudah dihapus/);
  s = act(s, "saveBill", { memberId: "m-dzuka", period: "2026-11", amount: 15000 });
  assert.equal(s.bills.filter(b => !b.voidedAt).length, 1); assert.equal(validateBackup(s).bills.length, 2);
});

test("CRUD menolak ID yang hilang serta payload tidak valid", () => {
  const s = initialLedger();
  assert.throws(() => act(s, "saveTransaction", { id: "missing" }), /tidak ditemukan/);
  assert.throws(() => act(s, "saveBill", { id: "missing" }), /tidak ditemukan/);
  assert.throws(() => act(s, "deleteMember", { id: "missing", reason: "Salah" }), /tidak ditemukan/);
  assert.throws(() => act(s, "saveMember", null), /tidak valid/);
  assert.throws(() => act(s, "saveMember", []), /tidak valid/);
});

test("Tagihan lama tetap dapat dikoreksi setelah bulan mulai iuran diubah", () => {
  let s = act(initialLedger(), "saveBill", { memberId: "m-raffa", period: "2026-11", amount: 10000 });
  s = act(s, "settings", { ...s.settings, billingStartMonth: "2026-12" });
  s = act(s, "saveBill", { ...s.bills[0], amount: 15000, correctionReason: "Koreksi nominal tagihan lama" });
  assert.equal(s.bills[0].amount, 15000);
  assert.throws(() => act(s, "saveBill", { memberId: "m-alizha", period: "2026-11", amount: 10000 }), /Periode/);
});
