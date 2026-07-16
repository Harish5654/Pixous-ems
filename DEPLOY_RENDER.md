# Deploying Pixous HR/EMS to Render (free tier)

This guide takes the project live on a **free** Render account. The repo already
contains everything Render needs:

- [`render.yaml`](render.yaml) — the Blueprint (backend + web frontend)
- [`backend/Dockerfile`](backend/Dockerfile) — Spring Boot API image
- [`analytics-service/Dockerfile`](analytics-service/Dockerfile) — Python service (paid tier only)

## Architecture on the free tier

```
[ Browser ]
     │  https
     ▼
[ pixous-ems-web ]  ── Render Static Site (free) ── React/Vite SPA
     │  /api, /ws  →  VITE_API_URL
     ▼
[ pixous-ems-backend ] ── Render Web Service, Docker (free, 512 MB) ── Spring Boot
     │  JDBC
     ▼
[ MySQL ] ── FREE EXTERNAL provider (Aiven / Clever Cloud) — Render has no managed MySQL
```

Two things are **not** on the free tier:
- **MySQL** — Render offers managed *PostgreSQL* only, so the database lives on a
  free external MySQL provider (below).
- **Analytics service** — dlib + PyTorch + Tesseract need more than 512 MB RAM;
  deploy it later on a paid instance if you need face-recognition attendance.

Redis and Kafka are **not required** — the app boots and runs without them
(Kafka auto-config is disabled; Redis is optional).

> ⚠️ **Free web services sleep after 15 minutes of inactivity** and take
> ~50 seconds to cold-start on the next request. That's normal for free tier.

---

## Step 1 — Create a free MySQL database

Pick one provider and note the connection details.

### Option A — Aiven (free MySQL plan)
1. Sign up at <https://aiven.io> → **Create service** → **MySQL** → **Free plan**.
2. Choose a region close to your users (e.g. an Asia region).
3. When it's running, open the service → **Connection information** and copy:
   `Host`, `Port`, `Database name`, `User`, `Password`.

### Option B — Clever Cloud (free MySQL add-on)
1. Sign up at <https://clever-cloud.com> → **Create an add-on** → **MySQL** →
   the **DEV (free)** plan.
2. Copy `host`, `port`, `database`, `user`, `password` from the add-on dashboard.

Keep these five values handy — you'll paste them into Render in Step 3.

> The backend URL uses `createDatabaseIfNotExist=true`, so it will create the
> schema on first boot if your provider allows it. Flyway then builds all tables
> and seeds demo data automatically.

---

## Step 2 — Deploy the Blueprint

1. Go to the **[Render Dashboard](https://dashboard.render.com)** → **New +** →
   **Blueprint**.
2. Connect your GitHub account and select the **`Harish5654/Pixous-ems`** repo.
3. Render reads [`render.yaml`](render.yaml) and shows two services to create:
   `pixous-ems-backend` and `pixous-ems-web`. Click **Apply**.

Render starts building. The backend build compiles the jar inside Docker (a few
minutes the first time); the web build runs `npm ci && npm run build`.

---

## Step 3 — Set the database environment variables

The backend needs your MySQL details. In Render → **pixous-ems-backend** →
**Environment**, set:

| Key           | Value                                  |
|---------------|----------------------------------------|
| `DB_URL`      | full JDBC URL (see below)              |
| `DB_USER`     | your MySQL user                        |
| `DB_PASSWORD` | your MySQL password                    |

`DB_POOL_SIZE` (4) and `DB_POOL_MIN_IDLE` (1) are already set in the Blueprint to
stay under Clever Cloud DEV's 5-connection cap. `APP_JWT_SECRET` is generated
automatically.

**Building `DB_URL`** — use your MySQL host and database name (Clever Cloud's DB
name equals the random user string). Do **not** include `createDatabaseIfNotExist`
— the database already exists and the DEV user cannot create databases:

```
jdbc:mysql://<HOST>:3306/<DB_NAME>?useSSL=false&serverTimezone=Asia/Kolkata&allowPublicKeyRetrieval=true
```

Example (Clever Cloud):
```
jdbc:mysql://bxxxxxxxxxxxx-mysql.services.clever-cloud.com:3306/bxxxxxxxxxxxx?useSSL=false&serverTimezone=Asia/Kolkata&allowPublicKeyRetrieval=true
```

Save — the backend redeploys and runs the Flyway migrations against your database.

> If migrations fail with a **storage/size** error, the DEV plan's 10 MB cap was
> exceeded — move to a larger free MySQL (e.g. Aiven, ~5 GB) and update `DB_URL`.

---

## Step 4 — Confirm the URLs line up

The Blueprint assumes these default service URLs:

- Backend: `https://pixous-ems-backend.onrender.com`
- Web:     `https://pixous-ems-web.onrender.com`

If Render appended a suffix (because a name was taken), update the two cross-links:

- **pixous-ems-backend** → env var `APP_CORS_ALLOWED_ORIGINS` = your **web** URL
- **pixous-ems-web** → env var `VITE_API_URL` = your **backend** URL
  *(changing this requires a redeploy of the web service, since Vite bakes it in
  at build time — click **Manual Deploy → Clear build cache & deploy**.)*

---

## Step 5 — Verify

1. **Backend health:** open `https://pixous-ems-backend.onrender.com/actuator/health`
   → should return `{"status":"UP"}`.
2. **Frontend:** open `https://pixous-ems-web.onrender.com`.
3. **Log in** with a seeded demo account:

   | Username | Password    | Role          |
   |----------|-------------|---------------|
   | `admin`  | `Test1234@` | Administrator |
   | `arun`   | `Test1234@` | Employee      |

   Change the admin password after first login.

---

## Optional extras

### Redis (caching / rate-limit state)
Not required. To enable, create a free Redis at <https://upstash.com>, then add
`REDIS_HOST` and `REDIS_PORT` to the backend environment (uncomment them in
`render.yaml` or add via the dashboard).

### SMS (Twilio) and the AI chatbot
These are off/blank by default. To enable, set the relevant env vars on the
backend (`TWILIO_ENABLED=true` + `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN`), or
add the chatbot provider keys (`GROQ_API_KEY`, `GEMINI_API_KEY`, …) from the
in-app **Settings** page. **Use freshly rotated keys** — the originals that were
in the source have been removed and should be regenerated.

### Analytics / face-recognition service
Uncomment the `pixous-ems-analytics` block in [`render.yaml`](render.yaml) and
set its `plan` to `standard` (it will not fit the free 512 MB tier). Give it the
same `DB_*` variables as the backend.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Backend deploy fails at health check | Check `DB_*` values; view **Logs** for the JDBC/Flyway error. |
| Frontend loads but API calls fail (CORS) | Ensure backend `APP_CORS_ALLOWED_ORIGINS` exactly matches the web URL (no trailing slash). |
| API calls go to `localhost` | `VITE_API_URL` wasn't set at build time — set it and redeploy the web service with cleared cache. |
| First request very slow | Free service was asleep; it cold-starts in ~50 s. |
| `Access denied` / `Unknown database` | Verify the MySQL user/password and that the database name exists on your provider. |
