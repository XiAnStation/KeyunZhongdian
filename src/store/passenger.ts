import { defineStore } from 'pinia'
import { ref, watch, computed } from 'vue'
import type { Passenger, PassengerForm, PageType } from '../types/passenger'
import { useTrainStore } from './train'
import { useHome } from '../composables/useHome'

export const usePassengerStore = defineStore('passenger', () => {
  // 从localStorage获取初始数据
  const passengerList = ref<Passenger[]>(JSON.parse(localStorage.getItem('passengerList') || '[]'))

  // 监听数据变化，自动保存到localStorage
  watch(passengerList, (newList) => {
    localStorage.setItem('passengerList', JSON.stringify(newList))
  }, { deep: true })

  // 检查牌号是否重复
  const isCardNoDuplicate = (cardNo: string, excludeId?: number): boolean => {
    return passengerList.value.some(passenger => 
      passenger.cardNo === cardNo && 
      passenger.isServed === false && // 只检查未离厅的旅客
      (excludeId === undefined || passenger.id !== excludeId)
    )
  }

  const addPassenger = (passenger: PassengerForm): Promise<number> => {
    // 检查是否存在重复旅客（相同姓名、日期和车次）
    const isDuplicate = passengerList.value.some(p => 
      p.name === passenger.name && 
      p.date === passenger.date && 
      p.trainNo === passenger.trainNo
    )

    if (isDuplicate) {
      console.log('检测到重复旅客:', passenger)
      return Promise.reject(new Error('重复旅客'))
    }

    // 获取当前最大ID
    const maxId = passengerList.value.length > 0 
      ? Math.max(...passengerList.value.map(p => p.id)) 
      : 0
    
    // 新ID为最大ID加1
    const newId = maxId + 1
    
    // 创建新旅客对象，始终设置isServed为false
    const newPassenger: Passenger = {
      ...passenger,
      id: newId,
      isServed: false // 确保新添加的旅客默认未服务
    }
    
    console.log('添加新旅客对象:', newPassenger)
    
    // 添加到列表
    passengerList.value.push(newPassenger)
    
    console.log('当前旅客列表:', passengerList.value)
    return Promise.resolve(newId)
  }

  const updatePassenger = (id: number, passenger: Partial<Passenger>): void => {
    const index = passengerList.value.findIndex(p => p.id === id)
    if (index !== -1) {
      passengerList.value[index] = {
        ...passengerList.value[index],
        ...passenger,
        id
      }
    }
  }

  const deletePassenger = (id: number): void => {
    const index = passengerList.value.findIndex(p => p.id === id)
    if (index !== -1) {
      passengerList.value.splice(index, 1)
    }
  }

  const getPassengersByTrainNo = (trainNo: string): Passenger[] => {
    return passengerList.value.filter(p => p.trainNo === trainNo)
  }

  // 获取指定页面的旅客列表
  const getPassengersByService = (service: string): Passenger[] => {
    return passengerList.value.filter(p => p.service === service)
  }
  const getAllPassengers = (): Passenger[] => {
    return passengerList.value
  }

  const clearAllPassengers = (): void => {
    passengerList.value = []
    localStorage.removeItem('passengerList')
  }

  // 根据日期获取旅客
  const getPassengersByDate = (date: string): Passenger[] => {
    const today = date
    
    // 计算明天的日期
    const tomorrow = new Date(date)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]
    
    // 获取今日和明天凌晨的旅客
    return passengerList.value.filter(p => {
      const isToday = p.date === today
      // 是否为明天凌晨的车次（只显示凌晨2点及其以前的）
      const isTomorrowEarlyMorning = p.date === tomorrowStr && 
        (() => {
          // 判断是否为凌晨2点及以前的车次（使用开检时间而非发车时间）
          const train = useTrainStore().getTrainByNo(p.trainNo)
          // 获取开检时间
          let ticketTime = ''
          if (train && train.ticketTime) {
            // 处理不同格式的开检时间
            if (typeof train.ticketTime === 'string' && train.ticketTime.includes('T')) {
              ticketTime = train.ticketTime.split('T')[1].substring(0, 5)
            } else if (typeof train.ticketTime === 'string' && /^\d{2}:\d{2}$/.test(train.ticketTime)) {
              ticketTime = train.ticketTime
            } else if (typeof train.ticketTime === 'number') {
              const totalMinutes = Math.round(train.ticketTime * 24 * 60)
              const hours = Math.floor(totalMinutes / 60) % 24
              const minutes = totalMinutes % 60
              ticketTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
            }
          }
          
          if (!ticketTime) return false
          
          const hours = ticketTime.split(':')[0]
          return Number(hours) >= 0 && Number(hours) <= 2
        })()
      
      return (isToday || isTomorrowEarlyMorning) && !p.isServed
    }).sort((a, b) => {
      // 排序逻辑...
      const trainStore = useTrainStore()
      const trainA = trainStore.getTrainByNo(a.trainNo)
      const trainB = trainStore.getTrainByNo(b.trainNo)
      
      if (!trainA || !trainB) return 0
      
      // 获取开检时间
      const getTicketTimeSimple = (train: any): string => {
        if (!train || !train.ticketTime) return '';
        
        // 如果是ISO格式的时间字符串，提取时间部分
        if (typeof train.ticketTime === 'string' && train.ticketTime.includes('T')) {
          return train.ticketTime.split('T')[1].substring(0, 5);
        }
        
        // 如果已经是正确的时间格式（HH:mm），直接返回
        if (typeof train.ticketTime === 'string' && /^\d{2}:\d{2}$/.test(train.ticketTime)) {
          return train.ticketTime;
        }
        
        // 处理数字格式的时间（Excel时间格式）
        if (typeof train.ticketTime === 'number') {
          const totalMinutes = Math.round(train.ticketTime * 24 * 60);
          const hours = Math.floor(totalMinutes / 60) % 24;
          const minutes = totalMinutes % 60;
          return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
        
        return '';
      };
      
      // 特殊处理特定车次
      const getEffectiveTime = (trainNo: string, train: any): string => {
        // 获取车次类型，判断是始发车、通过车还是终到车
        const getTrainType = (trainNo: string, train: any): string => {
          if (!train) return 'unknown';
          
          // 特殊处理K546为通过车
          if (trainNo === 'K546') {
            return '通过车';
          }
          
          // 特殊处理T231和D6852为终到车
          if (trainNo === 'T231' || trainNo === 'D6852' || trainNo === 'G657') {
            return '终到车';
          }
          
          // 获取运行区间1和运行区间2
          const route1 = train.route || '';
          const route2 = train.route2 || '';
          
          // D行的运行区间为西安，则为始发车
          if (route1 === '西安') {
            return '始发车';
          }
          
          // E行的运行区间为西安，则为终到车
          if (route2 === '西安') {
            return '终到车';
          }
          
          // 其余情况均为通过车
          return '通过车';
        };
        
        // 获取车次类型
        const trainType = getTrainType(trainNo, train);
        
        // 对于终到车，优先使用到站时间
        if (trainType === '终到车' && train && train.arrivalTime) {
          return train.arrivalTime;
        }
        
        return getTicketTimeSimple(train);
      };
      
      const timeA = getEffectiveTime(a.trainNo, trainA);
      const timeB = getEffectiveTime(b.trainNo, trainB);
      
      // 检查是否已过开检时间
      const isExpiredA = (() => {
        if (!timeA) return false;
        const nowDate = new Date();
        const [hours, minutes] = timeA.split(':').map(Number);
        
        // 考虑日期因素，今日的车次和次日的车次要区别处理
        if (a.date === today) {
          // 今日车次，正常判断是否过期
          const ticketDateTime = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), hours, minutes);
          return (ticketDateTime.getTime() - nowDate.getTime()) < 0;
        } else if (a.date === tomorrowStr) {
          // 次日车次，永远不过期，除非已经到了次日凌晨
          if (nowDate.getHours() >= 0 && nowDate.getHours() < 3 && nowDate.getDate() === tomorrow.getDate()) {
            // 如果已经是次日凌晨，正常判断过期
            const ticketDateTime = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), hours, minutes);
            return (ticketDateTime.getTime() - nowDate.getTime()) < 0;
          }
          return false; // 次日车次默认未过期
        }
        return false;
      })();
      
      const isExpiredB = (() => {
        if (!timeB) return false;
        const nowDate = new Date();
        const [hours, minutes] = timeB.split(':').map(Number);
        
        // 考虑日期因素，今日的车次和次日的车次要区别处理
        if (b.date === today) {
          // 今日车次，正常判断是否过期
          const ticketDateTime = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), hours, minutes);
          return (ticketDateTime.getTime() - nowDate.getTime()) < 0;
        } else if (b.date === tomorrowStr) {
          // 次日车次，永远不过期，除非已经到了次日凌晨
          if (nowDate.getHours() >= 0 && nowDate.getHours() < 3 && nowDate.getDate() === tomorrow.getDate()) {
            // 如果已经是次日凌晨，正常判断过期
            const ticketDateTime = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), hours, minutes);
            return (ticketDateTime.getTime() - nowDate.getTime()) < 0;
          }
          return false; // 次日车次默认未过期
        }
        return false;
      })();
      
      // 检查是否有开检时间
      const aHasTime = Boolean(timeA);
      const bHasTime = Boolean(timeB);
      
      // 最高优先级：先将已过期和未过期的分开，已过期的排在最后
      if (isExpiredA !== isExpiredB) {
        return isExpiredA ? 1 : -1;
      }
      
      // 第二优先级：按日期排序
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date)
      }
      
      // 如果都是未过期的车次，使用以下排序规则：
      if (!isExpiredA && !isExpiredB) {
        // 1. 没有开检时间和到站时间的排在最上面
        if (!aHasTime && bHasTime) return -1;
        if (aHasTime && !bHasTime) return 1;
        
        // 2. 按开检时间排序，早的排前面
        if (timeA && timeB) {
          return timeA.localeCompare(timeB);
        }
      }
      
      // 如果都是已过期的车次，按开检时间排序
      if (isExpiredA && isExpiredB) {
        if (timeA && timeB) {
          return timeA.localeCompare(timeB);
        }
      }
      
      // 最后按车次编号排序
      return a.trainNo.localeCompare(b.trainNo);
    })
  }

  return {
    passengerList,
    addPassenger,
    updatePassenger,
    deletePassenger,
    getPassengersByTrainNo,
    isCardNoDuplicate,
    getPassengersByService,
    getAllPassengers,
    clearAllPassengers,
    getPassengersByDate
  }
}) 