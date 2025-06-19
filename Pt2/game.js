// Game canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state
let gameState = {
    running: true,
    winner: null,
    gameTime: 180, // 180 seconds = 3 minutes
    currentTime: 180,
    gameStartTime: Date.now()
};

// Physics constants
const GRAVITY = 0.8;
const JUMP_FORCE = -15;
const MOVE_SPEED = 5;
const ROLL_DISTANCE = 100; // Distance to roll forward
const BOUNCE_FORCE = 8; // Force applied when characters touch
const BOUNCER_FORCE = -25; // Force applied by bouncers

// Bouncer class
class Bouncer {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 50;  // Bigger bouncer
        this.height = 25; // Bigger bouncer
        this.animationFrame = 0;
        this.pulseSpeed = 0.15;
    }

    update() {
        this.animationFrame += this.pulseSpeed;
    }

    draw() {
        ctx.save();
        
        // Bouncer glow effect
        const pulse = Math.sin(this.animationFrame) * 0.3 + 0.7;
        const glowRadius = 30 + Math.sin(this.animationFrame * 2) * 10;
        
        // Outer glow
        const gradient = ctx.createRadialGradient(
            this.x + this.width/2, this.y + this.height/2, 0,
            this.x + this.width/2, this.y + this.height/2, glowRadius
        );
        gradient.addColorStop(0, `rgba(255, 255, 0, ${pulse * 0.8})`);
        gradient.addColorStop(0.5, `rgba(255, 255, 0, ${pulse * 0.4})`);
        gradient.addColorStop(1, 'rgba(255, 255, 0, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(this.x - glowRadius, this.y - glowRadius, 
                    this.width + glowRadius * 2, this.height + glowRadius * 2);
        
        // Bouncer body
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Bouncer details
        ctx.fillStyle = '#FFA500';
        ctx.fillRect(this.x + 8, this.y + 5, this.width - 16, this.height - 10);
        
        // Bouncer eyes
        ctx.fillStyle = '#000';
        ctx.fillRect(this.x + 12, this.y + 8, 4, 4);
        ctx.fillRect(this.x + 34, this.y + 8, 4, 4);
        
        // Bouncer smile
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x + this.width/2, this.y + this.height/2 + 3, 8, 0, Math.PI);
        ctx.stroke();
        
        ctx.restore();
    }

    checkBounce(character) {
        // Check if character is standing on bouncer
        if (character.x < this.x + this.width &&
            character.x + character.width > this.x &&
            character.y + character.height >= this.y &&
            character.y + character.height <= this.y + this.height + 5 &&
            character.velocityY >= 0) {
            
            // Bounce the character up
            character.velocityY = BOUNCER_FORCE;
            character.y = this.y - character.height;
            character.onGround = false;
            
            return true;
        }
        return false;
    }
}

// Portal class
class Portal {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 60;
        this.animationFrame = 0;
        this.pulseSpeed = 0.1;
        this.teleportCooldown = 0;
    }

    update() {
        // Animate portal
        this.animationFrame += this.pulseSpeed;
        if (this.teleportCooldown > 0) {
            this.teleportCooldown--;
        }
    }

    draw() {
        ctx.save();
        
        // Portal glow effect
        const pulse = Math.sin(this.animationFrame) * 0.3 + 0.7;
        const glowRadius = 30 + Math.sin(this.animationFrame * 2) * 10;
        
        // Outer glow
        const gradient = ctx.createRadialGradient(
            this.x + this.width/2, this.y + this.height/2, 0,
            this.x + this.width/2, this.y + this.height/2, glowRadius
        );
        gradient.addColorStop(0, `rgba(138, 43, 226, ${pulse * 0.8})`);
        gradient.addColorStop(0.5, `rgba(138, 43, 226, ${pulse * 0.4})`);
        gradient.addColorStop(1, 'rgba(138, 43, 226, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(this.x - glowRadius, this.y - glowRadius, 
                    this.width + glowRadius * 2, this.height + glowRadius * 2);
        
        // Portal frame
        ctx.fillStyle = '#8A2BE2';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Portal interior
        ctx.fillStyle = '#9370DB';
        ctx.fillRect(this.x + 5, this.y + 5, this.width - 10, this.height - 10);
        
        // Portal swirl effect
        ctx.strokeStyle = '#E6E6FA';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
            const angle = this.animationFrame + i * Math.PI / 2;
            const x1 = this.x + this.width/2 + Math.cos(angle) * 10;
            const y1 = this.y + this.height/2 + Math.sin(angle) * 15;
            const x2 = this.x + this.width/2 + Math.cos(angle + Math.PI) * 10;
            const y2 = this.y + this.height/2 + Math.sin(angle + Math.PI) * 15;
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
        }
        ctx.stroke();
        
        ctx.restore();
    }

    checkTeleport(character) {
        if (this.teleportCooldown > 0) return false;
        
        // Check if character is touching portal
        if (character.x < this.x + this.width &&
            character.x + character.width > this.x &&
            character.y < this.y + this.height &&
            character.y + character.height > this.y) {
            
            return true;
        }
        return false;
    }
}

