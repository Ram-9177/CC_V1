import { memo, FC } from 'react'

/**
 * Higher-order component for memoizing pages
 * Prevents unnecessary re-renders when props don't change
 */
export const memoizePage = <P extends object>(Component: FC<P>) => {
  return memo(Component) as FC<P>
}

/**
 * Custom comparison for memo
 * Use this for complex prop comparisons
 */
export const createCustomComparison = (propNames: string[]) => {
  return (prevProps: any, nextProps: any) => {
    // Return true if props are equal (skip re-render)
    return propNames.every((name) => prevProps[name] === nextProps[name])
  }
}

/**
 * Memoize with custom props comparison
 */
export const memoizeWithProps = <P extends object>(Component: FC<P>, propsToCompare: string[]) => {
  return memo(Component, (prevProps, nextProps) => {
    // Return true if props are EQUAL (no re-render)
    // Return false if props DIFFER (re-render)
    return propsToCompare.every((prop) => prevProps[prop] === nextProps[prop])
  }) as FC<P>
}
