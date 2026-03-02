#!/usr/bin/env python3
from pathlib import Path
import re
import sys
tsx_path = Path("web/src/Dashboard.tsx")
css_path = Path("web/src/Dashboard.css")
if not tsx_path.exists() or not css_path.exists():
    print("ERROR: Expected files not found:", tsx_path, css_path)
    sys.exit(1)

tsx = tsx_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")

# automatic backups
tsx_path.write_text(tsx, encoding="utf-8")  # ensure normalized encoding
(tsx_path.with_suffix(".tsx.bak.auto")).write_text(tsx, encoding="utf-8")
(css_path.with_suffix(".css.bak.auto")).write_text(css, encoding="utf-8")
print("Backups written:", tsx_path.with_suffix(".tsx.bak.auto"), css_path.with_suffix(".css.bak.auto"))

# 1) Ensure lucide import exists (insert after import './Dashboard.css'; or after last import)
lucide_line = "import { Package, Wrench, Repeat, ArrowLeftRight, BarChart3 } from 'lucide-react';"
if "from 'lucide-react'" not in tsx and 'from "lucide-react"' not in tsx:
    # prefer to insert right after the Dashboard.css import
    m = re.search(r"(import\s+['\"]\./Dashboard\.css['\"];?\s*\n)", tsx)
    if m:
        tsx = tsx[:m.end()] + lucide_line + "\n" + tsx[m.end():]
        print("Inserted lucide import after Dashboard.css import.")
    else:
        # insert after last import statement
        last_import = None
        for match in re.finditer(r"^import .*?;$", tsx, flags=re.MULTILINE):
            last_import = match
        if last_import:
            insert_at = last_import.end()
            tsx = tsx[:insert_at] + "\n" + lucide_line + "\n" + tsx[insert_at:]
            print("Inserted lucide import after last import.")
        else:
            tsx = lucide_line + "\n" + tsx
            print("Inserted lucide import at top of file.")
else:
    print("lucide import already present — skipping insertion.")

# 2) Replace inner <div className="tabs">...</div> (the inner tabs inside view-tabs)
# Use non-greedy match to replace the first occurrence of a <div className="tabs">...</div>
pattern = re.compile(r'<div\s+className="tabs">[\s\S]*?<\/div>', re.MULTILINE)
if not pattern.search(tsx):
    print("ERROR: Could not find inner <div className=\"tabs\"> block to replace. Aborting.")
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

tsx_new, cnt = pattern.subn(replacement, tsx, count=1)
if cnt == 0:
    print("ERROR: substitution failed (no replacements).")
    sys.exit(3)

tsx_path.write_text(tsx_new, encoding="utf-8")
print("Replaced inner tabs block in Dashboard.tsx")

# 3) Append modern-tabs CSS if missing
css_marker = "/* ===== Modern Tabs ===== */"
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
if css_marker not in css:
    css_path.write_text(css + "\n" + css_append, encoding="utf-8")
    print("Appended modern-tabs CSS to Dashboard.css")
else:
    print("Dashboard.css already contains modern-tabs CSS marker; skipping append.")

print("Done. Please review changes and run git diff.")