// Portal management
let portals = [];
let lastPortalPositions = [];

function createPortals() {
    portals = [];
    
    // Generate two random portal positions with minimum distance
    const positions = [];
    for (let i = 0; i < 2; i++) {
        let x, y;
        let attempts = 0;
        let validPosition = false;
        
        do {
            x = Math.random() * (canvas.width - 100) + 50;
            y = Math.random() * (canvas.height - 150) + 50;
            attempts++;
            
            // Check if position is valid and far enough from other portals
            if (!isPositionOccupied(x, y)) {
                validPosition = true;
                // Check distance from already placed portals
                for (let j = 0; j < positions.length; j++) {
                    const distance = Math.sqrt(Math.pow(x - positions[j].x, 2) + Math.pow(y - positions[j].y, 2));
                    if (distance < 100) {
                        validPosition = false;
                        break;
                    }
                }
            }
        } while (!validPosition && attempts < 100);
        
        positions.push({x, y});
    }
    
    // Create portals at the positions
    portals.push(new Portal(positions[0].x, positions[0].y));
    portals.push(new Portal(positions[1].x, positions[1].y));
    
    // Store positions to avoid repetition
    lastPortalPositions = positions;
}

function isPositionOccupied(x, y) {
    // Check if position overlaps with platforms
    for (let platform of platforms) {
        if (x < platform.x + platform.width + 50 &&
            x + 40 > platform.x - 50 &&
            y < platform.y + platform.height + 50 &&
            y + 60 > platform.y - 50) {
            return true;
        }
    }
    
    // Check if position overlaps with obstacles
    for (let obstacle of obstacles) {
        if (x < obstacle.x + obstacle.width + 50 &&
            x + 40 > obstacle.x - 50 &&
            y < obstacle.y + obstacle.height + 50 &&
            y + 60 > obstacle.y - 50) {
            return true;
        }
    }
    
    // Check if position overlaps with bouncers
    for (let bouncer of bouncers) {
        if (x < bouncer.x + bouncer.width + 50 &&
            x + 40 > bouncer.x - 50 &&
            y < bouncer.y + bouncer.height + 50 &&
            y + 60 > bouncer.y - 50) {
            return true;
        }
    }
    
    // Check if position is too close to last portal positions
    for (let pos of lastPortalPositions) {
        const distance = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));
        if (distance < 100) {
            return true;
        }
    }
    
    return false;
}

function teleportCharacter(character) {
    // Find which portal the character touched
    let sourcePortalIndex = -1;
    for (let i = 0; i < portals.length; i++) {
        if (portals[i].checkTeleport(character)) {
            sourcePortalIndex = i;
            break;
        }
    }
    
    if (sourcePortalIndex !== -1) {
        // Teleport to the other portal
        const targetPortalIndex = sourcePortalIndex === 0 ? 1 : 0;
        const targetPortal = portals[targetPortalIndex];
        
        // Position character at target portal
        character.x = targetPortal.x + targetPortal.width/2 - character.width/2;
        character.y = targetPortal.y + targetPortal.height/2 - character.height/2;
        
        // Add some velocity for dramatic effect
        character.velocityX = (Math.random() - 0.5) * 10;
        character.velocityY = -5;
        
        // Set cooldown on both portals
        portals[0].teleportCooldown = 60; // 1 second
        portals[1].teleportCooldown = 60;
        
        // Move portals to new locations
        setTimeout(() => {
            createPortals();
        }, 1000);
    }
}

