# STRIKER AI AGENT PROMPT

Copy and paste the prompt below into your Antigravity (or any Agentic AI) to replicate the high-end, cinematic sports-auction aesthetic of the STRIKER project.

---

**Prompt:**

Act as a world-class Web Designer and Frontend Engineer. I want to build/modify a project called "STRIKER", a College Football Auction Portal. The aesthetic must be **premium, cinematic, and immersive**, resembling a high-budget sports broadcast or a futuristic tactical interface.

### 1. Technology Stack
- **Framework**: React (Vite)
- **Styling**: Vanilla CSS / Tailwind CSS (for layout)
- **Animations**: 
  - **GSAP**: Essential for `ScrollTrigger` parallax, `SplitText` headline reveals, and timeline-based orchestration.
  - **Framer Motion**: Used for micro-interactions, hover states, and conditional UI overlays (like the Player Reveal).
  - **Lenis**: For buttery smooth cinematic scrolling.
- **Real-time**: Socket.io-client for live auction state synchronization.

### 2. Design System & Aesthetics
- **Core Theme**: "Stadium Night" — very dark, high contrast, atmospheric.
- **Color Palette**:
  - `bg-deep`: `#020602` (Base obsidian)
  - `bg-card`: `#060B06` with subtle gradients
  - `accent-gold`: `#B78C3E` (Used for "Sold" states, highlights, and icons)
  - `accent-emerald`: `#1B4332` (Primary brand color)
  - `border-glow`: `rgba(255, 255, 255, 0.1)`
- **Typography**: 
  - Headlines: `Bebas Neue` (Heavy, uppercase, high letter-spacing)
  - Body: `Outfit` (Sleek, modern sans-serif)
  - Data/HUD: `JetBrains Mono` or `Monaco` (Monospaced, used for coordinates, labels, and stats)
- **Effects**:
  - **Visor HUD**: Fixed tactical overlays in the viewport corners (L-shapes, data lines).
  - **Stadium Lighting**: Use GSAP to simulate flickering floodlights (HID pylon source glows) and beam sweeps.
  - **3D Assets**: Floating, parallax-reactive 3D sports assets (football balls, trophies) using `fixed` positioning and high `zIndex`.
  - **Glassmorphism**: Cards with thin borders, low-opacity backgrounds (`rgba(255,255,255,0.03)`), and heavy `backdrop-filter: blur(12px)`.

### 3. Key Components to Replicate
- **Cinematic Hero**: A stadium pylon lighting reveal sequence where lights flicker on one-by-one, followed by a headline drop.
- **Player/Team Cards**: Magnetic-tilt interaction (GSAP `mousemove` reaction) with position-specific accent colors.
- **Reveal Overlay**: A high-impact full-screen portal that flashes like lightning when a new player is selected for auction.
- **Pinned Stats**: Sections that pin in place while numbers "count up" as the user scrolls.

### 4. Implementation Philosophy
- **Zero Placeholders**: Use `generate_image` or high-quality assets.
- **Micro-animations**: Everything should feel alive—embers floating, subtle glows pulsing, characters staggering in.
- **Tactical Narrative**: Use "Act I", "Act II" etc., to guide the user through the landing page like a story.

---
