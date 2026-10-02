export const messages = {
 'zh-CN': {
  pageTitle:'Agent 自动运维 · 实时工作台',brand:'Agent 自动运维',subtitle:'实时工作台',language:'界面语言',
  targetLabel:'目标设备',defaultTarget:'外部设备',live:'实时画面',noSignal:'信号未就绪',
  waitingVideo:'等待视频',connected:'视频已连接',stopped:'会话已停止',disconnected:'连接已中断',
  waitingTitle:'等待设备画面',waitingDescription:'连接 HDMI 采集卡后，画面将显示在这里。',
  imageAlt:'目标设备实时画面',marker:'Agent 操作位置',waitingFrame:'等待新画面',framePending:'画面 —',memoryPending:'服务内存 —',
  age:'画面距今 {value} ms',frame:'画面 {value}',memory:'服务内存 {value} MB',videoInput:'视频输入',notConfigured:'未配置',
  viewerHint:'关闭本页不影响后台操作。绿色标记表示指令位置，实际指针请以设备画面为准。',
  agent:'Agent',agentDetail:'观察与决策',adapter:'操作适配器',target:'目标设备',targetDetail:'键鼠控制与画面返回',
  usbWaiting:'等待 USB 连接',usbConnected:'USB 已连接',inputReady:'输入通道就绪',
  session:'当前会话',activity:'操作记录',activityHint:'指令发送后，由 Agent 继续观察并确认结果。',
  emptyTitle:'暂无操作记录',emptyDetail:'Agent 开始操作后，记录将显示在这里。',
  observer:'仅供观察',observerDetail:'键鼠操作由 Agent 插件执行。',retryCapture:'等待采集卡重新连接',
  captureExited:'采集已暂停，请检查采集卡连接。',captureOffline:'视频信号暂不可用。',serviceOffline:'无法连接后台服务。',
  started:'正在操作',awaiting_visual_verification:'已发送 · 等待观察确认',unknown:'结果待确认',
  click:'点击',move:'移动指针',move_relative:'相对移动',click_current:'当前位置点击',
  scroll:'滚动',scroll_current:'当前位置滚动',drag:'拖动',wait:'等待',type_text:'输入 {count} 个字符',
  fill_text:'填写 {count} 个字符',key:'按键',action:'设备操作',simulation:'演示画面'
 },
 en: {
  pageTitle:'Agent Auto Ops · Live workspace',brand:'Agent Auto Ops',subtitle:'Live workspace',language:'Interface language',
  targetLabel:'Target device',defaultTarget:'External device',live:'Live view',noSignal:'No video signal',
  waitingVideo:'Waiting for video',connected:'Video connected',stopped:'Session stopped',disconnected:'Disconnected',
  waitingTitle:'Waiting for your device',waitingDescription:'Connect an HDMI capture card to see your device here.',
  imageAlt:'Live view of the target device',marker:'Agent action position',waitingFrame:'Waiting for a new frame',framePending:'Frame —',memoryPending:'Service memory —',
  age:'Frame age {value} ms',frame:'Frame {value}',memory:'Service memory {value} MB',videoInput:'Video input',notConfigured:'Not configured',
  viewerHint:'Closing this page keeps the session running. Green markers show action positions; check the device image for the actual cursor.',
  agent:'Agent',agentDetail:'Observe & decide',adapter:'Control adapter',target:'Target device',targetDetail:'Input & video feedback',
  usbWaiting:'Waiting for USB',usbConnected:'USB connected',inputReady:'Input ready',
  session:'Current session',activity:'Activity',activityHint:'After sending an action, the Agent observes the result to verify it.',
  emptyTitle:'No activity yet',emptyDetail:'Actions appear here when the Agent starts working.',
  observer:'View only',observerDetail:'The Agent plugin handles keyboard and mouse input.',retryCapture:'Waiting for the capture card to reconnect',
  captureExited:'Capture paused. Check the capture card connection.',captureOffline:'The video signal is unavailable.',serviceOffline:'Cannot reach the background service.',
  started:'In progress',awaiting_visual_verification:'Sent · awaiting visual verification',unknown:'Outcome unconfirmed',
  click:'Click',move:'Move pointer',move_relative:'Relative move',click_current:'Click at cursor',
  scroll:'Scroll',scroll_current:'Scroll at cursor',drag:'Drag',wait:'Wait',type_text:'Type {count} characters',
  fill_text:'Fill {count} characters',key:'Key press',action:'Device action',simulation:'Demo view'
 }
};
export const validLocale=value=>Object.hasOwn(messages,value)?value:null;
export function translator(locale){const dict=messages[validLocale(locale)||'zh-CN'];return (key,args={})=>(dict[key]??key).replace(/\{(\w+)\}/g,(_,name)=>String(args[name]??''));}
const legacy={点击:'click',移动指针:'move',相对移动:'move_relative',当前位置点击:'click_current',当前位置滚动:'scroll_current',滚动:'scroll',拖动:'drag',等待:'wait'};
export function actionLabel(event,t){
 if(event.action_kind){
  if(event.action_kind==='press_key')return event.key_chord||t('key');
  return t(event.action_kind,{count:event.character_count??0});
 }
 const label=event.label||'';
 if(legacy[label])return t(legacy[label]);
 const typed=/^输入 (\d+) 个字符$/.exec(label);
 return typed?t('type_text',{count:typed[1]}):label||t('action');
}
export function videoError(error,t){
 if(!error)return t('retryCapture');
 if(error==='Video process exited')return t('captureExited');
 if(error==='Video offline')return t('captureOffline');
 return String(error);
}
