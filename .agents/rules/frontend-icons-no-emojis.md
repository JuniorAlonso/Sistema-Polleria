# Frontend Iconography Rule (No Emojis)

## Mandatory Icon Rules for All Frontend Code:

1. **NO RAW EMOJIS IN UI**:
   - Never use unicode emojis (e.g. 🔥, 🍗, 🛒, 🛵, 👨‍🍳, 🍽️, 🛍️, 💜, 💙, 💳, 💵, ⏱️, 📞, 📍, 🔴, 🟢, ⚠️, ✨, etc.) in HTML templates, JSX/TSX, CSS content, labels, titles, badges, or buttons.
   - Emojis make web applications look amateur, toy-like, and inconsistent across different operating systems (Windows, iOS, Android, Linux render emojis differently).

2. **ALWAYS USE OFFICIAL VECTOR ICON LIBRARIES**:
   - Use the standard vector icon library for the framework being used:
     - **Angular**: `@lucide/angular` or `@ng-icons/core` (with Lucide, Heroicons, or Phosphor).
     - **React**: `lucide-react` or `@phosphor-icons/react`.
     - **Vue**: `lucide-vue-next`.
   - Maintain consistent icon sizing (`w-4 h-4`, `w-5 h-5`) and stroke width (`strokeWidth="2"` or `1.5`).
   - Use semantic SVG icons with proper coloring matching the design system.
