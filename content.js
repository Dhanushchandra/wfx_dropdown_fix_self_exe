let active = false;
let inspector;
let lastHovered = null;
let globalClickHandler = null;

const popup = document.createElement("div");
popup.id = "mirror-popup";
popup.innerHTML = `
  <button data-action="head">Add mirror-flot-head</button>
  <button data-action="body">Add mirror-float-body</button>
  <button data-action="clear">Clear attribute</button>
`;
document.body.appendChild(popup);

// Basic styling
const style = document.createElement("style");
style.textContent = `
  #mirror-popup {
    position: absolute;
    background: #fff;
    border: 1px solid #ccc;
    box-shadow: 0 2px 6px rgba(0,0,0,0.25);
    padding: 6px;
    border-radius: 4px;
    z-index: 999999;
    display: none;
    pointer-events: none; 
  }

  #mirror-popup button {
    display: block;
    width: 100%;
    background: none;
    border: none;
    padding: 6px 8px;
    text-align: left;
    cursor: pointer;
    pointer-events: all; 
  }

  #mirror-popup button:hover {
    background: #f0f0f0;
  }
`;
document.head.appendChild(style);

let currentElement = null;

// Keep track of all attached listeners for proper removal
const attachedListeners = new WeakMap();

// ------------------- Inspector Overlay -------------------
function createInspector() {
  inspector = document.createElement("div");
  inspector.id = "dom-inspector";
  document.body.appendChild(inspector);
}

// ------------------- Highlight / Remove Highlight -------------------
function highlight(el) {
  if (lastHovered && lastHovered !== el) {
    lastHovered.classList.remove("highlight");
    // ✅ Restore its original outline color if part of a pair
    restorePairOutline(lastHovered);
  }

  if (el) {
    el.classList.add("highlight");
    el.style.outline = "2px dashed red";
    el.style.outlineOffset = "4px";
    lastHovered = el;
  }
}

function removeHighlight() {
  if (lastHovered) {
    lastHovered.classList.remove("highlight");
    // ✅ Restore pair outline if any
    restorePairOutline(lastHovered);
    lastHovered = null;
  }
}

// Helper: restores correct outline color if element is part of a pair
function restorePairOutline(el) {
  const headId = el.getAttribute("mirror-float-head");
  const bodyId = el.getAttribute("mirror-float-body");
  const pairId = headId || bodyId;
  if (pairId) {
    applyPairColor(el, pairId);
  } else {
    el.style.outline = "none";
  }
}

// ------------------- Show Element Info -------------------
function showInfo(el) {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const className =
    typeof el.className === "string"
      ? el.className
      : el.className?.baseVal || ""; // handle SVG case
  const cls = className ? `.${className.split(" ").join(".")}` : "";

  if (inspector) inspector.innerHTML = `<b>${tag}${id}${cls}</b>`;
}

// ------------------- Handle Click -------------------
function handleClick(el) {
  if (!el) return;

  if (popup.contains(el)) return;

  console.log(el);

  // If clicking outside popup while it's open, close it
  if (popup.style.display === "block" && el.target !== currentElement) {
    popup.style.display = "none";
    currentElement = null;
    return;
  }

  currentElement = el;

  // Get clicked element position
  const rect = currentElement.getBoundingClientRect();
  popup.style.top = `${rect.bottom + window.scrollY + 5}px`;
  popup.style.left = `${rect.left + window.scrollX}px`;
  popup.style.display = "block";
}

let pairCounter = 0;
const pairs = {}; // {1: {head: element|null, body: element|null}}

const pairColors = {};
const colorPalette = [
  "#FF5733",
  "#33B5FF",
  "#33FF57",
  "#FFC300",
  "#9B33FF",
  "#FF33A8",
  "#33FFF9",
  "#FF8F33",
  "#33FF9F",
  "#FF3333",
];

function getPairColor(id) {
  if (!pairColors[id]) {
    pairColors[id] = colorPalette[(id - 1) % colorPalette.length];
  }
  return pairColors[id];
}

function applyPairColor(element, id) {
  const color = getPairColor(id);
  element.style.outline = `3px solid ${color}`;
  element.style.outlineOffset = "2px";
}

