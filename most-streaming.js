const STREAM_URL =
  "https://wz.mari.co.id:1936/web_mostfm/mostfm/playlist.m3u8";

const STATION_NAME =
  "MOST 105.8 FM";


/*
  ============================================================
  TEXT HELPER
  ============================================================
*/

function setText(id, value) {

  const element =
    document.getElementById(id);

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
      "MOST custom radio controls are missing."
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


  /*
    ==========================================================
    UPDATE VOLUME ICON
    ==========================================================
  */

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
            "MOST playback error:",
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
        "Pause MOST 105.8 FM"
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
        "Play MOST 105.8 FM"
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
  ID3 HELPERS
  ============================================================
*/

function synchsafeToInt(
  b0,
  b1,
  b2,
  b3
) {

  return (
    (b0 << 21) |
    (b1 << 14) |
    (b2 << 7) |
    b3
  );

}


function bigEndianToInt(
  b0,
  b1,
  b2,
  b3
) {

  return (
    ((b0 << 24) >>> 0) +
    (b1 << 16) +
    (b2 << 8) +
    b3
  );

}


/*
  ============================================================
  DECODE ID3 TEXT FRAME
  ============================================================
*/

function decodeID3TextFrame(
  bytes
) {

  if (
    !bytes ||
    bytes.length === 0
  ) {

    return "";

  }


  const encoding =
    bytes[0];


  const data =
    bytes.slice(1);


  try {

    /*
      ISO-8859-1
    */

    if (encoding === 0) {

      return new TextDecoder(
        "latin1"
      )
        .decode(data)
        .replace(/\0/g, "")
        .trim();

    }


    /*
      UTF-16 with BOM
    */

    if (encoding === 1) {

      if (
        data.length >= 2 &&
        data[0] === 0xff &&
        data[1] === 0xfe
      ) {

        return new TextDecoder(
          "utf-16le"
        )
          .decode(
            data.slice(2)
          )
          .replace(/\0/g, "")
          .trim();

      }


      if (
        data.length >= 2 &&
        data[0] === 0xfe &&
        data[1] === 0xff
      ) {

        return new TextDecoder(
          "utf-16be"
        )
          .decode(
            data.slice(2)
          )
          .replace(/\0/g, "")
          .trim();

      }


      return new TextDecoder(
        "utf-16le"
      )
        .decode(data)
        .replace(/\0/g, "")
        .trim();

    }


    /*
      UTF-16BE
    */

    if (encoding === 2) {

      return new TextDecoder(
        "utf-16be"
      )
        .decode(data)
        .replace(/\0/g, "")
        .trim();

    }


    /*
      UTF-8
    */

    return new TextDecoder(
      "utf-8"
    )
      .decode(data)
      .replace(/\0/g, "")
      .trim();

  }

  catch (error) {

    console.warn(
      "ID3 text decoding failed:",
      error
    );


    return "";

  }

}


/*
  ============================================================
  PARSE ID3 FRAMES
  ============================================================
*/

function parseID3(
  input
) {

  const bytes =
    input instanceof Uint8Array
      ? input
      : new Uint8Array(input);


  if (
    bytes.length < 10
  ) {

    return null;

  }


  /*
    ID3 header:
    49 44 33 = "ID3"
  */

  if (
    bytes[0] !== 0x49 ||
    bytes[1] !== 0x44 ||
    bytes[2] !== 0x33
  ) {

    return null;

  }


  const version =
    bytes[3];


  let offset =
    10;


  let title =
    "";


  let artist =
    "";


  while (
    offset + 10 <=
    bytes.length
  ) {

    const frameId =
      String.fromCharCode(
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3]
      );


    /*
      Empty padding marks the end.
    */

    if (
      frameId.charCodeAt(0) === 0
    ) {

      break;

    }


    let frameSize;


    if (version === 4) {

      frameSize =
        synchsafeToInt(
          bytes[offset + 4],
          bytes[offset + 5],
          bytes[offset + 6],
          bytes[offset + 7]
        );

    }

    else {

      frameSize =
        bigEndianToInt(
          bytes[offset + 4],
          bytes[offset + 5],
          bytes[offset + 6],
          bytes[offset + 7]
        );

    }


    if (
      !frameSize ||
      frameSize < 0
    ) {

      break;

    }


    const frameStart =
      offset + 10;


    const frameEnd =
      frameStart +
      frameSize;


    if (
      frameEnd >
      bytes.length
    ) {

      break;

    }


    const payload =
      bytes.slice(
        frameStart,
        frameEnd
      );


    /*
      TIT2 = Track title
    */

    if (
      frameId === "TIT2"
    ) {

      title =
        decodeID3TextFrame(
          payload
        );

    }


    /*
      TPE1 = Lead artist
    */

    if (
      frameId === "TPE1"
    ) {

      artist =
        decodeID3TextFrame(
          payload
        );

    }


    offset =
      frameEnd;

  }


  if (
    title ||
    artist
  ) {

    return {
      artist,
      title
    };

  }


  return null;

}


