<template>
  <div class="home">
    <el-row>
      <el-col :span="24">
        <!-- 今日待办卡片 -->
        <el-card class="welcome-card">
          <template #header>
            <div class="welcome-header">
              <span>今日待办</span>
              <div class="time-info">
                <el-tag type="success" class="time-tag">
                  <el-icon><Calendar /></el-icon>
                  {{ new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) }}
                </el-tag>
              </div>
            </div>
          </template>
          <div class="welcome-content">
            <div class="time-display">
              <div class="current-time">{{ currentTime }}</div>
            </div>
            <el-row :gutter="20">
              <el-col :span="12">
                <el-statistic title="剩余重点旅客数" :value="passengerCount">
                  <template #prefix>
                    <el-icon><User /></el-icon>
                  </template>
                </el-statistic>
              </el-col>
              <el-col :span="12">
                <el-statistic title="已服务重点旅客数" :value="servedCount">
                  <template #prefix>
                    <el-icon><Check /></el-icon>
                  </template>
                </el-statistic>
              </el-col>
            </el-row>
          </div>
        </el-card>

        <!-- 开检提醒卡片 -->
        <el-card class="notification-card" style="margin-top: 20px;">
          <template #header>
            <div class="notification-header">
              <div class="notification-title">
                <el-icon><Bell /></el-icon>
                开检提醒
              </div>
              <div class="notification-actions">
                <el-dropdown v-if="audioDevices.length > 0" @command="handleSelectDevice" trigger="click">
                  <el-button type="primary" size="small" :loading="loadingDevices">
                    <span v-if="speakerStatus.currentDevice">
                      {{ speakerStatus.currentDevice }}
                    </span>
                    <span v-else>选择音频设备</span>
                    <el-icon class="el-icon--right"><arrow-down /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item v-for="device in audioDevices" :key="device.deviceId" :command="device.deviceId">
                        {{ device.label }}
                      </el-dropdown-item>
                      <el-dropdown-item divided command="refresh">
                        <el-icon><Refresh /></el-icon> 刷新设备列表
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
                <el-button type="success" size="small" @click="handleConnectSpeaker" :loading="loadingDevices">
                  {{ speakerStatus.connected ? '已连接喇叭' : '连接喇叭' }}
                </el-button>
                <el-button 
                  type="primary" 
                  size="small"
                  :disabled="!speakerStatus.connected" 
                  @click="announcementDialogVisible = true">
                  自定义播报
                </el-button>
              </div>
            </div>
          </template>
          <div class="notification-content">
            <div class="empty-data"></div>
          </div>
        </el-card>

        <!-- 重点旅客登记表格 -->
        <el-card style="margin-top: 20px;">
          <template #header>
            <div class="card-header">
              <span>重点旅客登记</span>
              <div class="button-group">
                <el-upload
                  class="upload-demo"
                  action="#"
                  :auto-upload="false"
                  :on-change="handleFileChange"
                  :show-file-list="false"
                  accept=".xlsx,.xls">
                  <el-button type="primary">
                    <el-icon><Upload /></el-icon>
                    导入Excel
                  </el-button>
                </el-upload>
                <el-button type="success" @click="handleAdd">
                  <el-icon><Plus /></el-icon>
                  添加旅客
                </el-button>
              </div>
            </div>
          </template>
          
          <el-table 
            :data="paginatedPassengers" 
            v-bind="tableConfig"
            :row-class-name="getRowClassName"
            :stripe="false"
            :highlight-current-row="false"
            style="--el-table-row-hover-bg-color: inherit;">
            <template #empty>
              <el-empty description="今日暂无旅客数据" />
            </template>
            <el-table-column prop="date" label="日期" min-width="100">
              <template #default="scope">
                <span :style="scope.row.isNearTicket ? 'background-color: #FFD700; color: #333; font-weight: bold; padding: 4px 8px; border-radius: 4px;' : ''">
                  {{ formatDisplayDate(scope.row.date) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="trainNo" label="车次" min-width="100" />
            <el-table-column prop="name" label="姓名" min-width="100" />
            <el-table-column prop="phone" label="联系电话" min-width="130" />
            <el-table-column prop="service" label="服务" min-width="120" />
            <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
            <el-table-column prop="companions" label="同行人数" min-width="100">
              <template #default="scope">
                <span>{{ scope.row.companions || 0 }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="cardNo" label="牌号" min-width="100">
              <template #default="scope">
                <div 
                  class="card-no-cell" 
                  @click="handleCardNoClick(scope.row)"
                  :class="{ 'empty-card-no': !scope.row.cardNo }"
                >
                  {{ scope.row.cardNo || '添加牌号' }}
                </div>
              </template>
            </el-table-column>
            <el-table-column label="开检时间" min-width="120">
              <template #default="scope">
                <el-popover
                  placement="right"
                  :width="200"
                  trigger="click"
                  v-if="scope.row.trainNo && getTrainTypeAndRemindTime(scope.row.trainNo).type !== '终到车'"
                  @show="initTempTicketTime(scope.row.trainNo)">
                  <template #reference>
                    <div class="time-box">
                      {{ getTicketTime(scope.row.trainNo) || '无' }}
                    </div>
                  </template>
                  <div class="time-input-container">
                    <div class="time-inputs">
                      <el-input-number 
                        v-model="tempTicketTimes[scope.row.trainNo + '_hour']" 
                        :min="0" 
                        :max="23" 
                        size="small"
                        controls-position="right"
                        placeholder="时"
                        style="width: 70px;"
                        :formatter="formatHourDisplay"
                      />
                      <span class="time-separator">:</span>
                      <el-input-number 
                        v-model="tempTicketTimes[scope.row.trainNo + '_minute']" 
                        :min="0" 
                        :max="59" 
                        size="small"
                        controls-position="right"
                        placeholder="分"
                        style="width: 70px;"
                        :formatter="formatMinuteDisplay"
                      />
                    </div>
                    <div class="time-actions">
                      <el-button 
                        type="primary" 
                        size="small"
                        @click="confirmTicketTimeChange(scope.row.trainNo)">
                        确认
                      </el-button>
                    </div>
                  </div>
                </el-popover>
                <div v-else class="time-box terminal-train">
                  {{ getArrivalTime(scope.row.trainNo) }} 终到车
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="staffName" label="服务人员" min-width="120" />
            <el-table-column label="操作" min-width="280" fixed="right">
              <template #default="scope">
                <el-button-group>
                  <el-button size="small" @click="showTrainInfo(scope.row.trainNo)">
                    车次信息
                  </el-button>
                  <el-button 
                    size="small" 
                    type="primary"
                    @click="handleEdit(scope.row)">
                    编辑
                  </el-button>
                  <el-button 
                    size="small" 
                    type="success"
                    :disabled="scope.row.isServed"
                    @click="handleMarkAsLeft(scope.row)">
                    离厅
                  </el-button>
                  <el-button 
                    size="small" 
                    type="warning"
                    :disabled="!speakerStatus.connected || scope.row.isServed"
                    @click="handleAnnounce(scope.row)">
                    <el-icon><Microphone /></el-icon>
                    <el-tooltip content="播报开检提醒" placement="top">
                      <span></span>
                    </el-tooltip>
                  </el-button>
                </el-button-group>
              </template>
            </el-table-column>
          </el-table>

          <!-- 分页器 -->
          <div class="pagination-container">
            <el-pagination
              v-model:current-page="currentPage"
              v-model:page-size="pageSize"
              :page-sizes="[10, 15, 30, 50]"
              :total="todayPassengers.length"
              layout="total, sizes, prev, pager, next, jumper"
              @size-change="handleSizeChange"
              @current-change="handleCurrentChange"
            />
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 保持其他对话框组件不变 -->
    <el-dialog 
      v-model="dialogVisible" 
      title="车次详细信息"
      width="800px">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="车次">{{ currentTrain?.trainNo }}</el-descriptions-item>
        <el-descriptions-item label="担当局">{{ currentTrain?.bureau }}</el-descriptions-item>
        <el-descriptions-item label="运行区间1">{{ currentTrain?.route }}</el-descriptions-item>
        <el-descriptions-item label="运行区间2">{{ currentTrain?.route2 }}</el-descriptions-item>
        <el-descriptions-item label="到点">{{ currentTrain?.arrivalTime }}</el-descriptions-item>
        <el-descriptions-item label="开点">{{ currentTrain?.departureTime }}</el-descriptions-item>
        <el-descriptions-item label="股道">{{ currentTrain?.track }}</el-descriptions-item>
        <el-descriptions-item label="站台">{{ currentTrain?.platform }}</el-descriptions-item>
        <el-descriptions-item label="站停">{{ currentTrain?.stopTime }}</el-descriptions-item>
        <el-descriptions-item label="开检时间">{{ currentTrain?.ticketTime || getTicketTime(currentTrain?.trainNo || '') }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <el-dialog 
      v-model="addDialogVisible" 
      :title="isEdit ? '编辑旅客' : '新增旅客'"
      width="600px">
      <el-form 
        :model="form" 
        :rules="rules"
        ref="formRef"
        label-width="100px">
        <el-form-item label="日期" prop="date">
          <el-date-picker 
            v-model="form.date" 
            type="date" 
            placeholder="选择日期"
            value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="车次" prop="trainNo">
          <el-select 
            v-model="form.trainNo" 
            placeholder="请选择车次"
            filterable>
            <el-option
              v-for="train in trainStore.trainList"
              :key="train.trainNo"
              :label="train.trainNo"
              :value="train.trainNo"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="服务" :required="false">
          <el-select v-model="form.service" placeholder="请选择服务类型" style="width: 100%" clearable>
            <el-option label="引导" value="引导" />
            <el-option label="提供轮椅" value="提供轮椅" />
            <el-option label="提供担架" value="提供担架" />
            <el-option label="盲人" value="盲人" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="联系电话" prop="phone">
          <el-input v-model="form.phone" />
        </el-form-item>
        <el-form-item label="服务人员" prop="staffName">
          <el-select 
            v-model="form.staffName" 
            placeholder="请选择服务工作人员"
            filterable
            default-first-option
            style="width: 100%">
            <el-option
              v-for="staff in staffStore.getActiveStaffList()"
              :key="staff.staffNo"
              :label="staff.label"
              :value="staff.value">
              <div style="display: flex; justify-content: space-between; align-items: center">
                <span style="font-size: 14px">{{ staff.value }}</span>
                <span style="color: #909399; font-size: 12px">
                  {{ staff.staffNo }} - {{ staff.team }}
                </span>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="同行人数" prop="companions">
          <el-input-number v-model="form.companions" :min="0" />
        </el-form-item>
        <el-form-item label="牌号" prop="cardNo">
          <el-input v-model="form.cardNo" />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="form.remark" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="addDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSubmit">确定</el-button>
        </span>
      </template>
    </el-dialog>

    <el-dialog
      v-model="announcementDialogVisible"
      title="自定义播报"
      width="500px">
      <el-form>
        <el-form-item label="播报内容">
          <el-input
            v-model="customAnnouncementText"
            type="textarea"
            :rows="4"
            placeholder="请输入自定义播报内容"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="announcementDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleCustomAnnounce">
            播报
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { useHome } from '../composables/useHome'
import { useTrainStore } from '../store/train'
import { useStaffStore } from '../store/staff'
import { usePassengerStore } from '../store/passenger'
import { useAnnouncement } from '../composables/useAnnouncement'
import { Check, Plus, User, Bell, Upload, Refresh, ArrowDown, Loading, Microphone, Timer, Calendar } from '@element-plus/icons-vue'
import * as XLSX from 'xlsx'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { UploadFile } from 'element-plus'
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch, onBeforeUnmount } from 'vue'
import type { Passenger, PassengerForm } from '../types/passenger'

const trainStore = useTrainStore()
const staffStore = useStaffStore()
const passengerStore = usePassengerStore()
const { 
  speakerStatus, 
  audioDevices, 
  loadingDevices,
  getAudioDevices, 
  connectSpeaker, 
  connectSpecificSpeaker, 
  disconnectSpeaker, 
  announceTicketCheck, 
  announceCustom 
} = useAnnouncement()

const useHomeReturn = useHome()

const {
  currentTime = ref(''),
  dialogVisible = ref(false),
  currentTrain = ref(null),
  passengerCount = ref(0),
  servedCount = ref(0),
  todayPassengers = ref([]),
  addDialogVisible = ref(false),
  formRef = ref(),
  form,
  rules = {},
  isEdit = ref(false),
  showTrainInfo = () => {},
  getTypeTagType = () => '',
  getRowClassName = ({ row }: { row: Passenger }): string => {
    // 如果是离厅旅客，显示灰色
    if (row.isServed) {
      return 'left-row'
    }
    
    try {
      // 获取当前日期
      const now = new Date()
      const today = now.toISOString().split('T')[0]
      
      // 判断是否已过期（包括终到车）
      const isExpired = isExpiredTicketTime(row.trainNo, row.date)
      if (isExpired) {
        return 'expired-row'
      }
      
      // 如果开检/到站时间临近，显示黄色警告
      // 但对于非当天日期的车次，不应标记为临近
      if (row.date === today && isNearTicketTime(row.trainNo, row.date)) {
        return 'near-row'
      }
      
      // 特殊处理次日凌晨车次
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = tomorrow.toISOString().split('T')[0]
      
      if (row.date === tomorrowStr && isEarlyMorningTicketTime(row.trainNo)) {
        // 次日凌晨车次不应标记为临近，除非已到今日深夜
        const currentHour = now.getHours()
        // 只有在当前时间为21点以后才可能标记为临近（通常凌晨0点车次会在前一天晚上21点左右开始准备）
        if (currentHour >= 21 && isNearTicketTime(row.trainNo, row.date)) {
          return 'near-row'
        }
      }
    } catch (error) {
      console.error('计算行颜色状态出错:', error, row.trainNo)
    }
    
    return ''
  },
  handleAdd = () => {},
  handleEdit = () => {},
  handleSubmit: originalHandleSubmit = () => {},
  getTicketTime = () => '',
  handleFileChange = async (uploadFile: UploadFile) => {
    try {
      const file = uploadFile.raw
      if (!file) {
        ElMessage.error('文件不存在')
        return
      }

      // 检查文件类型
      if (!file.type.includes('sheet') && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        ElMessage.error('只支持Excel文件格式(.xlsx, .xls)')
        return
      }

      // 读取Excel文件
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const data = e.target?.result
          const workbook = XLSX.read(data, { type: 'array' })
          const firstSheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[firstSheetName]
          
          // 将Excel数据转换为JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet)
          
          if (jsonData.length === 0) {
            ElMessage.warning('Excel文件中没有数据')
            return
          }

          console.log('Excel数据:', jsonData)
          
          // 获取所有现有旅客数据用于查重
          const existingPassengers = passengerStore.getAllPassengers()
          console.log('现有旅客数据:', existingPassengers)
          
          // 处理每一行数据
          const passengers: Passenger[] = []
          const today = new Date().toISOString().split('T')[0]
          let skippedCount = 0
          let updatedCount = 0
          
          for (const row of jsonData as Record<string, any>[]) {
            try {
              // 构造旅客数据
              const passenger: Passenger = {
                id: Date.now() + Math.random(), // 生成唯一ID
                date: parseExcelDate(row['日期'] || row['date'] || today),
                trainNo: (row['车次'] || row['trainNo'] || '').toString().trim(),
                name: (row['姓名'] || row['name'] || '').toString().trim(),
                phone: (row['联系电话'] || row['phone'] || '').toString().trim(),
                service: (row['服务'] || row['service'] || '').toString().trim(),
                staffName: (row['服务人员'] || row['staffName'] || '').toString().trim(),
                companions: parseInt(row['同行人数'] || row['companions'] || '0'),
                cardNo: (row['牌号'] || row['cardNo'] || '').toString().trim(),
                remark: (row['备注'] || row['remark'] || '').toString().trim(),
                isServed: false,
                source: 'online'
              }

              // 验证必要字段
              if (!passenger.trainNo || !passenger.name) {
                console.warn('跳过无车次或姓名的数据:', row)
                continue
              }

              // 检查是否存在重复旅客（相同姓名、日期和车次）
              const existingPassenger = existingPassengers.find(p => 
                p.name === passenger.name && 
                p.date === passenger.date && 
                p.trainNo === passenger.trainNo
              )

              if (existingPassenger) {
                console.log('找到重复旅客:', existingPassenger)
                // 如果备注不同，更新备注
                if (existingPassenger.remark !== passenger.remark && passenger.remark) {
                  await passengerStore.updatePassenger(existingPassenger.id, {
                    ...existingPassenger,
                    remark: passenger.remark
                  })
                  updatedCount++
                  console.log('更新旅客备注:', passenger.name, passenger.trainNo)
                } else {
                  skippedCount++
                  console.log('跳过重复旅客:', passenger.name, passenger.trainNo)
                }
                continue
              }

              console.log('添加新旅客:', passenger)
              passengers.push(passenger)
            } catch (error) {
              console.error('处理Excel行数据出错:', error, row)
            }
          }

          if (passengers.length === 0 && skippedCount === 0 && updatedCount === 0) {
            ElMessage.warning('没有有效的旅客数据可以导入')
            return
          }

          // 批量添加新旅客数据
          console.log('准备添加旅客数据:', passengers)
          for (const passenger of passengers) {
            try {
              await passengerStore.addPassenger(passenger)
            } catch (error) {
              if (error instanceof Error && error.message === '重复旅客') {
                skippedCount++
                console.log('跳过重复旅客:', passenger.name, passenger.trainNo)
                
                // 检查是否需要更新备注
                const existingPassenger = passengerStore.getAllPassengers().find(p => 
                  p.name === passenger.name && 
                  p.date === passenger.date && 
                  p.trainNo === passenger.trainNo
                )
                
                if (existingPassenger && existingPassenger.remark !== passenger.remark && passenger.remark) {
                  await passengerStore.updatePassenger(existingPassenger.id, {
                    ...existingPassenger,
                    remark: passenger.remark
                  })
                  updatedCount++
                  console.log('更新旅客备注:', passenger.name, passenger.trainNo)
                }
              } else {
                console.error('添加旅客失败:', error)
                ElMessage.error(`添加旅客 ${passenger.name} 失败`)
              }
            }
          }

          // 强制更新显示
          console.log('开始更新显示...')
          todayPassengers.value = passengerStore.getPassengersByDate(today)
          await nextTick()
          
          // 更新统计和样式
          updateStatistics()
          debouncedUpdateStyles()
          lastRefreshTime.value = new Date()

          // 显示导入结果
          let message = `成功导入 ${passengers.length - skippedCount} 条新数据`
          if (skippedCount > 0) {
            message += `，跳过 ${skippedCount} 条重复数据`
          }
          if (updatedCount > 0) {
            message += `，更新 ${updatedCount} 条备注`
          }
          ElMessage.success(message)
          
          // 输出当前状态以便调试
          console.log('导入后的旅客列表:', todayPassengers.value)
          console.log('Store中的旅客列表:', passengerStore.getAllPassengers())
        } catch (error) {
          console.error('处理Excel数据失败:', error)
          ElMessage.error('处理Excel数据失败，请检查文件格式是否正确')
        }
      }

      reader.onerror = () => {
        ElMessage.error('读取文件失败')
      }

      reader.readAsArrayBuffer(file)
    } catch (error) {
      console.error('导入Excel失败:', error)
      ElMessage.error('导入Excel失败，请重试')
    }
  },
  checkAndNotify = () => {},
  updateTodayPassengers = async () => {},
  updateStatistics = () => {},
  handleTicketTimeChange = async (trainNo: string, timeString: string) => {
    try {
      // 调用useHome中的方法修改开检时间（已包含缓存清除和更新）
      const useHomeMethod = useHomeReturn?.handleTicketTimeChange
      if (typeof useHomeMethod === 'function') {
        useHomeMethod(trainNo, timeString)
      } else {
        // 作为备用，仍然执行原来的更新逻辑
        trainStore.updateTrainTicketTime(trainNo, timeString)

        // 判断是否成为凌晨车次 (0:00-1:00)
        const [hours] = timeString.split(':').map(Number)
        const isEarlyMorning = hours >= 0 && hours < 1
        
        // 处理车次相关逻辑
        if (isEarlyMorning) {
          console.log(`车次 ${trainNo} 的开检时间已更新为凌晨 ${timeString}，重新计算列表...`)
        }
        
        // 强制刷新数据
        await updateTodayPassengers(true)
        
        // 获取更新后的旅客列表和受影响的旅客处理
        // 这部分逻辑保留原样...
      }
      
      // 无论哪种方式更新，都强制立即更新样式
      nextTick(() => {
        // 立即更新样式，不使用防抖
        updateRowStyles()
        
        // 更新刷新时间
        lastRefreshTime.value = new Date()
      })
    } catch (error) {
      console.error('更新开检时间失败:', error)
      ElMessage.error('更新开检时间失败')
    }
  },
  isNearTicketTime = (trainNo: string, date?: string): boolean => {
    // 使用useHome中的函数
    const useHomeMethod = useHomeReturn?.isNearTicketTime
    if (typeof useHomeMethod === 'function') {
      return useHomeMethod(trainNo, date)
    }
    // 如果无法调用useHome中的函数，使用一个简单实现
    try {
      // 获取开检时间
      const ticketTimeStr = getTicketTime(trainNo)
      if (!ticketTimeStr) return false
      
      // 提取小时和分钟
      const [hours, minutes] = ticketTimeStr.split(':').map(Number)
      
      // 构建日期时间对象
      const currentDate = new Date()
      const today = currentDate.toISOString().split('T')[0]
      
      // 如果提供了日期且不是今天，需要特殊处理
      if (date && date !== today) {
        return false
      }
      
      // 创建对比时间
      let ticketTime = new Date()
      ticketTime.setHours(hours, minutes, 0, 0)
      
      // 计算时间差(分钟)
      const timeDiff = ticketTime.getTime() - currentDate.getTime()
      const minuteDiff = timeDiff / (1000 * 60)
      
      // 使用固定的临近阈值(30分钟)
      return minuteDiff >= 0 && minuteDiff <= 30
    } catch (error) {
      console.error('判断车次临近开检失败:', error, trainNo)
      return false
    }
  },
  isExpiredTicketTime = (trainNo: string, date?: string): boolean => {
    // 使用useHome中的函数
    const useHomeMethod = useHomeReturn?.isExpiredTicketTime
    if (typeof useHomeMethod === 'function') {
      return useHomeMethod(trainNo, date)
    }
    // 如果无法调用useHome中的函数，使用一个简单实现
    try {
      const ticketTimeStr = getTicketTime(trainNo)
      if (!ticketTimeStr) return false
      
      const [hours, minutes] = ticketTimeStr.split(':').map(Number)
      const now = new Date()
      const ticketTime = new Date()
      ticketTime.setHours(hours, minutes, 0, 0)
      
      return now.getTime() > ticketTime.getTime()
    } catch (error) {
      console.error('判断车次过期失败:', error, trainNo)
      return false
    }
  },
  isEarlyMorningTicketTime = (trainNo: string): boolean => {
    // 使用useHome中的函数
    const useHomeMethod = useHomeReturn?.isEarlyMorningTicketTime
    if (typeof useHomeMethod === 'function') {
      return useHomeMethod(trainNo)
    }
    // 如果无法调用useHome中的函数，使用一个简单实现
    try {
      const ticketTimeStr = getTicketTime(trainNo)
      if (!ticketTimeStr) return false
      
      const [hours] = ticketTimeStr.split(':').map(Number)
      return hours >= 0 && hours <= 2
    } catch (error) {
      console.error('判断是否为凌晨车次失败:', error, trainNo)
      return false
    }
  },
  handleCardNoChange = () => {},
  showSetArrivalTimeDialog = (trainNo: string) => {
    // 调用useHome中的方法
    const useHomeMethod = useHomeReturn?.showSetArrivalTimeDialog
    if (typeof useHomeMethod === 'function') {
      useHomeMethod(trainNo)
    } else {
      // 作为备用，显示一个标准的输入对话框
      ElMessageBox.prompt('请输入新的到站时间 (HH:mm格式)', '修改到站时间', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPattern: /^([01]\d|2[0-3]):([0-5]\d)$/,
        inputErrorMessage: '请输入有效的时间格式 (HH:mm)',
        inputValue: trainStore.getTrainByNo(trainNo)?.arrivalTime || ''
      }).then(({ value }) => {
        if (value && trainNo) {
          trainStore.updateTrainArrivalTime(trainNo, value)
          // 强制刷新
          updateTodayPassengers(true)
          // 立即更新样式
          nextTick(() => {
            updateRowStyles()
          })
          // 成功提示
          ElMessage.success(`已更新${trainNo}列车到站时间为${value}`)
        }
      }).catch(() => {
        // 用户取消，不做处理
      })
    }
  },
  getTrainTypeAndRemindTime = () => ({ type: '', remindMinutes: 0 }),
  setStyleUpdateCallback = () => {}
} = useHomeReturn || {}

