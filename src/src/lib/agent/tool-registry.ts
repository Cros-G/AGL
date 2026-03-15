export interface RegisteredTool {
  name: string;
  description: string;
  status: 'active' | 'planned';
  implementation: 'claude_tool_use' | 'api_route' | 'context_injection';
}

export const registeredTools: RegisteredTool[] = [
  {
    name: 'update_diagnosis',
    description: 'Claude 调用此工具将诊断发现写入右侧面板（问题转译、假设、六层诊断等）',
    status: 'active',
    implementation: 'claude_tool_use',
  },
  {
    name: 'ask_questions',
    description: 'Claude 调用此工具向讲师提出结构化问题，渲染为交互式输入卡片',
    status: 'active',
    implementation: 'claude_tool_use',
  },
];
