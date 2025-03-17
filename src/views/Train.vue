<template>
  <div class="train">
    <h2>车次信息管理</h2>
    <el-upload
      class="upload-demo"
      action="#"
      :auto-upload="false"
      :on-change="handleFileChange"
      accept=".xlsx,.xls">
      <template #trigger>
        <el-button type="primary">选择Excel文件</el-button>
      </template>
      <el-button class="ml-3" type="success" @click="handleImport">
        导入数据
      </el-button>
    </el-upload>

    <el-table :data="trainStore.trainList" style="width: 100%; margin-top: 20px">
      <el-table-column prop="id" label="序号" width="80" />
      <el-table-column prop="bureau" label="担当局" />
      <el-table-column prop="trainNo" label="车次" />
      <el-table-column prop="route" label="运行区间" />
      <el-table-column prop="arrivalTime" label="到点" />
      <el-table-column prop="departureTime" label="开点" />
      <el-table-column prop="track" label="股道" />
      <el-table-column prop="platform" label="站台" />
      <el-table-column prop="stopTime" label="站停" />
      <el-table-column prop="trainType" label="车型" />
      <el-table-column prop="capacity" label="定员" />
      <el-table-column prop="formation" label="编组" />
      <el-table-column prop="ticketGate" label="检票口" />
      <el-table-column prop="ticketTime" label="开检时间" />
      <el-table-column prop="ticketStaffTime" label="检票上岗时间" />
      <el-table-column prop="platformStaffTime" label="站台上岗时间" />
      <el-table-column prop="foldingTime" label="立折时间" />
      <el-table-column prop="waterService" label="给水作业" />
      <el-table-column prop="sewageService" label="吸污" />
      <el-table-column prop="luggageService" label="行包作业" />
      <el-table-column prop="remark" label="备注" />
    </el-table>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import * as XLSX from 'xlsx'
import { useTrainStore } from '../store/train'
import { ElMessage } from 'element-plus'

const trainStore = useTrainStore()
const fileList = ref([])

// 添加时间格式处理函数
const formatTime = (value) => {
  if (!value) return ''
  
  // 如果已经是正确的时间格式，直接返回
  if (typeof value === 'string' && value.includes(':')) {
    return value
  }
  
  // 处理Excel中的时间数值
  if (typeof value === 'number') {
    const totalMinutes = Math.round(value * 24 * 60)
    const hours = Math.floor(totalMinutes / 60) % 24
    const minutes = totalMinutes % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }
  
  return ''
}

const handleFileChange = (file) => {
  fileList.value = [file]
}

const handleImport = () => {
  if (fileList.value.length === 0) {
    ElMessage.warning('请先选择文件')
    return
  }

  const file = fileList.value[0].raw
  const reader = new FileReader()

  reader.onload = (e) => {
    try {
      const data = e.target.result
      const workbook = XLSX.read(data, { type: 'array' })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { range: 1 })
      
      console.log('Excel原始数据:', jsonData)
      
      // 处理Excel数据，确保字段名称匹配
      const processedData = jsonData.map(item => {
        console.log('处理单行数据:', item)
        return {
          bureau: item['担当局'] || '',
          trainNo: item['车次'] || '',
          route: item['运行区间'] || '',
          arrivalTime: formatTime(item['到点']),
          departureTime: formatTime(item['开点']),
          track: item['股道'] || '',
          platform: item['站台'] || '',
          stopTime: formatTime(item['站停']),
          trainType: item['车型'] || '',
          capacity: item['定员'] || '',
          formation: item['编组'] || '',
          ticketGate: item['检票口'] || '',
          ticketTime: formatTime(item['开检时间']),
          ticketStaffTime: formatTime(item['检票上岗时间']),
          platformStaffTime: formatTime(item['站台上岗时间']),
          foldingTime: formatTime(item['立折时间']),
          waterService: item['给水作业'] || '',
          sewageService: item['吸污'] || '',
          luggageService: item['行包作业'] || '',
          remark: item['备注'] || ''
        }
      })

      console.log('处理后的数据:', processedData)

      trainStore.addTrains(processedData)
      ElMessage.success('数据导入成功')
    } catch (error) {
      console.error('导入失败:', error)
      ElMessage.error('数据导入失败，请检查文件格式是否正确')
    }
  }

  reader.readAsArrayBuffer(file)
}
</script>

<style scoped>
.train {
  padding: 20px;
}

.upload-demo {
  margin-bottom: 20px;
}

.el-table {
  margin-top: 20px;
}
</style> 