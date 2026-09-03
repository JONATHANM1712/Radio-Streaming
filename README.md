# MOST 105.8 + KIS 95.1 Automatic Song Detector v2

This version fixes the main KIS limitation by actually capturing the radio
tab's audio and sending a short sample to a local recognizer.

## Architecture

MOST/KIS HTML
    -> Chrome tab audio
    -> this extension (tabCapture + offscreen document)
    -> 12-second WebM/Opus sample
    -> local FastAPI server
    -> FFmpeg converts sample to WAV
    -> ShazamIO recognizes the song
    -> extension receives Artist + Title
    -> the matching radio page updates directly
    -> repeat after 60 seconds

## Cost

There is no AudD or ACRCloud subscription in this build.

ShazamIO is an unofficial, reverse-engineered Shazam client. It is not an
official Apple/Shazam API and its upstream service can change or stop working.

## 1. Requirements

- Google Chrome 116 or newer is recommended.
- Python 3.10+.
- FFmpeg installed and available from Windows PATH.
- Internet access.
- KIS/MOST radio page open in Chrome.

## 2. Install Python packages

Double-click:

    install-backend.bat

Or run:

    python -m pip install -r requirements.txt

## 3. Install FFmpeg

Install FFmpeg for Windows and make sure this command works in PowerShell:

    ffmpeg -version

This project does not bundle FFmpeg.

## 4. Start the local recognizer

Double-click:

    run-backend.bat

Leave that terminal open.

You can verify the server in a browser:

    http://127.0.0.1:8765/

It should return JSON saying the service is running.

## 5. Load the extension

1. Open `chrome://extensions`.
2. Turn Developer mode ON.
3. Click Load unpacked.
4. Select this entire `radio-song-detector-v2` folder.
5. Open the extension's Details page.
6. Enable **Allow access to file URLs**.

This permission is required because your MOST/KIS dashboards are opened from
`D:\...` as local `file://` pages.

## 6. Run KIS

1. Open `kis-streaming.html`.
2. Press Play on KIS.
3. Click the extension icon.
4. Press **Start Automatic Detection**.
5. The extension captures about 12 seconds.
6. The local recognizer identifies the song.
7. Artist + Title appear directly in the pink KIS dashboard.
8. Another recognition starts about 60 seconds later.

## 7. Run MOST

The same procedure works for MOST.

MOST may already expose station metadata, so `most-streaming.js` keeps a
best-effort metadata reader. The audio recognizer can also be used as a
fallback/check.

## Important Chrome behavior

Capturing a tab normally removes that tab's audio from standard playback.
The offscreen document reconnects the captured stream to the computer's audio
output so you should continue hearing the station.

## If KIS stays on "Backend offline"

Check:

1. `run-backend.bat` is still open.
2. `http://127.0.0.1:8765/` opens.
3. FFmpeg works with `ffmpeg -version`.
4. You reloaded the extension after replacing old files.
5. **Allow access to file URLs** is enabled.
6. Play the KIS stream before pressing Start Automatic Detection.

## If it says "No match"

Radio speech, jingles, advertisements, very short intros/outros, or overlapping
DJ voices can fail recognition. Wait for a clean section of the song and let
the next 60-second cycle try again.

## Stop

Open the extension popup and press **Stop** before switching to a different
radio tab.

## Notes

This project does not read the separately installed Librezam extension popup.
Chrome isolates extensions from one another. Instead, this version performs
its own audio capture and uses the free ShazamIO Python library locally.
