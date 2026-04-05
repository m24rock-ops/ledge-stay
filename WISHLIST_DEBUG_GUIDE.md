# Wishlist Feature - Debug & Testing Guide

## What Was Fixed

### 1. **Event Delegation Added**
- Added `initWishlistEventDelegation()` function that sets up a global click listener
- Catches clicks on any element with `[data-wishlist-id]` attribute
- Uses event capturing (`true` parameter) to ensure it catches clicks even if propagation is stopped
- Called automatically on `DOMContentLoaded`

### 2. **Enhanced Logging**
All wishlist functions now log to console with `[wishlist]` prefix:
- `loadWishlistState()` - Shows what IDs are loaded from localStorage
- `toggleWishlist()` - Shows when toggle happens, old/new state
- `applyWishlistStateToButtons()` - Shows how many buttons found and their states
- `initWishlistEventDelegation()` - Shows when button is clicked

### 3. **Better Error Handling**
- Added null checks in `toggleWishlist()`
- Trim and validate listing IDs
- Console warnings when wishlist not available
- Proper error logging instead of silent fails

## How to Debug

### Step 1: Open Browser Console
Press `F12` or right-click → Inspect → Console tab

### Step 2: Check Initialization (Load Page Trace)
```
[wishlist] init: loaded from localStorage [...]
[wishlist] init: no sync (not logged in)
```

### Step 3: Check Button Rendering
Go to /browse, inspect a listing card. Find the heart button:
```html
<button class="wishlist-heart wishlist-heart--card" data-wishlist-id="12345">
  <svg>...</svg>
</button>
```

**Check:**
- ✓ Button has `data-wishlist-id` attribute with listing ID
- ✓ Button has class `wishlist-heart`
- ✓ SVG inside has `<path>` element

### Step 4: Click a Heart Button & Watch Console
When you click the heart, you should see:
```
[wishlist] button clicked for listing: <ID>
[wishlist] toggle { normalizedId: '<ID>', wasSaved: false, nextSaved: true, ... }
[wishlist] state updated { normalizedId: '<ID>', nextSaved: true }
```

### Step 5: Check localStorage
In Console, run:
```javascript
localStorage.getItem('wishlist_listing_ids')
// Should show: ["id1", "id2", "id3"]
```

### Step 6: Check Persistence
- Heart should have `is-saved` class
- Heart should be PINK (#ec4899) color
- Refresh page → Heart should still be pink

### Step 7: Test Fresh Listing Load
- Trigger a new listing load (click pagination, filter, etc.)
- Console should show:
```
[wishlist] applyState: found X buttons, savedIds: [...]
[wishlist] button state: { listingId: '123', saved: true, hasClass: true }
```

## Common Issues & Solutions

### Issue: Console shows no [wishlist] logs
**Cause:** Event delegation not initialized
**Fix:** Check that `initWishlistEventDelegation()` is called in DOMContentLoaded

### Issue: Button exists but doesn't respond to click
**Cause:** Event delegation not working
**Fix:** Check browser console for JavaScript errors

### Issue: Heart color doesn't change
**Cause:** CSS `.is-saved` class not applying
**Fix:** Verify CSS has:
```css
.wishlist-heart.is-saved svg,
.wishlist-heart.is-saved svg path {
  fill: #ec4899;
  stroke: #ec4899;
}
```

### Issue: State lost on refresh
**Cause:** localStorage not being written
**Fix:** In Console, verify:
```javascript
localStorage.getItem('wishlist_listing_ids')
// Should return JSON array, not null
```

### Issue: Heart syncs with backend but fails silently
**Cause:** API error not visible
**Fix:** Check Console Network tab:
- POST /api/wishlist should return 200
- DELETE /api/wishlist/:id should return 200

## Feature Checklist

- [ ] Clicking heart toggles state (UI updates immediately)
- [ ] Heart color changes from pink outline to solid pink
- [ ] localStorage "wishlist_listing_ids" updates with list of IDs
- [ ] Refresh page → wishlist persists (for non-logged-in users)
- [ ] Multiple cards show correct saved state
- [ ] Works on dynamically loaded cards (pagination, filters, search)
- [ ] Works without login (localStorage only)
- [ ] Works with login (syncs to backend)
- [ ] No JavaScript errors in console
- [ ] Console logs show proper progression

## Performance Notes

- Event delegation uses single global listener (efficient)
- `applyWishlistStateToButtons()` called only when needed (after card render)
- localStorage operations are synchronous but very fast (<1ms)
- No memory leaks from event listeners (single capture listener)

## Testing Without Login

1. Open in incognito/private window
2. Go to /browse
3. Click a heart button
4. Verify console logs and UI change
5. Refresh page
6. Verify heart is still pink
7. Check localStorage still has the ID

## Testing With Login

1. Login as tenant
2. Go to /browse (or /wishlist)
3. Click a heart button
4. Check Network tab in DevTools
5. Should see POST /api/wishlist request
6. Switch to another page and back
7. Heart should still be pink (synced from backend)
8. Go to /wishlist page
9. Saved listing should appear in wishlist page
