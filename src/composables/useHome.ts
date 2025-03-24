import { ref, onMounted, onUnmounted } from 'vue'
import { usePassengerStore } from '../store/passenger'
import { useTrainStore } from '../store/train'
import { ElNotification, ElMessageBox, ElMessage } from 'element-plus'
import type { Passenger, PassengerForm } from '../types/passenger'
import type { Train } from '../store/train'
import { PassengerType, PageType } from '../types/passenger'

export function useHome() {
  const passengerStore = usePassengerStore()
  const trainStore = useTrainStore()

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
    type: PassengerType.ELDERLY,
    service: '',
    staffName: '',
    companions: 0,
    cardNo: '',
    remark: '',
  })
  const isEdit = ref(false)
  const editId = ref<number | null>(null)

  const rules = {
    date: [{ required: true, message: '请选择日期', trigger: 'change' }],
    trainNo: [{ required: true, message: '请选择车次', trigger: 'change' }],
    name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
    type: [{ required: true, message: '请选择类别', trigger: 'change' }],
    staffName: [{ required: true, message: '请输入服务工作人员姓名', trigger: 'blur' }],
    cardNo: [
      { required: true, message: '请输入牌号', trigger: 'blur' },
      {
        validator: (rule: any, value: string, callback: Function) => {
          if (value) {
            const today = new Date().toISOString().split('T')[0]
            const isDuplicate = passengerStore.passengerList.some(passenger => 
              passenger.cardNo === value && 
              passenger.date === today && 
              !passenger.isServed &&
              passenger.id !== editId.value // 排除当前编辑的记录
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

  // 更新今日旅客列表
  const updateTodayPassengers = () => {
    const today = new Date().toISOString().split('T')[0]
    const passengers = passengerStore.passengerList.filter(p => p.date === today && p.isServed === false)
    
    // 按开检时间排序
    todayPassengers.value = passengers.sort((a, b) => {
      const timeA = getTicketTime(a.trainNo)
      const timeB = getTicketTime(b.trainNo)
      
      // 如果时间格式正确，转换为分钟数进行比较
      if (timeA && timeB && timeA.includes(':') && timeB.includes(':')) {
        const [hoursA, minutesA] = timeA.split(':').map(Number)
        const [hoursB, minutesB] = timeB.split(':').map(Number)
        const totalMinutesA = hoursA * 60 + minutesA
        const totalMinutesB = hoursB * 60 + minutesB
        return totalMinutesA - totalMinutesB
      }
      
      // 如果时间格式不正确，按字符串比较
      return timeA.localeCompare(timeB)
    })
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
    dialogVisible.value = true
  }

  // 刷新数据
  const refreshData = (): void => {
    currentTime.value = new Date().toLocaleDateString()
  }

  // 获取车次的开检时间
  const getTicketTime = (trainNo: string): string => {
    const train = trainStore.getTrainByNo(trainNo)
    return train ? train.ticketTime : ''
  }

  // 检查是否临近开检时间（20分钟内）
  const isNearTicketTime = (trainNo: string): boolean => {
    const ticketTime = getTicketTime(trainNo)
    if (!ticketTime) return false
    
    const now = new Date()
    const [hours, minutes] = ticketTime.split(':').map(Number)
    const ticketDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes)
    
    // 计算时间差（分钟）
    const diffMinutes = (ticketDateTime.getTime() - now.getTime()) / (1000 * 60)
    return diffMinutes > 0 && diffMinutes <= 20
  }

  // 检查是否已过开检时间
  const isExpiredTicketTime = (trainNo: string): boolean => {
    const ticketTime = getTicketTime(trainNo)
    if (!ticketTime) return false
    
    const now = new Date()
    const [hours, minutes] = ticketTime.split(':').map(Number)
    const ticketDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes)
    
    // 计算时间差（分钟）
    const diffMinutes = (ticketDateTime.getTime() - now.getTime()) / (1000 * 60)
    return diffMinutes < 0
  }

  // 检查并发送提醒
  const checkAndNotify = (): void => {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const passengers = passengerStore.passengerList.filter(p => p.date === today)
    
    passengers.forEach(passenger => {
      const ticketTime = getTicketTime(passenger.trainNo)
      if (!ticketTime) return
      
      const [hours, minutes] = ticketTime.split(':').map(Number)
      const ticketDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes)
      
      // 计算时间差（分钟）
      const diffMinutes = (ticketDateTime.getTime() - now.getTime()) / (1000 * 60)
      
      // 如果时间差在20分钟内且未过期，发送提醒
      if (diffMinutes > 0 && diffMinutes <= 20) {
        ElNotification({
          title: '开检时间提醒',
          type: 'warning',
          duration: 10000,
          position: 'top-right',
          customClass: 'urgent-notification',
          dangerouslyUseHTMLString: true,
          message: `
            <div style="font-size: 16px; font-weight: bold; color: #f56c6c;">
              车次 ${passenger.trainNo} 的旅客 ${passenger.name} 即将开检
            </div>
            <div style="font-size: 14px; margin-top: 8px;">
              开检时间：${ticketTime}
            </div>
          `
        })
      }
    })
  }

  let checkInterval: number | undefined
  let updateInterval: number | undefined

  // 更新统计数据
  const updateStatistics = (): void => {
    const today = new Date().toISOString().split('T')[0]
    const todayHomePassengers = passengerStore.passengerList.filter(p => p.date === today && p.isServed === false)
    passengerCount.value = todayHomePassengers.length
    servedCount.value = passengerStore.passengerList.filter(p => p.date === today && p.isServed).length
  }

  // 页面加载时启动定时检查
  onMounted(() => {
    // 每分钟更新时间
    setInterval(() => {
      currentTime.value = new Date().toLocaleDateString()
    }, 60000)
    
    // 每5分钟检查一次开检时间
    checkInterval = window.setInterval(checkAndNotify, 5 * 60 * 1000)
    
    // 每5秒更新一次页面数据
    updateInterval = window.setInterval(() => {
      // 强制更新当前时间
      currentTime.value = new Date().toLocaleDateString()
      // 更新统计数据
      updateStatistics()
      // 更新今日旅客列表
      updateTodayPassengers()
    }, 5000)
    
    // 立即执行一次更新
    updateStatistics()
    updateTodayPassengers()
    // 立即执行一次检查
    checkAndNotify()
  })

  // 页面卸载时清除定时器
  onUnmounted(() => {
    if (checkInterval) {
      window.clearInterval(checkInterval)
    }
    if (updateInterval) {
      window.clearInterval(updateInterval)
    }
  })

  // 获取行的类名
  const getRowClassName = ({ row }: { row: Passenger }): string => {
    if (isNearTicketTime(row.trainNo)) {
      return 'urgent-row'
    } else if (isExpiredTicketTime(row.trainNo)) {
      return 'expired-row'
    }
    return ''
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
      
      // 从首页删除该旅客
      
      ElMessage.success('已记录离厅旅客')
      // 刷新数据
      updateTodayPassengers()
      updateStatistics()
    })
  }

  // 处理编辑
  const handleEdit = (row: Passenger): void => {
    isEdit.value = true
    editId.value = row.id
    form.value = {
      date: row.date,
      trainNo: row.trainNo,
      name: row.name,
      type: row.type,
      service: row.service,
      staffName: row.staffName,
      companions: row.companions,
      cardNo: row.cardNo,
      remark: row.remark,
    }
    addDialogVisible.value = true
  }

  const handleAdd = (): void => {
    isEdit.value = false
    editId.value = null
    form.value = {
      date: new Date().toISOString().split('T')[0],
      trainNo: '',
      name: '',
      type: PassengerType.ELDERLY,
      service: '',
      staffName: '',
      companions: 0,
      cardNo: '',
      remark: '',
    }
    addDialogVisible.value = true
  }

  const handleSubmit = async (): Promise<void> => {
    if (!formRef.value) return
    
    await formRef.value.validate((valid: boolean) => {
      if (valid) {
        if (isEdit.value && editId.value) {
          // 编辑现有旅客
          const passenger = {
            ...form.value,
            id: editId.value,
            isServed: false
          }
          passengerStore.updatePassenger(editId.value, passenger)
          ElMessage.success('编辑成功')
        } else {
          // 添加新旅客
          const passenger = {
            ...form.value,
            isServed: false
          }
          passengerStore.addPassenger(passenger)
          ElMessage.success('添加成功')
        }
        
        addDialogVisible.value = false
        // 刷新数据
        updateTodayPassengers()
        updateStatistics()
      }
    })
  }

  // 处理开检时间变更
  const handleTicketTimeChange = (time: string): void => {
    if (!currentTrain.value) return
    
    // 更新时间
    currentTrain.value.ticketTime = time
    
    // 更新车次信息
    trainStore.updateTrain(currentTrain.value.id, currentTrain.value)
    
    // 刷新数据
    updateTodayPassengers()
    
    ElMessage.success('开检时间更新成功')
  }

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
    handleTicketTimeChange
  }
} 