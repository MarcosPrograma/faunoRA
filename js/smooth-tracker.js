import * as THREE from "three";

export class SmoothTracker {
    constructor() {
        this.lastPosition = new THREE.Vector3();
        this.lastRotation = new THREE.Euler();
        this.lastScale = new THREE.Vector3(1, 1, 1);

        //configuración de suavizado
        this.smoothingFactor = 0.07;
        this.adaptiveSmoothingFactor = 0.07;
        this.maxSmoothingFactor = 0.3;
        this.minSmoothingFactor = 0.02;

        //detección de movimientos bruscos
        this.maxPositionDelta = 0.5;  //máximo cambio de posición permitido por frame
        this.maxRotationDelta = 0.8;  //máximo cambio de rotación permitido por frame
        this.maxScaleDelta = 0.3;     //máximo cambio de escala permitido por frame

        //buffer para promediar movimientos
        this.positionBuffer = [];
        this.rotationBuffer = [];
        this.scaleBuffer = [];
        this.bufferSize = 5;

        //estado de tracking
        this.isTracking = false;
        this.frameCount = 0;
        this.stabilizationFrames = 15;

        //velocidad de movimiento para suavizado adaptativo
        this.lastFrameTime = performance.now();
        this.velocityThreshold = 0.1;

        //predicción de movimiento
        this.velocityPosition = new THREE.Vector3();
        this.velocityRotation = new THREE.Euler();
        this.predictionStrength = 0.1;
    }

    //detectar si el movimiento es demasiado brusco
    isMovementTooAbrupt(currentPos, currentRot, currentScale) {
        const posDelta = currentPos.distanceTo(this.lastPosition);
        const rotDelta = Math.abs(currentRot.x - this.lastRotation.x) +
            Math.abs(currentRot.y - this.lastRotation.y) +
            Math.abs(currentRot.z - this.lastRotation.z);
        const scaleDelta = Math.abs(currentScale.x - this.lastScale.x);

        return posDelta > this.maxPositionDelta ||
            rotDelta > this.maxRotationDelta ||
            scaleDelta > this.maxScaleDelta;
    }

    //agregar valores al buffer para promediar
    addToBuffer(position, rotation, scale) {
        this.positionBuffer.push(position.clone());
        this.rotationBuffer.push(rotation.clone());
        this.scaleBuffer.push(scale.clone());

        if (this.positionBuffer.length > this.bufferSize) {
            this.positionBuffer.shift();
            this.rotationBuffer.shift();
            this.scaleBuffer.shift();
        }
    }

    //calcular promedio del buffer
    getAverageFromBuffer() {
        if (this.positionBuffer.length === 0) return null;

        const avgPos = new THREE.Vector3();
        const avgRot = new THREE.Euler();
        const avgScale = new THREE.Vector3();

        //promedio de posición
        this.positionBuffer.forEach(pos => avgPos.add(pos));
        avgPos.divideScalar(this.positionBuffer.length);

        //promedio de rotación
        let x = 0, y = 0, z = 0;
        this.rotationBuffer.forEach(rot => {
            x += rot.x;
            y += rot.y;
            z += rot.z;
        });
        avgRot.set(
            x / this.rotationBuffer.length,
            y / this.rotationBuffer.length,
            z / this.rotationBuffer.length
        );

        //promedio de escala
        this.scaleBuffer.forEach(scale => avgScale.add(scale));
        avgScale.divideScalar(this.scaleBuffer.length);

        return { position: avgPos, rotation: avgRot, scale: avgScale };
    }

    //calcular velocidad de movimiento
    calculateVelocity(currentPos, currentRot) {
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastFrameTime) / 1000;
        this.lastFrameTime = currentTime;

        // móvil con poca luz, aumentar suavizado
        if (deltaTime > 0.05) { // más de 50ms/frame
            this.smoothingFactor = Math.min(this.smoothingFactor * 1.2, this.maxSmoothingFactor);
        }

