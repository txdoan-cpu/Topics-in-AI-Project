(function startOnlineSetupPage() {
  const form = document.getElementById("onlineSetupForm");
  const roomNameInput = document.getElementById("roomNameInput");
  const roomSummary = document.getElementById("roomSummary");
  const feedback = document.getElementById("onlineSetupFeedback");

  if (!form) return;

  const existingSession = window.ChessApp.auth?.readSession?.();
  if (!existingSession?.token) {
    window.location.replace("/?auth=required");
    return;
  }

  function setFeedback(message) {
    if (!feedback) return;
    feedback.textContent = message;
  }

  function updateSummary() {
    if (!roomSummary) return;
    const roomName = String(roomNameInput?.value || "").trim();
    roomSummary.textContent = roomName || "Waiting for name";
  }

  roomNameInput?.addEventListener("input", () => {
    setFeedback("");
    updateSummary();
  });

  updateSummary();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const roomName = String(formData.get("roomName") || "").trim().replace(/\s+/g, " ");

    if (!roomName) {
      setFeedback("Room Name is required.");
      roomNameInput?.focus();
      return;
    }

    const time = String(formData.get("time") || "10");
    const theme = String(formData.get("theme") || "classic");
    const pieceModel = String(formData.get("pieceModel") || "standard");
    const sound = formData.get("sound") === "on" ? "on" : "off";
    const params = new URLSearchParams({
      mode: "online",
      create: "1",
      roomName,
      time,
      theme,
      pieceModel,
      sound
    });

    window.location.assign(`/play?${params.toString()}`);
  });
})();
