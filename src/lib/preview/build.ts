import { parseProjectFiles, projectKind, runnableFiles, type PFile } from "./files";

export type { PFile };
export { parseProjectFiles, projectKind, runnableFiles };

const REACT_UMD = "https://esm.sh/react@18.3.1?bundle&dev";

function pickEntry(files: PFile[]): string | null {
  const code = files.filter((f) => ["jsx", "tsx", "js", "ts"].includes(f.lang));
  if (!code.length) return null;
  const preferred = [
    "src/main.jsx",
    "src/main.tsx",
    "src/index.jsx",
    "src/index.tsx",
    "src/App.jsx",
    "src/App.tsx",
    "main.jsx",
    "index.jsx",
    "App.jsx",
    "App.tsx",
  ];
  for (const p of preferred) {
    const f = code.find((x) => x.path === p);
    if (f) return f.path;
  }
  const app = code.find((f) => /export\s+default/.test(f.code));
  return (app ?? code[0]).path;
}

function esc(s: string) {
  return s.replace(/<\/script/gi, "<\\/script");
}

/**
 * Preview iframes have an opaque origin, so any third-party API call from a
 * generated app is blocked by CORS. `ocFetch` routes through our proxy route so
 * agents can build apps with real API connections.
 */
function proxyShim(): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `(function(){
  var BASE = ${JSON.stringify(`${origin}/api/public/proxy?url=`)};
  function viaProxy(url){
    try {
      var u = String(url);
      if (!/^https?:\\/\\//i.test(u)) return u;
      return BASE + encodeURIComponent(u);
    } catch (e) { return url; }
  }
  window.ocProxyUrl = viaProxy;
  window.ocFetch = function(url, init){ return fetch(viaProxy(url), init); };
})();`;
}

const RUNTIME = String.raw`
(function () {
  var FILES = window.__FILES__;
  var ENTRY = window.__ENTRY__;
  var post = function (type, payload) {
    try { parent.postMessage(Object.assign({ source: "oc-preview", type: type }, payload || {}), "*"); } catch (e) {}
  };

  ["log", "warn", "error", "info"].forEach(function (level) {
    var orig = console[level].bind(console);
    console[level] = function () {
      var args = Array.prototype.slice.call(arguments).map(function (a) {
        try { return typeof a === "string" ? a : JSON.stringify(a); } catch (e) { return String(a); }
      });
      post("console", { level: level, text: args.join(" ") });
      orig.apply(null, arguments);
    };
  });

  function showError(msg) {
    post("error", { message: String(msg) });
    var el = document.getElementById("oc-error");
    if (!el) {
      el = document.createElement("div");
      el.id = "oc-error";
      el.style.cssText =
        "position:fixed;inset:0;z-index:99999;overflow:auto;padding:20px;background:#140f0c;color:#ffb4a2;font:13px/1.6 ui-monospace,SFMono-Regular,monospace;white-space:pre-wrap";
      document.body.appendChild(el);
    }
    el.textContent = "Preview error\n\n" + msg;
  }

  window.addEventListener("error", function (e) { showError(e.message + "\n" + (e.filename || "")); });
  window.addEventListener("unhandledrejection", function (e) {
    showError("Unhandled rejection: " + ((e.reason && e.reason.message) || e.reason));
  });

  function dirname(p) { var i = p.lastIndexOf("/"); return i === -1 ? "" : p.slice(0, i); }

  function resolve(spec, from) {
    if (spec.charAt(0) !== ".") return null;
    var parts = (dirname(from) ? dirname(from).split("/") : []);
    spec.split("/").forEach(function (part) {
      if (part === "." || part === "") return;
      if (part === "..") parts.pop();
      else parts.push(part);
    });
    var p = parts.join("/");
    var cands = [p, p + ".jsx", p + ".tsx", p + ".ts", p + ".js", p + ".css",
                 p + "/index.jsx", p + "/index.tsx", p + "/index.ts", p + "/index.js"];
    for (var i = 0; i < cands.length; i++) if (FILES[cands[i]] != null) return cands[i];
    return null;
  }

  var externals = {};
  var cache = {};

  function interop(ns) {
    if (!ns) return ns;
    var out = ns;
    if (ns.__esModule || ns.default !== undefined) {
      out = Object.assign(function () {}, ns);
      out = ns;
    }
    return out;
  }

  function requireModule(spec, from) {
    if (spec === "react") return window.React;
    if (spec === "react-dom") return window.ReactDOM;
    if (spec === "react-dom/client") return { createRoot: window.ReactDOM.createRoot, __esModule: true, default: window.ReactDOM };
    if (spec.charAt(0) !== ".") {
      var mod = externals[spec];
      if (!mod) throw new Error('Module "' + spec + '" could not be loaded from the CDN.');
      return interop(mod);
    }
    var path = resolve(spec, from);
    if (!path) throw new Error('Cannot find file "' + spec + '" imported from "' + from + '"');
    if (cache[path]) return cache[path].exports;
    var file = FILES[path];
    if (/\.css$/.test(path)) { cache[path] = { exports: {} }; return {}; }
    var module = { exports: {} };
    cache[path] = module;
    var transformed;
    try {
      transformed = Babel.transform(file, {
        filename: path,
        presets: [["react", { runtime: "classic" }], "typescript"],
        plugins: ["transform-modules-commonjs"],
        sourceType: "module",
      }).code;
    } catch (e) {
      throw new Error("Compile error in " + path + "\n\n" + e.message);
    }
    var fn = new Function("exports", "require", "module", "React", "__filename", transformed);
    fn(module.exports, function (s) { return requireModule(s, path); }, module, window.React, path);
    return module.exports;
  }

  function bareSpecifiers() {
    var found = {};
    Object.keys(FILES).forEach(function (path) {
      if (/\.(css|html|json)$/.test(path)) return;
      var src = FILES[path];
      var re = /(?:import\s[^'"]*from\s*|import\s*|require\(\s*)['"]([^'"]+)['"]/g;
      var m;
      while ((m = re.exec(src))) {
        var s = m[1];
        if (s.charAt(0) === "." || s === "react" || s === "react-dom" || s === "react-dom/client") continue;
        if (/\.css$/.test(s)) continue;
        found[s] = true;
      }
    });
    return Object.keys(found);
  }

  async function boot() {
    try {
      window.React = await import("react");
      window.ReactDOM = await import("react-dom/client");
    } catch (e) {
      showError("Could not load React from the CDN: " + e.message);
      return;
    }
    var specs = bareSpecifiers();
    for (var i = 0; i < specs.length; i++) {
      var s = specs[i];
      try {
        externals[s] = await import(/* @vite-ignore */ "https://esm.sh/" + s + "?external=react,react-dom");
      } catch (e) {
        console.warn("Could not load " + s + " from CDN: " + e.message);
      }
    }
    var root = document.getElementById("root");
    try {
      var exports = requireModule("./" + ENTRY, "__entry__");
      var Comp = exports.default || exports.App || exports.Main || exports.Page;
      if (typeof Comp === "function") {
        window.ReactDOM.createRoot(root).render(window.React.createElement(window.React.StrictMode, null, window.React.createElement(Comp)));
      } else if (!root.childNodes.length) {
        throw new Error(
          "No React component was exported from " + ENTRY + ". Export a component with: export default function App() {}"
        );
      }
      post("ready", { nodes: root.innerHTML.length });
    } catch (e) {
      showError((e && e.stack) || String(e));
    }
  }

  boot();
})();
`;

