const stationEl = document.getElementById("station");
const statusEl = document.getElementById("status");
const messageEl = document.getElementById("message");
const startButton = document.getElementById("start");
const stopButton = document.getElementById("stop");

function stationFromText(rawText) {
  const text = String(rawText || "").toLowerCase();

  if (text.includes("most") || text.includes("105.8")) {
    return "MOST 105.8 FM";
  }

  if (text.includes("kis") || text.includes("95.1")) {
    return "KIS 95.1 FM";
  }

  if (
    text.includes("jak 101") ||
    text.includes("jak101") ||
    text.includes("101 fm") ||
    text.includes("radio jak") ||
    text.includes("92ef0b2b-061a-482d-bf2c-8b9fe6a49d84")
  ) {
    return "JAK 101 FM";
  }

  return null;
}

function inferStation(tab) {
  return stationFromText(`${tab?.title || ""} ${tab?.url || ""}`);
}

async function refresh() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  const station = inferStation(tab);

  stationEl.textContent = station || "Open MOST, KIS, or JAK";

  chrome.runtime.sendMessage({ type: "GET_STATE" }, response => {
    const state = response?.detectorState;
    statusEl.textContent = state?.running ? "Running" : "Stopped";
  });
}

startButton.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  const station = inferStation(tab);

  if (!station) {
    messageEl.textContent =
      "Open MOST 105.8, KIS 95.1, or JAK 101 first.";
    return;
  }

  statusEl.textContent = "Starting...";
  messageEl.textContent = "Connecting to the radio tab audio...";

  chrome.runtime.sendMessage(
    {
      type: "START_AUTO_DETECTION",
      station
    },
    response => {
      if (response?.ok) {
        statusEl.textContent = "Running";
        messageEl.textContent =
          "Listening now. The first result normally appears after the 12-second sample finishes.";
      } else {
        statusEl.textContent = "Error";
        messageEl.textContent =
          response?.error || "Could not start detection.";
      }
    }
  );
});

stopButton.addEventListener("click", () => {
  chrome.runtime.sendMessage(
    { type: "STOP_AUTO_DETECTION" },
    response => {
      if (response?.ok) {
        statusEl.textContent = "Stopped";
        messageEl.textContent = "Automatic detection stopped.";
      }
    }
  );
});

refresh();
