(() => {
  const db = () => {
    if (window.stageMatchConfigError) throw new Error(window.stageMatchConfigError);
    if (!window.stageMatchClient) throw new Error("Supabase n’est pas prêt. Vérifiez supabase-client.js et rechargez la page.");
    return window.stageMatchClient;
  };
  const assertWebUrl = () => {
    if (!["http:", "https:"].includes(location.protocol)) {
      throw new Error("Ouvrez le site avec une adresse HTTP/HTTPS. Un fichier file:// ne peut pas confirmer l’adresse e-mail.");
    }
    return new URL("verification.html", location.href).href;
  };
  const failOnError = error => { if (error) throw error; };
  const allApplications = async () => {
    const { data, error } = await db().from("applications")
      .select("id,student_id,status,cover_letter,created_at,offers!inner(id,title,company_name,owner_id)")
      .order("created_at", { ascending: false }).limit(100);
    failOnError(error);
    const applications = data || [];
    const studentIds = [...new Set(applications.map(item => item.student_id))];
    if (!studentIds.length) return [];
    const { data: profiles, error: profileError } = await db().from("profiles")
      .select("id,first_name,last_name").in("id", studentIds);
    failOnError(profileError);
    const profileById = new Map((profiles || []).map(profile => [profile.id, profile]));
    return applications.map(item => ({ ...item, profiles: profileById.get(item.student_id) || null }));
  };

  window.StageMatchShop = {
    async signUp(email, password, first, last) {
      return db().auth.signUp({
        email: email.trim(), password,
        options: { emailRedirectTo: assertWebUrl(), data: { first_name: first.trim(), last_name: last.trim() } }
      });
    },
    async signIn(email, password) {
      return db().auth.signInWithPassword({ email: email.trim(), password });
    },
    async signOut() {
      const { error } = await db().auth.signOut();
      failOnError(error);
    },
    async session() {
      const { data, error } = await db().auth.getSession();
      failOnError(error);
      return data.session;
    },
    async user() {
      if (!await this.session()) return null;
      const { data, error } = await db().auth.getUser();
      failOnError(error);
      return data.user || null;
    },
    async profile() {
      const user = await this.user();
      if (!user) return null;
      const { data, error } = await db().from("profiles")
        .select("id,first_name,last_name,role,created_at")
        .eq("id", user.id).maybeSingle();
      failOnError(error);
      if (!data) throw new Error("Le profil Supabase est introuvable. Vérifiez le déclencheur handle_new_user.");
      return data;
    },
    async offers() {
      const { data, error } = await db().from("offers")
        .select("id,title,company_name,city,specialty,description,skills,period,duration,created_at")
        .eq("is_published", true).order("created_at", { ascending: false });
      failOnError(error);
      return data || [];
    },
    async offer(id) {
      if (!id) throw new Error("Identifiant d’offre manquant.");
      const { data, error } = await db().from("offers")
        .select("id,title,company_name,city,specialty,description,skills,period,duration,created_at")
        .eq("id", id).eq("is_published", true).maybeSingle();
      failOnError(error);
      if (!data) throw new Error("Cette offre n’existe plus ou n’est plus publiée.");
      return data;
    },
    async apply(offerId, coverLetter) {
      const user = await this.user();
      if (!user) throw new Error("Connectez-vous avec un compte étudiant pour candidater.");
      const { error } = await db().from("applications").insert({
        offer_id: offerId, student_id: user.id, cover_letter: coverLetter.trim() || null
      });
      failOnError(error);
    },
    async myApplications() {
      const { data, error } = await db().from("applications")
        .select("id,status,created_at,offers(title,company_name,city)")
        .order("created_at", { ascending: false }).limit(100);
      failOnError(error);
      return data || [];
    },
    async addOffer(offer) {
      const user = await this.user();
      if (!user) throw new Error("Connectez-vous avant de publier une offre.");
      const profile = await this.profile();
      if (!profile || !["employer", "admin"].includes(profile.role)) {
        throw new Error("Seuls les comptes entreprise autorisés peuvent publier des offres.");
      }
      const { data, error } = await db().from("offers")
        .insert({ ...offer, owner_id: user.id })
        .select("id,title,company_name,city,specialty,description,skills,period,duration,is_published,created_at")
        .single();
      failOnError(error);
      return data;
    },
    async updateOffer(id, values) {
      const { data, error } = await db().from("offers")
        .update(values).eq("id", id)
        .select("id,title,company_name,city,specialty,description,skills,period,duration,is_published,created_at")
        .maybeSingle();
      failOnError(error);
      if (!data) throw new Error("Offre introuvable ou accès refusé.");
      return data;
    },
    async adminOffers() {
      const profile = await this.profile();
      if (!profile || profile.role !== "admin") throw new Error("Accès réservé à l’administrateur.");
      const { data, error } = await db().from("offers")
        .select("id,owner_id,title,company_name,city,specialty,description,skills,period,duration,is_published,created_at")
        .order("created_at", { ascending: false }).limit(100);
      failOnError(error);
      return data || [];
    },
    async adminApplications() {
      const profile = await this.profile();
      if (!profile || profile.role !== "admin") throw new Error("Accès réservé à l’administrateur.");
      return allApplications();
    },
    async companyApps() {
      return allApplications();
    },
    async setStatus(applicationId, status) {
      if (!["new", "reviewing", "accepted", "rejected"].includes(status)) {
        throw new Error("Statut de candidature invalide.");
      }
      const { data, error } = await db().from("applications")
        .update({ status }).eq("id", applicationId).select("id").maybeSingle();
      failOnError(error);
      if (!data) throw new Error("Candidature introuvable ou accès refusé.");
    }
  };
})();
