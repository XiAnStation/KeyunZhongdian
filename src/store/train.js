import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useTrainStore = defineStore('train', () => {
  // 从localStorage获取初始数据
  const trainList = ref(JSON.parse(localStorage.getItem('trainList') || '[]'))

  const addTrains = (trains) => {
    trainList.value = trains.map((train, index) => ({
      ...train,
      id: index + 1
    }))
    // 保存到localStorage
    localStorage.setItem('trainList', JSON.stringify(trainList.value))
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