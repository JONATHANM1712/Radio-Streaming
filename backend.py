import asyncio
import shutil
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from shazamio import Shazam

# ============================================================
# CONFIGURATION
# ============================================================

STATIONS = {
    "kis": {
        "name": "KIS 95.1 FM",
        "stream_url": "https://wz.mari.co.id:1936/web_kisfm/kisfm/playlist.m3u8",
        "source": "KIS direct-stream ShazamIO",
    },
    "jak": {
        "name": "JAK 101 FM",
        "stream_url": "https://wz.mari.co.id:1936/noice_jakfm/jakfm/playlist.m3u8",
        "source": "JAK Noice direct-stream ShazamIO",
    },
}

SAMPLE_SECONDS = 12
RECOGNITION_INTERVAL_SECONDS = 60

# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="MOST, KIS & JAK Radio Metadata Service",
    version="0.4.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

shazam = Shazam()

# ============================================================
# STATE
# ============================================================

station_states = {
    key: {
        "running": False,
        "success": False,
        "station": cfg["name"],
        "artist": "",
        "title": "",
        "album": "",
        "pair": "",
        "trackKey": "",
        "source": cfg["source"],
        "recognizedAt": None,
        "lastAttempt": None,
        "message": "Waiting for first recognition...",
    }
    for key, cfg in STATIONS.items()
}

recognition_tasks = {}

# ============================================================
# ROOT
# ============================================================

@app.get("/")
async def root():
    return {
        "ok": True,
        "service": "MOST, KIS & JAK Radio Metadata Service",
        "version": "0.4.0",
        "detectors": {
            key: state["running"]
            for key, state in station_states.items()
        },
    }

# ============================================================
# FFMPEG
# ============================================================

def find_ffmpeg():
    exe = shutil.which("ffmpeg")
    if not exe:
        raise RuntimeError(
            "FFmpeg was not found in PATH. Install FFmpeg and reopen the terminal."
        )
    return exe


def capture_station_sample(stream_url: str, target: Path):
    ffmpeg = find_ffmpeg()

    command = [
        ffmpeg,
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        stream_url,
        "-t",
        str(SAMPLE_SECONDS),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "44100",
        "-acodec",
        "pcm_s16le",
        str(target),
    ]

    result = subprocess.run(
        command,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        timeout=SAMPLE_SECONDS + 25,
    )

    if result.returncode != 0:
        error_text = result.stderr.decode("utf-8", errors="replace")
        raise RuntimeError(f"FFmpeg could not capture stream: {error_text}")

# ============================================================
# SHAZAM HELPERS
# ============================================================

def get_album(track: dict) -> str:
    for section in track.get("sections") or []:
        for item in section.get("metadata") or []:
            label = (item.get("title") or "").strip().lower()
            if label == "album":
                return (item.get("text") or "").strip()
    return ""


async def recognize_station_once(key: str):
    cfg = STATIONS[key]
    state = station_states[key]
    state["lastAttempt"] = datetime.now().isoformat()

    print()
    print("=" * 60)
    print(cfg["name"])
    print("Capturing direct radio stream...")
    print("=" * 60)

    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp = Path(temp_dir)
            wav_file = temp / f"{key}-sample.wav"

            await asyncio.to_thread(
                capture_station_sample,
                cfg["stream_url"],
                wav_file,
            )

            print(f"Captured {SAMPLE_SECONDS} seconds.")
            print("Recognizing with ShazamIO...")

            result = await shazam.recognize(str(wav_file))
            track = result.get("track") if isinstance(result, dict) else None

            if not track:
                state["message"] = (
                    "No match in latest sample. Keeping previous artist/title pair."
                )
                print("No song match. Previous pair kept.")
                return

            artist = (track.get("subtitle") or "Unknown artist").strip()
            title = (track.get("title") or "Unknown title").strip()
            album = get_album(track)

            # Treat artist + title as one atomic result so the UI never mixes
            # an artist from one recognition with a title from another.
            pair = f"{artist} — {title}"
            track_key = f"{artist.lower()}\u241f{title.lower()}"
            now = datetime.now().isoformat()

            state.update({
                "success": True,
                "station": cfg["name"],
                "artist": artist,
                "title": title,
                "album": album,
                "pair": pair,
                "trackKey": track_key,
                "source": cfg["source"],
                "recognizedAt": now,
                "message": "Song recognized.",
            })

            print("RECOGNIZED")
            print(f"Pair   : {pair}")
            if album:
                print(f"Album  : {album}")

    except subprocess.TimeoutExpired:
        state["message"] = f"{cfg['name']} stream capture timed out."
        print(state["message"])

    except Exception as exc:
        state["message"] = str(exc)
        print("Recognition error:", exc)

# ============================================================
# AUTOMATIC LOOPS
# ============================================================

async def recognition_loop(key: str, initial_delay: int = 0):
    state = station_states[key]
    cfg = STATIONS[key]

    if initial_delay:
        await asyncio.sleep(initial_delay)

    state["running"] = True
    print(f"{cfg['name']} automatic detector started.")

    while True:
        try:
            await recognize_station_once(key)
        except asyncio.CancelledError:
            break
        except Exception as exc:
            print(f"{cfg['name']} detector error:", exc)

        await asyncio.sleep(RECOGNITION_INTERVAL_SECONDS)

    state["running"] = False

# ============================================================
# API
# ============================================================

@app.get("/kis/latest")
async def kis_latest():
    return {"ok": True, **station_states["kis"]}


@app.post("/kis/recognize-now")
async def kis_recognize_now():
    await recognize_station_once("kis")
    return {"ok": True, **station_states["kis"]}


@app.get("/jak/latest")
async def jak_latest():
    return {"ok": True, **station_states["jak"]}


@app.post("/jak/recognize-now")
async def jak_recognize_now():
    await recognize_station_once("jak")
    return {"ok": True, **station_states["jak"]}

# ============================================================
# START / STOP
# ============================================================

@app.on_event("startup")
async def startup_event():
    recognition_tasks["kis"] = asyncio.create_task(
        recognition_loop("kis", initial_delay=0)
    )
    # Small offset prevents both FFmpeg/Shazam jobs from starting at exactly
    # the same instant on slower machines.
    recognition_tasks["jak"] = asyncio.create_task(
        recognition_loop("jak", initial_delay=8)
    )


@app.on_event("shutdown")
async def shutdown_event():
    for task in recognition_tasks.values():
        task.cancel()

    if recognition_tasks:
        await asyncio.gather(
            *recognition_tasks.values(),
            return_exceptions=True,
        )

# ============================================================
# RUN SERVER DIRECTLY
# ============================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend:app",
        host="127.0.0.1",
        port=8765,
        reload=False,
    )