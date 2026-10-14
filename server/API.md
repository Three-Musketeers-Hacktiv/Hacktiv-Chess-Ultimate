# Hacktiv Chess Server API

Dokumen ini mendefinisikan kontrak backend MVP berbasis Node.js dan Express. HTTP REST menangani pembuatan serta pengelolaan game; Socket.IO menyebarkan perubahan game secara real-time. Server menjadi sumber kebenaran untuk posisi papan dan validasi langkah.

## Konvensi

- Base URL development: `http://localhost:3000`
- Request dan response menggunakan JSON.
- Endpoint bertanda **Auth** memerlukan header `Authorization: Bearer <token>`.
- ID game dan pengguna berbentuk UUID.
- **FEN** (*Forsyth–Edwards Notation*) merepresentasikan snapshot posisi papan pada satu saat, termasuk giliran yang harus jalan. API mengembalikan FEN terkini pada game dan FEN setelah langkah bila diperlukan.
- **PGN** (*Portable Game Notation*) merepresentasikan urutan langkah game, misalnya `1. e4 e5 2. Nf3 Nc6`. History langkah terstruktur disimpan di database; backend membentuk PGN untuk response, ekspor, atau analisis Stockfish.
- Backend menggunakan `chess.js` v1.4.0 untuk memvalidasi langkah pemain dan bot, menjaga posisi kanonis, serta membentuk FEN/PGN. Stockfish dijalankan di server hanya untuk memilih langkah bot dan menganalisis PGN; langkah bot divalidasi lagi dengan `chess.js` sebelum disimpan. Versi dependency dikunci di lockfile.
- Registrasi dan login wajib sebelum membuat atau bergabung ke game PvP.

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
- Preset waktu: `bullet` = 1 menit + 0 detik increment; `blitz` = 3 menit + 2 detik; `rapid` = 15 menit + 10 detik; `professional` = 60 menit + 30 detik. API menerima ID preset; pasangan durasi/increment ditetapkan server, jam sisa disimpan dalam milidetik, dan jam dihitung server. Pemain yang join room mengikuti preset pembuat room.
- `bot_difficulty` wajib hanya untuk game bot (`easy`, `medium`, `hard`); PvP harus `NULL`. Parameter Stockfish ditentukan server berdasarkan tingkat tersebut.
- `white_player_id` wajib. `black_player_id` kosong pada bot dan room PvP yang menunggu; jika kedua pemain terisi, ID keduanya harus berbeda.
- Hasil kosong sebelum `completed` dan wajib terisi sesudahnya. Waktu mulai terisi ketika game dimulai; waktu selesai hanya terisi ketika game selesai.
- Jam kedua pemain diinisialisasi dari preset. `turn_started_at` menjadi referensi server untuk jam yang sedang berjalan. Response mengirim `white_ms` dan `black_ms` sebagai integer JSON meskipun kolom PostgreSQL bertipe `BIGINT`. Saat game selesai, timestamp giliran dan tawaran remis dikosongkan.
- `draw_offer_by_player_id` hanya boleh berupa salah satu ID pemain PvP; pada game bot nilainya harus `NULL`. `termination_reason` dapat berupa `checkmate`, `stalemate`, `dead_position`, `resignation`, `timeout`, `draw_agreement`, `threefold_repetition`, `fivefold_repetition`, `fifty_move_rule`, atau `seventy_five_move_rule`.
- `ply > 0`; `color` hanya `w`/`b`; petak asal/tujuan harus berbentuk `[a-h][1-8]`; `promotion` hanya `q`/`r`/`b`/`n` atau `NULL`.
- `actor_type = 'player'` memerlukan `player_id`; `actor_type = 'bot'` mengharuskan `player_id` kosong. Kecocokan ID pemain dengan warna dan mode bot diperiksa service game dalam transaksi.
- Constraint FK dan CHECK ditegakkan di PostgreSQL. Indeks unik: `users.username`, `users.email`, (`game_id`, `ply`). Indeks query: (`white_player_id`, `created_at`), (`black_player_id`, `created_at`), dan (`mode`, `status`, `created_at`).

`game_moves` adalah sumber history dan PGN; `games.current_fen` menyimpan posisi terakhir. PGN dibentuk dari langkah terurut untuk response atau analisis. Detail ERD dan urutan transaksi ada di [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md).

## Autentikasi

1. Buat akun melalui `POST /api/auth/register`.
2. Login melalui `POST /api/auth/login` untuk memperoleh JWT.
3. Kirim JWT sebagai `Authorization: Bearer <token>` pada endpoint bertanda **Auth**.
4. Untuk Socket.IO, kirim token yang sama pada `auth.token` saat membuka koneksi.