// Character class
class Character {
    constructor(x, y, color, controls) {
        this.x = x;
        this.y = y;
        this.width = 25; // Shorter character
        this.height = 35; // Shorter character
        this.color = color;
        this.controls = controls;
        this.velocityX = 0;
        this.velocityY = 0;
        this.onGround = false;
        this.isRolling = false;
        this.rollCooldown = 0;
        this.rollDirection = 0; // 0 = not rolling, -1 = left, 1 = right
        this.rollProgress = 0;
        this.health = 100;
        this.isTagged = false;
        this.tagCooldown = 0;
    }

    update() {
        // Handle rolling movement
        if (this.isRolling) {
            this.rollProgress += 10; // Move 10 pixels per frame
            if (this.rollDirection === 1) {
                this.x += 10;
            } else if (this.rollDirection === -1) {
                this.x -= 10;
            }
            
            // Check if roll is complete
            if (this.rollProgress >= ROLL_DISTANCE) {
                this.isRolling = false;
                this.rollCooldown = 30;
                this.rollProgress = 0;
                this.rollDirection = 0;
            }
        } else {
            // Apply gravity
            this.velocityY += GRAVITY;
            
            // Update position
            this.x += this.velocityX;
            this.y += this.velocityY;
        }
        
        // Ground collision
        if (this.y + this.height > canvas.height - 50) {
            this.y = canvas.height - 50 - this.height;
            this.velocityY = 0;
            this.onGround = true;
        } else {
            this.onGround = false;
        }
        
        // Platform collisions
        platforms.forEach(platform => {
            if (this.x < platform.x + platform.width &&
                this.x + this.width > platform.x &&
                this.y < platform.y + platform.height &&
                this.y + this.height > platform.y) {
                
                // Landing on top of platform
                if (this.velocityY > 0 && this.y < platform.y) {
                    this.y = platform.y - this.height;
                    this.velocityY = 0;
                    this.onGround = true;
                }
            }
        });
        
        // Obstacle collisions
        obstacles.forEach(obstacle => {
            if (this.x < obstacle.x + obstacle.width &&
                this.x + this.width > obstacle.x &&
                this.y < obstacle.y + obstacle.height &&
                this.y + this.height > obstacle.y) {
                
                // Push character back
                if (this.x < obstacle.x) {
                    this.x = obstacle.x - this.width;
                } else if (this.x > obstacle.x) {
                    this.x = obstacle.x + obstacle.width;
                }
                this.velocityX = 0;
            }
        });
        
        // Screen boundaries
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;
        
        // Update cooldowns
        if (this.rollCooldown > 0) this.rollCooldown--;
        if (this.tagCooldown > 0) this.tagCooldown--;
    }

    handleInput(keys) {
        if (this.isRolling) return; // Can't change direction while rolling
        
        // Handle movement
        if (keys[this.controls.left]) {
            this.velocityX = -MOVE_SPEED;
        } else if (keys[this.controls.right]) {
            this.velocityX = MOVE_SPEED;
        } else {
            this.velocityX *= 0.8; // Friction
        }
        
        // Handle jumping
        if (keys[this.controls.jump] && this.onGround) {
            this.velocityY = JUMP_FORCE;
            this.onGround = false;
        }
        
        // Handle rolling
        if (keys[this.controls.roll] && this.rollCooldown === 0 && this.onGround) {
            this.isRolling = true;
            this.rollProgress = 0;
            // Determine roll direction based on current movement or facing direction
            if (this.velocityX > 0 || keys[this.controls.right]) {
                this.rollDirection = 1; // Roll right
            } else if (this.velocityX < 0 || keys[this.controls.left]) {
                this.rollDirection = -1; // Roll left
            } else {
                this.rollDirection = 1; // Default to right if no movement
            }
        }
    }

