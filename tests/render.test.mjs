import {test} from "node:test";
import assert from "node:assert/strict";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import AuthForm from "../.sites-runtime/test-build/auth-form.mjs";
import KasApp from "../.sites-runtime/test-build/kas-app.mjs";
test("Halaman awal merender data rujukan dan instruksi saldo tanpa akses browser",()=>{
  const html=renderToStaticMarkup(React.createElement(KasApp,{user:{id:"account-a",name:"Bendahara A",email:"a@example.test"}})).replace(/\u00a0/g, "");
  for(const text of ["Ringkasan kas","Anggota","Iuran bulanan","Transaksi","Laporan","Pengaturan","Dzuka","Qai","Rp80.000","Rp70.000","Lengkapi saldo awal kas.","Belum termasuk saldo kas lama"]){assert.ok(html.includes(text),text+" tidak dirender");}
  assert.equal((html.match(/aria-label="Cari anggota"/g)||[]).length,1);
  assert.ok(html.includes('aria-label="Periode laporan"'));
  assert.ok(!html.includes("Building your site"));
});

test("Form login dan register merender isian, navigasi, dan konfirmasi kata sandi",()=>{
  const login=renderToStaticMarkup(React.createElement(AuthForm,{mode:"login"}));
  const register=renderToStaticMarkup(React.createElement(AuthForm,{mode:"register"}));
  for(const text of ["Email","Kata sandi","Login","/register","current-password"]){assert.ok(login.includes(text),text);}
  for(const text of ["Nama lengkap","Konfirmasi kata sandi","Daftar akun","/login","new-password","minLength=\"12\""]){assert.ok(register.includes(text),text);}
  assert.ok(!login.includes("Konfirmasi kata sandi"));
});
