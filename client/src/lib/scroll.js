/**
 * Keeps `element` visible inside its own scroll container *without* moving the page
 * (unlike `Element.scrollIntoView`, which scrolls every scrollable ancestor).
 *
 * The scroller must be the element's `offsetParent`, i.e. carry `position: relative`.
 */
export function revealInside(element, { block = 'nearest' } = {}) {
  const container = element?.offsetParent
  if (!container || container === document.body) return

  const top = element.offsetTop
  const bottom = top + element.offsetHeight
  const viewTop = container.scrollTop
  const viewBottom = viewTop + container.clientHeight

  let target = null
  if (block === 'end') target = bottom - container.clientHeight
  else if (top < viewTop) target = top
  else if (bottom > viewBottom) target = bottom - container.clientHeight

  if (target !== null) container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
}