// 播报对话框相关数据
const announcementDialogVisible = ref(false)
const customAnnouncementText = ref('')

// 定时器相关变量
let checkTimer: ReturnType<typeof setInterval> | null = null
const timerInterval = 10000 // 10秒
let autoRefreshTimer: ReturnType<typeof setInterval> | null = null
let colorRefreshTimer: ReturnType<typeof setInterval> | null = null

// 刷新时间相关
const lastRefreshTime = ref(new Date())
const formattedLastRefreshTime = computed(() => {
  const now = new Date()
  const diffSeconds = Math.floor((now.getTime() - lastRefreshTime.value.getTime()) / 1000)
  
  if (diffSeconds < 60) {
    return `${diffSeconds}秒前`
  } else if (diffSeconds < 3600) {
    return `${Math.floor(diffSeconds / 60)}分钟前`
  } else {
    return `${Math.floor(diffSeconds / 3600)}小时前`
  }
})

// 统一的样式更新函数
const updateRowStyles = () => {
  console.log('开始更新样式，当前旅客数据:', todayPassengers.value)
  
  // 检查当前是否在旅客信息页面
  const currentPath = window.location.pathname
  if (currentPath.includes('/passenger') || currentPath.includes('/passengers')) {
    console.log('当前在旅客信息页面，不应用变色样式')
    return
  }
  
  // 使用 Vue nextTick 确保在 DOM 更新后执行
  nextTick(() => {
    const table = document.querySelector('.el-table__body-wrapper table')
    if (!table) {
      console.log('未找到表格元素')
      return
    }
    
    // 获取所有行，使用 tbody > tr 确保只获取数据行
    const rows = table.querySelectorAll('tbody > tr')
    if (!rows.length) {
      console.log('未找到表格行')
      return
    }
    
    // 确保数据和行数匹配
    if (rows.length !== todayPassengers.value.length) {
      console.log(`行数(${rows.length})与数据数量(${todayPassengers.value.length})不匹配，等待下一次更新`)
      // 在数据和行数不匹配时，不应用样式，避免错误
      return
    }
    
    // 首先移除所有行的样式类
    rows.forEach(row => {
      row.classList.remove('near-row', 'expired-row', 'left-row')
      // 移除可能的内联样式
      ;(row as HTMLElement).style.backgroundColor = ''
    })
    
    // 获取当前时间，用于判断是否临近开检
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    const currentTimeInMinutes = currentHour * 60 + currentMinute
    
    // 批量更新样式
    todayPassengers.value.forEach((passenger, index) => {
      if (index >= rows.length) {
        console.log(`索引 ${index} 超出表格行数 ${rows.length}`)
        return
      }
      
      const row = rows[index] as HTMLElement
      console.log(`处理第 ${index + 1} 行，旅客信息:`, passenger)
      
      // 判断是否为离厅旅客
      if (passenger.isServed) {
        console.log(`旅客 ${passenger.name} 已离厅，添加离厅样式`)
        row.classList.add('left-row')
        return
      }
      
      // 获取车次类型和提醒时间
      const { type: trainType, remindMinutes } = getTrainTypeAndRemindTime(passenger.trainNo)
      
      // 首先通过isExpiredTicketTime函数判断是否过期
      // 这是确定是否标红的唯一标准，保持与排序算法的一致性
      const shouldMarkRed = isExpiredTicketTime(passenger.trainNo, passenger.date)
      console.log(`车次 ${passenger.trainNo} 是否过期: ${shouldMarkRed}`)
      
      // 如果没有过期，判断是否临近开检/到站时间，添加黄色样式
      if (!shouldMarkRed) {
        // 判断是否临近开检/到站时间
        if (isNearTicketTime(passenger.trainNo, passenger.date)) {
          console.log(`车次 ${passenger.trainNo} 临近开检/到站，添加黄色样式`)
          row.classList.add('near-row')
          
          // 添加内联样式确保显示效果
          row.style.backgroundColor = '#FFD700';
          row.style.fontWeight = '700';
          row.style.color = '#333';
          
          // 强制设置所有单元格的样式
          const cells = row.querySelectorAll('td');
          cells.forEach(cell => {
            (cell as HTMLElement).style.backgroundColor = '#FFD700';
            (cell as HTMLElement).style.fontWeight = '700';
            (cell as HTMLElement).style.color = '#333';
          });
        }
      }
      
      // 应用红色样式（如果需要）
      if (shouldMarkRed) {
        row.classList.add('expired-row')
        console.log(`车次 ${passenger.trainNo} 添加红色样式`)
        
        // 特别处理终到车
        if (trainType === '终到车') {
          // 移除可能导致闪烁的类
          row.classList.remove('near-row')
          
          // 专门为终到车添加内联样式，强制覆盖所有其他样式
          row.style.backgroundColor = '#fef0f0';
          row.style.color = '#f56c6c';
          row.style.animation = 'none';
          
          // 特殊处理K213, T231, D6852这几个车次
          if (['K213', 'T231', 'D6852', 'G657'].includes(passenger.trainNo)) {
            // 获取该行所有单元格并设置样式
            const cells = row.querySelectorAll('td');
            cells.forEach(cell => {
              (cell as HTMLElement).style.backgroundColor = '#fef0f0';
              (cell as HTMLElement).style.animation = 'none';
              (cell as HTMLElement).style.transition = 'none';
            });
            
            // 特别处理显示"终到车"的单元格
            const terminalCell = row.querySelector('.terminal-train');
            if (terminalCell) {
              (terminalCell as HTMLElement).style.backgroundColor = '#fef0f0';
              (terminalCell as HTMLElement).style.color = '#f56c6c';
              (terminalCell as HTMLElement).style.borderColor = '#fbc4c4';
              (terminalCell as HTMLElement).style.animation = 'none';
              (terminalCell as HTMLElement).style.transition = 'none';
            }
          }
          
          console.log(`终到车 ${passenger.trainNo} 移除黄色样式，添加内联红色样式`)
        }
      }
    })
  })
}

