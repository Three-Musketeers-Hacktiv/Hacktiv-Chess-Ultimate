# Hacktiv Chess Server API

Dokumen ini mendefinisikan kontrak backend MVP berbasis Node.js dan Express. HTTP REST menangani pembuatan serta pengelolaan game; Socket.IO menyebarkan perubahan game secara real-time. Server menjadi sumber kebenaran untuk posisi papan dan validasi langkah.

## Status implementasi

Autentikasi, home, profil/statistik dasar, alur PvP, game bot, endpoint riwayat pribadi, dan analisis game selesai tersedia. Mode bot dan analisis memerlukan file Stockfish pada `STOCKFISH_PATH` yang dapat diakses server. Join by room belum termasuk MVP.

## Konvensi

- Base URL development: `http://localhost:3000`
- Request dan response menggunakan JSON.
- Endpoint bertanda **Auth** memerlukan header `Authorization: Bearer <token>`.
- ID game dan pengguna berbentuk UUID.
- Parameter `:id` game yang bukan UUID mengembalikan `400 INVALID_GAME_ID`.
- **FEN** (*Forsyth–Edwards Notation*) merepresentasikan snapshot posisi papan pada satu saat, termasuk giliran yang harus jalan. API mengembalikan FEN terkini pada game dan FEN setelah langkah bila diperlukan.
- **PGN** (*Portable Game Notation*) merepresentasikan urutan langkah game, misalnya `1. e4 e5 2. Nf3 Nc6`. History langkah terstruktur disimpan di database; backend membentuk PGN dari langkah yang tersimpan.
- Backend menggunakan `chess.js` v1.4.0 untuk memvalidasi langkah PvP dan bot, menjaga posisi kanonis, serta membentuk FEN/PGN. Stockfish memilih langkah bot melalui UCI; backend tetap memvalidasi dan menyimpan langkahnya.
- Registrasi dan login wajib sebelum masuk atau membatalkan antrean PvP.

## Skema database

Skema PostgreSQL dikelola dengan Sequelize. UUID dibuat aplikasi memakai `DataTypes.UUIDV4`; kolom waktu memakai `TIMESTAMPTZ`. Username dan email disimpan dalam bentuk lowercase.

### Tabel `users`

| Kolom | Tipe PostgreSQL | Aturan |
|---|---|---|
| `id` | `UUID` | Primary key |
| `username` | `VARCHAR(24)` | Wajib, unik |
| `email` | `VARCHAR(254)` | Wajib, unik |
| `password_hash` | `VARCHAR(255)` | Wajib; hanya hash bcrypt |
| `created_at` | `TIMESTAMPTZ` | Wajib, default waktu sekarang |
| `updated_at` | `TIMESTAMPTZ` | Wajib, dikelola Sequelize |

### Tabel `games`

| Kolom | Tipe PostgreSQL | Aturan |
|---|---|---|
| `id` | `UUID` | Primary key |
| `mode` | `VARCHAR(8)` | Wajib; `pvp` atau `bot` |
| `status` | `VARCHAR(16)` | Wajib; `waiting`, `in_progress`, atau `completed` |
| `time_control_minutes` | `SMALLINT` | Wajib; `1`, `3`, `15`, atau `60` |
| `increment_seconds` | `SMALLINT` | Wajib; `0`, `2`, `10`, atau `30` sesuai preset |
| `bot_difficulty` | `VARCHAR(8)` | Nullable; `easy`, `medium`, atau `hard`; khusus bot |
| `white_player_id` | `UUID` | Wajib; FK ke `users.id` |
| `black_player_id` | `UUID` | Nullable; FK ke `users.id` |
| `current_fen` | `TEXT` | Wajib; posisi game terkini |
| `white_time_remaining_ms` | `BIGINT` | Wajib; sisa jam putih |
| `black_time_remaining_ms` | `BIGINT` | Wajib; sisa jam hitam |
| `turn_started_at` | `TIMESTAMPTZ` | Nullable; awal giliran aktif untuk menghitung jam di server |
| `draw_offer_by_player_id` | `UUID` | Nullable; FK ke pemain yang menawarkan remis |
| `result` | `VARCHAR(7)` | Nullable; `1-0`, `0-1`, atau `1/2-1/2` |
| `termination_reason` | `VARCHAR(32)` | Nullable; alasan game selesai |
| `created_at` | `TIMESTAMPTZ` | Wajib, default waktu sekarang |
| `started_at` | `TIMESTAMPTZ` | Nullable sampai game dimulai |
| `ended_at` | `TIMESTAMPTZ` | Nullable sampai game selesai |
| `updated_at` | `TIMESTAMPTZ` | Wajib, dikelola Sequelize |

### Tabel `game_moves`

Satu baris mewakili satu langkah (half-move).

| Kolom | Tipe PostgreSQL | Aturan |
|---|---|---|
| `id` | `UUID` | Primary key |
| `game_id` | `UUID` | Wajib; FK ke `games.id` |
| `ply` | `INTEGER` | Wajib, lebih dari 0; unik bersama `game_id` |
| `actor_type` | `VARCHAR(8)` | Wajib; `player` atau `bot` |
| `player_id` | `UUID` | Nullable; FK ke `users.id`; kosong untuk bot |
| `color` | `CHAR(1)` | Wajib; `w` atau `b` |
| `from_square` | `CHAR(2)` | Wajib; contoh `e2` |
| `to_square` | `CHAR(2)` | Wajib; contoh `e4` |
| `promotion` | `CHAR(1)` | Nullable; `q`, `r`, `b`, atau `n` |
| `san` | `VARCHAR(32)` | Wajib; contoh `Nf3` |
| `fen_after` | `TEXT` | Wajib; posisi setelah langkah |
| `created_at` | `TIMESTAMPTZ` | Wajib, default waktu sekarang |

