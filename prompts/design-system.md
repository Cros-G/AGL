# Design System: AGL Learning Diagnosis

> **风格基准**：Google Material Design 3 (Material You)
> **关联文档**：`PRD-learning-diagnosis.md` / `tech-design-learning-diagnosis.md`
> **日期**：2026-03-15

本文档定义 Learning Diagnosis 模块的视觉语言、组件规范和交互模式。所有设计决策以 Material Design 3 为基础，并针对"诊断工具"这一专业场景做了定向适配。

---

## 一、设计原则

在 Material Design 3 通用原则之上，本产品有四条附加原则：

| 原则 | 含义 | 具体体现 |
|------|------|---------|
| **渐进呈现** | 界面随信息积累自然生长，绝不一开始就暴露全部复杂度 | 面板区块按需出现，而非预设空框 |
| **判断可见** | 诊断是关于"判断"的产品，所有判断节点（假设状态、置信度、充分度）必须视觉上一目了然 | 假设卡片的状态色、六层进度条、红黄绿指示器 |
| **编辑无门槛** | 讲师随手点就能改，不需要进入"编辑模式" | inline editing，click-to-edit，无模态弹窗 |
| **双区协调** | 左右面板视觉上是一个整体，而不是两个不相干的页面 | 统一的色彩系统、面板更新时左侧有对应系统消息、共享顶栏 |

---

## 二、色彩系统

### 2.1 基础色板

采用 Material Design 3 的 Tonal Palette 体系。主色从一个 seed color 生成完整的明暗色阶。

**Seed Color**: `#1A73E8`（Google Blue — 专业、可信赖、中性）

```
Primary（主色 — 操作按钮、链接、当前焦点）
┌──────────────────────────────────────────────────┐
│  P-10   P-20   P-30   P-40   P-50   P-60   P-70 │
│ #041E49 #062E6F #0842A0 #1A73E8 #4C8DF6 #7CACF8 │
│  最深                                       最浅  │
└──────────────────────────────────────────────────┘

Surface（表面 — 背景、卡片、面板）
┌──────────────────────────────────────────────────┐
│  S-Dim      S-0        S-1       S-2       S-3   │
│  #F0F4F9   #FFFFFF    #F8FAFD   #EEF3FA   #E3EAF4│
│  整体背景    白         轻微抬升   中度抬升   强调面 │
└──────────────────────────────────────────────────┘

On-Surface（前景文字）
┌──────────────────────────────────────────────────┐
│  OS-High    OS-Medium   OS-Low    OS-Disabled     │
│  #1F1F1F   #444746     #747775   #ADADAD          │
│  标题/正文   次要文字    辅助信息   禁用状态        │
└──────────────────────────────────────────────────┘

Outline（边框）
┌──────────────────────────────────────────────────┐
│  O-Default   O-Variant                            │
│  #C4C7C5    #E1E3E1                               │
│  普通边框     轻量分割线                            │
└──────────────────────────────────────────────────┘
```

### 2.2 语义色（诊断专用）

这组色彩承载产品核心含义——假设状态、置信度、证据充分性。

```
诊断语义色
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Evidence Sufficient（充分/支持）                                │
│  背景: #E6F4EA    文字: #137333    图标: #34A853                 │
│                                                                 │
│  Evidence Partial / Borderline（部分/待验证）                     │
│  背景: #FEF7E0    文字: #B06000    图标: #FBBC04                 │
│                                                                 │
│  Evidence Insufficient / Gap（不足/空白）                         │
│  背景: #FCE8E6    文字: #C5221F    图标: #EA4335                 │
│                                                                 │
│  Eliminated / Weakened（已排除/已削弱）                           │
│  背景: #F1F3F4    文字: #80868B    图标: #9AA0A6                 │
│                                                                 │
│  Neutral / Info（中性信息、叙事偏差提醒）                         │
│  背景: #E8F0FE    文字: #1967D2    图标: #4285F4                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 六层诊断色（Layer Colors）

六层诊断板的每一层有独立的识别色，用于层级标签和假设卡片的层级 badge。选自 Google 的扩展色板，保持高辨识度但不刺眼：

| 层级 | 标签色（背景） | 标签色（文字） | 用途 |
|------|-------------|-------------|------|
| Business | `#E8F0FE` | `#1967D2` | 蓝 — 业务/战略 |
| Performance | `#E6F4EA` | `#137333` | 绿 — 绩效/行为 |
| Capability | `#FCE8E6` | `#C5221F` | 红 — 能力/知识 |
| Environment | `#FEF7E0` | `#B06000` | 橙 — 工具/流程 |
| Management | `#F3E8FD` | `#7627BB` | 紫 — 管理/辅导 |
| Motivation | `#FDE7E0` | `#B3261E` | 珊瑚 — 意愿/信念 |

