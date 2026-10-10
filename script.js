"use strict";

// Edit the gift here. The winning index is zero-based, clockwise from the top.
const CONFIG = {
  name: "Nari",
  texts: {
    start: "Skisha ki!",
    greeting: "Buon compleeeeeee!",
    spin: "GIRA E VINCI",
    win: "CONGRATULASCIONS, hai vint un anno di Conprobio! (I know, boscodirovo universe woulda been goat...)",
    again: "Gira ancora"
  },
  segments: [
    { label: "Conprobio", color: "#96ed69", image: "assets/conprobio.png" },
    { label: "1'000'000 .-", color: "#60d8ff" },
    { label: "VR game in Boscodirovo universe", color: "#ff77b7" },
    { label: "Whisky il ragnetto versione K Pop", color: "#ffad59" }
  ],
  spinDuration: 6400,
  winningSegmentIndex: 0,
  fullRotations: 7,
  introductionDuration: 3000
};

const SVG_NS = "http://www.w3.org/2000/svg";
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const elements = Object.fromEntries([
  "landing", "start", "celebration", "greeting", "wheel-stage", "wheel-shell",
  "wheel", "pointer", "spin", "result", "win-banner", "prize-card", "again", "status", "confetti"
].map(id => [id, document.getElementById(id)]));
const segmentAngle = 360 / CONFIG.segments.length;
let rotation = 0;
let spinning = false;
let started = false;

const text = key => CONFIG.texts[key].replaceAll("{name}", CONFIG.name);
const wait = duration => new Promise(resolve => setTimeout(resolve, duration));
const nextPaint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

