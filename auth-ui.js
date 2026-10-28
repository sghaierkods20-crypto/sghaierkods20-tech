document.addEventListener("DOMContentLoaded", () => {
  const showMessage = (target, text) => {
    if (!target) return;
    const element = target.matches(".form-message") ? target : target.querySelector(".form-message");
    if (element) {
      element.textContent = text;
      element.style.display = "block";
    }
  };
  const field = (form, name) => form.elements.namedItem(name);
  const safeReturn = () => {
    const requested = new URLSearchParams(location.search).get("return");
    if (!requested || !["http:", "https:"].includes(location.protocol)) return "compte.html";
    try {
      const target = new URL(requested, location.href);
      if (target.origin === location.origin && target.protocol === location.protocol) return target.href;
    } catch (_) {}
    return new URL("compte.html", location.href).href;
  };
  const goToLogin = () => {
    const login = new URL("login.html", location.href);
    login.searchParams.set("return", location.href);
    location.replace(login.href);
  };

  const signup = document.getElementById("signup-form");
  if (signup) signup.addEventListener("submit", async event => {
    event.preventDefault();
    const button = signup.querySelector("button[type=submit]") || signup.querySelector("button");
    button.disabled = true;
    try {
      const first = field(signup, "first").value.trim();
      const last = field(signup, "last").value.trim();
      const email = field(signup, "email").value.trim();
      const password = field(signup, "password").value;
      if (password !== field(signup, "confirm").value) throw new Error("Les mots de passe ne correspondent pas.");
      const { data, error } = await StageMatchShop.signUp(email, password, first, last);
      if (error) throw error;
      showMessage(signup, data.session
        ? "Compte créé et connecté. Vous pouvez continuer."
        : "Inscription traitée. Vérifiez votre boîte e-mail et les courriers indésirables pour le lien de confirmation. Si aucun message n’arrive, vérifiez les réglages Auth et e-mail du projet Supabase.");
    } catch (error) {
      showMessage(signup, error.message || "L’inscription a échoué. Réessayez.");
    } finally {
      button.disabled = false;
    }
  });

  const login = document.getElementById("login-form");
  if (login) login.addEventListener("submit", async event => {
    event.preventDefault();
    const button = login.querySelector("button[type=submit]") || login.querySelector("button");
    button.disabled = true;
    try {
      const { error } = await StageMatchShop.signIn(field(login, "email").value, field(login, "password").value);
      if (error) throw error;
      location.replace(safeReturn());
    } catch (error) {
      showMessage(login, error.message || "Connexion impossible. Vérifiez vos identifiants et la confirmation de l’e-mail.");
    } finally {
      button.disabled = false;
    }
  });

  const verificationStatus = document.getElementById("verification-status");
  if (verificationStatus) (async () => {
    const params = new URLSearchParams(`${location.search}&${location.hash.replace(/^#/, "")}`);
    const callbackError = params.get("error_description") || params.get("error");
    if (callbackError) {
      verificationStatus.textContent = "Le lien de confirmation a expiré ou n’est plus valide. Retournez à l’inscription pour demander un nouveau lien.";
      return;
    }
    try {
      const session = await StageMatchShop.session();
      verificationStatus.textContent = session
        ? "Adresse e-mail confirmée. Votre compte est activé; vous pouvez vous connecter."
        : "Le lien a été ouvert. Connectez-vous si votre e-mail a été confirmé. Si le lien a expiré, demandez-en un nouveau depuis l’inscription.";
    } catch (error) {
      verificationStatus.textContent = error.message || "Impossible de vérifier la confirmation. Réessayez depuis le lien reçu par e-mail.";
    }
  })();

  const accountStatus = document.getElementById("account-status");
  if (accountStatus) (async () => {
    try {
      const user = await StageMatchShop.user();
      if (!user) { location.replace("login.html?return=compte.html"); return; }
      const profile = await StageMatchShop.profile();
      accountStatus.textContent = `Bonjour ${profile.first_name} ${profile.last_name} · ${profile.role} · 100 candidatures récentes maximum.`;
      const rows = await StageMatchShop.myApplications();
      const host = document.getElementById("applications");
      if (!rows.length) { host.textContent = "Aucune candidature pour le moment."; return; }
      const list = document.createElement("ul");
      rows.forEach(application => {
        const item = document.createElement("li");
        item.textContent = `${application.offers?.title || "Offre"} · ${application.offers?.company_name || ""} · ${application.status} · ${new Date(application.created_at).toLocaleDateString("fr-FR")}`;
        list.append(item);
      });
      host.replaceChildren(list);
    } catch (error) {
      accountStatus.textContent = error.message || "Impossible de charger votre compte.";
    }
  })();

  const logout = document.getElementById("logout");
  if (logout) logout.addEventListener("click", async () => {
    logout.disabled = true;
    try { await StageMatchShop.signOut(); location.replace("index.html"); }
    catch (error) {
      const status = document.getElementById("account-status");
      if (status) status.textContent = error.message || "La déconnexion a échoué.";
      logout.disabled = false;
    }
  });

  const applyButton = document.getElementById("apply-live");
  if (applyButton) {
    const offerId = new URLSearchParams(location.search).get("offer");
    const offerTitle = document.getElementById("offer-title");
    const message = document.getElementById("apply-message");
    (async () => {
      try {
        if (!offerId) throw new Error("Identifiant d’offre manquant. Revenez au catalogue et choisissez une offre publiée.");
        const offer = await StageMatchShop.offer(offerId);
        if (offerTitle) offerTitle.textContent = `${offer.title} · ${offer.company_name} · ${offer.city}`;
      } catch (error) {
        message.textContent = error.message || "Cette offre n’est pas disponible.";
        applyButton.disabled = true;
      }
    })();
    applyButton.addEventListener("click", async () => {
      applyButton.disabled = true;
      try {
        const user = await StageMatchShop.user();
        if (!user) { goToLogin(); return; }
        const profile = await StageMatchShop.profile();
        if (profile.role !== "student") throw new Error("Seuls les comptes étudiants peuvent candidater.");
        await StageMatchShop.apply(offerId, document.getElementById("cover-letter").value);
        message.textContent = "Candidature envoyée.";
      } catch (error) {
        message.textContent = error.message || "La candidature n’a pas pu être envoyée.";
        applyButton.disabled = false;
      }
    });
  }

  const employerPage = document.getElementById("employer-page");
  if (employerPage) (async () => {
    const status = document.getElementById("employer-status");
    try {
      const user = await StageMatchShop.user();
      if (!user) { goToLogin(); return; }
      const profile = await StageMatchShop.profile();
      if (!["employer", "admin"].includes(profile.role)) {
        throw new Error("Accès réservé aux entreprises. Demandez à l’administrateur du projet d’attribuer le rôle entreprise.");
      }
      status.textContent = `Connecté : ${profile.first_name} ${profile.last_name}`;
      const form = document.getElementById("offer-form");
      form.addEventListener("submit", async event => {
        event.preventDefault();
        const button = form.querySelector("button[type=submit]") || form.querySelector("button");
        button.disabled = true;
        try {
          await StageMatchShop.addOffer({
            title: field(form, "title").value.trim(),
            company_name: field(form, "company_name").value.trim(),
            city: field(form, "city").value.trim(),
            specialty: field(form, "specialty").value.trim(),
            description: field(form, "description").value.trim(),
            skills: field(form, "skills").value.split(",").map(skill => skill.trim()).filter(Boolean),
            period: field(form, "period").value.trim(),
            duration: field(form, "duration").value.trim(),
            is_published: field(form, "is_published").checked
          });
          form.reset();
          status.textContent = "Offre enregistrée. Elle apparaît dans le catalogue si la case Publier est cochée.";
        } catch (error) {
          status.textContent = error.message || "L’offre n’a pas pu être enregistrée.";
        } finally {
          button.disabled = false;
        }
      });

      const host = document.getElementById("employer-applications");
      const applications = await StageMatchShop.companyApps();
      const mine = applications.filter(application => application.offers?.owner_id === user.id);
      if (!mine.length) { host.textContent = "Aucune candidature reçue pour vos offres."; return; }
      mine.forEach(application => {
        const row = document.createElement("article");
        row.className = "card";
        const label = document.createElement("p");
        label.textContent = `${application.offers.title} · ${application.profiles?.first_name || ""} ${application.profiles?.last_name || ""} · ${application.cover_letter || "Sans lettre"}`;
        const select = document.createElement("select");
        select.setAttribute("aria-label", `Statut de la candidature pour ${application.offers.title}`);
        [["new", "Nouvelle"], ["reviewing", "En cours"], ["accepted", "Acceptée"], ["rejected", "Refusée"]].forEach(([value, text]) => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = text;
          option.selected = application.status === value;
          select.append(option);
        });
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Enregistrer";
        button.addEventListener("click", async () => {
          button.disabled = true;
          try {
            await StageMatchShop.setStatus(application.id, select.value);
            button.textContent = "Enregistré";
            application.status = select.value;
          } catch (error) {
            button.textContent = error.message || "Erreur";
          } finally {
            button.disabled = false;
          }
        });
        row.append(label, select, button);
        host.append(row);
      });
    } catch (error) {
      status.textContent = error.message || "Impossible de charger l’espace entreprise.";
    }
  })();
  const navigation = document.querySelector(".nav-links");
  if (navigation && !navigation.querySelector('a[href="admin.html"]')) {
    StageMatchShop.profile().then(profile => {
      if (profile?.role === "admin") {
        const link = document.createElement("a");
        link.href = "admin.html";
        link.textContent = "Administration";
        navigation.append(link);
      }
    }).catch(() => {});
  }

  const adminPage = document.getElementById("admin-page");
  if (adminPage) (async () => {
    const status = document.getElementById("admin-status");
    const offerHost = document.getElementById("admin-offers");
    const applicationHost = document.getElementById("admin-applications");
    const applicationFilter = document.getElementById("admin-status-filter");
    const count = document.getElementById("admin-applications-count");
    const form = document.getElementById("admin-offer-form");
    const cancelEdit = document.getElementById("admin-offer-cancel");
    let offers = [];
    let applications = [];
    let editingOfferId = null;

    const offerValues = () => ({
      title: field(form, "title").value.trim(),
      company_name: field(form, "company_name").value.trim(),
      city: field(form, "city").value.trim(),
      specialty: field(form, "specialty").value.trim(),
      description: field(form, "description").value.trim(),
      skills: field(form, "skills").value.split(",").map(skill => skill.trim()).filter(Boolean),
      period: field(form, "period").value.trim(),
      duration: field(form, "duration").value.trim(),
      is_published: field(form, "is_published").checked
    });
    const resetOfferForm = () => {
      editingOfferId = null;
      form.reset();
      field(form, "offer_id").value = "";
      form.querySelector("button[type=submit]").textContent = "Ajouter l’offre";
      cancelEdit.hidden = true;
    };
    const renderOffers = () => {
      offerHost.replaceChildren();
      if (!offers.length) { offerHost.textContent = "Aucune offre enregistrée."; return; }
      offers.forEach(offer => {
        const card = document.createElement("article");
        card.className = "offer-card";
        const title = document.createElement("h3");
        title.textContent = offer.title;
        const detail = document.createElement("p");
        detail.className = "muted";
        detail.textContent = `${offer.company_name} · ${offer.city} · ${offer.is_published ? "Publiée" : "Non publiée"}`;
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "button button-secondary";
        edit.textContent = "Modifier";
        edit.addEventListener("click", () => {
          editingOfferId = offer.id;
          field(form, "offer_id").value = offer.id;
          Object.entries({
            title: offer.title, company_name: offer.company_name, city: offer.city,
            specialty: offer.specialty, description: offer.description,
            skills: (offer.skills || []).join(", "), period: offer.period, duration: offer.duration
          }).forEach(([name, value]) => { field(form, name).value = value || ""; });
          field(form, "is_published").checked = offer.is_published;
          form.querySelector("button[type=submit]").textContent = "Enregistrer les changements";
          cancelEdit.hidden = false;
          form.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        const publish = document.createElement("button");
        publish.type = "button";
        publish.className = "button button-secondary";
        publish.textContent = offer.is_published ? "Retirer du catalogue" : "Publier";
        publish.addEventListener("click", async () => {
          publish.disabled = true;
          try {
            const updated = await StageMatchShop.updateOffer(offer.id, { is_published: !offer.is_published });
            offers = offers.map(item => item.id === updated.id ? { ...item, ...updated } : item);
            renderOffers();
          } catch (error) {
            status.textContent = error.message || "Impossible de modifier la publication.";
            publish.disabled = false;
          }
        });
        card.append(title, detail, edit, publish);
        offerHost.append(card);
      });
    };
    const renderApplications = () => {
      const filter = applicationFilter.value;
      const visible = applications.filter(item => filter === "all" || item.status === filter);
      count.textContent = `${visible.length} affichée(s) · ${applications.length} candidature(s) récente(s) chargée(s), maximum 100.`;
      applicationHost.replaceChildren();
      if (!visible.length) { applicationHost.textContent = "Aucune candidature pour ce filtre."; return; }
      visible.forEach(application => {
        const card = document.createElement("article");
        card.className = "offer-card";
        const title = document.createElement("h3");
        title.textContent = application.offers.title;
        const details = document.createElement("p");
        details.className = "muted";
        details.textContent = `${application.profiles?.first_name || ""} ${application.profiles?.last_name || ""} · ${application.offers.company_name} · ${new Date(application.created_at).toLocaleDateString("fr-FR")}`;
        const letter = document.createElement("p");
        letter.textContent = application.cover_letter || "Sans lettre de motivation.";
        const select = document.createElement("select");
        select.setAttribute("aria-label", `Statut de la candidature pour ${application.offers.title}`);
        [["new", "Nouvelle"], ["reviewing", "En cours"], ["accepted", "Acceptée"], ["rejected", "Refusée"]].forEach(([value, label]) => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = label;
          option.selected = application.status === value;
          select.append(option);
        });
        const save = document.createElement("button");
        save.type = "button";
        save.className = "button button-secondary";
        save.textContent = "Enregistrer le statut";
        save.addEventListener("click", async () => {
          save.disabled = true;
          try {
            await StageMatchShop.setStatus(application.id, select.value);
            application.status = select.value;
            save.textContent = "Enregistré";
            renderApplications();
          } catch (error) {
            save.textContent = error.message || "Erreur";
            save.disabled = false;
          }
        });
        card.append(title, details, letter, select, save);
        applicationHost.append(card);
      });
    };

    try {
      const user = await StageMatchShop.user();
      if (!user) { goToLogin(); return; }
      const profile = await StageMatchShop.profile();
      if (profile.role !== "admin") throw new Error("Accès réservé à l’administrateur du projet.");
      status.textContent = `Connecté : ${profile.first_name} ${profile.last_name} · administrateur`;
      offers = await StageMatchShop.adminOffers();
      applications = await StageMatchShop.adminApplications();
      renderOffers();
      renderApplications();

      form.addEventListener("submit", async event => {
        event.preventDefault();
        const button = form.querySelector("button[type=submit]");
        button.disabled = true;
        try {
          if (editingOfferId) {
            await StageMatchShop.updateOffer(editingOfferId, offerValues());
            status.textContent = "Offre mise à jour.";
          } else {
            await StageMatchShop.addOffer(offerValues());
            status.textContent = "Offre ajoutée.";
          }
          offers = await StageMatchShop.adminOffers();
          renderOffers();
          resetOfferForm();
        } catch (error) {
          status.textContent = error.message || "L’offre n’a pas pu être enregistrée.";
        } finally {
          button.disabled = false;
        }
      });
      cancelEdit.addEventListener("click", resetOfferForm);
      applicationFilter.addEventListener("change", renderApplications);
    } catch (error) {
      status.textContent = error.message || "Impossible de charger l’administration.";
      form.hidden = true;
      offerHost.hidden = true;
      applicationHost.hidden = true;
      applicationFilter.hidden = true;
    }
  })();
});
