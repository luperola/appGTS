// public/main.js
// Popola la select #operator con i nomi da /api/operators

(async function () {
  async function getOperators() {
    const res = await fetch("/api/operators", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`GET /api/operators ${res.status}`);
    const data = await res.json();
    return [...new Set((data || []).filter(Boolean))]; // uniq + pulizia
  }

  function populateSelect(sel, ops) {
    sel.innerHTML = '<option value="">Seleziona operatore…</option>';
    for (const name of ops) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    }
    sel.setAttribute("data-loaded", "1"); // marker utile per debug
  }

  async function init() {
    // target principale: #operator (fallback se serve)
    const sel =
      document.getElementById("operator") ||
      document.getElementById("operatori") ||
      document.getElementById("operatorSelect") ||
      document.querySelector("[data-operators]");

    if (!sel) return;

    try {
      const ops = await getOperators();
      populateSelect(sel, ops);
    } catch (err) {
      console.error("[operators] errore:", err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
