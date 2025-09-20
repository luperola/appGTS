async function loadOperators() {
  const sel = document.getElementById("operatori");
  if (!sel) return; // questa pagina non ha la select, esci senza errori

  try {
    const res = await fetch("/api/operators", { cache: "no-store" });
    if (!res.ok) throw new Error("fetch /api/operators failed");
    const ops = await res.json(); // es. ["Mario Rossi", ...]

    sel.innerHTML = '<option value="">Seleziona operatore…</option>';
    for (const name of ops) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    }
  } catch (e) {
    console.error(e);
  }
}

// con 'defer' il DOM è già pronto, quindi possiamo chiamarla subito
loadOperators();

document.addEventListener("DOMContentLoaded", loadOperators);

// richiama al caricamento pagina
document.addEventListener("DOMContentLoaded", loadOperators);

function ymdToDmy(ymd) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-");
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}
function setTodayMaxDate(inputId) {
  const el = document.getElementById(inputId);
  if (!el) return;
  const t = new Date();
  const yyyy = t.getFullYear();
  const mm = String(t.getMonth() + 1).padStart(2, "0");
  const dd = String(t.getDate()).padStart(2, "0");
  el.max = `${yyyy}-${mm}-${dd}`;
}

document.addEventListener("DOMContentLoaded", () => {
  loadOperators();
  setTodayMaxDate("data");

  const form = document.getElementById("entryForm");
  const msg = document.getElementById("msg");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      operator: document.getElementById("operator").value.trim(),
      macchina: document.getElementById("macchina").value.trim(),
      linea: document.getElementById("linea").value.trim(),
      ore: document.getElementById("ore").value.trim(),
      data: ymdToDmy(document.getElementById("data").value.trim()),
      descrizione: document.getElementById("descrizione").value.trim(),
    };
    const res = await fetch("/api/entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const out = await res.json();
    if (res.ok) {
      msg.innerHTML =
        '<div class="alert alert-success">Registrazione salvata.</div>';
      form.reset();
      setTodayMaxDate("data");
    } else {
      msg.innerHTML = `<div class="alert alert-danger">${
        out.error || "Errore"
      }</div>`;
    }
  });
});
