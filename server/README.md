# Hacktiv Chess Backend

Backend MVP catur online dengan Node.js/Express, PostgreSQL/Sequelize, Socket.IO, `chess.js` v1.4.0, dan Stockfish untuk game bot. Alur PvP serta bot tersedia; analisis Stockfish dan riwayat lintas game masih tahap berikutnya.

## Menjalankan fondasi server

Gunakan Node.js dan PostgreSQL. Salin `.env.example` menjadi `.env`, isi password PostgreSQL untuk development dan testing, ganti `JWT_SECRET` dengan nilai acak yang panjang, dan atur `STOCKFISH_PATH` ke binary Stockfish lokal. File `.env` tidak boleh di-commit.

```powershell
Copy-Item .env.example .env
npm run db:create
npm run db:migrate
npm run db:create:testing
npm run db:migrate:testing
npm run dev
```

Jalankan `npm test` setelah database testing dimigrasikan untuk memeriksa autentikasi, alur PvP, dan alur bot dengan engine tiruan. Uji UCI langsung memerlukan binary yang dirujuk oleh `STOCKFISH_PATH`.

Server memakai database `hacktiv_chess_development` untuk `NODE_ENV=development`, `hacktiv_chess_testing` untuk `NODE_ENV=test`, dan `hacktiv_chess_production` untuk `NODE_ENV=production`. Untuk testing, jalankan `npm run db:migrate:testing` setelah membuat database testing. Isi host, nama database, user, dan password production sebelum menjalankan `npm run db:create:production` dan `npm run db:migrate:production`. Migration awal membuat tabel `users`, `games`, dan `game_moves` beserta constraint dan indeks skema. Endpoint `GET /health` menjadi health check API.

Command `npm start` menjalankan entry point yang sama tanpa mode watch. Sequelize CLI memakai konfigurasi, model, dan migration di dalam `src/`; migration awal membuat tabel `users`, `games`, dan `game_moves`.

Untuk register dan login, backend menggunakan bcrypt dan JWT. Ganti `JWT_SECRET` di `.env` dengan secret acak sebelum menggunakan endpoint login. Login berlaku 7 hari; request ke `GET /` memerlukan header `Authorization: Bearer <token>`.

MVP belum memiliki logout yang mencabut token, refresh token, verifikasi email, atau pemulihan password. Rate limit autentikasi tersimpan di memori satu proses.

## Alur pengguna yang tersedia

1. Pengguna membuat akun melalui `POST /api/auth/register`.
2. Pengguna login melalui `POST /api/auth/login` dan menerima JWT.
3. Klien memanggil `GET /` dengan JWT untuk menampilkan home. Status mode bot `available` jika binary pada `STOCKFISH_PATH` dapat diakses; jika tidak, statusnya `planned`.
4. Pemain memilih preset waktu dan meminta random matchmaking melalui `POST /api/games`. Backend memasangkan pemain dengan antrean yang memakai preset sama; jika belum ada lawan, pemain menunggu dan dapat membatalkan antrean.
5. Setelah match, kedua pemain menerima `game_started` lewat Socket.IO; klien yang reconnect dapat memeriksa `GET /api/games/:id`. Pemain lain hanya dapat menonton game aktif melalui `GET /api/games/live` dan Socket.IO `watch_game`.
6. Langkah legal disimpan beserta FEN dan notasi. Perubahan disiarkan lewat Socket.IO setelah transaksi berhasil. Jam berjalan di server; scheduler memeriksa timeout setiap detik dan aktif kembali setelah server restart.
7. Untuk bot, pengguna memulai game langsung sebagai putih. Stockfish bermain hitam sesuai tingkat kesulitan dan langkah bot disimpan serta dikirim melalui Socket.IO.

## Implementasi saat ini: PvP dan bot

- Registrasi dan login dengan autentikasi JWT.
- Register/login JWT dan home terautentikasi; PvP tersedia, status bot mengikuti ketersediaan binary Stockfish.
- Random matchmaking PvP berdasarkan preset Bullet 1+0, Blitz 3+2, Rapid 15+10, atau Professional 60+30; jam dimulai setelah lawan ditemukan.
- Membatalkan antrean sendiri; satu pemain hanya dapat memiliki satu game PvP aktif (menunggu atau sedang berlangsung). Retry mengembalikan antrean/game yang sama, dan pemain dapat mencari lagi setelah game selesai.
- Menonton game PvP yang sedang berlangsung. Join by room atau tantangan teman belum termasuk MVP.
- Validasi langkah dengan `chess.js`; menyimpan history/FEN, membentuk PGN, dan mengurutkan aksi per game pada satu proses.
- Menampilkan detail dan history pemain, daftar PvP aktif, serta snapshot baca-saja untuk penonton.
- Game melawan Stockfish dengan tingkat easy/medium/hard, empat preset waktu, validasi langkah engine, dan penyimpanan langkah bot.
- Stockfish dijalankan melalui UCI dari `STOCKFISH_PATH`; maksimal dua proses aktif dan lima pekerjaan antrean, masing-masing proses memakai satu thread. Game bot aktif yang menunggu giliran Stockfish dijadwalkan kembali setelah server restart.
- Menyiarkan `game_started` ke kedua pemain saat match ditemukan, lalu `game_state`, `move`, dan `game_over` melalui Socket.IO.
- Jam server dengan increment; timeout diperiksa saat aksi masuk dan oleh scheduler setiap detik, termasuk setelah server restart.
- Game berakhir pada checkmate, stalemate, insufficient material, fivefold repetition, aturan 75 langkah, timeout, menyerah, remis yang disetujui, atau kegagalan engine yang diselesaikan sebagai remis.
- Tawaran remis tersedia setelah kedua pemain melangkah. Klaim tiga kali pengulangan dan 50 langkah berlaku untuk posisi saat ini; klaim gagal menambah dua menit ke jam lawan.
- Aturan remis dibuat praktis untuk MVP, bukan implementasi penuh FIDE atau salinan persis Chess.com.