### 2.4 深色模式

P0 不做深色模式。P1 通过 Tailwind 的 `dark:` 前缀和 CSS 变量切换实现。所有色彩均以 CSS 变量定义，预留切换能力。

---

## 三、字体系统

### 3.1 字体族

```css
--font-sans: 'Google Sans', 'Noto Sans SC', system-ui, sans-serif;
--font-mono: 'Google Sans Mono', 'Noto Sans Mono CJK SC', monospace;
```

- **Google Sans**：拉丁字符首选，Google 产品的标准字体
- **Noto Sans SC**：中文首选，Google 出品，与 Google Sans 视觉协调
- 回退到 `system-ui` 保证无字体加载时仍可读

### 3.2 字体比例（Type Scale）

遵循 Material Design 3 Type Scale，适配中文内容：

| Token | 大小 | 行高 | 字重 | 用途 |
|-------|------|------|------|------|
| `display-medium` | 28px | 36px | 400 | 页面主标题（项目名称） |
| `headline-small` | 20px | 28px | 500 | 面板区块标题（"竞争假设""六层诊断板"） |
| `title-medium` | 16px | 24px | 500 | 卡片标题（假设内容、关键时刻标题） |
| `title-small` | 14px | 20px | 500 | 次级标题（字段标签："表层请求""业务意图"） |
| `body-large` | 16px | 24px | 400 | 正文（对话消息、摘要内容） |
| `body-medium` | 14px | 20px | 400 | 次要正文（证据列表、来源标注） |
| `body-small` | 12px | 16px | 400 | 辅助文字（时间戳、字数统计） |
| `label-large` | 14px | 20px | 500 | 按钮文字、操作标签 |
| `label-medium` | 12px | 16px | 500 | Badge 文字（层级标签、状态标签） |

### 3.3 中文排版特殊处理

- 中文正文行高统一使用 1.75 倍（`body-large` 的 24px / 16px = 1.5 对拉丁足够，中文加到 `line-height: 1.75`）
- 中文段落间距：`margin-bottom: 12px`（比拉丁多 4px）
- 中西混排时字体自动 fallback，不需要手动切换

---

## 四、间距与栅格

### 4.1 间距基数

**Base unit: 4px**。所有间距为 4 的倍数。

| Token | 值 | 用途 |
|-------|----|------|
| `space-1` | 4px | 图标与文字间距、极小间隙 |
| `space-2` | 8px | 紧凑元素间距（badge 内边距、标签间距） |
| `space-3` | 12px | 列表项间距、卡片内元素间距 |
| `space-4` | 16px | 卡片内边距、区块内部边距 |
| `space-5` | 20px | 区块标题与内容间距 |
| `space-6` | 24px | 面板区块之间的间距 |
| `space-8` | 32px | 大区域之间的间距 |
| `space-10` | 40px | 页面级别间距 |

### 4.2 面板布局

```
┌──────────────────────────────────────────────────────┐
│  Top Bar: height 56px, padding 0 16px                │
├────────────────────────┬─────────────────────────────┤
│  Left Panel            │  Right Panel                │
│  padding: 0            │  padding: 16px              │
│                        │                             │
│  Message gap: 12px     │  Section gap: 24px          │
│  Input area h: 56-120px│  Card gap: 12px             │
│                        │  Card padding: 16px         │
│  width: 45% (default)  │  width: 55% (default)       │
├────────────────────────┴─────────────────────────────┤
│  Resizer: 8px wide, cursor: col-resize               │
└──────────────────────────────────────────────────────┘
```

