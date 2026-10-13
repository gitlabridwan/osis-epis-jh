"use client";
import { useId, useState } from "react";
import { AlertCircle, ArrowRight, Eye, EyeOff, RefreshCw, ShieldCheck, Wallet } from "lucide-react";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const register = mode === "register", id = useId();
  const [name, setName] = useState(""), [email, setEmail] = useState("");
  const [password, setPassword] = useState(""), [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (register && password !== confirmPassword) { setError("Konfirmasi kata sandi tidak sama."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/" + mode, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(register ? { name, email, password, confirmPassword } : { email, password }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Permintaan belum berhasil. Coba lagi.");
      window.location.replace("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Koneksi bermasalah. Coba lagi.");
      setBusy(false);
    }
  }

  return <main className="auth-screen">
    <div className="auth-container">
      <a href="/login" className="auth-brand"><span><Wallet size={26}/></span>Kas<b>OSIS</b></a>
      <section className="auth-card" aria-labelledby={id + "-title"}>
        <p className="auth-eyebrow">BUKU KAS ORGANISASI</p>
        <h1 id={id + "-title"}>{register ? "Buat akun baru" : "Selamat datang kembali"}<span>.</span></h1>
        <p className="auth-description">{register ? "Daftarkan akun untuk mulai mengelola buku kas Anda." : "Masuk untuk mengelola anggota, iuran, dan transaksi kas."}</p>
        <form onSubmit={submit}>
          <fieldset disabled={busy} className="auth-fields">
            {register && <div className="field"><label htmlFor={id + "-name"}>Nama lengkap</label><input id={id + "-name"} name="name" required maxLength={80} autoComplete="name" placeholder="Nama pengelola kas" value={name} onChange={event => setName(event.target.value)}/></div>}
            <div className="field"><label htmlFor={id + "-email"}>Email</label><input id={id + "-email"} name="email" type="email" required maxLength={254} autoComplete="username" placeholder="nama@contoh.com" value={email} onChange={event => setEmail(event.target.value)}/></div>
            <div className="field"><label htmlFor={id + "-password"}>Kata sandi</label><div className="auth-password"><input id={id + "-password"} name="password" type={showPassword ? "text" : "password"} required minLength={register ? 12 : undefined} maxLength={128} autoComplete={register ? "new-password" : "current-password"} placeholder={register ? "Minimal 12 karakter" : "Kata sandi Anda"} value={password} onChange={event => setPassword(event.target.value)}/><button type="button" aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>{register && <small>Gunakan frasa yang panjang dan mudah Anda ingat, maksimal 128 karakter.</small>}</div>
            {register && <div className="field"><label htmlFor={id + "-confirm"}>Konfirmasi kata sandi</label><input id={id + "-confirm"} name="confirmPassword" type={showPassword ? "text" : "password"} required minLength={12} maxLength={128} autoComplete="new-password" placeholder="Ulangi kata sandi" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)}/></div>}
          </fieldset>
          {error && <p className="form-error auth-error" role="alert"><AlertCircle size={17}/>{error}</p>}
          <button className="btn primary full auth-submit" type="submit" disabled={busy}>{busy ? <RefreshCw size={17} className="spinning"/> : <ArrowRight size={17}/>} {busy ? "Memproses…" : register ? "Daftar akun" : "Login"}</button>
        </form>
        <p className="auth-switch">{register ? "Sudah punya akun?" : "Belum punya akun?"} <a href={register ? "/login" : "/register"}>{register ? "Login di sini" : "Register akun baru"}</a></p>
      </section>
      <p className="auth-note"><ShieldCheck size={17}/><span>Setiap akun memiliki buku kas sendiri.<br/>Kelola kas dengan catatan yang jelas.</span></p>
    </div>
  </main>;
}