Password disimpan sebagai hash bcrypt. Server tidak mengembalikan password atau hash. `JWT_SECRET` wajib tersedia di environment server dengan panjang minimal 32 byte; token ditandatangani dengan HS256, berisi UUID pengguna pada claim `sub`, dan berlaku 7 hari. Token hilang, tidak valid, atau kedaluwarsa menghasilkan `401`. Login dengan email yang tidak terdaftar dan password salah mengembalikan pesan `401` yang sama.

Register dibatasi 5 request dan login 10 request per alamat IP setiap 15 menit; pelanggaran menghasilkan `429` dan header `Retry-After`. Pembatas saat ini berada di memori proses, sehingga hanya sesuai satu instance dan akan reset saat server restart. Sebelum menjalankan beberapa instance, ganti penyimpanan limiter dengan store bersama. Password harus minimal 8 karakter dan maksimal 72 byte UTF-8 agar tidak terpotong oleh bcrypt.

MVP belum menyediakan logout yang mencabut token, refresh token, verifikasi email, atau pemulihan password. Token yang sudah diterbitkan tetap berlaku sampai kedaluwarsa.

### Alur login, home, dan pemilihan mode

1. Pengguna login melalui `POST /api/auth/login`.
2. Setelah menerima token, klien memanggil `GET /` dengan token untuk menampilkan beranda dan pilihan fitur.
3. Dari beranda, pengguna memilih **PvP** atau **Melawan Bot**.
4. Untuk bot, klien membuat game dengan `POST /api/games` dan body `{ "mode": "bot" }`.
5. Untuk PvP, lobby menampilkan tab **Room Terbuka** dari `GET /api/games/open`; pengguna dapat membuat room menunggu lawan atau bergabung ke room yang ditampilkan.
6. Kedua pemain masuk ke room yang sama melalui Socket.IO `watch_game` setelah game berstatus `in_progress`. Pengguna lain dapat membuka daftar game PvP aktif dan menontonnya tanpa hak mengirim langkah.
7. Login tidak membuat game dan tidak menerima pilihan mode; pilihan mode dikirim setelah pengguna memilihnya di beranda.

## REST API

### Health check

`GET /health`

Response `200`:

```json
{ "status": "ok" }
```

### Home

`GET /` (**Auth**)