左面板**无内边距**——消息气泡贴到面板边缘，像 Google Chat 一样。
右面板有 16px 内边距——卡片和区块需要呼吸空间。

---

## 五、圆角与阴影

### 5.1 圆角

Material Design 3 大幅增加了圆角半径。本产品遵循 MD3 Shape Scale：

| Token | 值 | 用途 |
|-------|----|------|
| `radius-xs` | 4px | 小元素（badge、进度条端点） |
| `radius-sm` | 8px | 输入框、次级按钮 |
| `radius-md` | 12px | 卡片（假设卡片、关键时刻卡片） |
| `radius-lg` | 16px | 大面板（问题转译卡、干预建议卡片） |
| `radius-xl` | 28px | 胶囊按钮、搜索框、输入区 |
| `radius-full` | 50% | 头像、圆形图标按钮 |

### 5.2 阴影（Elevation）

Material Design 3 倡导 **Tonal Elevation**（通过表面色深浅暗示层级）而非重阴影。本产品极度克制使用阴影。

| Level | 样式 | 用途 |
|-------|------|------|
| Level 0 | 无阴影，`bg: S-0 (#FFF)` | 面板基底 |
| Level 1 | 无阴影，`bg: S-1 (#F8FAFD)` | 假设卡片、转译卡（tonal elevation） |
| Level 2 | `shadow-sm: 0 1px 3px rgba(0,0,0,0.08)` | Hover 状态的卡片、弹出菜单 |
| Level 3 | `shadow-md: 0 4px 12px rgba(0,0,0,0.12)` | 浮层（操作菜单、冲突弹窗） |

**规则**：静止状态不出现投影，hover / active / floating 才有。面板内卡片默认用 tonal elevation（微微不同的背景色），而非投影。

---

## 六、核心组件规范

### 6.1 对话气泡

```
┌──────── 用户消息 ────────────────────────────────┐
│                                                   │
│  ┌───────────────────────────────────────────┐    │
│  │  "我们想给店长做一场执行力培训，上周       │    │
│  │   门店活动落地参差不齐。"                   │    │
│  └───────────────────────────────────────────┘    │
│  bg: #E8F0FE (Primary container)                  │
│  text: #1F1F1F                                    │
│  border-radius: 20px 20px 4px 20px                │
│  padding: 12px 16px                               │
│  max-width: 85%                                   │
│  align: right                                     │
│                                                   │
│                                                   │
│  ┌───────────────────────────────────────────┐    │
│  │  好的，我先帮你拆一下这个需求。           │    │
│  │  目前看起来...                             │    │
│  └───────────────────────────────────────────┘    │
│  bg: #FFFFFF                                      │
│  border: 1px solid #E1E3E1                        │
│  border-radius: 20px 20px 20px 4px                │
│  padding: 12px 16px                               │
│  max-width: 85%                                   │
│  align: left                                      │
│                                                   │
│                                                   │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐    │
│    ○ 讲师修改了 H2 的描述                          │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘    │
│  系统消息 —— 无背景色/无边框                       │
│  text: #747775 (On-Surface Low)                   │
│  font: body-small                                 │
│  align: center                                    │
│  前缀图标: ○ (8px circle, #747775)                │
└───────────────────────────────────────────────────┘
```

**用户消息**：右对齐，蓝底白字（Primary Container），参照 Google Messages。
**Agent 消息**：左对齐，白底灰描边，参照 Google Chat 风格。
**系统消息**：居中，无边框，低饱和灰色小字，前缀一个小圆点。极度轻量。

**流式输出**：Agent 消息在流式传输中，末尾有一个呼吸闪烁的光标 `▍`（`#1A73E8`，opacity 从 1 到 0.3 循环，周期 800ms）。

### 6.2 假设卡片（Hypothesis Card）

这是面板中最核心、最复杂的组件。

