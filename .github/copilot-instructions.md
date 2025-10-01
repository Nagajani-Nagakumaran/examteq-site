# Copilot Instructions for ExamTeq Site

## Project Overview
This is a static website for ExamTeq, consisting of multiple HTML pages, CSS for styling, and JavaScript for interactive features. There is no build system, backend, or package management; all files are directly served as-is.

## Key Files and Structure
- Main HTML pages: `index.html`, `book.html`, `contact.html`, `login.html`, `members.html`, `mock-exams.html`, `resources.html`, `services.html`, `Signup.html`, `testimonials.html`, `thankyou.html`, `topic-tests.html`, `timestable.html`
- Stylesheets: `styles.css`, `timestable.css`
- JavaScript: `timestable.js` (used for interactive times table features)
- Assets: `logo.png`

## Patterns and Conventions
- **Navigation:** Each HTML file is a standalone page. Navigation is handled via `<a>` tags linking between these files.
- **Styling:** All styles are in CSS files. No CSS frameworks are used; custom styles only.
- **JavaScript:** Only `timestable.js` is present. It is loaded in `timestable.html` for dynamic times table generation. Keep JS simple and compatible with all browsers.
- **No Frameworks:** No React, Angular, Vue, or other JS frameworks. No Node.js, no npm, no build tools.
- **No External Dependencies:** All code is local. If you add new assets, place them in the root directory and reference them directly.

## Developer Workflow
- **Edit HTML/CSS/JS directly.** No build or test commands are required.
- **Preview changes:** Open HTML files in a browser to view updates. No local server is required.
- **Debugging:** Use browser DevTools for inspecting and debugging.

## Integration Points
- **Times Table Feature:** All interactive logic is in `timestable.js`, which manipulates the DOM in `timestable.html`.
- **Forms:** Some pages (e.g., `Signup.html`, `contact.html`) may have forms. No backend integration; form actions are either local or placeholders.

## Examples
- To add a new page, create an HTML file and link it from `index.html`.
- To update site-wide styles, edit `styles.css`.
- To add new JS features, create a new `.js` file and link it in the relevant HTML page.

## Recommendations for AI Agents
- Maintain simplicity and compatibility; avoid introducing frameworks or build steps.
- Follow the file naming and placement conventions.
- Reference assets and scripts using relative paths.
- Keep code modular: separate HTML, CSS, and JS as in existing files.

---
If any conventions or workflows are unclear, please ask for clarification or examples from the user.