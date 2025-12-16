import { splitProps } from 'solid-js';

const prefetched = new Set();

function prefetch(href) {
  if (prefetched.has(href) || !href.startsWith('/')) return;
  prefetched.add(href);

  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = href;
  document.head.appendChild(link);
}

export default function PrefetchLink(props) {
  const [local, others] = splitProps(props, ['href', 'children', 'class']);

  const handleMouseEnter = () => {
    if (local.href) {
      prefetch(local.href);
    }
  };

  return (
    <a href={local.href} class={local.class} onMouseEnter={handleMouseEnter} {...others}>
      {local.children}
    </a>
  );
}