Dipanggil setelah login. Endpoint ini menyediakan ringkasan pemain, pilihan mode permainan, dan katalog fitur untuk layar home frontend. Fitur yang belum tersedia tetap dapat ditampilkan dengan status `planned`.

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
      { "id": "history", "label": "Riwayat Permainan", "status": "planned" },
      { "id": "analysis", "label": "Analisis Permainan", "status": "planned" },
      { "id": "daily_puzzle", "label": "Puzzle Harian", "status": "planned" },
      { "id": "tournaments", "label": "Turnamen", "status": "planned" }
    ]
  }
}
```

Frontend hanya memulai game setelah pengguna memilih mode dan memanggil `POST /api/games`.

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

Jam dihitung secara otoritatif oleh server. Pada PvP, pilihan pembuat room berlaku untuk kedua pemain.

Body PvP:

```json
{ "mode": "pvp", "time_control": "blitz" }
```

Response `201` membuat game menunggu lawan:

```json
{
  "status": "success",
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

Game bot dimulai dengan pengguna sebagai putih dan Stockfish sebagai hitam. `difficulty` wajib pada mode bot (`easy`, `medium`, atau `hard`) dan ditolak untuk PvP. Pemetaan ke parameter Stockfish ditentukan server.

Klien menggunakan endpoint ini setelah pengguna memilih mode dan preset waktu. Untuk PvP, game menunggu lawan; jam dimulai setelah lawan bergabung. Untuk bot, game langsung dimulai dan jam putih berjalan.

Response game menyertakan `clocks`: sisa waktu putih/hitam dalam milidetik sebagai integer JSON, `active_color`, dan `as_of` (waktu server ketika nilai dihitung). Klien boleh menggerakkan countdown visual dari `as_of`, tetapi waktu server adalah sumber kebenaran. Server harus menyelesaikan game saat jam aktif habis meskipun tidak ada request baru.

### Daftar game terbuka

`GET /api/games/open` (**Auth**)

Endpoint ini menjadi sumber data untuk tab **Room Terbuka** di lobby PvP. Response `200` berisi game PvP yang menunggu lawan, termasuk preset waktunya; jika belum ada room, `games` berupa array kosong:

```json
{
  "status": "success",
  "games": [{ "id": "<uuid>", "white": "player1", "time_control": "blitz", "createdAt": "<datetime>" }]
}
```

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

### Bergabung ke game PvP

`POST /api/games/:id/join` (**Auth**)

Pemain kedua bergabung sebagai hitam dan mewarisi preset waktu pembuat room. Pemilik game tidak dapat bergabung sebagai lawan untuk game-nya sendiri. Server harus mengklaim slot lawan secara atomik: hanya satu permintaan join yang berhasil; permintaan bersamaan berikutnya menerima `409` jika room sudah terisi.

Response `200`:

```json
{
  "status": "success",
  "game": {
    "id": "<uuid>",
    "mode": "pvp",
    "status": "in_progress",
    "color": "b",
    "fen": "<starting-fen>",
    "time_control": { "id": "professional", "initial_seconds": 3600, "increment_seconds": 30 },
    "clocks": { "white_ms": 3600000, "black_ms": 3600000, "active_color": "w", "as_of": "<datetime>" },
    "opponent": "player1"
  }
}
```

### Kirim langkah

`POST /api/games/:id/moves` (**Auth**)

Body:

```json
{ "from": "e2", "to": "e4", "promotion": "q" }
```

`promotion` opsional dan dapat berisi `q`, `r`, `b`, atau `n`. Saat handler menerima request, server mencatat `receivedAt` UTC sebelum validasi atau operasi database. Langkah dianggap tepat waktu hanya jika `receivedAt` lebih awal dari deadline jam aktif; timestamp sama dengan atau setelah deadline mengakhiri game karena timeout. Request yang mengubah state game—termasuk langkah, menyerah, tawaran remis, klaim remis, dan timeout—diserialkan dalam antrean per game. Jika request diterima pada atau sesudah deadline, timeout diproses lebih dahulu. Langkah ilegal tidak menghentikan atau mengatur ulang jam.

Untuk langkah legal, server menghitung waktu pemain sampai `receivedAt`, menyimpan langkah dan posisi dalam transaksi, memberi increment setelah langkah sah, lalu memulai jam lawan setelah commit. Jam sistem aplikasi dan PostgreSQL harus tersinkron. Antrean dalam memori ini berlaku untuk satu instance backend; deployment beberapa instance memerlukan mekanisme pengurutan bersama.

Tingkat bot dipetakan ke Stockfish `Skill Level`: mudah `0`, sedang `5`, sulit `10`. Ini tingkat relatif, bukan rating Elo yang dijanjikan. Jangan atur `UCI_Elo` bersama `Skill Level` dan jangan menerima opsi UCI mentah dari klien.

Pada game bot, Stockfish berpikir di luar transaksi database. Jalankan maksimal dua proses pencarian bersamaan, masing-masing `Threads = 1`, dengan maksimal lima pekerjaan yang menunggu. Batasi langkah bot hingga 1000 ms dan analisis PGN hingga 5000 ms; prioritaskan pekerjaan bot. Slot bot wajib dicadangkan sebelum menyimpan langkah pemain. Jika kapasitas penuh, kembalikan `503 ENGINE_BUSY` dan jangan simpan langkah pemain. Lepaskan slot yang sudah dicadangkan jika validasi langkah atau transaksi database gagal. Sebelum menyimpan hasil engine, server mengunci ulang game dan memastikan game masih aktif, giliran masih milik bot, FEN belum berubah, dan jam bot belum habis. Langkah engine divalidasi dengan `chess.js` sebelum disimpan.

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

Game berakhir otomatis pada checkmate, stalemate, dead position yang dikenali, fivefold repetition, aturan 75 langkah, atau timeout. Untuk MVP, dead position hanya dikenali saat `chess.js` `isInsufficientMaterial()` mengembalikan `true`; aturan ini praktis dan tidak berusaha mendeteksi semua posisi remis atau menyalin seluruh aturan Chess.com. Saat timeout, hasil remis hanya jika `isInsufficientMaterial()` mengembalikan `true` untuk seluruh posisi; selain itu pemain yang kehabisan waktu kalah. Resign saat game masih aktif langsung memberi kemenangan kepada lawan. Backend menghitung fivefold repetition dan 75 langkah dengan memutar ulang semua langkah dari posisi awal. Kunci posisi pengulangan memasukkan susunan bidak, sisi yang bergerak, hak rokade, dan kemungkinan en passant yang legal. Threefold repetition dan aturan 50 langkah diajukan sebagai klaim untuk posisi saat ini; checkmate pada langkah terakhir mendahului aturan 75 langkah. Remis yang disepakati juga mengakhiri game.

### Riwayat game pengguna

`GET /api/games` (**Auth**)

Response `200` berisi hingga 100 game milik pengguna, termasuk mode, status, hasil, preset waktu, tingkat bot bila ada, lawan, termination reason, dan waktu pembaruan.

### Detail game

`GET /api/games/:id` (**Auth**)

Hanya pemain game yang dapat melihat detail. Response memuat FEN terakhir, PGN, status, hasil, termination reason, pemain, preset dan sisa jam, tawaran remis yang tertunda, serta history terstruktur berurutan. Setiap item history memuat `ply`, `color`, `actor`, `from`, `to`, `promotion`, `san`, dan `fen_after`. Meninjau history tidak mengubah posisi game aktif.

### Profil dan statistik

`GET /api/profile/me` (**Auth**)

Response memuat ID, username, statistik menang/seri/kalah, dan hingga 50 game selesai beserta PGN.

### Analisis pascapertandingan

`POST /api/game/analyze` (**Auth**)

Body:

```json
{ "pgn": "1. e4 e5 2. Nf3 Nc6" }
```

PGN dibatasi hingga 10 KB dan 60 half-move. Stockfish mengevaluasi langkah dan mengembalikan label serta alternatif terbaik. Analisis dibatasi 5000 ms; layanan menjalankan maksimal dua proses aktif dan menampung maksimal lima pekerjaan yang menunggu. Permintaan analisis yang antreannya penuh ditolak dengan `503 ENGINE_BUSY`.

Response `200`:

```json
{
  "status": "success",
  "analysis": [
    {
      "move_number": 1,
      "move": "e4",
      "evaluation": "0.3",
      "label": "Best Move",
      "best_alternative": null
    }
  ]
}
```

Label MVP: `Best Move`, `Mistake`, atau `Blunder`. Jika Stockfish tidak tersedia, server mengembalikan error server.

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

Untuk mode PvP berstatus `in_progress`, pengguna terautentikasi mana pun dapat subscribe, termasuk penonton yang bukan pemain. Untuk game bot atau room yang masih menunggu lawan, hanya pemain terkait yang dapat subscribe. Server memvalidasi akses, memasukkan socket ke room game, lalu mengirim `game_state` berisi `room_id`, FEN, PGN, nama pemain, status, hasil, preset waktu, dan snapshot jam bertanda `as_of`. Perubahan game disimpan lebih dahulu; setelah transaksi commit, server langsung menyiarkan `move` atau `game_over` kepada semua subscriber. Antrean hanya mengurutkan aksi pada game yang sama dan tidak menahan broadcast sampai ada respons klien atau menghentikan game lain. Snapshot subscribe dibaca dari state tersimpan agar klien yang reconnect pulih dari event yang terlewat. Subscribe hanya memberi hak baca; endpoint `POST /api/games/:id/moves` tetap menolak pengguna yang bukan pemain dengan `403`.

### Event server

- `move`: setiap langkah legal dari putih, hitam, atau bot yang telah disimpan, beserta aktor, warna, FEN, PGN, jam, dan status terbaru; dikirim ke semua subscriber game.
- `move` dan `game_state` menyertakan sisa jam server serta `active_color`; klien menghitung tampilan countdown lokal dari data tersebut.
- `game_over`: status akhir, `termination_reason`, pemenang, hasil, PGN, dan jam final; dikirim ke pemain dan semua penonton yang subscribe.
- `draw_offer`: tawaran remis baru dari pemain.
- `draw_response`: tawaran diterima atau ditolak.
- `game_error`: kesalahan koneksi atau subscription Socket.IO, termasuk penolakan `watch_game`.
- `game_state`: snapshot game setelah klien subscribe; jam menyertakan `as_of` supaya klien dapat menggambar countdown dari waktu server yang sama.

Jika permintaan `watch_game` ditolak, server mengirim `game_error` dengan kode `GAME_NOT_FOUND` atau `WATCH_FORBIDDEN` dan pesan yang aman ditampilkan ke pengguna. Socket yang ditolak tidak bergabung ke room game.

Klien penonton memanggil `GET /api/games/live`, lalu emit `watch_game` dengan ID game pilihan. Daftar ini hanya mencakup PvP yang sedang berjalan; game selesai atau room menunggu lawan tidak dapat dimasuki sebagai penonton. Penonton tidak dapat mengirim langkah atau mengubah game.

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

REST tetap menjadi jalur utama untuk membuat game, bergabung, dan mengirim langkah. Socket.IO mengirim snapshot awal, pembaruan langkah, dan status akhir game kepada pemain serta penonton yang subscribe, tanpa polling.

Contoh event tawaran remis dan responsnya:

```json
{ "event": "draw_offer", "data": { "room_id": "<uuid>", "offered_by": "player1", "color": "w" } }
```

```json
{ "event": "draw_response", "data": { "room_id": "<uuid>", "decision": "decline" } }
```

## MVP yang belum dicakup

- Puzzle harian belum memiliki endpoint karena koleksi puzzle valid belum ditentukan.
- Rating Elo, pembukaan favorit, dan matchmaking berbasis rating belum termasuk kontrak MVP.
- Game aktif serta clock disimpan di PostgreSQL dan dipulihkan setelah server restart; klien harus subscribe ulang dengan `watch_game` untuk menerima snapshot terbaru.
