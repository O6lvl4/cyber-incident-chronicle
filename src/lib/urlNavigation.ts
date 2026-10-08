import { readUrl, writeUrl, type UrlState } from './urlState.ts';

export interface UrlRoute {
  revision: number;
  initialUrl: UrlState;
  onUrlChange: (state: UrlState) => void;
}

/** Snapshot destinations before React yields; an outgoing route cannot overwrite them. */
export function createUrlNavigation() {
  let revision = 0;
  let hash = location.hash;
  const capture = (): UrlRoute => {
    const owner = revision;
    return { revision, initialUrl: readUrl(), onUrlChange: state => {
      if (owner !== revision) return;
      writeUrl(state);
      hash = location.hash;
    } };
  };
  let current = capture();
  const restore = () => {
    // A fragment traversal may emit both popstate and hashchange.
    if (location.hash === hash) return current;
    hash = location.hash;
    revision += 1;
    current = capture();
    return current;
  };
  return { initial: current, restore, navigate: (state: UrlState, owner: number) => {
    if (owner !== revision) return current;
    writeUrl(state, 'push');
    return restore();
  } };
}
