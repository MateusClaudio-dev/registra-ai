import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
const g = globalThis as any;
g.window = dom.window; g.document = dom.window.document; Object.defineProperty(g, "navigator", { value: dom.window.navigator, configurable: true });
for (const k of ["HTMLElement","HTMLInputElement","Node","Event","MouseEvent","KeyboardEvent","getComputedStyle","localStorage","MutationObserver","CustomEvent","DocumentFragment","Element","SVGElement"]) { try { g[k] = (dom.window as any)[k]; } catch {} }
g.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.scrollTo = () => {};
(dom.window as any).confirm = () => true;
g.requestAnimationFrame = (cb: any) => setTimeout(cb, 0);
export { dom };
