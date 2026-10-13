# Kas OSIS EPIS-JH — CRUD, Login & Register

Aplikasi buku kas berbahasa Indonesia dengan akun email dan kata sandi. Kode ini mempertahankan pencatatan kas dan data rujukan dari proyek yang dilampirkan, lalu menambahkan autentikasi aplikasi serta CRUD yang lebih lengkap.

## Fitur

- **Register** akun menggunakan nama, email unik, kata sandi, dan konfirmasi kata sandi. Pendaftaran berhasil langsung membuat sesi login.
- **Login / logout**, sesi 7 hari, dan proteksi halaman utama serta seluruh API buku kas.
- **Buku kas terpisah per akun**. Identitas pemilik ditentukan oleh sesi server; akun baru tidak dapat membaca atau mengubah buku kas akun lain.
- **CRUD anggota**: tambah, lihat, edit, dan hapus. Anggota yang memiliki saldo iuran awal atau riwayat keuangan harus diarsipkan agar referensi tetap utuh.
- **CRUD transaksi**: pembayaran iuran, pemasukan lain, pengeluaran, bukti, edit dengan alasan, dan hapus dengan alasan.
- **CRUD tagihan**: buat bulanan atau per anggota, lihat pelunasan, edit periode/nominal/anggota, dan hapus dengan alasan.
- Perubahan transaksi menghitung ulang kas dan iuran. ID serta waktu pencatatan asli tetap dipertahankan; perubahan dicatat dalam audit.
- Penghapusan transaksi/tagihan mengeluarkan catatan dari perhitungan aktif. Catatan asli tetap tersimpan untuk pemeriksaan.
- Laporan bulanan CSV, cetak PDF, pencarian, filter, cadangan JSON, dan pemulihan.
- Saldo tidak boleh negatif, tagihan ganda ditolak, dan penyimpanan tetap menggunakan revisi atomik serta request idempoten.

Kata sandi disimpan sebagai hash scrypt dengan salt acak, bukan teks asli. Token sesi acak disimpan sebagai hash di database, dikirim lewat cookie HttpOnly dan SameSite=Lax, serta menggunakan Secure pada HTTPS. Login dan register memakai pembatasan percobaan berbasis database dan pemeriksaan asal permintaan.

## Menjalankan

Gunakan Node.js 24 dan pnpm 11.25.0. Jalankan dari folder proyek:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm db:migrate
pnpm dev
```

Buka `http://localhost:5173`, pilih **Register akun baru**, lalu buat akun Anda. Tidak ada akun atau kata sandi bawaan. Panduan pemasangan dan peningkatan versi tersedia di `PANDUAN_INSTALASI.md`.

## Data awal dan data lama

Setiap akun mulai dari 12 anggota serta posisi iuran rujukan per 1 Oktober 2026. Saldo kas lama tidak diasumsikan. Iuran Rp10.000 dan bulan mulai November 2026 dapat disesuaikan. Konfirmasikan saldo awal di Pengaturan sebelum mencatat pengeluaran.

Buku kas lama dengan ID `main` tetap berada di database, tetapi tidak diberikan otomatis kepada pendaftar baru. Sebelum meningkatkan instalasi lama, unduh cadangan JSON dari aplikasi lama. Setelah register di versi ini, pulihkan cadangan tersebut melalui Pengaturan. ZIP sumber tidak menyertakan transaksi, akun, atau sesi dari instalasi online.

## Pemeriksaan

```sh
pnpm test
pnpm test:runtime
pnpm exec tsc --noEmit
pnpm build
```

Pengujian mencakup perhitungan kas, CRUD, validasi register/login, sesi kedaluwarsa, logout, pembatasan percobaan, isolasi akun, konflik penyimpanan, render awal formulir, serta autentikasi dan CRUD pada runtime Workers/D1 asli. Pemeriksaan render awal bukan pengujian interaksi melalui browser.

## Teknologi dan batas

Vinext / React / TypeScript, Cloudflare Workers, D1 SQLite, dan migrasi Drizzle. Aplikasi memiliki backend dan tidak dapat dipasang langsung sebagai halaman statis di GitHub Pages. Untuk penempatan Cloudflare, gunakan database D1 milik Anda dan jalankan kedua migrasi SQL; ID database produksi serta kredensial tidak disertakan.

Versi ini menggunakan buku kas per akun. Belum ada akses bersama atau peran admin/staf, verifikasi email, maupun pemulihan kata sandi. Cadangan buku kas tidak memuat akun atau kata sandi. Batas satu buku kas adalah 1,5 MB, dengan 2.000 jejak perubahan terbaru.

Karya awal: Raden Adrian Kahfi dan Fahir Raffa Danishwara.
