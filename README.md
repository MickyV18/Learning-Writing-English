# English Writing Trainer (v2)

Aplikasi latihan menulis bahasa Inggris — murni HTML/CSS/JS, tanpa dependensi, semua data lokal di browser.

## Cara menjalankan
- **Terkamus:** double-click `index.html`, atau
- Server lokal (opsional):

```
cd D:\English-Writing-Trainer
python -m http.server 8000
# buka http://localhost:8000
```

## Akses dari HP (hosting online)
Folder ini bisa diunggah apa adanya ke hosting statis gratis:
- **Netlify Drop** (paling cepat): buka `app.netlify.com/drop` → drag seluruh folder ini → dapat URL langsung.
- **GitHub Pages**: push folder ini ke repo → Settings → Pages → branch `main`, folder `/root`.
- **Cloudflare Pages**: buat project "Direct Upload" → upload folder ini.

Setelah punya URL, di HP (Chrome Android / Safari iOS): menu → **Add to Home screen** — aplikasi muncul sebagai app dengan ikon sendiri berkat `manifest.json`. Data tetap di `localStorage` tiap perangkat; pindahkan pakai Export/Import di Pengaturan.


## Struktur
```
English-Writing-Trainer/
├── index.html      halaman utama (semua 8 halaman)
├── css/styles.css  tema gelap & terang, responsif, siap cetak
└── js/app.js       seluruh logika: storage, v1→v2 migration, UI
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
| **Pengaturan** | Nama & target kata, tema gelap/terang, export/import backup JSON, reset data |

## Data
- Semua data disimpan di `localStorage` (prefix `ewt2_`) — tidak ada data yang dikirim ke mana pun.
- Data aplikasi versi 1 (`ewt_v1_*`) dimigrasikan otomatis saat pertama dibuka.
- Backup: **Pengaturan → Export semua data**; restore: **Import backup**.

## Kualitas teknis
- Tombol navigasi, ringkasan & halaman dengan `aria-current`, `aria-live`, dan label aksesibel
- Fokus keyboard terlihat (`:focus-visible`), `Escape` menutup modal
- Konfirmasi modal sebelum setiap tindakan destruktif
- Autosave draf journaling & cycle saat mengetik
- Responsif: sidebar jadi topbar di layar sempit
- Menghormati `prefers-reduced-motion` dan memiliki style cetak
- Diff copywork pakai algoritma LCS, jadi kata yang tertukar tetap terdeteksi