```
┌─────────────────────────────────────────────────┐
│  ┌─────────┐                                    │
│  │ 能力层  │ ← Layer Badge                      │
│  └─────────┘                                    │
│                                                 │
│  不知道标准流程  ← 假设内容 (title-medium, 500)   │
│                                                 │
│  ┌─━━━━━━━░░░░░░░░░░░░░░━┐ ← 置信度条          │
│  └────────────────────────┘                     │
│  低置信                                          │
│                                                 │
│  ▸ 支持证据 (2)    ▸ 反对证据 (0)                │
│                                                 │
│  ┌────────────────┐ ← 状态标签                   │
│  │  ● 待验证       │                              │
│  └────────────────┘                              │
└─────────────────────────────────────────────────┘

尺寸与样式：
  width: 100% (在假设区内以列表排列) 或 固定宽度卡片（水平排列时）
  bg: S-1 (#F8FAFD)
  border: 1px solid O-Variant (#E1E3E1)
  border-radius: radius-md (12px)
  padding: space-4 (16px)
  gap between cards: space-3 (12px)

Hover 态：
  bg: S-2 (#EEF3FA)
  shadow: Level 2
  右上角浮现操作图标组（三个 icon button，见下方）

已排除态：
  bg: #F1F3F4
  opacity: 0.7
  所有文字 color: #80868B
  置信度条灰色
  状态标签: "已排除" (Eliminated 语义色)
```

**Layer Badge**：

```
  bg: 层级对应色（见 2.3 六层诊断色）
  text: 层级对应文字色
  font: label-medium (12px, 500)
  padding: 2px 8px
  border-radius: radius-xs (4px)
  height: 20px
```

**置信度条（Confidence Bar）**：

```
  height: 4px
  border-radius: 2px
  track bg: #E1E3E1
  fill color: 根据级别变化
    none:   #E1E3E1 (空)
    low:    #FBBC04 (黄)
    medium: #34A853 (绿, 60%)
    high:   #34A853 (绿, 100%)
  可拖拽调整 → 拖拽时 fill 实时变化，释放后吸附到最近的档位
```

**Hover 操作图标**：

```
  三个 24px icon button，水平排列，右上角
  ┌────┐ ┌────┐ ┌────┐
  │ 💬 │ │ ⚖️ │ │ ✕  │
  └────┘ └────┘ └────┘
  深入追问  反面证据  排除

  icon: outlined style (Material Symbols)
  bg: transparent → hover: S-2 → active: S-3
  border-radius: radius-full
  tooltip on hover (Material tooltip, 无延迟)
```

### 6.3 六层诊断行（Diagnostic Layer Row）

```
┌─────────────────────────────────────────────────────┐
│  ▸  🏢 Business 层        ━━━━━━━━░░░░░  部分       │
│     ↑           ↑          ↑              ↑         │
│   Chevron    Layer Icon  Layer Name   Progress Bar  │
│   12px       20px        title-small   Status Label │
└─────────────────────────────────────────────────────┘

默认态（收起）：
  height: 48px
  padding: 0 16px
  bg: transparent
  hover bg: S-1
  border-bottom: 1px solid O-Variant
  cursor: pointer

展开态：
  Chevron 旋转 90°（transition: 200ms ease）
  下方展开内容区：
    padding: 12px 16px 16px 52px （左侧缩进对齐 layer name）
    bg: S-1

Progress Bar（层级进度）：
  width: 80px
  height: 4px
  三段式填充：
    blank:      全灰 (#E1E3E1)
    partial:    50% 填充，对应语义色 Partial (#FBBC04)
    sufficient: 100% 填充，对应语义色 Sufficient (#34A853)

Status Label：
  font: label-medium
  color: 对应语义色文字色
```

### 6.4 全局证据充分度指示器

位于顶栏（Top Bar）中央位置。