// 防抖处理样式更新
const debouncedUpdateStyles = (() => {
  let timeout: number | null = null
  return () => {
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = window.setTimeout(() => {
      console.log('执行防抖后的样式更新')
      updateRowStyles()
    }, 200)
  }
})()

// 确保在数据更新后重新应用样式，添加延迟以等待数据稳定
watch(todayPassengers, () => {
  console.log('旅客数据发生变化，触发样式更新和开检提醒检查')
  // 增加稍长的延迟，确保数据稳定后再更新样式
  setTimeout(() => {
    debouncedUpdateStyles()
    // 数据变化时检查提醒
    checkNewAlerts()
    // 更新开检时间监听
    setupTicketTimeWatchers()
  }, 300)
}, { deep: true })

// 页面加载时尽快获取数据并初始化
onMounted(async () => {
  try {
    await getAudioDevices()
    
    // 获取旅客数据并优化数据加载策略
    console.log('初始化数据加载...')
    
    // 1. 异步更新统计数据，不阻塞UI渲染
    setTimeout(() => updateStatistics(), 0)
    
    // 2. 使用已有的本地数据先展示，减少初始加载等待时间
    todayPassengers.value = passengerStore.getPassengersByDate(new Date().toISOString().split('T')[0])
    console.log('初始化本地数据完成，当前旅客数量:', todayPassengers.value.length)
    
    // 3. 延迟检查提醒，避免页面初始化时的性能压力
    setTimeout(async () => {
      // 访问alertPassengers强制重新计算，确保提醒区域正确显示
      console.log('初始化开检提醒列表:', alertPassengers.value.length)
      await checkNewAlerts()
      debouncedUpdateStyles()
      console.log('完成初始提醒检查')
    }, 1500)
    
    // 4. 使用更合理的定时器间隔
    if (!checkTimer) {
      checkTimer = setInterval(async () => {
        await checkNewAlerts()
        debouncedUpdateStyles()
        // 强制访问一次alertPassengers，更新提醒区域
        console.log('定时检查提醒更新:', alertPassengers.value.length)
      }, timerInterval)
    }
    
    // 5. 延迟启动自动刷新
    setTimeout(() => {
      autoRefreshTimer = setInterval(async () => {
        await updateTodayPassengers()
        debouncedUpdateStyles()
        lastRefreshTime.value = new Date()
        // 更新数据后再次强制访问一次alertPassengers
        console.log('自动刷新后的提醒数量:', alertPassengers.value.length)
      }, 10000)
      
      console.log('自动刷新定时器已启动')
    }, 2000)
    
    // 6. 设置样式更新定时器
    colorRefreshTimer = setInterval(() => {
      if (todayPassengers.value.length > 0) {
        console.log('定时检查样式更新')
        debouncedUpdateStyles()
      }
    }, 2000)
    
    // 7. 监听表格变化
    const observer = new MutationObserver((mutations) => {
      console.log('检测到表格变化:', mutations)
      debouncedUpdateStyles()
    })
    
    // 8. 延迟启动观察器，确保表格已渲染
    setTimeout(() => {
      const tableContainer = document.querySelector('.el-table')
      if (tableContainer) {
        observer.observe(tableContainer, { 
          childList: true, 
          subtree: true,
          attributes: true 
        })
        console.log('表格变化监听器已启动')
        
        // 初始化样式
        debouncedUpdateStyles()
      }
    }, 2500)
    
    // 9. 监听路由变化，确保在路由切换时不显示颜色
    if (window.addEventListener) {
      window.addEventListener('popstate', () => {
        console.log('路由变化，检查是否需要应用样式')
        debouncedUpdateStyles()
      })
    }
    
    // 10. 添加开检提醒刷新定时器
    const alertRefreshTimer = setInterval(() => {
      // 强制重新计算alertPassengers，以便更新UI
      const currentAlerts = alertPassengers.value
      console.log('定时刷新开检提醒列表:', currentAlerts.length)
    }, 15000) // 每15秒刷新一次
    
    // 组件卸载时停止监听
    onUnmounted(() => {
      observer.disconnect()
      
      if (window.removeEventListener) {
        window.removeEventListener('popstate', debouncedUpdateStyles)
      }
      
      // 清除开检提醒刷新定时器
      if (typeof alertRefreshTimer !== 'undefined' && alertRefreshTimer) {
        clearInterval(alertRefreshTimer)
      }
    })
    
    // 其他原有代码...
  } catch (error) {
    console.error('初始化数据失败:', error)
    ElMessage.error('初始化数据失败，请刷新页面重试')
  }
})

