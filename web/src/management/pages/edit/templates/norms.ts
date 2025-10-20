/**
 * 权威常模与阈值配置（最小集中化实现）
 * 说明：仅收录已在文献中稳定、广泛采用的量表分级阈值；
 * - PHQ-9：Kroenke et al., 2001（5/10/15/20）
 * - SDS：Zung, 1965 及后续用法（标准分 53/63/73）
 * - SAS：Zung, 1971 及后续用法（标准分 50/60/70）
 * - TAS-20：Bagby et al., 1994（≤50/51–60/≥61）
 * - Y-BOCS：Goodman et al., 1989–1990（0–7/8–15/16–23/24–31/32–40）
 * - SCL-90：以条目得分≥2 记阳性，因子均分≥2 视为临床提升；严格分级需依赖地区常模/常模T值，项目内先提供经验分档
 *
 * 注意：BFI/EPQ/ITS/BSQ 的常模依赖量表版本与人群；此处提供占位说明，待项目确认后接入。
 */

import { PHQ9_DEPRESSION_LEVELS, SDS_DEPRESSION_LEVELS, SAS_ANXIETY_LEVELS, SCL90_SEVERITY_LEVELS, TAS_ALEXITHYMIA_LEVELS, YBOCS_SEVERITY_LEVELS } from './utils'

export type NormRange = { min: number; max: number; level: string; description?: string }

export const PHQ9_NORMS = {
  thresholds: [
    { min: 0, max: 4, level: PHQ9_DEPRESSION_LEVELS[0], description: '无明显抑郁症状' },
    { min: 5, max: 9, level: PHQ9_DEPRESSION_LEVELS[1], description: '轻微抑郁' },
    { min: 10, max: 14, level: PHQ9_DEPRESSION_LEVELS[2], description: '中度抑郁' },
    { min: 15, max: 19, level: PHQ9_DEPRESSION_LEVELS[3], description: '中重度抑郁' },
    { min: 20, max: 27, level: PHQ9_DEPRESSION_LEVELS[4], description: '重度抑郁' }
  ] as NormRange[],
  source: 'Kroenke K. et al., J Gen Intern Med. 2001'
}

export const SDS_NORMS = {
  thresholds: [
    { min: 0, max: 52, level: SDS_DEPRESSION_LEVELS[0], description: '标准分≤52' },
    { min: 53, max: 62, level: SDS_DEPRESSION_LEVELS[1], description: '53–62' },
    { min: 63, max: 72, level: SDS_DEPRESSION_LEVELS[2], description: '63–72' },
    { min: 73, max: 100, level: SDS_DEPRESSION_LEVELS[3], description: '≥73' }
  ] as NormRange[],
  source: 'Zung WWK., Arch Gen Psychiatry. 1965; 及后续中国区实践'
}

export const SAS_NORMS = {
  thresholds: [
    { min: 0, max: 49, level: SAS_ANXIETY_LEVELS[0], description: '标准分<50' },
    { min: 50, max: 59, level: SAS_ANXIETY_LEVELS[1], description: '50–59' },
    { min: 60, max: 69, level: SAS_ANXIETY_LEVELS[2], description: '60–69' },
    { min: 70, max: 100, level: SAS_ANXIETY_LEVELS[3], description: '≥70' }
  ] as NormRange[],
  source: 'Zung WWK., Psychosomatics. 1971; 阈值50/60/70 的主流用法'
}

export const TAS20_NORMS = {
  thresholds: [
    { min: 0, max: 50, level: TAS_ALEXITHYMIA_LEVELS[0], description: '≤50 无述情障碍' },
    { min: 51, max: 60, level: TAS_ALEXITHYMIA_LEVELS[1], description: '51–60 边缘' },
    { min: 61, max: 100, level: TAS_ALEXITHYMIA_LEVELS[2], description: '≥61 述情障碍' }
  ] as NormRange[],
  source: 'Bagby RM. et al., Psychother Psychosom. 1994'
}

export const YBOCS_NORMS = {
  thresholds: [
    { min: 0, max: 7, level: '轻度', description: 'Subclinical' },
    { min: 8, max: 15, level: '中度', description: 'Mild' },
    { min: 16, max: 23, level: '重度', description: 'Moderate' },
    { min: 24, max: 40, level: '极重', description: 'Severe–Extreme' }
  ] as NormRange[],
  source: 'Goodman WK. et al., Y-BOCS; Stanford/ICDL 资源'
}

export const SCL90_NORMS = {
  positiveItemThreshold: 2,
  factorSeverity: {
    breaks: [1.5, 2.5, 3.5, 4.5],
    levels: SCL90_SEVERITY_LEVELS
  },
  note: 'SCL-90 临床常以条目≥2 计阳性，因子均分≥2 视为临床提升；严格分级需依赖地区常模/T 值',
  source: 'Derogatis LR., SCL-90-R Manual; 多来源综述'
}

// 占位：需与项目确认的量表
export const BSQ_NORMS_TBD = { note: '需确认量表具体版本（疑似BSDS或Body Shape Questionnaire），当前未引入权威常模' }
export const ITS_NORMS_TBD = { note: 'Rotter ITS/其他变体差异较大，当前未引入权威常模（等待问卷版本/计分法确认）' }

