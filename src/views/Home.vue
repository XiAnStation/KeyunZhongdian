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
          
          <el-table :data="todayPassengers" style="width: 100%">
            <el-table-column prop="trainNo" label="车次" width="120" />
            <el-table-column prop="name" label="姓名" width="120" />
            <el-table-column prop="type" label="类别" width="120">
              <template #default="{ row }">
                <el-tag :type="getTypeTagType(row.type)">{{ row.type }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="service" label="服务" />
            <el-table-column prop="companions" label="同行人数" width="100" align="center" />
            <el-table-column label="操作" width="200" fixed="right">
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
import { ref, computed, onMounted } from 'vue'
import { usePassengerStore } from '../store/passenger'
import { useTrainStore } from '../store/train'
import { useRouter } from 'vue-router'

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

// 获取今日旅客
const todayPassengers = computed(() => {
  const today = new Date().toISOString().split('T')[0]
  return passengerStore.passengerList.filter(p => p.date === today)
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

// 页面加载时更新时间
onMounted(() => {
  setInterval(() => {
    currentTime.value = new Date().toLocaleDateString()
  }, 60000) // 每分钟更新一次
})
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
</style> 