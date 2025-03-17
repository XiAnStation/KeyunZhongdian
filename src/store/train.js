import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useTrainStore = defineStore('train', () => {
  const trainList = ref([])

  const addTrains = (trains) => {
    trainList.value = trains.map((train, index) => ({
      ...train,
      id: index + 1
    }))
  }

  const getTrainByNo = (trainNo) => {
    return trainList.value.find(train => train.trainNo === trainNo)
  }

  return {
    trainList,
    addTrains,
    getTrainByNo
  }
}) 