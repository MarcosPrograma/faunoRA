export class UIControl {
    constructor() {
        this.loadingScreen = document.getElementById('loadingScreen');
        this.scanningScreen = document.getElementById('scanningScreen');
        this.loadingText = document.getElementById('loadingText');
        this.loadingSubtext = document.getElementById('loadingSubtext');
        this.targetLostMessage = document.getElementById('targetLostMessage');
    }

    //mostrar pantalla de carga
    showLoading() {
        this.loadingScreen.classList.remove('hidden');
        this.scanningScreen.classList.remove('visible');
        this.simulateLoading();
    }

    //ocultar pantalla de carga
    hideLoading() {
        this.loadingScreen.classList.add('hidden');
    }

    //mostrar pantalla de escaneo
    showScanning() {
        this.hideLoading();
        this.scanningScreen.classList.add('visible');
    }

    //ocultar pantalla de escaneo
    hideScanning() {
        this.scanningScreen.classList.remove('visible');
    }

    simulateLoading() {
        setTimeout(() => {
            this.loadingSubtext.textContent = "Al tomar la captura, puede tardar un momento";
        }, 1000); // cambia a los 1 segundos

        setTimeout(() => {
            this.loadingSubtext.textContent = "Hecho en la Universidad Pública ♥";
        }, 2000); // cambia a los 2 segundos

        setTimeout(() => {
            this.hideLoading();
        }, 6000); // oculta la pantalla a los 5 segundos
    }

    //métodos para integrar con MindAR
    startLoadingSequence() {
        this.showLoading();
    }

    onARReady() {
        this.showScanning();
    }

    onTargetFound() {
        this.hideScanning();
        this.targetLostMessage.style.display = 'none';
    }

    onTargetLost() {
        this.showScanning();
        this.targetLostMessage.style.display = 'block';
    }
}