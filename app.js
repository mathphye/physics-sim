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
        
        this.radius = 15;
        this.mass = 10;
        this.color = '#38bdf8';
        this.borderColor = '#ffffff';
        this.borderWidth = 4;

        this.history = []; // Stores {y, time}
    }

    // Explicit Kinematic Update: P = P0 + V*t
    updateKinetic(t) {
        // 1D: X is fixed, only Y moves
        this.y = this.startY - (this.vy * this.pixelsPerMeter) * t;
    }

    // Recursive Dynamic Update
    updateDynamic(dt, gravity) {
        this.ay = -gravity;
        this.vy += this.ay * dt;
        this.y -= (this.vy * this.pixelsPerMeter) * dt; 
    }

    addHistory(y, time) {
        this.history.push({y, time});
        if (this.history.length > 500) this.history.shift();
    }

    resetStartTime(currentTime, x, y) {
        this.startTime = currentTime;
        this.startX = x;
        this.startY = y;
        // History is NOT cleared here to allow continuous graph visualization
    }

    draw(ctx, globalTime, timeScale) {
        // Ghost Trail (Temporal History)
        if (this.history.length > 1) {
            ctx.save();
            
            // 1. Shadow Ribbon (The volume the particle has occupied)
            ctx.beginPath();
            ctx.lineWidth = this.radius * 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            for (let i = 1; i < this.history.length; i++) {
                const p1 = this.history[i - 1];
                const p2 = this.history[i];
                const x1 = this.x - (globalTime - p1.time) * timeScale;
                const x2 = this.x - (globalTime - p2.time) * timeScale;
                
                if (x2 < 0 && x1 < 0) continue;

                const alpha = (i / this.history.length) * 0.07; // 50% more transparent
                ctx.beginPath();
                ctx.strokeStyle = `rgba(99, 102, 241, ${alpha})`;
                ctx.moveTo(x1, p1.y);
                ctx.lineTo(x2, p2.y);
                ctx.stroke();
            }

            // 2. Discrete "Ghosts" (Faded copies of the particle)
            for (let i = 0; i < this.history.length; i += 40) {
                const pt = this.history[i];
                const xPos = this.x - (globalTime - pt.time) * timeScale;
                if (xPos < 0 || xPos > this.x - this.radius) continue;

                const alpha = (i / this.history.length) * 0.05; // 50% more transparent
                
                // Ghost Body
                ctx.beginPath();
                ctx.arc(xPos, pt.y, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
                ctx.fill();
                
                // Ghost Rim
                ctx.beginPath();
                ctx.arc(xPos, pt.y, this.radius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            // 3. Mathematical path (The spine)
            ctx.beginPath();
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 2; // Doubled thickness
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
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

        // Horizontal height reference
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.moveTo(0, this.y);
        ctx.lineTo(this.x, this.y);
        ctx.stroke();

        // Velocity Vector
        this.drawVector(ctx, this.x, this.y, 0, -this.vy * 40, '#6366f1');

        // Main Particle
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + this.borderWidth / 2, 0, Math.PI * 2);
        ctx.strokeStyle = this.borderColor;
        ctx.lineWidth = this.borderWidth;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(this.x - 5, this.y - 5, 3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.fill();
    }

    drawVector(ctx, x, y, vx, vy, color) {
        if (Math.abs(vy) < 0.1) return;
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
        this.mouseTargetY = 0; // Virtual spring target
        
        // Flappy Mode State
        this.isFlappy = false;
        this.obstacles = [];
        this.score = 0;
        this.isGameOver = false;
        this.spawnTimer = 0;

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
        
        const lockX = this.canvas.width * 0.8;
        const startY = this.canvas.height / 2;
        const velInput = document.getElementById('vel-y');
        const massInput = document.getElementById('mass');
        
        this.particle = new Particle(lockX, startY);
        this.particle.resetStartTime(0, lockX, startY);
        
        if (massInput) this.particle.mass = parseFloat(massInput.value);
        if (this.mode === 'kinetics' && velInput) {
            this.particle.vy = parseFloat(velInput.value) || 0;
        }
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
                this.particle.vy = parseFloat(e.target.value);
                if (this.mode === 'kinetics') {
                    this.particle.resetStartTime(this.globalTime, this.particle.x, this.particle.y);
                }
                updateVal('vy', e.target.value);
            });
        }

        document.getElementById('mass').addEventListener('input', (e) => {
            this.particle.mass = parseFloat(e.target.value);
            updateVal('mass', e.target.value);
        });

        document.getElementById('gravity').addEventListener('input', (e) => {
            this.gravity = parseFloat(e.target.value);
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
                // Set velocity to 10 m/s for precise experimental verification
                this.particle.vy = 10; 
                if (this.mode === 'kinetics') {
                    this.particle.resetStartTime(this.globalTime, this.particle.x, this.particle.y);
                    // Sync Slider
                    const vInput = document.getElementById('vel-y');
                    if (vInput) vInput.value = 10;
                }
                updateVal('vy', "10.0");
                if (this.isPaused) this.updateFormula();
            });
        }

        document.getElementById('pause-btn').addEventListener('click', (e) => {
            this.isPaused = !this.isPaused;
            e.target.innerText = this.isPaused ? "Resume" : "Pause";
            e.target.classList.toggle('active', this.isPaused);
            document.getElementById('formula-overlay').classList.toggle('hidden', !this.isPaused);
            if (this.isPaused) this.updateFormula();
        });

        document.getElementById('reset-btn').addEventListener('click', () => {
            this.isPaused = false;
            document.getElementById('pause-btn').innerText = "Pause";
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

        // Easter Egg: Flappy Mode
        document.getElementById('easter-egg-btn').addEventListener('click', () => {
            this.toggleFlappy();
        });

        // Initialize display values from DOM
        updateVal('mass', document.getElementById('mass')?.value);
        updateVal('gravity', document.getElementById('gravity')?.value);
        updateVal('time-scale', document.getElementById('time-scale')?.value);
        updateVal('vy', document.getElementById('vel-y')?.value);

        this.canvas.addEventListener('mousedown', (e) => {
            if (this.isFlappy && !this.isGameOver) {
                this.particle.vy = 8; // Flappy Jump
                return;
            }
            this.handleMouseDown(e);
        });
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.isDragging = false);
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

    drawAxes(globalTime) {
        const centerY = this.canvas.height / 2;
        const lockX = this.canvas.width * 0.8;
        
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 1.5;
        this.ctx.setLineDash([2, 4]);
        
        // Vertical Reference Axis
        this.ctx.beginPath();
        this.ctx.moveTo(lockX, 0);
        this.ctx.lineTo(lockX, this.canvas.height);
        this.ctx.stroke();

        // Horizontal Zero-Height Axis
        this.ctx.beginPath();
        this.ctx.moveTo(0, centerY);
        this.ctx.lineTo(this.canvas.width, centerY);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.font = '12px Outfit';
        this.ctx.fillText('Height (m)', lockX + 10, 20);
        this.ctx.fillText('Time (t)', 20, centerY + 20);
        this.ctx.fillText('0m', lockX + 5, centerY + 15);

        // Time Tick Labels (at integer seconds)
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.font = '10px monospace';
        this.ctx.textAlign = 'center';
        const hSpacing = this.timeScale;
        const firstLineT = Math.floor(globalTime);
        const firstLineX = lockX - (globalTime - firstLineT) * hSpacing;

        for (let t = firstLineT; t > firstLineT - 20; t--) {
            const x = lockX - (globalTime - t) * hSpacing;
            if (x < 0) break;
            const label = (globalTime - t).toFixed(0);
            if (label !== "0") {
                this.ctx.fillText(`-${label}s`, x, centerY - 10);
            }
        }
        
        this.ctx.restore();
        
        if (!this.isFlappy) {
            this.drawFloor(centerY, globalTime);
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
        const vSpacing = 40; // 1m = 40px
        const hSpacing = this.timeScale; // 1s = timeScale px
        const lockX = this.canvas.width * 0.8;
        
        const offset = (globalTime * this.timeScale) % hSpacing;

        const gradient = this.ctx.createRadialGradient(
            this.canvas.width/2, this.canvas.height/2, 0, 
            this.canvas.width/2, this.canvas.height/2, Math.max(this.canvas.width, this.canvas.height)
        );
        gradient.addColorStop(0, '#1e293b');
        gradient.addColorStop(1, '#0a0a0c');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.beginPath();
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        
        // Vertical lines (Representing 1-Second Intervals relative to Particle)
        for (let x = lockX - (globalTime % 1) * hSpacing; x >= 0; x -= hSpacing) {
            this.ctx.moveTo(x, 0); this.ctx.lineTo(x, this.canvas.height);
        }
        for (let x = lockX - (globalTime % 1) * hSpacing + hSpacing; x <= this.canvas.width; x += hSpacing) {
            this.ctx.moveTo(x, 0); this.ctx.lineTo(x, this.canvas.height);
        }
        
        // Horizontal lines (Representing 1-Meter Intervals)
        for (let y = 0; y <= this.canvas.height; y += vSpacing) {
            this.ctx.moveTo(0, y); this.ctx.lineTo(this.canvas.width, y);
        }
        this.ctx.stroke();
    }

    updateStats() {
        const centerY = this.canvas.height / 2;
        const pixelsPerMeter = 40;
        const relY = ((centerY - this.particle.y) / pixelsPerMeter).toFixed(2);
        document.getElementById('pos-display').innerText = `${relY}m`;
        document.getElementById('vel-display').innerText = `${this.particle.vy.toFixed(1)} m/s`;
    }

    updateFormula() {
        const textEl = document.getElementById('formula-text');
        const v = this.particle.vy.toFixed(1);
        const y0 = ((this.canvas.height / 2 - this.particle.startY) / 40).toFixed(1);
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
        
        this.ctx.save();
        this.ctx.strokeStyle = '#fbbf24'; // Analysis Amber accent
        this.ctx.setLineDash([10, 5]);
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();

        // Draw the curve for a 5-second window around the current point
        const currentT = this.globalTime;
        for (let t = currentT - 4; t <= currentT + 1; t += 0.05) {
            let y;
            if (this.mode === 'kinetics') {
                const dt = t - this.particle.startTime;
                y = this.particle.startY - (this.particle.vy * pixelsPerMeter) * dt;
            } else {
                const dt = t - currentT;
                const vNow = this.particle.vy;
                const aDown = -this.gravity;
                const dy = (vNow * dt + 0.5 * aDown * dt * dt);
                y = this.particle.y - dy * pixelsPerMeter;
            }

            const x = this.particle.x - (currentT - t) * this.timeScale;
            if (x >= 0 && x <= this.canvas.width) {
                if (t === currentT - 4) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
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
        if (!this.ctx || !this.particle) {
            requestAnimationFrame((t) => this.animate(t));
            return;
        }

        let dt = this.isPaused ? 0 : (now - this.lastFrameTime) / 1000;
        
        // Cap dt to prevent physics "explosion" when returning from background
        // If the gap is larger than 100ms, we assume a pause/background event
        if (dt > 0.1) dt = 0; 

        this.lastFrameTime = now;
        
        // Stabilize physics and trail with sub-stepping
        this.accumulator += dt;
        
        while (this.accumulator >= this.fixedDeltaTime) {
            if (!this.isPaused) {
                const centerY = this.canvas.height / 2;
                
                if (this.isDragging) {
                    // Virtual Spring Drag (F = -k*x - damping*v)
                    const k = 400; // Spring stiffness
                    const damping = 15; // Damping
                    
                    // Pixels to Meters conversion for force
                    // In our engine y -= vy*dt, so to move DOWN (increase y), 
                    // we need a NEGATIVE velocity.
                    const dy_pixels = this.mouseTargetY - this.particle.y;
                    const dy_meters = dy_pixels / 40;
                    
                    // If target is BELOW (dy_pixels > 0), force should be NEGATIVE
                    // to make vy negative and thus increase y.
                    const force = -k * dy_meters; 
                    
                    const ay = (force / this.particle.mass);
                    this.particle.vy += ay * this.fixedDeltaTime;
                    this.particle.vy *= (1 - damping * this.fixedDeltaTime); // Apply damping
                    
                    this.particle.y -= (this.particle.vy * 40) * this.fixedDeltaTime;

                    // Sync UI during drag
                    const vInput = document.getElementById('vel-y');
                    if (vInput) vInput.value = this.particle.vy;
                    const valVy = document.getElementById('val-vy');
                    if (valVy) valVy.innerText = this.particle.vy.toFixed(1);

                    if (this.mode === 'kinetics') {
                        this.particle.resetStartTime(this.globalTime, this.particle.x, this.particle.y);
                    }
                } else if (this.mode === 'kinetics') {
                    const elapsedSinceStart = this.globalTime - this.particle.startTime;
                    this.particle.updateKinetic(elapsedSinceStart); 
                    
                    let bounced = false;
                    if (this.particle.y >= centerY) {
                        this.particle.vy = Math.abs(this.particle.vy);
                        this.particle.y = centerY;
                        this.particle.resetStartTime(this.globalTime, this.particle.x, this.particle.y);
                        bounced = true;
                    }
                    if (this.particle.y < 0) {
                        this.particle.vy = -Math.abs(this.particle.vy);
                        this.particle.y = 0;
                        this.particle.resetStartTime(this.globalTime, this.particle.x, this.particle.y);
                        bounced = true;
                    }

                    // Sync UI slider with physics if a bounce happened
                    if (bounced) {
                        const vInput = document.getElementById('vel-y');
                        if (vInput) {
                            vInput.value = this.particle.vy;
                            const valVy = document.getElementById('val-vy');
                            if (valVy) valVy.innerText = this.particle.vy.toFixed(1);
                        }
                    }
                } else {
                    this.particle.updateDynamic(this.fixedDeltaTime, this.gravity);
                    
                    if (this.isFlappy) {
                        // Game Over on hitting floor or ceiling
                        if (this.particle.y >= this.canvas.height || this.particle.y <= 0) {
                            this.isGameOver = true;
                            document.querySelector('.game-over').classList.remove('hidden');
                        }
                    } else {
                        // Regular Bounce logic (Floor is centerY)
                        if (this.particle.y >= centerY) {
                            if (Math.abs(this.particle.vy) < 0.2) {
                                this.particle.vy = 0;
                                this.particle.y = centerY;
                            } else {
                                this.particle.vy = Math.abs(this.particle.vy) * 0.8;
                                this.particle.y = centerY;
                            }
                        }
                        // Bounce on top wall
                        if (this.particle.y < 0) {
                            this.particle.vy = -Math.abs(this.particle.vy) * 0.8;
                            this.particle.y = 0;
                        }
                    }
                }
            }
            
            
            // Fixed sample rate for history ensures uniform trail
            this.particle.addHistory(this.particle.y, this.globalTime);

            if (this.isFlappy && !this.isGameOver) {
                this.spawnTimer += this.fixedDeltaTime;
                if (this.spawnTimer > 2.0) { // Spawn every 2 seconds
                    this.spawnObstacle();
                    this.spawnTimer = 0;
                }

                // Move obstacles
                this.obstacles.forEach(obs => {
                    obs.x -= 3; // Game Speed
                    
                    // Score counting
                    if (!obs.passed && obs.x + obs.width < this.particle.x) {
                        obs.passed = true;
                        this.score++;
                        document.getElementById('score-val').innerText = this.score;
                    }

                    // Collision detection
                    const p = this.particle;
                    if (p.x + p.radius > obs.x && p.x - p.radius < obs.x + obs.width) {
                        if (p.y - p.radius < obs.topHeight || p.y + p.radius > obs.topHeight + obs.gapSize) {
                            this.isGameOver = true;
                            document.querySelector('.game-over').classList.remove('hidden');
                        }
                    }
                });

                // Cleanup
                this.obstacles = this.obstacles.filter(obs => obs.x + obs.width > -50);
            }

            this.globalTime += this.fixedDeltaTime;
            this.accumulator -= this.fixedDeltaTime;
        }

        this.drawBackground(this.globalTime);
        this.drawAxes(this.globalTime);
        if (this.isFlappy) this.drawObstacles();
        this.particle.draw(this.ctx, this.globalTime, this.timeScale);
        if (this.isPaused) this.drawTheoreticalCurve();
        this.updateStats();
        requestAnimationFrame((t) => this.animate(t));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Simulation();
});