### Relasi dan constraint

- `users` berelasi ke `games` sebagai pemain putih dan hitam; `games` memiliki banyak `game_moves`.
- `mode` hanya `pvp`/`bot`, `status` hanya `waiting`/`in_progress`/`completed`, dan `result` hanya `1-0`/`0-1`/`1/2-1/2` atau `NULL`.
- Preset waktu: `bullet` = 1 menit + 0 detik increment; `blitz` = 3 menit + 2 detik; `rapid` = 15 menit + 10 detik; `professional` = 60 menit + 30 detik. API menerima ID preset; pasangan durasi/increment ditetapkan server, jam sisa disimpan dalam milidetik, dan jam dihitung server. Matchmaking hanya memasangkan pemain dengan preset yang sama.
- `bot_difficulty` wajib hanya untuk game bot (`easy`, `medium`, `hard`); PvP harus `NULL`. Parameter Stockfish ditentukan server berdasarkan tingkat tersebut.
- `white_player_id` wajib. `black_player_id` kosong pada bot dan pemain PvP yang menunggu matchmaking; jika kedua pemain terisi, ID keduanya harus berbeda.
- Partial unique index mengizinkan paling banyak satu antrean PvP berstatus `waiting` untuk setiap `white_player_id`. Pada MVP, satu pengguna hanya boleh memiliki satu game PvP aktif (`waiting` atau `in_progress`); game baru dapat dimulai setelah game tersebut selesai.
- Hasil kosong sebelum `completed` dan wajib terisi sesudahnya. Waktu mulai terisi ketika game dimulai; waktu selesai hanya terisi ketika game selesai.
- Jam kedua pemain diinisialisasi dari preset. `turn_started_at` menjadi referensi server untuk jam yang sedang berjalan. Response mengirim `white_ms` dan `black_ms` sebagai integer JSON meskipun kolom PostgreSQL bertipe `BIGINT`. Saat game selesai, timestamp giliran dan tawaran remis dikosongkan.
- `draw_offer_by_player_id` hanya boleh berupa salah satu ID pemain PvP; pada game bot nilainya harus `NULL`. `termination_reason` dapat berupa `checkmate`, `stalemate`, `dead_position`, `resignation`, `timeout`, `draw_agreement`, `threefold_repetition`, `fivefold_repetition`, `fifty_move_rule`, `seventy_five_move_rule`, atau `engine_failure`.
- `ply > 0`; `color` hanya `w`/`b`; petak asal/tujuan harus berbentuk `[a-h][1-8]`; `promotion` hanya `q`/`r`/`b`/`n` atau `NULL`.
- `actor_type = 'player'` memerlukan `player_id`; `actor_type = 'bot'` mengharuskan `player_id` kosong. Kecocokan ID pemain dengan warna dan mode bot diperiksa service game dalam transaksi.
- Constraint FK dan CHECK ditegakkan di PostgreSQL. Indeks unik: `users.username`, `users.email`, (`game_id`, `ply`), serta antrean PvP aktif per `white_player_id`. Indeks query: (`white_player_id`, `created_at`), (`black_player_id`, `created_at`), dan (`mode`, `status`, `created_at`).

`game_moves` adalah sumber history dan PGN; `games.current_fen` menyimpan posisi terakhir. PGN dibentuk dari langkah terurut untuk response atau analisis. Detail ERD dan urutan transaksi ada di [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md).

## Autentikasi

1. Buat akun melalui `POST /api/auth/register`.
2. Login melalui `POST /api/auth/login` untuk memperoleh JWT.
3. Kirim JWT sebagai `Authorization: Bearer <token>` pada endpoint bertanda **Auth**.
4. Untuk Socket.IO, kirim token yang sama pada `auth.token` saat membuka koneksi.

Password disimpan sebagai hash bcrypt. Server tidak mengembalikan password atau hash. `JWT_SECRET` wajib tersedia di environment server dengan panjang minimal 32 byte; token ditandatangani dengan HS256, berisi UUID pengguna pada claim `sub`, dan berlaku 7 hari. Token hilang, tidak valid, atau kedaluwarsa menghasilkan `401`. Login dengan email yang tidak terdaftar dan password salah mengembalikan pesan `401` yang sama.

Register dibatasi 5 request dan login 10 request per alamat IP setiap 15 menit; pelanggaran menghasilkan `429` dan header `Retry-After`. Pembatas saat ini berada di memori proses, sehingga hanya sesuai satu instance dan akan reset saat server restart. Sebelum menjalankan beberapa instance, ganti penyimpanan limiter dengan store bersama. Password harus minimal 8 karakter dan maksimal 72 byte UTF-8 agar tidak terpotong oleh bcrypt.

Logout mencabut token JWT yang sedang digunakan; request REST berikutnya dan koneksi Socket.IO baru dengan token itu akan ditolak. Koneksi Socket.IO aktif dengan token tersebut juga diputus. Klien perlu menghapus token dari penyimpanan lokal. MVP belum menyediakan refresh token, verifikasi email, atau pemulihan password.

### Alur login, home, dan pemilihan mode

Login tidak membuat game dan tidak menerima pilihan mode; pilihan mode dikirim setelah pengguna memilihnya di beranda.

1. Pengguna login melalui `POST /api/auth/login`.
2. Setelah menerima token, klien memanggil `GET /` dengan token untuk menampilkan beranda dan pilihan fitur.
3. Dari beranda, pengguna memilih **PvP** atau **Melawan Bot** jika status mode bot `available`. Status Bot dan analisis menjadi `planned` jika file pada `STOCKFISH_PATH` tidak dapat diakses.
4. Pengguna memilih kontrol waktu dan memanggil `POST /api/games` untuk random matchmaking. Backend memasangkan pemain dengan preset yang sama atau membuat antrean berstatus menunggu; pemain dapat membatalkan antrean.
5. Setelah match, kedua pemain menerima event Socket.IO `game_started`, lalu subscribe ke game melalui `watch_game`. Pengguna lain dapat melihat daftar game PvP aktif dan menontonnya tanpa hak mengirim langkah.