```
  ┌──────────────────────────────────┐
  │  ● 关键判断仍缺证据               │  ← Insufficient
  │  bg: #FCE8E6  text: #C5221F      │
  └──────────────────────────────────┘

  ┌──────────────────────────────────┐
  │  ● 可生成初步建议                  │  ← Borderline
  │  bg: #FEF7E0  text: #B06000      │
  └──────────────────────────────────┘

  ┌──────────────────────────────────┐
  │  ● 可进入下一阶段                  │  ← Sufficient
  │  bg: #E6F4EA  text: #137333      │
  └──────────────────────────────────┘

  样式：
    padding: 4px 12px
    border-radius: radius-xl (28px) — 胶囊形
    font: label-large
    前缀: 8px 实心圆，颜色同文字
    transition: bg/text 300ms ease（状态切换时平滑过渡）
```

### 6.5 问题转译卡

```
┌──────────────────────────────────────────────────┐
│  📋 问题转译                    ← headline-small │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │  表层请求                                │    │
│  │  给店长做执行力培训  [编辑图标]           │    │
│  ├──────────────────────────────────────────┤    │
│  │  业务意图                                │    │
│  │  门店活动落地不一致  [编辑图标]           │    │
│  ├──────────────────────────────────────────┤    │
│  │  行为假设                                │    │
│  │  店长未按标准完成跟进  [编辑图标]         │    │
│  ├──────────────────────────────────────────┤    │
│  │  成因假设                                │    │
│  │  责任心不足 / 管理弱  [编辑图标]         │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │  ⚠  叙事偏差风险                         │    │
│  │  把"执行差"过早解释为"态度差"             │    │
│  └──────────────────────────────────────────┘    │
│  Warning banner:                                 │
│    bg: Neutral/Info bg (#E8F0FE)                 │
│    border-left: 3px solid #4285F4                │
│    border-radius: 0 radius-sm radius-sm 0        │
└──────────────────────────────────────────────────┘

外框：
  bg: S-0 (#FFF)
  border: 1px solid O-Default (#C4C7C5)
  border-radius: radius-lg (16px)
  padding: space-5 (20px)

字段行：
  label: title-small, On-Surface Medium (#444746)
  value: body-large, On-Surface High (#1F1F1F)
  分割线: 1px solid O-Variant (#E1E3E1)
  编辑图标: 默认隐藏, hover 行时出现 (pencil icon, 18px, #747775)
  编辑态: value 变为 input field, border-bottom: 2px solid Primary
```

### 6.6 干预建议卡片

```
┌──────────────────────────────┐
│  方案 A                       │ ← title-medium, 500
│                               │
│  训练为主，配合经理 follow-up  │ ← body-medium
│                               │
│  适用条件                     │ ← title-small, On-Surface Medium
│  主要障碍是技能不熟练...       │ ← body-medium
│                               │
│  风险                         │
│  经理不跟进导致转化失败        │
│                               │
│  评估方式                     │
│  训后 2 周观察客户拜访...      │
│                               │
│  ┌──────────────────────────┐ │
│  │      选择此方案           │ │ ← Filled button, Primary
│  └──────────────────────────┘ │
└──────────────────────────────┘

常规方案：
  bg: S-1
  border: 1px solid O-Variant
  border-radius: radius-lg (16px)

"不建议培训"方案：
  bg: #FEF7E0 (Partial/Warning 背景)
  border: 1px solid #FBBC04
  左上角有 ⚠ 图标

选中态：
  border: 2px solid Primary (#1A73E8)
  左上角出现 ✓ checkmark badge
```

### 6.7 按钮

遵循 Material Design 3 Button 规范：

| 类型 | 样式 | 用途 |
|------|------|------|
| **Filled** | bg: Primary, text: white, radius: `radius-xl` (28px), h: 40px | 主要操作（选择方案、导出） |
| **Outlined** | bg: transparent, border: 1px solid O-Default, radius: `radius-xl`, h: 40px | 次要操作（添加假设、添加关键时刻） |
| **Text** | bg: transparent, text: Primary, h: 40px | 轻量操作（深入追问、编辑） |
| **Icon** | 40x40px, radius: `radius-full`, bg: transparent → hover: S-1 | 工具栏图标（折叠面板、更多操作） |
| **FAB** | 56x56px, radius: 16px, bg: S-3, shadow: Level 2 | 无（本产品不使用 FAB） |

