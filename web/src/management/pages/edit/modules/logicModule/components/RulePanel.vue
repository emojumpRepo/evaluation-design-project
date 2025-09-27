<template>
  <div class="rule-list">
    <RuleNodeView
      v-for="item in list"
      ref="ruleWrappers"
      :key="item.id"
      :ruleNode="item"
      @delete="handleDetele"
    >
    </RuleNodeView>

    <div class="no-logic" v-if="list.length === 0">
      <img src="/imgs/icons/unselected.webp" />
    </div>

    <el-button type="primary" class="add" @click="handleAdd" :icon="Plus" size="default">
      新增显示逻辑
    </el-button>
  </div>
</template>
<script setup lang="ts">
import { shallowRef, computed } from 'vue'
import { RuleNode, ConditionNode } from '@/common/logicEngine/RuleBuild'
import { useEditStore } from '@/management/stores/edit'
import { storeToRefs } from 'pinia'
import { Plus } from '@element-plus/icons-vue'
const editStore = useEditStore()
const { showLogicEngine } = storeToRefs(editStore)

import RuleNodeView from './RuleNodeView.vue'

const list = computed(() => {
  return showLogicEngine.value?.rules || []
})

const handleAdd = () => {
  const condition = new ConditionNode()
  const ruleNode = new RuleNode()
  ruleNode.addCondition(condition)
  showLogicEngine.value.addRule(ruleNode)
}
const handleDetele = (id: string) => {
  showLogicEngine.value.removeRule(id)
}

const ruleWrappers = shallowRef([])

const formValidate = () => {
  return ruleWrappers.value.map((item: any) => {
    return item?.submitForm()
  })
}
const handleValide = () => {
  const validPass = formValidate()
  const result = !validPass.includes(false)
  // result 为ture代表校验不通过
  return !result
}
defineExpose({
  handleValide
})
</script>
<style lang="scss">
.rule-list {
  width: 824px;
  text-align: left;
  margin: 0 auto;
  padding: 12px;
  .add {
    margin: 12px 0;
    width: 100%;
    font-weight: 500;
    height: 40px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
    }
    
    &:active {
      transform: translateY(0);
    }
  }
}

.no-logic {
  padding: 100px 0 50px 0;
  display: flex;
  flex-direction: column;
  align-items: center;

  img {
    width: 200px;
  }
}
</style>
