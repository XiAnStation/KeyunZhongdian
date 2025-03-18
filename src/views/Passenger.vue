<template>
  <div class="passenger">
    <h2>重点旅客信息管理</h2>
    <div class="operation-bar">
      <el-button type="primary" @click="handleAdd">
        新增旅客
      </el-button>
    </div>

    <el-table :data="passengerStore.passengerList" style="width: 100%; margin-top: 20px">
      <el-table-column prop="id" label="序号" width="80" />
      <el-table-column prop="date" label="日期" />
      <el-table-column prop="trainNo" label="车次" />
      <el-table-column prop="name" label="姓名" />
      <el-table-column prop="type" label="类别" />
      <el-table-column prop="service" label="服务" />
      <el-table-column label="开检时间">
        <template #default="scope">
          {{ getTicketTime(scope.row.trainNo) }}
        </template>
      </el-table-column>
      <el-table-column prop="companions" label="同行人数" />
      <el-table-column prop="cardNo" label="牌号" />
      <el-table-column prop="remark" label="备注" />
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="scope">
          <el-button size="small" @click="handleEdit(scope.row)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog 
      v-model="dialogVisible" 
      :title="formType === 'add' ? '新增旅客' : '编辑旅客'"
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
            <el-option label="重伤" value="重伤" />
            <el-option label="孕妇" value="孕妇" />
            <el-option label="老人" value="老人" />
            <el-option label="儿童" value="儿童" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="服务" prop="service">
          <el-input v-model="form.service" />
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
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSubmit">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { usePassengerStore } from '../store/passenger'
import { useTrainStore } from '../store/train'
import { ElMessage, ElMessageBox } from 'element-plus'

const passengerStore = usePassengerStore()
const trainStore = useTrainStore()
const dialogVisible = ref(false)
const formType = ref('add')
const formRef = ref(null)

const rules = {
  date: [{ required: true, message: '请选择日期', trigger: 'change' }],
  trainNo: [{ required: true, message: '请选择车次', trigger: 'change' }],
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  type: [{ required: true, message: '请选择类别', trigger: 'change' }],
  cardNo: [
    { required: true, message: '请输入牌号', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value) {
          const isDuplicate = passengerStore.isCardNoDuplicate(value, formType.value === 'edit' ? form.value.id : null)
          if (isDuplicate) {
            callback(new Error('该牌号已存在'))
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

const form = ref({
  date: '',
  trainNo: '',
  name: '',
  type: '',
  service: '',
  companions: 0,
  cardNo: '',
  remark: ''
})

const resetForm = () => {
  form.value = {
    date: '',
    trainNo: '',
    name: '',
    type: '',
    service: '',
    companions: 0,
    cardNo: '',
    remark: ''
  }
}

const handleAdd = () => {
  formType.value = 'add'
  resetForm()
  dialogVisible.value = true
}

const handleEdit = (row) => {
  formType.value = 'edit'
  form.value = { ...row }
  dialogVisible.value = true
}

const handleDelete = (row) => {
  ElMessageBox.confirm('确认删除该旅客信息？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    passengerStore.deletePassenger(row.id)
    ElMessage.success('删除成功')
  })
}

const handleSubmit = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate((valid) => {
    if (valid) {
      if (formType.value === 'add') {
        passengerStore.addPassenger(form.value)
        ElMessage.success('添加成功')
      } else {
        passengerStore.updatePassenger(form.value.id, form.value)
        ElMessage.success('修改成功')
      }
      dialogVisible.value = false
    }
  })
}

// 获取车次的开检时间
const getTicketTime = (trainNo) => {
  const train = trainStore.getTrainByNo(trainNo)
  return train ? train.ticketTime : ''
}
</script>

<style scoped>
.passenger {
  padding: 20px;
}

.operation-bar {
  margin-bottom: 20px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

:deep(.el-dialog__body) {
  padding-top: 10px;
}
</style> 