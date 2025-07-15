<template>
  <div class="login-page">
    <!-- 现代化几何背景 -->
    <div class="geometric-bg">
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
      <div class="shape shape-3"></div>
      <div class="grid-pattern"></div>
    </div>

    <!-- 左侧品牌区域 -->
    <div class="brand-section">
      <div class="brand-content">
        <div class="brand-title-container">
          <div class="brand-logo">
            <img src="/imgs/s-logo.webp" alt="logo" />
          </div>
          <h1 class="brand-title">小橘问卷</h1>
        </div>
        <p class="brand-description">专业的问卷调研平台，助力数据驱动决策</p>
        <div class="feature-list">
          <div class="feature-item">
            <div class="feature-icon">📊</div>
            <span>专业数据分析</span>
          </div>
          <div class="feature-item">
            <div class="feature-icon">🎯</div>
            <span>精准用户触达</span>
          </div>
          <div class="feature-item">
            <div class="feature-icon">⚡</div>
            <span>快速问卷创建</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧登录区域 -->
    <div class="login-section">
      <div class="login-container">
        <div class="login-header">
          <h2 class="login-title">欢迎回来</h2>
          <p class="login-subtitle">登录您的账户继续使用</p>
        </div>

        <el-form :model="formData" :rules="rules" ref="formDataRef" class="login-form" @submit.prevent>
          <el-form-item prop="name">
            <el-input v-model="formData.name" size="large" placeholder="请输入账号" prefix-icon="User" />
          </el-form-item>

          <el-form-item prop="password">
            <el-input type="password" v-model="formData.password" size="large" placeholder="请输入密码" prefix-icon="Lock"
              show-password />

            <div v-if="passwordStrength" class="strength-indicator">
              <div class="strength-bar">
                <span class="strength-label">密码强度：</span>
                <div class="strength-dots">
                  <span class="strength-dot" v-for="item in 3" :key="item" :class="{
                    'weak': passwordStrength === 'Weak' && item <= 1,
                    'medium': passwordStrength === 'Medium' && item <= 2,
                    'strong': passwordStrength === 'Strong' && item <= 3
                  }"></span>
                </div>
              </div>
            </div>
          </el-form-item>

          <el-form-item prop="captcha">
            <div class="captcha-wrapper">
              <el-input v-model="formData.captcha" size="large" placeholder="验证码" prefix-icon="Shield" />
              <div class="captcha-img" @click="refreshCaptcha" v-html="captchaImgData"></div>
            </div>
          </el-form-item>

          <div class="form-actions">
            <el-checkbox class="remember-me">记住我</el-checkbox>
            <a href="#" class="forgot-password">忘记密码？</a>
          </div>

          <div class="button-group">
            <el-button :loading="pending.login" type="primary" size="large" class="login-btn"
              @click="submitForm('login')">
              登录
            </el-button>

            <div class="register-section">
              <span class="register-text">还没有账户？</span>
              <el-button :loading="pending.register" text class="register-btn" @click="submitForm('register')">
                立即注册
              </el-button>
            </div>
          </div>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ElMessage } from 'element-plus'
import 'element-plus/theme-chalk/src/message.scss'

import { debounce } from 'lodash-es'

import { getPasswordStrength, login, register } from '@/management/api/auth'
import { refreshCaptcha as refreshCaptchaApi } from '@/management/api/captcha'
import { CODE_MAP } from '@/management/api/base'
import { useUserStore } from '@/management/stores/user'

const route = useRoute()
const router = useRouter()

interface FormData {
  name: string
  password: string
  captcha: string
  captchaId: string
}

interface Pending {
  login: boolean
  register: boolean
}

const formData = reactive<FormData>({
  name: '',
  password: '',
  captcha: '',
  captchaId: ''
})

// 每个滑块不同强度的颜色，索引0对应第一个滑块
const strengthColor = reactive([
  {
    Strong: '#67C23A',
    Medium: '#ebb563',
    Weak: '#f78989'
  },
  {
    Strong: '#67C23A',
    Medium: '#ebb563',
    Weak: '#2a598a'
  },
  {
    Strong: '#67C23A',
    Medium: '#2a598a',
    Weak: '#2a598a'
  }
])

