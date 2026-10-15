# Hacktiv Chess Ultimate

Aplikasi catur online dengan permainan PvP real-time, matchmaking ranked, mode melawan bot, analisis permainan, dan puzzle taktik. Repository ini berisi frontend web dan backend API.

## Fitur

- Registrasi, login, profil, statistik, dan riwayat permainan.
- Matchmaking PvP kasual dan ranked berbasis Elo, termasuk rematch.
- Permainan real-time dengan Socket.IO dan jam yang dikelola server.
- Permainan melawan Stockfish dengan tingkat kesulitan yang dapat dipilih.
- Analisis langkah permainan menggunakan Stockfish.
- Puzzle taktik.
- Empat kontrol waktu: Bullet 1+0, Blitz 3+2, Rapid 15+10, dan Professional 60+30.
- Pengaturan tampilan papan dan tema aplikasi.

Bot dan analisis memerlukan Stockfish yang dapat dijalankan oleh server. Puzzle harian dan turnamen belum tersedia.

## Teknologi

| Bagian | Teknologi |
| --- | --- |
| Frontend | React 19, Vite, Tailwind CSS, React Router, Socket.IO Client, `chess.js` |
| Backend | Node.js, Express, Socket.IO, Sequelize, PostgreSQL, JWT |
| Engine catur | Stockfish |

## Struktur proyek

```text
client/   Aplikasi web React
server/   REST API, Socket.IO, database, dan integrasi Stockfish
```

## Menjalankan secara lokal

### Persyaratan

- Node.js yang mendukung Vite 8.
- PostgreSQL.
- Binary Stockfish jika ingin mengaktifkan bot dan analisis. Server mengunduh Stockfish otomatis saat instalasi pada Linux x64; pada Windows dan macOS, siapkan binary sendiri.

### Backend

Buka terminal di folder `server` dan buat konfigurasi lokal:

```powershell
Copy-Item .env.example .env
```

Atur `server/.env`:

- Isi `DB_DEVELOPMENT_*` dengan koneksi PostgreSQL lokal. Kosongkan `DATABASE_URL` untuk menggunakan konfigurasi ini.
- Ganti `JWT_SECRET` dengan secret acak yang panjang.
- Atur `STOCKFISH_PATH` ke lokasi binary Stockfish jika diperlukan.
- Pastikan `CLIENT_ORIGIN` mencakup origin frontend, biasanya `http://localhost:5173`.

Lalu install dependency, buat database, jalankan migrasi, dan mulai server:

```powershell
npm install
npm run db:create
npm run db:migrate
npm run dev
```

API berjalan di `http://localhost:3000`. Health check: `http://localhost:3000/health`.

### Frontend

Di terminal kedua, buka folder `client`:

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Pastikan `VITE_API_URL` pada `client/.env` mengarah ke API, biasanya `http://localhost:3000`. Buka alamat yang ditampilkan Vite, biasanya `http://localhost:5173`, lalu buat akun melalui halaman Register.

### Database testing

Isi variabel `DB_TEST_*` pada `server/.env`, lalu jalankan dari folder `server`:

```powershell
npm run db:create:testing
npm run db:migrate:testing
npm test
```

## Perintah utama

Jalankan setiap perintah dari folder yang disebutkan.

| Folder | Perintah | Fungsi |
| --- | --- | --- |
| `client` | `npm run dev` | Menjalankan frontend untuk pengembangan |
| `client` | `npm run build` | Membuat build frontend |
| `client` | `npm run lint` | Menjalankan ESLint |
| `server` | `npm run dev` | Menjalankan backend dengan watch mode |
| `server` | `npm start` | Menjalankan backend |
| `server` | `npm run db:migrate` | Menerapkan migrasi development |
| `server` | `npm test` | Menjalankan test backend |

## Dokumentasi

- [Dokumentasi API proyek](./API%20Documentation.md)
- [Kontrak API backend](./server/API.md)
- [Panduan frontend](./client/README.md)
- [Panduan backend](./server/README.md)
- [Skema database](./server/DATABASE_SCHEMA.md)

## Keamanan

Jangan commit `.env`, secret JWT, password database, atau kredensial lain. Untuk deployment, atur environment database production, `CLIENT_ORIGIN`, `JWT_SECRET`, serta `STOCKFISH_PATH` pada host server.