## REST API

### Health check

`GET /health`

Response `200`:

```json
{ "status": "ok" }
```

### Home

`GET /` (**Auth**)

Dipanggil setelah login. Endpoint ini menyediakan ringkasan pemain, pilihan mode permainan, dan katalog fitur untuk layar home frontend. Status mode bot dan analisis `available` mengikuti aksesibilitas file pada `STOCKFISH_PATH`; jika tidak dapat diakses, status keduanya `planned`. Fitur yang belum tersedia tetap dapat ditampilkan dengan status `planned`.

Response `200`:

```json
{
  "status": "success",
  "home": {
    "user": { "id": "<uuid>", "username": "player1" },
    "stats": { "wins": 4, "draws": 1, "losses": 2 },
    "game_modes": [
      { "id": "pvp", "label": "PvP", "status": "available" },
      { "id": "bot", "label": "Melawan Bot", "status": "available" }
    ],
    "features": [
      { "id": "history", "label": "Riwayat Permainan", "status": "available" },
      { "id": "profile", "label": "Profil dan Statistik", "status": "available" },
      { "id": "analysis", "label": "Analisis Permainan", "status": "available" },
      { "id": "daily_puzzle", "label": "Puzzle Harian", "status": "planned" },
      { "id": "tournaments", "label": "Turnamen", "status": "planned" }
    ]
  }
}
```

Client mengirim mode pilihan ke `POST /api/games`. Mode bot dapat digunakan jika binary Stockfish tersedia di backend.

### Registrasi

`POST /api/auth/register`

Body:

```json
{
  "username": "player1",
  "email": "player1@example.com",
  "password": "passwordrahasia123"
}
```

Response `201`:

```json
{ "status": "success", "message": "Akun berhasil dibuat. Silakan login." }
```

Username harus 3–24 karakter dan hanya berisi huruf ASCII, angka, `_`, atau `-`; email dinormalisasi ke huruf kecil dan harus valid. Password minimal 8 karakter dan maksimal 72 byte UTF-8. Email atau username yang sudah dipakai menghasilkan `409`; input tidak valid menghasilkan `400`.

### Login

`POST /api/auth/login`

Body:

```json
{ "email": "player1@example.com", "password": "passwordrahasia123" }
```

Response `200`:

```json
{
  "status": "success",
  "token": "<jwt>",
  "user": { "id": "<uuid>", "username": "player1" }
}
```

### Logout

`POST /api/auth/logout` (**Auth**)

Mencabut token yang dikirim pada header `Authorization: Bearer <token>`. Token tidak dapat digunakan lagi untuk REST atau koneksi Socket.IO sampai kedaluwarsanya. Socket yang sudah terhubung dengan token tersebut diputus.

Response `200`:

```json
{ "status": "success", "message": "Logout berhasil." }
```

Tanpa token, token tidak valid/kedaluwarsa, atau token yang sudah dicabut menghasilkan `401`. Klien harus menghapus token lokal setelah logout berhasil.

### Ubah username

`PUT /api/user/update-username` (**Auth**)

Mengganti username akun yang sedang login. Email tidak dapat diubah. Body wajib berisi username baru dan password saat ini sebagai konfirmasi (bukan password baru).

Body:

```json
{ "username": "player2", "password": "passwordrahasia123" }
```

Response `200`:

```json
{
  "status": "success",
  "message": "Username berhasil diperbarui",
  "user": { "username": "player2" }
}
```

Username mengikuti aturan yang sama dengan registrasi (3–24 karakter, huruf ASCII, angka, `_`, atau `-`, disimpan lowercase). Password yang salah menghasilkan `401` dengan pesan `Password salah. Konfirmasi gagal.` Username yang sudah dipakai menghasilkan `409`. Input tidak valid menghasilkan `400`. JWT tidak diterbitkan ulang.

Endpoint game, profil, dan analisis yang memerlukan akun menolak request tanpa JWT. Detail game dan riwayat pribadi hanya dapat dibaca pemain terkait; pengecualian baca-saja untuk penonton hanya berlaku melalui `GET /api/games/live` dan Socket.IO `watch_game` pada game PvP yang sedang berlangsung. Hanya pemain yang dapat mengirim langkah atas nama akunnya sendiri.

### Buat game

`POST /api/games` (**Auth**)

Pilih salah satu preset waktu berikut. Increment per langkah merupakan bagian preset dan tidak bisa diubah di MVP:

| ID preset | Label | Waktu per pemain | Increment |
|---|---|---:|---:|
| `bullet` | Sangat Cepat | 1 menit | 0 detik |
| `blitz` | Cepat | 3 menit | 2 detik |
| `rapid` | Reguler | 15 menit | 10 detik |
| `professional` | Professional | 60 menit | 30 detik |

Jam dihitung secara otoritatif oleh server. Pemain PvP hanya dipasangkan dengan pemain lain yang memilih preset waktu yang sama. Jam mulai ketika backend menemukan pasangan.

Body PvP:

```json
{ "mode": "pvp", "time_control": "blitz" }
```

Jika lawan belum tersedia, response `202` menempatkan pemain dalam antrean:

```json
{
  "status": "success",
  "matchmaking": { "status": "searching" },
  "game": {
    "id": "<uuid>",
    "mode": "pvp",
    "status": "waiting",
    "time_control": { "id": "blitz", "initial_seconds": 180, "increment_seconds": 2 },
    "clocks": { "white_ms": 180000, "black_ms": 180000, "active_color": null, "as_of": "<datetime>" },
    "color": "w",
    "fen": "<starting-fen>",
    "opponent": null
  }
}
```