### 6.8 输入区

对话面板底部的消息输入区：

```
┌──────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────┐  ┌──────┐  │
│  │  输入诊断相关信息，或粘贴业务方消息... │  │  ➤  │  │
│  │                                      │  │      │  │
│  └──────────────────────────────────────┘  └──────┘  │
│  [📎]                                                 │
└──────────────────────────────────────────────────────┘

输入框：
  bg: S-1 (#F8FAFD)
  border: 1px solid O-Default (#C4C7C5)
  border-radius: radius-xl (28px)
  padding: 12px 16px
  min-height: 48px
  max-height: 120px (auto expand)
  font: body-large
  placeholder: On-Surface Low (#747775)
  focus: border-color → Primary, shadow: 0 0 0 2px rgba(26,115,232,0.2)

发送按钮：
  width: 40px, height: 40px
  bg: Primary (#1A73E8) → 有内容时
  bg: #E1E3E1 → 无内容时（disabled）
  icon: send arrow (white, 20px)
  border-radius: radius-full

附件按钮：
  位于输入框左下方
  icon: paperclip, 20px, #747775
  hover: #444746
```

---

## 七、动效规范

### 7.1 基础 Easing

遵循 Material Design 3 Motion：

| Token | Easing | Duration | 用途 |
|-------|--------|----------|------|
| `standard` | `cubic-bezier(0.2, 0, 0, 1)` | 300ms | 通用过渡 |
| `standard-decelerate` | `cubic-bezier(0, 0, 0, 1)` | 250ms | 元素入场 |
| `standard-accelerate` | `cubic-bezier(0.3, 0, 1, 1)` | 200ms | 元素退场 |
| `emphasized` | `cubic-bezier(0.2, 0, 0, 1)` | 500ms | 重要变化（面板区块入场） |

### 7.2 面板区块入场

新区块出现时：

```css
.section-enter {
  animation: sectionReveal 500ms cubic-bezier(0.2, 0, 0, 1) forwards;
}

@keyframes sectionReveal {
  from {
    opacity: 0;
    max-height: 0;
    transform: translateY(-8px);
    margin-bottom: 0;
  }
  to {
    opacity: 1;
    max-height: 600px;
    transform: translateY(0);
    margin-bottom: 24px;
  }
}
```

### 7.3 面板字段更新高亮

Agent 更新面板字段时，变更字段短暂高亮：

```css
.field-updated {
  animation: updateFlash 1500ms ease-out;
}

@keyframes updateFlash {
  0%   { background-color: #E8F0FE; }
  100% { background-color: transparent; }
}
```

浅蓝色（Primary Container）闪烁 1.5 秒后消退，让讲师注意到变化但不干扰阅读。

### 7.4 Chevron 旋转（手风琴展开）

```css
.chevron {
  transition: transform 200ms cubic-bezier(0.2, 0, 0, 1);
}
.chevron--expanded {
  transform: rotate(90deg);
}
```

### 7.5 状态指示器过渡

证据充分度指示器在红/黄/绿之间切换时：

```css
.sufficiency-indicator {
  transition: background-color 300ms ease, color 300ms ease;
}
```

---

## 八、交互模式

### 8.1 Inline Editing

所有面板上的可编辑字段采用 **click-to-edit** 模式，不需要进入独立编辑态：

```
阅读态:
  "门店活动落地不一致"  [hover时右侧浮现铅笔图标]

编辑态 (click 后):
  ┌───────────────────────────────────────┐
  │ 门店活动落地不一致▍                    │
  └───────────────────────────────────────┘
  底部出现 2px Primary 下划线
  自动 focus + 全选
  Enter 保存 / Esc 取消 / 点击外部保存
  保存后短暂显示 ✓ (300ms) 表示已保存
```

**规则**：
- 不使用模态弹窗（Modal）编辑——所有编辑都在原地完成
- 长文本字段（如"摘要"）使用 auto-expanding textarea
- 编辑完成后立即保存（不需要手动点保存按钮）

### 8.2 Hover 操作菜单

假设卡片和其他交互元素的 hover 菜单：

