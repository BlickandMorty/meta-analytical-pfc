# UI Fixes Design — 2026-02-13

## Fix 1: Landing/Chat Page Overlap
- Add `mode: 'landing' | 'conversation'` prop to Chat component
- Landing page (`/`) passes `mode="landing"`, always shows greeting+search
- Conversation page (`/chat/[id]`) passes `mode="conversation"`, shows messages with loading state
- Clear messages on landing mount, add loading skeleton on conversation mount

## Fix 2: Book Icon Flat Style in Light Mode
- Extend flat BookOpenIcon from `isSunny` to `isSunny || isDefaultLight` in notes page

## Fix 3: Dark Mode Search Bar Outline
- Add `1px solid rgba(255,255,255,0.06)` border for dark mode search bar

## Fix 4: Lightbulb Theme Cycle
- Change from `sunny <-> sunset` to `sunny -> sunset -> dark -> sunny`

## Fix 5: Overlay/Stacking Audit
- Verify AnimatePresence mode="wait", no stale UI from route changes

## Fix 6: Flatten Analytics Nav
- Replace AnalyticsNavBubble with standard NavBubble
- Move sub-tabs into analytics page as local PillTabs
- Remove custom event system
