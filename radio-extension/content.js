function pageStation() {
  const text =
    `${document.title} ${location.href}`.toLowerCase();

  if (
    text.includes("most") ||
    text.includes("105.8")
  ) {
    return "MOST 105.8 FM";
  }

  if (
    text.includes("kis") ||
    text.includes("95.1")
  ) {
    return "KIS 95.1 FM";
  }

  return null;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el && value !== undefined && value !== null) {
    el.textContent = value;
  }
}

function applyRecognition(payload) {
  const station = pageStation();

  if (
    payload?.station &&
    station &&
    payload.station !== station
  ) {
    return;
  }

  setText(
    "artist",
    payload.artist || "Unknown artist"
  );

  setText(
    "songTitle",
    payload.title || "Unknown song"
  );

  setText(
    "recognitionSource",
    payload.source || "Music recognition"
  );

  if (payload.recognizedAt) {
    setText(
      "lastChecked",
      new Date(payload.recognizedAt)
        .toLocaleTimeString("en-GB")
    );
  }
}

chrome.runtime.onMessage.addListener(
  message => {
    if (message?.type === "RECOGNITION_RESULT") {
      applyRecognition(message.payload);
    }

    if (message?.type === "DETECTOR_STATE") {
      setText(
        "detectorStatus",
        message.running
          ? "Running"
          : "Stopped"
      );
    }

    if (message?.type === "DETECTION_STATUS") {
      setText(
        "detectorStatus",
        message.status
      );

      if (message.detail) {
        setText(
          "detectorDetail",
          message.detail
        );
      }
    }
  }
);

chrome.runtime.sendMessage(
  { type: "GET_STATE" },
  response => {
    if (!response?.ok) return;

    const station =
      pageStation();

    const last =
      response.lastRecognition;

    if (
      last &&
      (!last.station ||
       !station ||
       last.station === station)
    ) {
      applyRecognition(last);
    }

    const state =
      response.detectorState;

    if (
      state?.running &&
      (!state.station ||
       !station ||
       state.station === station)
    ) {
      setText(
        "detectorStatus",
        "Running"
      );
    }
  }
);