## Belum diimplementasikan

- Analisis PGN menggunakan Stockfish.
- Daftar riwayat lintas game (`GET /api/games`), profil/statistik terpisah, rating, pembukaan favorit, dan grafik perkembangan.
- Puzzle, turnamen, teman/chat/klub, gamifikasi, dan antarmuka frontend.
- Antrean game dan rate limit berbasis memori hanya sesuai satu instance; deployment beberapa instance perlu store dan pengurutan bersama.

Puzzle harian dan fitur lain dapat ditambahkan setelah sumber kontennya disepakati.

## Istilah posisi dan riwayat

- **FEN** (*Forsyth–Edwards Notation*) menggambarkan posisi papan pada satu saat, termasuk giliran yang harus jalan. Backend memakai FEN untuk posisi game terkini dan posisi setelah setiap langkah.
- **PGN** (*Portable Game Notation*) merekam urutan langkah, misalnya `1. e4 e5 2. Nf3 Nc6`. Backend membentuk PGN dari history; analisis Stockfish belum tersedia.
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
| `black_player_id` | `UUID` | Nullable, FK ke `users.id`; kosong selama antrean PvP atau untuk lawan bot |
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
- Pemain putih wajib terisi. Pemain hitam wajib kosong untuk bot dan antrean PvP yang menunggu; pemain putih dan hitam tidak boleh sama. Partial unique index membatasi satu antrean aktif per pemain. Service matchmaking memakai advisory transaction lock global untuk mengurutkan request lintas preset, memeriksa game aktif sebelum mengantre, dan membatasi satu game PvP aktif per pemain.
- `result` kosong sebelum game selesai dan terisi saat `completed`. `started_at` terisi sejak game dimulai; `ended_at` hanya setelah selesai.
- `draw_offer_by_player_id` hanya boleh menunjuk salah satu pemain PvP dan wajib kosong untuk bot. `termination_reason` mencakup `checkmate`, `stalemate`, `dead_position`, `resignation`, `timeout`, `draw_agreement`, `threefold_repetition`, `fivefold_repetition`, `fifty_move_rule`, `seventy_five_move_rule`, dan `engine_failure`.
- `ply > 0`, warna hanya `w`/`b`, dan promosi hanya `q`/`r`/`b`/`n` atau kosong.
- `actor_type = 'player'` memerlukan `player_id`; `actor_type = 'bot'` memerlukan `player_id` kosong. Kecocokan pemain dengan warna serta aturan bot divalidasi service game dalam transaksi.
- Terapkan FK dan constraint di PostgreSQL melalui migration. Buat indeks unik pada `username`, `email`, dan pasangan (`game_id`, `ply`); indeks riwayat pada (`white_player_id`, `created_at`) serta (`black_player_id`, `created_at`); indeks lobby pada (`mode`, `status`, `created_at`).

History `game_moves` menjadi sumber PGN; PGN dibentuk saat dibutuhkan. `games.current_fen` menyimpan posisi terkini, sedangkan `fen_after` memungkinkan history ditinjau tanpa mengubah game aktif. Lihat [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) untuk diagram ERD dan rincian transaksi.

## Dokumentasi API

- [Kontrak REST API dan Socket.IO](./API.md)
- [Rancangan skema database PostgreSQL](./DATABASE_SCHEMA.md)
- [Instruksi untuk pengembangan backend](./AGENTS.md)

## Status implementasi

Fondasi server, alur PvP, dan game bot Stockfish tersedia. Analisis Stockfish belum tersedia. Kontrak endpoint dan event ada di [API.md](./API.md).

Rate limit register/login saat ini disimpan di memori proses, sesuai satu instance MVP; gunakan penyimpanan bersama sebelum menjalankan beberapa instance. Untuk deployment production, isi kredensial database dan `JWT_SECRET` di environment variables platform. Jangan commit `.env` atau secret.
