import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { applyAction, initialLedger, LedgerError } from "../../../lib/ledger";
import type { Ledger } from "../../../lib/ledger";
export const dynamic = "force-dynamic";
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
async function current(){
  const user=await getChatGPTUser();if(!user)throw new LedgerError("Masuk dengan ChatGPT untuk membuka buku kas ini.",401);if(!env.DB)throw new LedgerError("Penyimpanan belum tersedia. Coba lagi beberapa saat.",503);
  let row=await env.DB.prepare("SELECT * FROM kas_ledgers WHERE id = ?").bind("main").first<{owner_user_id:string;payload:string;revision:number;updated_at:string}>();
  if(!row){await env.DB.prepare("INSERT OR IGNORE INTO kas_ledgers (id, owner_user_id, payload, revision, updated_at) VALUES (?, ?, ?, 0, ?)").bind("main",user.userId,JSON.stringify(initialLedger()),new Date().toISOString()).run();row=await env.DB.prepare("SELECT * FROM kas_ledgers WHERE id = ?").bind("main").first<{owner_user_id:string;payload:string;revision:number;updated_at:string}>();}
  if(!row || row.owner_user_id!==user.userId)throw new LedgerError("Buku kas ini hanya dapat diakses oleh pemilik aplikasi.",403);return {row,db:env.DB,state:JSON.parse(row.payload) as Ledger};
}
function failure(e:unknown){if(e instanceof LedgerError)return response({error:e.message},e.status);console.error("Kas storage failed",e instanceof Error?e.message:"unknown");return response({error:"Data belum dapat disimpan. Coba lagi. Perubahan belum diterapkan."},503);}
export async function GET(){try{const {state,row}=await current();return response({state,revision:row.revision,updatedAt:row.updated_at});}catch(e){return failure(e);}}
export async function POST(request:Request){try{
  const origin=request.headers.get("origin");if(origin && origin!==new URL(request.url).origin)throw new LedgerError("Permintaan dari situs lain ditolak.",403);if(!request.headers.get("content-type")?.includes("application/json"))throw new LedgerError("Format permintaan tidak valid.",415);
  const raw=await request.text();if(raw.length>2_000_000)throw new LedgerError("File terlalu besar.",413);let input:any;try{input=JSON.parse(raw);}catch{throw new LedgerError("Data tidak valid.");}
  if(typeof input.requestId!=="string" || !/^[a-zA-Z0-9-]{10,100}$/.test(input.requestId) || !Number.isSafeInteger(input.revision))throw new LedgerError("Identitas penyimpanan tidak valid.");
  const {state,row,db}=await current();if(state.appliedRequests.includes(input.requestId))return response({state,revision:row.revision,updatedAt:row.updated_at,message:"Perubahan sudah tersimpan."});
  if(row.revision!==input.revision)return response({error:"Data berubah di perangkat lain. Data terbaru sudah dimuat. Periksa isian, lalu simpan kembali.",state,revision:row.revision,updatedAt:row.updated_at},409);
  const result=applyAction(state,input.action,input.payload,input.requestId,state.settings.treasurer),updatedAt=new Date().toISOString();
  const write=await db.prepare("UPDATE kas_ledgers SET payload = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?").bind(JSON.stringify(result.state),updatedAt,"main",row.revision).run();if(write.meta.changes!==1)throw new LedgerError("Data berubah saat disimpan. Muat ulang, lalu coba kembali.",409);
  return response({state:result.state,revision:row.revision+1,updatedAt,message:result.message});
}catch(e){return failure(e);}}
