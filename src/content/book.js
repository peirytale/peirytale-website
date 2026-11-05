// Page copy and sequence are data; paper geometry and controls do not own it.
export const sequence={opening:1800,firstPause:500*2/3,leafTurn:1050,mixedPause:500,riffling:2000};
export const pageHint={delay:1000,unfurl:1200,interval:3000,pulse:900};
export const copy={
 'zh-TW':{coverEyebrow:'故事仍在書寫',coverHeading:'把生活裁剪成喜歡的樣子',title:'Peiry Tale｜把生活剪裁成喜歡的樣子',description:'翻開 Peiry Tale，讓日常，也值得寫成童話。',open:'翻開這本書',language:'English',musicOn:'開啟音樂',musicOff:'關閉音樂',contents:'書頁',close:'關閉',cover:'回到封面',previous:'上一頁',next:'下一頁',rotateBook:'旋轉書本',rotateHelp:'拖曳或使用方向鍵旋轉封面，Home 重設角度；Enter 翻開書。',rotateHint:'按住書本拖曳，查看各個角度',playing:'開場播放中',complete:'城堡頁',chapters:[
  {id:'endpapers',label:'黑色扉頁',left:'black',right:'black'},
  {id:'first-leaf',label:'第一張白頁',left:'black',right:'white'},
  {id:'title-page',leftLeaves:6,label:'Peiry Tale',left:'white',right:'white',heading:'peiry tale',subtitle:'把生活剪裁成喜歡的樣子'},
  {id:'prologue',leftLeaves:7,label:'序章',left:'white',right:'white',eyebrow:'I / prologue',heading:'日常，也值得寫成童話。'},
  {id:'castle',leftLeaves:8,label:'城堡頁',left:'white',right:'white'}]},
 en:{coverEyebrow:'A STORY STILL UNFOLDING',coverHeading:'Shape everyday life into what you love',title:'Peiry Tale | Shape everyday life into what you love',description:'Open Peiry Tale. Everyday life deserves a fairytale, too.',open:'Open this book',language:'繁體中文',musicOn:'Turn music on',musicOff:'Turn music off',contents:'Pages',close:'Close',cover:'Back to cover',previous:'Previous page',next:'Next page',rotateBook:'Rotate the book',rotateHelp:'Drag or use arrow keys to rotate the cover. Home resets the angle; Enter opens the book.',rotateHint:'Hold and drag to see the book from every angle',playing:'Introduction playing',complete:'Castle page',chapters:[
  {id:'endpapers',label:'Black endpapers',left:'black',right:'black'},
  {id:'first-leaf',label:'First white leaf',left:'black',right:'white'},
  {id:'title-page',leftLeaves:6,label:'Peiry Tale',left:'white',right:'white',heading:'peiry tale',subtitle:'Shape everyday life into what you love',lines:['Shape everyday life','into what you love']},
  {id:'prologue',leftLeaves:7,label:'Prologue',left:'white',right:'white',eyebrow:'I / prologue',heading:'Everyday life deserves a fairytale, too.',lines:['Everyday life deserves','a fairytale, too.']},
  {id:'castle',leftLeaves:8,label:'Castle page',left:'white',right:'white'}]}
};

export const pageTypography={
 family:'Georgia, "Noto Serif CJK TC", "Noto Serif TC", "Songti TC", serif',weight:400,
 label:{desktop:42,mobile:69},heading:{desktop:68,mobile:98},englishHeading:{desktop:67,mobile:90},
 layout:{x:530,labelY:554,headingY:690,lineHeight:80,maxWidth:820,labelColor:'#8c806c',headingColor:'#635c50'}
};
export const pageTextRows=page=>({label:page.eyebrow||page.heading||'',text:page.subtitle||page.heading||'',lines:page.lines||[page.subtitle||page.heading||'']});
export const pageStackAmount=page=>(page.leftLeaves||0)/40;

// Existing shared links resolve to the renamed canonical castle chapter.
export const chapterIndex=(lang,hash)=>copy[lang].chapters.findIndex(page=>page.id===(hash.replace(/^#/, '')==='blank'?'castle':hash.replace(/^#/, '')));
