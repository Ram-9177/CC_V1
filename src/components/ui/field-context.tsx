import * as React from "react"

/** When non-null, associates the nearest `FieldLabel` with one control (`Input`, `Textarea`, `SelectTrigger`, …). */
export const FieldControlIdContext = React.createContext<string | null>(null)

export function useFieldControlId(): string | null {
  return React.useContext(FieldControlIdContext)
}
