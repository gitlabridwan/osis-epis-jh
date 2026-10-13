# Kas OSIS EPIS-JH

Aplikasi buku kas berbahasa Indonesia, dikembangkan dari https://fahirraffa-prog.github.io/List-uang-kas-osis/.

## Isi aplikasi

- 12 anggota dan saldo iuran asli per 1 Oktober 2026.
- Pembayaran iuran, pemasukan lain, pengeluaran, dan bukti transaksi.
- Tagihan bulanan, pelunasan kewajiban paling lama, dan kelebihan pembayaran.
- Anggota aktif dan arsip, pencarian, serta filter.
- Laporan bulanan CSV dan cetak ke PDF.
- Cadangan JSON, pemulihan dengan validasi, serta jejak perubahan.
- Penyimpanan D1 online dengan revisi atomik dan permintaan idempoten.
- Akses pribadi mengikuti akun pemilik melalui autentikasi Sites.

## Pengaturan awal

Saldo kas lama tidak ada pada sumber dan tidak diasumsikan. Pengguna harus mengonfirmasi kas tersedia per 1 Oktober 2026 sebelum mencatat pengeluaran. Iuran Rp10.000 dan bulan mulai November 2026 merupakan nilai awal yang dapat disesuaikan, dan tidak membuat tagihan otomatis.

Saldo awal iuran anggota merupakan posisi kewajiban atau kredit, bukan penerimaan baru. Saldo awal uang kas sudah harus mencakup penerimaan lama, termasuk kelebihan pembayaran lama.

## Teknologi dan pemeriksaan

Vinext / React / TypeScript pada Cloudflare Workers, D1 SQLite. Instalasi, build, dan publikasi mengikuti helper Sites. Migrasi Drizzle pada folder drizzle.

- `node scripts/run-tests.mjs` memeriksa perhitungan kas dan alur API dengan SQLite lokal tanpa server.
- `node node_modules/typescript/bin/tsc --noEmit` memeriksa tipe.
- Helper build Sites menghasilkan paket yang siap dipublikasikan.

## Batas versi ini

Akses pribadi untuk satu pemilik. Tidak ada peran multi-pengguna atau lampiran foto bukti. Nomor bukti dapat dicatat. Tagihan dibuat secara manual per bulan. Data dalam satu buku kas memiliki batas 1,5 MB; riwayat perubahan menyimpan 2.000 perubahan terbaru.

Karya awal: Raden Adrian Kahfi dan Fahir Raffa Danishwara.
