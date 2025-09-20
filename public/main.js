// public/main.js
async function loadOperators() {
  const sel =
    document.getElementById("operatori") ||
    document.getElementById("operatorSelect") ||
    document.querySelector("[data-operators]");

  if (!sel) {
    console.warn('[loadOperators] select non trovata (id="operatori")');
    return;
  }

  try {
    const res = await fetch("/api/operators", { cache: "no-store" });
    if (!res.ok) throw new Error(`GET /api/operators ${res.status}`);
    const ops = await res.json();
    console.log("[loadOperators] operators:", ops);

    sel.innerHTML = '<option value="">Seleziona operatore…</option>';
    for (const name of ops) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    }
  } catch (err) {
    console.error("[loadOperators] errore:", err);
  }
}

// con defer il DOM è già pronto
loadOperators();

// ricarica su focus (comodo se gli operatori cambiano)
document.addEventListener("focusin", (e) => {
  const sel =
    document.getElementById("operatori") ||
    document.getElementById("operatorSelect");
  if (sel && e.target === sel) loadOperators();
});
