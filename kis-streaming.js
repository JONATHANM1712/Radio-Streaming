const STREAM_URL =
  "https://wz.mari.co.id:1936/web_kisfm/kisfm/playlist.m3u8";

const STATION_NAME =
  "KIS 95.1 FM";

const BACKEND_URL =
  "http://127.0.0.1:8765";

const METADATA_REFRESH_MS =
  5000;


/*
  ============================================================
  RADIO PLAYER
  ============================================================
*/

function initializeRadio() {

  const audio =
    document.getElementById(
      "radioPlayer"
    );

  const status =
    document.getElementById(
      "playerStatus"
    );


  if (
    !audio ||
    !status
  ) {

    console.error(
      "KIS radioPlayer or playerStatus is missing."
    );

    return;

  }


  /*
    ==========================================================
    HLS.JS
    ==========================================================
  */

  if (
    window.Hls &&
    Hls.isSupported()
  ) {

    const hls =
      new Hls({
        enableWorker: true
      });


    hls.attachMedia(
      audio
    );


    hls.on(
      Hls.Events.MEDIA_ATTACHED,
      () => {

        status.textContent =
          `Connecting to ${STATION_NAME}...`;


        hls.loadSource(
          STREAM_URL
        );

      }
    );


    hls.on(
      Hls.Events.MANIFEST_PARSED,
      () => {

        status.textContent =
          `${STATION_NAME} live stream ready.`;

      }
    );


    hls.on(
      Hls.Events.ERROR,
      (_, data) => {

        console.error(
          "KIS HLS error:",
          data
        );


        if (!data.fatal) {

          return;

        }


        switch (
          data.type
        ) {

          case Hls.ErrorTypes.NETWORK_ERROR:

            status.textContent =
              `${STATION_NAME} network error. Retrying...`;


            hls.startLoad();

            break;


          case Hls.ErrorTypes.MEDIA_ERROR:

            status.textContent =
              `${STATION_NAME} media error. Recovering...`;


            hls.recoverMediaError();

            break;


          default:

            status.textContent =
              `${STATION_NAME} stream connection problem.`;

            break;

        }

      }
    );

  }


  /*
    ==========================================================
    NATIVE HLS
    ==========================================================
  */

  else if (
    audio.canPlayType(
      "application/vnd.apple.mpegurl"
    )
  ) {

    audio.src =
      STREAM_URL;


    status.textContent =
      `${STATION_NAME} live stream ready.`;

  }


  else {

    status.textContent =
      "HLS is not supported in this browser.";

  }

}


/*
  ============================================================
  CUSTOM PLAYER CONTROLS
  ============================================================
*/

function initializeCustomControls() {

  const audio =
    document.getElementById(
      "radioPlayer"
    );

  const playPauseButton =
    document.getElementById(
      "playPauseButton"
    );

  const volumeButton =
    document.getElementById(
      "volumeButton"
    );

  const volumeSlider =
    document.getElementById(
      "volumeSlider"
    );

  const status =
    document.getElementById(
      "playerStatus"
    );


  if (
    !audio ||
    !playPauseButton ||
    !volumeButton ||
    !volumeSlider ||
    !status
  ) {

    console.error(
      "KIS custom radio controls are missing."
    );

    return;

  }


  /*
    ==========================================================
    DEFAULT VOLUME = 40%
    ==========================================================
  */

  audio.volume =
    0.40;

  volumeSlider.value =
    "40";


  let previousVolume =
    0.40;


  function updateVolumeIcon() {

    if (
      audio.muted ||
      audio.volume === 0
    ) {

      volumeButton.textContent =
        "🔇";

    }

    else if (
      audio.volume < 0.5
    ) {

      volumeButton.textContent =
        "🔉";

    }

    else {

      volumeButton.textContent =
        "🔊";

    }

  }


  updateVolumeIcon();


  /*
    ==========================================================
    PLAY / PAUSE
    ==========================================================
  */

  playPauseButton.addEventListener(
    "click",
    async () => {

      if (audio.paused) {

        try {

          status.textContent =
            `Starting ${STATION_NAME}...`;


          await audio.play();


          status.textContent =
            `${STATION_NAME} live stream playing.`;

        }

        catch (error) {

          console.error(
            "KIS playback error:",
            error
          );


          status.textContent =
            `Could not play ${STATION_NAME}.`;

        }

      }

      else {

        audio.pause();


        status.textContent =
          `${STATION_NAME} paused.`;

      }

    }
  );


  /*
    ==========================================================
    PLAY BUTTON STATE
    ==========================================================
  */

  audio.addEventListener(
    "play",
    () => {

      playPauseButton.textContent =
        "■";


      playPauseButton.setAttribute(
        "aria-label",
        "Pause KIS 95.1 FM"
      );

    }
  );


  audio.addEventListener(
    "pause",
    () => {

      playPauseButton.textContent =
        "▶";


      playPauseButton.setAttribute(
        "aria-label",
        "Play KIS 95.1 FM"
      );

    }
  );


  /*
    ==========================================================
    VOLUME
    ==========================================================
  */

  volumeSlider.addEventListener(
    "input",
    () => {

      const volume =
        Number(
          volumeSlider.value
        ) / 100;


      audio.muted =
        false;


      audio.volume =
        volume;


      if (volume > 0) {

        previousVolume =
          volume;

      }


      updateVolumeIcon();

    }
  );


  /*
    ==========================================================
    MUTE / UNMUTE
    ==========================================================
  */

  volumeButton.addEventListener(
    "click",
    () => {

      if (
        audio.muted ||
        audio.volume === 0
      ) {

        audio.muted =
          false;


        audio.volume =
          previousVolume || 0.40;


        volumeSlider.value =
          String(
            Math.round(
              audio.volume * 100
            )
          );

      }

      else {

        previousVolume =
          audio.volume || 0.40;


        audio.muted =
          true;

      }


      updateVolumeIcon();

    }
  );

}