        if (deltaTime > 0) {
            //calcular velocidad de posición
            const posVelocity = currentPos.clone().sub(this.lastPosition).divideScalar(deltaTime);
            this.velocityPosition.lerp(posVelocity, 0.3);

            //calcular velocidad de rotación
            const rotVelocity = new THREE.Euler(
                (currentRot.x - this.lastRotation.x) / deltaTime,
                (currentRot.y - this.lastRotation.y) / deltaTime,
                (currentRot.z - this.lastRotation.z) / deltaTime
            );
            this.velocityRotation.x = THREE.MathUtils.lerp(this.velocityRotation.x, rotVelocity.x, 0.3);
            this.velocityRotation.y = THREE.MathUtils.lerp(this.velocityRotation.y, rotVelocity.y, 0.3);
            this.velocityRotation.z = THREE.MathUtils.lerp(this.velocityRotation.z, rotVelocity.z, 0.3);
        }
    }

    //suavizado adaptativo basado en velocidad
    getAdaptiveSmoothingFactor() {
        const velocityMagnitude = this.velocityPosition.length();

        if (velocityMagnitude > this.velocityThreshold) {
            //movimiento rápido = más suavizado
            const factor = Math.min(velocityMagnitude / this.velocityThreshold, 5);
            return Math.max(this.minSmoothingFactor, this.smoothingFactor / factor);
        } else {
            //movimiento lento = menos suavizado para mejor respuesta
            return Math.min(this.maxSmoothingFactor, this.smoothingFactor * 2);
        }
    }

    //predicción de movimiento
    getPredictedPosition(currentPos, currentRot, currentScale) {
        const predictedPos = currentPos.clone().add(
            this.velocityPosition.clone().multiplyScalar(this.predictionStrength)
        );

        const predictedRot = new THREE.Euler(
            currentRot.x + this.velocityRotation.x * this.predictionStrength,
            currentRot.y + this.velocityRotation.y * this.predictionStrength,
            currentRot.z + this.velocityRotation.z * this.predictionStrength
        );

        return { position: predictedPos, rotation: predictedRot, scale: currentScale };
    }

    //función principal de suavizado
    smoothTransform(modelGroup, anchorGroup) {
        if (!modelGroup || !this.isTracking) return;

        this.frameCount++;

        const anchorPos = anchorGroup.position;
        const anchorRot = anchorGroup.rotation;
        const anchorScale = anchorGroup.scale;

        //calcular velocidad
        this.calculateVelocity(anchorPos, anchorRot);

        //detectar movimiento brusco
        if (this.isMovementTooAbrupt(anchorPos, anchorRot, anchorScale)) {
            console.log("Movimiento brusco detectado - aplicando suavizado extra");
            if (/Mobi|Android/i.test(navigator.userAgent)) {
                return;
            }
            //usar el último valor válido o promedio del buffer
            const averaged = this.getAverageFromBuffer();
            if (averaged) {
                this.addToBuffer(averaged.position, averaged.rotation, averaged.scale);
            }
            return; //saltar este frame
        }

        //agregar al buffer
        this.addToBuffer(anchorPos, anchorRot, anchorScale);

        //aplicar suavizado después de los frames de estabilización
        if (this.frameCount > this.stabilizationFrames) {
            //obtener factor de suavizado adaptativo
            this.adaptiveSmoothingFactor = this.getAdaptiveSmoothingFactor();

            //obtener predicción
            const predicted = this.getPredictedPosition(anchorPos, anchorRot, anchorScale);

            //usar promedio del buffer si está disponible
            const averaged = this.getAverageFromBuffer();
            const targetPos = averaged ? averaged.position : predicted.position;
            const targetRot = averaged ? averaged.rotation : predicted.rotation;
            const targetScale = averaged ? averaged.scale : predicted.scale;

            //aplicar suavizado
            this.lastPosition.lerp(targetPos, this.adaptiveSmoothingFactor);
            modelGroup.position.copy(this.lastPosition);

            //suavizar rotación
            this.lastRotation.x += (targetRot.x - this.lastRotation.x) * this.adaptiveSmoothingFactor;
            this.lastRotation.y += (targetRot.y - this.lastRotation.y) * this.adaptiveSmoothingFactor;
            this.lastRotation.z += (targetRot.z - this.lastRotation.z) * this.adaptiveSmoothingFactor;
            modelGroup.rotation.copy(this.lastRotation);

            //suavizar escala
            this.lastScale.lerp(targetScale, this.adaptiveSmoothingFactor);
            modelGroup.scale.copy(this.lastScale);
        }
    }

    onTargetFound() {
        this.isTracking = true;
        this.frameCount = 0;
        //limpiar buffers
        this.positionBuffer = [];
        this.rotationBuffer = [];
        this.scaleBuffer = [];
        console.log("Target encontrado - iniciando tracking suave");
    }

    onTargetLost() {
        this.isTracking = false;
        console.log("Target perdido - deteniendo tracking");
    }

    //configurar sensibilidad dinámicamente
    setSensitivity(level) {
        switch (level) {
            case 'low':
                this.maxPositionDelta = 0.2;
                this.maxRotationDelta = 0.3;
                this.smoothingFactor = 0.03;
                this.bufferSize = 8;
                break;
            case 'medium':
                this.maxPositionDelta = 0.5;
                this.maxRotationDelta = 0.8;
                this.smoothingFactor = 0.07;
                this.bufferSize = 5;
                break;
            case 'high':
                this.maxPositionDelta = 1.0;
                this.maxRotationDelta = 1.5;
                this.smoothingFactor = 0.15;
                this.bufferSize = 3;
                break;
        }
    }
}