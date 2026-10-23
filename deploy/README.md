# DigitalOcean droplet deployment preparation

This project runs as one Node process behind Nginx. Deploy separately from CanvasHabitats; do not point it at that project's database or service.

## Provisioning

Use Ubuntu 24.04 LTS, a supported Node 22 LTS runtime (22.23.4 or later in the 22.x release line), npm, Nginx, SQLite CLI, Certbot and its Nginx plugin. A 2 GB RAM droplet is a reasonable starting point. Allow SSH, HTTP and HTTPS in the firewall. Create a dedicated `zembro` service user, `/opt/zembro` for releases, `/var/lib/zembro/data` for SQLite, `/var/lib/zembro/backups` for backups, and `/etc/zembro` for environment configuration. Give the service user ownership of `/var/lib/zembro` and read access to the code.

## Build and configure

Copy source, lockfile and `public/assets` to a new release directory. Run `npm ci` and `npm run build` on Linux so the native SQLite dependency matches the server OS. Link the release directory as `/opt/zembro/current`. Keep the database outside all releases.

Create `/etc/zembro/zembro.env` (mode 0600, owned by root) with:

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=8788
DATA_DIR=/var/lib/zembro/data
EDITOR_PASSWORD=<unique password with at least 12 characters>
PUBLIC_ORIGIN=https://your-domain.example
BASE_PATH=/
```

First startup seeds the fresh database from bundled web assets. Further releases preserve edits. Run the service with the `deploy/zembro.service` template, then enable/start it with systemd. It binds to loopback only.

Replace the placeholder domain in `deploy/nginx.conf`, install it as a dedicated Nginx site, run `nginx -t`, and reload Nginx. Point DNS at the droplet and obtain HTTPS using `certbot --nginx -d your-domain.example`. CMS cookies require HTTPS in production. Verify Certbot renewal. Do not configure a production public origin with plain HTTP.

## Subpath hosting

For `/zembro/`, set `BASE_PATH=/zembro/` both when building (`BASE_PATH=/zembro/ npm run build`) and in the runtime environment. Change Nginx's location to `/zembro/`, keeping `proxy_pass http://127.0.0.1:8788;` without a trailing slash so the prefix reaches Express. Add an exact `/zembro` redirect to `/zembro/`. `PUBLIC_ORIGIN` remains only the origin, without a path. Vite's local development proxy is configured for root hosting; subpath verification should use the production server.

## Backups and rollout checks

Install `backup.sh` as `/usr/local/sbin/zembro-backup`, executable by root, and schedule daily using cron (`0 3 * * * /usr/local/sbin/zembro-backup`). It uses SQLite's online backup API to include committed WAL transactions and retains 14 days. Copy encrypted backups off the droplet using your normal backup system.

Before release: make a backup, run checks/build, then restart the service. Confirm `/api/health`, public page, all four languages, `/admin` login, one reversible edit, media playback/ranges, and reload persistence over HTTPS. Check service logs without logging credentials or request bodies. Validate any sibling routes when using an existing shared host. Roll back by relinking the previous release and restarting; keep the same data directory. Before restoring a database, stop the service and move the current database and its WAL/SHM files to a retained recovery directory. Restore a checked backup, restore ownership and restart.

No server provisioning, DNS changes or deployment are performed by the local implementation.