// 在组件即将卸载前清除定时器和样式
onBeforeUnmount(() => {
  console.log('Home组件即将卸载，清除所有样式和定时器')
  
  // 清除定时器
  if (checkTimer) {
    clearInterval(checkTimer)
    checkTimer = null
  }
  
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
  
  if (colorRefreshTimer) {
    clearInterval(colorRefreshTimer)
    colorRefreshTimer = null
  }
  
  // 立即清理所有表格和单元格的样式
  const tables = document.querySelectorAll('.el-table')
  tables.forEach(table => {
    const rows = table.querySelectorAll('tr')
    rows.forEach(row => {
      row.classList.remove('near-row', 'expired-row', 'left-row')
      if (row instanceof HTMLElement) {
        row.style.cssText = ''
      }
      
      const cells = row.querySelectorAll('td')
      cells.forEach(cell => {
        if (cell instanceof HTMLElement) {
          cell.style.cssText = ''
        }
      })
    })
  })
})

// 临时存储开检时间
const tempTicketTimes = reactive<Record<string, any>>({})

// 初始化车次开检时间
const initTempTicketTime = (trainNo: string) => {
  if (trainNo) {
    const timeString = getTicketTime(trainNo) || ''
    if (timeString) {
      const [hours, minutes] = timeString.split(':').map(Number)
      tempTicketTimes[trainNo + '_hour'] = hours || 0
      tempTicketTimes[trainNo + '_minute'] = minutes || 0
    } else {
      // 默认值
      tempTicketTimes[trainNo + '_hour'] = 0
      tempTicketTimes[trainNo + '_minute'] = 0
    }
  }
}

