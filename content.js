let active = false;
let inspector;
let lastHovered = null;
let globalClickHandler = null;

const popup = document.createElement('div');
popup.id = 'mirror-popup';
popup.innerHTML = `
  <button data-action="head">Add mirror-flot-head</button>
  <button data-action="body">Add mirror-float-body</button>
  <button data-action="clear">Clear attribute</button>
`;
document.body.appendChild(popup);

// Basic styling
const style = document.createElement('style');
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
    lastHovered.style.outline = "";
  }
  if (el) {
    el.classList.add("highlight");
    el.style.outline = "2px solid red";
    lastHovered = el;
  }
}

function removeHighlight() {
  if (lastHovered) {
    lastHovered.classList.remove("highlight");
    lastHovered.style.outline = "";
    lastHovered = null;
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

// ------------------- Handle Image Replacement -------------------
function handleClick(el) {
  if (!el) return;

  if (popup.contains(el)) return;

  console.log(el)

  // If clicking outside popup while it's open, close it
  if (popup.style.display === 'block' && el.target !== currentElement) {
    popup.style.display = 'none';
    currentElement = null;
    return;
  }

  currentElement = el;

  // Get clicked element position
  const rect = currentElement.getBoundingClientRect();
  popup.style.top = `${rect.bottom + window.scrollY + 5}px`;
  popup.style.left = `${rect.left + window.scrollX}px`;
  popup.style.display = 'block';
}


popup.addEventListener('click', (e) => {
  const action = e.target.getAttribute('data-action');
  if (!currentElement || !action) return;

  // Remove both attributes first
  currentElement.removeAttribute('mirror-float-head');
  currentElement.removeAttribute('mirror-float-body');

  if (action === 'head') {
    currentElement.setAttribute('mirror-float-head', 'true');
  } else if (action === 'body') {
    currentElement.setAttribute('mirror-float-body', 'true');
  }

  popup.style.display = 'none';
  currentElement = null;
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



