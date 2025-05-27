import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

// 配置接口
export interface Config {
  NEAR_TICKET_TIME_THRESHOLD: number // 临近开检的时间阈值（分钟）
}

// 默认配置
const DEFAULT_CONFIG: Config = {
  NEAR_TICKET_TIME_THRESHOLD: 30 // 默认30分钟
}

export const useConfigStore = defineStore('config', () => {
  // 从localStorage获取初始数据
  const config = ref<Config>(JSON.parse(localStorage.getItem('config') || JSON.stringify(DEFAULT_CONFIG)))

  // 监听数据变化，自动保存到localStorage
  watch(config, (newConfig) => {
    localStorage.setItem('config', JSON.stringify(newConfig))
  }, { deep: true })

  // 重置配置到默认值
  const resetConfig = (): void => {
    config.value = { ...DEFAULT_CONFIG }
    localStorage.setItem('config', JSON.stringify(config.value))
  }

  // 更新配置
  const updateConfig = (newConfig: Partial<Config>): void => {
    config.value = { ...config.value, ...newConfig }
    localStorage.setItem('config', JSON.stringify(config.value))
  }

  return {
    ...config,
    resetConfig,
    updateConfig
  }
}) 