    draw() {
        ctx.save();
        
        // Draw character body (black when not IT, gray when IT)
        ctx.fillStyle = this.isTagged ? '#888' : '#000';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Draw character details
        ctx.fillStyle = '#FFF';
        ctx.fillRect(this.x + 5, this.y + 8, 3, 3); // Left eye
        ctx.fillRect(this.x + 17, this.y + 8, 3, 3); // Right eye
        
        // Draw mouth
        ctx.fillRect(this.x + 10, this.y + 18, 5, 2);
        
        // Draw arms
        ctx.fillStyle = this.isTagged ? '#888' : '#000';
        ctx.fillRect(this.x - 3, this.y + 12, 6, 15);
        ctx.fillRect(this.x + this.width - 3, this.y + 12, 6, 15);
        
        // Draw legs
        ctx.fillRect(this.x + 5, this.y + this.height, 5, 12);
        ctx.fillRect(this.x + 15, this.y + this.height, 5, 12);
        
        // Draw bandana
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y - 5, this.width, 8);
        
        // Draw bandana details
        ctx.fillStyle = this.isTagged ? '#888' : '#000';
        ctx.fillRect(this.x + 8, this.y - 3, 2, 2);
        ctx.fillRect(this.x + 15, this.y - 3, 2, 2);
        
        // Draw tag indicator
        if (this.isTagged) {
            ctx.fillStyle = 'red';
            ctx.font = '10px Arial';
            ctx.fillText('IT!', this.x - 8, this.y - 8);
        }
        
        ctx.restore();
    }

    checkTag(other) {
        if (this.tagCooldown > 0 || other.tagCooldown > 0) return;
        
        const distance = Math.sqrt(
            Math.pow(this.x - other.x, 2) + Math.pow(this.y - other.y, 2)
        );
        
        if (distance < 35) { // Adjusted for smaller characters
            // Calculate bounce direction
            const dx = this.x - other.x;
            const dy = this.y - other.y;
            const angle = Math.atan2(dy, dx);
            
            // Apply bounce force to both characters
            this.velocityX = Math.cos(angle) * BOUNCE_FORCE;
            this.velocityY = Math.sin(angle) * BOUNCE_FORCE;
            other.velocityX = -Math.cos(angle) * BOUNCE_FORCE;
            other.velocityY = -Math.sin(angle) * BOUNCE_FORCE;
            
            // Transfer the "it" status
            if (!this.isTagged && other.isTagged) {
                // This character becomes IT
                this.isTagged = true;
                other.isTagged = false;
                this.tagCooldown = 60; // 1 second cooldown
                other.tagCooldown = 60; // 1 second cooldown
            } else if (this.isTagged && !other.isTagged) {
                // Other character becomes IT
                this.isTagged = false;
                other.isTagged = true;
                this.tagCooldown = 60; // 1 second cooldown
                other.tagCooldown = 60; // 1 second cooldown
            }
        }
    }
}

// Platform class
class Platform {
    constructor(x, y, width, height, color = '#8B4513') {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Add some texture
        ctx.fillStyle = '#654321';
        for (let i = 0; i < this.width; i += 20) {
            ctx.fillRect(this.x + i, this.y, 2, this.height);
        }
    }
}

// Obstacle class
class Obstacle {
    constructor(x, y, width, height, type = 'tree') {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type;
    }

