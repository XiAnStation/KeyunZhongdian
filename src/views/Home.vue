<template>
  <div class="home">
    <el-row :gutter="20">
      <el-col :span="24">
        <el-card class="welcome-card">
          <template #header>
            <div class="welcome-header">
              <span>欢迎使用重点旅客信息系统</span>
              <el-tag type="success">{{ currentTime }}</el-tag>
            </div>
          </template>
          <div class="welcome-content">
            <el-row :gutter="20">
              <el-col :span="8">
                <el-statistic title="今日车次数" :value="trainCount">
                  <template #prefix>
                    <el-icon><Train /></el-icon>
                  </template>
                </el-statistic>
              </el-col>
              <el-col :span="8">
                <el-statistic title="重点旅客数" :value="passengerCount">
                  <template #prefix>
                    <el-icon><User /></el-icon>
                  </template>
                </el-statistic>
              </el-col>
              <el-col :span="8">
                <el-statistic title="服务项目数" :value="serviceCount">
                  <template #prefix>
                    <el-icon><Service /></el-icon>
                  </template>
                </el-statistic>
              </el-col>
            </el-row>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>今日重点旅客</span>
              <el-button-group>
                <el-button type="primary" @click="refreshData">
                  <el-icon><Refresh /></el-icon>
                  刷新
                </el-button>
                <el-button type="success" @click="$router.push('/passenger')">
                  <el-icon><Plus /></el-icon>
                  添加旅客
                </el-button>
              </el-button-group>
            </div>
          </template>
          
          <el-table 
            :data="todayPassengers" 
            style="width: 100%"
            :row-class-name="getRowClassName">
            <el-table-column prop="trainNo" label="车次" width="120" />
            <el-table-column prop="name" label="姓名" width="120" />
            <el-table-column prop="type" label="类别" width="120">
              <template #default="{ row }">
                <el-tag :type="getTypeTagType(row.type)">{{ row.type }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="service" label="服务" />
            <el-table-column prop="cardNo" label="牌号" width="100" />
            <el-table-column label="开检时间" width="100">
              <template #default="scope">
                {{ getTicketTime(scope.row.trainNo) }}
              </template>
            </el-table-column>
            <el-table-column prop="companions" label="同行人数" width="100" align="center" />
            <el-table-column prop="remark" label="备注" />
            <el-table-column label="操作" width="280" fixed="right">
              <template #default="scope">
                <el-button-group>
                  <el-button size="small" @click="showTrainInfo(scope.row.trainNo)">
                    车次详情
                  </el-button>
                  <el-button 
                    size="small" 
                    type="primary"
                    @click="$router.push(`/passenger?edit=${scope.row.id}`)">
                    编辑
                  </el-button>
                  <el-button 
                    size="small" 
                    type="success"
                    :disabled="scope.row.isLeft"
                    @click="handleMarkAsLeft(scope.row)">
                    离厅
                  </el-button>
                </el-button-group>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog 
      v-model="dialogVisible" 
      title="车次详细信息"
      width="800px">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="车次">{{ currentTrain?.trainNo }}</el-descriptions-item>
        <el-descriptions-item label="担当局">{{ currentTrain?.bureau }}</el-descriptions-item>
        <el-descriptions-item label="运行区间">{{ currentTrain?.route }}</el-descriptions-item>
        <el-descriptions-item label="到点">{{ currentTrain?.arrivalTime }}</el-descriptions-item>
        <el-descriptions-item label="开点">{{ currentTrain?.departureTime }}</el-descriptions-item>
        <el-descriptions-item label="股道">{{ currentTrain?.track }}</el-descriptions-item>
        <el-descriptions-item label="站台">{{ currentTrain?.platform }}</el-descriptions-item>
        <el-descriptions-item label="站停">{{ currentTrain?.stopTime }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePassengerStore } from '../store/passenger'
import { useTrainStore } from '../store/train'
import { useRouter } from 'vue-router'
import { ElNotification, ElMessageBox, ElMessage } from 'element-plus'

const router = useRouter()
const passengerStore = usePassengerStore()
const trainStore = useTrainStore()

const currentTime = ref(new Date().toLocaleDateString())
const dialogVisible = ref(false)
const currentTrain = ref(null)

// 统计数据
const trainCount = computed(() => trainStore.trainList.length)
const passengerCount = computed(() => passengerStore.passengerList.length)
const serviceCount = computed(() => {
  const services = new Set(passengerStore.passengerList.map(p => p.service))
  return services.size
})

// 获取今日旅客并按开检时间排序
const todayPassengers = computed(() => {
  const today = new Date().toISOString().split('T')[0]
  const passengers = passengerStore.passengerList.filter(p => p.date === today) // 移除离厅状态过滤
  
  // 按开检时间排序
  return passengers.sort((a, b) => {
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
})

// 根据类别返回标签类型
const getTypeTagType = (type) => {
  const typeMap = {
    '重伤': 'danger',
    '孕妇': 'warning',
    '老人': 'info',
    '儿童': 'success',
    '其他': ''
  }
  return typeMap[type] || ''
}

// 显示车次详情
const showTrainInfo = (trainNo) => {
  currentTrain.value = trainStore.getTrainByNo(trainNo)
  dialogVisible.value = true
}

// 刷新数据
const refreshData = () => {
  currentTime.value = new Date().toLocaleDateString()
  // 这里可以添加其他刷新逻辑
}

// 获取车次的开检时间
const getTicketTime = (trainNo) => {
  const train = trainStore.getTrainByNo(trainNo)
  return train ? train.ticketTime : ''
}

// 检查是否临近开检时间（20分钟内）
const isNearTicketTime = (trainNo) => {
  const ticketTime = getTicketTime(trainNo)
  if (!ticketTime) return false
  
  const now = new Date()
  const [hours, minutes] = ticketTime.split(':').map(Number)
  const ticketDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes)
  
  // 计算时间差（分钟）
  const diffMinutes = Math.abs(ticketDateTime - now) / (1000 * 60)
  return diffMinutes <= 20
}

// 检查并发送提醒
const checkAndNotify = () => {
  const today = new Date().toISOString().split('T')[0]
  const passengers = passengerStore.passengerList.filter(p => p.date === today)
  
  passengers.forEach(passenger => {
    const ticketTime = getTicketTime(passenger.trainNo)
    if (!ticketTime) return
    
    const now = new Date()
    const [hours, minutes] = ticketTime.split(':').map(Number)
    const ticketDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes)
    
    // 计算时间差（分钟）
    const diffMinutes = Math.abs(ticketDateTime - now) / (1000 * 60)
    
    // 如果时间差在20分钟内，发送提醒
    if (diffMinutes <= 20) {
      ElNotification({
        title: '开检时间提醒',
        message: `车次 ${passenger.trainNo} 的旅客 ${passenger.name} 即将开检，开检时间：${ticketTime}`,
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

let checkInterval

// 页面加载时启动定时检查
onMounted(() => {
  // 每分钟更新时间
  setInterval(() => {
    currentTime.value = new Date().toLocaleDateString()
  }, 60000)
  
  // 每5分钟检查一次开检时间
  checkInterval = setInterval(checkAndNotify, 5 * 60 * 1000)
  
  // 立即执行一次检查
  checkAndNotify()
})

// 页面卸载时清除定时器
onUnmounted(() => {
  if (checkInterval) {
    clearInterval(checkInterval)
  }
})

// 获取行的类名
const getRowClassName = ({ row }) => {
  return isNearTicketTime(row.trainNo) ? 'urgent-row' : ''
}

// 处理离厅
const handleMarkAsLeft = (row) => {
  ElMessageBox.confirm('确认该旅客已离厅？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    passengerStore.deletePassenger(row.id)
    ElMessage.success('已删除离厅旅客')
  })
}
</script>

<style scoped>
.home {
  padding: 20px;
}

.welcome-card {
  margin-bottom: 20px;
}

.welcome-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.welcome-content {
  padding: 20px 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.el-statistic {
  text-align: center;
}

:deep(.el-statistic__number) {
  color: #409EFF;
  font-size: 24px !important;
}

:deep(.el-card__header) {
  border-bottom: 1px solid #e4e7ed;
  padding: 15px 20px;
}

.el-button-group {
  margin-left: 10px;
}

.el-button-group .el-button {
  margin-left: 0;
}

.urgent-time {
  color: #f56c6c;
  font-weight: bold;
}

:deep(.el-table__row) {
  &.urgent-row {
    background-color: #fef0f0 !important;
  }
}

:deep(.urgent-notification) {
  background-color: #fef0f0;
  border: 1px solid #f56c6c;
  padding: 16px;
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,.1);
  
  .el-notification__title {
    color: #f56c6c;
    font-size: 18px;
    font-weight: bold;
  }
  
  .el-notification__content {
    margin-top: 8px;
  }
}
</style> 