# Chata pod Havranom — full website (with backend)

```
chata-full/
├── server/                  Node.js backend — run this
│   ├── server.js
│   ├── package.json
│   ├── hash-password.js     run this to set/change the admin password
│   ├── .env.example         copy to .env and fill in
│   └── data.json            created automatically on first run
└── public/                  the website itself, served by the backend
    ├── index.html
    ├── css/style.css
    ├── js/app.js
    └── images/
        └── uploads/          photos uploaded from the admin panel land here
```

## Running it the first time

You need [Node.js](https://nodejs.org) installed (any recent version).

```bash
cd server
npm install
cp .env.example .env
node hash-password.js "choose-a-password-here"
```

That last command prints a line like `ADMIN_PASSWORD_HASH=$2a$10$...`.
Paste it into `.env`, replacing the empty `ADMIN_PASSWORD_HASH=` line.

Then start the server:

```bash
npm start
```

Open **http://localhost:3000** in your browser — not the `index.html` file
directly. The backend serves the site, so it needs to actually be running.

## Changing the admin password (any time later)

```bash
cd server
node hash-password.js "your-new-password"
```

Copy the printed hash into `.env` as `ADMIN_PASSWORD_HASH`, restart the
server (`npm start`). The real password is never written to disk or sent
to the browser — only this one-way hash is stored, and it can't be
reversed back into the password.

## Setting up real email delivery

In `server/.env`, fill in the `SMTP_*` fields with any email provider's
SMTP details — Gmail (using an "app password", not your normal password),
or a transactional provider like Resend or Brevo (both have free tiers
and are simpler to set up correctly than Gmail). Restart the server after
editing `.env`. Until this is filled in, reservation and contact
submissions still work and still hold calendar dates — the email content
just gets printed to the server's console/log instead of actually sent.

## Uploading photos

Admin panel → Galéria → drag photos in, or click to choose files. They're
resized in the browser, then uploaded as real files to
`public/images/uploads/` on the server — no size-limit workarounds needed,
since they're just files on disk now rather than crammed into a database
or a browser's local storage.

## Hosting this for real

This now needs an actual server process running continuously (unlike a
plain static site), so a static host like plain Netlify/GitHub Pages
won't work on its own. Reasonable options, roughly easiest to most
capable:

- **Render.com** or **Railway.app** — both have simple "point at a Node
  project, we run it" free/cheap tiers, and both support attaching a
  small persistent disk (needed so `data.json` and uploaded photos
  survive restarts — check "persistent disk" or "volume" in their
  settings).
- **A small VPS** (Hetzner, DigitalOcean) if you want full control —
  install Node, use `pm2` to keep the process running, and put a reverse
  proxy (Caddy or Nginx) in front for free automatic HTTPS.

Whichever you choose:

1. Set real values in `.env` on the server (never commit `.env` to a
   public repository).
2. In `server.js`, uncomment `secure: true` in the session cookie config
   once the site is served over HTTPS (it's commented out for local
   testing where there's no HTTPS).
3. Point your domain's DNS at the host, following their instructions.
4. Test the full guest journey — booking, newsletter, contact — from a
   phone on a different network before sharing the link.
