import { addTodo, listTodos } from './todos'
import { suggest, reverse } from './places'
import {
  getPlans,
  getSubscription,
  createCheckout,
  cancelSubscription,
  resumeSubscription,
} from './payments'

export default {
  listTodos,
  addTodo,
  places: {
    suggest,
    reverse,
  },
  billing: {
    getPlans,
    getSubscription,
    createCheckout,
    cancelSubscription,
    resumeSubscription,
  },
}
