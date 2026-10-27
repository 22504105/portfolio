// Shared by the root layout (a server component) and the theme toggle (a client component). It must
// not be marked "use client": a constant imported from a client module reaches the layout as a
// client reference, so the head script would wait for a JS chunk, and React 19 then sometimes
// lost its place while hydrating <head> and redrew the whole page (error #418).

export const THEME_KEY = "flowly-theme";

/**
 * Runs in the document head before anything is drawn: reads the stored choice
 * and sets data-theme. Kept as a string because it must not wait for React.
 */
export const THEME_SCRIPT = `(function(){try{var c=localStorage.getItem("${THEME_KEY}");var d=c==="dark"||(c!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){document.documentElement.dataset.theme="light"}})()`;
