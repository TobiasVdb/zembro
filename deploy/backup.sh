#!/usr/bin/env bash
set -euo pipefail
# Online SQLite backup includes committed WAL data; never simply copy a live .db.
install -d -m 0700 /var/lib/zembro/backups
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="/var/lib/zembro/backups/app-${stamp}.db"
sqlite3 /var/lib/zembro/data/app.db ".backup '${backup}'"
sqlite3 "$backup" 'PRAGMA integrity_check;'
find /var/lib/zembro/backups -maxdepth 1 -type f -name 'app-*.db' -mtime +14 -delete
