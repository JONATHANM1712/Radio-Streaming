const OFFSCREEN_DOCUMENT = "offscreen.html";

async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT);

  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [offscreenUrl]
  });

  if (contexts.length > 0) return;

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT,
    reasons: ["USER_MEDIA"],
    justification: "Capture the active radio tab audio for music recognition."
  });
}

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

async function getTabStation(tab) {
  return stationFromText(`${tab?.title || ""} ${tab?.url || ""}`);
}

async function sendToTab(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (_) {}
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "START_AUTO_DETECTION") {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true
        });

        if (!tab?.id) {
          throw new Error("No active tab found.");
        }

        const station = message.station || await getTabStation(tab);

        if (!station) {
          throw new Error(
            "Open MOST 105.8, KIS 95.1, or JAK 101 first."
          );
        }

        await ensureOffscreenDocument();

        const streamId = await chrome.tabCapture.getMediaStreamId({
          targetTabId: tab.id
        });

        await chrome.runtime.sendMessage({
          target: "offscreen",
          type: "START_CAPTURE",
          streamId,
          tabId: tab.id,
          station,
          intervalSeconds: 60,
          sampleSeconds: 12
        });

        await chrome.storage.local.set({
          detectorState: {
            running: true,
            tabId: tab.id,
            station,
            startedAt: new Date().toISOString()
          }
        });

        await sendToTab(tab.id, {
          type: "DETECTOR_STATE",
          running: true,
          station
        });

        sendResponse({ ok: true, station });
      } catch (error) {
        sendResponse({
          ok: false,
          error: String(error?.message || error)
        });
      }
    })();

    return true;
  }

  if (message?.type === "STOP_AUTO_DETECTION") {
    (async () => {
      try {
        const state = (await chrome.storage.local.get("detectorState"))
          .detectorState;

        await ensureOffscreenDocument();

        await chrome.runtime.sendMessage({
          target: "offscreen",
          type: "STOP_CAPTURE"
        });

        if (state?.tabId) {
          await sendToTab(state.tabId, {
            type: "DETECTOR_STATE",
            running: false,
            station: state.station
          });
        }

        await chrome.storage.local.set({
          detectorState: { running: false }
        });

        sendResponse({ ok: true });
      } catch (error) {
        sendResponse({
          ok: false,
          error: String(error?.message || error)
        });
      }
    })();

    return true;
  }

  if (message?.type === "RECOGNITION_RESULT") {
    (async () => {
      const payload = {
        station: message.station,
        artist: message.artist || "",
        title: message.title || "",
        album: message.album || "",
        source: message.source || "ShazamIO local",
        recognizedAt: message.recognizedAt || new Date().toISOString()
      };

      await chrome.storage.local.set({
        lastRecognition: payload
      });

      if (message.tabId) {
        await sendToTab(message.tabId, {
          type: "RECOGNITION_RESULT",
          payload
        });
      }
    })();

    return false;
  }

  if (message?.type === "DETECTION_STATUS") {
    if (message.tabId) {
      sendToTab(message.tabId, {
        type: "DETECTION_STATUS",
        status: message.status,
        detail: message.detail || ""
      });
    }
    return false;
  }

  if (message?.type === "GET_STATE") {
    (async () => {
      const data = await chrome.storage.local.get([
        "detectorState",
        "lastRecognition"
      ]);

      sendResponse({
        ok: true,
        detectorState: data.detectorState || { running: false },
        lastRecognition: data.lastRecognition || null
      });
    })();

    return true;
  }
});
