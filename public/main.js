// public/main.js
// Popola la select #operatori e/o il datalist #operatoriList (per l'input #operatoriInput)
// Fonte dati: /api/operators

(async function () {
  async function getOperators() {
    const res = await fetch("/api/operators", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`GET /api/operators ${res.status}`);
    return await res.json(); // es. ["Mario Rossi", "Luca Bianchi", ...]
  }

  const unique = (arr) => [...new Set((arr || []).filter(Boolean))];

  function populateSelect(sel, ops) {
    if (!sel) return;
    sel.innerHTML = '<option value="">Seleziona operatore…</option>';
    for (const name of ops) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    }
  }

  function populateDatalist(dl, ops) {
    if (!dl) return;
    dl.innerHTML = "";
    for (const name of ops) {
      const opt = document.createElement("option");
      opt.value = name; // per datalist basta il value
      dl.appendChild(opt);
    }
  }

  function wireSync(sel, inp) {
    if (!sel || !inp) return;
    // Se scegli dalla select, aggiorna l'input
    sel.addEventListener("change", () => {
      inp.value = sel.value || "";
    });
    // Se scrivi nell'input e c'è una voce uguale, selezionala nella select
    inp.addEventListener("input", () => {
      const val = inp.value;
      const match = Array.from(sel.options).find((o) => o.value === val);
      if (match) sel.value = val;
    });
  }

  async function init() {
    // Tollerante: prova più selettori per compatibilità con le tue pagine
    const sel =
      document.getElementById("operatori") ||
      document.getElementById("operatorSelect") ||
      document.querySelector("[data-operators]");
    const dl =
      document.getElementById("operatoriList") ||
      document.querySelector("datalist[data-operators]");
    const inp =
      document.getElementById("operatoriInput") ||
      document.querySelector('input[list="operatoriList"]') ||
      document.querySelector("input[data-operators]");

    // Se la pagina non ha né select né datalist, non fare nulla
    if (!sel && !dl) {
      return;
    }

    try {
      const ops = unique(await getOperators());
      if (sel) populateSelect(sel, ops);
      if (dl) populateDatalist(dl, ops);
      wireSync(sel, inp);

      // marcatori utili per debug veloce da console
      if (sel) sel.setAttribute("data-loaded", "1");
      if (dl) dl.setAttribute("data-loaded", "1");
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
