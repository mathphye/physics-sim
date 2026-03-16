class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.pixelsPerMeter = 40;
        
        // Initial state
        this.startX = x;
        this.startY = y;
        this.startTime = 0;
        
        this.vx = 0;
        this.vy = 0;
        this.ax = 0;
        this.ay = 0;
        
        this.mass = 10;
        this.baseRadius = 5;
        this.radius = 15; // Initial, will be overriden by mass scaling
        this.color = '#38bdf8';
        this.borderColor = '#ffffff';
        this.borderWidth = 4;

        this.id = Math.random().toString(36).substr(2, 9);
        this.selected = true;

        this.history = []; // Stores {y, time}
        this.updateRadius();
    }

    updateRadius() {
        this.radius = this.baseRadius + Math.sqrt(this.mass) * 3;
    }

    // Explicit Kinematic Update: P = P0 + V*t
    updateKinetic(t, dim = '1D') {
        if (dim === '2D') {
            this.x = this.startX + (this.vx * this.pixelsPerMeter) * t;
        }
        this.y = this.startY - (this.vy * this.pixelsPerMeter) * t;
    }

    // Velocity Verlet step 1: Position update
    updatePositionVerlet(dt) {
        this.x += (this.vx * this.pixelsPerMeter) * dt + 0.5 * this.ax * this.pixelsPerMeter * dt * dt;
        this.y -= (this.vy * this.pixelsPerMeter) * dt + 0.5 * this.ay * this.pixelsPerMeter * dt * dt;
    }

    // Velocity Verlet step 2: Velocity update (half steps)
    updateVelocityVerlet(dt, newAx, newAy) {
        this.vx += 0.5 * (this.ax + newAx) * dt;
        this.vy += 0.5 * (this.ay + newAy) * dt;
        this.ax = newAx;
        this.ay = newAy;
    }

    addHistory(x, y, time) {
        this.history.push({x, y, time});
        if (this.history.length > 500) this.history.shift();
    }

    resetStartTime(currentTime, x, y) {
        this.startTime = currentTime;
        this.startX = x;
        this.startY = y;
        // History is NOT cleared here to allow continuous graph visualization
    }

    draw(ctx, globalTime, timeScale, dim = '1D') {
        this.updateRadius();

        // --- Trails ---
        if (dim === '1D' && this.history.length > 1) {
            ctx.save();
            ctx.beginPath();
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            for (let i = 0; i < this.history.length; i++) {
                const pt = this.history[i];
                const xPos = this.x - (globalTime - pt.time) * timeScale;
                if (xPos < 0) continue;
                if (i === 0) ctx.moveTo(xPos, pt.y);
                else ctx.lineTo(xPos, pt.y);
            }
            ctx.stroke();
            ctx.restore();
        }

        if (dim === 'Orbital' && this.history.length > 1) {
            ctx.save();
            ctx.beginPath();
            ctx.lineWidth = 2;
            ctx.strokeStyle = this.color;
            ctx.globalAlpha = 0.4;
            for (let i = 0; i < this.history.length; i++) {
                const pt = this.history[i];
                if (i === 0) ctx.moveTo(pt.x, pt.y);
                else ctx.lineTo(pt.x, pt.y);
            }
            ctx.stroke();
            ctx.restore();
        }

        // --- Main Body (Premium Aesthetic) ---
        ctx.save();
        
        // Outer atmospheric glow
        ctx.shadowBlur = this.radius * 1.5;
        ctx.shadowColor = this.color;
        
        // Polished Rim
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // High-end Radial Gradient (Sphere effect)
        const grad = ctx.createRadialGradient(
            this.x - this.radius*0.3, this.y - this.radius*0.3, this.radius * 0.1,
            this.x, this.y, this.radius
        );
        grad.addColorStop(0, '#ffffff'); 
        grad.addColorStop(0.3, this.color);
        grad.addColorStop(1, 'rgba(0,0,0,0.6)');

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.restore();

        // Velocity Vector
        this.drawVector(ctx, this.x, this.y, this.vx * 40, -this.vy * 40, this.color);
    }

    drawVector(ctx, x, y, vx, vy, color) {
        if (Math.abs(vx) < 0.1 && Math.abs(vy) < 0.1) return;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + vx, y + vy);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.stroke();

        const angle = Math.atan2(vy, vx);
        ctx.beginPath();
        ctx.moveTo(x + vx, y + vy);
        ctx.lineTo(x + vx - 10 * Math.cos(angle - Math.PI / 6), y + vy - 10 * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(x + vx, y + vy);
        ctx.lineTo(x + vx - 10 * Math.cos(angle + Math.PI / 6), y + vy - 10 * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
        ctx.restore();
    }
}

class Simulation {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.mode = 'kinetics';
        this.gravity = parseFloat(document.getElementById('gravity')?.value) || 9.81;
        this.floorY = 0; // Relative to center
        this.particle = null;
        this.isDragging = false;
        this.isPaused = false;
        this.timeScale = 100; // pixels per second for the horizontal flow
        this.globalTime = 0;
        this.lastFrameTime = performance.now();
        this.accumulator = 0; // Fixes physics/trail sampling
        this.fixedDeltaTime = 1 / 60; // 60Hz stable sampling
        this.mouseTargetX = 0;
        this.mouseTargetY = 0;
        this.dimensions = '1D'; // '1D', '2D', or 'Orbital'
        this.gravityG = 10.0; // Universal Gravitational Constant

        this.camX = 0;
        this.camY = 0;
        this.isPanning = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        
        // Flappy Mode State
        this.isFlappy = false;
        this.obstacles = [];
        this.score = 0;
        this.isGameOver = false;
        this.spawnTimer = 0;

        this.particles = []; // Array to support multiple bodies
        this.activeParticle = null; 
        this.comHistory = []; 
        this.pixelsPerMeter = 40;
        this.softeningEpsilon = 0.1; // Plummer Softening (meters)
        this.initialEnergy = null; 
        this.energyDriftThreshold = 0.01; // 1% drift limit before warning
        this.lastSelectedIds = ""; 

