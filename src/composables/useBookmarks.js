import { computed } from 'vue'
import { useBookmarksStore } from '../stores/bookmarks'

export function useBookmarks() {
  const store = useBookmarksStore()

  const bookmarks = computed(() => store.bookmarks)
  const loading = computed(() => store.loading)
  const error = computed(() => store.error)

  const fetchBookmarks = () => store.fetchBookmarks()
  const createBookmark = (data) => store.createBookmark(data)
  const updateBookmark = (id, data) => store.updateBookmark(id, data)
  const togglePin = (bookmark) => store.togglePin(bookmark)
  const deleteBookmark = (id) => store.deleteBookmark(id)
  const importBookmarks = (items) => store.importBookmarks(items)

  return {
    bookmarks,
    loading,
    error,
    fetchBookmarks,
    createBookmark,
    updateBookmark,
    togglePin,
    deleteBookmark,
    importBookmarks
  }
}