    draw() {
        if (this.type === 'tree') {
            // Draw tree trunk
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(this.x + this.width/2 - 10, this.y + this.height - 40, 20, 40);
            
            // Draw tree leaves
            ctx.fillStyle = '#228B22';
            ctx.beginPath();
            ctx.arc(this.x + this.width/2, this.y + this.height/2, this.width/2, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw tree details
            ctx.fillStyle = '#006400';
            ctx.beginPath();
            ctx.arc(this.x + this.width/2 - 10, this.y + this.height/2 - 10, 15, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(this.x + this.width/2 + 10, this.y + this.height/2 - 5, 12, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'rock') {
            ctx.fillStyle = '#696969';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            
            // Add rock texture
            ctx.fillStyle = '#808080';
            ctx.fillRect(this.x + 5, this.y + 5, this.width - 10, this.height - 10);
        }
    }
}

// Create characters
const playerA = new Character(100, 300, '#FF6B6B', {
    left: 'KeyA',
    right: 'KeyD',
    jump: 'KeyW',
    roll: 'KeyS'
});

const playerB = new Character(1100, 300, '#4ECDC4', {
    left: 'ArrowLeft',
    right: 'ArrowRight',
    jump: 'ArrowUp',
    roll: 'ArrowDown'
});

// Create platforms
const platforms = [
    new Platform(200, 450, 150, 20),
    new Platform(450, 400, 150, 20),
    new Platform(700, 350, 150, 20),
    new Platform(950, 400, 150, 20),
    new Platform(300, 250, 120, 20),
    new Platform(600, 200, 120, 20),
    new Platform(900, 250, 120, 20),
    new Platform(400, 100, 100, 20),
    new Platform(800, 100, 100, 20)
];

// Create obstacles
const obstacles = [
    new Obstacle(50, 450, 60, 150, 'tree'),
    new Obstacle(350, 450, 60, 150, 'tree'),
    new Obstacle(650, 450, 60, 150, 'tree'),
    new Obstacle(950, 450, 60, 150, 'tree'),
    new Obstacle(1150, 450, 60, 150, 'tree'),
    new Obstacle(250, 300, 40, 40, 'rock'),
    new Obstacle(500, 300, 40, 40, 'rock'),
    new Obstacle(750, 300, 40, 40, 'rock'),
    new Obstacle(1000, 300, 40, 40, 'rock')
];

// Create bouncers (only 2, larger, on sides)
const bouncers = [
    new Bouncer(100, 520),  // Left side
    new Bouncer(1070, 520)  // Right side
];

// Input handling
const keys = {};

document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    
    // Restart game with U key
    if (e.code === 'KeyU') {
        restartGame();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Randomly assign IT status at the start
function assignRandomIT() {
    const random = Math.random();
    if (random < 0.5) {
        playerA.isTagged = true;
        playerB.isTagged = false;
    } else {
        playerA.isTagged = false;
        playerB.isTagged = true;
    }
}

// Restart game function
function restartGame() {
    gameState.running = true;
    gameState.winner = null;
    gameState.currentTime = 180;
    gameState.gameStartTime = Date.now();
    
    // Reset player positions and states
    playerA.x = 100;
    playerA.y = 300;
    playerA.velocityX = 0;
    playerA.velocityY = 0;
    playerA.tagCooldown = 0;
    playerA.isRolling = false;
    playerA.rollCooldown = 0;
    playerA.rollProgress = 0;
    playerA.rollDirection = 0;
    
    playerB.x = 1100;
    playerB.y = 300;
    playerB.velocityX = 0;
    playerB.velocityY = 0;
    playerB.tagCooldown = 0;
    playerB.isRolling = false;
    playerB.rollCooldown = 0;
    playerB.rollProgress = 0;
    playerB.rollDirection = 0;
    
    // Randomly assign IT status
    assignRandomIT();
    
    // Create new portals
    createPortals();
    
    // Start the game loop again
    gameLoop();
}

// Game loop
function gameLoop() {
    // Update timer
    const elapsedTime = Math.floor((Date.now() - gameState.gameStartTime) / 1000);
    gameState.currentTime = Math.max(0, gameState.gameTime - elapsedTime);
    
    // Check if time is up
    if (gameState.currentTime <= 0 && gameState.running) {
        // Time's up! Whoever is "it" loses
        if (playerA.isTagged) {
            gameState.winner = 'Player B';
        } else if (playerB.isTagged) {
            gameState.winner = 'Player A';
        } else {
            // If no one is "it" when time runs out, it's a tie
            gameState.winner = 'Tie';
        }
        gameState.running = false;
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background
    drawBackground();
    
    // Update and draw platforms
    platforms.forEach(platform => platform.draw());
    
    // Update and draw obstacles
    obstacles.forEach(obstacle => obstacle.draw());
    
    // Update and draw bouncers
    bouncers.forEach(bouncer => {
        bouncer.update();
        bouncer.draw();
    });
    
    // Update and draw portals
    portals.forEach(portal => {
        portal.update();
        portal.draw();
    });
    
    // Handle input and update characters
    playerA.handleInput(keys);
    playerB.handleInput(keys);
    playerA.update();
    playerB.update();
    
    // Check for bouncer interactions
    bouncers.forEach(bouncer => {
        bouncer.checkBounce(playerA);
        bouncer.checkBounce(playerB);
    });
    
    // Check for portal teleportation
    teleportCharacter(playerA);
    teleportCharacter(playerB);
    
    // Check for tags
    playerA.checkTag(playerB);
    playerB.checkTag(playerA);
    
    // Draw characters
    playerA.draw();
    playerB.draw();
    
    // Draw ground
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(0, canvas.height - 50, canvas.width, 50);
    
    // Draw grass on ground
    ctx.fillStyle = '#228B22';
    for (let i = 0; i < canvas.width; i += 20) {
        ctx.fillRect(i, canvas.height - 50, 2, 10);
    }
    
    // Draw UI
    drawUI();
    
    // Check game state
    if (gameState.running) {
        requestAnimationFrame(gameLoop);
    } else {
        drawGameOver();
    }
}

function drawBackground() {
    // Sky gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#98FB98');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    drawCloud(100, 80, 60);
    drawCloud(300, 60, 80);
    drawCloud(600, 100, 70);
    drawCloud(900, 70, 65);
}

function drawCloud(x, y, size) {
    ctx.beginPath();
    ctx.arc(x, y, size * 0.3, 0, Math.PI * 2);
    ctx.arc(x + size * 0.3, y, size * 0.4, 0, Math.PI * 2);
    ctx.arc(x + size * 0.6, y, size * 0.3, 0, Math.PI * 2);
    ctx.arc(x + size * 0.3, y - size * 0.2, size * 0.3, 0, Math.PI * 2);
    ctx.fill();
}

function drawUI() {
    // Draw timer at the top
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(canvas.width/2 - 100, 10, 200, 50);
    
    ctx.fillStyle = gameState.currentTime <= 10 ? 'red' : 'white';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    const minutes = Math.floor(gameState.currentTime / 60);
    const seconds = gameState.currentTime % 60;
    ctx.fillText(`${minutes}:${seconds.toString().padStart(2, '0')}`, canvas.width/2, 40);
    
    // Draw player info
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 70, 200, 80);
    
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.fillText('Player A (Red)', 20, 90);
    ctx.fillText('Health: ' + playerA.health, 20, 110);
    ctx.fillText('Status: ' + (playerA.isTagged ? 'IT!' : 'Safe'), 20, 130);
    
    ctx.fillRect(canvas.width - 210, 70, 200, 80);
    ctx.fillText('Player B (Blue)', canvas.width - 200, 90);
    ctx.fillText('Health: ' + playerB.health, canvas.width - 200, 110);
    ctx.fillText('Status: ' + (playerB.isTagged ? 'IT!' : 'Safe'), canvas.width - 200, 130);
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = 'white';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER!', canvas.width / 2, canvas.height / 2 - 50);
    
    ctx.font = '24px Arial';
    if (gameState.winner === 'Tie') {
        ctx.fillText('It\'s a tie!', canvas.width / 2, canvas.height / 2);
    } else {
        ctx.fillText(gameState.winner + ' wins!', canvas.width / 2, canvas.height / 2);
    }
    
    ctx.font = '18px Arial';
    ctx.fillText('Press U to restart', canvas.width / 2, canvas.height / 2 + 50);
}

// Start the game
assignRandomIT(); // Assign random IT status at the start
createPortals(); // Create initial portals
gameLoop(); 