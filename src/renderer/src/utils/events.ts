export const DATA_UPDATED_EVENT = 'pos-data-updated'

export const notifyDataChanged = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DATA_UPDATED_EVENT))
  }
}
