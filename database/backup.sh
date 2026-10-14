#!/bin/bash
# Backup harian data.json ReviewKita. Simpan 30 backup terakhir.
# Jalankan dari cron cPanel: lihat CPANEL_SETUP.md
set -e

APP_DIR="$HOME/repositories/reviewkita"
BACKUP_DIR="$HOME/backups/reviewkita"
KEEP=30

mkdir -p "$BACKUP_DIR"
STAMP=$(date +%F_%H%M)
cp "$APP_DIR/database/data.json" "$BACKUP_DIR/data-$STAMP.json"

# Hapus backup lama, sisakan $KEEP terbaru
ls -1t "$BACKUP_DIR"/data-*.json 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f

echo "$(date '+%F %T') backup ok: data-$STAMP.json"
