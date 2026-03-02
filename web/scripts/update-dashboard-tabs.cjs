/**
 * update-dashboard-tabs.js
 * - Adds lucide-react import to web/src/Dashboard.tsx (if missing)
 * - Replaces the old tabs block with the modern tabs JSX
 * - Appends the modern tabs CSS to web/src/Dashboard.css (if not already present)
 *
 * Run from repo root: node web/scripts/update-dashboard-tabs.js
 */

const fs = require('fs');
const path = require('path');

const DASH_TSX = path.join('web', 'src', 'Dashboard.tsx');
const DASH_CSS = path.join('web', 'src', 'Dashboard.css');

if (!fs.existsSync(DASH_TSX)) {
  console.error('ERROR: File not found:', DASH_TSX);
  process.exit(1);
}
if (!fs.existsSync(DASH_CSS)) {
  console.error('ERROR: File not found:', DASH_CSS);
  process.exit(1);
}

// Read files
let tsx = fs.readFileSync(DASH_TSX, 'utf8');
let css = fs.readFileSync(DASH_CSS, 'utf8');

// 1) Insert lucide import after the first react import (if not already present)
const lucideImport = "import { Package, Wrench, Repeat, ArrowLeftRight, BarChart3 } from 'lucide-react';\\n";
if (!/from\s+['"]lucide-react['"]/.test(tsx) && /from\s+['"]react['"]/.test(tsx)) {
  // Insert after the first line that imports from 'react'
  tsx = tsx.replace(/(import\s+[^;]+?\s+from\s+['"]react['"];?\s*)/, `$1\n${lucideImport}`);
  console.log('Inserted lucide-react import into Dashboard.tsx');
} else {
  console.log('lucide-react import already present or no react import found (skipping import insertion).');
}

// 2) Replace the tabs block that contains the specific view array with the modern-tabs block.
// Find the unique marker for the old block:
const marker = "(['inventory', 'operations', 'loaners', 'import-export', 'analytics'";

// const replacement JSX (modern tabs)
const replacement = `
<div className="tabs modern-tabs">
  {[
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'operations', label: 'Operations', icon: Wrench },
    { id: 'loaners', label: 'Loaners', icon: Repeat },
    { id: 'import-export', label: 'Import/Export', icon: ArrowLeftRight },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ].map(tab => {
    const Icon = tab.icon;
    const isActive = activeView === tab.id;

    return (
      <button
        key={tab.id}
        className={\`tab modern-tab \${isActive ? 'active' : ''}\`}
        onClick={() => setActiveView(tab.id)}
        aria-pressed={isActive}
        type="button"
        title={tab.label}
      >
        <Icon size={18} strokeWidth={2} />
        <span>{tab.label}</span>
        {isActive && <div className="tab-underline" />}
      </button>
    );
  })}
</div>
`;

// Perform a DOM-like matching for the <div className="tabs"> ... matching closing </div> using simple stack counting
const markerIndex = tsx.indexOf(marker);
if (markerIndex === -1) {
  console.error('ERROR: Could not find the expected tabs marker in Dashboard.tsx. Aborting automatic replacement.');
  process.exit(1);
}

const startDivIndex = tsx.lastIndexOf('<div className="tabs"', markerIndex);
if (startDivIndex === -1) {
  console.error('ERROR: Could not find the opening <div className="tabs"> before the marker. Aborting.');
  process.exit(1);
}

// Walk forward from startDivIndex and find matching closing </div> for that opening <div>
const sliceFromStart = tsx.slice(startDivIndex);
const tagRegex = /<div\b|<\/div>/g;
let depth = 0;
let match;
let endOffset = -1;
while ((match = tagRegex.exec(sliceFromStart)) !== null) {
  if (match[0].startsWith('<div')) {
    depth++;
  } else {
    depth--;
  }
  if (depth === 0) {
    endOffset = tagRegex.lastIndex; // position after the matching </div> inside sliceFromStart
    break;
  }
}

if (endOffset === -1) {
  console.error('ERROR: Failed to locate the matching closing </div> for the tabs block. Aborting.');
  process.exit(1);
}

const globalEndIndex = startDivIndex + endOffset;
const before = tsx.slice(0, startDivIndex);
const after = tsx.slice(globalEndIndex);

// Backup original
fs.writeFileSync(DASH_TSX + '.bak', tsx, 'utf8');
console.log('Backup created:', DASH_TSX + '.bak');

// Replace
tsx = before + replacement + after;
fs.writeFileSync(DASH_TSX, tsx, 'utf8');
console.log('Replaced old tabs block with modern-tabs in Dashboard.tsx');

// 3) Append CSS to Dashboard.css if not already present
const cssMarker = '/* ===== Modern Tabs ===== */';
const cssAppend = `
/* ===== Modern Tabs ===== */

.modern-tabs {
  display: flex;
  gap: 28px;
  border-bottom: 1px solid var(--color-border, #374151);
  align-items: center;
  padding-bottom: 8px;
}

.modern-tab {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
  background: transparent;
  border: none;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.9rem;
  color: var(--color-text-secondary, #9ca3af);
  transition: color 0.18s ease, transform 0.06s ease;
  gap: 10px;
}

.modern-tab svg { display: block; opacity: 0.92; }

.modern-tab:hover {
  color: var(--color-text-primary, #e5e7eb);
  transform: translateY(-1px);
}

.modern-tab.active {
  color: var(--color-accent, #fbbf24); /* gold */
}

.tab-underline {
  position: absolute;
  bottom: -1px;
  left: 0;
  width: 100%;
  height: 2px;
  background: var(--color-accent, #fbbf24);
  border-radius: 2px;
}
`;

if (!css.includes(cssMarker)) {
  // Backup css
  fs.writeFileSync(DASH_CSS + '.bak', css, 'utf8');
  fs.appendFileSync(DASH_CSS, '\n' + cssAppend, 'utf8');
  console.log('Appended modern-tabs CSS to Dashboard.css and created backup:', DASH_CSS + '.bak');
} else {
  console.log('Dashboard.css already contains modern-tabs CSS marker; skipping CSS append.');
}

console.log('Done. Please run: git add web/src/Dashboard.tsx web/src/Dashboard.css && git commit -m "UI: modern icon tabs on dashboard" && git push');
