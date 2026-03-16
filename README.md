# ETF Tracker

ETF-Watchlist mit Charts und automatischen Benachrichtigungen per E-Mail und WhatsApp.

## Features

- ETFs per Ticker-Symbol suchen und zur Watchlist hinzufügen
- Interaktive Kurs-Charts (1W / 1M / 3M / 6M / 1J / 5J / Max)
- All-Time-High Anzeige im Chart und auf der ETF-Karte
- Automatische Alerts per **E-Mail** und **WhatsApp** wenn:
  - Ein ETF an einem Tag um X% fällt
  - Ein ETF in 7 Tagen um X% fällt
  - Ein ETF mehr als X% unter seinem ATH liegt
- Schwellenwerte global konfigurierbar über die UI

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Recharts
- **Backend**: Node.js + Express
- **Daten**: yahoo-finance2 (kostenlos, kein API-Key nötig)
- **Datenbank**: SQLite (better-sqlite3)
- **Scheduler**: node-cron
- **E-Mail**: nodemailer (SMTP)
- **WhatsApp**: whatsapp-web.js (QR-Code-Scan)

## Setup

### 1. Dependencies installieren

```bash
npm run install:all
```

### 2. Environment einrichten

```bash
cp .env.example .env
```

Die `.env`-Datei muss normalerweise nicht angepasst werden. E-Mail und WhatsApp werden über die Web-UI konfiguriert.

### 3. Backend starten

```bash
npm run dev:backend
```

Der Server läuft auf http://localhost:3001

### 4. Frontend starten (Development)

```bash
npm run dev:frontend
```

Das Frontend läuft auf http://localhost:5173

## WhatsApp verbinden

1. Backend starten
2. Im Browser → http://localhost:5173/settings
3. WhatsApp aktivieren und Empfänger-Nummer eintragen (ohne +, z.B. `4917612345678`)
4. **Speichern** klicken
5. QR-Code erscheint → WhatsApp auf dem Handy öffnen → Verknüpfte Geräte → Gerät verknüpfen → QR scannen
6. Nach dem Scan bleibt die Verbindung gespeichert (kein erneuter Scan nötig)

> **Hinweis**: whatsapp-web.js ist inoffiziell und verstößt gegen WhatsApp AGB. Nutzung auf eigenes Risiko.

## E-Mail einrichten (Gmail Beispiel)

1. Gmail → Google-Konto → Sicherheit → 2-Faktor-Authentifizierung aktivieren
2. App-Passwort erstellen (unter Sicherheit → App-Passwörter)
3. In der UI eintragen:
   - SMTP Host: `smtp.gmail.com`
   - SMTP Port: `587`
   - Benutzername: `deine.email@gmail.com`
   - Passwort: das App-Passwort (nicht dein normales Passwort!)
   - Empfänger: gewünschte E-Mail-Adresse

## Alert-Scheduler

Der Scheduler läuft automatisch alle 15 Minuten während der Handelszeiten (Mo–Fr 8–22 Uhr CET) und prüft alle ETFs in der Watchlist. Alerts werden mit Cooldown-Zeiten versehen um Spam zu vermeiden:

- Tagesfall: 6 Stunden Cooldown
- Wochenfall: 24 Stunden Cooldown
- ATH-Abstand: 12 Stunden Cooldown

## Daten

Alle Daten (SQLite-Datenbank, WhatsApp-Session) werden im `data/` Verzeichnis gespeichert (nicht in git).

## Produktion

```bash
npm run build:frontend
npm run start
```

Das Backend serviert dann automatisch das gebaute Frontend unter http://localhost:3001
