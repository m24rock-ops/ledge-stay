# Wishlist Feature - Implementation Reference

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   Page Load (DOMContentLoaded)              │
├─────────────────────────────────────────────────────────────┤
│  1. initWishlistEventDelegation() - Setup click listener    │
│  2. loadWishlistState() - Load from localStorage            │
│  3. Page route loads listings via API                       │
│  4. renderWishlistHeart() generates button HTML             │
│  5. applyWishlistStateToButtons() applies saved classes     │
└─────────────────────────────────────────────────────────────┘
```

## Key Functions

### 1. initWishlistEventDelegation()
**Purpose:** Set up global event delegation for all heart buttons
**Called:** Once on page load in DOMContentLoaded
**Behavior:** 
- Listens for ANY click in the document
- Checks if clicked element has `[data-wishlist-id]` attribute
- Calls `toggleWishlist()` if so
- Uses event capture to intercept even if propagation stopped

```javascript
function initWishlistEventDelegation() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-wishlist-id]');
    if (!btn) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const listingId = btn.getAttribute('data-wishlist-id');
    toggleWishlist(listingId, { source: 'card' });
  }, true);
}
```

### 2. loadWishlistState()
**Purpose:** Initialize wishlist state on page load
**Behavior:**
- Read from localStorage key: `wishlist_listing_ids`
- Populate `savedListingIds` Set
- If logged in, sync with backend `/api/wishlist`
- Merge local + remote, persist back
- Call `applyWishlistStateToButtons()` when done

### 3. toggleWishlist(listingId, options)
**Purpose:** Handle wishlist toggle on button click
**Parameters:**
- `listingId`: ID of the listing to toggle
- `options.source`: Where toggle came from (e.g., 'card', 'wishlist')

**Behavior:**
1. Toggle in memory: `savedListingIds.add()` or `.delete()`
2. Persist to localStorage immediately (optimistic UI)
3. Update button classes and SVG colors
4. If logged in, sync to backend (POST or DELETE)
5. On error, rollback and show alert

### 4. applyWishlistStateToButtons()
**Purpose:** Sync DOM button states with `savedListingIds` Set
**Called After:**
- Page load (loadWishlistState)
- Listings rendered (loadListings)
- Toggle complete (toggleWishlist)

**Behavior:**
- Find all `[data-wishlist-id]` buttons
- For each, check if ID is in `savedListingIds`
- Add/remove `is-saved` class
- Set SVG fill/stroke colors via attributes

## Data Flow

### When Heart Clicked:
```
User clicks heart
  ↓
initWishlistEventDelegation() captures event
  ↓
Check e.target.closest('[data-wishlist-id]')
  ↓
setTimeout NOT used - sync call to toggleWishlist()
  ↓
Optimistic UI update (immediate):
  - savedListingIds.add(id)
  - persistWishlistIds() → localStorage
  - updateWishlistButtons(id) → UI
  ↓
Backend sync (async, fires separately):
  - POST /api/wishlist if adding
  - DELETE /api/wishlist/:id if removing
  ↓
On error, rollback everything
```

### When Listing Cards Rendered:
```
loadListings() → fetch /api/listings
  ↓
SQL query returns array of listings
  ↓
Loop through, generate HTML with renderWishlistHeart()
  ↓
Insert into DOM via innerHTML
  ↓
Call applyWishlistStateToButtons()
  ↓
For each button, apply is-saved class if ID in savedListingIds
```

## Storage

### localStorage Key: "wishlist_listing_ids"
```javascript
// Value is JSON array of IDs
[
  "507f1f77bcf86cd799439011",
  "507f1f77bcf86cd799439012",
  "507f1f77bcf86cd799439013"
]

// Read:
const ids = JSON.parse(localStorage.getItem('wishlist_listing_ids'));

// Write:
localStorage.setItem('wishlist_listing_ids', JSON.stringify([...savedListingIds]));
```

## Global State

### savedListingIds (Set)
```javascript
let savedListingIds = new Set();
// Example: new Set(['id1', 'id2', 'id3'])

