# Panduan Instalasi — Kas OSIS EPIS-JH CRUD + Login/Register

## 1. Persiapan

1. Ekstrak ZIP dan buka folder `Kas_OSIS_EPIS_JH` yang berisi `package.json`.
2. Pasang Node.js 24.
3. Buka Terminal atau PowerShell di folder tersebut.
4. Pasang pnpm:

```sh
npm install --global pnpm@11.25.0
```

Aplikasi menggunakan Cloudflare Workers dan D1 SQLite. Tidak membutuhkan PHP, XAMPP, atau MySQL. Koneksi internet diperlukan untuk instalasi dependensi pertama.

## 2. Instalasi baru

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm db:migrate
pnpm dev
```

`pnpm db:migrate` membuat tabel buku kas, akun, sesi, dan pembatasan percobaan pada database lokal. Wrangler mencatat migrasi yang sudah diterapkan sehingga perintah ini dapat dijalankan kembali tanpa mengulang migrasi.

Buka `http://localhost:5173` atau alamat yang tercetak di terminal. Halaman utama mengarahkan pengguna yang belum masuk ke `/login`.

## 3. Register, login, dan logout

1. Klik **Register akun baru** pada halaman login.
2. Isi nama lengkap, email, kata sandi 12–128 karakter, dan konfirmasi kata sandi.
3. Klik **Daftar akun**. Setelah berhasil, aplikasi membuka buku kas akun tersebut.
4. Untuk keluar, klik ikon logout di bagian atas atau **Keluar dari akun** pada Pengaturan.
5. Untuk masuk lagi, gunakan email dan kata sandi pada halaman Login.

Tidak ada akun bawaan. Email tidak boleh terdaftar dua kali; perbedaan huruf besar/kecil tidak menghasilkan akun lain. Sesi berlaku 7 hari. Logout membatalkan sesi di server. Terlalu banyak percobaan login akan dibatasi selama 10 menit, sedangkan pendaftaran dibatasi per jam.

Setiap akun memiliki buku kas sendiri. Akun baru tidak otomatis mendapat data akun lain. Email belum menggunakan verifikasi dan belum tersedia fitur lupa kata sandi.

## 4. Pengaturan dan CRUD

- **Pengaturan**: isi identitas organisasi, nama bendahara, tarif iuran, bulan mulai tagihan, serta saldo kas yang benar-benar tersedia per 1 Oktober 2026. Konfirmasikan saldo awal sebelum membuat pengeluaran.
- **Anggota**: gunakan Tambah anggota, klik nama untuk melihat detail, ikon pensil untuk edit, dan ikon tempat sampah untuk hapus. Anggota dengan saldo iuran awal, tagihan, atau riwayat transaksi harus diarsipkan melalui Edit anggota → Keaktifan → Diarsipkan.
- **Transaksi**: gunakan Catat transaksi untuk iuran, pemasukan, atau pengeluaran. Ikon pensil mengedit catatan yang ada; perubahan membutuhkan alasan dan menghitung ulang saldo. Ikon tempat sampah menghapus catatan dari perhitungan dengan alasan. Centang Tampilkan yang dihapus untuk melihat catatan tersebut.
- **Iuran bulanan**: Buat tagihan membuat tagihan bagi anggota aktif yang belum ditagih. Tambah tagihan membuat satu tagihan untuk anggota tertentu. Ikon pensil mengedit tagihan; ikon tempat sampah menghapusnya dari kewajiban aktif. Satu anggota hanya memiliki satu tagihan aktif untuk setiap bulan.
- **Laporan**: pilih bulan, unduh CSV, atau cetak dan pilih Simpan sebagai PDF.

Transaksi yang diedit tidak menjadi transaksi baru. Riwayat perubahan mencatat keadaan sebelum dan sesudah koreksi. Penghapusan transaksi/tagihan mempertahankan catatan asli dan mengabaikannya dalam perhitungan. Edit atau hapus yang membuat saldo kas negatif akan ditolak.

## 5. Meningkatkan instalasi lama

Sebelum mengganti kode lama, masuk ke aplikasi lama dan **unduh cadangan JSON melalui Pengaturan**. Kode sumber ZIP tidak memuat transaksi yang kemudian dicatat pada aplikasi online.

### Jika migrasi lama dijalankan secara manual

