#!/usr/bin/env python3
# replace_tabs.py — safely replace the old tabs block with modern-tabs JSX and append CSS if needed

from pathlib import Path
import re
import sys

tsx_path = Path("web/src/Dashboard.tsx")
css_path = Path("web/src/Dashboard.css")

if not tsx_path.exists():
    print("ERROR: Dashboard.tsx not found at", tsx_path)
    sys.exit(1)
if not css_path.exists():
    print("ERROR: Dashboard.css not found at", css_path)
    sys.exit(1)

tsx = tsx_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")

# Backup (timestamped)
tsx_path.with_suffix(".tsx.bak.auto").write_text(tsx, encoding="utf-8")
css_path.with_suffix(".css.bak.auto").write_text(css, encoding="utf-8")
print("Backups written:", tsx_path.with_suffix(".tsx.bak.auto"), css_path.with_suffix(".css.bak.auto"))

# 1) Insert lucide import if missing (insert after the import of './Dashboard.css' or at top after last import)
lucide_import = "import { Package, Wrench, Repeat, ArrowLeftRight, BarChart3 } from 'lucide-react';\n"
if "from 'lucide-react'" not in tsx and "from \"lucide-react\"" not in tsx:
    # find location: after the import './Dashboard.css' line if present, else after the last import statement
    m = re.search(r"(import\s+['\"].*/Dashboard\.css['\"];?\s*\n)", tsx)
    if m:
        insert_at = m.end()
        tsx = tsx[:insert_at] + lucide_import + tsx[insert_at:]
        print("Inserted lucide import after Dashboard.css import.")
    else:
        # fallback: insert after last import line
        imports = list(re.finditer(r"^import .*;$", tsx, flags=re.MULTILINE))
        if imports:
            last = imports[-1]
            insert_at = last.end()
            tsx = tsx[:insert_at] + "\n" + lucide_import + tsx[insert_at:]
            print("Inserted lucide import after last import.")
        else:
            # top of file
            tsx = lucide_import + tsx
            print("Inserted lucide import at top of file.")
else:
    print("lucide import already present — skipping import insertion.")

# 2) Replace the specific tabs block (search for the block that uses the specific views array)
pattern = re.compile(
    r'<div\s+className="tabs">\s*'
    r"\{\(\s*\[\s*'inventory'\s*,\s*'operations'\s*,\s*'import-export'\s*,\s*'analytics'\s*\]\s*as\s*const\)\.map[\s\S]*?</div>",
    flags=re.MULTILINE
)
if not pattern.search(tsx):
    print("ERROR: Could not find the exact old tabs block. Aborting replacement. (Pattern not found)")
    # write nothing, keep backups
    sys.exit(2)

replacement = r'''<div className="tabs modern-tabs">
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
        className={`tab modern-tab ${isActive ? 'active' : ''}`}
        onClick={() => setActiveView(tab.id as any)}
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
</div>'''

tsx_new, count = pattern.subn(replacement, tsx, count=1)
if count == 0:
    print("ERROR: Replacement not applied (no matches).")
    sys.exit(3)

# Write changed tsx
tsx_path.write_text(tsx_new, encoding="utf-8")
print("Dashboard.tsx updated (1 replacement).")

# 3) Append CSS block to Dashboard.css if not already present
marker = "/* ===== Modern Tabs ===== */"
css_append = """
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
"""
if marker not in css:
    css_path.write_text(css + "\n" + css_append, encoding="utf-8")
    print("Appended modern-tabs CSS to Dashboard.css")
else:
    print("Dashboard.css already contains modern-tabs marker; skipping CSS append.")
print("Done.")
