document.addEventListener("DOMContentLoaded", () => {
    const addForm = document.getElementById("addForm");
    const linksList = document.getElementById("linksList");
    const personalForm = document.getElementById("personalForm");
    const personalDetails = document.getElementById("personalDetails");
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");
  
    const getFavicon = (url) => {
        try {
            const domain = new URL(url).hostname;
            return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
        } catch {
            return 'default-favicon.jpg'; // You might want to add a default favicon
        }
    };
  
    const loadLinks = () => {
      const links = JSON.parse(localStorage.getItem("socialLinks")) || [];
      linksList.innerHTML = "";
      links.forEach(({ platform, link }, index) => {
        const li = document.createElement("li");
        li.innerHTML = `
          <div class="link-content">
            <img src="${getFavicon(link)}" alt="${platform}" class="favicon">
            <span class="link-text">
              <strong>${platform}</strong>
              <a href="${link}" target="_blank">${link}</a>
            </span>
          </div>
          <div class="button-group">
            <button class="edit" data-index="${index}">Edit</button>
            <button class="copy" data-link="${link}">Copy</button>
          </div>
        `;
        linksList.appendChild(li);
      });
  
      document.querySelectorAll("button.copy").forEach(button => {
        button.addEventListener("click", (event) => {
          const linkToCopy = event.target.dataset.link;
          navigator.clipboard.writeText(linkToCopy).then(() => {
            const originalText = event.target.textContent;
            event.target.textContent = "Copied!";
            setTimeout(() => {
              event.target.textContent = originalText;
            }, 1500);
          });
        });
      });
  
      document.querySelectorAll("button.edit").forEach(button => {
        button.addEventListener("click", (event) => {
          const index = parseInt(event.target.dataset.index);
          const links = JSON.parse(localStorage.getItem("socialLinks")) || [];
          const linkToEdit = links[index];
  
          document.getElementById("platform").value = linkToEdit.platform;
          document.getElementById("link").value = linkToEdit.link;
          
          addForm.dataset.editIndex = index;
          addForm.querySelector("button[type='submit']").textContent = "Update";
        });
      });
    };
  
    const saveLinks = (links) => {
      localStorage.setItem("socialLinks", JSON.stringify(links));
    };
  
    addForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const platform = document.getElementById("platform").value;
      const link = document.getElementById("link").value;
  
      const links = JSON.parse(localStorage.getItem("socialLinks")) || [];
      
      if (addForm.dataset.editIndex !== undefined) {
        const index = parseInt(addForm.dataset.editIndex);
        links[index] = { platform, link };
        delete addForm.dataset.editIndex;
        addForm.querySelector("button[type='submit']").textContent = "Add";
      } else {
        links.push({ platform, link });
      }
  
      saveLinks(links);
      loadLinks();
      addForm.reset();
    });
  
    const loadPersonalDetails = () => {
        const details = JSON.parse(localStorage.getItem("personalDetails")) || {};
        personalDetails.innerHTML = "";
        personalForm.style.display = Object.keys(details).length ? "none" : "block";
        
        const fields = [
            { key: "name", label: "Full Name" },
            { key: "phone", label: "Phone Number" },
            { key: "email", label: "Email Address" },
            { key: "Address", label: "Address" },
            { key: "pincode", label: "Pincode" }
        ];

        if (Object.keys(details).length) {
            const detailsContainer = document.createElement("div");
            detailsContainer.className = "details-container";
            
            fields.forEach(({ key, label }) => {
                if (details[key]) {
                    const div = document.createElement("div");
                    div.className = "personal-item";
                    div.innerHTML = `
                        <div class="item-content">
                            <div class="label">${label}</div>
                            <div class="value">${details[key]}</div>
                        </div>
                        <button class="copy" data-value="${details[key]}">Copy</button>
                    `;
                    detailsContainer.appendChild(div);
                }
            });

            // Add edit all button at the top
            const editAllBtn = document.createElement("button");
            editAllBtn.className = "edit-all";
            editAllBtn.textContent = "Edit Details";
            personalDetails.appendChild(editAllBtn);
            personalDetails.appendChild(detailsContainer);

            // Edit all functionality
            editAllBtn.addEventListener("click", () => {
                fields.forEach(({ key }) => {
                    if (details[key]) {
                        document.getElementById(key).value = details[key];
                    }
                });
                personalForm.style.display = "flex";
                personalForm.dataset.editing = "true";
                personalForm.querySelector("button[type='submit']").textContent = "Update";
                editAllBtn.style.display = "none"; // Hide edit all button when editing
            });

            // Copy functionality
            document.querySelectorAll(".personal-item .copy").forEach(button => {
                button.addEventListener("click", (event) => {
                    const valueToCopy = event.target.dataset.value;
                    navigator.clipboard.writeText(valueToCopy).then(() => {
                        const originalText = event.target.textContent;
                        event.target.textContent = "Copied!";
                        setTimeout(() => {
                            event.target.textContent = originalText;
                        }, 1500);
                    });
                });
            });
        }
    };
  
    personalForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const details = {
            name: document.getElementById("name").value,
            phone: document.getElementById("phone").value,
            email: document.getElementById("email").value,
            Address: document.getElementById("Address").value,
            pincode: document.getElementById("pincode").value
        };
        
        localStorage.setItem("personalDetails", JSON.stringify(details));
        delete personalForm.dataset.editing;
        personalForm.querySelector("button[type='submit']").textContent = "Save Details";
        loadPersonalDetails();
        personalForm.reset();
    });
  
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            tabBtns.forEach(b => b.classList.remove("active"));
            tabContents.forEach(c => c.classList.remove("active"));
            
            btn.classList.add("active");
            document.getElementById(btn.dataset.tab + "Section").classList.add("active");
        });
    });
  
    loadLinks();
    loadPersonalDetails();
  
    const cancelEditBtn = document.createElement("button");
    cancelEditBtn.type = "button";
    cancelEditBtn.className = "cancel-edit";
    cancelEditBtn.textContent = "Cancel";
    cancelEditBtn.style.display = "none";
    addForm.appendChild(cancelEditBtn);
  
    cancelEditBtn.addEventListener("click", () => {
      delete addForm.dataset.editIndex;
      addForm.reset();
      addForm.querySelector("button[type='submit']").textContent = "Add";
      cancelEditBtn.style.display = "none";
    });
  
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.attributeName === "data-edit-index") {
          cancelEditBtn.style.display = addForm.dataset.editIndex !== undefined ? "block" : "none";
        }
      });
    });
  
    observer.observe(addForm, { attributes: true });
  
    // Add cancel button for personal details form
    const cancelPersonalEditBtn = document.createElement("button");
    cancelPersonalEditBtn.type = "button";
    cancelPersonalEditBtn.className = "cancel-edit";
    cancelPersonalEditBtn.textContent = "Cancel";
    cancelPersonalEditBtn.style.display = "none";
    personalForm.appendChild(cancelPersonalEditBtn);
  
    cancelPersonalEditBtn.addEventListener("click", () => {
        delete personalForm.dataset.editing;
        personalForm.reset();
        personalForm.style.display = "none";
        personalForm.querySelector("button[type='submit']").textContent = "Save Details";
        document.querySelector(".edit-all").style.display = "block"; // Show edit all button again
    });
  
    // Show/hide cancel button based on edit mode
    const personalFormObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === "attributes" && mutation.attributeName === "data-editing") {
                cancelPersonalEditBtn.style.display = personalForm.dataset.editing ? "block" : "none";
            }
        });
    });
  
    personalFormObserver.observe(personalForm, { attributes: true });
  
    const shareProfileBtn = document.getElementById("shareProfile");
    const profileCardModal = document.getElementById("profileCardModal");
    const closeModalBtn = document.querySelector(".close-modal");
    const copyProfileCardBtn = document.getElementById("copyProfileCard");
    const profileCard = document.getElementById("profileCard");
  
    const generateProfileCard = () => {
        const personalDetails = JSON.parse(localStorage.getItem("personalDetails")) || {};
        const socialLinks = JSON.parse(localStorage.getItem("socialLinks")) || [];
        
        let cardHTML = '';
        
        // Personal Details Section
        if (Object.keys(personalDetails).length > 0) {
            cardHTML += `
                <section class="personal-section">
                    <h4>Personal Details</h4>
                    ${personalDetails.name ? `<div class="detail-item"><strong>Name:</strong> ${personalDetails.name}</div>` : ''}
                    ${personalDetails.phone ? `<div class="detail-item"><strong>Phone:</strong> ${personalDetails.phone}</div>` : ''}
                    ${personalDetails.email ? `<div class="detail-item"><strong>Email:</strong> ${personalDetails.email}</div>` : ''}
                    ${personalDetails.Address ? `<div class="detail-item"><strong>Address:</strong> ${personalDetails.Address}</div>` : ''}
                    ${personalDetails.pincode ? `<div class="detail-item"><strong>Pincode:</strong> ${personalDetails.pincode}</div>` : ''}
                </section>
            `;
        }
        
        // Social Links Section
        if (socialLinks.length > 0) {
            cardHTML += `
                <section class="social-section">
                    <h4>Social Links</h4>
                    ${socialLinks.map(({ platform, link }) => 
                        `<div class="detail-item"><strong>${platform}:</strong> ${link}</div>`
                    ).join('')}
                </section>
            `;
        }
        
        if (!cardHTML) {
            cardHTML = '<p>No profile information available.</p>';
        }
        
        profileCard.innerHTML = cardHTML;
    };
  
    // Show modal with profile card
    shareProfileBtn.addEventListener("click", () => {
        generateProfileCard();
        profileCardModal.style.display = "block";
    });
  
    // Close modal when clicking the close button
    closeModalBtn.addEventListener("click", () => {
        profileCardModal.style.display = "none";
    });
  
    // Close modal when clicking outside
    window.addEventListener("click", (event) => {
        if (event.target === profileCardModal) {
            profileCardModal.style.display = "none";
        }
    });
  
    // Copy profile card content
    copyProfileCardBtn.addEventListener("click", () => {
        const personalDetails = JSON.parse(localStorage.getItem("personalDetails")) || {};
        const socialLinks = JSON.parse(localStorage.getItem("socialLinks")) || [];
        
        let cardText = `🌟 ${personalDetails.name}'s Profile 🌟\n\n`;
        
        // Personal Details
        if (Object.keys(personalDetails).length > 0) {
            cardText += "📋 Personal Details:\n";
            if (personalDetails.name) cardText += `Name: ${personalDetails.name}\n`;
            if (personalDetails.phone) cardText += `Phone: ${personalDetails.phone}\n`;
            if (personalDetails.email) cardText += `Email: ${personalDetails.email}\n`;
            if (personalDetails.Address) cardText += `Address: ${personalDetails.Address}\n`;
            if (personalDetails.pincode) cardText += `Pincode: ${personalDetails.pincode}\n`;
            cardText += "\n";
        }
        
        // Social Links
        if (socialLinks.length > 0) {
            cardText += "🔗 Social Links:\n";
            socialLinks.forEach(({ platform, link }) => {
                cardText += `${platform}: ${link}\n`;
            });
        }
        
        navigator.clipboard.writeText(cardText).then(() => {
            const originalText = copyProfileCardBtn.textContent;
            copyProfileCardBtn.textContent = "Copied!";
            setTimeout(() => {
                copyProfileCardBtn.textContent = originalText;
            }, 1500);
        });
    });
  });
  