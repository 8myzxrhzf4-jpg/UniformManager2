import { useState, useMemo } from 'react';
import type { GamePresenter, Assignment, UniformItem } from '../types';
import './SizeSuggestion.css';

interface SizeSuggestionProps {
  gps: Record<string, GamePresenter>;
  allAssignments: Record<string, Record<string, Assignment>>;
  inventory: Record<string, UniformItem>;
}

// Category = the item's name (e.g. "Shirt" groups all sizes together)
function getItemCategory(item: UniformItem): string {
  return item.name || (item as any).category || 'Other';
}

// Get unique categories (= unique item names) from inventory
function getCategories(inventory: Record<string, UniformItem>): string[] {
  const cats = new Set<string>();
  Object.values(inventory).forEach(item => {
    const cat = getItemCategory(item);
    if (cat) cats.add(cat);
  });
  return Array.from(cats).sort();
}

// Get all assignments for a GP by name or barcode
function getGPAssignments(
  gpName: string,
  allAssignments: Record<string, Record<string, Assignment>>
): Assignment[] {
  const results: Assignment[] = [];
  Object.values(allAssignments).forEach(cityAssignments => {
    Object.values(cityAssignments || {}).forEach(a => {
      if (a.gpName?.toLowerCase() === gpName.toLowerCase()) results.push(a);
    });
  });
  return results;
}

