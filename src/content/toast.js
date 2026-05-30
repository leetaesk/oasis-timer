// ── 토스트 ────────────────────────────────────────────

function showToast(message) {
    const existing = document.getElementById("oasis-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "oasis-toast";
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => toast.classList.add("oasis-toast-visible"));
    });

    setTimeout(() => {
        toast.classList.remove("oasis-toast-visible");
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}
