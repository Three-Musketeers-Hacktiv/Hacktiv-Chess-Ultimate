# Hacktiv Chess Backend

Backend untuk MVP game catur online. API dirancang menggunakan Node.js dan Express, dengan PostgreSQL/Sequelize untuk penyimpanan, Socket.IO untuk pembaruan PvP real-time, `chess.js` v1.4.0 untuk aturan dan validasi langkah, serta Stockfish untuk langkah bot dan analisis permainan.

## Menjalankan fondasi server

Gunakan Node.js dan PostgreSQL. Salin `.env.example` menjadi `.env`, lalu isi password PostgreSQL untuk development dan testing. File `.env` tidak boleh di-commit.

```powershell
Copy-Item .env.example .env
npm run db:create
npm run db:migrate
npm run db:create:testing
npm run db:migrate:testing
npm run dev
```

Server memakai database `hacktiv_chess_development` untuk `NODE_ENV=development`, `hacktiv_chess_testing` untuk `NODE_ENV=test`, dan `hacktiv_chess_production` untuk `NODE_ENV=production`. Untuk testing, jalankan `npm run db:migrate:testing` setelah membuat database testing. Isi host, nama database, user, dan password production sebelum menjalankan `npm run db:create:production` dan `npm run db:migrate:production`. Migration awal membuat tabel `users`, `games`, dan `game_moves` beserta constraint dan indeks skema. Endpoint `GET /health` menjadi health check API.

Command `npm start` menjalankan entry point yang sama tanpa mode watch. Sequelize CLI memakai konfigurasi, model, dan migration di dalam `src/`; migration awal membuat tabel `users`, `games`, dan `game_moves`.

## Alur pengguna

1. Pengguna membuat akun melalui `POST /api/auth/register`.
2. Pengguna login melalui `POST /api/auth/login` dan menerima JWT.
3. Klien memanggil `GET /` dengan JWT untuk menampilkan home dan pilihan fitur.
4. Pengguna memilih PvP atau melawan bot. Untuk PvP, lobby menyediakan tab **Room Terbuka** dari `GET /api/games/open` serta opsi membuat room melalui `POST /api/games`.
5. Pemain kedua bergabung melalui `POST /api/games/:id/join`. Kedua klien berlangganan room yang sama melalui Socket.IO `watch_game`. Pengguna lain dapat melihat daftar game aktif melalui `GET /api/games/live` dan menonton update tanpa dapat mengirim langkah.
6. Backend mencatat waktu penerimaan langkah, mengurutkan langkah dan timeout per game, memvalidasi serta menyimpan langkah, lalu langsung menyiarkan FEN/PGN dan jam terbaru melalui Socket.IO. Saat `watch_game`, server mengirim snapshot dari data tersimpan. Event `move` dan `game_over` dikirim setelah commit agar pemain dan penonton menerima keadaan terbaru.

## Cakupan MVP

- Registrasi dan login dengan autentikasi JWT.
- Home terautentikasi dengan pilihan mode PvP/bot dan daftar fitur.
- Lobby PvP dengan tab **Room Terbuka** untuk melihat dan bergabung ke game yang menunggu lawan, serta tab **Sedang Berlangsung** untuk menonton game PvP aktif.
- Game PvP dan melawan bot Stockfish. Backend menggunakan `chess.js` untuk validasi langkah pemain maupun bot; Stockfish memilih langkah bot dan menganalisis PGN.
- Preset waktu untuk kedua mode: Sangat Cepat 1+0, Cepat 3+2, Reguler 15+10, Professional 60+30 (menit awal + detik increment per langkah). Jam otoritatif berada di server.
- Bot menyediakan tingkat mudah, sedang, dan sulit.
- Game berakhir berdasarkan aturan catur yang dicakup MVP, timeout, menyerah, tawaran remis yang diterima, atau klaim remis yang valid. Klaim tiga kali pengulangan dan 50 langkah hanya berlaku untuk posisi saat ini; klaim berdasarkan langkah yang diniatkan tidak termasuk MVP.
- Aturan remis dibuat praktis untuk MVP, bukan implementasi menyeluruh FIDE atau salinan persis Chess.com. Dead position hanya dikenali bila `chess.js` `isInsufficientMaterial()` mengembalikan `true`. Saat timeout, hasil remis hanya jika pemeriksaan yang sama mengembalikan `true` untuk seluruh posisi; selain itu pemain yang kehabisan waktu kalah. Resign saat game aktif langsung memberi kemenangan kepada lawan.
- Backend menghitung fivefold repetition dan aturan otomatis 75 langkah dari riwayat lengkap; kunci posisi mempertimbangkan susunan bidak, giliran, hak rokade, dan kemungkinan en passant yang legal.
- Tingkat bot memakai Stockfish Skill Level 0 (mudah), 5 (sedang), dan 10 (sulit); ini tingkat relatif, bukan janji rating Elo.
- Maksimal dua proses Stockfish aktif, masing-masing satu thread, ditambah maksimal lima pekerjaan menunggu dalam antrean bersama; bot diprioritaskan. Pencarian langkah bot maksimal 1 detik dan analisis PGN maksimal 5 detik. Jika kapasitas penuh, request langkah bot atau analisis baru mendapat `503 ENGINE_BUSY`; langkah pemain belum disimpan. Reservasi slot dilepas jika validasi atau transaksi langkah gagal.
- Menonton game PvP aktif sebagai pengguna terautentikasi dengan akses baca saja.
- Melihat langkah kedua pemain secara real-time melalui Socket.IO setelah subscribe dengan `watch_game`.
- Validasi langkah dan status game di backend.
- Riwayat pertandingan serta statistik menang/seri/kalah.
- Analisis PGN pascapertandingan menggunakan Stockfish.

