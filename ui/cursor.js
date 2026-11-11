/* LAPP's own mouse pointer: an arrow and a hand in LAPP's colours, a cross for drawing and text beam stay standard.
   Turned off with localStorage "lapp.cursor" = "system" (Settings in the management panel). */
(() => {
  if (matchMedia("(pointer: coarse)").matches) return;           // touch screens have no pointer to draw
  const svg = s => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
  const G = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF3D7F"/><stop offset=".55" stop-color="#8B5CF6"/><stop offset="1" stop-color="#22D3EE"/></linearGradient></defs>`;
  const arrow = svg(`<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">${G}<path d="M3 2 L3 20 L8 15.5 L11.5 23 L15 21.4 L11.6 14.2 L18 14 Z" fill="#0B0B12" stroke="url(#g)" stroke-width="2" stroke-linejoin="round"/><circle cx="20.5" cy="20.5" r="2.6" fill="url(#g)"/></svg>`);
  const hand = svg(`<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">${G}<path d="M3 2 L3 20 L8 15.5 L11.5 23 L15 21.4 L11.6 14.2 L18 14 Z" fill="url(#g)" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>`);
  const grab = svg(`<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">${G}<circle cx="13" cy="13" r="8" fill="#0B0B12" stroke="url(#g)" stroke-width="2.2"/><path d="M13 8v10M8 13h10" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>`);
  const st = document.createElement("style");
  st.textContent = `html,body{cursor:${arrow} 3 2,auto}
a,button,[role=button],[role=tab],summary,label,select,.sw,.chip,[data-nav],[data-tab],[draggable=true]{cursor:${hand} 3 2,pointer}
input,textarea,[contenteditable]{cursor:text}
[draggable=true]:active,.dragging,.dragging *{cursor:${grab} 13 13,grabbing}
:disabled{cursor:${arrow} 3 2,not-allowed}`;
  (document.head || document.documentElement).append(st);
  const on = () => { st.disabled = K.LS.get("lapp.cursor", "") === "system"; };   // needs /ui/kit.js first
  on();
  K.onLook(on);
  window.LAPPCursor = { refresh: on };
})();