```
触发: 鼠标进入卡片区域
延迟: 无延迟，立即显示
位置: 卡片右上角
样式: 透明背景的图标按钮组
退出: 鼠标离开卡片区域时隐藏（150ms 延迟防误触）

图标使用 Material Symbols Outlined:
  chat_bubble_outline  → 深入追问
  balance              → 寻找反面证据
  fact_check           → 帮我设计验证方式
  close                → 排除此假设
```

### 8.3 拖拽分隔线

左右面板之间的 Resizer：

```
默认: 宽 1px, 颜色 O-Variant (#E1E3E1)
Hover: 宽 4px, 颜色 Primary (#1A73E8), cursor: col-resize
拖拽中: 宽 4px, 颜色 Primary, 两侧面板实时 resize
约束: 左面板最小 30%, 最大 65%
```

### 8.4 冲突弹窗

Agent 更新了讲师刚编辑的字段时弹出：

```
┌───────────────────────────────────────────┐
│                                           │
│  ⚡ Agent 对此也有新判断                    │
│                                           │
│  字段：H2 — 置信度                         │
│                                           │
│  你的修改：高                              │
│  Agent 判断：中                            │
│                                           │
│  ┌──────────────┐  ┌──────────────┐       │
│  │  保留我的修改  │  │  采纳 Agent  │       │
│  └──────────────┘  └──────────────┘       │
│                                           │
└───────────────────────────────────────────┘

样式:
  Surface Level 3 (shadow-md)
  border-radius: radius-lg (16px)
  padding: space-6 (24px)
  max-width: 360px
  出现: fade in + scale from 0.95 (200ms)
  背景: 无遮罩（非模态），但弹窗外点击即关闭（默认保留用户修改）
```

---

## 九、图标系统

使用 **Material Symbols Outlined**（Google 最新图标集，variable font）。

### 9.1 图标参数

```css
.material-symbols-outlined {
  font-variation-settings:
    'FILL' 0,       /* Outlined 风格 */
    'wght' 300,     /* 默认线条粗细 */
    'GRAD' 0,       /* 无 gradient */
    'opsz' 24;      /* 光学尺寸 */
}
```

### 9.2 各处图标映射

| 用途 | 图标名 | 尺寸 |
|------|--------|------|
| 发送消息 | `send` | 20px |
| 附件 | `attach_file` | 20px |
| 编辑 | `edit` | 18px |
| 深入追问 | `chat_bubble_outline` | 20px |
| 反面证据 | `balance` | 20px |
| 验证方式 | `fact_check` | 20px |
| 排除假设 | `close` | 20px |
| 恢复假设 | `undo` | 20px |
| 添加 | `add` | 20px |
| 导出 | `download` | 20px |
| 展开/收起 | `chevron_right` | 20px |
| 折叠面板 | `right_panel_close` | 20px |
| 展开面板 | `right_panel_open` | 20px |
| 快照/历史 | `history` | 20px |
| 保存 | `save` | 20px |
| 项目列表 | `folder_open` | 20px |
| Business 层 | `business_center` | 20px |
| Performance 层 | `trending_up` | 20px |
| Capability 层 | `psychology` | 20px |
| Environment 层 | `build` | 20px |
| Management 层 | `supervisor_account` | 20px |
| Motivation 层 | `emoji_objects` | 20px |

---

## 十、响应式策略

### 10.1 断点

| 断点 | 宽度 | 布局 |
|------|------|------|
| Desktop (default) | ≥ 1024px | 双面板并列 |
| Tablet | 768-1023px | 双面板并列，但默认右面板收起，通过按钮展开为覆盖层 |
| Mobile | < 768px | P0 不做。P2 考虑单面板 + 底部 tab 切换 |

### 10.2 最小尺寸

- 整体最小宽度：1024px（P0 阶段，面向桌面用户）
- 左面板最小宽度：320px
- 右面板最小宽度：400px

---

## 十一、Tailwind 配置参考

将上述 Design System 落实为 Tailwind 配置：