Puzzle harian dan fitur lain dapat ditambahkan setelah sumber kontennya disepakati.

## Istilah posisi dan riwayat

- **FEN** (*Forsyth–Edwards Notation*) menggambarkan posisi papan pada satu saat, termasuk giliran yang harus jalan. Backend memakai FEN untuk posisi game terkini dan posisi setelah setiap langkah.
- **PGN** (*Portable Game Notation*) merekam urutan langkah, misalnya `1. e4 e5 2. Nf3 Nc6`. Backend dapat membentuk PGN dari history langkah untuk analisis Stockfish atau ekspor.
- Singkatnya, FEN adalah snapshot posisi; PGN adalah rekaman langkah. History terstruktur disimpan di `game_moves`.

## Skema database

Database PostgreSQL menggunakan UUID yang dibuat Sequelize (`DataTypes.UUIDV4`) dan timestamp `TIMESTAMPTZ`. Username dan email dinormalisasi ke huruf kecil sebelum disimpan.

### `users`

| Kolom | Tipe | Aturan |
|---|---|---|
| `id` | `UUID` | Primary key |
| `username` | `VARCHAR(24)` | Wajib, unik |
| `email` | `VARCHAR(254)` | Wajib, unik |
| `password_hash` | `VARCHAR(255)` | Wajib, hash bcrypt saja |
| `created_at` | `TIMESTAMPTZ` | Wajib, default waktu sekarang |
| `updated_at` | `TIMESTAMPTZ` | Wajib, dikelola Sequelize |

### `games`

| Kolom | Tipe | Aturan |
|---|---|---|
| `id` | `UUID` | Primary key |
| `mode` | `VARCHAR(8)` | Wajib, `pvp` atau `bot` |
| `status` | `VARCHAR(16)` | Wajib, `waiting`, `in_progress`, atau `completed` |
| `time_control_minutes` | `SMALLINT` | Wajib, `1`, `3`, `15`, atau `60` |
| `increment_seconds` | `SMALLINT` | Wajib, preset `0`, `2`, `10`, atau `30` |
| `bot_difficulty` | `VARCHAR(8)` | Nullable, `easy`, `medium`, atau `hard`; khusus bot |
| `white_player_id` | `UUID` | Wajib, FK ke `users.id` |
| `black_player_id` | `UUID` | Nullable, FK ke `users.id`; kosong untuk room menunggu dan lawan bot |
| `current_fen` | `TEXT` | Wajib, posisi game terakhir |
| `white_time_remaining_ms` | `BIGINT` | Wajib, sisa waktu putih |
| `black_time_remaining_ms` | `BIGINT` | Wajib, sisa waktu hitam |
| `turn_started_at` | `TIMESTAMPTZ` | Nullable, waktu mulai giliran aktif |
| `draw_offer_by_player_id` | `UUID` | Nullable, FK ke pemain yang menawarkan remis |
| `result` | `VARCHAR(7)` | Nullable, `1-0`, `0-1`, atau `1/2-1/2` |
| `termination_reason` | `VARCHAR(32)` | Nullable, alasan game berakhir |
| `created_at` | `TIMESTAMPTZ` | Wajib, default waktu sekarang |
| `started_at` | `TIMESTAMPTZ` | Nullable sampai game dimulai |
| `ended_at` | `TIMESTAMPTZ` | Nullable sampai game selesai |
| `updated_at` | `TIMESTAMPTZ` | Wajib, dikelola Sequelize |

### `game_moves`

Satu baris menyimpan satu langkah dari putih atau hitam.

