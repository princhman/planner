export function truncateTooltip(node: HTMLElement) {
  function update() {
    if (node.scrollWidth > node.clientWidth) {
      node.setAttribute("title", node.textContent);
    } else {
      node.removeAttribute("title");
    }
  }

  update();

  const observer = new ResizeObserver(update);
  observer.observe(node);

  return {
    destroy: () => observer.disconnect(),
  };
}