// 密码内容校验
const passwordValidator = (_: any, value: any, callback: any) => {
  if (!value) {
    callback(new Error('请输入密码'))
    passwordStrength.value = undefined
    return
  }

  if (value.length < 6 || value.length > 16) {
    callback(new Error('长度在 6 到 16 个字符'))
    passwordStrength.value = undefined
    return
  }

  if (!/^[a-zA-Z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+$/.test(value)) {
    callback(new Error('只能输入数字、字母、特殊字符'))
    passwordStrength.value = undefined
    return
  }
  passwordStrengthHandle(value)
  callback()
}

const passwordStrengthHandle = async (value: string) => {
  const res: any = await getPasswordStrength(value)
  if (res.code === CODE_MAP.SUCCESS) {
    passwordStrength.value = res.data
  }
}

const rules = {
  name: [
    { required: true, message: '请输入账号', trigger: 'blur' },
    {
      min: 3,
      max: 10,
      message: '长度在 3 到 10 个字符',
      trigger: 'blur'
    }
  ],
  password: [{ required: true, validator: debounce(passwordValidator, 500), trigger: 'change' }],
  captcha: [
    {
      required: true,
      message: '请输入验证码',
      trigger: 'blur'
    }
  ]
}

onMounted(() => {
  refreshCaptcha()
})

const pending = reactive<Pending>({
  login: false,
  register: false
})

const captchaImgData = ref<string>('')
const formDataRef = ref<any>(null)
const passwordStrength = ref<'Strong' | 'Medium' | 'Weak'>()

const submitForm = (type: 'login' | 'register') => {
  formDataRef.value.validate(async (valid: boolean) => {
    if (valid) {
      try {
        const submitTypes = {
          login,
          register
        }
        pending[type] = true
        const res: any = await submitTypes[type]({
          username: formData.name,
          password: formData.password,
          captcha: formData.captcha,
          captchaId: formData.captchaId
        })

        if (res.code !== CODE_MAP.SUCCESS) {
          ElMessage.error(res.errmsg || '登录失败')
          pending[type] = false
          return false
        }

        const userStore = useUserStore()
        userStore.login({
          username: res.data.username,
          token: res.data.token
        })

        let redirect: any = {
          name: 'survey'
        }

        if (route.query.redirect) {
          redirect = decodeURIComponent(route.query.redirect as string)
        }

        try {
          await router.replace(redirect)
        } catch (error) {
          console.error('Navigation failed:', error)
          await router.replace({ name: 'survey' })
        }

        pending[type] = false
      } catch (error) {
        console.error('Login failed:', error)
        ElMessage.error('登录失败，请重试')
        pending[type] = false
      }
      return true
    } else {
      return false
    }
  })
}

const refreshCaptcha = async () => {
  try {
    const res: any = await refreshCaptchaApi({
      captchaId: formData.captchaId
    })
    if (res.code === 200) {
      const { id, img } = res.data
      formData.captchaId = id
      captchaImgData.value = img
    }
  } catch (error) {
    ElMessage.error('获取验证码失败')
  }
}
</script>

<style lang="scss" scoped>
.login-page {
  display: flex;
  min-height: 100vh;
  position: relative;
  overflow: hidden;

  // 现代化几何背景
  .geometric-bg {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, #ffb366 0%, #ffd966 100%);
    z-index: 0;

    .shape {
      position: absolute;
      opacity: 0.1;

      &.shape-1 {
        width: 400px;
        height: 400px;
        background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
        border-radius: 50%;
        top: -200px;
        left: -200px;
        animation: float 20s ease-in-out infinite;
      }

      &.shape-2 {
        width: 300px;
        height: 300px;
        background: linear-gradient(135deg, #a8edea, #fed6e3);
        transform: rotate(45deg);
        bottom: -150px;
        right: -150px;
        animation: float 25s ease-in-out infinite reverse;
      }

      &.shape-3 {
        width: 200px;
        height: 200px;
        background: linear-gradient(45deg, #ffecd2, #fcb69f);
        border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;
        top: 30%;
        left: 10%;
        animation: morph 30s ease-in-out infinite;
      }
    }

    .grid-pattern {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-image:
        linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
      background-size: 50px 50px;
    }
  }

  // 左侧品牌区域
  .brand-section {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 1;
    padding: 60px;

    .brand-content {
      text-align: center;
      color: white;
      max-width: 500px;

      .brand-title-container {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 10px;
        gap: 10px;

        .brand-logo {
          background-color: white;
          padding: 5px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;

          img {
            width: 40px;
            height: 40px;
          }
        }
      }

      .brand-title {
        font-size: 48px;
        font-weight: 700;
        // margin-bottom: 20px;
        background: linear-gradient(135deg, #fff, #e2e8f0);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        line-height: 1.2;
      }

      .brand-description {
        font-size: 18px;
        opacity: 0.9;
        margin-bottom: 50px;
        line-height: 1.6;
      }

      .feature-list {
        display: flex;
        flex-direction: column;
        gap: 20px;

        .feature-item {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 15px 20px;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(20px);
          border-radius: 15px;
          border: 1px solid rgba(255, 255, 255, 0.2);

          .feature-icon {
            font-size: 24px;
          }

          span {
            font-size: 16px;
            font-weight: 500;
          }
        }
      }
    }
  }

  // 右侧登录区域
  .login-section {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #ffffff;
    position: relative;
    z-index: 1;

    .login-container {
      width: 100%;
      max-width: 440px;
      padding: 60px 40px;

      .login-header {
        text-align: center;
        margin-bottom: 40px;

        .login-title {
          font-size: 32px;
          font-weight: 700;
          color: #1a202c;
          margin-bottom: 10px;
        }

        .login-subtitle {
          font-size: 16px;
          color: #718096;
          margin: 0;
        }
      }

      .login-form {
        .strength-indicator {
          .strength-bar {
            display: flex;
            align-items: center;
            gap: 10px;

            .strength-label {
              font-size: 14px;
              color: #718096;
            }

            .strength-dots {
              display: flex;
              gap: 4px;

              .strength-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #e2e8f0;
                transition: all 0.3s ease;

                &.weak {
                  background: #f56565;
                }

                &.medium {
                  background: #ed8936;
                }

                &.strong {
                  background: #48bb78;
                }
              }
            }
          }
        }

        .captcha-wrapper {
          display: flex;
          gap: 12px;
          align-items: center;

          :deep(.el-input) {
            flex: 1;
          }

          .captcha-img {
            height: 40px;
            width: 120px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f7fafc;
            transition: all 0.3s ease;

            &:hover {
              border-color: #ffb366;
              box-shadow: 0 0 0 3px rgba(255, 179, 102, 0.1);
            }

            :deep(svg) {
              max-width: 100%;
              max-height: 32px;
            }
          }
        }

        .form-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;

          .remember-me {
            color: #4a5568;
            font-size: 14px;
          }

          .forgot-password {
            color: #ffb366;
            text-decoration: none;
            font-size: 14px;
            font-weight: 500;

            &:hover {
              color: #ff9a56;
            }
          }
        }

        .button-group {
          .login-btn {
            width: 100%;
            height: 48px;
            font-size: 16px;
            font-weight: 600;
            background: linear-gradient(135deg, #ffb366 0%, #ffd966 100%);
            border: none;
            border-radius: 12px;
            margin-bottom: 20px;
            transition: all 0.3s ease;

            &:hover {
              transform: translateY(-2px);
              box-shadow: 0 10px 30px rgba(255, 179, 102, 0.3);
            }
          }

          .register-section {
            text-align: center;

            .register-text {
              color: #718096;
              font-size: 14px;
              margin-right: 8px;
            }

            .register-btn {
              color: #ffb366;
              font-weight: 600;
              font-size: 14px;

              &:hover {
                color: #ff9a56;
              }
            }
          }
        }
      }
    }
  }

  // 表单样式优化
  :deep(.el-form-item) {
    margin-bottom: 24px;

    .el-input {
      .el-input__wrapper {
        border-radius: 12px;
        border: 2px solid #e2e8f0;
        background: #ffffff;
        padding: 0 16px;
        height: 48px;
        transition: all 0.3s ease;

        &:hover {
          border-color: #cbd5e0;
        }

        &.is-focus {
          border-color: #ffb366;
          box-shadow: 0 0 0 3px rgba(255, 179, 102, 0.1);
        }
      }

      .el-input__inner {
        font-size: 15px;
        color: #2d3748;
        height: 48px;
        line-height: 48px;

        &::placeholder {
          color: #a0aec0;
        }
      }

      .el-input__prefix {
        color: #a0aec0;
      }
    }
  }
}

// 动画
@keyframes float {

  0%,
  100% {
    transform: translateY(0px) rotate(0deg);
  }

  50% {
    transform: translateY(-20px) rotate(180deg);
  }
}

@keyframes morph {

  0%,
  100% {
    border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;
  }

  25% {
    border-radius: 58% 42% 75% 25% / 76% 46% 54% 24%;
  }

  50% {
    border-radius: 50% 50% 33% 67% / 55% 27% 73% 45%;
  }

  75% {
    border-radius: 33% 67% 58% 42% / 63% 68% 32% 37%;
  }
}

// 响应式设计
@media (max-width: 1024px) {
  .login-page {
    flex-direction: column;

    .brand-section {
      flex: none;
      min-height: 40vh;
      padding: 40px 20px;

      .brand-content {
        .brand-title {
          font-size: 36px;
        }

        .feature-list {
          flex-direction: row;
          justify-content: center;
          flex-wrap: wrap;

          .feature-item {
            flex: 1;
            min-width: 150px;
          }
        }
      }
    }

    .login-section {
      flex: none;
      min-height: 60vh;

      .login-container {
        padding: 40px 20px;
      }
    }
  }
}

@media (max-width: 768px) {
  .login-page {
    .brand-section {
      min-height: 30vh;
      padding: 20px;

      .brand-content {
        .brand-title {
          font-size: 28px;
        }

        .brand-description {
          font-size: 16px;
        }

        .feature-list {
          gap: 10px;

          .feature-item {
            min-width: 120px;
            padding: 10px 15px;

            span {
              font-size: 14px;
            }
          }
        }
      }
    }

    .login-section {
      .login-container {
        max-width: 100%;
      }
    }
  }
}
</style>
