# API Documentation & Socket.IO Events

Dokumen ini berfungsi sebagai **API Documentation** resmi untuk Group Project, mencakup kontrak komunikasi HTTP (REST API) dan Web Socket antara Client (React) dan Server (Express/Node.js).

---

## A. REST API ENDPOINTS

Base URL: `http://localhost:3000` (saat *development*)

### 1. Register Akun Baru
*   **URL:** `/api/auth/register`
*   **Method:** `POST`
*   **Deskripsi:** Mendaftarkan pengguna baru ke dalam database PostgreSQL.
*   **Request Body:**
    ```json
    {
      "username": "player1",
      "email": "player1@email.com",
      "password": "passwordrahasia123"
    }
    ```
*   **Response Success (201 Created):**
    ```json
    {
      "status": "success",
      "message": "Akun berhasil dibuat. Silakan login."
    }
    ```

### 2. Login
*   **URL:** `/api/auth/login`
*   **Method:** `POST`
*   **Deskripsi:** Memverifikasi pengguna dan menerbitkan JWT (*JSON Web Token*) untuk otorisasi akses.
*   **Request Body:**
    ```json
    {
      "email": "player1@email.com",
      "password": "passwordrahasia123"
    }
    ```
*   **Response Success (200 OK):**
    ```json
    {
      "status": "success",
      "token": "eyJhbGciOiJIUzI1NiIsInR5c...", 
      "user": {
        "id": 1,
        "username": "player1"
      }
    }
    ```

### 3. Post-Game Analysis (AI)
*   **URL:** `/api/game/analyze`
*   **Method:** `POST`
*   **Deskripsi:** Memproses riwayat permainan (format PGN) menggunakan Stockfish untuk mengevaluasi kualitas setiap langkah dan mencari letak *blunder* atau saran alternatif terbaik.
*   **Request Body:**
    ```json
    {
      "pgn": "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5"
    }
    ```
*   **Response Success (200 OK):**
    ```json
    {
      "status": "success",
      "analysis": [
        {
          "move_number": 1,
          "move": "e4",
          "evaluation": "+0.3",
          "label": "Best Move",
          "best_alternative": null
        },
        {
          "move_number": 3,
          "move": "Bc5",
          "evaluation": "-1.5",
          "label": "Blunder",
          "best_alternative": "Nf6"
        }
      ]
    }
    ```

---

## B. REAL TIME COMMUNICATION (SOCKET.IO)

Di sisi *Client*, inisialisasi koneksi ini harus ditempatkan di dalam **React Context** (`SocketContext`) agar tidak terjadi inisialisasi berulang saat berpindah halaman.

### 1. Otentikasi Koneksi
Kirimkan token JWT yang didapat dari API Login saat membuat koneksi awal.
```javascript
import { io } from "socket.io-client";

// Contoh inisialisasi di dalam React Context
const socket = io("http://localhost:3000", {
  auth: { token: localStorage.getItem("token") }
});
```

### 2. Matchmaking (Mode PvP)
*   **Client Emit:** `join_room` (Client meminta server untuk mencarikan lawan manusia).
*   **Server Emit:** `game_started` (Server memberitahu kedua client bahwa pertandingan dimulai).
    ```json
    {
      "room_id": "room_xyz123",
      "color": "w", // 'w' untuk putih (jalan duluan), 'b' untuk hitam
      "opponent": { "username": "player2", "rating": 1500 }
    }
    ```

### 3. Mode AI (Fitur AI Pendukung)
*   **Client Emit:** `start_bot_match`
    ```json
    {
      "difficulty": "magnus" 
    }
    ```
*   **Server Emit:** `game_started`
    ```json
    {
      "room_id": "bot_room_abc789",
      "color": "w", 
      "opponent": { "username": "GM Magnus Carlsen", "rating": 2882 }
    }
    ```

### 4. Siklus Permainan (Pertukaran Langkah)
Event ini wajib digunakan untuk me-sinkronisasi *state* papan catur antar pengguna secara *real-time*.
*   **Client Emit (Mengirim langkah ke Server):** `move`
    ```json
    {
      "from": "e2",
      "to": "e4",
      "promotion": "q" // opsional
    }
    ```
*   **Server Emit (Menyebarkan langkah ke lawan / bot):** `move`
    ```json
    {
      "from": "e7",
      "to": "e5",
      "promotion": "q" 
    }
    ```

### 5. Game Over
*   **Server Emit:** `game_over` (Menandakan status akhir permainan).
    ```json
    {
      "status": "checkmate", // bisa juga "draw", "stalemate"
      "winner": "GM Magnus Carlsen", 
      "message": "GM Magnus Carlsen menang lewat Skakmat!"
    }
    ```