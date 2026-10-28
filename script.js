(() => {
  const onReady = callback => document.addEventListener("DOMContentLoaded", callback);
  const allOfferCards = () => [...document.querySelectorAll("#offers-list .offer-card, #live-offers .offer-card")];
  const updateOfferFilters = () => {
    const filters = document.getElementById("offer-filters");
    if (!filters) return;
    const keyword = document.getElementById("keyword").value.trim().toLocaleLowerCase("fr");
    const city = document.getElementById("city-filter").value.toLocaleLowerCase("fr");
    const specialty = document.getElementById("specialty-filter").value.toLocaleLowerCase("fr");
    const skill = document.getElementById("skill-filter").value.toLocaleLowerCase("fr");
    let visible = 0;
    allOfferCards().forEach(card => {
      const text = card.textContent.toLocaleLowerCase("fr");
      const cardCity = (card.dataset.city || "").toLocaleLowerCase("fr");
      const cardSpecialty = (card.dataset.specialty || "").toLocaleLowerCase("fr");
      const cardSkills = (card.dataset.skills || "").toLocaleLowerCase("fr");
      const shown = (!keyword || text.includes(keyword)) &&
        (!city || cardCity === city) &&
        (!specialty || cardSpecialty === specialty) &&
        (!skill || cardSkills.includes(skill));
      card.hidden = !shown;
      if (shown) visible++;
    });
    const count = document.getElementById("result-count");
    if (count) count.textContent = `${visible} offre${visible === 1 ? "" : "s"} affichée${visible === 1 ? "" : "s"}`;
  };

  onReady(() => {
    const year = document.getElementById("year");
    if (year) year.textContent = new Date().getFullYear();

    const menuButton = document.querySelector(".menu-toggle");
    const nav = document.querySelector(".nav-links");
    if (menuButton && nav) {
      menuButton.addEventListener("click", () => {
        const opened = nav.classList.toggle("open");
        menuButton.setAttribute("aria-expanded", String(opened));
        menuButton.setAttribute("aria-label", opened ? "Fermer le menu" : "Ouvrir le menu");
      });
    }

    const filters = document.getElementById("offer-filters");
    if (filters) {
      filters.addEventListener("input", updateOfferFilters);
      filters.addEventListener("change", updateOfferFilters);
      filters.addEventListener("reset", () => setTimeout(updateOfferFilters, 0));
      updateOfferFilters();
    }

    const contactForm = document.getElementById("contact-form");
    if (contactForm) contactForm.addEventListener("submit", event => {
      event.preventDefault();
      const message = contactForm.querySelector(".form-message");
      if (message) message.style.display = "block";
    });

    const demoApply = document.getElementById("apply-demo");
    if (demoApply) demoApply.addEventListener("click", () => {
      demoApply.textContent = "Candidature simulée";
      demoApply.disabled = true;
    });

    const liveOffers = document.getElementById("live-offers");
    if (liveOffers && window.StageMatchShop) {
      const status = document.getElementById("live-offers-status");
      (async () => {
        try {
          const offers = await window.StageMatchShop.offers();
          liveOffers.replaceChildren();
          if (!offers.length) {
            status.textContent = "Aucune offre publiée pour le moment. Les exemples fictifs restent disponibles plus bas.";
            return;
          }
          status.textContent = `${offers.length} offre${offers.length === 1 ? "" : "s"} publiée${offers.length === 1 ? "" : "s"} dans le catalogue.`;
          offers.forEach(offer => {
            const card = document.createElement("article");
            card.className = "offer-card";
            card.dataset.city = offer.city || "";
            card.dataset.specialty = offer.specialty || "";
            card.dataset.skills = Array.isArray(offer.skills) ? offer.skills.join(" ") : "";

            const title = document.createElement("h3");
            title.textContent = offer.title;
            const info = document.createElement("p");
            info.className = "muted";
            info.textContent = [offer.company_name, offer.city, offer.period, offer.duration].filter(Boolean).join(" · ");
            const description = document.createElement("p");
            description.textContent = offer.description;
            const skillList = document.createElement("div");
            skillList.className = "skill-list";
            (Array.isArray(offer.skills) ? offer.skills : []).forEach(skillName => {
              const chip = document.createElement("span");
              chip.className = "chip";
              chip.textContent = skillName;
              skillList.append(chip);
            });
            const link = document.createElement("a");
            link.className = "button button-primary";
            link.href = `candidater.html?offer=${encodeURIComponent(offer.id)}`;
            link.textContent = "Postuler";
            card.append(title, info, description, skillList, link);
            liveOffers.append(card);
          });
          updateOfferFilters();
        } catch (error) {
          status.textContent = error.message || "Offres en ligne indisponibles. Vérifiez la configuration et les droits de lecture Supabase.";
        }
      })();
    }
  });

  const updatePhotoParallax = () => {
    if (!document.body) return;
    const distance = Math.min(window.scrollY * 0.12, 700);
    document.body.style.setProperty("--page-photo-offset", `${-distance}px`);
  };
  updatePhotoParallax();
  window.addEventListener("scroll", updatePhotoParallax, { passive: true });
  window.addEventListener("resize", updatePhotoParallax, { passive: true });

  onReady(() => {
    let photo = document.querySelector("body > .site-background-image");
    if (!photo) {
      photo = document.createElement("img");
      photo.className = "site-background-image";
      photo.src = "images/office-background.jpg";
      photo.alt = "";
      photo.setAttribute("aria-hidden", "true");
      document.body.prepend(photo);
    }
    let pointerX = 0;
    let pointerY = 0;
    window.addEventListener("mousemove", event => {
      pointerX = (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 18;
      pointerY = (event.clientY / Math.max(window.innerHeight, 1) - 0.5) * 12;
    }, { passive: true });
    const animatePhoto = time => {
      const scrollShift = Math.min(window.scrollY * 0.12, 700);
      const driftX = Math.sin(time / 2800) * 8 + pointerX;
      const driftY = Math.cos(time / 2400) * 9 + pointerY;
      photo.style.transform = `translate3d(${driftX}px, ${-scrollShift + driftY}px, 0)`;
      requestAnimationFrame(animatePhoto);
    };
    requestAnimationFrame(animatePhoto);
  });
})();