// Check if saved:
savedListingIds.has(listingId) → true/false

// Add:
savedListingIds.add(listingId)

// Remove:
savedListingIds.delete(listingId)
```

## HTML Structure

### Card with Wishlist Button
```html
<div class="listing-card" id="listing-card-123">
  <div class="card-img-wrap">  <!-- Must have position: relative -->
    <img src="..." />
    
    <!-- Wishlist button -->
    <button
      class="wishlist-heart wishlist-heart--card"
      data-wishlist-id="123"
      aria-pressed="false"
      aria-label="Save to wishlist"
      type="button"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20.8l-1.45-1.32C5.4 14.36 2 11.28 2 7.5..." />
      </svg>
    </button>
    
    <!-- Other badges -->
  </div>
  <div class="card-body">
    ...
  </div>
</div>
```

### Wishlist Button After Toggle
```html
<!-- Before: unsaved state -->
<button class="wishlist-heart wishlist-heart--card">
  <svg fill="none" stroke="#f472b6">...</svg>
</button>

<!-- After: saved state (is-saved class added) -->
<button class="wishlist-heart wishlist-heart--card is-saved">
  <svg fill="#ec4899" stroke="#ec4899">...</svg>
</button>
```

## CSS Classes

### .wishlist-heart
Base button styling:
- 38px circle
- White background with subtle border
- Shadow effect
- Transitions on transform, box-shadow, background, border

### .wishlist-heart--card
Positioned absolutely over card image:
- position: absolute
- top: 12px, right: 12px
- z-index: 2

### .wishlist-heart.is-saved
When item is wishlisted:
- SVG and path fill: #ec4899 (pink)
- SVG and path stroke: #ec4899 (pink)

### .wishlist-heart:hover
Enhanced visual feedback:
- transform: translateY(-1px)
- Enhanced shadow
- Border color shifts to pink

### .wishlist-heart:focus-visible
Keyboard accessibility:
- 2px solid outline
- 2px offset

## Responsive Sizing

### Desktop
- Heart: 38px
- SVG icon: 18px
- Position: top 12px, right 12px

### Mobile (≤640px)
- Heart: 34px
- SVG icon: 16px
- Position: top 10px, right 10px

## API Integration (Optional)

If user is logged in, syncs to backend:

### POST /api/wishlist
```javascript
{
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <token>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ listingId: 'id123' })
}
```

### DELETE /api/wishlist/:listingId
```javascript
{
  method: 'DELETE',
  headers: {
    'Authorization': 'Bearer <token>'
  }
}
```

## Error Scenarios

### Wishlist Not Available
```javascript
if (!canUseWishlist()) return; // Silently skip
```

### Backend Sync Failed
```javascript
// Rollback to previous state
savedListingIds.delete(id);  // If was adding
persistWishlistIds(savedListingIds); // Save to localStorage
updateWishlistButtons(id, false); // Revert UI
alert('Unable to update your saved listings.');
```

### localStorage Quota Exceeded
```javascript
// Handled in persistWishlistIds():
try {
  localStorage.setItem(...);
} catch (err) {
  console.warn('wishlist storage write failed:', err);
  // Continue anyway, state still in memory
}
```

## Testing Checklist

- [ ] Heart button appears on all cards
- [ ] Clicking heart toggles color (pink ↔ outline)
- [ ] Clicking heart toggles `is-saved` class
- [ ] Colors persist after page refresh
- [ ] Multiple clicks work correctly
- [ ] Works on dynamically loaded cards
- [ ] Works with pagination
- [ ] Works with search/filters
- [ ] No console errors
- [ ] Console shows [wishlist] logs
- [ ] localStorage updates correctly
- [ ] Backend syncs work when logged in
- [ ] Rollback works on API error
- [ ] Works in different browsers
- [ ] Works on mobile viewport
- [ ] Keyboard accessible (Enter/Space)