Body melawan bot:

```json
{ "mode": "bot", "time_control": "rapid", "difficulty": "medium" }
```

Game bot dimulai dengan pengguna sebagai putih dan Stockfish sebagai hitam. `difficulty` wajib dan dipetakan di server ke Stockfish `Skill Level` mudah `0`, sedang `5`, atau sulit `10`. Response `201` mengembalikan game berstatus `in_progress`. Jika binary belum tersedia, server mengembalikan `503 ENGINE_UNAVAILABLE`.

Status bot pada `GET /` adalah `available` hanya jika file pada `STOCKFISH_PATH` dapat diakses server; selain itu responsenya `planned`. Untuk development, isi variabel tersebut di `server/.env`. Pada deployment, path harus menunjuk ke binary yang tersedia di container.

Jika pemain lain sudah menunggu dengan preset yang sama, response `200` mengembalikan game aktif dan warna hitam untuk pemain yang baru dipasangkan. Backend mengurutkan antrean dari yang paling lama dan memakai satu advisory transaction lock PostgreSQL untuk seluruh preset. Jika request diulang setelah match, backend mengembalikan game aktif yang sama beserta warna dan lawannya; retry tidak membuat game kedua atau menyiarkan ulang `game_started`. Pengguna hanya boleh memiliki satu game PvP aktif; memilih preset berbeda saat masih mengantre menghasilkan `409 MATCHMAKING_ALREADY_QUEUED`.

Contoh inti response `200` saat langsung mendapat lawan:

```json
{
  "status": "success",
  "matchmaking": { "status": "matched" },
  "game": {
    "id": "<uuid>", "mode": "pvp", "status": "in_progress", "color": "b",
    "time_control": { "id": "blitz", "initial_seconds": 180, "increment_seconds": 2 },
    "clocks": { "white_ms": 180000, "black_ms": 180000, "active_color": "w", "as_of": "<datetime>" },
    "opponent": "player1", "fen": "<starting-fen>"
  }
}
```

Pemain yang menunggu dapat mengetahui hasil match dengan mendengarkan event `game_started`. Setelah reconnect, gunakan `GET /api/games/:id` untuk membaca status terbaru. Jam putih dimulai ketika pasangan ditemukan.

Response game menyertakan `clocks`: sisa waktu putih/hitam dalam milidetik sebagai integer JSON, `active_color`, dan `as_of` (waktu server ketika nilai dihitung). Klien boleh menggerakkan countdown visual dari `as_of`, tetapi waktu server adalah sumber kebenaran. Server harus menyelesaikan game saat jam aktif habis meskipun tidak ada request baru.

### Batalkan matchmaking

`DELETE /api/games/:id/matchmaking` (**Auth**)

Pemain dapat membatalkan hanya antrean miliknya yang masih berstatus `waiting`. Pembatalan menggunakan advisory transaction lock matchmaking yang sama dengan pencarian lawan, sehingga pembatalan dan pencocokan tidak melewati satu sama lain. Jika pasangan sudah ditemukan, server mengembalikan `409 MATCH_ALREADY_FOUND`; game aktif tidak dihapus.

Response `200`:

```json
{ "status": "success", "cancelled": true, "gameId": "<uuid>" }
```

### Matchmaking ranked (Elo)

`POST /api/matchmaking/join` (**Auth**)

```json
{ "mode": "ranked", "time_control": "10+0" }
```

`mode` adalah `ranked` atau `casual` (antrean PvP biasa tanpa rating, setara `POST /api/games` mode `pvp`). Antrean ranked hanya mempertemukan pemain ranked dengan kontrol waktu yang sama dan selisih Elo maksimal **±200**; antrean ranked dan casual tidak pernah saling mencocokkan. Status response sama dengan `POST /api/games` (`200` matched, `202` searching) dan antrean dibatalkan dengan `DELETE /api/games/:id/matchmaking`. Mengantre di mode/kontrol waktu lain saat antrean aktif menghasilkan `409 MATCHMAKING_ALREADY_QUEUED`. `mode` tidak valid menghasilkan `400 INVALID_MATCHMAKING_MODE`.

Game ranked membawa `ranked: true` dan `elo` pada setiap objek game (REST, `game_started`, `game_state`, `game_over`):

```json
{ "ranked": true, "elo": { "white": { "before": 1500, "change": -16, "after": 1484 }, "black": { "before": 1500, "change": 16, "after": 1516 } } }
```

`change` dan `after` bernilai `null` sampai game selesai. Saat game selesai (checkmate, resign, timeout, remis, dll.) server menghitung Elo resmi dengan K = 32 — `E = 1 / (1 + 10^((Rb − Ra) / 400))`, `R' = R + 32 × (S − E)` — dan memperbarui `users.elo_rating` kedua pemain dalam transaksi yang sama dengan hasil game. Perubahan kedua pemain selalu berlawanan tanda (zero-sum). Game bot dan casual tidak mengubah rating (`elo: null`). Rating saat ini ada di `GET /` (`home.user.elo_rating`) dan `GET /api/profile/me` (`profile.elo_rating`).

### Daftar game PvP yang sedang berlangsung

`GET /api/games/live` (**Auth**)

Mengembalikan game PvP berstatus `in_progress` agar frontend dapat menampilkan tab **Sedang Berlangsung** untuk ditonton. Response hanya memuat informasi publik: ID game, username pemain putih dan hitam, waktu mulai, preset waktu, snapshot jam dengan timestamp server, FEN terkini, serta jumlah langkah. Tidak menyertakan email, token, atau data profil privat.

Response `200`:

