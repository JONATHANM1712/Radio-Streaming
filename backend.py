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

KIS_STREAM_URL = (
    "https://wz.mari.co.id:1936/"
    "web_kisfm/kisfm/playlist.m3u8"
)

KIS_STATION_NAME = "KIS 95.1 FM"

SAMPLE_SECONDS = 12
RECOGNITION_INTERVAL_SECONDS = 60


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="MOST & KIS Radio Metadata Service",
    version="0.3.0",
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
# KIS STATE
# ============================================================

kis_state = {
    "running": False,
    "success": False,
    "station": KIS_STATION_NAME,
    "artist": "",
    "title": "",
    "album": "",
    "source": "KIS direct-stream ShazamIO",
    "recognizedAt": None,
    "lastAttempt": None,
    "message": "Waiting for first recognition...",
}


recognition_task = None


# ============================================================
# ROOT
# ============================================================

@app.get("/")
async def root():
    return {
        "ok": True,
        "service": "MOST & KIS Radio Metadata Service",
        "version": "0.3.0",
        "kisDetectorRunning": kis_state["running"],
    }


# ============================================================
# FFMPEG
# ============================================================

def find_ffmpeg():
    exe = shutil.which("ffmpeg")

    if not exe:
        raise RuntimeError(
            "FFmpeg was not found in PATH. "
            "Install FFmpeg and reopen the terminal."
        )

    return exe


def capture_kis_sample(target: Path):
    """
    Read KIS directly from the HLS stream.

    No Chrome tab audio capture is used.
    """

    ffmpeg = find_ffmpeg()

    command = [
        ffmpeg,
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",

        "-i",
        KIS_STREAM_URL,

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
        error_text = result.stderr.decode(
            "utf-8",
            errors="replace",
        )

        raise RuntimeError(
            f"FFmpeg could not capture KIS stream: "
            f"{error_text}"
        )


# ============================================================
# SHAZAM RECOGNITION
# ============================================================

async def recognize_kis_once():
    global kis_state

    kis_state["lastAttempt"] = datetime.now().isoformat()

    print()
    print("=" * 60)
    print("KIS 95.1 FM")
    print("Capturing radio stream...")
    print("=" * 60)

    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp = Path(temp_dir)

            wav_file = temp / "kis-sample.wav"

            # Run blocking FFmpeg outside the main async loop
            await asyncio.to_thread(
                capture_kis_sample,
                wav_file,
            )

            print(
                f"Captured {SAMPLE_SECONDS} seconds."
            )

            print("Recognizing with ShazamIO...")

            result = await shazam.recognize(
                str(wav_file)
            )

            track = (
                result.get("track")
                if isinstance(result, dict)
                else None
            )

            if not track:
                print("No song match.")

                # IMPORTANT:
                # Keep previous successful Artist / Title.
                kis_state["message"] = (
                    "No match in latest sample. "
                    "Keeping previous song."
                )

                return

            artist = (
                track.get("subtitle")
                or "Unknown artist"
            )

            title = (
                track.get("title")
                or "Unknown title"
            )

            album = ""

            sections = track.get("sections") or []

            for section in sections:
                metadata = section.get("metadata") or []

                for item in metadata:
                    label = (
                        item.get("title")
                        or ""
                    ).lower()

                    text = (
                        item.get("text")
                        or ""
                    )

                    if label == "album":
                        album = text
                        break

                if album:
                    break

            kis_state.update({
                "success": True,
                "station": KIS_STATION_NAME,
                "artist": artist,
                "title": title,
                "album": album,
                "source":
                    "KIS direct-stream ShazamIO",
                "recognizedAt":
                    datetime.now().isoformat(),
                "message": "Song recognized.",
            })

            print()
            print("RECOGNIZED")
            print(f"Artist : {artist}")
            print(f"Title  : {title}")

            if album:
                print(f"Album  : {album}")

    except subprocess.TimeoutExpired:
        kis_state["message"] = (
            "KIS stream capture timed out."
        )

        print(kis_state["message"])

    except Exception as exc:
        kis_state["message"] = str(exc)

        print(
            "Recognition error:",
            exc,
        )


# ============================================================
# AUTOMATIC RECOGNITION LOOP
# ============================================================

async def kis_recognition_loop():
    kis_state["running"] = True

    print()
    print("KIS automatic detector started.")
    print(
        f"Recognition every "
        f"{RECOGNITION_INTERVAL_SECONDS} seconds."
    )

    while True:
        try:
            await recognize_kis_once()

        except asyncio.CancelledError:
            break

        except Exception as exc:
            print(
                "KIS detector error:",
                exc,
            )

        await asyncio.sleep(
            RECOGNITION_INTERVAL_SECONDS
        )

    kis_state["running"] = False


# ============================================================
# API
# ============================================================

@app.get("/kis/latest")
async def kis_latest():
    """
    Browser calls this endpoint to get
    the latest recognized KIS song.
    """

    return {
        "ok": True,
        **kis_state,
    }


@app.post("/kis/recognize-now")
async def kis_recognize_now():
    """
    Optional manual immediate recognition.
    """

    await recognize_kis_once()

    return {
        "ok": True,
        **kis_state,
    }


# ============================================================
# START / STOP
# ============================================================

@app.on_event("startup")
async def startup_event():
    global recognition_task

    recognition_task = asyncio.create_task(
        kis_recognition_loop()
    )


@app.on_event("shutdown")
async def shutdown_event():
    global recognition_task

    if recognition_task:
        recognition_task.cancel()

        try:
            await recognition_task
        except asyncio.CancelledError:
            pass

    kis_state["running"] = False