Panduan versi sebelumnya menggunakan `d1 execute --file` untuk membuat `kas_ledgers`. Perintah tersebut tidak mencatat riwayat migrasi Wrangler. Jika itu cara Anda memasang versi lama, jalankan hanya migrasi baru setelah build:

```sh
pnpm install --frozen-lockfile
pnpm build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_auth_accounts.sql
pnpm dev
```

Jalankan SQL baru tersebut satu kali. Jangan menggunakan `pnpm db:migrate` pada database lama yang tabel awalnya dibuat manual, karena Wrangler akan menganggap migrasi awal belum diterapkan dan pembuatan tabel yang sudah ada akan gagal. Alternatifnya, gunakan instalasi baru di folder terpisah dan pulihkan cadangan JSON.

### Jika migrasi lama memakai riwayat Wrangler

Setelah memasang kode baru dan menjalankan build, gunakan `pnpm db:migrate`; hanya migrasi yang belum tercatat akan diterapkan.

Setelah database siap:

1. Buka Register dan buat akun email baru.
2. Masuk ke Pengaturan → Pulihkan cadangan.
3. Pilih cadangan JSON dari versi lama, periksa ringkasannya, lalu ketik `PULIHKAN`.
4. Periksa saldo, anggota, tagihan, dan transaksi.

Baris buku kas lama `main` tidak dihapus atau dialihkan ke pendaftar. Akun baru memakai buku kas berdasarkan identitas sesi. Akun ChatGPT lama tidak berubah menjadi akun email secara otomatis.

## 6. Menjalankan hasil build

```sh
pnpm build
pnpm start
```

Buka alamat yang tercetak di terminal. Hasil build juga memakai login email/kata sandi yang sama, tanpa identitas simulasi. Database lokal tetap menggunakan `.wrangler/state`. Biarkan terminal berjalan selama aplikasi dipakai; hentikan dengan Ctrl+C.

## 7. Pemeriksaan kode

```sh
pnpm test
pnpm test:runtime
pnpm exec tsc --noEmit
pnpm build
```

`pnpm test` memeriksa logika kas, autentikasi dengan SQLite, isolasi akun, serta render awal. `pnpm test:runtime` menjalankan autentikasi dan CRUD pada runtime Workers/D1, termasuk hashing kata sandi yang benar-benar digunakan aplikasi. Pemeriksaan ini tidak menggantikan pemeriksaan tampilan dan interaksi melalui browser.

## 8. Berkas penting

- `app/login/page.tsx`, `app/register/page.tsx`: halaman akun.
- `components/auth-form.tsx`: formulir login/register.
- `app/api/auth/`: API register, login, logout, dan sesi.
- `lib/auth.ts`, `lib/password.ts`, `lib/http.ts`: autentikasi, hashing, dan validasi permintaan.
- `app/page.tsx`: halaman utama yang dilindungi login.
- `app/api/ledger/route.ts`: penyimpanan buku kas per akun.
- `components/kas-app.tsx`: antarmuka CRUD dan laporan.
- `lib/ledger.ts`: logika kas, validasi, dan jejak perubahan.
- `db/schema.ts`, `drizzle/`: skema serta dua migrasi SQL.
- `scripts/migrate-db.mjs`: migrasi lokal dengan riwayat Wrangler.
- `tests/`: pengujian logika, API, render, dan runtime.

## 9. Penempatan online

Gunakan backend Cloudflare Workers dengan database D1 milik Anda atau lingkungan Sites yang mendukung proyek ini. Jalankan migrasi `0000_dusty_hammerhead.sql` dan `0001_auth_accounts.sql` pada database produksi baru; untuk database produksi lama, terapkan hanya migrasi yang belum ada. Gunakan HTTPS agar cookie sesi memakai Secure.

Konfigurasi sumber memakai ID D1 placeholder untuk pengembangan lokal. ID database produksi, kredensial, data transaksi online, serta akun dan sesi tidak disertakan. Mengganti ZIP ini tidak memperbarui aplikasi online secara otomatis.

Cadangan JSON menyimpan buku kas, bukan akun login. Cadangkan database D1 secara terpisah jika ingin memindahkan akun dan seluruh sesi ke instalasi lain.

Karya awal: Raden Adrian Kahfi dan Fahir Raffa Danishwara.