        this.init();
        this.animate();
    }

    init() {
        this.resize(); // Ensure canvas has size immediately
        window.addEventListener('resize', () => {
            this.resize();
            this.reset();
        });
        
        // Setup UI before reset case they might affect initial state
        this.setupUI();
        
        // Final reset with correct dimensions
        this.reset();
    }

    reset() {
        if (!this.canvas.width || !this.canvas.height) this.resize();
        this.globalTime = 0;
        this.lastFrameTime = performance.now();
        this.accumulator = 0;
        this.camX = 0;
        this.camY = 0;
        this.followingCoM = false;
        document.getElementById('center-com')?.classList.remove('active');
        
        this.particles = [];
        this.comHistory = [];
        this.initialEnergy = null; 
        document.getElementById('fidelity-warning')?.classList.add('hidden');
        const lockX = this.canvas.width * 0.8;
        const startY = this.canvas.height / 2;
        const massValue = parseFloat(document.getElementById('mass')?.value) || 10;
        
        if (this.dimensions !== 'Orbital') {
            const p = new Particle(lockX, startY);
            p.mass = massValue;
            p.resetStartTime(0, lockX, startY);
            
            if (this.dimensions === '2D') {
                p.x = this.canvas.width / 4;
                p.y = this.canvas.height / 2;
                p.startY = p.y;
                p.startX = p.x;
            }
            
            if (this.mode === 'kinetics') {
                const velInput = document.getElementById('vel-y');
                p.vy = parseFloat(velInput?.value) || 0;
            }
            this.particles.push(p);
            this.activeParticle = p;
        } else {
            this.activeParticle = null;
        }

        // Bootstrap accelerations so Verlet has initial values
        const initialAccels = this.calculateAccelerations();
        this.particles.forEach((p, i) => {
            p.ax = initialAccels[i]?.ax || 0;
            p.ay = initialAccels[i]?.ay || (this.dimensions === 'Orbital' ? 0 : -this.gravity);
        });
    }

    setupUI() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.mode = btn.dataset.mode;
                
                document.getElementById('kinetics-controls').classList.toggle('hidden', this.mode !== 'kinetics');
                document.getElementById('dynamics-controls').classList.toggle('hidden', this.mode !== 'dynamics');
                
                const desc = document.getElementById('mode-desc');
                if (this.mode === 'kinetics') {
                    desc.innerHTML = "<strong>Kinetics 1D:</strong> Height over Time. Formula: <code>y(t) = y₀ + v·t</code>.";
                    this.reset();
                } else {
                    desc.innerHTML = "<strong>Dynamics 1D:</strong> Forces affect height. Gravity pulls down at 9.81m/s².";
                }
            });
        });

        const updateVal = (id, val) => {
            const el = document.getElementById('val-' + id);
            if (el) el.innerText = val;
        };

        const velYInput = document.getElementById('vel-y');
        if (velYInput) {
            velYInput.addEventListener('input', (e) => {
                const p = this.activeParticle || this.particles[0];
                if (p) {
                    p.vy = parseFloat(e.target.value);
                    if (this.mode === 'kinetics') p.resetStartTime(this.globalTime, p.x, p.y);
                }
                updateVal('vy', e.target.value);
            });
        }

        const velXInput = document.getElementById('vel-x');
        if (velXInput) {
            velXInput.addEventListener('input', (e) => {
                const p = this.activeParticle || this.particles[0];
                if (p) p.vx = parseFloat(e.target.value);
                updateVal('vx', e.target.value);
            });
        }

        document.getElementById('mass').addEventListener('input', (e) => {
            const p = this.activeParticle || this.particles[0];
            if (p) {
                p.mass = parseFloat(e.target.value);
                p.updateRadius();
            }
            updateVal('mass', e.target.value);
        });

        document.getElementById('gravity').addEventListener('input', (e) => {
            this.gravity = parseFloat(e.target.value);
            this.initialEnergy = null;
            updateVal('gravity', e.target.value);
        });

        const timeScaleInput = document.getElementById('time-scale');
        if (timeScaleInput) {
            timeScaleInput.addEventListener('input', (e) => {
                const pxs = parseFloat(e.target.value);
                this.timeScale = pxs; // Directly use Pixels/s
                updateVal('time-scale', pxs);
                if (this.isPaused) this.updateFormula();
            });
        }

        const applyForceBtn = document.getElementById('apply-force');
        if (applyForceBtn) {
            applyForceBtn.addEventListener('click', () => {
                const p = this.activeParticle || this.particles[0];
                if (p) {
                    p.vy = 10; 
                    if (this.mode === 'kinetics') p.resetStartTime(this.globalTime, p.x, p.y);
                }
                updateVal('vy', "10.0");
                if (this.isPaused) this.updateFormula();
            });
        }

        const gInput = document.getElementById('gravity-g');
        if (gInput) {
            gInput.addEventListener('input', (e) => {
                this.gravityG = parseFloat(e.target.value);
                this.initialEnergy = null;
                updateVal('gravity-g', e.target.value);
            });
        }

        document.getElementById('clear-particles').addEventListener('click', () => {
            if (this.dimensions === 'Orbital') {
                this.particles = [];
                this.activeParticle = null;
                this.initialEnergy = null;
                this.updateParticleList();
            }
        });

        document.getElementById('pause-btn').addEventListener('click', (e) => {
            this.isPaused = !this.isPaused;
            e.target.innerText = this.isPaused ? "Play ▶" : "Pause ⏸";
            e.target.classList.toggle('active', this.isPaused);
            document.getElementById('formula-overlay').classList.toggle('hidden', !this.isPaused);
            if (this.isPaused) this.updateFormula();
        });

        document.getElementById('reset-btn').addEventListener('click', () => {
            this.isPaused = false;
            document.getElementById('pause-btn').innerText = "Pause ⏸";
            document.getElementById('pause-btn').classList.remove('active');
            document.getElementById('formula-overlay').classList.add('hidden');
            
            if (this.isFlappy) {
                this.isGameOver = false;
                this.score = 0;
                this.obstacles = [];
                document.getElementById('score-val').innerText = "0";
                document.querySelector('.game-over').classList.add('hidden');
            }
            this.reset();
        });

        document.getElementById('center-com').addEventListener('click', (e) => {
            this.followingCoM = !this.followingCoM;
            e.target.classList.toggle('active', this.followingCoM);
            
            if (this.followingCoM) {
                this.updateStickyCenter();
            }
        });

        // Easter Egg: Flappy Mode
        document.getElementById('easter-egg-btn').addEventListener('click', () => {
            this.toggleFlappy();
        });

        // Dimension Switcher
        document.getElementById('lab-type').addEventListener('change', (e) => {
            this.dimensions = e.target.value;
            
            const tabs = document.querySelector('.tabs');
            const kineticsControls = document.getElementById('kinetics-controls');
            const dynamicsControls = document.getElementById('dynamics-controls');
            const gWrap = document.getElementById('gravity-g-wrap');
            const gravityWrap = document.getElementById('gravity').parentElement;
            const clearBtn = document.getElementById('clear-particles');
            const centerBtn = document.getElementById('center-com');
            const manager = document.getElementById('particle-manager');
            const modeDesc = document.getElementById('mode-desc');

            // Reset UI visibility
            tabs?.classList.remove('hidden');
            kineticsControls?.classList.remove('hidden');
            dynamicsControls?.classList.add('hidden');
            gWrap?.classList.add('hidden');
            gravityWrap?.classList.remove('hidden');
            clearBtn?.classList.add('hidden');
            centerBtn?.classList.add('hidden');
            manager?.classList.add('hidden');

            if (this.dimensions === '2D') {
                this.mode = 'dynamics';
                tabs?.classList.add('hidden');
                kineticsControls?.classList.add('hidden');
                dynamicsControls?.classList.remove('hidden');
                modeDesc.innerText = "Dynamics 2D: Use the 'Slingshot' interaction by dragging the particle to set initial velocity and direction.";
            } else if (this.dimensions === 'Orbital') {
                this.mode = 'dynamics';
                tabs?.classList.add('hidden');
                kineticsControls?.classList.add('hidden');
                dynamicsControls?.classList.remove('hidden');
                gWrap?.classList.remove('hidden');
                gravityWrap?.classList.add('hidden');
                clearBtn?.classList.remove('hidden');
                centerBtn?.classList.remove('hidden');
                manager?.classList.remove('hidden');
                this.updateParticleList();
                centerBtn?.classList.remove('hidden');
                modeDesc.innerText = "Universal Gravitation Lab: Click on empty space to add particles. Drag particles to launch them. Bodies attract each other proportionally to mass/distance².";
            } else {
                // Restore 1D defaults
                const activeTab = document.querySelector('.tab-btn.active');
                this.mode = activeTab ? activeTab.dataset.mode : 'kinetics';
                if (this.mode === 'dynamics') {
                    kineticsControls?.classList.add('hidden');
                    dynamicsControls?.classList.remove('hidden');
                }
                modeDesc.innerText = "Kinetics: Position vs Time (1D). Vertical axis shows height, horizontal axis shows history.";
            }
            this.reset();
        });

        // Initialize display values from DOM
        updateVal('mass', document.getElementById('mass')?.value);
        updateVal('gravity', document.getElementById('gravity')?.value);
        updateVal('time-scale', document.getElementById('time-scale')?.value);
        updateVal('vy', document.getElementById('vel-y')?.value);

        this.canvas.addEventListener('mousedown', (e) => {
            if (this.isFlappy && !this.isGameOver) {
                this.particles.forEach(p => p.vy = 8); 
                return;
            }
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            if (e.button === 2) { // Right Click for Pan
                this.isPanning = true;
                this.followingCoM = false; // Disable sticky center on manual pan
                document.getElementById('center-com')?.classList.remove('active');
                this.lastMouseX = x;
                this.lastMouseY = y;
                return;
            }

            // Transform screen to world coordinates for interaction
            const worldX = x - this.camX;
            const worldY = y - this.camY;
            
            // Check if we clicked on an existing particle
            let target = null;
            for (const p of this.particles) {
                const dist = Math.sqrt((worldX - p.x)**2 + (worldY - p.y)**2);
                if (dist < p.radius * 2) {
                    target = p;
                    break;
                }
            }

            if (target) {
                this.isDragging = true;
                this.activeParticle = target;
                this.mouseTargetX = worldX;
                this.mouseTargetY = worldY;
                if (this.dimensions !== '1D') {
                    target.vx = 0; target.vy = 0;
                }
            } else if (this.dimensions === 'Orbital') {
                const mass = parseFloat(document.getElementById('mass')?.value) || 10;
                const newP = new Particle(worldX, worldY);
                newP.mass = mass;
                newP.color = `hsl(${this.particles.length * 137.5 % 360}, 70%, 60%)`;
                
                this.particles.push(newP);
                this.isDragging = true;
                this.activeParticle = newP;
                this.mouseTargetX = worldX;
                this.mouseTargetY = worldY;
                
                const accels = this.calculateAccelerations();
                this.particles.forEach((p, i) => { p.ax = accels[i].ax; p.ay = accels[i].ay; });
                
                this.initialEnergy = null; 
                this.updateParticleList();
            }
        });

        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            if (this.isPanning) {
                this.camX += (x - this.lastMouseX);
                this.camY += (y - this.lastMouseY);
                this.lastMouseX = x;
                this.lastMouseY = y;
                return;
            }

            if (!this.isDragging || !this.activeParticle) return;
            this.mouseTargetX = x - this.camX;
            this.mouseTargetY = y - this.camY;
        });

        this.canvas.addEventListener('mouseup', () => {
            this.isPanning = false;
            if (this.isDragging && this.activeParticle) {
                if (this.mode === 'kinetics' && this.dimensions === '1D') {
                    this.activeParticle.resetStartTime(this.globalTime, this.activeParticle.x, this.activeParticle.y);
                }
            }
            this.isDragging = false;
            if (this.dimensions !== 'Orbital') {
                // In non-orbital modes, keep activeParticle pointing to the singular body
                this.activeParticle = this.particles[0];
            }
        });
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        
        const dist = Math.hypot(mx - this.particle.x, my - this.particle.y);
        if (dist < this.particle.radius * 2) {
            this.isDragging = true;
            this.mouseTargetY = my;
            
            // In dynamics, we don't zero velocity immediately to allow a 'tug' feel
            // In kinetics, we keep the sync
        }
    }

    handleMouseMove(e) {
        if (this.isDragging) {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseTargetY = e.clientY - rect.top;
        }
    }

    resize() {
        const parent = this.canvas.parentElement;
        this.canvas.width = parent.clientWidth;
        this.canvas.height = parent.clientHeight;
    }

    drawGrid(globalTime) {
        const vSpacing = 40;
        const hSpacing = this.timeScale;
        const centerY = this.canvas.height / 2;
        const lockX = this.canvas.width * 0.8;
        
        const wX1 = -this.camX, wX2 = -this.camX + this.canvas.width;
        const wY1 = -this.camY, wY2 = -this.camY + this.canvas.height;

        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        this.ctx.beginPath();

        if (this.dimensions === '1D') {
            for (let x = lockX - (globalTime % 1) * hSpacing; x >= wX1; x -= hSpacing) {
                this.ctx.moveTo(x, wY1); this.ctx.lineTo(x, wY2);
            }
            for (let x = lockX - (globalTime % 1) * hSpacing + hSpacing; x <= wX2; x += hSpacing) {
                this.ctx.moveTo(x, wY1); this.ctx.lineTo(x, wY2);
            }
        } else {
            for (let x = Math.floor(wX1 / vSpacing) * vSpacing; x <= wX2; x += vSpacing) {
                this.ctx.moveTo(x, wY1); this.ctx.lineTo(x, wY2);
            }
        }

        for (let y = Math.floor(wY1 / vSpacing) * vSpacing; y <= wY2; y += vSpacing) {
            this.ctx.moveTo(wX1, y); this.ctx.lineTo(wX2, y);
        }
        this.ctx.stroke();
        this.ctx.restore();
    }

    drawAxes(globalTime) {
        const centerY = this.canvas.height / 2;
        const lockX = this.canvas.width * 0.8;
        const wX1 = -this.camX, wX2 = -this.camX + this.canvas.width;
        const wY1 = -this.camY, wY2 = -this.camY + this.canvas.height;

        this.drawGrid(globalTime);
        
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 1.5;
        this.ctx.setLineDash([2, 4]);
        
        // Vertical Reference Axis
        this.ctx.beginPath();
        if (this.dimensions === '1D') {
            this.ctx.moveTo(lockX, wY1);
            this.ctx.lineTo(lockX, wY2);
        } else {
            this.ctx.moveTo(50, wY1);
            this.ctx.lineTo(50, wY2);
        }
        this.ctx.stroke();

        // Horizontal Zero-Height Axis
        this.ctx.beginPath();
        if (this.dimensions === '1D') {
            this.ctx.moveTo(wX1, centerY);
            this.ctx.lineTo(wX2, centerY);
        } else if (this.dimensions === '2D') {
            this.ctx.moveTo(wX1, this.canvas.height - 50);
            this.ctx.lineTo(wX2, this.canvas.height - 50);
        }
        this.ctx.stroke();
        this.ctx.restore();

        // Center of Mass Marker & Trail (Orbital Only)
        if (this.dimensions === 'Orbital') {
            const selected = this.particles.filter(p => p.selected);
            if (selected.length === 0) return;

            let totalM = 0; let sumX = 0; let sumY = 0;
            selected.forEach(p => {
                totalM += p.mass;
                sumX += p.mass * p.x;
                sumY += p.mass * p.y;
            });
            const comX = sumX / totalM;
            const comY = sumY / totalM;
            
            // Draw Ghosts of CoM iteration
            this.ctx.save();
            this.comHistory.forEach((pt, i) => {
                const alpha = (i / this.comHistory.length) * 0.2;
                this.ctx.strokeStyle = `rgba(251, 191, 36, ${alpha})`;
                this.ctx.beginPath();
                const gs = 4;
                this.ctx.moveTo(pt.x - gs, pt.y); this.ctx.lineTo(pt.x + gs, pt.y);
                this.ctx.moveTo(pt.x, pt.y - gs); this.ctx.lineTo(pt.x, pt.y + gs);
                this.ctx.stroke();
            });

            // Draw Dashed Trail
            if (this.comHistory.length > 1) {
                this.ctx.beginPath();
                this.ctx.setLineDash([5, 5]);
                this.ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
                this.ctx.lineWidth = 1.5;
                for (let i = 0; i < this.comHistory.length; i++) {
                    const pt = this.comHistory[i];
                    if (i === 0) this.ctx.moveTo(pt.x, pt.y);
                    else this.ctx.lineTo(pt.x, pt.y);
                }
                this.ctx.stroke();
            }
            this.ctx.restore();

            // Draw Cross Marker
            this.ctx.save();
            this.ctx.strokeStyle = '#fbbf24';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            const s = 10;
            this.ctx.moveTo(comX - s, comY); this.ctx.lineTo(comX + s, comY);
            this.ctx.moveTo(comX, comY - s); this.ctx.lineTo(comX, comY + s);
            this.ctx.stroke();

            // Calculate Total Momentum & Energy
            let momentumX = 0; let momentumY = 0;
            let totalK = 0; let totalU = 0;

            selected.forEach((p, i) => {
                momentumX += p.mass * p.vx;
                momentumY += p.mass * p.vy;
                totalK += 0.5 * p.mass * (p.vx**2 + p.vy**2);

                if (this.dimensions === 'Orbital') {
                    for (let j = i + 1; j < selected.length; j++) {
                        const p2 = selected[j];
                        const dx = (p2.x - p.x) / this.pixelsPerMeter;
                        const dy = (p2.y - p.y) / this.pixelsPerMeter;
                        // Conserved potential with softening
                        const rSoft = Math.sqrt(dx*dx + dy*dy + this.softeningEpsilon**2);
                        totalU -= (this.gravityG * p.mass * p2.mass) / rSoft;
                    }
                } else {
                    const h = (zeroY - p.y) / this.pixelsPerMeter;
                    totalU += p.mass * this.gravity * h;
                }
            });

            // Draw Momentum Vector (Scaled for visibility)
            const scale = 5; 
            this.particles[0]?.drawVector(this.ctx, comX, comY, momentumX * scale, -momentumY * scale, '#a78bfa');

            this.ctx.fillStyle = '#fbbf24';
            this.ctx.font = '10px Outfit';
            this.ctx.fillText('Center of Mass', comX + 12, comY + 4);
            
            this.ctx.fillStyle = '#a78bfa';
            this.ctx.fillText(`Momentum (P): ${Math.sqrt(momentumX**2 + momentumY**2).toFixed(1)}kg·m/s`, comX + 12, comY + 16);
            
            this.ctx.fillStyle = '#10b981'; // Emerald for Energy
            this.ctx.fillText(`Energy (E): ${(totalK + totalU).toFixed(1)}J`, comX + 12, comY + 28);
            this.ctx.restore();
        }
        
        this.ctx.setLineDash([]);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.font = '12px Outfit';
        if (this.dimensions === '1D') {
            this.ctx.fillText('Position (m)', lockX + 10, wY1 + 20);
            this.ctx.fillText('Time (t)', wX1 + 20, centerY + 20);
            this.ctx.fillText('0m', lockX + 5, centerY + 15);
        } else if (this.dimensions === '2D') {
            this.ctx.fillText('Position Y (m)', wX1 + 60, wY1 + 20);
            this.ctx.fillText('Distance X (m)', wX2 - 100, this.canvas.height - 60 - this.camY);
            this.ctx.fillText('0m', wX1 + 35, this.canvas.height - 35 - this.camY);
        }

        // Time Tick Labels (at integer seconds)
        if (this.dimensions === '1D') {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            this.ctx.font = '10px monospace';
            this.ctx.textAlign = 'center';
            const hSpacing = this.timeScale;
            const firstLineT = Math.floor(globalTime);
            const firstLineX = lockX - (globalTime - firstLineT) * hSpacing;

            for (let t = firstLineT; t > firstLineT - 20; t--) {
                const x = lockX - (globalTime - t) * hSpacing;
                if (x < wX1) break;
                const label = (globalTime - t).toFixed(0);
                if (label !== "0") {
                    this.ctx.fillText(`-${label}s`, x, centerY - 10);
                }
            }
        }
        
        if (!this.isFlappy) {
            if (this.dimensions === '1D') {
                this.drawFloor(centerY, globalTime);
            } else if (this.dimensions === '2D') {
                this.drawFloor(this.canvas.height - 50, 0); // Static floor aligned with 2D axis
            }
        }
    }

    drawFloor(centerY, globalTime) {
        const spacing = 20;
        const offset = (globalTime * this.timeScale) % spacing;

        this.ctx.save();
        this.ctx.strokeStyle = '#6366f1';
        this.ctx.lineWidth = 3;
        
        // Main floor line
        this.ctx.beginPath();
        this.ctx.moveTo(0, centerY);
        this.ctx.lineTo(this.canvas.width, centerY);
        this.ctx.stroke();

        // Moving Hatching
        this.ctx.beginPath();
        this.ctx.lineWidth = 1.5;
        this.ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)';
        for (let x = this.canvas.width + spacing - offset; x > -spacing; x -= spacing) {
            this.ctx.moveTo(x, centerY);
            this.ctx.lineTo(x - 12, centerY + 12);
        }
        this.ctx.stroke();
        this.ctx.restore();
    }

    drawBackground(globalTime = 0) {
        const gradient = this.ctx.createRadialGradient(
            this.canvas.width/2, this.canvas.height/2, 0, 
            this.canvas.width/2, this.canvas.height/2, Math.max(this.canvas.width, this.canvas.height)
        );

        if (this.dimensions === 'Orbital') {
            gradient.addColorStop(0, '#020617'); // Dark Space
            gradient.addColorStop(1, '#000000');
        } else {
            gradient.addColorStop(0, '#1e293b');
            gradient.addColorStop(1, '#0a0a0c');
        }
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Stars for Orbital Mode (with Parallax)
        if (this.dimensions === 'Orbital') {
            this.ctx.save();
            this.ctx.translate(this.camX * 0.2, this.camY * 0.2); // Parallax factor
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            for (let i = 0; i < 200; i++) {
                // Pseudo-random stars covering a large area for panning
                const x = (Math.sin(i * 123.45) * 10000 + 5000) % 10000 - 5000;
                const y = (Math.cos(i * 678.90) * 10000 + 5000) % 10000 - 5000;
                const size = (Math.sin(i + globalTime) + 1.5);
                this.ctx.beginPath();
                this.ctx.arc(x, y, size, 0, Math.PI * 2);
                this.ctx.fill();
            }
            this.ctx.restore();
        }
    }

    updateStats() {
        const pixelsPerMeter = 40;
        const zeroY = this.dimensions === '2D' ? this.canvas.height - 50 : this.canvas.height / 2;
        const zeroX = this.dimensions === 'Orbital' ? 0 : 50; 

        let targetX = 0, targetY = 0;
        let targetVx = 0, targetVy = 0;
        let totalEnergy = 0;

        const selected = this.particles.filter(p => p.selected);
        if (selected.length > 0) {
            let totalM = 0;
            let sumX = 0; let sumY = 0;
            let sumVx = 0; let sumVy = 0;
            let kinetic = 0;
            let potential = 0;

            selected.forEach((p, i) => {
                totalM += p.mass;
                sumX += p.mass * p.x;
                sumY += p.mass * p.y;
                sumVx += p.mass * p.vx;
                sumVy += p.mass * p.vy;
                kinetic += 0.5 * p.mass * (p.vx**2 + p.vy**2);

                if (this.dimensions === 'Orbital') {
                    for (let j = i + 1; j < selected.length; j++) {
                        const p2 = selected[j];
                        const dx = (p2.x - p.x) / this.pixelsPerMeter;
                        const dy = (p2.y - p.y) / this.pixelsPerMeter;
                        const rSoft = Math.sqrt(dx*dx + dy*dy + this.softeningEpsilon**2);
                        potential -= (this.gravityG * p.mass * p2.mass) / rSoft;
                    }
                } else {
                    const h = (zeroY - p.y) / this.pixelsPerMeter;
                    potential += p.mass * this.gravity * h;
                }
            });
            targetX = sumX / totalM;
            targetY = sumY / totalM;
            targetVx = sumVx / totalM;
            targetVy = sumVy / totalM;
            totalEnergy = kinetic + potential;
        } else if (this.particles.length > 0) {
            const p = this.activeParticle || this.particles[0];
            targetX = p.x; targetY = p.y;
            targetVx = p.vx; targetVy = p.vy;
            const kinetic = 0.5 * p.mass * (p.vx**2 + p.vy**2);
            const h = (zeroY - p.y) / pixelsPerMeter;
            const potential = p.mass * (this.dimensions === 'Orbital' ? 0 : this.gravity) * h;
            totalEnergy = kinetic + potential;
        } else {
            return;
        }

        const currentSelectedIds = selected.map(p => p.id).join(',');
        if (currentSelectedIds !== this.lastSelectedIds) {
            this.initialEnergy = null; // Selection changed, reset reference
            this.lastSelectedIds = currentSelectedIds;
        }

        if (this.dimensions === 'Orbital' && totalEnergy !== 0) {
            if (this.initialEnergy === null || this.isDragging) {
                // If dragging or new selection, we keep recalibrating reference
                this.initialEnergy = totalEnergy;
                document.getElementById('fidelity-warning')?.classList.add('hidden');
            } else if (!this.isPaused) {
                const drift = Math.abs(totalEnergy - this.initialEnergy) / (Math.abs(this.initialEnergy) + 1e-9);
                if (drift > this.energyDriftThreshold) {
                    document.getElementById('fidelity-warning')?.classList.remove('hidden');
                } else {
                    document.getElementById('fidelity-warning')?.classList.add('hidden');
                }
            }
        } else {
            document.getElementById('fidelity-warning')?.classList.add('hidden');
        }

        const relX = ((targetX - zeroX) / pixelsPerMeter).toFixed(1);
        const relY = ((zeroY - targetY) / pixelsPerMeter).toFixed(1);
        
        document.getElementById('pos-display').innerText = `(${relX}, ${relY})m`;
        document.getElementById('vel-display').innerText = `(${targetVx.toFixed(1)}, ${targetVy.toFixed(1)}) m/s`;
        document.getElementById('energy-display').innerText = `${totalEnergy.toFixed(1)} J`;
    }

    updateFormula() {
        const p = this.particles[0];
        if (!p) return;
        const v = p.vy.toFixed(1);
        const zeroY = this.dimensions === '2D' ? this.canvas.height - 50 : this.canvas.height / 2;
        const y0 = ((zeroY - p.startY) / 40).toFixed(1);
        const g = this.gravity.toFixed(2);

        let latex = "";
        if (this.mode === 'kinetics') {
            // y(t) = y_0 + v \cdot t
            latex = `y(t) = ${y0} + (${v}) \\cdot t`;
        } else {
            // y(t) = y_0 + v_0 \cdot t + \frac{1}{2} a \cdot t^2
            latex = `y(t) = ${y0} + (${v}) \\cdot t + \\frac{1}{2}(${-g}) \\cdot t^2`;
        }

        if (window.katex) {
            katex.render(latex, textEl, {
                throwOnError: false,
                displayMode: true
            });
        } else {
            textEl.innerText = latex;
        }
    }

    drawTheoreticalCurve() {
        const pixelsPerMeter = 40;
        const centerY = this.canvas.height / 2;
        const startY = this.dimensions === '2D' ? this.canvas.height - 50 : centerY;
        
        this.ctx.save();
        this.ctx.strokeStyle = '#fbbf24'; // Analysis Amber accent
        this.ctx.setLineDash([10, 5]);
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();

        const currentT = this.globalTime;

        if (this.dimensions === '1D') {
            const p = this.particles[0];
            if (!p) return;
            for (let t = currentT - 4; t <= currentT + 1; t += 0.05) {
                let y;
                if (this.mode === 'kinetics') {
                    const dt = t - p.startTime;
                    y = p.startY - (p.vy * pixelsPerMeter) * dt;
                } else {
                    const dt = t - currentT;
                    const vNow = p.vy;
                    const aDown = -this.gravity;
                    const dy = (vNow * dt + 0.5 * aDown * dt * dt);
                    y = p.y - dy * pixelsPerMeter;
                }
                const x = p.x - (currentT - t) * this.timeScale;
                if (x >= 0 && x <= this.canvas.width) {
                    if (t === currentT - 4) this.ctx.moveTo(x, y);
                    else this.ctx.lineTo(x, y);
                }
            }
        } else if (this.dimensions === '2D') {
            // 2D Spatial Trajectory
            const p = this.particles[0];
            if (!p) return;
            const vNowX = p.vx;
            const vNowY = p.vy;
            const aDown = -this.gravity;

            for (let dt = -2; dt <= 5; dt += 0.05) {
                const dx = (vNowX * dt) * pixelsPerMeter;
                const dy = (vNowY * dt + 0.5 * (this.mode === 'kinetics' ? 0 : aDown) * dt * dt) * pixelsPerMeter;
                const x = p.x + dx;
                const y = p.y - dy;

                if (x >= 0 && x <= this.canvas.width && y >= 0 && y <= this.canvas.height) {
                    if (dt === -2) this.ctx.moveTo(x, y);
                    else this.ctx.lineTo(x, y);
                }
            }
        }
        this.ctx.stroke();
        this.ctx.restore();
    }

    toggleFlappy() {
        this.isFlappy = !this.isFlappy;
        document.getElementById('flappy-overlay').classList.toggle('hidden', !this.isFlappy);
        
        if (this.isFlappy) {
            // Force dynamics mode for the game
            this.mode = 'dynamics';
            document.querySelectorAll('.tab-btn').forEach(b => {
                b.classList.remove('active');
                if (b.dataset.mode === 'dynamics') b.classList.add('active');
            });
            document.getElementById('kinetics-controls').classList.add('hidden');
            document.getElementById('dynamics-controls').classList.remove('hidden');
            this.gravity = 15; // Harder gravity for the game
            document.getElementById('gravity').value = 15;
            document.getElementById('val-gravity').innerText = "15";
            this.reset();
        } else {
            this.isGameOver = false;
            this.obstacles = [];
            document.getElementById('pause-btn').innerText = "Pause ⏸";
            document.getElementById('pause-btn').classList.remove('active');
            document.querySelector('.game-over').classList.add('hidden'); // Force hide on exit
            this.reset();
        }
    }

    spawnObstacle() {
        const gapSize = 180;
        const minHeight = 50;
        const maxHeight = this.canvas.height - gapSize - minHeight;
        const topHeight = Math.random() * (maxHeight - minHeight) + minHeight;
        
        this.obstacles.push({
            x: this.canvas.width + 50,
            topHeight: topHeight,
            gapSize: gapSize,
            width: 50,
            passed: false
        });
    }

    drawObstacles() {
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(99, 102, 241, 0.4)';
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 2;

        this.obstacles.forEach(obs => {
            // Top pipe
            this.ctx.fillRect(obs.x, 0, obs.width, obs.topHeight);
            this.ctx.strokeRect(obs.x, 0, obs.width, obs.topHeight);
            
            // Bottom pipe
            const bottomY = obs.topHeight + obs.gapSize;
            const bottomHeight = this.canvas.height - bottomY;
            this.ctx.fillRect(obs.x, bottomY, obs.width, bottomHeight);
            this.ctx.strokeRect(obs.x, bottomY, obs.width, bottomHeight);
        });
        this.ctx.restore();
    }

    animate(now = performance.now()) {
        if (!this.ctx || (this.particles.length === 0 && this.dimensions !== 'Orbital')) {
            this.lastFrameTime = now;
            requestAnimationFrame((t) => this.animate(t));
            return;
        }

        let dt = (now - this.lastFrameTime) / 1000;
        if (dt > 0.1) dt = 0; 
        this.lastFrameTime = now;
        this.accumulator += dt;
        
        while (this.accumulator >= this.fixedDeltaTime) {
            // 1. Interaction logic: Always run to allow setting velocity in pause
            if (this.isDragging && this.activeParticle) {
                if (this.dimensions === '1D') {
                    const k = 400; const damping = 15;
                    const dy_pixels = this.mouseTargetY - this.activeParticle.y;
                    const dy_meters = dy_pixels / 40;
                    const force = -k * dy_meters; 
                    const ay = (force / this.activeParticle.mass);
                    this.activeParticle.vy += ay * this.fixedDeltaTime;
                    this.activeParticle.vy *= (1 - damping * this.fixedDeltaTime);
                    // Only update Y if NOT paused in 1D
                    if (!this.isPaused) {
                        this.activeParticle.y -= (this.activeParticle.vy * 40) * this.fixedDeltaTime;
                    }
                } else {
                    const sensitivity = 0.5;
                    this.activeParticle.vx = (this.mouseTargetX - this.activeParticle.x) / 10 * sensitivity;
                    this.activeParticle.vy = -(this.mouseTargetY - this.activeParticle.y) / 10 * sensitivity;
                }
                const valVy = document.getElementById('val-vy');
                if (valVy) valVy.innerText = this.activeParticle.vy.toFixed(1);
                const valVx = document.getElementById('val-vx');
                if (valVx) valVx.innerText = this.activeParticle.vx.toFixed(1);
            }

            // 2. World Physics logic
            const isFrozenByDrag = this.isDragging && (this.dimensions === '2D' || this.dimensions === 'Orbital');
            if (!this.isPaused && !isFrozenByDrag) {
                const centerY = this.canvas.height / 2;
                if (this.dimensions === 'Orbital') {
                    this.particles.forEach(p => {
                        if (this.isDragging && p === this.activeParticle) return;
                        p.updatePositionVerlet(this.fixedDeltaTime);
                    });

                    const newAccels = this.calculateAccelerations();

                    this.particles.forEach((p, i) => {
                        if (this.isDragging && p === this.activeParticle) {
                            p.ax = newAccels[i].ax; p.ay = newAccels[i].ay;
                            return;
                        }
                        p.updateVelocityVerlet(this.fixedDeltaTime, newAccels[i].ax, newAccels[i].ay);
                    });
                } else {
                    const p = this.particles[0];
                    if (p && !(this.isDragging && p === this.activeParticle)) {
                        if (this.mode === 'kinetics') {
                            const elapsedSinceStart = this.globalTime - p.startTime;
                            p.updateKinetic(elapsedSinceStart, this.dimensions); 
                            const limitY = this.dimensions === '2D' ? this.canvas.height : centerY;
                            if (p.y >= limitY) {
                                p.vy = Math.abs(p.vy); p.y = limitY;
                                p.resetStartTime(this.globalTime, p.x, p.y);
                            } else if (p.y < 0) {
                                p.vy = -Math.abs(p.vy); p.y = 0;
                                p.resetStartTime(this.globalTime, p.x, p.y);
                            }
                        } else {
                            p.updatePositionVerlet(this.fixedDeltaTime);
                            p.updateVelocityVerlet(this.fixedDeltaTime, 0, -this.gravity);
                            const limitY = this.dimensions === '2D' ? this.canvas.height : centerY;
                            if (p.y >= limitY) {
                                p.y = limitY; p.vy = Math.abs(p.vy) * 0.8; p.ay = 0;
                            } else if (p.y < 0) {
                                p.vy = -Math.abs(p.vy) * 0.8; p.y = 0;
                            }
                            if (this.dimensions === '2D') {
                                if (p.x >= this.canvas.width) { p.vx = -Math.abs(p.vx) * 0.8; p.x = this.canvas.width; }
                                else if (p.x <= 0) { p.vx = Math.abs(p.vx) * 0.8; p.x = 0; }
                            }
                            if (this.isFlappy && (p.y >= this.canvas.height || p.y <= 0)) {
                                this.isGameOver = true;
                                document.querySelector('.game-over').classList.remove('hidden');
                            }
                        }
                    }
                }
                
                // Only move time and history if not paused
                this.globalTime += this.fixedDeltaTime;
                this.particles.forEach(p => p.addHistory(p.x, p.y, this.globalTime));
            }

            if (this.isFlappy && !this.isGameOver && !this.isPaused) {
                this.spawnTimer += this.fixedDeltaTime;
                if (this.spawnTimer > 2.0) { this.spawnObstacle(); this.spawnTimer = 0; }
                this.obstacles.forEach(obs => {
                    obs.x -= 3;
                    this.particles.forEach(p => {
                        if (!obs.passed && obs.x + obs.width < p.x) {
                            obs.passed = true;
                            this.score++;
                            document.getElementById('score-val').innerText = this.score;
                        }
                        if (p.x + p.radius > obs.x && p.x - p.radius < obs.x + obs.width) {
                            if (p.y - p.radius < obs.topHeight || p.y + p.radius > obs.topHeight + obs.gapSize) {
                                this.isGameOver = true;
                                document.querySelector('.game-over').classList.remove('hidden');
                            }
                        }
                    });
                });
                this.obstacles = this.obstacles.filter(obs => obs.x + obs.width > -50);
            }

            if (this.dimensions === 'Orbital' && !this.isPaused) {
                const selected = this.particles.filter(p => p.selected);
                if (selected.length > 0) {
                    let totalM = 0; let sumX = 0; let sumY = 0;
                    selected.forEach(p => {
                        totalM += p.mass; sumX += p.mass * p.x; sumY += p.mass * p.y;
                    });
                    this.comHistory.push({x: sumX / totalM, y: sumY / totalM});
                    if (this.comHistory.length > 400) this.comHistory.shift();
                }
            }

            this.accumulator -= this.fixedDeltaTime;
        }

        if (this.followingCoM && this.dimensions === 'Orbital') this.updateStickyCenter();

        this.drawBackground(this.globalTime);
        this.ctx.save();
        this.ctx.translate(this.camX, this.camY);
        this.drawAxes(this.globalTime);
        if (this.isFlappy) this.drawObstacles();
        this.particles.forEach(p => p.draw(this.ctx, this.globalTime, this.timeScale, this.dimensions));
        if (this.isPaused) this.drawTheoreticalCurve();
        this.ctx.restore();

        this.drawMinimap();
        this.updateStats();
        requestAnimationFrame((t) => this.animate(t));
    }

    drawMinimap() {
        if (this.dimensions !== 'Orbital' || this.particles.length === 0) return;
        
        const mapWidth = 240;
        const aspectRatio = this.canvas.height / this.canvas.width;
        const mapHeight = mapWidth * aspectRatio;
        const padding = 20;
        const x = this.canvas.width - mapWidth - padding;
        const y = padding;

        this.ctx.save();
        // Background
        this.ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, mapWidth, mapHeight, 12);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.clip();

        // Calculate world bounds
        let minX = -1000, maxX = 1000, minY = -1000, maxY = 1000;
        this.particles.forEach(p => {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        });
        
        // Include viewport in bounds
        const viewW = this.canvas.width;
        const viewH = this.canvas.height;
        const vX1 = -this.camX, vY1 = -this.camY;
        const vX2 = -this.camX + viewW, vY2 = -this.camY + viewH;
        
        minX = Math.min(minX, vX1); maxX = Math.max(maxX, vX2);
        minY = Math.min(minY, vY1); maxY = Math.max(maxY, vY2);

        const worldW = (maxX - minX) * 1.2;
        const worldH = (maxY - minY) * 1.2;
        
        // Match minimap aspect ratio scale
        const mapScale = Math.min(mapWidth / worldW, mapHeight / worldH);
        
        const centerWorldX = (minX + maxX) / 2;
        const centerWorldY = (minY + maxY) / 2;

        const toMapX = (wx) => x + mapWidth/2 + (wx - centerWorldX) * mapScale;
        const toMapY = (wy) => y + mapHeight/2 + (wy - centerWorldY) * mapScale;

        // Draw Viewport
        this.ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
        this.ctx.strokeRect(toMapX(vX1), toMapY(vY1), viewW * mapScale, viewH * mapScale);

        // Draw Particles
        this.particles.forEach(p => {
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(toMapX(p.x), toMapY(p.y), Math.max(2, p.radius * mapScale), 0, Math.PI * 2);
            this.ctx.fill();
        });

        this.ctx.restore();
    }

    updateParticleList() {
        const list = document.getElementById('particle-list');
        if (!list) return;
        list.innerHTML = "";

        this.particles.forEach((p, index) => {
            const item = document.createElement('div');
            item.className = 'particle-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = p.selected;
            checkbox.onclick = (e) => {
                p.selected = e.target.checked;
                this.initialEnergy = null; 
                e.stopPropagation();
            };

            const dot = document.createElement('div');
            dot.className = 'pt-color-dot';
            dot.style.backgroundColor = p.color;

            const name = document.createElement('span');
            name.className = 'pt-name';
            name.innerText = `Body ${index + 1} (${p.mass}kg)`;

            const actions = document.createElement('div');
            actions.className = 'pt-actions';
            
            const centerBtn = document.createElement('button');
            centerBtn.innerText = "Center";
            centerBtn.onclick = (e) => {
                this.camX = (this.canvas.width / 2) - p.x;
                this.camY = (this.canvas.height / 2) - p.y;
                e.stopPropagation();
            };

            const deleteBtn = document.createElement('button');
            deleteBtn.innerText = "×";
            deleteBtn.onclick = (e) => {
                this.particles.splice(index, 1);
                this.initialEnergy = null;
                this.updateParticleList();
                e.stopPropagation();
            };

            item.appendChild(checkbox);
            item.appendChild(dot);
            item.appendChild(name);
            actions.appendChild(centerBtn);
            actions.appendChild(deleteBtn);
            item.appendChild(actions);
            
            list.appendChild(item);
        });
    }

    updateStickyCenter() {
        const selected = this.particles.filter(p => p.selected);
        if (selected.length === 0) return;

        let totalM = 0; let sumX = 0; let sumY = 0;
        selected.forEach(p => {
            totalM += p.mass;
            sumX += p.mass * p.x;
            sumY += p.mass * p.y;
        });
        const comWorldX = sumX / totalM;
        const comWorldY = sumY / totalM;

        this.camX = (this.canvas.width / 2) - comWorldX;
        this.camY = (this.canvas.height / 2) - comWorldY;
    }

    calculateAccelerations() {
        const accels = this.particles.map(() => ({ ax: 0, ay: 0 }));
        
        for (let i = 0; i < this.particles.length; i++) {
            const p1 = this.particles[i];
            for (let j = i + 1; j < this.particles.length; j++) {
                const p2 = this.particles[j];
                
                const dx = (p2.x - p1.x) / this.pixelsPerMeter;
                const dy = (p2.y - p1.y) / this.pixelsPerMeter;
                
                // Plummer Softening for faithful constant-energy orbits
                // Force = G*M1*M2 * r / (r^2 + eps^2)^(3/2)
                const r2 = dx*dx + dy*dy;
                const distSoft3 = Math.pow(r2 + this.softeningEpsilon**2, 1.5);
                
                const fCommon = (this.gravityG * p1.mass * p2.mass) / distSoft3;
                
                const fx = fCommon * dx;
                const fy = fCommon * dy;
                
                accels[i].ax += fx / p1.mass;
                accels[i].ay -= fy / p1.mass; // Screen Y is inverted
                
                accels[j].ax -= fx / p2.mass;
                accels[j].ay += fy / p2.mass;
            }
        }
        return accels;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Simulation();
});
