export const screenshotButton = (renderer, scene, camera) => {
  const captureCanvas = document.createElement("canvas");
  const captureCtx = captureCanvas.getContext("2d");

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isAndroid = /Android/i.test(navigator.userAgent);

  let video = null;
  let link = null;

  document.getElementById("botonCaptura").addEventListener("click", () => {
    const video = document.querySelector("video");
    if (!video) {
      video = document.querySelector("video");
      if (!video) {
        alert("No se encontró el video");
        return;
      }
    }

    const width = renderer.domElement.width;
    const height = renderer.domElement.height;

    //ajustar solo si cambió
    if (captureCanvas.width !== width || captureCanvas.height !== height) {
      captureCanvas.width = width;
      captureCanvas.height = height;
    }

    //render actual
    renderer.render(scene, camera);

    //combinar video + WebGL sin esperas extra
    captureCtx.drawImage(video, 0, 0, width, height);
    captureCtx.drawImage(renderer.domElement, 0, 0, width, height);

    const timestamp = Date.now();

    //iOS con DataURL
    if (isIOS) {
      if (!link) {
        link = document.createElement("a");
        document.body.appendChild(link);
      }
      link.href = captureCanvas.toDataURL("image/jpeg", 0.8);
      link.download = `david-ar-${timestamp}.png`;
      link.click();
      return;
    }

    // Android con Share API
    if (isAndroid && navigator.canShare) {
      captureCanvas.toBlob((blob) => {
        const file = new File([blob], `david-ar-${timestamp}.png`, { type: "image/jpeg" });
        navigator.share({ files: [file], title: "Captura AR" })
          .catch(err => console.warn("Share cancelado:", err));
      }, "image/jpeg", 0.8);
      return;
    }

    // Android sin Share API con DataURL
    if (isAndroid) {
      if (!link) {
        link = document.createElement("a");
        document.body.appendChild(link);
      }
      link.href = captureCanvas.toDataURL("image/jpeg", 0.8);
      link.download = `david-ar-${timestamp}.png`;
      link.click();
      return;
    }

    /*
    // Escritorio con Blob + descarga
    captureCanvas.toBlob((blob) => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `david-ar-${Date.now()}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }, "image/png"); */
  });

  document.getElementById("info-button").addEventListener("click", () => {
    document.getElementById("info-panel").classList.add("visible");
    document.getElementById("info-overlay").classList.add("visible");
  });

  document.getElementById("close-panel").addEventListener("click", () => {
    document.getElementById("info-panel").classList.remove("visible");
    document.getElementById("info-overlay").classList.remove("visible");
  });

  document.getElementById("info-overlay").addEventListener("click", () => {
    document.getElementById("info-panel").classList.remove("visible");
    document.getElementById("info-overlay").classList.remove("visible");
  });
};