/** Status/console bridge for plain HTML previews (React previews use RUNTIME). */
const HTML_BRIDGE = `(function(){
  function post(type, payload){
    try { parent.postMessage(Object.assign({ source: "oc-preview", type: type }, payload || {}), "*"); } catch (e) {}
  }
  ["log","warn","error"].forEach(function(level){
    var orig = console[level];
    console[level] = function(){
      try { post("console", { level: level, text: Array.prototype.map.call(arguments, String).join(" ") }); } catch (e) {}
      return orig.apply(console, arguments);
    };
  });
  window.addEventListener("error", function(e){ post("error", { message: (e && e.message) || "Script error" }); });
  window.addEventListener("unhandledrejection", function(e){ post("error", { message: String((e && e.reason) || "Unhandled rejection") }); });
  function ready(){ post("ready", { nodes: document.body ? document.body.innerHTML.length : 0 }); }
  if (document.readyState === "complete" || document.readyState === "interactive") setTimeout(ready, 0);
  else document.addEventListener("DOMContentLoaded", ready);
})();`;

/** Build a fully self-contained preview document for a virtual project. */

export function buildPreviewDoc(files: PFile[]): string {
  const runnable = runnableFiles(files);
  const kind = projectKind(files);

  if (kind === "html") {
    const html = runnable.find((f) => f.lang === "html");
    const css = runnable.filter((f) => f.lang === "css").map((f) => f.code).join("\n");
    const js = runnable.filter((f) => f.lang === "js").map((f) => f.code).join("\n;\n");
    const bridge = `<script>${esc(proxyShim())}<\/script><script>${esc(HTML_BRIDGE)}<\/script>`;
    if (html && /<html[\s>]/i.test(html.code)) {
      let doc = html.code;
      if (css) doc = doc.replace(/<\/head>/i, `<style>${css}</style></head>`);
      if (js) doc = doc.replace(/<\/body>/i, `<script>${esc(js)}<\/script></body>`);
      doc = /<\/body>/i.test(doc) ? doc.replace(/<\/body>/i, `${bridge}</body>`) : doc + bridge;
      return doc;
    }
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://cdn.tailwindcss.com"><\/script>
<style>body{margin:0;font-family:ui-sans-serif,system-ui,sans-serif}</style>
<style>${css}</style></head>
<body>${html?.code ?? ""}<script>${esc(js)}<\/script>${bridge}</body></html>`;
  }



  const entry = pickEntry(runnable);
  if (!entry) return "";
  const map: Record<string, string> = {};
  for (const f of runnable) map[f.path] = f.code;
  const css = runnable.filter((f) => f.lang === "css").map((f) => f.code).join("\n");

  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<script type="importmap">{"imports":{"react":"https://esm.sh/react@18.3.1","react/jsx-runtime":"https://esm.sh/react@18.3.1/jsx-runtime","react-dom":"https://esm.sh/react-dom@18.3.1?external=react","react-dom/client":"https://esm.sh/react-dom@18.3.1/client?external=react"}}<\/script>
<script src="https://unpkg.com/@babel/standalone@7.25.6/babel.min.js"><\/script>
<script src="https://cdn.tailwindcss.com"><\/script>
<style>
  html,body,#root{min-height:100%;margin:0}
  body{font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:#ffffff;color:#0f172a}
</style>
<style>${css}</style>
</head><body><div id="root"></div>
<script>
window.__FILES__ = ${esc(JSON.stringify(map))};
window.__ENTRY__ = ${JSON.stringify(entry)};
<\/script>
<script>${esc(proxyShim())}<\/script>
<script>${esc(RUNTIME)}<\/script>
</body></html>`;
}

/** Convenience: parse an assistant message and build its preview document. */
export function buildPreviewFromText(text: string): {
  files: PFile[];
  kind: "react" | "html" | null;
  doc: string;
} {
  const files = parseProjectFiles(text);
  const kind = projectKind(files);
  return { files, kind, doc: kind ? buildPreviewDoc(files) : "" };
}

export const REACT_CDN = REACT_UMD;
