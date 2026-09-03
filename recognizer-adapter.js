/*
  recognizer-adapter.js

  This file is intentionally an adapter point, not a fake recognizer.

  A full automatic Librezam-powered build needs the actual recognition
  implementation from the Librezam source tree (AGPL-3.0), including its
  audio capture/signature/query modules and their dependencies.

  Once those modules are integrated into THIS extension, call:

    chrome.runtime.sendMessage({
      type: "SAVE_RECOGNITION",
      station: "KIS 95.1 FM",
      artist: result.artist,
      title: result.title,
      album: result.album || "",
      source: "Librezam-derived recognizer"
    });

  That message will immediately update the matching station page.
*/
