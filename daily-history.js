/* Public daily snapshot on GitHub Pages; no localhost or cloud API needed. */
(function () {
  const station = document.body.dataset.historyStation;
  const list = document.getElementById('dailyHistoryList');
  const status = document.getElementById('dailyHistoryStatus');
  if (!station || !list || !status) return;
  const todayWIB = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Jakarta', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());
  const timeWIB = new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Jakarta', hour:'2-digit', minute:'2-digit', hour12:false});
  async function update() {
    const today = todayWIB();
    list.replaceChildren();
    try {
      const res = await fetch(`history/today.json?t=${Date.now()}`, {cache:'no-store'});
      if (!res.ok) throw Error(`HTTP ${res.status}`);
      const data = await res.json();
      const songs = data.date === today && Array.isArray(data.stations?.[station]) ? data.stations[station] : [];
      status.textContent = `Today ${today} · WIB · ${songs.length} recorded plays` + (data.date === today && data.updated_at_utc ? ' · Last published ' + timeWIB.format(new Date(data.updated_at_utc)) + ' WIB' : ' · Awaiting today\'s upload');
      if (!songs.length) {
        const li = document.createElement('li'); li.className='history-empty'; li.textContent='No published detections yet today.'; list.append(li);
      }
      for (const song of songs) {
        const li=document.createElement('li'), t=document.createElement('time'), name=document.createElement('span');
        t.textContent=timeWIB.format(new Date(song.detected_at_utc));
        name.textContent=`${song.artist} — ${song.title}`;
        li.append(t,name); list.append(li);
      }
    } catch (err) {
      status.textContent='Published history unavailable. Please try again later.';
    }
  }
  update(); setInterval(update, 15000);
})();
