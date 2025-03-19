import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue')
  },
  {
    path: '/train',
    name: 'Train',
    component: () => import('../views/Train.vue')
  },
  {
    path: '/passenger',
    name: 'Passenger',
    component: () => import('../views/Passenger.vue')
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router 