/**
 * Blocking head script — runs before first paint.
 * Applies language + theme from localStorage and keeps the cookie in sync
 * so the next server render matches.
 */
export function PrefsScript() {
  const code = `(function(){try{var d=document.documentElement;var l=localStorage.getItem("ainpath.lang");if(l==="en"||l==="bn"){d.lang=l;d.setAttribute("data-lang",l);document.cookie="ainpath.lang="+l+";path=/;max-age=31536000;samesite=lax";}else{d.setAttribute("data-lang",d.lang||"bn");}var t=localStorage.getItem("theme");var m=window.matchMedia("(prefers-color-scheme: dark)").matches;var dark=t==="dark"||((t==null||t==="system")&&m);d.classList.toggle("dark",!!dark);d.style.colorScheme=dark?"dark":"light";}catch(e){}})();`;

  return <script id="ainpath-prefs" dangerouslySetInnerHTML={{ __html: code }} />;
}
