export type Artifact = {
  kind: "html" | "react";
  code: string;
  language: string;
};

const FENCE = /```([a-zA-Z0-9+-]*)\n([\s\S]*?)```/g;

/**
 * Extract the primary previewable artifact from an assistant message.
 * - Single ```html block => html artifact
 * - jsx/tsx block => react artifact
 * - html + css + js blocks => combined html artifact
 */
export function extractArtifact(text: string): Artifact | null {
  const blocks: { lang: string; code: string }[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(FENCE);
  while ((m = re.exec(text))) {
    blocks.push({ lang: (m[1] || "").toLowerCase(), code: m[2] });
  }
  if (blocks.length === 0) return null;

  // React
  const react = blocks.find((b) => ["jsx", "tsx", "react"].includes(b.lang));
  if (react) return { kind: "react", code: react.code, language: react.lang };

  // Complete HTML doc
  const fullHtml = blocks.find(
    (b) => b.lang === "html" && /<html[\s>]/i.test(b.code),
  );
  if (fullHtml) return { kind: "html", code: fullHtml.code, language: "html" };

  const html = blocks.find((b) => b.lang === "html");
  const css = blocks.find((b) => b.lang === "css");
  const js = blocks.find((b) => ["js", "javascript"].includes(b.lang));

  if (html || css || js) {
    const body = html?.code ?? "";
    const doc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css?.code ?? ""}</style></head><body>${body}<script>${js?.code ?? ""}<\/script></body></html>`;
    return { kind: "html", code: doc, language: "html" };
  }

  return null;
}

export function buildReactPreview(code: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"><\/script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
<script src="https://cdn.tailwindcss.com"><\/script>
<style>html,body,#root{height:100%;margin:0;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:#0b0b13;color:#f5f5fa}</style>
</head><body><div id="root"></div>
<script type="text/babel" data-presets="react,typescript">
${code}
;(function(){
  try {
    const root = ReactDOM.createRoot(document.getElementById('root'));
    const Comp = (typeof App !== 'undefined') ? App : (typeof Main !== 'undefined') ? Main : (typeof Component !== 'undefined') ? Component : null;
    if (Comp) root.render(React.createElement(Comp));
  } catch (e) {
    document.body.innerHTML = '<pre style="padding:16px;color:#f88">'+String(e)+'</pre>';
  }
})();
<\/script>
</body></html>`;
}