// 修改处理时间变化的函数
const confirmTicketTimeChange = async (trainNo: string) => {
  try {
    const hours = tempTicketTimes[trainNo + '_hour'] || 0
    const minutes = tempTicketTimes[trainNo + '_minute'] || 0
    const formattedHours = hours.toString().padStart(2, '0')
    const formattedMinutes = minutes.toString().padStart(2, '0')
    const timeString = `${formattedHours}:${formattedMinutes}`
    
    // 调用原有的更新函数
    await handleTicketTimeChange(trainNo, timeString)
    
    // 显示成功提示
    ElMessage.success(`已更新${trainNo}次列车开检时间为${timeString}`)
  } catch (error) {
    console.error('更新开检时间失败:', error)
    ElMessage.error('更新开检时间失败')
  }
}

// 添加服务人员过滤方法
const filterStaff = (query: string) => {
  const staffList = staffStore.getActiveStaffList()
  if (!query) return staffList
  
  const lowercaseQuery = query.toLowerCase()
  return staffList.filter(staff => 
    staff.value.toLowerCase().includes(lowercaseQuery) ||  // 匹配姓名
    staff.staffNo.toLowerCase().includes(lowercaseQuery) || // 匹配工号
    staff.team.toLowerCase().includes(lowercaseQuery)      // 匹配班组
  )
}

