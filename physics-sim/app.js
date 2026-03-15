class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.pixelsPerMeter = 40;
        
        // Initial state for kinematic equations (Kinetics)
        this.startX = x;
        this.startY = y;
        this.startTime = 0;
        
        // State variables (all in m/s or m/s^2)
        this.vx = 0;
        this.vy = 0;
        this.ax = 0;
        this.ay = 0;
        
        this.radius = 15;
        this.mass = 10;
        this.color = '#38bdf8';
        this.borderColor = '#ffffff';
        this.borderWidth = 4;

        this.history = [];
    }

    // Explicit Kinematic Update: P = P0 + V*t
    updateKinetic(t) {
        this.x = this.startX + (this.vx * this.pixelsPerMeter) * t;
        this.y = this.startY - (this.vy * this.pixelsPerMeter) * t;

        this.history.push({x: this.x, y: this.y});
        if (this.history.length > 100) this.history.shift();
    }

    // Recursive Dynamic Update
    updateDynamic(dt, gravity) {
        this.ay = -gravity;
        this.vx += this.ax * dt;
        this.vy += this.ay * dt;
        
        this.x += (this.vx * this.pixelsPerMeter) * dt;
        this.y -= (this.vy * this.pixelsPerMeter) * dt;

        this.history.push({x: this.x, y: this.y});
        if (this.history.length > 50) this.history.shift();
    }

    resetStartTime(currentTime, x, y) {
        this.startTime = currentTime;
        this.startX = x;
        this.startY = y;
        this.history = [];
    }

    draw(ctx) {
        // Path
        if (this.history.length > 1) {
            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.moveTo(this.history[0].x, this.history[0].y);
            for (let point of this.history) {
                ctx.lineTo(point.x, point.y);
            }
            ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Velocity Vector (scaled: 1m/s = 40px/1 grid square)
        // Note: Cartesian Y-up means we must invert the drawing for the canvas Y-down
        this.drawVector(ctx, this.x, this.y, this.vx * 40, -this.vy * 40, '#6366f1');

        // Particle
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
        if (Math.abs(vx) < 0.1 && Math.abs(vy) < 0.1) return;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + vx, y + vy);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
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
        this.gravity = 9.81; // Standard gravity
        this.particle = null;
        this.isDragging = false;
        this.globalTime = 0;
        this.lastFrameTime = performance.now();

        this.init();
        this.animate();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.reset();
        this.setupUI();
    }

    reset() {
        this.globalTime = 0;
        this.particle = new Particle(this.canvas.width / 2, this.canvas.height / 2);
        this.particle.resetStartTime(0, this.particle.x, this.particle.y);
        
        if (this.mode === 'kinetics') {
            this.particle.vx = parseFloat(document.getElementById('vel-x').value);
            this.particle.vy = parseFloat(document.getElementById('vel-y').value);
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
                    desc.innerHTML = "<strong>Kinetics:</strong> Calculating position directly using <code>P = P₀ + V·t</code>. Explicit formula, no forces.";
                    this.reset();
                } else {
                    desc.innerHTML = "<strong>Dynamics:</strong> Updating state frame-by-frame using <code>F = m·a</code>. Iterative integration with gravity.";
                }
            });
        });

        const updateVal = (id, val) => document.getElementById('val-' + id).innerText = val;

        document.getElementById('vel-x').addEventListener('input', (e) => {
            this.particle.vx = parseFloat(e.target.value);
            if (this.mode === 'kinetics') {
                this.particle.resetStartTime(this.globalTime, this.particle.x, this.particle.y);
            }
            updateVal('vx', e.target.value);
        });

        document.getElementById('vel-y').addEventListener('input', (e) => {
            this.particle.vy = parseFloat(e.target.value);
            if (this.mode === 'kinetics') {
                this.particle.resetStartTime(this.globalTime, this.particle.x, this.particle.y);
            }
            updateVal('vy', e.target.value);
        });

        document.getElementById('mass').addEventListener('input', (e) => {
            this.particle.mass = parseFloat(e.target.value);
            updateVal('mass', e.target.value);
        });

        document.getElementById('gravity').addEventListener('input', (e) => {
            this.gravity = parseFloat(e.target.value);
            updateVal('gravity', e.target.value);
        });

        document.getElementById('apply-force').addEventListener('click', () => {
            // Apply a vertical impulse in m/s
            this.particle.vy += 10;
        });

        document.getElementById('reset-btn').addEventListener('click', () => this.reset());

        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
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
            this.particle.vx = 0;
            this.particle.vy = 0;
            this.particle.history = [];
        }
    }

    handleMouseMove(e) {
        if (this.isDragging) {
            const rect = this.canvas.getBoundingClientRect();
            this.particle.x = e.clientX - rect.left;
            this.particle.y = e.clientY - rect.top;
            this.particle.resetStartTime(this.globalTime, this.particle.x, this.particle.y);
        }
    }

    resize() {
        const parent = this.canvas.parentElement;
        this.canvas.width = parent.clientWidth;
        this.canvas.height = parent.clientHeight;
    }

    drawAxes() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 1.5;
        this.ctx.setLineDash([2, 4]); // Dashed lines for axes as reference
        
        // X Axis
        this.ctx.beginPath();
        this.ctx.moveTo(0, centerY);
        this.ctx.lineTo(this.canvas.width, centerY);
        this.ctx.stroke();
        
        // Y Axis
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, 0);
        this.ctx.lineTo(centerX, this.canvas.height);
        this.ctx.stroke();
        
        // Axis Labels
        this.ctx.setLineDash([]);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.font = '12px Outfit';
        this.ctx.fillText('X', this.canvas.width - 20, centerY - 10);
        this.ctx.fillText('Y', centerX + 10, 20);
        
        // Origin Marker (0,0)
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
        this.ctx.fillStyle = 'var(--accent-color)';
        this.ctx.fill();
        this.ctx.fillText('(0,0)', centerX + 5, centerY + 15);
        
        this.ctx.restore();
    }

    drawBackground() {
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
        this.ctx.lineWidth = 1;
        const gridSize = 40;
        for (let x = 0; x <= this.canvas.width; x += gridSize) {
            this.ctx.moveTo(x, 0); this.ctx.lineTo(x, this.canvas.height);
        }
        for (let y = 0; y <= this.canvas.height; y += gridSize) {
            this.ctx.moveTo(0, y); this.ctx.lineTo(this.canvas.width, y);
        }
        this.ctx.stroke();
    }

    updateStats() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const pixelsPerMeter = 40;
        
        const relX = ((this.particle.x - centerX) / pixelsPerMeter).toFixed(2);
        const relY = ((centerY - this.particle.y) / pixelsPerMeter).toFixed(2);
        
        document.getElementById('pos-display').innerText = `X: ${relX}m, Y: ${relY}m`;
        
        const speed = Math.hypot(this.particle.vx, this.particle.vy).toFixed(1);
        document.getElementById('vel-display').innerText = `${speed} m/s`;
    }

    animate(now = performance.now()) {
        const dt = (now - this.lastFrameTime) / 1000;
        this.lastFrameTime = now;
        this.globalTime += dt;

        this.drawBackground();
        if (this.mode === 'kinetics') this.drawAxes();
        
        if (!this.isDragging) {
            if (this.mode === 'kinetics') {
                const elapsedSinceStart = this.globalTime - this.particle.startTime;
                this.particle.updateKinetic(elapsedSinceStart); 

                // Bounce with reset
                if (this.particle.x < 0 || this.particle.x > this.canvas.width) {
                    this.particle.vx *= -1;
                    this.particle.x = Math.max(0, Math.min(this.canvas.width, this.particle.x));
                    this.particle.resetStartTime(this.globalTime, this.particle.x, this.particle.y);
                }
                if (this.particle.y < 0 || this.particle.y > this.canvas.height) {
                    this.particle.vy *= -1;
                    this.particle.y = Math.max(0, Math.min(this.canvas.height, this.particle.y));
                    this.particle.resetStartTime(this.globalTime, this.particle.x, this.particle.y);
                }
            } else {
                this.particle.updateDynamic(dt, this.gravity);
                if (this.particle.x < 0 || this.particle.x > this.canvas.width) this.particle.vx *= -0.8;
                if (this.particle.y < 0 || this.particle.y > this.canvas.height) this.particle.vy *= -0.8;
                this.particle.x = Math.max(0, Math.min(this.canvas.width, this.particle.x));
                this.particle.y = Math.max(0, Math.min(this.canvas.height, this.particle.y));
            }
        }

        this.particle.draw(this.ctx);
        this.updateStats();
        requestAnimationFrame((t) => this.animate(t));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Simulation();
});