function svgElement(tag, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

// The fallback stays underneath the image, including when the image is missing.
function addLogo(parent, centreX, centreY, width = 150) {
  const group = svgElement("g");
  group.append(svgElement("rect", {
    x: centreX - width / 2, y: centreY - 30, width, height: 60,
    rx: 8, fill: "#fff", stroke: "#242022", "stroke-width": 3
  }));
  const label = svgElement("text", {
    x: centreX, y: centreY + 7, "text-anchor": "middle",
    "font-size": 23, "font-weight": 600, fill: "#242022"
  });
  label.textContent = CONFIG.segments[CONFIG.winningSegmentIndex].label;
  group.append(label);
  const image = svgElement("image", {
    x: centreX - width / 2 + 6, y: centreY - 24, width: width - 12,
    height: 48, preserveAspectRatio: "xMidYMid meet"
  });
  image.style.opacity = "0";
  image.style.transition = "opacity .35s";
  image.addEventListener("load", () => { label.style.opacity = "0"; image.style.opacity = "1"; });
  image.addEventListener("error", () => image.remove());
  image.setAttribute("href", CONFIG.segments[CONFIG.winningSegmentIndex].image);
  group.append(image);
  parent.append(group);
}

function wrapLabel(label, maxCharacters) {
  const lines = [];
  let line = "";
  for (const word of label.split(" ")) {
    if (line && `${line} ${word}`.length > maxCharacters) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function buildWheel() {
  const title = svgElement("title");
  title.textContent = CONFIG.segments.map(segment => segment.label).join("; ");
  elements.wheel.append(title);
  CONFIG.segments.forEach((segment, index) => {
    const start = (index * segmentAngle - 90) * Math.PI / 180;
    const end = ((index + 1) * segmentAngle - 90) * Math.PI / 180;
    const point = angle => `${260 + 244 * Math.cos(angle)},${260 + 244 * Math.sin(angle)}`;
    elements.wheel.append(svgElement("path", {
      d: `M260,260 L${point(start)} A244,244 0 ${segmentAngle > 180 ? 1 : 0},1 ${point(end)} Z`,
      fill: segment.color, stroke: "#242022", "stroke-width": 4, "stroke-linejoin": "round"
    }));
    const middle = (start + end) / 2;
    const centreX = 260 + 137 * Math.cos(middle);
    const centreY = 260 + 137 * Math.sin(middle);
    if (segment.image) {
      addLogo(elements.wheel, centreX, centreY, 148);
      return;
    }
    const fontSize = index === 1 ? 25 : 19;
    const lines = wrapLabel(segment.label, index === 1 ? 20 : 17);
    const label = svgElement("text", {
      x: centreX, "text-anchor": "middle", "font-size": fontSize,
      "font-weight": 500, fill: "#242022"
    });
    lines.forEach((line, lineIndex) => {
      const span = svgElement("tspan", {
        x: centreX, y: centreY + (lineIndex - (lines.length - 1) / 2) * (fontSize + 2) + fontSize * .35
      });
      span.textContent = line;
      label.append(span);
    });
    elements.wheel.append(label);
  });
  elements.wheel.append(svgElement("circle", { cx: 260, cy: 260, r: 247, fill: "none", stroke: "#242022", "stroke-width": 8 }));
}

// Integrate a short acceleration ramp followed by a long, smooth deceleration.
function spinEase(progress) {
  const acceleration = .1;
  const area = acceleration / 2 + (1 - acceleration) / 4;
  if (progress < acceleration) return progress * progress / (2 * acceleration * area);
  const remaining = (progress - acceleration) / (1 - acceleration);
  return (acceleration / 2 + (1 - acceleration) / 4 * (1 - (1 - remaining) ** 4)) / area;
}

// The pointer is at zero degrees; keep the random landing safely inside its sector.
function winningRotation(currentRotation, offset) {
  const centre = (CONFIG.winningSegmentIndex + .5) * segmentAngle;
  const target = ((-centre + offset) % 360 + 360) % 360;
  const current = ((currentRotation % 360) + 360) % 360;
  return currentRotation + CONFIG.fullRotations * 360 + (target - current + 360) % 360;
}

function clickPointer() {
  elements.pointer.getAnimations().forEach(animation => animation.cancel());
  elements.pointer.animate([
    { transform: "rotate(0)" }, { transform: "rotate(-24deg)", offset: .3 },
    { transform: "rotate(9deg)", offset: .65 }, { transform: "rotate(0)" }
  ], { duration: 130, easing: "ease-out" });
}

async function startParty() {
  if (started) return;
  started = true;
  elements.start.disabled = true;
  elements.landing.classList.add("is-leaving");
  await wait(500);
  elements.landing.hidden = true;
  elements.celebration.hidden = false;
  const greeting = text("greeting");
  elements.greeting.setAttribute("aria-label", greeting);
  let characterIndex = 0;
  greeting.split(" ").forEach((word, wordIndex) => {
    if (wordIndex) elements.greeting.append(" ");
    const wrapper = document.createElement("span");
    wrapper.className = "word";
    wrapper.setAttribute("aria-hidden", "true");
    for (const character of word) {
      const letter = document.createElement("span");
      letter.className = "letter";
      letter.textContent = character;
      letter.style.setProperty("--delay", `${characterIndex++ * 45}ms`);
      wrapper.append(letter);
    }
    elements.greeting.append(wrapper);
  });
  elements.greeting.focus({ preventScroll: true });
  document.querySelector(".decorations").classList.add("is-party");
  burst(.5, .35, 95);
  await wait(reducedMotion.matches ? 900 : CONFIG.introductionDuration);
  elements["wheel-stage"].classList.add("is-visible");
  await wait(reducedMotion.matches ? 350 : 800);
  elements.spin.classList.add("is-visible");
  elements.spin.disabled = false;
}

async function spin() {
  if (spinning || !started) return;
  spinning = true;
  elements.spin.disabled = true;
  elements.again.disabled = true;
  elements.status.textContent = "";
  elements["wheel-shell"].classList.remove("is-settling");
  if (!elements.result.hidden) {
    elements.result.classList.remove("is-visible");
    await wait(400);
    elements.result.hidden = true;
  }
  elements.spin.scrollIntoView({ block: "nearest", behavior: reducedMotion.matches ? "instant" : "smooth" });
  const initialRotation = rotation;
  const offset = (Math.random() - .5) * segmentAngle * .36;
  const finalRotation = winningRotation(initialRotation, offset);
  const duration = reducedMotion.matches ? 900 : CONFIG.spinDuration;
  const visualTarget = reducedMotion.matches ? initialRotation + (finalRotation - initialRotation) % 360 : finalRotation;
  let lastBoundary = Math.floor(initialRotation / segmentAngle);
  await new Promise(resolve => {
    let startTime;
    function frame(time) {
      startTime ??= time;
      const progress = Math.min((time - startTime) / duration, 1);
      const angle = initialRotation + (visualTarget - initialRotation) * spinEase(progress);
      elements.wheel.style.transform = `rotate(${angle}deg)`;
      const boundary = Math.floor(angle / segmentAngle);
      if (boundary !== lastBoundary && !reducedMotion.matches) clickPointer();
      lastBoundary = boundary;
      if (progress < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
  rotation = finalRotation;
  elements.wheel.style.transform = `rotate(${rotation}deg)`;
  elements["wheel-shell"].classList.add("is-settling");
  await wait(reducedMotion.matches ? 200 : 650);
  elements.result.hidden = false;
  await nextPaint();
  elements.result.classList.add("is-visible");
  elements.status.textContent = `${text("win")} ${CONFIG.segments[CONFIG.winningSegmentIndex].label}`;
  elements["win-banner"].focus({ preventScroll: true });
  burst(.5, .55, 150);
  if (!reducedMotion.matches) {
    setTimeout(() => burst(.2, .3, 60, true), 350);
    setTimeout(() => burst(.8, .35, 60, true), 700);
  }
  await wait(reducedMotion.matches ? 350 : 800);
  elements.again.scrollIntoView({ block: "end", behavior: reducedMotion.matches ? "instant" : "smooth" });
  spinning = false;
  elements.again.disabled = false;
  // Replays use the dedicated button, avoiding two competing controls.
}

// One bounded canvas loop serves both confetti and the star-shaped fireworks.
const context = elements.confetti.getContext("2d");
let particles = [];
let confettiFrame = null;
let lastFrame = 0;
let canvasWidth = innerWidth;
let canvasHeight = innerHeight;

function resizeCanvas() {
  canvasWidth = innerWidth;
  canvasHeight = innerHeight;
  const ratio = Math.min(devicePixelRatio || 1, 2);
  elements.confetti.width = canvasWidth * ratio;
  elements.confetti.height = canvasHeight * ratio;
  context?.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function burst(originX, originY, count, stars = false) {
  if (!context) return;
  const gentle = reducedMotion.matches;
  const colours = CONFIG.segments.map(segment => segment.color).concat("#ffe74b", "#ffffff");
  for (let index = 0; index < (gentle ? 14 : count); index++) {
    const direction = Math.random() * Math.PI * 2;
    const speed = gentle ? 18 + Math.random() * 22 : 140 + Math.random() * 350;
    particles.push({
      x: canvasWidth * originX, y: canvasHeight * originY,
      velocityX: Math.cos(direction) * speed, velocityY: Math.sin(direction) * speed - (gentle ? 0 : 110),
      angle: Math.random() * Math.PI * 2, turn: gentle ? 0 : Math.random() * 8 - 4,
      size: 5 + Math.random() * 7, colour: colours[index % colours.length],
      life: 0, duration: gentle ? .8 : 2.3 + Math.random(), stars, gentle
    });
  }
  particles = particles.slice(-400);
  if (confettiFrame === null) { lastFrame = performance.now(); confettiFrame = requestAnimationFrame(drawConfetti); }
}

function drawConfetti(time) {
  const delta = Math.min((time - lastFrame) / 1000, .04);
  lastFrame = time;
  context.clearRect(0, 0, canvasWidth, canvasHeight);
  particles = particles.filter(particle => particle.life < particle.duration);
  for (const particle of particles) {
    particle.life += delta;
    particle.x += particle.velocityX * delta;
    particle.y += particle.velocityY * delta;
    particle.velocityY += (particle.gentle ? 12 : 280) * delta;
    particle.angle += particle.turn * delta;
    context.save();
    context.translate(particle.x, particle.y);
    context.rotate(particle.angle);
    const fadeIn = Math.min(particle.life / .12, 1);
    const fadeOut = Math.min((particle.duration - particle.life) / .6, 1);
    context.globalAlpha = Math.max(0, fadeIn * fadeOut);
    context.fillStyle = particle.colour;
    context.strokeStyle = "#242022";
    context.lineWidth = 1.5;
    context.beginPath();
    if (particle.stars) {
      for (let corner = 0; corner < 8; corner++) {
        const angle = corner * Math.PI / 4;
        const radius = corner % 2 ? particle.size * .3 : particle.size;
        context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      context.closePath();
    } else {
      context.rect(-particle.size / 2, -particle.size / 3, particle.size, particle.size * .65);
    }
    context.fill();
    context.stroke();
    context.restore();
  }
  if (particles.length) confettiFrame = requestAnimationFrame(drawConfetti);
  else { context.clearRect(0, 0, canvasWidth, canvasHeight); confettiFrame = null; }
}

elements.start.textContent = text("start");
elements.spin.textContent = text("spin");
elements.again.textContent = text("again");
elements["win-banner"].textContent = text("win");
document.title = text("greeting");
buildWheel();
const prize = svgElement("svg", { viewBox: "0 0 240 90", role: "img", "aria-label": CONFIG.segments[CONFIG.winningSegmentIndex].label });
addLogo(prize, 120, 45, 220);
elements["prize-card"].append(prize);
resizeCanvas();
addEventListener("resize", resizeCanvas, { passive: true });
elements.start.addEventListener("click", startParty);
elements.spin.addEventListener("click", spin);
elements.again.addEventListener("click", spin);