// 连接/断开喇叭设备
const handleConnectSpeaker = async () => {
  if (speakerStatus.value.connected) {
    disconnectSpeaker()
    ElMessage.info('已断开喇叭设备连接')
  } else {
    const connected = await connectSpeaker()
    if (connected) {
      ElMessage.success('喇叭设备连接成功')
    } else {
      ElMessage.error(`喇叭设备连接失败: ${speakerStatus.value.error || '未知错误'}`)
    }
  }
}

// 播报开检提醒
const handleAnnounce = async (passenger: Passenger) => {
  const train = trainStore.getTrainByNo(passenger.trainNo)
  if (!train) {
    ElMessage.error(`找不到车次 ${passenger.trainNo} 的信息`)
    return
  }
  
  const success = await announceTicketCheck(passenger.trainNo, passenger.cardNo, passenger.name)
  if (success) {
    ElMessage.success(`正在播报：${passenger.name}，请注意，${passenger.trainNo}次列车准备开检`)
  } else {
    ElMessage.error('播报失败，请检查喇叭设备连接')
  }
}

// 重写handleSubmit函数，在成功提交后立即刷新数据
const handleSubmit = async () => {
  try {
    await originalHandleSubmit()
    
    setTimeout(async () => {
      await updateTodayPassengers(true)
      debouncedUpdateStyles()
      lastRefreshTime.value = new Date()
      ElMessage.success('数据已刷新，显示最新添加的旅客')
    }, 300)
  } catch (error) {
    console.error('提交表单失败:', error)
  }
}

// 播报自定义内容
const handleCustomAnnounce = async () => {
  if (!customAnnouncementText.value.trim()) {
    ElMessage.warning('播报内容不能为空')
    return
  }

  const success = await announceCustom(customAnnouncementText.value)
  if (success) {
    ElMessage.success('正在播报自定义内容')
    announcementDialogVisible.value = false
    customAnnouncementText.value = ''
  } else {
    ElMessage.error('播报失败，请检查喇叭设备连接')
  }
}

// 添加离厅处理函数
const handleMarkAsLeft = (row: Passenger): void => {
  ElMessageBox.confirm('确认该旅客已离厅？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      const passenger = passengerStore.passengerList.find(p => p.id === row.id)
      
      if (passenger) {
        // 更新存储中的数据
        passengerStore.updatePassenger(passenger.id, {
          ...passenger,
          isServed: true
        })
        
        // 先屏蔽列表更新监听，避免多次触发样式更新和排序变化
        const tempPassengers = [...todayPassengers.value]
        const index = tempPassengers.findIndex(p => p.id === row.id)
        
        if (index !== -1) {
          // 从列表中移除该旅客，而不是标记为已离厅后保留在列表中
          tempPassengers.splice(index, 1)
          
          // 批量更新列表，只触发一次渲染
          todayPassengers.value = tempPassengers
          
          // 立即记录刷新时间
          lastRefreshTime.value = new Date()
        }
        
        // 使用较长的延迟，确保UI稳定后再进行完整的数据刷新
        setTimeout(async () => {
          // 完整刷新列表，确保数据一致性
          await updateTodayPassengers(true, false)
          
          // 刷新后更新样式
          setTimeout(() => {
            debouncedUpdateStyles()
          }, 300)
        }, 500)
        
        ElMessage.success('已标记为离厅')
      } else {
        ElMessage.error('未找到该旅客记录')
      }
    } catch (error) {
      console.error('标记离厅失败:', error)
      ElMessage.error('标记离厅失败')
    }
  }).catch(() => {
    // 用户取消操作，不做处理
  })
}

// 日期格式化函数 - 将YYYY-MM-DD格式转为MM-DD格式
const formatDisplayDate = (dateStr: string) => {
  if (!dateStr) return '';
  
  // 检查是否已经是ISO格式(YYYY-MM-DD)
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // 只显示月和日（不显示年份）
    const parts = dateStr.split('-');
    return `${parts[1]}-${parts[2]}`;
  }
  
  return dateStr;
}

// 处理音频设备选择
const handleSelectDevice = async (command: string) => {
  if (command === 'refresh') {
    // 刷新设备列表
    await getAudioDevices()
    ElMessage.success('设备列表已刷新')
    return
  }
  
  // 连接选中的设备
  const success = await connectSpecificSpeaker(command)
  if (success) {
    const device = audioDevices.value.find(d => d.deviceId === command)
    ElMessage.success(`已连接到设备: ${device?.label || command}`)
  } else {
    ElMessage.error('连接设备失败')
  }
}

// 获取需要提醒的旅客列表（临近开检时间的旅客）
const getAlertPassengers = () => {
  // 获取今天日期
  const today = new Date().toISOString().split('T')[0]
  const now = new Date()
  const currentHour = now.getHours()
  
  // 计算明天的日期
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]
  
  // 首先获取今日需要提醒的旅客
  const todayAlertPassengers = todayPassengers.value.filter(passenger => 
    passenger.date === today &&
    isNearTicketTime(passenger.trainNo, passenger.date) && 
    !isExpiredTicketTime(passenger.trainNo, passenger.date) &&
    !passenger.isServed
  )
  
  // 创建ID集合用于去重
  const alertPassengerIds = new Set(todayAlertPassengers.map(p => p.id))
  
  // 获取明日凌晨需要提醒的旅客（确保不与今日重复）
  // 只有在当前时间是晚上9点以后才考虑次日凌晨车次
  const tomorrowAlertPassengers = currentHour >= 21 ? todayPassengers.value.filter(passenger => 
    passenger.date === tomorrowStr &&
    isEarlyMorningTicketTime(passenger.trainNo) &&
    isNearTicketTime(passenger.trainNo, passenger.date) &&
    !isExpiredTicketTime(passenger.trainNo, passenger.date) &&
    !passenger.isServed &&
    !alertPassengerIds.has(passenger.id)  // 确保不重复
  ) : []
  
  // 合并并返回所有需要提醒的旅客
  return [...todayAlertPassengers, ...tomorrowAlertPassengers]
}

// 添加计算属性，实时响应旅客信息变化
const alertPassengers = computed(() => {
  // 添加当前时间作为依赖，确保每分钟都会重新计算
  const now = new Date()
  const minutes = now.getMinutes()
  const seconds = now.getSeconds()
  
  // 获取最新的提醒列表
  const alerts = getAlertPassengers()
  console.log(`重新计算开检提醒列表 [${now.toLocaleTimeString()}]，数量: ${alerts.length}`)
  
  return alerts
})

// 监控开检提醒列表变化，自动进行播报
// 保存已播报的旅客记录，避免重复播报
const announcedPassengers = reactive<Record<string, boolean>>({})

