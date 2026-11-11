// Sign-in state, remembered in this browser (localStorage "lapp:session").
// Guest entry, or an e-mail account (account.js). A provider (e.g. Google) can plug in later:
//   Auth.register("google", { label: "Google", icon: "<svg…>", signIn: async () => ({ id, name, email, photo, token }) })
// and the welcome screen shows a button for every registered provider.
(() => {
  const KEY = "lapp:session";
  const read = () => K.LS.get(KEY, null) || null;
  const write = s => s ? K.LS.set(KEY, s) : K.LS.del(KEY);
  const changes = K.events(), emit = () => changes.emit("change", read());
  window.Auth = {
    providers: {},
    // add a sign-in method; its button then shows on the welcome screen, profile and home banner
    register(key, provider) { this.providers[key] = provider; this.onProviders?.(); },
    get session() { return read(); },
    get signedIn() { return !!read(); },
    get isGuest() { return read()?.type === "guest"; },
    // an account session from account.js (the real proof is the HttpOnly cookie)
    setSession(s) { const before = JSON.stringify(read()); write(s); if (JSON.stringify(s) !== before) emit(); },
    signInGuest(name = "") {
      write({ type: "guest", name: name.trim(), since: new Date().toISOString().slice(0, 10) });
      emit();
    },
    async signIn(provider) {
      const p = this.providers[provider]; if (!p) throw new Error("no provider " + provider);
      const user = await p.signIn();
      write({ type: provider, ...user, since: new Date().toISOString().slice(0, 10) });
      emit();
    },
    // progress stays in this browser; only the sign-in is forgotten
    signOut() { write(null); emit(); },
    onChange(f) { return changes.on("change", f); }
  };
})();
