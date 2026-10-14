import asyncio

import os

import shutil

import subprocess

import tempfile

import sqlite3

from contextlib import asynccontextmanager

from datetime import datetime, timezone, timedelta, time

from zoneinfo import ZoneInfo

from pathlib import Path



from fastapi import FastAPI

from fastapi.middleware.cors import CORSMiddleware

from shazamio import Shazam



# ============================================================

# CONFIGURATION

# ============================================================



JAKARTA = ZoneInfo("Asia/Jakarta")

DATABASE_PATH = Path(os.getenv("DATABASE_PATH", str(Path(__file__).with_name("radio-history.sqlite3"))))



STATIONS = {

    "most": {

        "name": "MOST 105.8 FM",

        "stream_url": "https://wz.mari.co.id:1936/web_mostfm/mostfm/playlist.m3u8",

        "source": "MOST direct-stream ShazamIO",

    },

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
SHAZAM_TIMEOUT_SECONDS = 30
RETRY_DELAYS_SECONDS = (5, 10, 20, 40, 60)

RECOGNITION_INTERVAL_SECONDS = 60



# ============================================================

# FASTAPI

# ============================================================



app = FastAPI(

    title="MOST, KIS & JAK Radio Metadata Service",

    version="0.5.0",

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

cleanup_task = None

publish_task = None

publish_event = asyncio.Event()





def connect_db():

    db = sqlite3.connect(DATABASE_PATH, timeout=15)

    db.row_factory = sqlite3.Row

    db.execute("PRAGMA busy_timeout=15000")

    return db





def initialize_db():

    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)

    with connect_db() as db:

        db.execute("""CREATE TABLE IF NOT EXISTS song_history (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            station TEXT NOT NULL,

            artist TEXT NOT NULL,

            title TEXT NOT NULL,

            album TEXT NOT NULL DEFAULT '',

            track_key TEXT NOT NULL,

            detected_at_utc TEXT NOT NULL,

            local_day TEXT NOT NULL

        )""")

        db.execute("CREATE INDEX IF NOT EXISTS idx_history_day_station ON song_history(local_day, station, id)")





def jakarta_now():

    return datetime.now(JAKARTA)





def purge_old_history():

    today = jakarta_now().date().isoformat()

    with connect_db() as db:

        db.execute("DELETE FROM song_history WHERE local_day < ?", (today,))





def record_recognition(station, artist, title, album, track_key):

    now = jakarta_now()

    day = now.date().isoformat()

    with connect_db() as db:

        # Each consecutive detection of the same song is one play, not a new row.

        previous = db.execute(

            "SELECT track_key FROM song_history WHERE station=? AND local_day=? ORDER BY id DESC LIMIT 1",

            (station, day),

        ).fetchone()

        if previous and previous["track_key"] == track_key:

            return False

        db.execute("""INSERT INTO song_history

            (station, artist, title, album, track_key, detected_at_utc, local_day)

            VALUES (?, ?, ?, ?, ?, ?, ?)""",

            (station, artist, title, album, track_key, now.astimezone(timezone.utc).isoformat(), day),

        )

    return True





async def midnight_cleanup_loop():

    while True:

        now = jakarta_now()

        next_midnight = datetime.combine(

            now.date() + timedelta(days=1),

            time.min, tzinfo=JAKARTA,

        )

        await asyncio.sleep(max(1, (next_midnight - now).total_seconds()))

        await asyncio.to_thread(purge_old_history)

        publish_event.set()  # Publish an empty new-day snapshot after midnight.





async def publish_loop():

    """Publish on changed tracks, at most once per minute; retry failed pushes."""

    loop = asyncio.get_running_loop()

    last_success = loop.time() - 60

    publish_event.set()  # Publish/reset today's snapshot on startup.

    while True:

        await publish_event.wait()

        remaining = 60 - (loop.time() - last_success)

        if remaining > 0:

            await asyncio.sleep(remaining)

        publish_event.clear()

        try:

            proc = await asyncio.create_subprocess_exec(

                os.sys.executable,

                str(Path(__file__).with_name('publish-history.py')),

                cwd=str(Path(__file__).parent),

                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,

            )

            _, stderr = await proc.communicate()

            if proc.returncode:

                print('History publishing failed:', stderr.decode(errors='replace').strip())

                publish_event.set()  # Retry, never more often than once a minute.

            else:

                last_success = loop.time()

        except asyncio.CancelledError:

            raise

        except Exception as exc:

            print('History publishing error:', exc)

            publish_event.set()

        if publish_event.is_set() and loop.time() - last_success >= 60:

            await asyncio.sleep(60)





# ============================================================

# ROOT

# ============================================================



@app.get("/")

async def root():

    return {

        "ok": True,

        "service": "MOST, KIS & JAK Radio Metadata Service",

        "version": "0.5.0",

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
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,

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



            result = await asyncio.wait_for(
                shazam.recognize(str(wav_file)), timeout=SHAZAM_TIMEOUT_SECONDS
            )

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



            is_new_song = await asyncio.to_thread(record_recognition, key, artist, title, album, track_key)

            if is_new_song:

                publish_event.set()



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
    consecutive_failures = 0
    try:
        while True:
            try:
                succeeded = await recognize_station_once(key)
                if succeeded:
                    consecutive_failures = 0
                    delay = RECOGNITION_INTERVAL_SECONDS
                else:
                    consecutive_failures += 1
                    delay = RETRY_DELAYS_SECONDS[
                        min(consecutive_failures - 1, len(RETRY_DELAYS_SECONDS) - 1)
                    ]
                    print(f"{cfg['name']}: retrying in {delay} seconds.")
                await asyncio.sleep(delay)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                consecutive_failures += 1
                delay = RETRY_DELAYS_SECONDS[
                    min(consecutive_failures - 1, len(RETRY_DELAYS_SECONDS) - 1)
                ]
                print(f"{cfg['name']} detector recovered from {type(exc).__name__}; retrying in {delay}s.")
                await asyncio.sleep(delay)
    finally:
        state["running"] = False


@app.get("/api/history/{station}")

async def history(station: str):

    from fastapi import HTTPException

    if station not in STATIONS:

        raise HTTPException(status_code=404, detail="Unknown station")

    today = jakarta_now().date().isoformat()

    with connect_db() as db:

        rows = db.execute("""SELECT artist, title, album, detected_at_utc

            FROM song_history WHERE station=? AND local_day=?

            ORDER BY id DESC LIMIT 500""", (station, today)).fetchall()

    return {"ok": True, "station": station, "timezone": "Asia/Jakarta",

            "date": today, "songs": [dict(row) for row in rows]}





@app.get("/{station}/latest")

async def latest(station: str):

    from fastapi import HTTPException

    if station not in STATIONS:

        raise HTTPException(status_code=404, detail="Unknown station")

    return {"ok": True, **station_states[station]}





@app.post("/{station}/recognize-now")

async def recognize_now(station: str):

    from fastapi import HTTPException

    if station not in STATIONS:

        raise HTTPException(status_code=404, detail="Unknown station")

    if os.getenv("DATABASE_PATH", "").startswith("/var/data/"):

        raise HTTPException(status_code=403, detail="Manual recognition disabled on hosted service")

    await recognize_station_once(station)

    return {"ok": True, **station_states[station]}





# ============================================================

# START / STOP

# ============================================================



@app.on_event("startup")

async def startup_event():

    global cleanup_task, publish_task

    initialize_db()

    purge_old_history()

    for i, key in enumerate(STATIONS):

        recognition_tasks[key] = asyncio.create_task(

            recognition_loop(key, initial_delay=i * 8)

        )

    cleanup_task = asyncio.create_task(midnight_cleanup_loop())

    if os.getenv("PUBLISH_HISTORY_TO_GITHUB", "0") == "1":

        publish_task = asyncio.create_task(publish_loop())





@app.on_event("shutdown")

async def shutdown_event():

    tasks = list(recognition_tasks.values())

    if cleanup_task:

        tasks.append(cleanup_task)

    if publish_task:

        tasks.append(publish_task)

    for task in tasks:

        task.cancel()

    if tasks:

        await asyncio.gather(*tasks, return_exceptions=True)



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