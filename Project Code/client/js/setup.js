(function startSetupPage() {
  const form = document.getElementById("aiSetupForm");
  const difficultySelect = document.getElementById("difficultySelect");
  const themeSelect = document.getElementById("themeSelect");
  const pieceModelSelect = document.getElementById("pieceModelSelect");
  const algorithmSummary = document.getElementById("algorithmSummary");
  const depthSummary = document.getElementById("depthSummary");
  if (!form) return;

  const AI_PRESETS = {
    easy: { algorithmLabel: "Greedy evaluation", depth: 1 },
    medium: { algorithmLabel: "Minimax", depth: 2 },
    hard: { algorithmLabel: "Alpha-beta pruning", depth: 3 }
  };

  const existingSession = window.ChessApp.auth?.readSession?.();
  if (!existingSession?.token) {
    window.location.replace("/?auth=required");
    return;
  }

  function updateSummary() {
    const preset = AI_PRESETS[String(difficultySelect?.value || "easy")] || AI_PRESETS.easy;
    if (algorithmSummary) {
      algorithmSummary.textContent = preset.algorithmLabel;
    }
    if (depthSummary) {
      depthSummary.textContent = `${preset.depth} ply`;
    }
  }

  difficultySelect?.addEventListener("change", updateSummary);
  updateSummary();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const difficulty = String(formData.get("difficulty") || "easy");
    const time = String(formData.get("time") || "5");
    const theme = String(formData.get("theme") || "classic");
    const pieceModel = String(formData.get("pieceModel") || "standard");
    const sound = formData.get("sound") === "on" ? "on" : "off";
    const params = new URLSearchParams({
      mode: "ai",
      difficulty,
      time,
      theme,
      pieceModel,
      sound
    });

    window.location.assign(`/play?${params.toString()}`);
  });
})();
