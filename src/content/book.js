// Page copy and sequence are data; paper geometry and controls do not own it.
export const sequence={opening:1800,firstPause:500,leafTurn:1050,mixedPause:500,riffling:2000,titlePause:1000,prologuePause:1000};
export const copy={
 'zh-TW':{coverEyebrow:'故事仍在書寫',coverHeading:'把生活裁剪成喜歡的樣子',title:'Peiry Tale｜把生活剪裁成喜歡的樣子',description:'翻開 Peiry Tale，讓日常，也值得寫成童話。',open:'翻開這本書',language:'English',quiet:'靜謐閱讀',motion:'開啟動態',contents:'書頁',close:'關閉',cover:'回到封面',previous:'上一頁',next:'下一頁',skip:'跳過開場',replay:'重播開場',pause:'暫停',resume:'繼續播放',rotateBook:'旋轉書本',rotateHelp:'拖曳或使用方向鍵旋轉封面，Home 重設角度；Enter 翻開書。',rotateHint:'按住書本拖曳，查看各個角度',playing:'開場播放中',paused:'開場已暫停',complete:'空白頁',chapters:[
  {id:'endpapers',label:'黑色扉頁',left:'black',right:'black'},
  {id:'first-leaf',label:'第一張白頁',left:'black',right:'white'},
  {id:'title-page',leftLeaves:6,label:'Peiry Tale',left:'white',right:'white',heading:'peiry tale',subtitle:'把生活剪裁成喜歡的樣子'},
  {id:'prologue',leftLeaves:7,label:'序章',left:'white',right:'white',eyebrow:'I / prologue',heading:'日常，也值得寫成童話。'},
  {id:'blank',leftLeaves:8,label:'空白頁',left:'white',right:'white'}]},
 en:{coverEyebrow:'A STORY STILL UNFOLDING',coverHeading:'Shape everyday life into what you love',title:'Peiry Tale | Shape everyday life into what you love',description:'Open Peiry Tale. Everyday life deserves a fairytale, too.',open:'Open this book',language:'繁體中文',quiet:'Quiet reading',motion:'Enable motion',contents:'Pages',close:'Close',cover:'Back to cover',previous:'Previous page',next:'Next page',skip:'Skip introduction',replay:'Replay introduction',pause:'Pause',resume:'Resume',rotateBook:'Rotate the book',rotateHelp:'Drag or use arrow keys to rotate the cover. Home resets the angle; Enter opens the book.',rotateHint:'Hold and drag to see the book from every angle',playing:'Introduction playing',paused:'Introduction paused',complete:'Blank pages',chapters:[
  {id:'endpapers',label:'Black endpapers',left:'black',right:'black'},
  {id:'first-leaf',label:'First white leaf',left:'black',right:'white'},
  {id:'title-page',leftLeaves:6,label:'Peiry Tale',left:'white',right:'white',heading:'peiry tale',subtitle:'Shape everyday life into what you love',lines:['Shape everyday life','into what you love']},
  {id:'prologue',leftLeaves:7,label:'Prologue',left:'white',right:'white',eyebrow:'I / prologue',heading:'Everyday life deserves a fairytale, too.',lines:['Everyday life deserves','a fairytale, too.']},
  {id:'blank',leftLeaves:8,label:'Blank pages',left:'white',right:'white'}]}
};

export const pageTypography={
 family:'Georgia, "Noto Serif CJK TC", "Noto Serif TC", "Songti TC", serif',weight:400,
 label:{desktop:30,mobile:49},heading:{desktop:49,mobile:70},englishHeading:{desktop:48,mobile:64},
 layout:{x:530,labelY:554,headingY:690,lineHeight:80,maxWidth:820,labelColor:'#8c806c',headingColor:'#635c50'}
};
export const pageTextRows=page=>({label:page.eyebrow||page.heading||'',text:page.subtitle||page.heading||'',lines:page.lines||[page.subtitle||page.heading||'']});
export const pageStackAmount=page=>(page.leftLeaves||0)/40;
