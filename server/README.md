# Hacktiv Chess Backend

Backend untuk MVP game catur online. API dirancang menggunakan Node.js dan Express, dengan PostgreSQL/Sequelize untuk penyimpanan, Socket.IO untuk pembaruan PvP real-time, dan Stockfish untuk bot serta analisis permainan.

## Alur pengguna

1. Pengguna membuat akun melalui `POST /api/auth/register`.
2. Pengguna login melalui `POST /api/auth/login` dan menerima JWT.
3. Klien memanggil `GET /` dengan JWT untuk menampilkan home dan pilihan fitur.
4. Pengguna memilih PvP atau melawan bot. Untuk PvP, lobby menyediakan tab **Room Terbuka** dari `GET /api/games/open` serta opsi membuat room melalui `POST /api/games`.
5. Pemain kedua bergabung melalui `POST /api/games/:id/join`. Kedua klien berlangganan room yang sama melalui Socket.IO `watch_game`. Pengguna lain dapat melihat daftar game aktif melalui `GET /api/games/live` dan menonton update tanpa dapat mengirim langkah.
6. Backend memvalidasi dan menyimpan setiap langkah, lalu menyiarkan langkah putih maupun hitam beserta FEN/PGN terbaru melalui Socket.IO ke kedua pemain dan semua penonton yang subscribe. Saat `watch_game`, server memasukkan socket ke room lalu mengirim snapshot terkini; proses snapshot dan update diurutkan agar klien tidak menerima posisi lama sebagai posisi terakhir. Event `game_over` juga dikirim ke semua subscriber.

## Cakupan MVP

- Registrasi dan login dengan autentikasi JWT.
- Home terautentikasi dengan pilihan mode PvP/bot dan daftar fitur.
- Lobby PvP dengan tab **Room Terbuka** untuk melihat dan bergabung ke game yang menunggu lawan, serta tab **Sedang Berlangsung** untuk menonton game PvP aktif.
- Game PvP dan melawan Stockfish.
- Menonton game PvP aktif sebagai pengguna terautentikasi dengan akses baca saja.
- Melihat langkah kedua pemain secara real-time melalui Socket.IO setelah subscribe dengan `watch_game`.
- Validasi langkah dan status game di backend.
- Riwayat pertandingan serta statistik menang/seri/kalah.
- Analisis PGN pascapertandingan menggunakan Stockfish.

Puzzle harian dan fitur lain dapat ditambahkan setelah sumber kontennya disepakati.

## Dokumentasi API

- [Kontrak REST API dan Socket.IO](./API.md)
- [Instruksi untuk pengembangan backend](./AGENTS.md)

## Status

Saat ini folder `server` berisi dokumen kebutuhan dan kontrak API. Source code runtime, `package.json`, migrasi database, serta konfigurasi deployment belum dibuat; server belum dapat dijalankan.

## Konfigurasi yang direncanakan

Implementasi nantinya memerlukan PostgreSQL, secret JWT, serta executable Stockfish. Nilai seperti URL database, secret JWT, origin frontend, dan path Stockfish harus disimpan dalam environment variables; jangan commit secret atau file `.env`.
