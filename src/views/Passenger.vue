<template>
  <div class="passenger">
    <h2>重点旅客历史记录</h2>
    
    <el-table :data="passengerStore.getAllPassengers()" style="width: 100%; margin-top: 20px">
      <el-table-column prop="id" label="序号" width="80" />
      <el-table-column prop="date" label="日期" />
      <el-table-column prop="trainNo" label="车次" />
      <el-table-column prop="name" label="姓名" />
      <el-table-column prop="type" label="类别">
        <template #default="{ row }">
          <el-tag :type="getTypeTagType(row.type)">{{ row.type }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="service" label="服务" />
      <el-table-column label="开检时间">
        <template #default="scope">
          {{ getTicketTime(scope.row.trainNo) }}
        </template>
      </el-table-column>
      <el-table-column prop="companions" label="同行人数" />
      <el-table-column prop="cardNo" label="牌号" />
      <el-table-column prop="remark" label="备注" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.isServed ? 'success' : 'info'">
            {{ row.isServed ? '已服务' : '未服务' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="scope">
          <el-button size="small" type="danger" @click="handleDelete(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { usePassengerStore } from '../store/passenger'
import { useTrainStore } from '../store/train'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { Passenger } from '../types/passenger'
import { PassengerType, PageType } from '../types/passenger'

const passengerStore = usePassengerStore()
const trainStore = useTrainStore()

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

const handleDelete = (row: Passenger) => {
  ElMessageBox.confirm('确认删除该旅客信息？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    passengerStore.deletePassenger(row.id)
    ElMessage.success('删除成功')
  })
}

// 获取车次的开检时间
const getTicketTime = (trainNo: string): string => {
  const train = trainStore.getTrainByNo(trainNo)
  return train ? train.ticketTime : ''
}
</script>

<style scoped>
.passenger {
  padding: 20px;
}
</style> 