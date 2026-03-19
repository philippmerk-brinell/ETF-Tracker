const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname);
const INTERVAL_MS = 5 * 60 * 1000; // alle 5 Minuten prüfen

function run(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function checkForUpdates() {
  try {
    run('git fetch origin');

    const behind = parseInt(run('git rev-list HEAD..origin/HEAD --count'), 10);
    if (behind === 0) return;

    console.log(`[Updater] ${behind} neuer Commit(s) gefunden – Update wird durchgeführt...`);

    const changed = run('git diff HEAD origin/HEAD --name-only').split('\n').filter(Boolean);

    run('git pull');

    if (changed.some(f => f.startsWith('backend/package'))) {
      console.log('[Updater] Backend-Abhängigkeiten werden aktualisiert...');
      run('npm install --prefix backend');
    }

    if (changed.some(f => f.startsWith('frontend/'))) {
      console.log('[Updater] Frontend wird gebaut...');
      run('npm run build --prefix frontend');
    }

    run('pm2 reload etf-tracker');
    console.log('[Updater] Update abgeschlossen!');
  } catch (err) {
    console.error('[Updater] Fehler:', err.message);
  }
}

checkForUpdates();
setInterval(checkForUpdates, INTERVAL_MS);
