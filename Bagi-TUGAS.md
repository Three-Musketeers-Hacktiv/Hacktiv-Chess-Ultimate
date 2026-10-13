# Catur Online Multiplayer - Group Project

## Deskripsi Proyek
Proyek ini adalah aplikasi web *Single Page Application (SPA)* game catur *real-time* yang dirancang untuk memenuhi kriteria penilaian *Group Project*. Aplikasi ini menggunakan arsitektur Client-Server, mengimplementasikan komunikasi *real-time*, dan didukung oleh fitur kecerdasan buatan (AI) baik untuk mode bermain maupun analisis pascapertandingan.

## Requirement Checklist (Berdasarkan Rubrik Penilaian)
- [x] **Tema Aplikasi:** Multiplayer game (Catur Online).
- [x] **Github Workflow:** Menerapkan proses *branching, commit*, dan *merge* secara disiplin.
- [x] **Real-Time & State Management:** Menggunakan Socket.IO dan React Context.
- [x] **Arsitektur:** Client-Server.
- [x] **Client Wajib:** Menggunakan Vite + React.js, berkonsep SPA (Single Page Application), Component-based, menggunakan React Router, dan **React Context** sebagai State Management.
- [x] **Server Wajib:** Menyediakan REST API, terintegrasi Socket.IO, dan memiliki API Documentation (lihat `API.md`).
- [x] **Fitur Utama Menarik:** Bermain catur PvP secara instan (sudah dapat dikonfirmasi ke *instructor* / *buddy*).
- [x] **Deploy Aplikasi:** Wajib *deploy* Client, dan opsional *deploy* Server agar bisa diakses publik.
- [x] **Fitur AI Pendukung:** Bot Grandmaster Magnus Carlsen menggunakan Stockfish Engine untuk mode *Player vs Computer*.
- [x] **Fitur Ekstra (AI):** Post-Game Analysis menggunakan Stockfish untuk mengevaluasi *blunder*, *mistake*, dan *best move* setelah permainan selesai.

---

## Pembagian Tugas

### 🔵 Tugas Tim Client (Frontend)
1. **Setup Proyek (Vite + React.js):**
   - Inisialisasi proyek, konfigurasi Tailwind CSS untuk *styling*, dan setup **React Router** agar aplikasi menjadi murni SPA tanpa *page reload*.
2. **State Management (React Context):**
   - Buat `AuthContext` untuk menyimpan token JWT, profil *user*, dan status login.
   - Buat `SocketContext` untuk mengelola koneksi *real-time* tunggal di seluruh aplikasi.
3. **Komponen & UI:**
   - Kembangkan halaman *Login* dan *Register*.
   - Kembangkan halaman *Lobby* untuk memilih mode "PvP" atau "PvE (AI)".
   - Implementasikan komponen papan catur interaktif menggunakan `react-chessboard`.
   - Buat halaman/modal **Post-Game Analysis** yang muncul setelah pertandingan selesai (`game_over`). Tampilkan daftar pergerakan, sorot langkah yang tergolong *Blunder* atau *Mistake*, serta tampilkan rekomendasi *Best Move* dari AI.
4. **Deployment:**
   - Lakukan *deploy* aplikasi sisi *client* ke layanan hosting statis (misal: Vercel, Netlify, atau Firebase Hosting) agar bisa ditunjukkan ke publik.

### 🔴 Tugas Tim Server (Backend)
1. **Arsitektur REST API & Database:**
   - Konfigurasi Node.js, Express, dan PostgreSQL (dengan Sequelize ORM).
   - Sediakan *endpoint* autentikasi (`POST /api/auth/register`, `POST /api/auth/login`).
   - Buat dan pelihara **API Documentation** di dalam file `API.md`.
2. **Real-Time Communication (Socket.IO):**
   - Implementasikan sistem *matchmaking* (`join_room`).
   - Pancarkan (*broadcast*) langkah catur antar pemain secara *real-time*.
3. **Integrasi Fitur AI (Stockfish):**
   - Konfigurasi *engine* Stockfish di sisi server.
   - Buat logika khusus ketika pemain bermain melawan AI (Level Magnus Carlsen / Maksimal) untuk merespons langkah pemain secara instan.
   - Buat *endpoint* REST API baru (`POST /api/game/analyze`) yang menerima riwayat permainan (dalam format PGN). Gunakan Stockfish untuk mengevaluasi kualitas setiap langkah dan mencari saran alternatif terbaik.
4. **Deployment (Opsional tapi Direkomendasikan):**
   - Lakukan *deploy server* ke platform *cloud* (misal: Render, Railway, atau VPS).

---

## Aturan Github Workflow
Selama masa pengembangan *Group Project*, semua anggota wajib mematuhi aturan berikut:
1. Tidak ada yang melakukan *push* langsung ke *branch* `main`.
2. Setiap mengerjakan fitur baru, buat *branch* terpisah (contoh: `feature/login-ui`, `feature/socket-matchmaking`).
3. Setelah selesai, buat *Pull Request (PR)*.
4. Minta anggota tim lain (atau *buddy*) untuk me-*review* kode sebelum melakukan *Merge*.