/*
  ============================================================
  FALLBACK TEXT METADATA
  ============================================================
*/

function cleanMetadata(
  data
) {

  return data
    .replace(
      /[^\x20-\x7E]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();

}


function extractArtistTitleFallback(
  metadata
) {

  /*
    Remove obvious ID3 labels first.
  */

  const cleaned =
    metadata
      .replace(
        /\bID3\b/gi,
        " "
      )
      .replace(
        /\bTIT2\b/gi,
        " "
      )
      .replace(
        /\bTPE1\b/gi,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();


  /*
    Standard:
    Artist - Title
  */

  const match =
    cleaned.match(
      /^(.{2,100}?)\s+-\s+(.{2,150})$/
    );


  if (!match) {

    return null;

  }


  return {

    artist:
      match[1].trim(),

    title:
      match[2].trim()

  };

}


/*
  ============================================================
  APPLY MOST METADATA
  ============================================================
*/

function applyMostMetadata(
  artist,
  title
) {

  if (
    !artist &&
    !title
  ) {

    return;

  }


  if (artist) {

    setText(
      "artist",
      artist
    );

  }


  if (title) {

    setText(
      "songTitle",
      title
    );

  }


  setText(
    "recognitionSource",
    "MOST HLS Metadata"
  );


  setText(
    "detectorStatus",
    "Metadata Live"
  );


  setText(
    "detectorDetail",
    "Song information received automatically from the MOST stream."
  );


  setText(
    "lastChecked",
    new Date()
      .toLocaleTimeString(
        "en-GB",
        {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        }
      )
  );

}


/*
  ============================================================
  INITIALIZE MOST RADIO
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
      "MOST radioPlayer or playerStatus is missing."
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


    /*
      Attach first, then load.
    */

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


    /*
      ========================================================
      ERRORS
      ========================================================
    */

    hls.on(
      Hls.Events.ERROR,
      (_, data) => {

        console.error(
          "MOST HLS error:",
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


    /*
      ========================================================
      MOST TIMED ID3 METADATA
      ========================================================
    */

    hls.on(
      Hls.Events.FRAG_PARSING_METADATA,
      (_, data) => {

        const samples =
          data.samples || [];


        for (
          const sample
          of samples
        ) {

          try {

            const bytes =
              sample.data instanceof Uint8Array
                ? sample.data
                : new Uint8Array(
                    sample.data || []
                  );


            /*
              First try proper ID3 frames.
            */

            const id3 =
              parseID3(
                bytes
              );


            if (
              id3 &&
              (
                id3.artist ||
                id3.title
              )
            ) {

              console.log(
                "MOST ID3:",
                id3
              );


              applyMostMetadata(
                id3.artist,
                id3.title
              );


              continue;

            }


            /*
              Fallback for unusual metadata.
            */

            const raw =
              new TextDecoder(
                "utf-8"
              ).decode(
                bytes
              );


            const cleaned =
              cleanMetadata(
                raw
              );


            console.log(
              "MOST raw metadata:",
              cleaned
            );


            const fallback =
              extractArtistTitleFallback(
                cleaned
              );


            if (fallback) {

              applyMostMetadata(
                fallback.artist,
                fallback.title
              );

            }

          }

          catch (error) {

            console.warn(
              "MOST metadata parsing error:",
              error
            );

          }

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


  /*
    ==========================================================
    UNSUPPORTED
    ==========================================================
  */

  else {

    status.textContent =
      "HLS is not supported in this browser.";

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

  }
);