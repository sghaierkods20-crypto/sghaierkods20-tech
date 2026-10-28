window.StageMatchConfig = {
  url: "https://ueohgrgehexzkorkyjsq.supabase.co",
  publishableKey: "sb_publishable_NR1UPq1l40elkUuZg54AQA_nsgidY2A"
};

(() => {
  const fail = message => { window.stageMatchConfigError = message; };
  if (!["http:", "https:"].includes(location.protocol)) {
    fail("Ouvrez StageMatch avec une adresse HTTP/HTTPS. Le fichier file:// ne peut pas recevoir le retour de confirmation Supabase.");
    return;
  }
  if (!window.StageMatchConfig.url || !window.StageMatchConfig.publishableKey ||
      window.StageMatchConfig.url.includes("VOTRE-PROJET") ||
      window.StageMatchConfig.publishableKey.includes("VOTRE-PUBLISHABLE-KEY")) {
    fail("Configurez l’URL Supabase et la publishable key dans supabase-client.js.");
    return;
  }
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    fail("La bibliothèque Supabase n’a pas pu être chargée. Vérifiez votre connexion Internet.");
    return;
  }
  if (!window.stageMatchClient) {
    window.stageMatchClient = window.supabase.createClient(
      window.StageMatchConfig.url,
      window.StageMatchConfig.publishableKey,
      { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } }
    );
  }
})();
