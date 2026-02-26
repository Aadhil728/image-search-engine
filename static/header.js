// Header Mobile Menu Toggle
document.addEventListener("DOMContentLoaded", () => {
  const menuToggle = document.getElementById("menu-toggle");
  const headerNav = document.getElementById("header-nav");

  if (menuToggle && headerNav) {
    menuToggle.addEventListener("click", () => {
      menuToggle.classList.toggle("active");
      headerNav.classList.toggle("active");
    });

    // Close menu when a link is clicked
    const navLinks = headerNav.querySelectorAll(".nav-link");
    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        menuToggle.classList.remove("active");
        headerNav.classList.remove("active");
      });
    });

    // Set active link based on current page
    const currentPath = window.location.pathname;
    navLinks.forEach((link) => {
      const href = link.getAttribute("href");
      if (href === currentPath) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  }
});