popup.addEventListener("click", (e) => {
  const action = e.target.getAttribute("data-action");
  if (!currentElement || !action) return;

  // Remove any mirror attributes from the clicked element
  currentElement.removeAttribute("mirror-float-head");
  currentElement.removeAttribute("mirror-float-body");

  // 🔹 Clear button
  if (action === "clear") {
    for (const id in pairs) {
      if (pairs[id].head === currentElement) pairs[id].head = null;
      if (pairs[id].body === currentElement) pairs[id].body = null;
    }
    currentElement.style.outline = "none";
    popup.style.display = "none";
    currentElement = null;
    return;
  }

  // 🔹 Add Head
  if (action === "head") {
    let assignedId;

    // 1️⃣ First look for a pair that has missing head
    let missingHeadId = Object.keys(pairs).find((id) => !pairs[id].head);
    // 2️⃣ Then check for open head without body
    let openHeadId = Object.keys(pairs).find(
      (id) => pairs[id].head && !pairs[id].body
    );

    if (missingHeadId) {
      // Fill missing head in that pair
      pairs[missingHeadId].head = currentElement;
      currentElement.setAttribute("mirror-float-head", missingHeadId);
      assignedId = missingHeadId;
    } else if (openHeadId) {
      // Replace unpaired head
      const oldHead = pairs[openHeadId].head;
      if (oldHead && oldHead !== currentElement) {
        oldHead.removeAttribute("mirror-float-head");
        oldHead.style.outline = "none";
      }
      pairs[openHeadId].head = currentElement;
      currentElement.setAttribute("mirror-float-head", openHeadId);
      assignedId = openHeadId;
    } else {
      // Create new pair
      pairCounter++;
      pairs[pairCounter] = { head: currentElement, body: null };
      currentElement.setAttribute("mirror-float-head", pairCounter);
      assignedId = pairCounter;
    }

    applyPairColor(currentElement, assignedId);
  }

  // 🔹 Add Body
  else if (action === "body") {
    let assignedId;

    // 1️⃣ Find pair that has a head but no body (perfect match)
    let pairWithHeadOnly = Object.keys(pairs).find(
      (id) => pairs[id].head && !pairs[id].body
    );
    // 2️⃣ If no such pair, find any pair missing a body
    let missingBodyId = Object.keys(pairs).find((id) => !pairs[id].body);
    // 3️⃣ Otherwise, fallback to last pair that has head (for replacement)
    let lastHeadPairId = Object.keys(pairs)
      .map(Number)
      .sort((a, b) => b - a)
      .find((id) => pairs[id].head);

    if (pairWithHeadOnly) {
      // Pair with only head — perfect spot for new body
      pairs[pairWithHeadOnly].body = currentElement;
      currentElement.setAttribute("mirror-float-body", pairWithHeadOnly);
      assignedId = pairWithHeadOnly;
    } else if (missingBodyId) {
      // Fill missing body (after clear)
      pairs[missingBodyId].body = currentElement;
      currentElement.setAttribute("mirror-float-body", missingBodyId);
      assignedId = missingBodyId;
    } else if (lastHeadPairId) {
      // Replace existing body in the most recent head+body pair
      const oldBody = pairs[lastHeadPairId].body;
      if (oldBody && oldBody !== currentElement) {
        oldBody.removeAttribute("mirror-float-body");
        oldBody.style.outline = "none";
      }
      pairs[lastHeadPairId].body = currentElement;
      currentElement.setAttribute("mirror-float-body", lastHeadPairId);
      assignedId = lastHeadPairId;
    } else {
      // No pair at all → create a new body-only pair
      pairCounter++;
      pairs[pairCounter] = { head: null, body: currentElement };
      currentElement.setAttribute("mirror-float-body", pairCounter);
      assignedId = pairCounter;
    }

    applyPairColor(currentElement, assignedId);
  }

  popup.style.display = "none";
  currentElement = null;

  console.log(
    "Pairs:",
    Object.keys(pairs).map((id) => ({
      id,
      head: !!pairs[id].head,
      body: !!pairs[id].body,
    }))
  );
});

// ------------------- Find first <img> in composedPath -------------------
function findClickedImage(path) {
  for (let el of path) {
    if (!el.tagName) continue;
    if (el.tagName.toLowerCase()) return el;
  }
  return null;
}

// ------------------- Attach Listeners Recursively -------------------
function attachListeners(node) {
  if (!node || attachedListeners.has(node)) return;

  const handlers = {
    mouseover: (e) => {
      if (e.target === inspector) return;
      highlight(e.target);
      showInfo(e.target);
    },
    mouseleave: () => {
      removeHighlight();
      if (inspector)
        inspector.textContent =
          "Hover elements to inspect. Click images to replace.";
    },
  };

  node.addEventListener("mouseover", handlers.mouseover);
  node.addEventListener("mouseleave", handlers.mouseleave);

  attachedListeners.set(node, handlers);

  node.childNodes.forEach(attachListeners);
  if (node.shadowRoot) attachListeners(node.shadowRoot);
}

// ------------------- Remove Listeners Recursively -------------------
function removeListeners(node) {
  if (!node || !attachedListeners.has(node)) return;

  const handlers = attachedListeners.get(node);
  node.removeEventListener("mouseover", handlers.mouseover);
  node.removeEventListener("mouseleave", handlers.mouseleave);

  attachedListeners.delete(node);

  node.childNodes.forEach(removeListeners);
  if (node.shadowRoot) removeListeners(node.shadowRoot);
}

// ------------------- Activate / Deactivate Inspector -------------------
function activateInspector() {
  if (active) return;
  active = true;

  createInspector();
  attachListeners(document.documentElement);

  globalClickHandler = (e) => {
    if (!active) return;
    const img = findClickedImage(e.composedPath());
    if (img) {
      e.preventDefault();
      e.stopPropagation();
      handleClick(img);
    }
  };

  document.addEventListener("click", globalClickHandler);
}

function deactivateInspector() {
  active = false;

  removeHighlight();
  if (inspector) inspector.remove();
  inspector = null;

  removeListeners(document.documentElement);

  if (globalClickHandler) {
    document.removeEventListener("click", globalClickHandler);
    globalClickHandler = null;
  }
}

// ------------------- Extension Toggle -------------------
chrome.storage.local.get("enabled", (data) => {
  if (data.enabled) activateInspector();
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled) {
    changes.enabled.newValue ? activateInspector() : deactivateInspector();
  }
});
