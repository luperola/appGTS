// public/main.js
async function loadOperators() {
  // prova più selettori per essere tolleranti
  const sel =
    document.getElementById("operatori") ||
    document.getElementById("operatorSelect") ||
    document.querySelector("[data-operators]");
  if (!sel) {
    console.warn(
      '[loadOperators] select non trovata (id="operatori" o simili)'
    );
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

// ricarica quando il DOM è pronto
document.addEventListener("DOMContentLoaded", loadOperators);

// (facoltativo) ricarica la lista quando la tendina riceve focus
document.addEventListener("focusin", (e) => {
  const sel =
    document.getElementById("operatori") ||
    document.querySelector("[data-operators]");
  if (sel && e.target === sel) loadOperators();
});
