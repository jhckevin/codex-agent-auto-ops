import fs from 'node:fs';
import path from 'node:path';
const valid=value=>['zh-CN','en'].includes(value)?value:null;
export function pluginLocale(directory,env=process.env){
 if(valid(env.AGENT_AUTO_OPS_LOCALE))return env.AGENT_AUTO_OPS_LOCALE;
 try{return valid(JSON.parse(fs.readFileSync(path.resolve(directory,'../locale.json'),'utf8')).locale)||'en';}catch{return 'en';}
}
const descriptions={
 kvm_status:'查看已绑定的外部目标、后端、能力和模拟标识；不发送输入。',
 kvm_observe:'获取目标设备的新画面。wait_for_change 可在本地等待变化，最多 timeout_ms，避免模型重复轮询。已确认的移动设备镜像模式可能在采集前自动执行一个计数的指针保活。',
 kvm_act:'使用最新观察执行一次 UI 意图，返回操作后画面、分阶段耗时与变化诊断。move_relative 支持每轴正负 8192 HID 计数，后台自动拆分。fill_text 替换已聚焦字段，可通过 submit=true 提交，最多 120 个 ASCII 字符。operation_id 必须唯一，重复调用会去重。坐标为该次观察的图像像素。click_current/scroll_current 使用可见的当前系统指针，调用前先确认位置。ticks 大于 0 向上滚动。文本仅支持可打印 US ASCII。结果未知时先观察，禁止直接重试。',
 kvm_set_view_context:'将已观察画面标记为 mirror、dex、extended、desktop 或 unknown；不修改目标系统的显示设置。已确认的 Android/iPadOS 镜像模式启用自动指针保活，其余模式关闭保活。',
 kvm_stop:'停止当前会话，并在支持时释放 HID 输入。再次开启需要显式重启插件进程。'
};
export function localizeTools(tools,locale){return locale==='zh-CN'?tools.map(tool=>({...tool,description:descriptions[tool.name]??tool.description})):tools;}
