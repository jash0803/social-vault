document.addEventListener("DOMContentLoaded", () => {
    const addForm = document.getElementById("addForm");
    const linksList = document.getElementById("linksList");
  
    const loadLinks = () => {
      const links = JSON.parse(localStorage.getItem("socialLinks")) || [];
      linksList.innerHTML = "";
      links.forEach(({ platform, link }, index) => {
        const li = document.createElement("li");
        li.innerHTML = `
          <span>${platform}: <a href="${link}" target="_blank">${link}</a></span>
          <button class="copy" data-link="${link}">Copy</button>
        `;
        linksList.appendChild(li);
      });
  
      document.querySelectorAll("button.copy").forEach(button => {
        button.addEventListener("click", (event) => {
          const linkToCopy = event.target.dataset.link;
          navigator.clipboard.writeText(linkToCopy).then(() => {
            alert("Link copied to clipboard!");
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
  