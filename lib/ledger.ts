export type Settings = { orgName: string; schoolName: string; term: string; treasurer: string; monthlyDue: number; billingStartMonth: string; snapshotDate: string; openingCash: number; openingCashConfirmed: boolean };
export type Member = { id: string; name: string; division: string; className: string; joinedMonth: string; active: boolean; openingDue: number; openingCredit: number };
export type Transaction = { id: string; kind: "dues" | "income" | "expense"; memberId: string | null; amount: number; date: string; title: string; category: string; method: string; reference: string; createdAt: string; voidedAt: string | null; voidReason: string };
export type Bill = { id: string; memberId: string; period: string; amount: number; createdAt: string; voidedAt: string | null; voidReason: string };
export type Audit = { id: string; at: string; action: string; detail: string; actor: string };
export type Ledger = { schemaVersion: 1; settings: Settings; members: Member[]; transactions: Transaction[]; bills: Bill[]; audit: Audit[]; appliedRequests: string[] };
export const DIVISIONS = ["Ketua", "Wakil Ketua", "Sekretaris", "Bendahara", "Jurnalistik", "Olahraga & Seni", "Kerohanian"];
export class LedgerError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta" }).format(new Date());
export function initialLedger(): Ledger {
  const snapshot = [["Dzuka","Sekretaris",0,10000],["Qai","Ketua",40000,0],["Alizha","Jurnalistik",0,0],["Raffa","Bendahara",0,0],["Kaira","Bendahara",0,0],["Gege","Olahraga & Seni",0,10000],["Selma","Wakil Ketua",40000,0],["Irzha","Olahraga & Seni",0,10000],["Sabrina","Kerohanian",0,0],["Mischa","Jurnalistik",0,20000],["Ayla","Sekretaris",0,10000],["Dheva","Kerohanian",0,10000]];
  return { schemaVersion:1, settings:{orgName:"OSIS EPIS-JH",schoolName:"",term:"2026/2027",treasurer:"Bendahara",monthlyDue:10000,billingStartMonth:"2026-11",snapshotDate:"2026-10-01",openingCash:0,openingCashConfirmed:false},
    members:snapshot.map(([name,division,due,credit])=>({id:"m-"+String(name).toLowerCase(),name:String(name),division:String(division),className:"",joinedMonth:"2026-10",active:true,openingDue:Number(due),openingCredit:Number(credit)})),
    transactions:[],bills:[],appliedRequests:[],audit:[{id:"initial-import",at:"2026-10-01T00:00:00.000Z",action:"Impor awal",detail:"12 anggota dan saldo iuran diimpor dari List Uang Kas OSIS EPIS-JH per 1 Oktober 2026. Saldo uang kas tidak tersedia pada sumber.",actor:"Aplikasi"}] };
}
export function memberAccount(state:Ledger,member:Member,throughMonth="9999-12") {
  const due=member.openingDue+state.bills.filter(b=>b.memberId===member.id && !b.voidedAt && b.period<=throughMonth).reduce((n,b)=>n+b.amount,0);
  const paid=member.openingCredit+state.transactions.filter(t=>t.memberId===member.id && t.kind==="dues" && !t.voidedAt && t.date.slice(0,7)<=throughMonth).reduce((n,t)=>n+t.amount,0);
  return {due,paid,arrears:Math.max(0,due-paid),credit:Math.max(0,paid-due),settled:paid>=due};
}
export function billAccount(state:Ledger,bill:Bill,throughMonth="9999-12") {
  const m=state.members.find(m=>m.id===bill.memberId);
  if(!m || bill.voidedAt) return {paid:0,remaining:0};
  const funds=m.openingCredit+state.transactions.filter(t=>t.kind==="dues" && t.memberId===m.id && !t.voidedAt && t.date.slice(0,7)<=throughMonth).reduce((n,t)=>n+t.amount,0);
  const prior=m.openingDue+state.bills.filter(b=>b.memberId===m.id && !b.voidedAt && b.period<bill.period).reduce((n,b)=>n+b.amount,0);
  const paid=Math.max(0,Math.min(bill.amount,funds-prior)); return {paid,remaining:bill.amount-paid};
}
export function cashBalance(state:Ledger,throughDate="9999-12-31") {
  return state.settings.openingCash+state.transactions.filter(t=>!t.voidedAt && t.date<=throughDate).reduce((n,t)=>n+(t.kind==="expense"?-t.amount:t.amount),0);
}
export function monthlyReport(state:Ledger,period:string) {
  const valid=state.transactions.filter(t=>!t.voidedAt),rows=valid.filter(t=>t.date.slice(0,7)===period).sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
  const opening=state.settings.openingCash+valid.filter(t=>t.date.slice(0,7)<period).reduce((n,t)=>n+(t.kind==="expense"?-t.amount:t.amount),0);
  const income=rows.filter(t=>t.kind!=="expense").reduce((n,t)=>n+t.amount,0),expense=rows.filter(t=>t.kind==="expense").reduce((n,t)=>n+t.amount,0);
  return {rows,opening,income,expense,closing:opening+income-expense};
}
function text(value:unknown,label:string,max=100):string {
  if(typeof value!=="string" || !value.trim() || value.trim().length>max) throw new LedgerError(label+" wajib diisi (maksimal "+max+" karakter)."); return value.trim();
}
function optional(value:unknown,max=200):string { if(value==null)return "";if(typeof value!=="string" || value.length>max)throw new LedgerError("Teks terlalu panjang atau tidak valid.");return value.trim(); }
function amount(value:unknown,label="Nominal",zero=false):number {
  if(typeof value!=="number" || !Number.isSafeInteger(value) || value<(zero?0:1) || value>10_000_000_000)throw new LedgerError(label+" harus berupa rupiah bulat "+(zero?"minimal 0":"lebih dari 0")+" dan maksimal Rp10 miliar.");return value;
}
function month(value:unknown):string {if(typeof value!=="string" || !/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(value))throw new LedgerError("Periode bulan tidak valid.");return value;}
function date(value:unknown):string {if(typeof value!=="string" || !/^20\d{2}-(0[1-9]|1[0-2])-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0,10)!==value)throw new LedgerError("Tanggal tidak valid.");return value;}
function timestamp(value:unknown):string { const v=text(value,"Waktu",40); if(!/^\d{4}-\d{2}-\d{2}T/.test(v) || Number.isNaN(Date.parse(v)))throw new LedgerError("Waktu dalam cadangan tidak valid."); return v; }
function bool(value:unknown):boolean {if(typeof value!=="boolean")throw new LedgerError("Nilai pilihan tidak valid.");return value;}
function checkCash(state:Ledger) {
  let balance=state.settings.openingCash;const days=new Map<string,number>();
  for(const t of state.transactions.filter(t=>!t.voidedAt))days.set(t.date,(days.get(t.date)||0)+(t.kind==="expense"?-t.amount:t.amount));
  for(const d of [...days.keys()].sort()){balance+=days.get(d)!;if(balance<0)throw new LedgerError("Saldo kas tidak cukup pada "+d+". Periksa saldo awal atau transaksi sebelumnya.");}
}
function validateMember(p:any):Member {
  const openingDue=amount(p.openingDue,"Tunggakan awal",true),openingCredit=amount(p.openingCredit,"Kelebihan awal",true);
  if(openingDue && openingCredit)throw new LedgerError("Anggota tidak boleh memiliki tunggakan awal dan kelebihan awal sekaligus.");
  return {id:text(p.id,"ID"),name:text(p.name,"Nama",80),division:text(p.division,"Divisi",80),className:optional(p.className,30),joinedMonth:month(p.joinedMonth),active:bool(p.active),openingDue,openingCredit};
}
function validateSettings(p:any,snapshotDate:string):Settings {return {orgName:text(p.orgName,"Nama organisasi",80),schoolName:optional(p.schoolName,100),term:text(p.term,"Tahun kepengurusan",30),treasurer:text(p.treasurer,"Nama bendahara",80),monthlyDue:amount(p.monthlyDue,"Iuran bulanan"),billingStartMonth:month(p.billingStartMonth),snapshotDate,openingCash:amount(p.openingCash,"Saldo awal",true),openingCashConfirmed:bool(p.openingCashConfirmed)};}
export function validateBackup(p:any):Ledger {
  if(!p || p.schemaVersion!==1 || !Array.isArray(p.members) || !Array.isArray(p.transactions) || !Array.isArray(p.bills))throw new LedgerError("File bukan cadangan Kas OSIS versi 1.");
  if(p.members.length>1000 || p.transactions.length>10000 || p.bills.length>12000)throw new LedgerError("Cadangan terlalu besar.");
  const settings=validateSettings(p.settings,date(p.settings?.snapshotDate)),members:Member[]=p.members.map(validateMember),ids=new Set(members.map(m=>m.id));
  if(ids.size!==members.length)throw new LedgerError("ID anggota dalam cadangan berulang.");
  const transactions:Transaction[]=p.transactions.map((t:any)=>{
    if(!["dues","income","expense"].includes(t.kind))throw new LedgerError("Jenis transaksi tidak valid.");
    if(t.kind==="dues" && !ids.has(t.memberId))throw new LedgerError("Anggota pada transaksi tidak ditemukan.");
    const d=date(t.date);if(d<settings.snapshotDate || d>today())throw new LedgerError("Tanggal transaksi di luar periode pembukuan.");
    if(!["Tunai","Transfer","E-wallet"].includes(t.method))throw new LedgerError("Metode pembayaran tidak valid.");
    return {id:text(t.id,"ID"),kind:t.kind,memberId:t.kind==="dues"?t.memberId:null,amount:amount(t.amount),date:d,title:text(t.title,"Keterangan",180),category:text(t.category,"Kategori",80),method:t.method,reference:optional(t.reference,100),createdAt:timestamp(t.createdAt),voidedAt:t.voidedAt?timestamp(t.voidedAt):null,voidReason:optional(t.voidReason,200)};
  });
  if(new Set(transactions.map(t=>t.id)).size!==transactions.length)throw new LedgerError("ID transaksi berulang.");
  const seen=new Set<string>();
  const bills:Bill[]=p.bills.map((b:any)=>{
    if(!ids.has(b.memberId))throw new LedgerError("Anggota pada tagihan tidak ditemukan.");
    const period=month(b.period);if(period<settings.snapshotDate.slice(0,7))throw new LedgerError("Tagihan mendahului data awal.");
    const key=b.memberId+period;if(!b.voidedAt && seen.has(key))throw new LedgerError("Tagihan bulanan berulang.");if(!b.voidedAt)seen.add(key);
    return {id:text(b.id,"ID"),memberId:b.memberId,period,amount:amount(b.amount),createdAt:timestamp(b.createdAt),voidedAt:b.voidedAt?timestamp(b.voidedAt):null,voidReason:optional(b.voidReason,200)};
  });
  if(new Set(bills.map(b=>b.id)).size!==bills.length)throw new LedgerError("ID tagihan berulang.");
  const audit:Audit[]=Array.isArray(p.audit)?p.audit.slice(-2000).map((a:any)=>({id:text(a.id,"ID"),at:timestamp(a.at),action:text(a.action,"Aksi"),detail:text(a.detail,"Detail",1000),actor:text(a.actor,"Pelaksana",80)})):[];
  const state:Ledger={schemaVersion:1,settings,members,transactions,bills,audit,appliedRequests:[]};checkCash(state);
  if(!settings.openingCashConfirmed && transactions.some(t=>t.kind==="expense" && !t.voidedAt))throw new LedgerError("Cadangan pengeluaran membutuhkan saldo awal yang sudah dikonfirmasi.");return state;
}
export function applyAction(original:Ledger,action:string,p:any,requestId:string,actor="Bendahara"):{state:Ledger;message:string} {
  if(original.appliedRequests.includes(requestId))return {state:original,message:"Perubahan sudah tersimpan."};
  let state:Ledger=structuredClone(original);const now=new Date().toISOString(),id=()=>crypto.randomUUID();let message="",detail="";
  switch(action){
    case "saveMember":{
      const old=p.id?state.members.find(m=>m.id===p.id):undefined;if(p.id && !old)throw new LedgerError("Anggota tidak ditemukan.",404);
      const m=validateMember({...p,id:old?.id||id()});if(state.members.some(a=>a.id!==m.id && a.name.toLocaleLowerCase()===m.name.toLocaleLowerCase()))throw new LedgerError("Nama anggota sudah terdaftar. Gunakan nama lengkap agar berbeda.");
      if(m.joinedMonth<state.settings.snapshotDate.slice(0,7))throw new LedgerError("Bulan mulai anggota tidak boleh sebelum data awal.");
      if(old)state.members=state.members.map(a=>a.id===m.id?m:a);else state.members.push(m);
      message=old?"Data anggota diperbarui.":"Anggota berhasil ditambahkan.";detail=m.name+" · "+m.division+" · "+(m.active?"aktif":"diarsipkan")+" · tunggakan awal "+m.openingDue+", kelebihan awal "+m.openingCredit;break;
    }
    case "createBills":{
      const period=month(p.period),rate=amount(p.amount,"Iuran");if(period<state.settings.billingStartMonth || period<state.settings.snapshotDate.slice(0,7))throw new LedgerError("Tagihan dimulai dari "+state.settings.billingStartMonth+". Ubah bulan mulai di Pengaturan jika diperlukan.");
      const eligible=state.members.filter(m=>m.active && m.joinedMonth<=period && !state.bills.some(b=>b.memberId===m.id && b.period===period && !b.voidedAt));
      if(!eligible.length)throw new LedgerError("Tidak ada anggota yang perlu ditagih. Tagihan periode ini sudah dibuat atau anggota belum aktif.");
      for(const m of eligible)state.bills.push({id:id(),memberId:m.id,period,amount:rate,createdAt:now,voidedAt:null,voidReason:""});
      message=eligible.length+" tagihan berhasil dibuat.";detail=period+" · "+eligible.length+" anggota · Rp"+rate+" per anggota";break;
    }
    case "saveTransaction":{
      if(!["dues","income","expense"].includes(p.kind))throw new LedgerError("Jenis transaksi tidak valid.");const d=date(p.date);
      if(d<state.settings.snapshotDate || d>today())throw new LedgerError("Tanggal harus sejak "+state.settings.snapshotDate+" sampai hari ini.");
      const m=p.kind==="dues"?state.members.find(m=>m.id===p.memberId):null;if(p.kind==="dues" && !m)throw new LedgerError("Pilih anggota untuk pembayaran iuran.");
      if(p.kind==="expense" && !state.settings.openingCashConfirmed)throw new LedgerError("Konfirmasi saldo kas awal di Pengaturan sebelum mencatat pengeluaran.");
      if(!["Tunai","Transfer","E-wallet"].includes(p.method))throw new LedgerError("Metode pembayaran tidak valid.");
      const t:Transaction={id:id(),kind:p.kind,memberId:m?.id||null,amount:amount(p.amount),date:d,title:text(p.title,"Keterangan",180),category:p.kind==="dues"?"Iuran anggota":text(p.category,"Kategori",80),method:p.method,reference:optional(p.reference,100),createdAt:now,voidedAt:null,voidReason:""};
      state.transactions.push(t);checkCash(state);message="Transaksi berhasil disimpan.";detail=(m?m.name+" · ":"")+t.title+" · Rp"+t.amount+" · "+t.date+" · "+t.method;break;
    }
    case "voidTransaction":{
      const t=state.transactions.find(t=>t.id===p.id);if(!t || t.voidedAt)throw new LedgerError("Transaksi tidak ditemukan atau sudah dibatalkan.");t.voidReason=text(p.reason,"Alasan pembatalan",200);t.voidedAt=now;checkCash(state);
      message="Transaksi dibatalkan. Riwayat tetap tersimpan.";detail=t.title+" · Rp"+t.amount+" · alasan: "+t.voidReason;break;
    }
    case "voidBill":{
      const b=state.bills.find(b=>b.id===p.id);if(!b || b.voidedAt)throw new LedgerError("Tagihan tidak ditemukan atau sudah dibatalkan.");b.voidReason=text(p.reason,"Alasan pembatalan",200);b.voidedAt=now;
      message="Tagihan dibatalkan.";detail=b.period+" · "+state.members.find(m=>m.id===b.memberId)?.name+" · "+b.voidReason;break;
    }
    case "settings":{
      const next=validateSettings(p,state.settings.snapshotDate);if(next.billingStartMonth<next.snapshotDate.slice(0,7))throw new LedgerError("Bulan tagihan tidak boleh sebelum data awal.");
      if(!next.openingCashConfirmed && state.transactions.some(t=>t.kind==="expense" && !t.voidedAt))throw new LedgerError("Saldo awal tidak dapat dibatalkan setelah ada pengeluaran.");
      const old=state.settings;state.settings=next;checkCash(state);message="Pengaturan disimpan.";detail="Iuran Rp"+next.monthlyDue+", mulai "+next.billingStartMonth+". Saldo kas awal Rp"+old.openingCash+" → Rp"+next.openingCash+" ("+(next.openingCashConfirmed?"dikonfirmasi":"belum dikonfirmasi")+").";break;
    }
    case "restore":{if(p.confirmation!=="PULIHKAN")throw new LedgerError("Ketik PULIHKAN untuk mengganti data dari cadangan.");state=validateBackup(p.backup);message="Cadangan berhasil dipulihkan.";detail="Memulihkan "+state.members.length+" anggota dan "+state.transactions.length+" transaksi; sebelumnya "+original.transactions.length+" transaksi.";break;}
    default:throw new LedgerError("Aksi tidak dikenal.");
  }
  state.appliedRequests=[...original.appliedRequests,requestId].slice(-200);state.audit.push({id:id(),at:now,action:({saveMember:"Data anggota",createBills:"Tagihan bulanan",saveTransaction:"Transaksi kas",voidTransaction:"Pembatalan transaksi",voidBill:"Pembatalan tagihan",settings:"Pengaturan",restore:"Pemulihan cadangan"} as Record<string,string>)[action],detail,actor});state.audit=state.audit.slice(-2000);
  if(JSON.stringify(state).length>1_500_000)throw new LedgerError("Data mencapai batas penyimpanan. Unduh cadangan dan buat arsip periode.");return {state,message};
}
