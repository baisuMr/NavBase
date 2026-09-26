import { computed } from 'vue'
import { useCategoriesStore } from '../stores/categories'

export function useCategories() {
  const store = useCategoriesStore()

  const categories = computed(() => store.categories)
  const error = computed(() => store.error)

  const fetchCategories = () => store.fetchCategories()
  const createCategory = (data, refresh) => store.createCategory(data, refresh)
  const updateCategory = (id, data) => store.updateCategory(id, data)
  const deleteCategory = (id) => store.deleteCategory(id)
  const reorderCategories = (ids) => store.reorderCategories(ids)

  return {
    categories,
    error,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    reorderCategories
  }
}