```javascript
// tailwind.config.js (核心摘录)

module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1A73E8',
          10: '#041E49',
          20: '#062E6F',
          30: '#0842A0',
          40: '#1A73E8',
          50: '#4C8DF6',
          60: '#7CACF8',
          container: '#E8F0FE',
        },
        surface: {
          dim: '#F0F4F9',
          DEFAULT: '#FFFFFF',
          1: '#F8FAFD',
          2: '#EEF3FA',
          3: '#E3EAF4',
        },
        'on-surface': {
          high: '#1F1F1F',
          medium: '#444746',
          low: '#747775',
          disabled: '#ADADAD',
        },
        outline: {
          DEFAULT: '#C4C7C5',
          variant: '#E1E3E1',
        },
        semantic: {
          'sufficient-bg': '#E6F4EA',
          'sufficient-text': '#137333',
          'sufficient-icon': '#34A853',
          'partial-bg': '#FEF7E0',
          'partial-text': '#B06000',
          'partial-icon': '#FBBC04',
          'insufficient-bg': '#FCE8E6',
          'insufficient-text': '#C5221F',
          'insufficient-icon': '#EA4335',
          'eliminated-bg': '#F1F3F4',
          'eliminated-text': '#80868B',
          'eliminated-icon': '#9AA0A6',
          'info-bg': '#E8F0FE',
          'info-text': '#1967D2',
          'info-icon': '#4285F4',
        },
        layer: {
          'business-bg': '#E8F0FE',
          'business-text': '#1967D2',
          'performance-bg': '#E6F4EA',
          'performance-text': '#137333',
          'capability-bg': '#FCE8E6',
          'capability-text': '#C5221F',
          'environment-bg': '#FEF7E0',
          'environment-text': '#B06000',
          'management-bg': '#F3E8FD',
          'management-text': '#7627BB',
          'motivation-bg': '#FDE7E0',
          'motivation-text': '#B3261E',
        },
      },
      borderRadius: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '28px',
      },
      fontFamily: {
        sans: ['Google Sans', 'Noto Sans SC', 'system-ui', 'sans-serif'],
        mono: ['Google Sans Mono', 'Noto Sans Mono CJK SC', 'monospace'],
      },
      fontSize: {
        'display-md': ['28px', { lineHeight: '36px', fontWeight: '400' }],
        'headline-sm': ['20px', { lineHeight: '28px', fontWeight: '500' }],
        'title-md': ['16px', { lineHeight: '24px', fontWeight: '500' }],
        'title-sm': ['14px', { lineHeight: '20px', fontWeight: '500' }],
        'body-lg': ['16px', { lineHeight: '28px', fontWeight: '400' }],
        'body-md': ['14px', { lineHeight: '24px', fontWeight: '400' }],
        'body-sm': ['12px', { lineHeight: '16px', fontWeight: '400' }],
        'label-lg': ['14px', { lineHeight: '20px', fontWeight: '500' }],
        'label-md': ['12px', { lineHeight: '16px', fontWeight: '500' }],
      },
      spacing: {
        'space-1': '4px',
        'space-2': '8px',
        'space-3': '12px',
        'space-4': '16px',
        'space-5': '20px',
        'space-6': '24px',
        'space-8': '32px',
        'space-10': '40px',
      },
      boxShadow: {
        'level-2': '0 1px 3px rgba(0,0,0,0.08)',
        'level-3': '0 4px 12px rgba(0,0,0,0.12)',
      },
      keyframes: {
        sectionReveal: {
          from: { opacity: '0', maxHeight: '0', transform: 'translateY(-8px)' },
          to: { opacity: '1', maxHeight: '600px', transform: 'translateY(0)' },
        },
        updateFlash: {
          '0%': { backgroundColor: '#E8F0FE' },
          '100%': { backgroundColor: 'transparent' },
        },
        cursorBlink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
      },
      animation: {
        'section-reveal': 'sectionReveal 500ms cubic-bezier(0.2,0,0,1) forwards',
        'update-flash': 'updateFlash 1500ms ease-out',
        'cursor-blink': 'cursorBlink 800ms ease-in-out infinite',
      },
    },
  },
};
```
