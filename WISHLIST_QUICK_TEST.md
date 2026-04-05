# Wishlist Feature - Quick Test Guide

## 🚀 Quick Start Testing

### Test 1: Basic Heart Click (Without Login)
1. Open app in **incognito/private window** (no login)
2. Navigate to /browse
3. **Open DevTools** (F12) → Console tab
4. Click any heart icon
5. **Verify:**
   - Console shows `[wishlist] button clicked for listing: <id>`
   - Console shows `[wishlist] toggle { ... wasSaved: false, nextSaved: true ... }`
   - Heart color changes from outline to **PINK**
   - Button has class `is-saved`

### Test 2: Persistence (Without Login)
1. Continue from Test 1
2. Run in console: `localStorage.getItem('wishlist_listing_ids')`
3. **Verify:** Returns JSON array with the listing ID
4. **Refresh the page** (F5)
5. **Verify:**
   - Heart is still PINK
   - console shows `[wishlist] init: loaded from localStorage [<id>]`
   - Same ID appears in localStorage

### Test 3: Multiple Listings
1. Click hearts on **3 different listings**
2. Run in console: `JSON.parse(localStorage.getItem('wishlist_listing_ids')).length`
3. **Verify:** Shows 3
4. **Refresh page**
5. **Verify:** All 3 hearts are PINK

### Test 4: Toggle Off
1. Click a PINK heart to remove from wishlist
2. **Verify:**
   - Color changes back to outline
   - `is-saved` class removed
   - Console shows `nextSaved: false`
3. Run in console: `JSON.parse(localStorage.getItem('wishlist_listing_ids')).length`
4. **Verify:** Count reduced by 1

### Test 5: Pagination/Dynamic Load
1. Start on /browse with some hearts wishlisted
2. Go to page 2 (pagination)
3. **Verify:**
   - Any previously wishlisted cards show PINK hearts
   - New cards show with correct state
   - Console shows `[wishlist] applyState: found X buttons, savedIds: [...]`

### Test 6: Filter/Search
1. Apply a filter or search
2. Cards reload
3. **Verify:**
   - Hearts show correct state (some PINK, some outline)
   - No console errors
   - State is consistent

### Test 7: Login & Backend Sync (Optional)
1. Wipe localStorage: `localStorage.clear()`
2. Open DevTools → Network tab
3. Login as tenant
4. Go to /browse
5. Click a heart
6. **Verify in Network tab:**
   - `POST /api/wishlist` request appears
   - Status 200 (success)
   - Response: `{ "saved": true, "listingId": "..." }`
7. Go to /wishlist page
8. **Verify:** Listing appears in wishlist

### Test 8: Mobile Responsive
1. Resize browser to mobile (375px wide)
2. Go to /browse
3. Click heart buttons
4. **Verify:**
   - Heart button visible and clickable
   - Size appropriate for mobile
   - No layout shift when heart changes color

## 🐛 Troubleshooting Quick Checks

### "Console shows no [wishlist] logs"
```
Fix: Press F12 to open DevTools
     Go to Console tab
     Try again and watch for logs
```

### "Heart doesn't change color"
```
Check: In Console, run:
   document.querySelector('[data-wishlist-id]')
   
Should return: <button class="wishlist-heart...">✓</button>

If null: Button isn't being rendered
If exists: CSS might not be loading
```

### "Colors changed but don't persist"
```
Check: In Console, run:
   localStorage.getItem('wishlist_listing_ids')
   
Should return: ["id1","id2"] (not null)

If null: localStorage not being written
         Check browser's privacy/storage settings
```

### "Console shows errors"
```
Look for errors starting with:
  - Uncaught TypeError
  - Uncaught ReferenceError
  - Failed to fetch /api/wishlist
  
Screenshot the error and check:
  1. Function names are spelled correctly
  2. HTML structure has necessary attributes
  3. API is running and accessible
```

## ✅ Expected Behavior Summary

| Action | Expected Result |
|--------|-----------------|
| Click heart outline | Color → PINK, class → is-saved |
| Click PINK heart | Color → outline, class removed |
| Refresh page | Hearts stay same color |
| Click heart 3 times | Still works, no delays |
| Right-click → Inspect | See `data-wishlist-id="<id>"` |
| Check localStorage | Shows `["id1","id2",...]` |
| Check Network (logged in) | POST/DELETE requests appear |
| Go to /wishlist page | Wishlisted items show |
| Multiple cards on page | Each heart independent |

## 📊 Performance Checkpoints

| Test | Expected Time |
|------|---|
| Heart click → Color change | <50ms |
| Page load → State applied | <200ms |
| Switch page → New state | <500ms |
| LocalStorage read/write | <10ms |

## 🎯 Before/After Comparison

### BEFORE (Not Working)
```
❌ Heart click did nothing
❌ No console logs
❌ Color never changed
❌ Refresh lost state
❌ Multiple clicks didn't work
```

### AFTER (Fixed)
```
✓ Heart click toggles instantly
✓ Console shows [wishlist] logs
✓ Color changes pink/outline
✓ Refresh persists state
✓ Multiple clicks work smoothly
✓ No JavaScript errors
```

## 🔍 Console Commands for Testing

```javascript
// Check current wishlist state
savedListingIds
// Output: Set(3) { 'id1', 'id2', 'id3' }

// Check localStorage
localStorage.getItem('wishlist_listing_ids')
// Output: ["id1","id2","id3"]

// Check how many buttons exist
document.querySelectorAll('[data-wishlist-id]').length
// Output: 12

// Check how many are saved
document.querySelectorAll('[data-wishlist-id].is-saved').length
// Output: 3

// Manually toggle a listing
toggleWishlist('some-id-here', { source: 'test' })

// Manually reapply styles
applyWishlistStateToButtons()

// Clear wishlist
localStorage.removeItem('wishlist_listing_ids')
savedListingIds = new Set()
```

## 📱 Mobile Testing

Test on actual phone or use DevTools device emulation:

1. Open DevTools (F12)
2. Click device icon (top-left)
3. Select "iPhone 12 Pro" or "Pixel 4"
4. Reload page
5. Test heart clicks
6. Verify responsive layout

## 🎬 Video Tutorial Steps (if recording)

1. ✓ Show initial page with hearts
2. ✓ Click one heart, show color change
3. ✓ Click another, show separate state
4. ✓ Open DevTools Console
5. ✓ Show localStorage contains IDs
6. ✓ Refresh page
7. ✓ Show hearts still colored
8. ✓ Navigate to different page
9. ✓ Come back, state persists

---

**Expected Duration for Full Test:** 5-10 minutes

**Pass Criteria:** All tests pass with no console errors
