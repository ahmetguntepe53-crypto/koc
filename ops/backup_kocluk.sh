#!/bin/bash
# Koçluk — günlük otomatik yedek (root crontab, her gece 03:20; yedisekiz yedeği 03:00'te çalışır).
# /opt/backup_db.sh (yedisekiz) ile AYNI düzen ve AYNI sırlar:
#  1) Veritabanı: pg_dump çıktısı diske hiç düz metin yazılmadan gpg/AES256 ile şifrelenir, /opt/backups/kocluk-db'ye
#     alınır (14 gün saklanır) ve FTPS ile ayrı sağlayıcıya (db_backups/, "kocluk_" önekiyle) kopyalanır (30 gün).
#  2) Kanıt fotoğrafları (/opt/kocluk/uploads): şifreli tar olarak yerelde tutulur; uzak kopyaya yalnızca toplam
#     boyut 200 MB'ın altındayken gönderilir — paylaşımlı FTP'nin kotası dolup çalışan DB yedeğini bozmasın diye.
# Sırlar bu dosyada DURMUYOR: /root/.yedisekiz_backup_credentials.env (BACKUP_ENCRYPTION_KEY, FTP_HOST) ve
# /root/.backup_netrc (FTP kimlik bilgileri). Veritabanı adresi /opt/kocluk/.env'den okunur.
# Geri yükleme: gpg --batch --passphrase-file <(printf '%s' "$BACKUP_ENCRYPTION_KEY") -d kocluk_X.dump.gpg > x.dump
#               pg_restore --clean --no-owner -d "$DATABASE_URL" x.dump
# Uzak adım best-effort: ağ sorunu olursa o geceki YEREL yedek yine tam alınmış olur.
set -e -o pipefail
source /root/.yedisekiz_backup_credentials.env
DB_URL="$(set -a; . /opt/kocluk/.env; set +a; printf '%s' "${DATABASE_URL%%\?*}")"
BACKUP_DIR="/opt/backups/kocluk-db"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
TS=$(date +%Y%m%d_%H%M%S)
DB_FILE="kocluk_$TS.dump.gpg"
UP_FILE="kocluk-uploads_$TS.tar.gpg"

pg_dump "$DB_URL" -F c \
  | gpg --batch --yes --passphrase-file <(printf '%s' "$BACKUP_ENCRYPTION_KEY") --symmetric --cipher-algo AES256 -o "$BACKUP_DIR/$DB_FILE"
chmod 600 "$BACKUP_DIR/$DB_FILE"

UPLOAD_MB=0
if [ -d /opt/kocluk/uploads ]; then
  tar -C /opt/kocluk -cf - uploads \
    | gpg --batch --yes --passphrase-file <(printf '%s' "$BACKUP_ENCRYPTION_KEY") --symmetric --cipher-algo AES256 -o "$BACKUP_DIR/$UP_FILE"
  chmod 600 "$BACKUP_DIR/$UP_FILE"
  UPLOAD_MB=$(( $(stat -c %s "$BACKUP_DIR/$UP_FILE") / 1048576 ))
fi
find "$BACKUP_DIR" -name "kocluk_*.dump.gpg" -mtime +14 -delete
find "$BACKUP_DIR" -name "kocluk-uploads_*.tar.gpg" -mtime +14 -delete

put() {
  curl -sf --ftp-ssl -k --netrc-file /root/.backup_netrc -T "$BACKUP_DIR/$1" "ftp://$FTP_HOST/db_backups/$1"
}
if put "$DB_FILE"; then
  echo "[$(date)] koçluk: uzak DB yedeği yüklendi: $DB_FILE"
  if [ -f "$BACKUP_DIR/$UP_FILE" ] && [ "$UPLOAD_MB" -lt 200 ]; then
    put "$UP_FILE" && echo "[$(date)] koçluk: uzak fotoğraf yedeği yüklendi ($UPLOAD_MB MB)" || echo "[$(date)] UYARI: fotoğraf yedeği yüklenemedi" >&2
  elif [ -f "$BACKUP_DIR/$UP_FILE" ]; then
    echo "[$(date)] BİLGİ: fotoğraf yedeği $UPLOAD_MB MB — uzak kopya atlandı (kota koruması), yerelde duruyor" >&2
  fi
  CUTOFF=$(date -d '30 days ago' +%Y%m%d)
  curl -s --ftp-ssl -k --netrc-file /root/.backup_netrc "ftp://$FTP_HOST/db_backups/" | awk '{print $NF}' | grep -E '^kocluk(-uploads)?_' | while read -r f; do
    FDATE=$(echo "$f" | sed -E 's/^kocluk(-uploads)?_([0-9]{8})_.*/\2/')
    if [[ "$FDATE" =~ ^[0-9]{8}$ ]] && [ "$FDATE" -lt "$CUTOFF" ]; then
      curl -s --ftp-ssl -k --netrc-file /root/.backup_netrc -Q "DELE db_backups/$f" "ftp://$FTP_HOST/" >/dev/null || true
    fi
  done
else
  echo "[$(date)] UYARI: koçluk uzak yedeği yüklenemedi (yerel yedek başarılıydı): $DB_FILE" >&2
fi
