import { lazy, ComponentType } from 'react';

export function safeLazy<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return lazy(() =>
    factory().then((module) => {
      if (typeof module.default !== 'function' && typeof module.default !== 'object') {
        console.error('safeLazy: Loaded module default is not a valid React component.', module);
        return { default: (() => null) as unknown as T };
      }
      return module;
    }).catch((err) => {
      console.error('safeLazy: Error loading component', err);
      return { default: (() => null) as unknown as T };
    })
  );
}
