import * as THREE from "three";
import { MindARThree } from "mindar-image-three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { UIControl } from "./js/ui-control.js";
import { SmoothTracker } from "./js/smooth-tracker.js";
import { screenshotButton } from "./js/capture.js";

const ui = new UIControl();
const tracker = new SmoothTracker();
tracker.setSensitivity('medium');
ui.startLoadingSequence();;

//iniciar mindAR 
const mindarThree = new MindARThree({
    container: document.querySelector("#container"),
    imageTargetSrc: "src/targets.mind",
    filterMinCF: 0.0005, //controlar la suavidad: valor bajo > mas suavidad y menos vibración  
    filterBeta: 15, //ajustar como responde el filtro a cambios rapidos: alto valor > respuesta rapida y menos delay 
    warmupTolerance: 15, //espera 8 frames antes de activar el modelo  
    missTolerance: 5, //tolerancia en el que el modelo se mantiene visible cuando se pierde el target 
    showStats: false,
    uiLoading: false,
    uiScanning: false,
});

const { renderer, scene, camera } = mindarThree;

// Luz ambiental suave con un toque cálido (simula rebote en paredes)
const ambient = new THREE.AmbientLight(0xf5f5f5, 0.35); 
scene.add(ambient);

// Luz direccional principal (ligeramente cálida, como un foco de museo)
const keyLight = new THREE.DirectionalLight(0xfff8e7, 1.1); 
keyLight.position.set(3, 8, 5);
keyLight.castShadow = true;
keyLight.shadow.bias = -0.0001;
scene.add(keyLight);

// Luz de relleno fría, más tenue (equilibra el contraste, simula desgaste)
const fillLight = new THREE.DirectionalLight(0xe0e0e0, 0.35);
fillLight.position.set(-4, 3, 6);
scene.add(fillLight);

// Luz trasera con tono neutro para resaltar bordes sin brillar demasiado
const backLight = new THREE.DirectionalLight(0xfafafa, 0.5);
backLight.position.set(0, 5, -4);
scene.add(backLight);

//cargar modelo GLTF
const anchor = mindarThree.addAnchor(0);
const loader = new GLTFLoader();

let modelGroup = new THREE.Group();
let mixer = null; // para animaciones
let actions = [];
let currentActionIndex = 0;
let animationPlayed = false; // para asegurarnos que solo se ejecute una vez
let isTracking = false;

loader.load("src/fauno.glb", (gltf) => {
    const model = gltf.scene;

    model.scale.set(0.5, 0.5, 0.5);
    model.rotation.set(Math.PI / 2, 0, 0); //Three usa radianes, no grados 
    model.position.set(0, 0, 0);

    model.traverse((child) => {
        if (child.isMesh) {
            child.material.matcap = null;
            child.material.needsUpdate = true;
            child.frustumCulled = false;
        }
    });

    modelGroup.add(model);
    anchor.group.add(modelGroup);

    // Crear mixer y almacenar TODAS las animaciones
    if (gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model);

        actions = gltf.animations.map((clip) => {
            const action = mixer.clipAction(clip);
            action.setLoop(THREE.LoopOnce);
            action.clampWhenFinished = true;
            return action;
        });
    }

    //inicializar tracking del modelo
    tracker.lastPosition.copy(modelGroup.position);
    tracker.lastRotation.copy(modelGroup.rotation);
    tracker.lastScale.copy(modelGroup.scale);
});

//Si detectamos que estamos en móvil, usa parámetros más suaves y buffers más grandes
if (/Mobi|Android/i.test(navigator.userAgent)) {
    tracker.setSensitivity('low'); // suavizado más agresivo
    tracker.bufferSize = 8;        // más frames de promedio
    tracker.predictionStrength = 0.05; // menos predicción, más suavidad
}

//eventos de tracking
anchor.onTargetFound = () => {
    console.log("Target encontrado");
    isTracking = true;

    fadeOut = false;
    modelGroup.visible = true;

    // restaurar tamaño y opacidad
    modelGroup.traverse(child => {
        if (child.isMesh) {
            child.material.opacity = 1;
            child.material.transparent = false;
        }
    });

    if (!animationPlayed && actions.length > 0) {
        setTimeout(() => {
            if (isTracking) {
                actions.forEach(action => {
                    action.reset().play(); // arrrancan todas juntas
                });
                animationPlayed = true;
            }
        }, 3000);
    }

    // Asegurarse de que la UI original esté oculta
    document.querySelector("#loading-ui")?.classList.add("hidden");
    document.querySelector("#scanning-ui")?.classList.add("hidden");
    tracker.onTargetFound();
    ui.onTargetFound();
};

let fadeOut = false;
let fadeStartTime = 0;

anchor.onTargetLost = () => {
    console.log("Target perdido");
    isTracking = false;

    // animación de salida (fade + scale)
    fadeOut = true;
    fadeStartTime = performance.now();

    // Mantener la UI original oculta
    document.querySelector("#loading-ui")?.classList.add("hidden");
    document.querySelector("#scanning-ui")?.classList.add("hidden");
    tracker.onTargetLost();
    ui.onTargetLost();
};

//agregar controles para ajustar sensibilidad dinámicamente
window.setSensitivity = (level) => {
    tracker.setSensitivity(level);
    console.log(`Sensibilidad cambiada a: ${level}`);
};

screenshotButton(renderer, scene, camera);

//iniciar AR
const start = async () => {
    await mindarThree.start();
    ui.onARReady();

    const clock = new THREE.Clock();

    renderer.setAnimationLoop(() => {
        const delta = clock.getDelta();
        if (mixer) mixer.update(delta);

        // si está en fade out
        if (fadeOut) {
            const elapsed = (performance.now() - fadeStartTime) / 1000; // seg
            const fadeDuration = 0.5; // medio segundo
            // progresivo 1 → 0
            const alpha = Math.max(0, 1 - elapsed / fadeDuration);

            modelGroup.traverse(child => {
                if (child.isMesh) {
                    child.material.transparent = true;
                    child.material.opacity = alpha;
                }
            });

            if (alpha <= 0) {
                fadeOut = false;
                // oculta realmente el modelo
                modelGroup.visible = false;
            }
        }

        tracker.smoothTransform(modelGroup, anchor.group);
        renderer.render(scene, camera);
    });
};

start();