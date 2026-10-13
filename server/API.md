# Hacktiv Chess Server API

Dokumen ini mendefinisikan kontrak backend MVP berbasis Node.js dan Express. HTTP REST menangani pembuatan serta pengelolaan game; Socket.IO menyebarkan perubahan game secara real-time. Server menjadi sumber kebenaran untuk posisi papan dan validasi langkah.

## Konvensi

- Base URL development: `http://localhost:3000`
- Request dan response menggunakan JSON.
- Endpoint bertanda **Auth** memerlukan header `Authorization: Bearer <token>`.
- ID game dan pengguna berbentuk UUID.
- Posisi papan menggunakan FEN dan riwayat langkah menggunakan PGN.
- Stockfish dijalankan di server untuk langkah bot dan analisis PGN.
- Registrasi dan login wajib sebelum membuat atau bergabung ke game PvP.

## Autentikasi

1. Buat akun melalui `POST /api/auth/register`.
2. Login melalui `POST /api/auth/login` untuk memperoleh JWT.
3. Kirim JWT sebagai `Authorization: Bearer <token>` pada endpoint bertanda **Auth**.
4. Untuk Socket.IO, kirim token yang sama pada `auth.token` saat membuka koneksi.

Password disimpan sebagai hash bcrypt. Server tidak mengembalikan password atau hash. Token berlaku 7 hari. Token hilang, tidak valid, atau kedaluwarsa menghasilkan `401`.

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
      { "id": "history", "label": "Riwayat Permainan", "status": "available" },
      { "id": "analysis", "label": "Analisis Permainan", "status": "available" },
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

Username harus 3–24 karakter dan hanya berisi huruf, angka, `_`, atau `-`. Email harus valid; password minimal 8 karakter. Email atau username yang sudah dipakai menghasilkan `409`.

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

Body PvP:

```json
{ "mode": "pvp" }
```

Response `201` membuat game menunggu lawan:

```json
{
  "status": "success",
  "game": {
    "id": "<uuid>",
    "mode": "pvp",
    "status": "waiting",
    "color": "w",
    "fen": "<starting-fen>",
    "opponent": null
  }
}
```

Body PvE:

```json
{ "mode": "bot" }
```

Game bot dimulai dengan pengguna sebagai putih dan Stockfish sebagai hitam. Mode yang diterima adalah `pvp` dan `bot`.

Klien menggunakan endpoint ini setelah pengguna memilih mode di lobby pascalogin. Untuk PvP, game menunggu lawan; untuk bot, game langsung dimulai.

### Daftar game terbuka

`GET /api/games/open` (**Auth**)

Endpoint ini menjadi sumber data untuk tab **Room Terbuka** di lobby PvP. Response `200` berisi game PvP yang menunggu lawan; jika belum ada room, `games` berupa array kosong:

```json
{
  "status": "success",
  "games": [{ "id": "<uuid>", "white": "player1", "createdAt": "<datetime>" }]
}
```

### Daftar game PvP yang sedang berlangsung

`GET /api/games/live` (**Auth**)

Mengembalikan game PvP berstatus `in_progress` agar frontend dapat menampilkan tab **Sedang Berlangsung** untuk ditonton. Response hanya memuat informasi publik: ID game, username pemain putih dan hitam, waktu mulai, FEN terkini, serta jumlah langkah. Tidak menyertakan email, token, atau data profil privat.

Response `200`:

```json
{
  "status": "success",
  "games": [{ "id": "<uuid>", "white": "player1", "black": "player2", "startedAt": "<datetime>", "fen": "<current-fen>", "moveCount": 12 }]
}
```

### Bergabung ke game PvP

`POST /api/games/:id/join` (**Auth**)

Pemain kedua bergabung sebagai hitam. Pemilik game tidak dapat bergabung sebagai lawan untuk game-nya sendiri. Server harus mengklaim slot lawan secara atomik: hanya satu permintaan join yang berhasil; permintaan bersamaan berikutnya menerima `409` jika room sudah terisi.

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

`promotion` opsional dan dapat berisi `q`, `r`, `b`, atau `n`. Server memeriksa pemain, giliran, dan legalitas langkah sebelum menyimpan posisi baru dan PGN. Pada game bot, server juga meminta langkah Stockfish setelah langkah pemain.

Response `200`:

```json
{
  "status": "success",
  "move": { "from": "e2", "to": "e4", "san": "e4", "fen": "<updated-fen>" },
  "bot_move": null,
  "fen": "<current-fen>",
  "pgn": "1. e4",
  "game_status": "in_progress",
  "result": null
}
```

`bot_move` berisi langkah bot pada mode PvE, atau `null` pada PvP. Langkah ilegal menghasilkan `400`, bukan giliran pemain menghasilkan `409`, dan pengguna yang bukan pemain menghasilkan `403`.

### Riwayat game pengguna

`GET /api/games` (**Auth**)

Response `200` berisi hingga 100 game milik pengguna, termasuk mode, status, hasil, lawan, dan waktu pembaruan.

### Detail game

`GET /api/games/:id` (**Auth**)

Hanya pemain game yang dapat melihat detail. Response memuat FEN terakhir, PGN, status, hasil, dan nama pemain.

### Profil dan statistik

`GET /api/profile/me` (**Auth**)

Response memuat ID, username, statistik menang/seri/kalah, dan hingga 50 game selesai beserta PGN.

### Analisis pascapertandingan

`POST /api/game/analyze` (**Auth**)

Body:

```json
{ "pgn": "1. e4 e5 2. Nf3 Nc6" }
```

PGN dibatasi hingga 10 KB dan 60 half-move. Stockfish mengevaluasi langkah dan mengembalikan label serta alternatif terbaik.

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

### Subscribe ke game REST

Client emit `watch_game`:

```json
{ "room_id": "<uuid>" }
```

Untuk mode PvP berstatus `in_progress`, pengguna terautentikasi mana pun dapat subscribe, termasuk penonton yang bukan pemain. Untuk game bot atau room yang masih menunggu lawan, hanya pemain terkait yang dapat subscribe. Server memvalidasi akses, memasukkan socket ke room game, lalu mengirim `game_state` berisi `room_id`, FEN, PGN, nama pemain, status, dan hasil terkini. Proses subscribe/snapshot dan publikasi langkah harus diurutkan per game agar snapshot awal tidak menimpa langkah yang lebih baru. Setelah setiap langkah dari putih atau hitam lolos validasi dan tersimpan, server menyiarkan event `move` kepada semua pemain dan penonton yang subscribe. Subscribe hanya memberi hak baca; endpoint `POST /api/games/:id/moves` tetap menolak pengguna yang bukan pemain dengan `403`.

### Event server

- `move`: setiap langkah legal dari putih atau hitam yang telah disimpan, beserta warna pemain, FEN, PGN, dan status terbaru; dikirim ke semua subscriber game.
- `game_over`: status akhir (`checkmate`, `stalemate`, atau `draw`), pemenang, hasil, dan PGN; dikirim ke pemain dan semua penonton yang subscribe.
- `game_error`: kesalahan koneksi atau subscription Socket.IO, termasuk penolakan `watch_game`.
- `game_state`: snapshot game setelah klien subscribe.

Jika permintaan `watch_game` ditolak, server mengirim `game_error` dengan kode `GAME_NOT_FOUND` atau `WATCH_FORBIDDEN` dan pesan yang aman ditampilkan ke pengguna. Socket yang ditolak tidak bergabung ke room game.

Klien penonton memanggil `GET /api/games/live`, lalu emit `watch_game` dengan ID game pilihan. Daftar ini hanya mencakup PvP yang sedang berjalan; game selesai atau room menunggu lawan tidak dapat dimasuki sebagai penonton. Penonton tidak dapat mengirim langkah atau mengubah game.

Contoh payload server:

```json
{
  "event": "game_state",
  "data": {
    "room_id": "<uuid>", "fen": "<current-fen>", "pgn": "1. e4",
    "white": "player1", "black": "player2", "status": "in_progress", "result": null
  }
}
```

```json
{
  "event": "move",
  "data": {
    "move": { "from": "e2", "to": "e4", "san": "e4", "color": "w" },
    "fen": "<updated-fen>", "pgn": "1. e4", "game_status": "in_progress"
  }
}
```

```json
{
  "event": "game_over",
  "data": { "status": "checkmate", "winner": "player1", "result": "1-0", "pgn": "<final-pgn>" }
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

## MVP yang belum dicakup

- Puzzle harian belum memiliki endpoint karena koleksi puzzle valid belum ditentukan.
- Rating Elo, pembukaan favorit, matchmaking berbasis rating, dan pemulihan sesi setelah server restart belum termasuk kontrak MVP.
