# Panduan Instalasi Kas OSIS EPIS-JH

Paket ini berisi kode sumber aplikasi, antarmuka, logika pencatatan kas, skema basis data, migrasi SQL, dan pengujian otomatis.

Aplikasi online: https://kas-osis-epis-jh.jigen836152.chatgpt.site
Aplikasi rujukan: https://fahirraffa-prog.github.io/List-uang-kas-osis/

## 1. Persiapan

1. Ekstrak ZIP ke folder yang dapat ditulis, misalnya C:\Aplikasi\Kas_OSIS_EPIS_JH.
2. Pasang Node.js 24, versi utama yang dipakai saat memverifikasi kode aplikasi.
3. Buka Terminal atau PowerShell dari folder yang berisi package.json.
4. Pasang pnpm sesuai versi paket:

```sh
npm install --global pnpm@11.25.0
```

Tidak perlu menginstal PHP, XAMPP, atau MySQL. Aplikasi menggunakan Node.js dan Cloudflare D1, dengan basis data SQLite untuk pengujian lokal.

## 2. Instal dependensi dan buat build

Jalankan dari folder proyek:

```sh
pnpm install --frozen-lockfile
pnpm build
```

Instalasi pertama membutuhkan koneksi internet. Folder node_modules tidak disertakan dalam ZIP.

## 3. Buat tabel basis data lokal

Setelah build berhasil, jalankan perintah berikut sebagai satu baris:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_dusty_hammerhead.sql
```

Jalankan migrasi awal ini satu kali untuk basis data lokal yang baru. Jangan menjalankannya ulang setelah tabel sudah ada. Berkas basis data lokal tersimpan di folder .wrangler/state.

## 4. Jalankan aplikasi

```sh
pnpm dev
```

Buka http://localhost:5173 atau alamat yang tercetak pada terminal. Biarkan terminal tetap berjalan selama aplikasi digunakan. Tekan Ctrl+C untuk menghentikannya.

Lingkungan pengembangan lokal memakai identitas masuk simulasi dari starter. Identitas ini hanya untuk pengujian pada komputer sendiri. Autentikasi aplikasi online mengikuti akun pemilik di Sites.

Perintah pnpm start menjalankan hasil build tanpa simulasi masuk. Gunakan pnpm dev untuk pengujian lokal aplikasi ini.

## 5. Isi pengaturan awal

1. Buka menu Pengaturan.
2. Isi nama sekolah, nama bendahara, dan tahun kepengurusan.
3. Konfirmasi saldo kas yang benar-benar tersedia per 1 Oktober 2026.
4. Sesuaikan nominal iuran dan bulan mulai tagihan.
5. Buka Iuran bulanan untuk membuat tagihan.
6. Gunakan Catat transaksi untuk pembayaran, pemasukan lain, atau pengeluaran.

Data awal mengikuti rujukan: 12 anggota, tunggakan Rp80.000, dan kelebihan pembayaran Rp70.000. Saldo uang kas lama tidak tersedia dalam rujukan. Default iuran Rp10.000 per bulan dan bulan mulai November 2026 dapat diubah.

Tagihan dan saldo awal iuran tidak menambah uang kas. Pembayaran baru menambah uang kas saat transaksi penerimaan dicatat.

## 6. Laporan dan cadangan

- Laporan: pilih bulan, unduh CSV, atau cetak lalu pilih Simpan sebagai PDF.
- Pengaturan: unduh cadangan JSON untuk menyimpan seluruh isi buku kas.
- Pulihkan cadangan JSON untuk memindahkan data ke instalasi aplikasi ini.

ZIP ini berisi kode sumber dan data awal rujukan. Data transaksi yang kemudian dicatat dalam aplikasi online tidak tersalin otomatis ke ZIP. Untuk memindahkan data tersebut, unduh cadangan JSON melalui aplikasi online dan pulihkan pada instalasi lokal.

## 7. Pemeriksaan kode

```sh
pnpm test
pnpm exec tsc --noEmit
```

Kode aplikasi telah melewati 15 pengujian otomatis, pemeriksaan TypeScript, dan build. Tampilan belum diperiksa langsung melalui browser pada sesi pembuatannya.

## 8. Struktur penting

- app/page.tsx: halaman utama.
- app/api/ledger/route.ts: API dan penyimpanan kas.
- components/kas-app.tsx: antarmuka dan formulir.
- app/globals.css: tampilan desktop, ponsel, dan cetak.
- lib/ledger.ts: data awal, tagihan, perhitungan, dan validasi.
- db/schema.ts: skema penyimpanan.
- drizzle/: migrasi basis data.
- tests/: pengujian perhitungan, API, dan render.
- pnpm-lock.yaml: versi dependensi untuk instalasi.

## 9. Penempatan online

Paket ini merupakan aplikasi dengan backend, sehingga tidak dapat ditempatkan langsung sebagai halaman statis di GitHub Pages. Publikasi penuh memerlukan lingkungan Cloudflare Workers dengan D1 dan autentikasi yang sesuai, atau alur Sites.

Konfigurasi ZIP tidak menyertakan ID publikasi aplikasi yang sudah online. Kode aplikasi tetap sama; pengaturan instalasi dibuat dapat digunakan pada komputer lain. Koneksi basis data produksi dan kredensial tidak disertakan.

Karya awal: Raden Adrian Kahfi dan Fahir Raffa Danishwara.
