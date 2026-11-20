/**
 * Blocking head script — runs before first paint.
 * Applies language + theme from localStorage and keeps the cookie in sync
 * so the next server render matches. Defaults: English + dark.
 */
export function PrefsScript() {
  const code = `(function(){try{var d=document.documentElement;var l=localStorage.getItem("ainpath.lang");if(l!=="en"&&l!=="bn"){l="en";try{localStorage.setItem("ainpath.lang",l);}catch(e){}}d.lang=l;d.setAttribute("data-lang",l);document.cookie="ainpath.lang="+l+";path=/;max-age=31536000;samesite=lax";document.title=l==="bn"?"আইনপথ":"AinPath";var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t="dark";try{localStorage.setItem("theme",t);}catch(e){}}var dark=t==="dark";d.classList.toggle("dark",dark);d.style.colorScheme=dark?"dark":"light";}catch(e){}})();`;

  return <script id="ainpath-prefs" dangerouslySetInnerHTML={{ __html: code }} />;
}
