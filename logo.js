// Reusable logo renderer: injects the company logo image into #logo containers.
(function () {
  function renderLogo(container) {
    container.textContent = "";
    const img = document.createElement("img");
    img.src = "logo.png";
    img.alt = "iSynergies Inc. - We make IT possible";
    // Only constrain width; the browser derives height from the file's
    // natural aspect ratio, so square and wide logos both display undistorted.
    img.width = 84;
    img.style.height = "auto";
    container.appendChild(img);
  }

  window.LGO = { renderLogo: renderLogo };
})();
