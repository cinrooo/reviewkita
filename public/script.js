const tombol = document.getElementById("btn-test");
const status = document.getElementById("status");

tombol.addEventListener("click", async () => {
  status.textContent = "Menghubungi server...";

  try {
    const response = await fetch("/api/health");
    const data = await response.json();
    status.textContent = `Server merespons: ${data.status} (${data.app})`;
  } catch (error) {
    status.textContent = "Gagal menghubungi server.";
  }
});
