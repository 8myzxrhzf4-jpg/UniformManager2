/**
* Temporary stub for local testing.
* Replace with the real selector/context implementation later.
*
* The functions below return a DB city key and the selected studio.
* They first try localStorage, then fall back to a sensible default.
*/
export function getSelectedCityKey() {
	if (typeof window !== "undefined") {
		const v = window.localStorage.getItem("selectedCityKey") ?? window.localStorage.getItem("selectedCity");
		if (v) return v;
	}
	// fallback default matching the Firebase hierarchy you showed
	return "Atlantic City";
}

export function getSelectedStudio() {
	if (typeof window !== "undefined") {
		const v = window.localStorage.getItem("selectedStudio");
		if (v) {
			// If v looks like a numeric id (option value), try to resolve the display text
			if (/^\d+$/.test(v)) {
				try {
					const sel = document.getElementById('studio-select') as HTMLSelectElement | null;
					if (sel) {
						// First try the selectedIndex (common when the UI set the select)
						const idx = sel.selectedIndex;
						if (typeof idx === 'number' && idx >= 0 && sel.options[idx]) {
							const text = sel.options[idx].text;
							if (text) return text;
						}
						// Otherwise try to find an option with that value
						for (let i = 0; i < sel.options.length; i++) {
							if (sel.options[i].value === v) {
								return sel.options[i].text || v;
							}
						}
					}
				} catch (e) {
					// fall through to return raw value
				}
			}
			return v;
		}
	}
	// fallback default used in your Firebase objects
	return "Ocean";
}