```json
{
  "status": "success",
  "games": [{ "id": "<uuid>", "white": "player1", "black": "player2", "startedAt": "<datetime>", "time_control": { "id": "rapid", "initial_seconds": 900, "increment_seconds": 10 }, "clocks": { "white_ms": 735000, "black_ms": 900000, "active_color": "b", "as_of": "<datetime>" }, "fen": "<current-fen>", "moveCount": 12 }]
}
```

Tidak ada endpoint untuk bergabung sebagai pemain ke game tertentu pada MVP. Pemain hanya dipasangkan melalui antrean; bergabung ke game aktif melalui `watch_game` hanya memberi akses menonton.

### Kirim langkah

`POST /api/games/:id/moves` (**Auth**)

Body:

```json
{ "from": "e2", "to": "e4", "promotion": "q" }
```

`promotion` opsional dan dapat berisi `q`, `r`, `b`, atau `n`. Saat handler menerima request, server mencatat `receivedAt` UTC sebelum validasi atau operasi database. Langkah dianggap tepat waktu hanya jika `receivedAt` lebih awal dari deadline jam aktif; timestamp sama dengan atau setelah deadline mengakhiri game karena timeout. Request yang mengubah state game—termasuk langkah, menyerah, tawaran remis, klaim remis, dan timeout—diserialkan dalam antrean per game. Jika request diterima pada atau sesudah deadline, timeout diproses lebih dahulu. Langkah ilegal tidak menghentikan atau mengatur ulang jam.

Untuk langkah legal, server menghitung waktu pemain sampai `receivedAt`, menyimpan langkah dan posisi dalam transaksi, memberi increment setelah langkah sah, lalu memulai jam lawan setelah commit. Jam sistem aplikasi dan PostgreSQL harus tersinkron. Antrean dalam memori ini berlaku untuk satu instance backend; deployment beberapa instance memerlukan mekanisme pengurutan bersama.

Tingkat bot dipetakan ke Stockfish `Skill Level`: mudah `0`, sedang `5`, sulit `10`. Ini tingkat relatif, bukan rating Elo yang dijanjikan. Jangan atur `UCI_Elo` bersama `Skill Level` dan jangan menerima opsi UCI mentah dari klien.

Pada game bot, Stockfish berpikir di luar transaksi database. Jalankan maksimal dua proses pencarian bersamaan, masing-masing `Threads = 1`, dengan maksimal lima pekerjaan yang menunggu. Batasi langkah bot hingga 1000 ms per gerakan. Slot bot wajib dicadangkan sebelum menyimpan langkah pemain. Jika kapasitas penuh, kembalikan `503 ENGINE_BUSY` dan jangan simpan langkah pemain. Lepaskan slot yang sudah dicadangkan jika validasi atau transaksi database gagal. Sebelum menyimpan hasil engine, server mengunci ulang game dan memastikan game masih aktif, giliran masih milik bot, FEN belum berubah, dan jam bot belum habis. Langkah engine divalidasi dengan `chess.js` sebelum disimpan. Jika proses engine gagal, game diakhiri sebagai remis dengan `termination_reason: "engine_failure"`. Saat pemulihan setelah restart, game yang belum mendapat slot karena antrean penuh tetap aktif dan dicoba ulang; error database sementara juga dicoba ulang dan tidak dianggap sebagai kegagalan engine.

Contoh response `200` untuk PvP:

```json
{
  "status": "success",
  "move": { "from": "e2", "to": "e4", "san": "e4", "fen": "<updated-fen>" },
  "bot_move": null,
  "bot_move_pending": false,
  "fen": "<current-fen>",
  "pgn": "1. e4",
  "history": [
    { "ply": 1, "color": "w", "actor": "player1", "san": "e4", "fen_after": "<fen-after-e4>" }
  ],
  "clocks": { "white_ms": 178000, "black_ms": 180000, "active_color": "b", "increment_seconds": 2, "as_of": "<datetime>" },
  "game_status": "in_progress",
  "result": null
}
```

`history` memuat langkah yang sudah tersimpan berurutan. Pada PvP, `bot_move` adalah `null` dan `bot_move_pending` adalah `false`. Pada game bot, response langsung mengembalikan langkah pemain dengan `bot_move: null` dan `bot_move_pending: true`; setelah engine selesai, server menyimpan langkah bot dan mengirim event `move` melalui Socket.IO. Langkah ilegal menghasilkan `400`, bukan giliran pemain menghasilkan `409`, pengguna yang bukan pemain menghasilkan `403`, langkah setelah waktu habis tidak diterima, dan antrean engine penuh menghasilkan `503 ENGINE_BUSY` sebelum langkah pemain disimpan.

### Menyerah

`POST /api/games/:id/resign` (**Auth**)

Hanya pemain di game yang masih aktif yang dapat menyerah. Resign langsung mengakhiri game dengan `termination_reason: "resignation"` dan kemenangan untuk lawan. Jika game sudah berakhir otomatis, request ditolak sebagai game selesai.

### Tawaran remis

- `POST /api/games/:id/draw-offers` (**Auth**, PvP saja): pemain aktif mengirim tawaran remis. Tawaran menunggu jawaban lawan dan dikirim sebagai event `draw_offer`.
- `POST /api/games/:id/draw-offers/response` (**Auth**, PvP saja) dengan body `{ "decision": "accept" }` atau `{ "decision": "decline" }`. Hanya lawan yang dapat merespons tawaran tertunda. Accept mengakhiri game dengan hasil remis; decline menghapus tawaran. Jika penerima memainkan langkah, tawaran juga ditolak.

Tawaran remis hanya tersedia setelah kedua pemain melakukan setidaknya satu langkah. Hanya satu tawaran dapat menunggu pada satu waktu. Game bot tidak memiliki tawaran remis karena Stockfish tidak dapat merespons tawaran.

### Klaim remis

