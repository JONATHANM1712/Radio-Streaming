const stationEl =
  document.getElementById("station");

const statusEl =
  document.getElementById("status");

const messageEl =
  document.getElementById("message");

const startButton =
  document.getElementById("start");

const stopButton =
  document.getElementById("stop");

function inferStation(tab) {
  const text =
    `${tab?.title || ""} ${tab?.url || ""}`
      .toLowerCase();

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

async function refresh() {
  const [tab] =
    await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

  const station =
    inferStation(tab);

  stationEl.textContent =
    station ||
    "Open MOST or KIS";

  chrome.runtime.sendMessage(
    { type: "GET_STATE" },
    response => {
      const state =
        response?.detectorState;

      statusEl.textContent =
        state?.running
          ? "Running"
          : "Stopped";
    }
  );
}

startButton.addEventListener(
  "click",
  async () => {
    const [tab] =
      await chrome.tabs.query({
        active: true,
        currentWindow: true
      });

    const station =
      inferStation(tab);

    if (!station) {
      messageEl.textContent =
        "Open most-streaming.html or kis-streaming.html first.";
      return;
    }

    statusEl.textContent =
      "Starting...";

    messageEl.textContent =
      "Connecting to the radio tab audio...";

    chrome.runtime.sendMessage(
      {
        type: "START_AUTO_DETECTION",
        station
      },
      response => {
        if (response?.ok) {
          statusEl.textContent =
            "Running";

          messageEl.textContent =
            "Listening now. First result usually appears after the 12-second sample finishes.";
        } else {
          statusEl.textContent =
            "Error";

          messageEl.textContent =
            response?.error ||
            "Could not start detection.";
        }
      }
    );
  }
);

stopButton.addEventListener(
  "click",
  () => {
    chrome.runtime.sendMessage(
      { type: "STOP_AUTO_DETECTION" },
      response => {
        if (response?.ok) {
          statusEl.textContent =
            "Stopped";

          messageEl.textContent =
            "Automatic detection stopped.";
        }
      }
    );
  }
);

refresh();
