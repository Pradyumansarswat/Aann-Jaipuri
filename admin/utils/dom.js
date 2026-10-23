export function createElement(tag, props = {}, ...children) {
  const element = document.createElement(tag);

  for (const [key, value] of Object.entries(props || {})) {
    if (value === false || value == null) continue;
    if (key === 'class') element.className = value;
    else if (key.startsWith('on')) element.addEventListener(key.slice(2), value);
    else if (['value', 'checked', 'disabled', 'selected', 'hidden', 'required'].includes(key)) element[key] = value;
    else element.setAttribute(key, value === true ? '' : value);
  }

  const append = (child) => {
    if (Array.isArray(child)) child.forEach(append);
    else if (child != null && child !== false) {
      element.append(child.nodeType ? child : document.createTextNode(String(child)));
    }
  };

  children.forEach(append);
  return element;
}
