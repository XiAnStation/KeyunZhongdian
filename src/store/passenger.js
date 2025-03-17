import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePassengerStore = defineStore('passenger', () => {
  const passengerList = ref([])

  const addPassenger = (passenger) => {
    const newId = passengerList.value.length > 0 
      ? Math.max(...passengerList.value.map(p => p.id)) + 1 
      : 1
    
    passengerList.value.push({
      ...passenger,
      id: newId,
      date: passenger.date.toISOString().split('T')[0]
    })
  }

  const updatePassenger = (id, passenger) => {
    const index = passengerList.value.findIndex(p => p.id === id)
    if (index !== -1) {
      passengerList.value[index] = {
        ...passenger,
        id,
        date: passenger.date.toISOString().split('T')[0]
      }
    }
  }

  const deletePassenger = (id) => {
    const index = passengerList.value.findIndex(p => p.id === id)
    if (index !== -1) {
      passengerList.value.splice(index, 1)
    }
  }

  const getPassengersByTrainNo = (trainNo) => {
    return passengerList.value.filter(p => p.trainNo === trainNo)
  }

  return {
    passengerList,
    addPassenger,
    updatePassenger,
    deletePassenger,
    getPassengersByTrainNo
  }
}) 