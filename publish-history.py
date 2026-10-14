"""Publish today's SQLite snapshot to GitHub using the local Git checkout.
Run while the detector is active. Requires authenticated git push configured.
No API token is embedded in the website or this script.
"""
import json
import os
import sqlite3
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent
DB = Path(os.getenv('DATABASE_PATH', str(ROOT / 'radio-history.sqlite3')))
OUT = ROOT / 'history' / 'today.json'

# Hide Git subprocess consoles on Windows.
GIT_PROCESS_FLAGS = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0

def run(*args):
    return subprocess.run(['git', *args], cwd=ROOT, check=True, capture_output=True, text=True,
                          creationflags=GIT_PROCESS_FLAGS, stdin=subprocess.DEVNULL)

def publish():
    day = datetime.now(ZoneInfo('Asia/Jakarta')).date().isoformat()
    stations = {name: [] for name in ('kis', 'jak', 'most')}
    if DB.exists():
        with sqlite3.connect(DB, timeout=15) as db:
            rows = db.execute('SELECT station, artist, title, detected_at_utc FROM song_history WHERE local_day=? ORDER BY id DESC LIMIT 1500', (day,))
            for station, artist, title, detected_at in rows:
                if station in stations:
                    stations[station].append({'artist': artist, 'title': title, 'detected_at_utc': detected_at})
    OUT.parent.mkdir(exist_ok=True)
    payload = {'date': day, 'updated_at_utc': datetime.now(timezone.utc).isoformat(), 'stations': stations}
    # Ignore updated_at when comparing snapshots: unchanged songs need no new commit.
    if OUT.exists():
        try:
            old = json.loads(OUT.read_text(encoding='utf-8'))
            if old.get('date') == day and old.get('stations') == stations:
                return
        except (OSError, ValueError):
            pass
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    # Only stage the public snapshot. Never commit the SQLite DB or credentials.
    run('add', '--', 'history/today.json')
    changed = subprocess.run(['git', 'diff', '--cached', '--quiet', '--', 'history/today.json'],
                             cwd=ROOT, creationflags=GIT_PROCESS_FLAGS,
                             stdin=subprocess.DEVNULL)
    if changed.returncode == 0:
        return
    if changed.returncode != 1:
        raise RuntimeError('Cannot check staged snapshot')
    run('commit', '-m', f'Update radio history {day}', '--', 'history/today.json')
    run('push')

if __name__ == '__main__':
    publish()
