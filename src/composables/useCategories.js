import { computed } from 'vue'
import { useCategoriesStore } from '../stores/categories'

export function useCategories() {
  const store = useCategoriesStore()

  const categories = computed(() => store.categories)
  const loading = computed(() => store.loading)
  const error = computed(() => store.error)

  const fetchCategories = () => store.fetchCategories()
  const createCategory = (data) => store.createCategory(data)
  const updateCategory = (id, data) => store.updateCategory(id, data)
  const deleteCategory = (id) => store.deleteCategory(id)

  return {
    categories,
    loading,
    error,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory
  }
}
