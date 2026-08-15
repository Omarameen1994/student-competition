export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { applyDevDnsWorkaround } = await import("./lib/dev-dns");
  applyDevDnsWorkaround();
}
