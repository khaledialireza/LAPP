// LAPP work desktop · the lock screen: hides every window until the person types their password again.
// Locks by key (Ctrl+Alt+L), from the account menu, or after a quiet time chosen in Settings → Desktop.
"use strict";
(function () {
  const { $, esc, I } = D;
  const st = document.createElement("style");
  st.textContent = `#lock{position:fixed;inset:0;z-index:2000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:rgba(8,8,14,.72);backdrop-filter:blur(30px) saturate(1.2);animation:k-pop .2s ease-out;color:var(--tx)}
#lock .lt{font:800 72px/1 Inter,system-ui;letter-spacing:-2px;font-variant-numeric:tabular-nums}#lock .ld{color:var(--mu);margin-bottom:22px}
#lock .lav{width:84px;height:84px;border-radius:50%;display:grid;place-items:center;font-size:34px;font-weight:800;color:#fff;background-size:cover;background-position:center;box-shadow:0 0 0 3px rgba(255,255,255,.15)}
#lock form{display:flex;gap:8px;align-items:center}#lock input{width:240px;background:rgba(255,255,255,.08);border:1px solid var(--ln2);border-radius:12px;padding:10px 14px;outline:none;font:inherit;color:inherit}
#lock input:focus{border-color:var(--vi)}#lock .le{color:var(--rd);min-height:20px;font-size:13px}#lock .lo{color:var(--mu);font-size:12.5px;text-decoration:underline;background:none;border:0;cursor:pointer}
body.locked #wins,body.locked #desk,body.locked #tb,body.locked #cc,body.locked .sheet,body.locked .k-pop,body.locked .k-menu,body.locked .k-toasts{visibility:hidden}`;
  document.head.append(st);
  D.avatar = (size = 30) => K.avatar(D.ME, size);

  D.lock = () => {
    if ($("#lock")) return;
    D.closeMenus(); D.ccClose && D.ccClose();
    try { sessionStorage.setItem("lapp.locked", "1"); } catch {}
    document.body.classList.add("locked");
    const m = D.ME, l = document.createElement("div"); l.id = "lock"; l.setAttribute("role", "dialog"); l.setAttribute("aria-label", "Locked");
    l.innerHTML = `<div class="lt" id="lkT"></div><div class="ld" id="lkD"></div>${K.avatar(D.ME, 84, "lav")}<b style="font-size:17px">${esc(m.name || "@" + m.username)}</b>
      <form id="lkF"><input type="password" id="lkP" placeholder="Password" autocomplete="current-password" aria-label="Password"><button class="b pr" style="height:40px">${I("lock", 15)} Unlock</button></form><div class="le" id="lkE"></div>
      <button class="lo" id="lkO">Sign out</button>`;
    document.body.append(l);
    const tick = () => { const d = new Date(); $("#lkT") && ($("#lkT").textContent = D.hm(d)); $("#lkD") && ($("#lkD").textContent = d.toLocaleDateString(D.loc(), { weekday: "long", day: "numeric", month: "long" })); };
    tick(); l._t = setInterval(tick, 10000);
    $("#lkF").onsubmit = async e => {
      e.preventDefault(); const pw = $("#lkP").value; if (!pw) return;
      try { await D.api("POST", "/auth/unlock", { password: pw }); unlock(); }
      catch (x) { $("#lkE").textContent = x.message; $("#lkP").value = ""; $("#lkP").focus(); }
    };
    $("#lkO").onclick = () => D.go("out");
    setTimeout(() => $("#lkP") && $("#lkP").focus(), 50);
  };
  function unlock() { const l = $("#lock"); if (l) { clearInterval(l._t); l.remove(); } document.body.classList.remove("locked"); try { sessionStorage.removeItem("lapp.locked"); } catch {} idle = Date.now(); }
  D.ACT.lock = D.lock;
  D.ACTIONS.lock = "Lock the screen"; D.DEF.lock = "Ctrl+Alt+L";
  // keys don't reach anything while locked (except typing the password)
  document.addEventListener("keydown", e => {
    if (!document.body.classList.contains("locked")) return;
    const typing = e.target.closest && e.target.closest("#lock") && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (!typing) { e.stopImmediatePropagation(); if (!(e.target.closest && e.target.closest("#lock") && ["Tab"].includes(e.key))) e.preventDefault(); }
  }, true);
  addEventListener("message", e => { if (document.body.classList.contains("locked") && e.data && e.data.lapp && e.data.t === "key") e.stopImmediatePropagation(); }, true);
  // a reload keeps it locked
  D.on("ready", () => { try { if (sessionStorage.getItem("lapp.locked")) D.lock(); } catch {} });

  /* ---------- lock after a quiet time ---------- */
  let idle = Date.now();
  ["pointermove", "keydown", "pointerdown", "wheel"].forEach(ev => addEventListener(ev, () => { idle = Date.now(); }, { passive: true, capture: true }));
  addEventListener("message", e => { if (e.origin === location.origin && e.data && e.data.lapp) idle = Date.now(); });   // working inside a window counts too
  setInterval(() => { const m = +(D.look ? D.look().lockAfter : 0); if (m > 0 && D.ME && !$("#lock") && Date.now() - idle > m * 60e3) D.lock(); }, 20000);
})();
