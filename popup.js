document.addEventListener("DOMContentLoaded", () => {
    const addForm = document.getElementById("addForm");
    const linksList = document.getElementById("linksList");
  
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
          <button class="copy" data-link="${link}">Copy</button>
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
    };
  
    const saveLinks = (links) => {
      localStorage.setItem("socialLinks", JSON.stringify(links));
    };
  
    addForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const platform = document.getElementById("platform").value;
      const link = document.getElementById("link").value;
  
      const links = JSON.parse(localStorage.getItem("socialLinks")) || [];
      links.push({ platform, link });
      saveLinks(links);
      loadLinks();
  
      addForm.reset();
    });
  
    loadLinks();
  });
  