`POST /api/games/:id/draw-claims` (**Auth**) dengan body `{ "reason": "threefold_repetition" }` atau `{ "reason": "fifty_move_rule" }`.

Hanya pemain yang sedang mendapat giliran dapat mengklaim remis berdasarkan posisi saat ini. Server memeriksa history sebelum menerima klaim. Klaim berdasarkan langkah yang diniatkan tidak termasuk MVP. Klaim valid menyelesaikan game sebagai remis; klaim yang tidak valid menghasilkan `409` dan menambahkan dua menit ke jam lawan, mengikuti aturan catur yang dipakai MVP.

Game berakhir otomatis pada checkmate, stalemate, dead position yang dikenali, fivefold repetition, aturan 75 langkah, timeout, atau kegagalan engine (`engine_failure`). Untuk MVP, dead position hanya dikenali saat `chess.js` `isInsufficientMaterial()` mengembalikan `true`; aturan ini praktis dan tidak berusaha mendeteksi semua posisi remis atau menyalin seluruh aturan Chess.com. Saat timeout, hasil remis hanya jika `isInsufficientMaterial()` mengembalikan `true` untuk seluruh posisi; selain itu pemain yang kehabisan waktu kalah. Resign saat game masih aktif langsung memberi kemenangan kepada lawan. Backend menghitung fivefold repetition dan 75 langkah dengan memutar ulang semua langkah dari posisi awal. Kunci posisi pengulangan memasukkan susunan bidak, sisi yang bergerak, hak rokade, dan kemungkinan en passant yang legal. Threefold repetition dan aturan 50 langkah diajukan sebagai klaim untuk posisi saat ini; checkmate pada langkah terakhir mendahului aturan 75 langkah. Remis yang disepakati juga mengakhiri game.

### Riwayat game pengguna

`GET /api/games` (**Auth**)

Mengembalikan ringkasan game PvP dan bot yang melibatkan pengguna terautentikasi, termasuk game yang sedang menunggu atau berlangsung. Daftar tidak menyertakan FEN atau semua langkah; gunakan `GET /api/games/:id` untuk detail.

Query opsional:

- `limit`: jumlah item, default `20`, minimum `1`, maksimum `50`.
- `cursor`: cursor opaque dari response sebelumnya. Jangan membuat atau mengubah nilainya di client.

Urutan game terbaru dahulu menggunakan `created_at` lalu ID sebagai tie-breaker. Cursor menjaga halaman berikutnya tetap berada setelah item terakhir halaman sebelumnya meskipun ada game baru.

Response `200`:

```json
{
  "status": "success",
  "games": [{
    "id": "<uuid>", "mode": "bot", "status": "completed", "color": "w",
    "opponent": "Stockfish (medium)",
    "time_control": { "id": "blitz", "initial_seconds": 180, "increment_seconds": 2 },
    "bot_difficulty": "medium", "result": "1/2-1/2", "termination_reason": "engine_failure",
    "move_count": 28, "created_at": "<datetime>", "started_at": "<datetime>", "ended_at": "<datetime>"
  }],
  "pagination": { "limit": 20, "has_more": true, "next_cursor": "<opaque-cursor>" }
}
```

Game PvP yang masih menunggu memiliki `opponent: null`, `started_at: null`, dan `ended_at: null`. Saat tidak ada halaman berikutnya, `has_more` bernilai `false` dan `next_cursor` bernilai `null`. `400 INVALID_HISTORY_LIMIT` atau `400 INVALID_HISTORY_CURSOR` dikembalikan untuk parameter pagination tidak valid.

### Detail game

`GET /api/games/:id` (**Auth**)

Hanya pemain game yang dapat melihat detail. Response memuat FEN terakhir, PGN, status, hasil, termination reason, pemain, preset dan sisa jam, tawaran remis yang tertunda, serta history terstruktur berurutan. Setiap item history memuat `ply`, `color`, `actor`, `from`, `to`, `promotion`, `san`, dan `fen_after`. Meninjau history tidak mengubah posisi game aktif.

### Profil dan statistik

`GET /api/profile/me` (**Auth**)

Mengembalikan profil pengguna yang sedang login, statistik seluruh game selesai miliknya, dan hingga 50 game selesai terbaru beserta PGN. Game yang masih menunggu atau berlangsung tidak masuk statistik maupun daftar ini.

```json
{
  "status": "success",
  "profile": {
    "id": "<uuid>",
    "username": "alice",
    "stats": { "wins": 4, "draws": 1, "losses": 2, "total_games": 7 },
    "games": [{
      "id": "<uuid>", "mode": "pvp", "color": "w", "opponent": "bob",
      "result": "1-0", "termination_reason": "checkmate",
      "started_at": "<datetime>", "ended_at": "<datetime>",
      "pgn": "[Event \"Hacktiv Chess\"]\n[White \"alice\"]\n[Black \"bob\"]\n[Result \"1-0\"]\n\n1. e4 e5 1-0"
    }]
  }
}
```

Endpoint hanya mengambil data pengguna dari JWT dan tidak menerima `user_id`. Statistik mencakup semua game selesai; daftar game dibatasi 50 item terbaru. Tidak ada rating Elo atau statistik pembukaan pada MVP.

### Analisis PGN

`POST /api/game/analyze` (**Auth**)

```json
{ "pgn": "1. e4 e5 2. Nf3 Nc6" }
```

