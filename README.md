# URL-Shortener (DLBSEPPSD01_D)

Eine Webanwendung zum Kürzen von URLs mit Nutzerkonto, Ablaufdatum, QR-Code und Klickzähler.

## Was das Programm macht
- Nutzerregistrierung und Login (Supabase Auth)
- Kurzlinks erstellen mit optionalem Label und Ablaufzeit
- Links anzeigen, filtern (aktiv/abgelaufen) und suchen
- QR-Code für den gewählten Link anzeigen und teilen
- Redirect-Endpunkt mit Klickzähler

## Starten (Frontend + Backend)

### Backend (Fastify)
```bash
cd backend
npm install
```

Lege eine Datei `backend/.env` an:
```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
PORT=3000
```

Start:
```bash
npm run dev
```

Der Server läuft standardmässig auf `http://localhost:3000`.

### Frontend (React + Vite)
```bash
cd url-shortener
npm install
```

Lege eine Datei `url-shortener/.env.local` an:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Optional (nur falls du die Defaults überschreiben willst):
```
VITE_API_BASE_URL=http://localhost:3000
VITE_SHORT_BASE_URL=http://localhost:3000/r
```

Start:
```bash
npm run dev
```

Frontend: `http://localhost:5173`

## Tests

### Frontend
```bash
cd url-shortener
npm run test
```

Coverage:
```bash
npm run test:coverage
```

### Backend
```bash
cd backend
npm run test
```

Coverage:
```bash
npm run test:coverage
```
