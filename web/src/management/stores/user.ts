import { defineStore } from 'pinia'
import { ref } from 'vue'

import { getUserInfo, setUserInfo, clearUserInfo } from '@/management/utils/storage'

type IUserInfo = {
  username: string
  token: string
}

export const useUserStore = defineStore('user', () => {
  const userInfo = ref<IUserInfo | null>({
    username: '',
    token: ''
  })
  const hasLogin = ref(false)
  const loginTime = ref<number | null>(null)
  const initialized = ref(false)

  const init = () => {
    const localData = getUserInfo()
    if (localData) {
      try {
        const { userInfo: info, loginTime: time } = localData as any
        if (Date.now() - time > 7 * 3600000) {
          clearUserInfo()
        } else {
          login(info)
        }
      } catch (error) {
        console.log(error)
        clearUserInfo()
      }
    }
    initialized.value = true
  }
  
  const login = (data: IUserInfo) => {
    userInfo.value = {
      username: data.username,
      token: data.token
    }
    hasLogin.value = true
    loginTime.value = Date.now()
    
    try {
      setUserInfo({
        userInfo: {
          username: data.username,
          token: data.token
        },
        loginTime: loginTime.value
      })
    } catch (error) {
      console.error('Failed to save user info:', error)
    }
  }
  
  const logout = () => {
    userInfo.value = null
    hasLogin.value = false
    clearUserInfo()
  }

  return { userInfo, hasLogin, loginTime, initialized, init, login, logout }
})