// 设置开检时间监听函数
const setupTicketTimeWatchers = () => {
  const trainNos = todayPassengers.value.map(p => p.trainNo).filter(Boolean) as string[]
  
  // 为新的车次添加监听
  for (const trainNo of trainNos) {
    if (!watchedTrains.value.has(trainNo)) {
      watchedTrains.value.add(trainNo)
      console.log(`添加${trainNo}车次的开检时间监听`)
      
      // 保存初始开检时间
      const lastTimeKey = `last_ticket_time_${trainNo}`
      const currentTime = getTicketTime(trainNo)
      localStorage.setItem(lastTimeKey, currentTime || '')
    }
  }
}

// 添加一个函数用于检查开检时间变化
const checkTicketTimeChanges = () => {
  const trainNos = Array.from(watchedTrains.value)
  let hasChanges = false
  
  for (const trainNo of trainNos) {
    // 获取当前开检时间
    const currentTime = getTicketTime(trainNo)
    
    // 保存上次检查的开检时间
    const lastTimeKey = `last_ticket_time_${trainNo}`
    const lastTime = localStorage.getItem(lastTimeKey)
    
    // 如果开检时间变化了，重新检查提醒
    if (lastTime !== currentTime) {
      console.log(`${trainNo}车次开检时间变化: ${lastTime} -> ${currentTime}`)
      localStorage.setItem(lastTimeKey, currentTime || '')
      hasChanges = true
    }
  }
  
  // 如果有变化，重新检查提醒
  if (hasChanges) {
    checkNewAlerts()
  }
}

// 检查是否有新的开检提醒，并自动播报
const checkNewAlerts = async () => {
  console.log('检查新的开检提醒...')
  const currentAlertPassengers = alertPassengers.value
  console.log('发现需要提醒的旅客:', currentAlertPassengers.length)
  
  // 遍历开检提醒列表，找到尚未播报过的旅客
  for (const passenger of currentAlertPassengers) {
    const key = `${passenger.trainNo}-${passenger.cardNo}-${passenger.date}`
    
    // 如果该旅客尚未播报，则进行播报
    if (!announcedPassengers[key]) {
      // 标记为已播报
      announcedPassengers[key] = true
      
      // 自动播报
      if (speakerStatus.value.connected) {
        // 获取车次类型
        const { type } = getTrainTypeAndRemindTime(passenger.trainNo)
        console.log(`正在自动播报(${type}列车):`, passenger.cardNo, passenger.trainNo)
        
        await announceTicketCheck(passenger.trainNo, passenger.cardNo, passenger.name)
        ElMessage.success(`自动播报(${type}): ${passenger.name}，请注意，${passenger.trainNo}次列车准备开检`)
      } else {
        console.log('喇叭未连接，无法自动播报')
      }
    }
  }
}

// 修改表格配置
const tableConfig = {
  stripe: false,
  border: true,
  size: 'default',
  highlightCurrentRow: false,
  rowClassName: getRowClassName,
  style: {
    width: '100%'
  }
}

// 在组件卸载时确保清除定时器
onUnmounted(() => {
  console.log('Home组件已卸载')
  
  // 清除任何可能残留的定时器
  if (checkTimer) {
    clearInterval(checkTimer)
    checkTimer = null
  }
  
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
  
  if (colorRefreshTimer) {
    clearInterval(colorRefreshTimer)
    colorRefreshTimer = null
  }
})

