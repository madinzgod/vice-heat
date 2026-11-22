// input.js — keyboard and mouse state, exposed as one small object the rest
// of the game polls each frame.
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    clicked: false, // true for exactly one frame after a press
    lastClickX: 0,
    lastClickY: 0,
  };

  window.addEventListener("keydown", (e) => {
    input.keys.add(e.key.toLowerCase());
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key.toLowerCase())) {
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => input.keys.delete(e.key.toLowerCase()));

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    input.mouseY = ((e.clientY - rect.top) / rect.height) * canvas.height;
  });
  canvas.addEventListener("mousedown", (e) => {
    input.mouseDown = true;
    input.clicked = true;
    input.lastClickX = input.mouseX;
    input.lastClickY = input.mouseY;
  });
  window.addEventListener("mouseup", () => { input.mouseDown = false; });

  input.down = (...names) => names.some((n) => input.keys.has(n));
  input.endFrame = () => { input.clicked = false; };
  return input;
}