| Kolom | Tipe | Aturan |
|---|---|---|
| `id` | `UUID` | Primary key |
| `game_id` | `UUID` | Wajib, FK ke `games.id` |
| `ply` | `INTEGER` | Wajib, mulai dari 1; unik bersama `game_id` |
| `actor_type` | `VARCHAR(8)` | Wajib, `player` atau `bot` |
| `player_id` | `UUID` | Nullable, FK ke `users.id`; kosong untuk langkah bot |
| `color` | `CHAR(1)` | Wajib, `w` atau `b` |
| `from_square` | `CHAR(2)` | Wajib, petak asal seperti `e2` |
| `to_square` | `CHAR(2)` | Wajib, petak tujuan seperti `e4` |
| `promotion` | `CHAR(1)` | Nullable, `q`, `r`, `b`, atau `n` |
| `san` | `VARCHAR(32)` | Wajib, notasi langkah seperti `Nf3` |
| `fen_after` | `TEXT` | Wajib, posisi sesudah langkah |
| `created_at` | `TIMESTAMPTZ` | Wajib, default waktu sekarang |

### Relasi dan constraint

- Satu pengguna dapat menjadi pemain putih atau hitam di banyak game; satu game memiliki banyak `game_moves`.
- `mode` dibatasi ke `pvp`/`bot`; `status` ke `waiting`/`in_progress`/`completed`; `result` ke `1-0`/`0-1`/`1/2-1/2`.
- Preset waktu: `bullet` = 1+0, `blitz` = 3+2, `rapid` = 15+10, `professional` = 60+30. Waktu awal dalam menit, increment per langkah dalam detik; sisa jam disimpan dalam milidetik.
- `bot_difficulty` wajib untuk mode bot dan kosong untuk PvP. Sisa jam tidak boleh negatif; jam aktif dihitung berdasarkan `turn_started_at` oleh server.
- Waktu request langkah dicatat saat handler menerima request. Langkah tepat waktu jika timestamp penerimaan sebelum deadline; timestamp sama atau setelah deadline berarti timeout. Langkah ilegal tidak menghentikan jam. Request yang mengubah game dan timeout diurutkan per game; event Socket.IO dikirim setelah commit.
- Untuk game bot, slot antrean engine dicadangkan sebelum langkah pemain disimpan dan dilepas bila validasi atau transaksi gagal. Respons REST mengembalikan langkah pemain dengan `bot_move: null` dan `bot_move_pending: true`; setelah Stockfish selesai, langkah bot disimpan dan dikirim kepada subscriber lewat Socket.IO. Contoh response dengan `bot_move_pending: false` adalah untuk PvP.
- Pemain putih wajib terisi. Pemain hitam wajib kosong untuk bot dan room PvP yang menunggu; pemain putih dan hitam tidak boleh sama.
- `result` kosong sebelum game selesai dan terisi saat `completed`. `started_at` terisi sejak game dimulai; `ended_at` hanya setelah selesai.
- `draw_offer_by_player_id` hanya boleh menunjuk salah satu pemain PvP dan wajib kosong untuk bot. `termination_reason` mencakup `checkmate`, `stalemate`, `dead_position`, `resignation`, `timeout`, `draw_agreement`, `threefold_repetition`, `fivefold_repetition`, `fifty_move_rule`, dan `seventy_five_move_rule`.
- `ply > 0`, warna hanya `w`/`b`, dan promosi hanya `q`/`r`/`b`/`n` atau kosong.
- `actor_type = 'player'` memerlukan `player_id`; `actor_type = 'bot'` memerlukan `player_id` kosong. Kecocokan pemain dengan warna serta aturan bot divalidasi service game dalam transaksi.
- Terapkan FK dan constraint di PostgreSQL melalui migration. Buat indeks unik pada `username`, `email`, dan pasangan (`game_id`, `ply`); indeks riwayat pada (`white_player_id`, `created_at`) serta (`black_player_id`, `created_at`); indeks lobby pada (`mode`, `status`, `created_at`).

History `game_moves` menjadi sumber PGN; PGN dibentuk saat dibutuhkan. `games.current_fen` menyimpan posisi terkini, sedangkan `fen_after` memungkinkan history ditinjau tanpa mengubah game aktif. Lihat [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) untuk diagram ERD dan rincian transaksi.

## Dokumentasi API

- [Kontrak REST API dan Socket.IO](./API.md)
- [Rancangan skema database PostgreSQL](./DATABASE_SCHEMA.md)
- [Instruksi untuk pengembangan backend](./AGENTS.md)

## Status fondasi

Fondasi server sudah tersedia: Express dan Socket.IO, konfigurasi Sequelize untuk development/testing/production, model `User`, `Game`, dan `GameMove`, serta tiga migration awal. Endpoint runtime yang tersedia saat ini hanya `GET /health`; autentikasi, game, lobby, bot Stockfish, dan endpoint lain di dokumen API belum diimplementasikan. Server dapat dijalankan setelah PostgreSQL tersedia dan database development berhasil dimigrasikan.

Untuk deployment production, isi kredensial database production di environment variables platform. Secret JWT dan path executable Stockfish akan diperlukan saat fitur terkait dibuat. Jangan commit `.env` atau secret.
