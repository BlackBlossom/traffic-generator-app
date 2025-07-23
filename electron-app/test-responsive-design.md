// test-responsive-design.md - Test cases for responsive design

# Debug Page Responsive Design Test Cases

## Mobile (320px - 640px)
- [ ] Header stacks vertically with proper spacing
- [ ] Connection status shows emoji version (✅/🔄/❌)
- [ ] Stats grid shows 2 columns instead of 4
- [ ] Campaign selector takes full width
- [ ] Campaign names truncated in dropdown options
- [ ] Live logs header shows "Live Logs" instead of "Global Live Logs"
- [ ] Search input stacks below header on mobile
- [ ] Debug tips show condensed version
- [ ] Auto-scroll button shows "↓" instead of "Scroll to bottom ↓"

## Tablet (640px - 1024px)
- [ ] Header shows full content in row layout
- [ ] Stats grid shows 2 columns on small tablets, 4 on larger
- [ ] Campaign selector shows abbreviated content
- [ ] Live logs show full headers
- [ ] Debug tips show most content

## Desktop (1024px+)
- [ ] All content shows at full size
- [ ] Stats grid shows 4 columns
- [ ] Campaign selector shows full details
- [ ] All text content visible
- [ ] Proper spacing and padding

## Test with Different Content Lengths
- [ ] Very long campaign URLs truncate properly
- [ ] Long log messages wrap correctly
- [ ] Stats descriptions handle overflow

## Touch Targets (Mobile)
- [ ] All buttons are at least 44px tall
- [ ] Proper spacing between interactive elements
- [ ] Easy to tap campaign selector
- [ ] Search input properly sized

## Performance
- [ ] No horizontal scrolling on any screen size
- [ ] Smooth animations on all breakpoints
- [ ] Auto-scroll works on mobile devices