/*
  ============================================================
  TEXT HELPER
  ============================================================
*/

function setText(
  id,
  value
) {

  const element =
    document.getElementById(
      id
    );


  if (
    element &&
    value !== undefined &&
    value !== null
  ) {

    element.textContent =
      value;

  }

}


/*
  ============================================================
  FORMAT RECOGNITION TIME
  ============================================================
*/

function formatRecognitionTime(
  iso
) {

  if (!iso) {

    return "--";

  }


  const date =
    new Date(
      iso
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "--";

  }


  return date.toLocaleTimeString(
    "en-GB",
    {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }
  );

}


/*
  ============================================================
  APPLY KIS METADATA
  ============================================================
*/

function applyKisMetadata(
  data
) {

  if (!data) {

    return;

  }


  setText(
    "detectorStatus",
    data.running
      ? "Automatic"
      : "Stopped"
  );


  if (
    data.message
  ) {

    setText(
      "detectorDetail",
      data.message
    );

  }


  /*
    Keep previous successful song if
    the latest Shazam sample has no match.
  */

  if (
    data.success &&
    data.artist &&
    data.title
  ) {

    setText(
      "artist",
      data.artist
    );


    setText(
      "songTitle",
      data.title
    );


    setText(
      "recognitionSource",
      data.source ||
      "KIS direct-stream ShazamIO"
    );


    setText(
      "lastChecked",
      formatRecognitionTime(
        data.recognizedAt
      )
    );


    const album =
      document.getElementById(
        "album"
      );


    if (album) {

      album.textContent =
        data.album ||
        "Unknown album";

    }

  }

}


/*
  ============================================================
  FETCH KIS METADATA FROM LOCAL BACKEND
  ============================================================
*/

async function updateKisMetadata() {

  try {

    const response =
      await fetch(
        `${BACKEND_URL}/kis/latest`,
        {
          cache: "no-store"
        }
      );


    if (
      !response.ok
    ) {

      throw new Error(
        `HTTP ${response.status}`
      );

    }


    const data =
      await response.json();


    setText(
      "backendStatus",
      "Connected"
    );


    applyKisMetadata(
      data
    );

  }

  catch (error) {

    console.error(
      "KIS metadata error:",
      error
    );


    setText(
      "backendStatus",
      "Offline"
    );


    setText(
      "detectorStatus",
      "Backend Offline"
    );


    setText(
      "detectorDetail",
      "Start Radio Detector.bat to enable automatic KIS song recognition."
    );

  }

}


/*
  ============================================================
  START
  ============================================================
*/

document.addEventListener(
  "DOMContentLoaded",
  () => {

    initializeCustomControls();

    initializeRadio();


    /*
      Fetch the current KIS recognition immediately.
    */

    updateKisMetadata();


    /*
      Refresh displayed recognition every 5 seconds.

      Python performs the actual song recognition
      independently in the background.
    */

    setInterval(
      updateKisMetadata,
      METADATA_REFRESH_MS
    );

  }
);