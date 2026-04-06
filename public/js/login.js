document.addEventListener("DOMContentLoaded", function () {
  // Tabs switch
  document.querySelectorAll(".tabs button").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelector(".tabs .active").classList.remove("active");
      btn.classList.add("active");
    });
  });

  // Role switch
  document.querySelectorAll(".role-toggle button").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelector(".role-toggle .active").classList.remove("active");
      btn.classList.add("active");
    });
  });

  // Password toggle
  const eye = document.querySelector(".password-field span");
  const password = document.querySelector(".password-field input");

  if (eye && password) {
    eye.addEventListener("click", () => {
      password.type = password.type === "password" ? "text" : "password";
    });
  }

  const form = document.querySelector("form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
    });
  }

});