`pgn` boleh PGN lengkap (dengan header) atau movetext saja. Server mem-parse dan me-replay PGN dengan chess.js lebih dulu (hanya langkah legal yang sampai ke engine), lalu menjalankan Stockfish yang sama dan antrean yang sama dengan analisis game tersimpan (maksimal 60 half-move, 8.000 karakter). Response `200` memiliki bentuk yang sama dengan analisis game: `{ status, result, analyzed_plies, analysis: [{ ply, color, move, evaluation: { cp, mate }, centipawn_loss, label, best_alternative }] }`. `label` adalah `Best Move`, `Mistake` (loss ≥ 100 cp) atau `Blunder` (loss ≥ 300 cp, atau skor mate yang terlewat); `best_alternative` (SAN) terisi bila engine menyarankan langkah lain. Error: `400 INVALID_PGN`, `413 PGN_TOO_LARGE`, `422 ANALYSIS_GAME_TOO_LONG`, `503 ENGINE_UNAVAILABLE | ENGINE_BUSY | ENGINE_ANALYSIS_FAILED`. `GET /` melaporkan `capabilities.analysis` dan fitur `analysis` sebagai `available` bila `STOCKFISH_PATH` valid.

### Analisis pascapertandingan

`POST /api/games/:id/analysis` (**Auth**)

Menganalisis game selesai yang melibatkan pengguna. Body tidak diperlukan: server membaca `game_moves` dari database dan menyusun posisi dari awal. PGN bebas dari klien tidak diterima.

Batas MVP:

- Maksimal 60 ply per game; game yang lebih panjang menghasilkan `422 ANALYSIS_GAME_TOO_LONG`.
- Maksimal dua proses Stockfish aktif dan lima pekerjaan menunggu, dibagi dengan langkah bot. Tiap proses memakai satu thread dan pencarian 75 ms per posisi.
- Proses analisis dihentikan setelah 15 detik; pekerjaan yang menunggu lebih dari 10 detik ditolak dengan `503 ENGINE_BUSY`.
- Hasil analisis tidak disimpan; request berikutnya menjalankan analisis lagi.

Response `200`:

```json
{
  "status": "success",
  "game_id": "<uuid>",
  "result": "1-0",
  "termination_reason": "checkmate",
  "analyzed_plies": 2,
  "analysis": [
    {
      "ply": 1,
      "color": "w",
      "move": "e4",
      "evaluation": { "cp": 30, "mate": null },
      "centipawn_loss": 0,
      "label": "Best Move",
      "best_alternative": null
    }
  ]
}
```

Evaluasi diberikan dari sudut pandang putih: centipawn positif menguntungkan putih; `mate` positif berarti putih dapat memaksa skakmat, dan negatif berarti hitam. `centipawn_loss` bernilai `null` jika evaluasi posisi berupa skakmat. `best_alternative` adalah notasi SAN langkah terbaik Stockfish sebelum langkah dimainkan, atau `null` jika langkah pemain sama dengan pilihan engine. Label MVP: `Best Move` untuk kehilangan di bawah 100 centipawn, `Mistake` mulai 100, dan `Blunder` mulai 300.

Error: `401` tanpa JWT, `403 GAME_FORBIDDEN` jika pengguna bukan pemain, `404 GAME_NOT_FOUND`, `409 GAME_NOT_COMPLETED`, `422 ANALYSIS_GAME_TOO_LONG`, `503 ENGINE_UNAVAILABLE` jika binary tidak dapat diakses, `503 ENGINE_BUSY` jika kapasitas antrean penuh atau waktu antre habis, dan `503 ENGINE_ANALYSIS_FAILED` jika engine gagal atau mengembalikan hasil tidak valid. Game tanpa langkah menghasilkan daftar analisis kosong.

## Socket.IO

Socket.IO digunakan untuk mengirim perubahan game ke pemain dan penonton yang telah subscribe. Klien mengirim JWT saat koneksi:

```js
const socket = io("http://localhost:3000", {
  auth: { token: "<jwt>" }
});
```

### Subscribe ke game melalui Socket.IO

Client emit `watch_game`:

```json
{ "room_id": "<uuid>" }
```

Untuk mode PvP berstatus `in_progress`, pengguna terautentikasi mana pun dapat subscribe, termasuk penonton. Game bot hanya dapat di-subscribe oleh pemiliknya. Game PvP yang masih dalam antrean tidak bisa di-subscribe. Saat matchmaking berhasil, server mengirim `game_started` secara privat ke koneksi Socket.IO milik kedua pemain; payload mencakup warna dan lawan. Setelah itu, klien memanggil `watch_game` untuk menerima `game_state` berisi `room_id`, FEN, PGN, nama pemain, mode, tingkat bot bila ada, status, hasil, preset waktu, dan snapshot jam bertanda `as_of`. Perubahan game disimpan lebih dahulu; setelah transaksi commit, server langsung menyiarkan `move` atau `game_over` kepada semua subscriber. Antrean hanya mengurutkan aksi pada game yang sama dan tidak menahan broadcast sampai ada respons klien atau menghentikan game lain. Snapshot subscribe dibaca dari state tersimpan agar klien yang reconnect pulih dari event yang terlewat. Subscribe hanya memberi hak baca; endpoint `POST /api/games/:id/moves` tetap menolak pengguna yang bukan pemain dengan `403`.

### Event server

- `move`: setiap langkah legal dari putih, hitam, atau bot yang telah disimpan, beserta aktor, warna, FEN, PGN, jam, dan status terbaru; dikirim ke semua subscriber game.
- `move` dan `game_state` menyertakan sisa jam server serta `active_color`; klien menghitung tampilan countdown lokal dari data tersebut.
- `game_over`: status akhir, `termination_reason`, pemenang, hasil, PGN, dan jam final; dikirim ke pemain dan semua penonton yang subscribe.
- `game_started`: dikirim privat kepada koneksi semua perangkat kedua pemain yang sedang online setelah matchmaking berhasil; menyertakan `room_id`, warna pemain, lawan, dan snapshot game. Jika event terlewat, baca status melalui `GET /api/games/:id`.
- `draw_offer`: tawaran remis baru dari pemain.
- `draw_response`: tawaran diterima atau ditolak.
- `game_error`: kesalahan koneksi atau subscription Socket.IO, termasuk penolakan `watch_game`.
- `game_state`: snapshot game setelah klien subscribe; jam menyertakan `as_of` supaya klien dapat menggambar countdown dari waktu server yang sama.

