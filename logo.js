// Reusable logo renderer: injects the company logo image into #logo containers.
(function () {
  function renderLogo(container, size) {
    if (!container) return;
    container.textContent = "";
    const img = document.createElement("img");
    img.src = "iSynergies (1).png";
    img.alt = "iSynergies Inc. - We make IT possible";
    // Only constrain width; the browser derives height from the file's
    // natural aspect ratio, so square and wide logos both display undistorted.
    img.width = size || 32;
    img.style.width = (size || 32) + "px";
    img.style.height = "auto";
    container.appendChild(img);
  }

  window.LGO = { renderLogo: renderLogo };
})();