// 添加日期格式转换函数
const parseExcelDate = (dateValue: any): string => {
  if (!dateValue) {
    return new Date().toISOString().split('T')[0] // 默认返回今天
  }

  try {
    // 如果是数字（Excel序列号）
    if (typeof dateValue === 'number') {
      const excelEpoch = new Date(1899, 11, 30)
      const date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000)
      return date.toISOString().split('T')[0]
    }

    // 处理字符串格式
    if (typeof dateValue === 'string') {
      // 移除可能的多余空格
      dateValue = dateValue.trim()

      // 处理点号分隔的日期格式（如4.18）
      if (/^\d{1,2}\.\d{1,2}$/.test(dateValue)) {
        const [month, day] = dateValue.split('.').map(Number)
        const currentYear = new Date().getFullYear()
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          return `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        }
      }

      // 尝试不同的日期格式
      const formats = [
        // YYYY-MM-DD
        /^\d{4}-\d{1,2}-\d{1,2}$/,
        // YYYY/MM/DD
        /^\d{4}\/\d{1,2}\/\d{1,2}$/,
        // MM-DD
        /^\d{1,2}-\d{1,2}$/,
        // MM/DD
        /^\d{1,2}\/\d{1,2}$/,
        // YYYYMMDD
        /^\d{8}$/,
        // MMDD
        /^\d{4}$/
      ]

      for (const format of formats) {
        if (format.test(dateValue)) {
          let year, month, day

          if (dateValue.length === 4) {
            // MMDD格式
            const currentYear = new Date().getFullYear()
            month = parseInt(dateValue.substring(0, 2))
            day = parseInt(dateValue.substring(2, 4))
            year = currentYear
          } else if (dateValue.length === 8 && !dateValue.includes('-') && !dateValue.includes('/')) {
            // YYYYMMDD格式
            year = parseInt(dateValue.substring(0, 4))
            month = parseInt(dateValue.substring(4, 6))
            day = parseInt(dateValue.substring(6, 8))
          } else if (!dateValue.includes('-') && !dateValue.includes('/')) {
            // 其他纯数字格式
            const currentYear = new Date().getFullYear()
            month = parseInt(dateValue.substring(0, 2))
            day = parseInt(dateValue.substring(2, 4))
            year = currentYear
          } else {
            // YYYY-MM-DD 或 YYYY/MM/DD 格式
            const parts = dateValue.split(/[-\/]/)
            if (parts.length === 3) {
              year = parseInt(parts[0])
              month = parseInt(parts[1])
              day = parseInt(parts[2])
            } else if (parts.length === 2) {
              // MM-DD 或 MM/DD 格式
              const currentYear = new Date().getFullYear()
              year = currentYear
              month = parseInt(parts[0])
              day = parseInt(parts[1])
            }
          }

          // 验证日期的有效性
          if (year && month && day) {
            if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
              // 格式化日期为YYYY-MM-DD
              return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            }
          }
        }
      }
    }

    // 如果是Date对象
    if (dateValue instanceof Date) {
      return dateValue.toISOString().split('T')[0]
    }

    // 如果无法解析，返回今天的日期
    return new Date().toISOString().split('T')[0]
  } catch (error) {
    console.error('日期解析错误:', error)
    return new Date().toISOString().split('T')[0]
  }
}

// 获取到站时间的函数
const getArrivalTime = (trainNo: string): string => {
  const train = trainStore.getTrainByNo(trainNo)
  if (!train) return '--'
  
  // 如果是终到车（运行区间2为西安）
  if (train.route2 === '西安') {
    // 优先使用站台上岗时间，如果没有则使用到站时间
    return train.platformStaffTime || train.arrivalTime || '--'
  }
  
  return '--'
}

// 格式化小时显示
const formatHourDisplay = (value: number): string => {
  return String(value).padStart(2, '0');
}

// 格式化分钟显示
const formatMinuteDisplay = (value: number): string => {
  return String(value).padStart(2, '0');
}

// 添加牌号点击处理函数
const handleCardNoClick = (row: Passenger) => {
  if (row.isServed) {
    ElMessage.warning('该旅客已离厅，无法修改牌号')
    return
  }
  
  ElMessageBox.prompt('请输入牌号', '修改牌号', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputValue: row.cardNo || '',
    inputPattern: /^[A-Za-z0-9]+$/,
    inputErrorMessage: '牌号只能包含字母和数字'
  }).then(async ({ value }) => {
    if (!value.trim()) {
      ElMessage.warning('牌号不能为空')
      return
    }
    
    try {
      // 检查是否与其他旅客的牌号重复
      const isDuplicate = passengerStore.isCardNoDuplicate(value, row.id)
      if (isDuplicate) {
        ElMessage.warning('该牌号已被使用，请使用其他牌号')
        return
      }
      
      // 更新牌号前先保存原始引用
      const originalRow = { ...row }
      
      // 更新存储中的数据
      await passengerStore.updatePassenger(row.id, {
        ...originalRow,
        cardNo: value.trim()
      })
      
      // 使用深拷贝更新当前视图，避免排序问题
      const tempPassengers = todayPassengers.value.map(p => {
        if (p.id === row.id) {
          return { ...p, cardNo: value.trim() }
        }
        return { ...p }
      })
      
      // 批量更新数据，只触发一次渲染
      todayPassengers.value = tempPassengers
      
      // 记录刷新时间
      lastRefreshTime.value = new Date()
      
      // 使用延迟，确保UI稳定后进行完整的数据刷新
      setTimeout(async () => {
        // 完整刷新列表
        await updateTodayPassengers(true, false)
        
        // 刷新后更新样式
        setTimeout(() => {
          debouncedUpdateStyles()
        }, 300)
      }, 500)
      
      ElMessage.success('牌号更新成功')
    } catch (error) {
      console.error('更新牌号失败:', error)
      ElMessage.error('更新牌号失败')
    }
  }).catch(() => {
    // 用户取消操作，不做处理
  })
}

// 监听开检时间变化，确保及时更新提醒
const watchTicketTimes = () => {
  const trainNos = todayPassengers.value.map(p => p.trainNo)
  for (const trainNo of trainNos) {
    if (trainNo) {
      watch(() => getTicketTime(trainNo), () => {
        console.log(`${trainNo}车次开检时间变化，重新检查提醒`)
        // 延迟执行，避免频繁更新
        setTimeout(() => {
          checkNewAlerts()
        }, 100)
      })
    }
  }
}

// 使用ref存储当前监听的车次，避免重复监听
const watchedTrains = ref(new Set<string>())

const setupTableStyles = () => {
  const style = document.createElement('style')
  style.textContent = `
    .el-table .el-table__row.near-row,
    .el-table .el-table__row.near-row td {
      background-color: #FFD700 !important;
      color: #333 !important;
      font-weight: bold !important;
    }
    
    .el-table .el-table__row.near-row:hover td {
      background-color: #FFD700 !important;
    }
    
    .el-table .el-table__row.expired-row,
    .el-table .el-table__row.expired-row td {
      background-color: #fef0f0 !important;
      color: #f56c6c !important;
    }
    
    .el-table .el-table__row.left-row,
    .el-table .el-table__row.left-row td {
      background-color: #f5f7fa !important;
      color: #909399 !important;
    }
  `
  document.head.appendChild(style)
  
  // 清理函数
  onUnmounted(() => {
    document.head.removeChild(style)
  })
}

// 在setup中调用
setupTableStyles()

// 添加分页相关的响应式变量
const currentPage = ref(1)
const pageSize = ref(15)

// 计算分页后的数据
const paginatedPassengers = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return todayPassengers.value.slice(start, end)
})

// 处理每页显示数量变化
const handleSizeChange = (val: number) => {
  pageSize.value = val
  currentPage.value = 1 // 重置到第一页
}

// 处理页码变化
const handleCurrentChange = (val: number) => {
  currentPage.value = val
}

// 监听todayPassengers变化，当数据变化时重置分页
watch(todayPassengers, () => {
  // 如果当前页已经超出了总页数，重置到第一页
  const totalPages = Math.ceil(todayPassengers.value.length / pageSize.value)
  if (currentPage.value > totalPages) {
    currentPage.value = 1
  }
}, { deep: true })

// 添加实时时间更新函数
const updateCurrentTime = () => {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  currentTime.value = `${hours}:${minutes}:${seconds}`
}

// 在组件挂载时启动定时器
onMounted(() => {
  // 立即更新一次时间
  updateCurrentTime()
  
  // 每秒更新一次时间
  const timeInterval = setInterval(updateCurrentTime, 1000)
  
  // 在组件卸载时清除定时器
  onUnmounted(() => {
    clearInterval(timeInterval)
  })
  
  // ... existing code ...
})
</script>

<style scoped>
.home {
  padding: 20px;
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}

.welcome-card {
  margin-bottom: 20px;
}

.notification-card {
  margin-bottom: 20px;
}

.button-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.welcome-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.notification-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.notification-actions {
  display: flex;
  gap: 8px;
}

.pagination-container {
  margin-top: 20px;
  padding: 10px 0;
  display: flex;
  justify-content: flex-end;
  background-color: white;
}

/* 确保分页器在表格内容变化时保持位置 */
:deep(.el-pagination) {
  white-space: nowrap;
  padding: 2px 5px;
  color: var(--el-text-color-primary);
  font-weight: normal;
  display: flex;
  align-items: center;
}

/* 修改card-header样式 */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.button-group {
  display: flex;
  flex-direction: row;  /* 修改为水平方向 */
  gap: 10px;
  align-items: center;
}

/* 调整上传按钮样式 */
:deep(.upload-demo) {
  display: inline-block;  /* 修改为内联块级元素 */
}

:deep(.upload-demo .el-upload) {
  display: inline-block;  /* 修改为内联块级元素 */
  width: auto;
}

:deep(.el-button) {
  display: flex;
  align-items: center;
  gap: 5px;
}

/* 调整表格样式 */
:deep(.el-table) {
  width: 100%;
  margin: 0 auto;
}

:deep(.el-table__header) {
  font-weight: bold;
}

:deep(.el-table__cell) {
  padding: 8px 0;
}

:deep(.el-button-group) {
  display: flex;
  flex-wrap: nowrap;
}

/* 调整终到车显示样式 */
:deep(.terminal-train) {
  display: inline-block;
  padding: 2px 8px;
  background-color: #fef0f0;
  color: #f56c6c;
  border: 1px solid #fbc4c4;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.4;
  text-align: center;
  white-space: nowrap;
}

/* 添加时间输入框容器样式 */
.time-input-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.time-inputs {
  display: flex;
  align-items: center;
  gap: 5px;
}

.time-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 5px;
}

.time-separator {
  margin: 0 2px;
  color: var(--el-text-color-regular);
}

.notification-content {
  min-height: 20px;
}

.empty-data {
  min-height: 20px;
}

/* 删除不需要的样式 */
.passenger-item,
.passenger-info {
  display: none;
}

/* 添加对话框底部按钮样式 */
:deep(.dialog-footer) {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

:deep(.el-dialog__footer) {
  padding: 20px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.card-no-cell {
  display: inline-block;
  padding: 2px 8px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
}

.card-no-cell:hover {
  border-color: #409eff;
  color: #409eff;
}

.empty-card-no {
  color: #909399;
  font-style: italic;
}

.time-tag {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 14px;
  padding: 8px 12px;
  background-color: #f0f9eb;
  border-color: #e1f3d8;
  color: #67c23a;
}

.time-tag .el-icon {
  font-size: 16px;
  color: #67c23a;
}

.time-display {
  text-align: center;
  margin-bottom: 20px;
}

.current-time {
  font-size: 36px;
  font-weight: normal;
  color: #67c23a;
  font-family: 'Arial', sans-serif;
  letter-spacing: 2px;
}

.current-time span {
  color: #67c23a;
  opacity: 0.8;
}

.welcome-content {
  position: relative;
}

.time-display {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  text-align: right;
  padding-right: 20px;
}
</style>
