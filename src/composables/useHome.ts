import { ref, onMounted, onUnmounted } from 'vue'
import { usePassengerStore } from '../store/passenger'
import { useTrainStore } from '../store/train'
import { ElNotification, ElMessageBox, ElMessage } from 'element-plus'
import type { Passenger, PassengerForm } from '../types/passenger'
import type { Train } from '../store/train'
import { PassengerType, PageType } from '../types/passenger'
import type { UploadFile } from 'element-plus'
import * as XLSX from 'xlsx'
import { useConfigStore } from '../store/config'

// 添加样式更新函数类型
interface ForceStyleUpdateFn {
  (alertPassengers: Passenger[]): void;
}

export function useHome() {
  const passengerStore = usePassengerStore()
  const trainStore = useTrainStore()
  const configStore = useConfigStore()

  const currentTime = ref(new Date().toLocaleDateString())
  const dialogVisible = ref(false)
  const currentTrain = ref<Train | null>(null)

  // 统计数据
  const passengerCount = ref(0)
  const servedCount = ref(0)

  // 今日旅客列表
  const todayPassengers = ref<Passenger[]>([])

  // 新增旅客相关
  const addDialogVisible = ref(false)
  const formRef = ref()
  const form = ref<PassengerForm>({
    date: new Date().toISOString().split('T')[0],
    trainNo: '',
    name: '',
    service: '',
    phone: '',
    staffName: '',
    companions: 0,
    cardNo: '',
    remark: '',
    source: 'offline',
  })
  const isEdit = ref(false)
  const editId = ref<number | null>(null)

  const rules = {
    date: [{ required: true, message: '请选择日期', trigger: 'change' }],
    trainNo: [{ required: true, message: '请选择车次', trigger: 'change' }],
    name: [{ required: false, message: '请输入姓名', trigger: 'blur' }],
    service: [],
    phone: [{ required: false, message: '请输入联系电话', trigger: 'blur' }],
    staffName: [{ required: false, message: '请输入服务工作人员姓名', trigger: 'blur' }],
    cardNo: [
      { 
        required: (form: any) => !isEdit.value, // 仅在新增时必填
        message: '请输入牌号', 
        trigger: 'blur' 
      },
      {
        validator: (rule: any, value: string, callback: Function) => {
          if (value) {
            const today = new Date().toISOString().split('T')[0]
            const isDuplicate = passengerStore.passengerList.some(passenger => 
              passenger.cardNo === value && 
              passenger.date === today && 
              !passenger.isServed &&
              passenger.id !== editId.value
            )
            if (isDuplicate) {
              callback(new Error('该牌号今日已存在'))
            } else {
              callback()
            }
          } else {
            callback()
          }
        },
        trigger: 'blur'
      }
    ]
  }

  // 获取车次的开检时间
  const getTicketTime = (trainNo: string): string => {
    // 特殊处理特定车次，这些特殊情况不应返回到站时间
    // 终到车没有开检时间，应该返回空
    const { type: trainType } = getTrainTypeAndRemindTime(trainNo)
    if (trainType === '终到车') {
      return '' // 终到车没有开检时间
    }
    
    const train = trainStore.getTrainByNo(trainNo)
    if (!train || !train.ticketTime) return ''
    
    // 如果是ISO格式的时间字符串，提取时间部分
    if (typeof train.ticketTime === 'string' && train.ticketTime.includes('T')) {
      return train.ticketTime.split('T')[1].substring(0, 5)
    }
    
    // 如果已经是正确的时间格式（HH:mm），直接返回
    if (typeof train.ticketTime === 'string' && /^\d{2}:\d{2}$/.test(train.ticketTime)) {
      return train.ticketTime
    }
    
    // 处理数字格式的时间（Excel时间格式）
    if (typeof train.ticketTime === 'number') {
      const totalMinutes = Math.round(train.ticketTime * 24 * 60)
      const hours = Math.floor(totalMinutes / 60) % 24
      const minutes = totalMinutes % 60
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
    }
    
    return ''
  }

  // 检查车次是否在次日凌晨0-2点之间开检
  const isEarlyMorningTicketTime = (trainNo: string): boolean => {
    const ticketTime = getTicketTime(trainNo)
    if (!ticketTime) return false
    
    const [hours] = ticketTime.split(':').map(Number)
    return hours >= 0 && hours <= 2 // 0点到2点之间
  }

  /**
   * 判断车次是否临近开检/到站时间
   * @param trainNo 车次号
   * @param date 可选参数，车次日期，默认为当天
   * @returns 是否临近开检/到站时间
   */
  const isNearTicketTime = (trainNo: string, date?: string): boolean => {
    try {
      // 检查缓存是否有效（缓存1分钟）
      const now = Date.now()
      const cacheKey = `${trainNo}_${date || ''}_${new Date().getMinutes()}`
      const cached = isNearTicketTimeCache.get(cacheKey)
      
      if (cached && (now - cached.timestamp) < 60000) {
        return cached.result
      }
      
      // 获取车次类型和提醒时间
      const { type: trainType, remindMinutes } = getTrainTypeAndRemindTime(trainNo)
      
      // 获取车次信息和开检时间
      const ticketTimeStr = getTicketTime(trainNo)
      if (!ticketTimeStr) {
        isNearTicketTimeCache.set(cacheKey, {result: false, timestamp: now})
        return false
      }
      
      // 提取小时和分钟
      const [hours, minutes] = ticketTimeStr.split(':').map(Number)
      
      // 构建完整的日期时间对象
      const currentDate = new Date()
      const today = currentDate.toISOString().split('T')[0]
      
      // 如果提供了日期参数，检查是否是今天或明天的凌晨
      if (date) {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const tomorrowStr = tomorrow.toISOString().split('T')[0]
        
        // 如果车次不是今天的，也不是明天的凌晨车次，则不可能临近
        if (date !== today && !(date === tomorrowStr && isEarlyMorningTicketTime(trainNo))) {
          isNearTicketTimeCache.set(cacheKey, {result: false, timestamp: now})
          return false
        }
        
        // 如果是明天的凌晨车次，但当前时间还没到晚上21点，也不算临近
        if (date === tomorrowStr && isEarlyMorningTicketTime(trainNo) && currentDate.getHours() < 21) {
          isNearTicketTimeCache.set(cacheKey, {result: false, timestamp: now})
          return false
        }
      }
      
      // 创建对比时间
      let ticketTime = new Date()
      ticketTime.setHours(hours, minutes, 0, 0)
      
      // 凌晨车次需要特殊处理
      if (hours >= 0 && hours < 1) {
        // 检查是否是明天的车次
        if (currentDate.getHours() >= 12) {
          // 如果现在已经是下午，则车次时间应该是明天凌晨
          ticketTime.setDate(ticketTime.getDate() + 1)
          const newTimeDiff = ticketTime.getTime() - currentDate.getTime()
          
          // 判断是否在临近阈值内
          const minuteDiff = newTimeDiff / (1000 * 60)
          const result = minuteDiff >= 0 && minuteDiff <= remindMinutes
          isNearTicketTimeCache.set(cacheKey, {result, timestamp: now})
          return result
        }
      }
      
      // 判断是否在临近阈值内(转换为分钟)
      const timeDiff = ticketTime.getTime() - currentDate.getTime()
      const minuteDiff = timeDiff / (1000 * 60)
      const result = minuteDiff >= 0 && minuteDiff <= remindMinutes
      isNearTicketTimeCache.set(cacheKey, {result, timestamp: now})
      return result
    } catch (error) {
      console.error('判断车次临近开检失败:', error, trainNo)
      return false
    }
  }

  // 检查是否已过开检时间
  const isExpiredTicketTime = (trainNo: string, passengerDate?: string): boolean => {
    // 检查缓存是否有效（缓存1分钟）
    const cacheKey = `${trainNo}_${passengerDate || ''}_${new Date().getMinutes()}`
    const cached = isExpiredTicketTimeCache.get(cacheKey)
    const now = Date.now()
    
    if (cached && (now - cached.timestamp) < 60000) {
      return cached.result
    }
    
    // 先获取车次类型，终到车和其他类型的车次处理不同
    const { type: trainType } = getTrainTypeAndRemindTime(trainNo)
    
    // 获取判断过期的时间（终到车用到站时间，其他车次用开检时间）
    let timeToCheck = ''
    
    if (trainType === '终到车') {
      // 终到车使用到站时间判断是否过期
      const train = trainStore.getTrainByNo(trainNo)
      if (train && train.arrivalTime) {
        timeToCheck = train.arrivalTime
      } else {
        // 特殊情况硬编码处理
        // 从getTerminalArrivalTime函数获取硬编码的到站时间
        timeToCheck = getTerminalArrivalTime(trainNo) || ''
      }
    } else {
      // 非终到车使用开检时间判断是否过期
      timeToCheck = getTicketTime(trainNo)
    }
    
    if (!timeToCheck) return false
    
    const nowDate = new Date()
    const today = nowDate.toISOString().split('T')[0]
    
    // 计算明天的日期
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]
    
    // 如果提供了旅客日期参数
    if (passengerDate) {
      // 如果是今日的车次，正常判断过期
      if (passengerDate === today) {
        const [hours, minutes] = timeToCheck.split(':').map(Number)
        const ticketDateTime = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), hours, minutes)
      
        // 计算时间差（分钟）
        const diffMinutes = (ticketDateTime.getTime() - nowDate.getTime()) / (1000 * 60)
        const result = diffMinutes < 0
      
        // 缓存结果
        isExpiredTicketTimeCache.set(cacheKey, {result, timestamp: now})
        return result
      } 
      // 如果是次日的车次，判断特殊规则
      else if (passengerDate === tomorrowStr) {
        // 次日车次只有在已经到了次日凌晨且过了指定时间才算过期
        if (nowDate.getHours() >= 0 && nowDate.getHours() < 3 && nowDate.getDate() === tomorrow.getDate()) {
          // 如果已经是次日凌晨，正常判断是否过期
          const [hours, minutes] = timeToCheck.split(':').map(Number)
          const ticketDateTime = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), hours, minutes)
          
          // 计算时间差
          const diffMinutes = (ticketDateTime.getTime() - nowDate.getTime()) / (1000 * 60)
          const result = diffMinutes < 0
          
          // 缓存结果
          isExpiredTicketTimeCache.set(cacheKey, {result, timestamp: now})
          return result
        }
        
        // 否则次日车次默认未过期
        isExpiredTicketTimeCache.set(cacheKey, {result: false, timestamp: now})
        return false
      }
      // 其他日期（未来日期）不算过期
      else {
        isExpiredTicketTimeCache.set(cacheKey, {result: false, timestamp: now})
        return false
      }
    }
    
    // 如果没有提供日期参数，默认为今天
    const [hours, minutes] = timeToCheck.split(':').map(Number)
    const ticketDateTime = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), hours, minutes)
    
    // 计算时间差（分钟）
    const diffMinutes = (ticketDateTime.getTime() - nowDate.getTime()) / (1000 * 60)
    const result = diffMinutes < 0
    
    // 缓存结果
    isExpiredTicketTimeCache.set(cacheKey, {result, timestamp: now})
    return result
  }

  // 硬编码的终到车到站时间获取函数
  const getTerminalArrivalTime = (trainNo: string): string => {
    const terminalTimes: Record<string, string> = {
      'K213': '06:30',
      'T231': '07:25',
      'D6852': '09:16',
      'G657': '16:59'
    }
    
    return terminalTimes[trainNo] || ''
  }

  // 获取车次类型和提醒时间
  const getTrainTypeAndRemindTime = (trainNo: string): { type: string, remindMinutes: number } => {
    // K546特殊处理，明确指定为通过车
    if (trainNo === 'K546') {
      return { type: '通过车', remindMinutes: 6 } // K546作为通过车，提前6分钟提醒
    }
    
    // D6852特殊处理，明确指定为终到车
    if (trainNo === 'D6852') {
      return { type: '终到车', remindMinutes: 20 } // 终到车也需设置提醒时间以便正确判断过期
    }
    
    // G657特殊处理，明确指定为终到车
    if (trainNo === 'G657') {
      return { type: '终到车', remindMinutes: 20 } // 终到车也需设置提醒时间以便正确判断过期
    }
    
    // T231特殊处理，明确指定为终到车
    if (trainNo === 'T231') {
      return { type: '终到车', remindMinutes: 20 } // 终到车也需设置提醒时间以便正确判断过期
    }
    
    // K213特殊处理，明确指定为终到车
    if (trainNo === 'K213') {
      return { type: '终到车', remindMinutes: 20 } // 终到车也需设置提醒时间以便正确判断过期
    }

    const train = trainStore.getTrainByNo(trainNo)
    if (!train) return { type: 'unknown', remindMinutes: 23 } // 无法识别的车次提前23分钟提醒

    // 获取运行区间1和运行区间2
    const route1 = train.route || ''
    const route2 = train.route2 || ''
    
    // D行的运行区间为西安，则为始发车
    if (route1 === '西安') {
      // 始发车类型判断
      if (trainNo.startsWith('T') || trainNo.startsWith('K')) {
        return { type: '始发车', remindMinutes: 33 } // T字头和K字头列车提前33分钟提醒
      } else if (trainNo.startsWith('C') || trainNo.startsWith('D')) {
        return { type: '始发车', remindMinutes: 23 } // C字头和D字头列车提前23分钟提醒
      }
      // 其他始发车
      return { type: '始发车', remindMinutes: 23 } // 默认提前23分钟提醒
    } 
    
    // E行的运行区间为西安，则为终到车
    if (route2 === '西安') {
      // 终到车也需设置提醒时间以便正确判断过期
      return { type: '终到车', remindMinutes: 20 }
    } 
    
    // 其余情况均为通过车
    return { type: '通过车', remindMinutes: 6 } // 通过车提前6分钟提醒
  }

  // 添加一个新的排序函数
  const sortPassengersByPriority = (passengers: Passenger[]): Passenger[] => {
    return [...passengers].sort((a, b) => {
      // 获取车次类型
      const aTrainType = getTrainTypeAndRemindTime(a.trainNo).type
      const bTrainType = getTrainTypeAndRemindTime(b.trainNo).type
      
      // 获取列车的时间
      // 针对终到车，使用到站时间；针对非终到车，使用开检时间
      let aTime = ''
      let bTime = ''
      
      if (aTrainType === '终到车') {
        // 终到车使用到站时间
        const trainA = trainStore.getTrainByNo(a.trainNo)
        if (trainA && trainA.arrivalTime) {
          aTime = trainA.arrivalTime
        } else {
          // 使用终到车到站时间函数
          aTime = getTerminalArrivalTime(a.trainNo)
        }
      } else {
        // 非终到车使用开检时间
        aTime = getTicketTime(a.trainNo)
      }
      
      if (bTrainType === '终到车') {
        // 终到车使用到站时间
        const trainB = trainStore.getTrainByNo(b.trainNo)
        if (trainB && trainB.arrivalTime) {
          bTime = trainB.arrivalTime
        } else {
          // 使用终到车到站时间函数
          bTime = getTerminalArrivalTime(b.trainNo)
        }
      } else {
        // 非终到车使用开检时间
        bTime = getTicketTime(b.trainNo)
      }
      
      // 检查是否有时间可用
      const aHasTime = Boolean(aTime)
      const bHasTime = Boolean(bTime)
      
      // 检查是否为第二天凌晨车次（0-2点）
      const aIsMorning = isEarlyMorningTicketTime(a.trainNo)
      const bIsMorning = isEarlyMorningTicketTime(b.trainNo)
      
      // 检查是否临近开检的状态
      const isNearA = isNearTicketTime(a.trainNo, a.date)
      const isNearB = isNearTicketTime(b.trainNo, b.date)
      
      // 检查是否已过开检时间
      const isExpiredA = isExpiredTicketTime(a.trainNo, a.date)
      const isExpiredB = isExpiredTicketTime(b.trainNo, b.date)
      
      // 最高优先级：先将已过期和未过期的分开，已过期的排在最后
      if (isExpiredA !== isExpiredB) {
        return isExpiredA ? 1 : -1;
      }
      
      // 第二优先级：按日期排序
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date); // 较早的日期排在前面
      }
      
      // 如果都是未过期的车次，使用以下排序规则：
      if (!isExpiredA && !isExpiredB) {
        // 1. 没有时间的排在最上面（这种情况很少见）
        if (!aHasTime && bHasTime) return -1;
        if (aHasTime && !bHasTime) return 1;
        
        // 2. 临近开检/到站时间的显示在第二位
        if (isNearA && !isNearB) return -1;
        if (!isNearA && isNearB) return 1;
        
        // 3. 当天未到开检/到站时间的排在第三位
        if (!aIsMorning && bIsMorning) return -1;
        if (aIsMorning && !bIsMorning) return 1;
        
        // 4. 按时间排序，早的排前面
        if (aTime && bTime) {
          return aTime.localeCompare(bTime);
        }
      }
      
      // 如果都是已过期的车次，按时间排序
      if (isExpiredA && isExpiredB) {
        if (aTime && bTime) {
          return aTime.localeCompare(bTime);
        }
      }
      
      // 最后按车次编号排序
      return a.trainNo.localeCompare(b.trainNo);
    });
  }

  // 更新今日旅客列表
  const updateTodayPassengers = async (isManual?: boolean, skipSorting?: boolean) => {
    try {
      const now = new Date()
      const today = now.toISOString().split('T')[0]
      
      // 计算明天的日期
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = tomorrow.toISOString().split('T')[0]
      
      // 使用store的getPassengersByDate函数获取旅客，保证过滤逻辑一致性
      let updatedPassengers = passengerStore.getPassengersByDate(today)
      
      // 预处理：重置缓存以确保判断结果一致性
      // 清除与次日和今日相关的所有过期判断缓存
      updatedPassengers.forEach(passenger => {
        // 清除isExpiredTicketTimeCache缓存
        for (const key of isExpiredTicketTimeCache.keys()) {
          if (key.includes(passenger.trainNo) || key.includes(passenger.date)) {
            isExpiredTicketTimeCache.delete(key)
          }
        }
        
        // 清除isNearTicketTimeCache缓存
        for (const key of isNearTicketTimeCache.keys()) {
          if (key.includes(passenger.trainNo) || key.includes(passenger.date)) {
            isNearTicketTimeCache.delete(key)
          }
        }
      })
      
      // 创建旅客ID的副本，避免修改原始数据
      const updatedPassengersClone = updatedPassengers.map(p => ({...p}))
      
      // 如果需要跳过排序（通常是为了提高性能），但仍然要保证次日凌晨2点后的车次不显示
      if (skipSorting) {
        // 直接更新旅客数据
        todayPassengers.value = updatedPassengersClone
      } else {
        // 执行完整的排序逻辑，使用公共排序函数
        const sortedPassengers = sortPassengersByPriority(updatedPassengersClone)
        
        // 批量更新旅客数据，避免多次触发界面更新
        todayPassengers.value = sortedPassengers
      }
      
      // 使用 requestAnimationFrame 确保在下一次渲染周期处理样式
      if (isManual) {
        requestAnimationFrame(() => {
          // 手动刷新需要立即更新样式
          const alertPassengers = todayPassengers.value.filter(p => 
            isNearTicketTime(p.trainNo, p.date) && !isExpiredTicketTime(p.trainNo, p.date)
          )
          
          if (alertPassengers.length > 0) {
            // 通知外部组件更新样式
            updateStyleCallback(alertPassengers)
          }
        })
      }
    } catch (error) {
      console.error('更新今日旅客数据失败:', error)
    }
  }

  // 添加样式更新回调，让外部组件可以注册样式更新函数
  let updateStyleCallback: ForceStyleUpdateFn = () => {}
  const setStyleUpdateCallback = (callback: ForceStyleUpdateFn) => {
    updateStyleCallback = callback
  }

  // 根据类别返回标签类型
  const getTypeTagType = (type: PassengerType): string => {
    const typeMap: Record<PassengerType, string> = {
      [PassengerType.MILITARY]: 'success',
      [PassengerType.ELDERLY]: 'warning',
      [PassengerType.WEAK]: 'info',
      [PassengerType.SICK]: 'danger',
      [PassengerType.DISABLED]: 'danger'
    }
    return typeMap[type] || ''
  }

  // 显示车次详情
  const showTrainInfo = (trainNo: string): void => {
    const train = trainStore.getTrainByNo(trainNo)
    currentTrain.value = train || null
    
    // 如果找到车次信息，在显示对话框前处理开检时间
    if (currentTrain.value && currentTrain.value.ticketTime) {
      // 格式化开检时间以便在对话框中显示
      const formattedTime = getTicketTime(trainNo)
      if (formattedTime) {
        currentTrain.value = {
          ...currentTrain.value,
          ticketTime: formattedTime
        }
      }
    }
    
    dialogVisible.value = true
  }

  // 刷新数据
  const refreshData = (): void => {
    currentTime.value = new Date().toLocaleDateString()
  }

  // 检查并发送提醒
  const activeNotifications = ref(new Set<string>())

  const checkAndNotify = (): void => {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    
    // 计算明天的日期
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]
    
    // 优化：如果没有最近更新，跳过检查
    const lastCheckTime = (checkAndNotify as any).lastCheckTime || 0
    const currentTime = now.getTime()
    
    // 如果上次检查在10秒内，跳过本次检查
    if (currentTime - lastCheckTime < 10000 && activeNotifications.value.size > 0) {
      return
    }
    
    // 记录本次检查时间
    (checkAndNotify as any).lastCheckTime = currentTime
    
    // 获取今日的旅客，用于去重
    const todayPassengers = passengerStore.passengerList.filter(p =>
      p.date === today && !p.isServed
    )
    
    // 创建今日旅客ID集合用于去重
    const todayPassengerIds = new Set(todayPassengers.map(p => p.id))
    
    // 获取明日凌晨车次，确保不重复
    const tomorrowPassengers = passengerStore.passengerList.filter(p => 
      p.date === tomorrowStr && 
      !p.isServed && 
      isEarlyMorningTicketTime(p.trainNo) &&
      !todayPassengerIds.has(p.id) // 确保不重复
    )
    
    // 合并今日和明日凌晨的旅客，确保不重复
    const passengers = [...todayPassengers, ...tomorrowPassengers]
    
    // 如果没有旅客，清除提醒后直接返回
    if (passengers.length === 0) {
      // 清除所有现有的提醒
      document.querySelectorAll('.urgent-notification').forEach(notification => {
        ;(notification as HTMLElement).remove()
      })
      activeNotifications.value.clear()
      return
    }
    
    // 清除所有现有的提醒
    const notifications = document.querySelectorAll('.urgent-notification')
    notifications.forEach(notification => {
      ;(notification as HTMLElement).remove()
    })
    activeNotifications.value.clear()

    // 获取提醒容器
    const container = document.querySelector('.notification-content')
    if (!container) return
    
    // 按综合时间轴排序，使用公共排序函数确保与updateTodayPassengers一致
    const sortedPassengers = sortPassengersByPriority(passengers)
    
    // 创建文档片段，一次性添加到DOM，减少重排
    const fragment = document.createDocumentFragment()
    
    sortedPassengers.forEach((passenger) => {
      // 获取正确的时间（终到车用到站时间，其他用开检时间）
      const { type } = getTrainTypeAndRemindTime(passenger.trainNo)
      let timeToUse = ''
      
      if (type === '终到车') {
        // 终到车使用到站时间
        const train = trainStore.getTrainByNo(passenger.trainNo)
        if (train && train.arrivalTime) {
          timeToUse = train.arrivalTime
        } else {
          // 使用终到车到站时间函数
          timeToUse = getTerminalArrivalTime(passenger.trainNo)
        }
      } else {
        // 非终到车使用开检时间
        timeToUse = getTicketTime(passenger.trainNo)
      }
      
      if (!timeToUse) return
      
      const [hours, minutes] = timeToUse.split(':').map(Number)
      const ticketDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes)
      
      // 计算时间差（分钟）
      const diffMinutes = (ticketDateTime.getTime() - now.getTime()) / (1000 * 60)
      
      // 获取车次类型和提醒时间
      const { remindMinutes } = getTrainTypeAndRemindTime(passenger.trainNo)
      
      // 如果时间差在提醒时间内且未过期，发送提醒
      if (diffMinutes > 0 && diffMinutes <= remindMinutes) {
        const notificationId = `ticket-check-${passenger.id}`
        activeNotifications.value.add(notificationId)
        
        const notification = document.createElement('div')
        notification.className = `urgent-notification notification-${notificationId}`
        notification.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 6px; background-color: #fef0f0; border-radius: 3px; border: 1px solid #f56c6c; margin-bottom: 4px;">
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="color: #f56c6c; font-size: 12px;">⚠️</span>
              <span style="color: #f56c6c; font-size: 12px; font-weight: bold;">旅客${type === '终到车' ? '到站' : '开检'}提醒</span>
              <span style="color: #f56c6c; font-size: 12px;">[${type}]</span>
            </div>
            <div class="close-btn" style="cursor: pointer; font-size: 12px; color: #f56c6c;">×</div>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; padding: 0 4px; margin-bottom: 4px;">
            <div style="font-size: 11px;">
              <span style="color: #606266;">车次：</span>
              <span style="color: #f56c6c; font-weight: bold;">${passenger.trainNo}</span>
            </div>
            <div style="font-size: 11px;">
              <span style="color: #606266;">旅客：</span>
              <span style="font-weight: bold;">${passenger.name}</span>
            </div>
            <div style="font-size: 11px;">
              <span style="color: #606266;">号牌：</span>
              <span style="font-weight: bold;">${passenger.cardNo}</span>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 2px; padding: 0 4px;">
            <div style="font-size: 11px;">
              <span style="color: #606266;">${type === '终到车' ? '到站' : '开检'}时间：</span>
              <span style="color: #f56c6c; font-weight: bold;">${timeToUse}</span>
            </div>
            <div style="font-size: 11px;">
              <span style="color: #606266;">距离${type === '终到车' ? '到站' : '开检'}：</span>
              <span style="color: #f56c6c; font-weight: bold;">${Math.round(diffMinutes)}分钟</span>
            </div>
          </div>
        `
        
        // 添加关闭按钮事件
        notification.querySelector('.close-btn')?.addEventListener('click', () => {
          notification.remove()
          activeNotifications.value.delete(notificationId)
        })
        
        fragment.appendChild(notification)
      }
    })
    
    // 一次性添加所有通知到容器
    container.appendChild(fragment)
  }

  // 添加一个静态属性用于缓存最后检查时间
  checkAndNotify.lastCheckTime = 0

  // 添加缓存机制优化判断函数
  // 对isNearTicketTime函数添加缓存
  const isNearTicketTimeCache = new Map<string, {result: boolean, timestamp: number}>()
  
  // 对isExpiredTicketTime函数添加缓存
  const isExpiredTicketTimeCache = new Map<string, {result: boolean, timestamp: number}>()
  
  // 更新统计数据
  let lastStatisticsUpdate = 0
  const statisticsUpdateInterval = 15000 // 15秒更新一次统计
  
  const updateStatistics = (): void => {
    const now = Date.now()
    
    // 如果距离上次更新不到15秒，则跳过
    if (now - lastStatisticsUpdate < statisticsUpdateInterval) {
      return
    }
    
    lastStatisticsUpdate = now
    const today = new Date().toISOString().split('T')[0]
    
    // 计算明天的日期
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]
    
    // 统计今日旅客（包括明天凌晨0-1点的旅客）
    const todayHomePassengers = passengerStore.passengerList.filter(p => 
      (p.date === today || (p.date === tomorrowStr && isEarlyMorningTicketTime(p.trainNo))) && 
      p.isServed === false
    )
    passengerCount.value = todayHomePassengers.length
    
    // 统计已服务旅客
    servedCount.value = passengerStore.passengerList.filter(p => 
      (p.date === today || (p.date === tomorrowStr && isEarlyMorningTicketTime(p.trainNo))) && 
      p.isServed
    ).length
  }

  // 创建页面可见性变化处理函数
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      // 清除缓存
      isNearTicketTimeCache.clear()
      isExpiredTicketTimeCache.clear()
      
      // 立即强制刷新，不使用setTimeout
      updateTodayPassengers(true)
      
      // 立即检查通知，确保通知逻辑与乘客列表排序一致
      checkAndNotify()
    }
  }

  // 页面加载时启动定时检查
  onMounted(() => {
    // 清除所有缓存，确保页面加载时使用最新的判断结果
    isNearTicketTimeCache.clear()
    isExpiredTicketTimeCache.clear()
    
    // 每分钟更新时间
    setInterval(() => {
      currentTime.value = new Date().toLocaleDateString()
    }, 60000)
    
    // 每1分钟检查一次开检时间（改为更频繁的检查以确保及时清除过期提醒）
    const checkInterval = window.setInterval(() => {
      // 检查前先清除缓存，确保一致性
      isNearTicketTimeCache.clear()
      isExpiredTicketTimeCache.clear()
      checkAndNotify()
    }, 60 * 1000)
    
    // 每20秒更新一次页面数据
    const updateInterval = window.setInterval(() => {
      // 强制更新当前时间
      currentTime.value = new Date().toLocaleDateString()
      // 更新统计数据
      updateStatistics()
      // 更新今日旅客列表，确保在更新后立即检查通知
      updateTodayPassengers().then(() => {
        // 在更新完成后执行通知检查，确保顺序一致
        checkAndNotify()
      })
    }, 20 * 1000)
    
    // 立即执行一次更新，并在更新后立即执行检查
    updateStatistics()
    updateTodayPassengers(true).then(() => {
      // 在更新完成后执行通知检查
      checkAndNotify()
    })
    
    // 添加页面可见性变化监听，确保页面切换回来时重新整理排序
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  // 页面卸载时清除定时器和提醒
  onUnmounted(() => {
    // 由于我们在页面组件中管理定时器，这里不需要清除
    // 因此移除之前的定时器清除代码
    
    // 清除所有提醒
    const notifications = document.querySelectorAll('.el-notification')
    notifications.forEach(notification => {
      ;(notification as HTMLElement).style.display = 'none'
    })
    activeNotifications.value.clear()
    
    // 移除页面可见性变化监听
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  })

  // 获取行的类名
  const getRowClassName = ({ row }: { row: Passenger }): string => {
    try {
      // 如果是离厅旅客，显示灰色
      if (row.isServed) {
        return 'left-row'
      }

      // 判断是否已过期（包括终到车）
      if (isExpiredTicketTime(row.trainNo, row.date)) {
        return 'expired-row'
      }

      // 如果开检/到站时间临近，显示黄色警告
      if (isNearTicketTime(row.trainNo, row.date)) {
        console.log('Row is near ticket time:', row.trainNo, row.date) // 添加调试日志
        return 'near-row'
      }

      return ''
    } catch (error) {
      console.error('计算行样式出错:', error, row)
      return ''
    }
  }

  // 处理离厅
  const handleMarkAsLeft = (row: Passenger): void => {
    ElMessageBox.confirm('确认该旅客已离厅？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(() => {
      // 查找历史记录中是否存在该旅客
      const passenger = passengerStore.passengerList.find(p => 
        p.service === row.service && 
        p.trainNo === row.trainNo && 
        p.name === row.name && 
        p.cardNo === row.cardNo
      )
      
      if (passenger) {
        // 如果存在，更新状态为已服务
        passengerStore.updatePassenger(passenger.id, {
          ...passenger,
          isServed: true
        })
      } else {
        // 如果不存在，创建新记录
        const newPassenger = {
          ...row,
          isServed: true
        }
        passengerStore.addPassenger(newPassenger)
      }

      // 清除该旅客的提醒
      const notificationId = `ticket-check-${row.id}`
      const notification = document.querySelector(`.notification-${row.id}`)
      if (notification) {
        notification.remove()
      }
      activeNotifications.value.delete(notificationId)
      
      // 从表格中移除该旅客（因为已标记为离厅）
      updateTodayPassengers(true)
      
      // 显示成功消息
      ElMessage.success('已成功标记旅客离厅')
    }).catch(() => {
      // 用户取消操作，不做处理
    })
  }

  // 暂时添加空函数，稍后可以实现具体逻辑
  const handleAdd = () => {
    addDialogVisible.value = true
    isEdit.value = false
    
    // 重置表单
    form.value = {
      date: new Date().toISOString().split('T')[0],
      trainNo: '',
      name: '',
      service: '',
      phone: '',
      staffName: '',
      companions: 0,
      cardNo: '',
      remark: '',
      source: 'offline',
    }
  }

  const handleEdit = (row: Passenger) => {
    addDialogVisible.value = true
    isEdit.value = true
    editId.value = row.id
    
    // 填充表单数据
    form.value = { ...row }
  }

  const handleSubmit = () => {
    formRef.value?.validate((valid: boolean) => {
      if (valid) {
        if (isEdit.value && editId.value) {
          // 编辑现有旅客
          passengerStore.updatePassenger(editId.value, form.value)
          ElMessage.success('修改成功')
        } else {
          // 添加新旅客
          passengerStore.addPassenger(form.value)
          ElMessage.success('添加成功')
        }
        addDialogVisible.value = false
        
        // 更新旅客列表
        updateTodayPassengers(true)
      }
    })
  }

  // 临时时间存储
  const tempTicketTimes = ref<Record<string, string>>({})

  // 初始化临时开检时间
  const initTempTicketTime = (trainNo: string) => {
    const currentTime = getTicketTime(trainNo)
    tempTicketTimes.value[trainNo] = currentTime
  }

  // 处理开检时间变更
  const handleTicketTimeChange = (trainNo: string, time: string) => {
    const train = trainStore.getTrainByNo(trainNo)
    if (train) {
      // 更新开检时间
      trainStore.updateTrainTicketTime(trainNo, time)
      
      // 清除与该车次相关的所有缓存
      // 清除isNearTicketTimeCache缓存
      for (const key of isNearTicketTimeCache.keys()) {
        if (key.startsWith(trainNo)) {
          isNearTicketTimeCache.delete(key)
        }
      }
      
      // 清除isExpiredTicketTimeCache缓存
      for (const key of isExpiredTicketTimeCache.keys()) {
        if (key.startsWith(trainNo)) {
          isExpiredTicketTimeCache.delete(key)
        }
      }
      
      // 立即强制更新今日旅客列表，isManual=true表示强制刷新
      updateTodayPassengers(true)
      
      // 强制检查通知
      checkAndNotify()
      
      // 成功提示
      ElMessage.success(`已更新${trainNo}列车开检时间为${time}`)
    }
  }

  // 处理牌号变更
  const handleCardNoChange = (cardNo: string) => {
    if (!cardNo) return
    
    // 检查是否已经存在
    const existingPassenger = passengerStore.passengerList.find(p => 
      p.cardNo === cardNo && 
      p.date === form.value.date && 
      !p.isServed
    )
    
    if (existingPassenger && existingPassenger.id !== editId.value) {
      ElMessage.warning('该牌号今日已存在')
    }
  }

  // 显示设置到站时间对话框
  const showSetArrivalTimeDialog = (trainNo: string) => {
    ElMessageBox.prompt('请输入新的到站时间 (HH:mm格式)', '修改到站时间', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPattern: /^([01]\d|2[0-3]):([0-5]\d)$/,
      inputErrorMessage: '请输入有效的时间格式 (HH:mm)',
      inputValue: trainStore.getTrainByNo(trainNo)?.arrivalTime || ''
    }).then(({ value }) => {
      if (value && trainNo) {
        // 更新到站时间
        trainStore.updateTrainArrivalTime(trainNo, value)
        
        // 清除与该车次相关的所有缓存
        // 清除isNearTicketTimeCache缓存
        for (const key of isNearTicketTimeCache.keys()) {
          if (key.startsWith(trainNo)) {
            isNearTicketTimeCache.delete(key)
          }
        }
        
        // 清除isExpiredTicketTimeCache缓存
        for (const key of isExpiredTicketTimeCache.keys()) {
          if (key.startsWith(trainNo)) {
            isExpiredTicketTimeCache.delete(key)
          }
        }
        
        // 立即强制更新今日旅客列表，isManual=true表示强制刷新
        updateTodayPassengers(true)
        
        // 强制检查通知
        checkAndNotify()
        
        // 成功提示
        ElMessage.success(`已更新${trainNo}列车到站时间为${value}`)
      }
    }).catch(() => {
      // 用户取消，不做处理
    })
  }

  // 处理文件变更（导入）
  const handleFileChange = (file: UploadFile) => {
    const fileReader = new FileReader()

    fileReader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        // 使用raw:true保留Excel原始数据类型
        const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: true }) 
        
        if (jsonData.length > 0) {
          // 导入的旅客计数
          let importedCount = 0
          
          // 获取当前日期作为默认日期
          const today = new Date().toISOString().split('T')[0]
          
          // 处理Excel日期的辅助函数
          const formatExcelDate = (dateValue: any): string => {
            // 如果已经是YYYY-MM-DD格式的字符串，直接返回
            if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
              return dateValue;
            }
            
            // 如果是日期对象，格式化为YYYY-MM-DD
            if (dateValue instanceof Date) {
              return dateValue.toISOString().split('T')[0];
            }
            
            // 处理Excel数字日期格式（1900年以来的天数）
            if (typeof dateValue === 'number') {
              try {
                // Excel存储日期为距离1900-01-01（或1904-01-01）的天数
                // 转换为JavaScript日期
                const jsDate = new Date((dateValue - 25569) * 86400 * 1000);
                
                // 处理Excel日期转JavaScript日期时可能出现的时区偏差导致少一天的问题
                // 使用UTC确保日期正确
                const year = jsDate.getUTCFullYear();
                const month = jsDate.getUTCMonth() + 1;
                const day = jsDate.getUTCDate();
                
                if (!isNaN(jsDate.getTime())) {
                  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                }
              } catch (e) {
                console.warn('Excel数值日期转换失败:', dateValue, e);
              }
            }
            
            // 如果是日期串，尝试转换
            if (typeof dateValue === 'string' && dateValue) {
              try {
                // 处理MM/DD/YYYY格式
                if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateValue)) {
                  const parts = dateValue.split('/');
                  const date = new Date(Number(parts[2]), Number(parts[0])-1, Number(parts[1]));
                  // 使用UTC日期确保不会少一天
                  const year = date.getFullYear();
                  const month = date.getMonth() + 1;
                  const day = date.getDate();
                  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                }
                
                // 处理DD-MM-YYYY格式
                if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateValue)) {
                  const parts = dateValue.split('-');
                  const date = new Date(Number(parts[2]), Number(parts[1])-1, Number(parts[0]));
                  // 使用UTC日期确保不会少一天
                  const year = date.getFullYear();
                  const month = date.getMonth() + 1;
                  const day = date.getDate();
                  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                }
                
                // 尝试标准日期转换
                const date = new Date(dateValue);
                if (!isNaN(date.getTime())) {
                  // 使用UTC日期确保不会少一天
                  const year = date.getFullYear();
                  const month = date.getMonth() + 1;
                  const day = date.getDate();
                  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                }
              } catch (e) {
                console.warn('日期转换失败:', dateValue, e);
              }
            }
            
            // 返回今天的日期作为默认值
            return today;
          };
          
          // 遍历Excel数据，转换为旅客数据并添加到系统
          jsonData.forEach((row: any) => {
            try {
              // 处理日期字段
              const rawDate = row.date || row.日期 || today;
              const formattedDate = formatExcelDate(rawDate);
              
              // 构造旅客数据对象
              const passenger: PassengerForm = {
                date: formattedDate,
                trainNo: row.trainNo || row.车次 || '',
                name: row.name || row.姓名 || '',
                service: row.service || row.服务 || '',
                phone: row.phone || row.电话 || row.联系电话 || '',
                staffName: row.staffName || row.服务人员 || '',
                companions: Number(row.companions || row.同行人数 || 0),
                cardNo: row.cardNo || row.牌号 || '',
                remark: row.remark || row.备注 || '',
                source: 'online', // Excel导入的设置为线上来源
              }
              
              // 验证必要字段是否存在
              if (!passenger.trainNo || passenger.trainNo.trim() === '') {
                console.warn('Excel行缺少车次信息，跳过:', row)
                return
              }
              
              // 添加到系统
              passengerStore.addPassenger(passenger)
              importedCount++
            } catch (rowError) {
              console.error('处理Excel行数据时出错:', rowError, row)
            }
          })
          
          // 更新今日旅客列表
          updateTodayPassengers(true)
          
          if (importedCount > 0) {
            ElMessage.success(`已成功导入${importedCount}条旅客数据`)
          } else {
            ElMessage.warning('未导入任何旅客数据，请检查Excel格式是否正确')
          }
        } else {
          ElMessage.warning('Excel文件中未找到有效数据')
        }
      } catch (error) {
        console.error('解析Excel文件出错:', error)
        ElMessage.error('解析Excel文件失败')
      }
    }
    
    fileReader.readAsBinaryString(file.raw as Blob)
    return false // 阻止默认上传
  }

  // 最后的返回
  return {
    currentTime,
    dialogVisible,
    currentTrain,
    passengerCount,
    servedCount,
    todayPassengers,
    addDialogVisible,
    formRef,
    form,
    rules,
    isEdit,
    showTrainInfo,
    getTypeTagType,
    getRowClassName,
    handleMarkAsLeft,
    handleAdd,
    handleEdit,
    handleSubmit,
    getTicketTime,
    handleFileChange,
    checkAndNotify,
    updateTodayPassengers,
    updateStatistics,
    handleTicketTimeChange,
    isNearTicketTime,
    isExpiredTicketTime,
    isEarlyMorningTicketTime,
    handleCardNoChange,
    showSetArrivalTimeDialog,
    getTrainTypeAndRemindTime,
    setStyleUpdateCallback,
    initTempTicketTime,
    tempTicketTimes
  }
} 