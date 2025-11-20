# Multiplayer Class-Based Shooter Game

A real-time multiplayer shooter game built with Socket.IO, featuring 4 unique player classes, each with their own weapon and special ability, plus shared abilities for all players.

## Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm

### Installation & Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start the Server**
   ```bash
   npm start
   ``` 
   **Or**
   ```bash
   npm run dev
   ```

3. **Access the Game**
   Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Setting Up ngrok for Online Multiplayer

To allow other players to join your game from anywhere on the internet, you can use ngrok to create a public tunnel to your local server.

### Step 1: Install ngrok

1. **Download ngrok** from [ngrok.com](https://ngrok.com/download)
2. **Extract the file** to a folder (e.g., `C:\ngrok\` on Windows)
3. **Add ngrok to your PATH** (optional but recommended)

### Step 2: Create ngrok Account (Free)

1. Go to [ngrok.com](https://ngrok.com) and sign up for a free account
2. Get your **authtoken** from the dashboard
3. **Authenticate ngrok** by running:
   ```bash
   ngrok authtoken YOUR_AUTHTOKEN_HERE
   ```

### Step 3: Start Your Game Server

1. **Start your game server** in one terminal:
   ```bash
   npm start
   ```
   Your server will run on `http://localhost:3001`

### Step 4: Create Public Tunnel

1. **Open a new terminal** (keep the server running)
2. **Run ngrok** to create a public tunnel:
   ```bash
   ngrok http 3000
   ```
3. **Copy the public URL** that ngrok provides (looks like `https://abc123.ngrok.io`)

### Step 5: Share with Friends

1. **Share the ngrok URL** with your friends
2. **They can access the game** by visiting the ngrok URL in their browser
3. **You can all play together** as if you were on the same local network!

### Important Notes

- **ngrok URL changes** every time you restart ngrok (unless you have a paid plan)
- **Keep both terminals open** - one for your server, one for ngrok
- **Free ngrok has limitations** - consider upgrading for production use
- **The game works the same** whether accessed locally or through ngrok


### How to Play

1. **Create a Game**
   - Enter your name on the home page
   - Click "Create New Lobby"
   - Choose your class from 4 options (Mage, Healer, Ranged, Melee)
   - Wait for other players to join and choose their classes
   - Click "Start Game" when ready

2. **Join a Game**
   - Enter your name on the home page
   - Browse available lobbies
   - Click on any lobby card to join
   - Choose your class
   - Wait for the host to start the game

3. **Controls**
   - **WASD Keys**: Move player
   - **Mouse**: Aim and shoot
   - **Left Click**: Shoot weapon
   - **Right Click**: Use abilities
   - **Escape**: Pause/Resume game

## Game Overview

### Player Classes
Each player chooses one of four unique classes:

- **Mage**: 2 Fast projectiles and area slow ability
- **Healer**: Slow projectiles and AoE heal ability, healing ability damages zombies (and other players in deathmatch) 
- **Ranged**: Single fast projetile and damaging arrow ability
- **Melee**: Close-range strike and are knockback ability

### Game Features
- **Real-time multiplayer** with up to 4 players
- **3 lives per player** with respawn system
- **5-minute timed matches** with scoring
- **DOM-based rendering** (no canvas)
- **Class-based combat** with unique weapons and abilities

---

### Core Gameplay

- **Deathmatch** with up to 4 players fighting each other
- **Survival** with up to 4 players, fight zombies with friendly fire off

### Player Classes

Each player must choose one of four unique classes, each with their own weapon and special ability:

#### Mage
- **Weapon**: Mage Bolt - 2 fast projectiles (22 damage, 250ms fire rate)
- **Special Ability**: Area Slow - Slows enemies in an area

#### Healer
- **Weapon**: Healer Staff - Slow projectiles (30 damage, 270ms fire rate)
- **Special Ability**: AoE Heal - Heals all nearby allies or himself, also damages enemies or zombies

#### Ranged
- **Weapon**: Arrow - Fast single projectile (40 damage, 250ms fire rate)
- **Special Ability**: Special Arrow - Slower and bigger arrow with more damage

#### Melee
- **Weapon**: Melee Strike - Close-range strike (45 damage, 350ms fire rate)
- **Special Ability**: Area Knockback - Can damage and knock back enemys around him


### Scoring System

- **PvP Combat**: 5 points per hit, 25 points per kill
- **Zombie Combat**: 2 points per hit, 10 points per kill
- **Healing**: Points based on effective healing (0.25x healing amount)
- **Real-time scoreboard** visible to all players
- **Final results** with detailed statistics
- **Winner determination** based on highest score or last man standing

### Controls

- **WASD / Arrow Keys**: Move player
- **Mouse**: Aim and shoot
- **Left Click**: Shoot weapon
- **Right Click**: Use ability
- **Escape**: Pause/Resume game


### Backend (Node.js + Socket.IO)

- **Express server** for static file serving
- **Socket.IO** for real-time communication

### Frontend

- **Vanilla Javascript**


### Key Components

- **Class System**: 4 unique player classes with distinct weapons and abilities
- **Ability System**: Class-specific
- **Physics Engine**: Movement, collision, and projectile physics
- **Rendering Engine**: DOM manipulation
- **Network Layer**: Real-time multiplayer with ngrok



## Performance Features

### 60 FPS Target

- **RequestAnimationFrame** for smooth animation
- **Delta time** calculation for consistent movement
- **Efficient DOM manipulation** for rendering
- **Performance monitoring** with FPS counter

### Optimization

- **Minimal DOM layers** for better performance
- **Efficient collision detection**
- **Optimized rendering** with camera system
- **Memory management** for projectiles and effects

## Sound System

### Sound Effects

- **Class-specific sounds** for different weapons
- **Soundtrack** when you start the game
- **Ability usage** sound effects

## Troubleshooting

### Common Issues

**Game won't start:**
- Ensure at least 2 players are in the lobby
- Check that all players have selected a class
- Verify that you're the host (only hosts can start games)
- Ensure all players have entered valid names

**Performance issues:**
- Check browser console for FPS counter
- Close other browser tabs/applications
- Try refreshing the page

**Connection problems:**
- Check internet connection
- Verify server is running
- Check browser console for error messages
- Try refreshing the page

**Sound not working:**
- Check browser audio permissions
- Ensure system volume is not muted
- Try refreshing the page
- Check browser console for audio errors

### Browser Compatibility

- **Chrome**: Full support
- **Firefox**: Full support
- **Safari**: Full support
- **Edge**: Full support

## Future Enhancements

### Planned Features

- **Additional classes** with unique abilities
- **New weapons** and animations
- **Team modes** (2v2, 3v1) 
- **Player profiles** and statistics
- **Achievement system**
- **Leaderboard**
- **Shared abilities**

## License

This project is licensed under the MIT License

---

**Enjoy the game!**