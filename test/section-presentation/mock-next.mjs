import { createElement } from "react";

const navigate = (href) => window.dispatchEvent(new CustomEvent("test:navigate", { detail: href }));
const router = { push: navigate, replace: navigate, refresh() { window.dispatchEvent(new Event("test:refresh")); } };
export function useRouter() { return router; }
export async function saveSessionReflectionAction() { return { status: "idle" }; }
export default function Link({ href, children, ...props }) {
  delete props.prefetch;
  return createElement("a", { ...props, href, onClick(event) { event.preventDefault(); navigate(href); } }, children);
}
