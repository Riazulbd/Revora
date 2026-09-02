import { useEffect, useState } from 'react';

import { imageUrl } from '@/services/storage';

/** A local file or an already-resolved URL renders directly. */
function isDirect(path: string | null): path is string {
  return path !== null && (path.startsWith('file://') || path.startsWith('http'));
}

/**
 * Resolves a stored image path to a renderable URL.
 *
 * The resolved URL is stored alongside the path it belongs to, so a path change
 * can never briefly show the previous image, and null is returned while it
 * resolves or if it fails — a missing photo shows the placeholder rather than a
 * broken image.
 */
export function useImageUrl(path: string | null): string | null {
  const [resolved, setResolved] = useState<{ path: string; url: string | null } | null>(null);

  useEffect(() => {
    if (path === null || isDirect(path)) return undefined;
    let cancelled = false;
    void imageUrl(path).then((url) => {
      if (!cancelled) setResolved({ path, url });
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (isDirect(path)) return path;
  return resolved !== null && resolved.path === path ? resolved.url : null;
}
