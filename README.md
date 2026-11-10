# English Writing Trainer (v2)

Aplikasi latihan menulis bahasa Inggris — murni HTML/CSS/JS tanpa build step. Data lokal di browser, dengan sinkron cloud opsional via akun Google (Firebase).

## Cara menjalankan
- **Terkamus:** double-click `index.html`, atau
- Server lokal (opsional):

```
cd D:\English-Writing-Trainer
python -m http.server 8000
# buka http://localhost:8000
```

## Akses dari HP (hosting online)
Aplikasi ini **sudah live di GitHub Pages**, di-deploy otomatis oleh `.github/workflows/deploy.yml` setiap ada push ke `main`:

> **https://mickyv18.github.io/Learning-Writing-English/**

Di HP (Chrome Android / Safari iOS): menu browser → **Add to Home screen** — aplikasi muncul sebagai app dengan ikon sendiri berkat `manifest.json`. Data tetap di `localStorage` tiap perangkat; pindahkan pakai Export/Import di Pengaturan.


## Struktur
```
English-Writing-Trainer/
├── index.html            halaman utama (semua 10 halaman)
├── css/styles.css        tema gelap & terang, responsif, siap cetak
├── js/app.js             seluruh logika: storage, v1→v2 migration, sinkron cloud, UI
└── js/firebase-config.js konfigurasi Firebase (opsional — isi sendiri untuk fitur Akun)
```

## Halaman
| Halaman | Isi |
|---|---|
| **Dashboard** | Sapaan, 5 statistik, kalender streak 5 minggu, checklist harian (4 metode) |
| **Journaling** | 12 prompt acak, autosave draft, target kata terukur, riwayat + pencarian |
| **Copywork** | 8 teks bawaan (opini/naratif/ekspositori/persuasif/dsl.) + teks sendiri; 2 mode: **Copy** (teks terlihat) dan **Recall** (teks mengabur, ketik dari ingatan); diff per kata berbasis LCS |
| **Reading** | Tempat mencatat sumber bacaan, struktur kalimat & kolokasi |
| **Cycle** | Draft → Correct → Rewrite, dengan perbandingan otomatis + checklist 4 langkah. Draft step-1 bisa langsung dikirim Checker |
| **Koreksi** (baru) | Checker grammar dengan 2 mesin: **offline ±50 aturan ESL** (agreement, article, preposisi, tense, double negative, spelling, tanda baca, kapitalisasi) + **online LanguageTool** ( gratis, tanpa API key). Saran per-saran bisa diterapkan, atau sekaligus dengan cascade otomatis; hasil bisa dikirim ke Cycle langkah 2 |
| **Error Log** | Kategori kesalahan, statistik pola (bar), pencarian, export JSON |
| **Rencana** | Jadwal latihan mingguan + prinsip agar progres nyata |
| **Akun** (baru) | Login Google + sinkronisasi cloud (Firebase Auth & Firestore) — journal, cycle, error log, reading, streak, dan pengaturan mengikuti akun di semua perangkat |
| **Pengaturan** | Nama & target kata, tema gelap/terang, export/import backup JSON, reset data |

## Data
- Semua data disimpan di `localStorage` (prefix `ewt2_`) — tanpa login akun, tidak ada data yang dikirim ke mana pun.
- Data aplikasi versi 1 (`ewt_v1_*`) dimigrasikan otomatis saat pertama dibuka.
- Backup: **Pengaturan → Export semua data**; restore: **Import backup**.
- Draft journal/cycle/koreksi tetap tersimpan lokal per perangkat (tidak disinkron).

## Akun & sinkronisasi cloud (opsional, Firebase)
Fitur login Google + sinkron cloud memakai Firebase (Google) dengan quota gratis (Spark) yang lebih dari cukup untuk penggunaan pribadi. **Data tersinkron hanya ke project Firebase-mu sendiri** — tidak ada pihak ketiga.

### Siapkan Firebase (±10 menit)
1. Buka [console.firebase.google.com](https://console.firebase.google.com) → **Add project** (nama bebas; Analytics boleh dimatikan).
2. **Build → Authentication → Get started** → aktifkan provider **Google** → Save.
3. Tab **Settings → Authorized domains**: tambahkan `mickyv18.github.io` (agar GitHub Pages boleh login). `localhost` sudah otomatis di-whitelist.
4. **Build → Firestore Database → Create database** (pilih region terdekat, mode *production*), lalu di tab **Rules** ganti isinya:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```
5. **Project settings ⚙ → General → Your apps → Web app (`</>`)** → daftarkan nama → salin nilai config ke `js/firebase-config.js`:
   ```js
   var FIREBASE_CONFIG = { apiKey: "AIza…", authDomain: "…", projectId: "…", … };
   ```
6. Push kembali ke GitHub (atau refresh halaman bila jalan lokal) → masuk lewat halaman **Akun**.

Catatan: `apiKey` Firebase adalah pengenal project, bukan kunci rahasia — aman untuk frontend. Keamanannya justru di Firestore Rules (langkah 4): tiap user hanya boleh membaca/menulis `users/{uid}` miliknya sendiri.

### Layout Firestore & perilaku sinkron
```
users/{uid}                    doc: meta (settings, acts, copyBest, promptIdx)
users/{uid}/lists/{key}        readings | cycles | errors
users/{uid}/journal/{entryId}  satu doc per entri (diff by id — hemat kuota tulis)
```
- **Login pertama**: data lokal di perangkat digabung (union by id) ke data cloud. Login dengan akun baru di perangkat yang sama: data cloud menang, penanda streak/rekaman digabung, preferensi mengikuti akun.
- **Selama menulis**: tiap `save()` langsung write-through ke Firestore; kalau offline, perubahan diantrekan (`syncDirty`) dan dikirim otomatis saat kembali online atau lewat tombol **Sinkron sekarang**.
- **Logout**: salinan lokal dipertahankan; data cloud tidak disentuh.

## Kualitas teknis
- Tombol navigasi, ringkasan & halaman dengan `aria-current`, `aria-live`, dan label aksesibel
- Fokus keyboard terlihat (`:focus-visible`), `Escape` menutup modal
- Konfirmasi modal sebelum setiap tindakan destruktif
- Autosave draf journaling & cycle saat mengetik
- Responsif: sidebar jadi topbar di layar sempit
- Menghormati `prefers-reduced-motion` dan memiliki style cetak
- Diff copywork pakai algoritma LCS, jadi kata yang tertukar tetap terdeteksi
