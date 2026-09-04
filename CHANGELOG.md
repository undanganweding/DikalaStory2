# Changelog — DikalaStories (AI Cinematic Production Studio)

Semua perubahan, pembaruan versi, dan riwayat commit penting dari aplikasi **DikalaStories** dicatat secara sistematis di dalam dokumen ini.

---

## [v1.4.0] - 2026-09-02 — Vercel Serverless & Git Sync Optimization
### Added
- **System Version History & Release Notes**: Integrasi modal & visualizer riwayat versi otomatis di dalam aplikasi.
- **Vercel Ephemeral Storage Fallback**: Penanganan storage otomatis ke `/tmp/data/` ketika berjalan di lingkungan Vercel serverless tanpa Firestore.
- **Safe JSON Exception Handling**: Penanganan respon non-JSON di frontend untuk mencegah crash `Unexpected token 'A'`.

### Fixed
- **Express Serverless Route Matching**: Perbaikan penanganan rute Express `server/app.ts` agar membedakan rute API `/api/*` dan rute statis UI.
- **Google Drive Import/Export**: Perbaikan kompatibilitas unduh dan impor berkas proyek antar-sesi.

---

## [v1.3.0] - 2026-09-01 — Stop & Resume Engine & ARMO Failover
### Added
- **Granular Pause/Resume Controller**: Kemampuan untuk menghentikan (*stop*) eksekusi pipeline sinematik di tengah jalan dan melanjutkan (*resume*) tanpa kehilangan progres.
- **Project Export & Import Multi-Format**: Ekspor/impor berkas proyek sinematik lengkap (.json & Google Drive sync).
- **Multi-API Key & Multi-Project Router (ARMO)**: Sistem mitigasi kuota cerdas (*Adaptive Rate-limit Mitigation & Optimization*) dengan *auto-cooldown* saat terkena limit HTTP 429.

---

## [v1.2.0] - 2026-08-30 — Full Cinematic Pipeline (Phase 1 to 8)
### Added
- **Phase 1-8 Production Pipeline**: Dari *Story Architecture*, *Scene Breakdown*, *Cinematic Shot Generation*, *Audio & Lighting Cues*, hingga *Asset Graph*.
- **Google Drive Backup Sync**: Integrasi pencadangan langsung ke Google Drive melalui OAuth2 integration.

---

## [v1.1.0] - 2026-08-28 — Initial Foundation
### Added
- **Inisialisasi DikalaStories**: Struktur UI Studio Sinematik dengan Tailwind CSS & React TypeScript.
