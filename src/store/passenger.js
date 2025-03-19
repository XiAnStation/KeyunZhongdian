import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const usePassengerStore = defineStore('passenger', () => {
  // 从localStorage获取初始数据
  const passengerList = ref(JSON.parse(localStorage.getItem('passengerList') || '[]'))

  // 监听数据变化，自动保存到localStorage
  watch(passengerList, (newList) => {
    localStorage.setItem('passengerList', JSON.stringify(newList))
  }, { deep: true })

  // 检查牌号是否重复
  const isCardNoDuplicate = (cardNo, excludeId = null) => {
    return passengerList.value.some(passenger => 
      passenger.cardNo === cardNo && 
      (excludeId === null || passenger.id !== excludeId)
    )
  }

  const addPassenger = (passenger) => {
    const newId = passengerList.value.length > 0 
      ? Math.max(...passengerList.value.map(p => p.id)) + 1 
      : 1
    
    passengerList.value.push({
      ...passenger,
      id: newId,
      date: passenger.date
    })
  }

  const updatePassenger = (id, passenger) => {
    const index = passengerList.value.findIndex(p => p.id === id)
    if (index !== -1) {
      passengerList.value[index] = {
        ...passenger,
        id,
        date: passenger.date
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
    getPassengersByTrainNo,
    isCardNoDuplicate
  }
}) 