export function SizeSuggestion({ gps, allAssignments, inventory }: SizeSuggestionProps) {
  const [gpSearch, setGpSearch] = useState('');
  const [selectedGP, setSelectedGP] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const categories = useMemo(() => getCategories(inventory), [inventory]);

  // Flatten GPs
  const allGPs = useMemo(() => {
    const list: string[] = [];
    Object.values(gps).forEach(v => {
      if (v && typeof v === 'object') {
        if ('name' in v) {
          list.push((v as GamePresenter).name);
        } else {
          Object.values(v as Record<string, GamePresenter>).forEach(gp => {
            if (gp?.name) list.push(gp.name);
          });
        }
      }
    });
    return [...new Set(list)].sort();
  }, [gps]);

  const filteredGPs = useMemo(() => {
    if (!gpSearch.trim()) return [];
    const q = gpSearch.toLowerCase();
    return allGPs.filter(name => name.toLowerCase().includes(q)).slice(0, 8);
  }, [gpSearch, allGPs]);

  // ─── CORE SUGGESTION ALGORITHM ────────────────────────────────────────────
  const suggestion = useMemo(() => {
    if (!selectedGP || !selectedCategory) return null;

    // Step 1: Get the target GP's assignment history
    const targetAssignments = getGPAssignments(selectedGP, allAssignments);
    if (targetAssignments.length === 0) {
      return { type: 'no_history' as const, gpName: selectedGP };
    }

    // Step 2: Build a "size profile" for the target GP
    // Map: category (= item name) → sizes they've been issued
    const gpSizeProfile: Record<string, Set<string>> = {};
    targetAssignments.forEach(a => {
      const item = Object.values(inventory).find(i => i.barcode === a.itemBarcode);
      const cat = item ? getItemCategory(item) : (a.itemName || '');
      if (!cat) return;
      if (!gpSizeProfile[cat]) gpSizeProfile[cat] = new Set();
      gpSizeProfile[cat].add(a.itemSize);
    });

    // Check if they've already been issued this category
    const directMatch = targetAssignments.filter(a => {
      const item = Object.values(inventory).find(i => i.barcode === a.itemBarcode);
      const cat = item ? getItemCategory(item) : (a.itemName || '');
      return cat === selectedCategory;
    });

    if (directMatch.length > 0) {
      // Count sizes
      const sizeCounts: Record<string, number> = {};
      directMatch.forEach(a => {
        sizeCounts[a.itemSize] = (sizeCounts[a.itemSize] || 0) + 1;
      });
      const mostCommon = Object.entries(sizeCounts).sort((a, b) => b[1] - a[1])[0];
      return {
        type: 'direct' as const,
        size: mostCommon[0],
        confidence: 'high' as const,
        basis: `${selectedGP} has been issued this item before (${directMatch.length} time${directMatch.length > 1 ? 's' : ''})`,
        details: Object.entries(sizeCounts).map(([s, c]) => `${s} × ${c}`).join(', '),
      };
    }

    // Step 3: Collaborative filtering — find GPs with similar size profiles
    // Build a "signature" for the target GP using categories they share
    const targetCategories = Object.keys(gpSizeProfile);
    if (targetCategories.length === 0) {
      return { type: 'no_history' as const, gpName: selectedGP };
    }

    // For each other GP, compute overlap score
    const similarGPScores: Record<string, { score: number; targetCatSizes: string[] }> = {};

    Object.values(allAssignments).forEach(cityAssignments => {
      Object.values(cityAssignments || {}).forEach(a => {
        if (a.gpName === selectedGP) return;
        const item = Object.values(inventory).find(i => i.barcode === a.itemBarcode);
        const itemCat = item ? getItemCategory(item) : (a.itemName || '');
        if (!itemCat) return;
        const sharedCat = targetCategories.find(cat => cat === itemCat);
        if (!sharedCat) return;
        const targetSizes = gpSizeProfile[sharedCat];
        if (!targetSizes?.has(a.itemSize)) return;
        if (!similarGPScores[a.gpName]) {
          similarGPScores[a.gpName] = { score: 0, targetCatSizes: [] };
        }
        similarGPScores[a.gpName].score += 1;
      });
    });

    // Step 4: Among similar GPs, find what sizes they got for the target category
    const catSizeVotes: Record<string, number> = {};
    const similarGPNames = Object.keys(similarGPScores).filter(n => similarGPScores[n].score > 0);

    Object.values(allAssignments).forEach(cityAssignments => {
      Object.values(cityAssignments || {}).forEach(a => {
        if (!similarGPNames.includes(a.gpName)) return;
        const item = Object.values(inventory).find(i => i.barcode === a.itemBarcode);
        const itemCat = item ? getItemCategory(item) : (a.itemName || '');
        if (itemCat !== selectedCategory) return;
        const weight = similarGPScores[a.gpName]?.score || 1;
        catSizeVotes[a.itemSize] = (catSizeVotes[a.itemSize] || 0) + weight;
      });
    });

    if (Object.keys(catSizeVotes).length === 0) {
      return {
        type: 'insufficient' as const,
        similarCount: similarGPNames.length,
        gpName: selectedGP,
      };
    }

    const totalVotes = Object.values(catSizeVotes).reduce((s, v) => s + v, 0);
    const sorted = Object.entries(catSizeVotes).sort((a, b) => b[1] - a[1]);
    const topSize = sorted[0][0];
    const topPct = Math.round((sorted[0][1] / totalVotes) * 100);

    return {
      type: 'collaborative' as const,
      size: topSize,
      confidence: topPct >= 70 ? ('high' as const) : topPct >= 45 ? ('medium' as const) : ('low' as const),
      basis: `Based on ${similarGPNames.length} GP(s) with similar size profiles`,
      breakdown: sorted.map(([s, v]) => ({ size: s, pct: Math.round((v / totalVotes) * 100) })),
    };
  }, [selectedGP, selectedCategory, allAssignments, inventory, gps]);

  const confidenceColor = (c: string) =>
    c === 'high' ? 'var(--color-success)' : c === 'medium' ? 'var(--color-warning)' : 'var(--color-error)';

  return (
    <div className="size-suggestion card">
      <h2 className="text-accent">📏 Size Suggestion</h2>
      <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1.25rem' }}>
        Enter a GP and item category to get a size suggestion based on their previous issues and similar GPs.
      </p>

      <div className="suggestion-inputs">
        <div className="form-group" style={{ flex: 1 }}>
          <label className="field-label">Game Presenter</label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={gpSearch}
              onChange={e => { setGpSearch(e.target.value); setSelectedGP(null); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Search GP name..."
              className="input-dark"
            />
            {showSuggestions && filteredGPs.length > 0 && (
              <div className="ss-dropdown">
                {filteredGPs.map(name => (
                  <button key={name} className="ss-option" onClick={() => {
                    setSelectedGP(name);
                    setGpSearch(name);
                    setShowSuggestions(false);
                  }}>{name}</button>
                ))}
              </div>
            )}
          </div>
          {selectedGP && <p className="field-hint" style={{ color: 'var(--color-success)' }}>✓ {selectedGP}</p>}
        </div>

        <div className="form-group" style={{ flex: 1 }}>
          <label className="field-label">Item Category</label>
          <select
            className="input-dark"
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
          >
            <option value="">Select category...</option>
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
      </div>

      {/* Result */}
      {suggestion && (
        <div className="suggestion-result">
          {suggestion.type === 'direct' && (
            <div className="suggestion-box" style={{ borderColor: confidenceColor(suggestion.confidence) }}>
              <div className="suggestion-size">{suggestion.size}</div>
              <div className="suggestion-confidence" style={{ color: confidenceColor(suggestion.confidence) }}>
                {suggestion.confidence.toUpperCase()} confidence
              </div>
              <div className="suggestion-basis">{suggestion.basis}</div>
              {suggestion.details && <div className="suggestion-detail">History: {suggestion.details}</div>}
            </div>
          )}

          {suggestion.type === 'collaborative' && (
            <div className="suggestion-box" style={{ borderColor: confidenceColor(suggestion.confidence) }}>
              <div className="suggestion-size">{suggestion.size}</div>
              <div className="suggestion-confidence" style={{ color: confidenceColor(suggestion.confidence) }}>
                {suggestion.confidence.toUpperCase()} confidence
              </div>
              <div className="suggestion-basis">{suggestion.basis}</div>
              <div className="suggestion-breakdown">
                {suggestion.breakdown.map(({ size, pct }) => (
                  <div key={size} className="breakdown-bar">
                    <span className="breakdown-size">{size}</span>
                    <div className="breakdown-track">
                      <div className="breakdown-fill" style={{ width: `${pct}%`, background: size === suggestion.size ? 'var(--color-accent)' : 'var(--color-border)' }} />
                    </div>
                    <span className="breakdown-pct">{pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {suggestion.type === 'no_history' && (
            <div className="suggestion-empty">
              <span>⚠️</span>
              <p>{suggestion.gpName} has no assignment history to base a suggestion on.</p>
            </div>
          )}

          {suggestion.type === 'insufficient' && (
            <div className="suggestion-empty">
              <span>📊</span>
              <p>
                Found {suggestion.similarCount} GP(s) with similar profiles but none have been issued a <strong>{selectedCategory}</strong>. More data needed.
              </p>
            </div>
          )}
        </div>
      )}

      {!selectedGP && !selectedCategory && (
        <div className="suggestion-placeholder">
          Select a GP and category above to get a size recommendation.
        </div>
      )}
    </div>
  );
}
