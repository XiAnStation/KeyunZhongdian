<template>
  <div class="home">
    <el-row :gutter="20">
      <el-col :span="24">
        <el-card class="welcome-card">
          <template #header>
            <div class="welcome-header">
              <span>今日待办</span>
              <el-tag type="success">{{ currentTime }}</el-tag>
            </div>
          </template>
          <div class="welcome-content">
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
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>剩余重点旅客</span>
              <el-button-group>
                
                <el-button type="success" @click="handleAdd">
                  <el-icon><Plus /></el-icon>
                  新增旅客
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
            <el-table-column prop="staffName" label="服务人员" width="100" />
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
                    @click="handleEdit(scope.row)">
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
        <el-descriptions-item label="开检时间">
          <el-time-picker
            v-if="currentTrain"
            v-model="currentTrain.ticketTime"
            format="HH:mm"
            placeholder="选择开检时间"
            @change="handleTicketTimeChange"
          />
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <!-- 新增/编辑旅客对话框 -->
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
        <el-form-item label="类别" prop="type">
          <el-select v-model="form.type" placeholder="请选择类别">
            <el-option label="老" value="老" />
            <el-option label="弱" value="弱" />
            <el-option label="病" value="病" />
            <el-option label="残" value="残" />
            <el-option label="孕" value="孕" />
            <el-option label="军" value="军" />
          </el-select>
        </el-form-item>
        <el-form-item label="服务" prop="service">
          <el-input v-model="form.service" />
        </el-form-item>
        <el-form-item label="服务人员" prop="staffName">
          <el-input v-model="form.staffName" placeholder="请输入服务工作人员姓名" />
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
  </div>
</template>

<script setup lang="ts">
import { useHome } from '../composables/useHome'
import { useTrainStore } from '../store/train'
import { Check,  Plus, User } from '@element-plus/icons-vue'

const trainStore = useTrainStore()

const {
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
} = useHome()
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
  color: #db3a3a;
  font-weight: bold;
}

:deep(.el-table__row) {
  &.urgent-row {
    background-color: #f79e03 !important;
  }
  
  &.expired-row {
    background-color: #fef0f0 !important;
    color: #f56c6c !important;
  }
}

:deep(.urgent-notification) {
  background-color: #fef0f0;
  border: 1px solid #f56c6c;
  padding: 16px;
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,.1);
  
  .el-notification__title {
    color: #f70505;
    font-size: 18px;
    font-weight: bold;
  }
  
  .el-notification__content {
    margin-top: 8px;
  }
}
</style> 