Contoh `game_started` untuk pemain yang mendapat warna putih:

```json
{
  "room_id": "<uuid>", "color": "w", "opponent": "player2",
  "game": { "id": "<uuid>", "mode": "pvp", "status": "in_progress", "fen": "<starting-fen>" }
}
```

Jika permintaan `watch_game` ditolak, server mengirim `game_error` dengan kode `GAME_NOT_FOUND` atau `WATCH_FORBIDDEN` dan pesan yang aman ditampilkan ke pengguna. Socket yang ditolak tidak bergabung ke room game.

Klien penonton memanggil `GET /api/games/live`, lalu emit `watch_game` dengan ID game pilihan. Daftar ini hanya mencakup PvP yang sedang berjalan; game selesai atau antrean matchmaking yang menunggu tidak dapat dimasuki sebagai penonton. Penonton tidak dapat mengirim langkah atau mengubah game.

`game_state` menyertakan preset waktu, FEN/PGN, jam sisa, sisi yang sedang berjalan, dan tawaran remis tertunda. Klien dapat menghitung tampilan jam dari timestamp snapshot; server tetap memutuskan timeout. Jika koneksi putus atau server restart, klien subscribe ulang dan server menghitung waktu dari `turn_started_at` yang tersimpan.

Contoh payload server:

```json
{
  "event": "game_state",
  "data": {
    "room_id": "<uuid>", "fen": "<current-fen>", "pgn": "1. e4",
    "clocks": { "white_ms": 178000, "black_ms": 180000, "active_color": "b", "increment_seconds": 2, "as_of": "<datetime>" },
    "white": "player1", "black": "player2", "status": "in_progress", "result": null,
    "draw_offer_by_player_id": null, "time_control": "rapid"
  }
}
```

```json
{
  "event": "move",
  "data": {
    "move": { "from": "e2", "to": "e4", "san": "e4", "color": "w" },
    "fen": "<updated-fen>", "pgn": "1. e4", "game_status": "in_progress",
    "clocks": { "white_ms": 178000, "black_ms": 180000, "active_color": "b", "increment_seconds": 2, "as_of": "<datetime>" }
  }
}
```

```json
{
  "event": "game_over",
  "data": { "status": "completed", "termination_reason": "checkmate", "winner": "player1", "result": "1-0", "pgn": "<final-pgn>", "clocks": { "white_ms": 178000, "black_ms": 0 } }
}
```

Contoh penolakan subscribe:

```json
{
  "event": "game_error",
  "data": { "code": "WATCH_FORBIDDEN", "message": "Anda tidak dapat menonton game ini.", "room_id": "<uuid>" }
}
```

REST tetap menjadi jalur utama untuk meminta/membatalkan matchmaking dan mengirim langkah. Socket.IO memberi tahu pemain saat match ditemukan, lalu mengirim snapshot, pembaruan langkah, dan status akhir game kepada pemain serta penonton yang subscribe.

Contoh event tawaran remis dan responsnya:

```json
{ "event": "draw_offer", "data": { "room_id": "<uuid>", "offered_by": "player1", "color": "w" } }
```

```json
{ "event": "draw_response", "data": { "room_id": "<uuid>", "decision": "decline" } }
```

### Rematch PvP

Hanya untuk game PvP yang sudah `completed` dan hanya untuk kedua pemainnya. Event dikirim ke room privat `user:<id>` (pemain tidak perlu lagi subscribe ke game lama). Kegagalan dikirim sebagai `rematch_error` (bukan `game_error`).

| Client → server | Payload | Keterangan |
| --- | --- | --- |
| `request_rematch` | `{ "room_id": "<uuid game lama>" }` | Permintaan pertama menyimpan tantangan; permintaan dari lawan memulai game baru. |
| `decline_rematch` | `{ "room_id": "<uuid game lama>" }` | Menolak tantangan lawan yang tertunda, atau menarik tantangan sendiri (mis. keluar dari arena). Lawan menerima `rematch_declined`. |

| Server → client | Penerima | Payload |
| --- | --- | --- |
| `rematch_requested` | peminta | `{ "room_id" }` — tantangan tersimpan, menunggu lawan. |
| `rematch_pending` | lawan | `{ "room_id", "requested_by" }` — "Lawan menantang Anda rematch". |
| `rematch_started` | kedua pemain | `{ "room_id" (baru), "previous_room_id", "color", "opponent", "game" }` — warna ditukar, papan dan jam direset, status ranked/casual dipertahankan. |
| `rematch_declined` | peminta | `{ "room_id", "declined_by" }` |
| `rematch_error` | pengirim | `{ "code", "message", "room_id" }` — `NOT_A_PLAYER`, `GAME_NOT_COMPLETED`, `REMATCH_NOT_AVAILABLE`, `REMATCH_ALREADY_STARTED`, `REMATCH_UNAVAILABLE` (salah satu pemain sudah di game/antrean lain), `INVALID_ROOM_ID`. |

Status handshake disimpan di memori per room (kedaluwarsa 5 menit) dan diserialkan per room, sehingga dua `request_rematch` serentak hanya menghasilkan satu game baru.

## MVP yang belum dicakup

- Puzzle harian belum memiliki endpoint karena koleksi puzzle valid belum ditentukan.
- Pembukaan favorit belum termasuk kontrak MVP.
- Game aktif serta clock disimpan di PostgreSQL dan dipulihkan setelah server restart; klien harus subscribe ulang dengan `watch_game` untuk menerima snapshot terbaru.
