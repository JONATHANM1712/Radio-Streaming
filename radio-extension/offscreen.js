let mediaStream = null;
let audioContext = null;
let audioSource = null;
let running = false;
let cycleTimer = null;

let activeTabId = null;
let activeStation = null;
let intervalSeconds = 60;
let sampleSeconds = 12;

const BACKEND_URL =
  "http://127.0.0.1:8765/recognize";

async function notifyStatus(status, detail = "") {
  await chrome.runtime.sendMessage({
    type: "DETECTION_STATUS",
    tabId: activeTabId,
    station: activeStation,
    status,
    detail
  });
}

function chooseMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg"
  ];

  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return "";
}

async function openCapturedTab(streamId) {
  mediaStream =
    await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId
        }
      },
      video: false
    });

  /*
    tabCapture removes the captured tab's audio from normal playback.
    Reconnect it to the speakers so the radio remains audible.
  */
  audioContext = new AudioContext();
  audioSource =
    audioContext.createMediaStreamSource(mediaStream);
  audioSource.connect(audioContext.destination);
}

async function recordSample() {
  if (!running || !mediaStream) return;

  const track =
    mediaStream.getAudioTracks()[0];

  if (!track || track.readyState !== "live") {
    await notifyStatus(
      "Capture stopped",
      "The radio tab audio stream is no longer active."
    );
    await stopCapture();
    return;
  }

  await notifyStatus(
    "Listening",
    `Capturing ${sampleSeconds} seconds of radio audio...`
  );

  const mimeType = chooseMimeType();

  const recorder =
    mimeType
      ? new MediaRecorder(mediaStream, { mimeType })
      : new MediaRecorder(mediaStream);

  const chunks = [];

  recorder.addEventListener("dataavailable", event => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data);
    }
  });

  const finished =
    new Promise(resolve => {
      recorder.addEventListener(
        "stop",
        resolve,
        { once: true }
      );
    });

  recorder.start(1000);

  await new Promise(resolve =>
    setTimeout(resolve, sampleSeconds * 1000)
  );

  if (recorder.state !== "inactive") {
    recorder.stop();
  }

  await finished;

  if (!running) return;

  const blob =
    new Blob(
      chunks,
      {
        type:
          recorder.mimeType ||
          mimeType ||
          "audio/webm"
      }
    );

  if (!blob.size) {
    await notifyStatus(
      "No audio",
      "The captured sample was empty."
    );
    return;
  }

  await recognizeBlob(blob);
}

async function recognizeBlob(blob) {
  try {
    await notifyStatus(
      "Recognizing",
      "Sending the audio sample to your local recognizer..."
    );

    const form =
      new FormData();

    const extension =
      blob.type.includes("ogg")
        ? "ogg"
        : "webm";

    form.append(
      "file",
      blob,
      `radio-sample.${extension}`
    );

    form.append(
      "station",
      activeStation
    );

    const response =
      await fetch(
        BACKEND_URL,
        {
          method: "POST",
          body: form
        }
      );

    if (!response.ok) {
      throw new Error(
        `Local recognizer returned HTTP ${response.status}`
      );
    }

    const result =
      await response.json();

    if (result.success) {
      await chrome.runtime.sendMessage({
        type: "RECOGNITION_RESULT",
        tabId: activeTabId,
        station: activeStation,
        artist: result.artist,
        title: result.title,
        album: result.album || "",
        source:
          result.source ||
          "ShazamIO local",
        recognizedAt:
          new Date().toISOString()
      });

      await notifyStatus(
        "Recognized",
        `${result.artist} — ${result.title}`
      );
    } else {
      await notifyStatus(
        "No match",
        result.message ||
        "No song was identified in this sample."
      );
    }
  } catch (error) {
    await notifyStatus(
      "Backend offline",
      String(error?.message || error)
    );
  }
}

function scheduleNextCycle() {
  if (!running) return;

  cycleTimer =
    setTimeout(
      async () => {
        if (!running) return;
        await recordSample();
        scheduleNextCycle();
      },
      intervalSeconds * 1000
    );
}

async function startCapture(message) {
  await stopCapture();

  activeTabId =
    message.tabId;

  activeStation =
    message.station;

  intervalSeconds =
    Number(message.intervalSeconds) || 60;

  sampleSeconds =
    Number(message.sampleSeconds) || 12;

  await openCapturedTab(
    message.streamId
  );

  running = true;

  await notifyStatus(
    "Running",
    `Automatic recognition every ${intervalSeconds} seconds.`
  );

  /*
    First recognition starts immediately.
  */
  await recordSample();

  scheduleNextCycle();
}

async function stopCapture() {
  running = false;

  if (cycleTimer) {
    clearTimeout(cycleTimer);
    cycleTimer = null;
  }

  if (mediaStream) {
    for (const track of mediaStream.getTracks()) {
      track.stop();
    }
    mediaStream = null;
  }

  if (audioSource) {
    try {
      audioSource.disconnect();
    } catch (_) {}
    audioSource = null;
  }

  if (audioContext) {
    try {
      await audioContext.close();
    } catch (_) {}
    audioContext = null;
  }
}

chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {
    if (message?.target !== "offscreen") {
      return;
    }

    if (message.type === "START_CAPTURE") {
      startCapture(message)
        .then(() => {
          sendResponse({ ok: true });
        })
        .catch(error => {
          sendResponse({
            ok: false,
            error:
              String(error?.message || error)
          });
        });

      return true;
    }

    if (message.type === "STOP_CAPTURE") {
      stopCapture().then(() => {
        sendResponse({ ok: true });
      });

      return true;
    }
  }
);
