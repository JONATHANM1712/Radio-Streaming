# Daily radio history — GitHub Pages (WIB)

The public `history/today.json` file is displayed by `daily-history.js` on GitHub Pages. No Render, Oracle or remote Python server is needed to **display previously published** songs. The browser automatically hides yesterday's data at 00:00 Asia/Jakarta even if the old JSON is still cached or not yet replaced.

## Publish recognized songs

1. Keep this project in a **Git clone** (the downloaded ZIP alone cannot push). Ensure `git status` works, Git has your identity configured, and `git push` works without interactive prompts (Git Credential Manager is recommended).
2. Install dependencies using `install-backend.bat`, ensure FFmpeg is installed, and start `radiodetector.bat` in the Git clone.
3. `run-backend.bat` enables publishing: it calls `publish-history.py` when a different song is recognized, with a maximum publishing frequency of once per minute, committing **only** `history/today.json` and pushing to your configured Git remote. GitHub Pages can take additional time to update.
4. The detector still samples each station with its existing recognition interval while Windows is running. **When Windows sleeps, shuts down or loses internet, detection and publishing stop.** Already-published history remains visible.
5. At the next WIB day, the website shows an empty list immediately. The public JSON is replaced on the next successful publishing cycle; old versions may remain accessible in Git history.

## Notes

- The public history is NOT a guaranteed complete record. No detection can occur while the local detector is off.
- The history includes MOST as well as KIS and JAK, matching the existing backend. No extra cloud service is involved.
- GitHub's commit history retains old snapshots. This is a **daily display reset**, not permanent erasure of all historical data.
- GitHub Pages hosts static JSON and JavaScript only. Local `/kis/latest` and `/jak/latest` metadata still require the local backend; remote visitors will not get live Shazam metadata unless you separately change that architecture.
- If `git push` fails, check your Git authentication and branch status. The script prints publishing errors to the detector console.
- Unchanged songs do not trigger publishing. Different songs trigger an update, throttled to at most one successful push per 60 seconds; GitHub Pages propagation may take longer. Midnight reset also triggers a new-day snapshot.
