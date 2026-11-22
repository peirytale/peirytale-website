// All coordinates refer to the owner's 1445 × 1088 drawing, not product sizes.
// Geometry, visual slots, navigation and bilingual editorial copy stay separate.
export const room={sourceSize:[1445,1088],crop:[42,42,1360,952],size:[960,672],
 assets:['workshop-source.webp','workshop-room.webp'],transition:{hold:.28,turn:1.25,reveal:1.65},
 floor:[[90,804],[437,690],[768,712],[1070,774],[1352,847],[1352,972],[373,972]],
 obstacles:[[[436,690],[685,682],[756,722],[722,772],[474,784]],[[768,686],[1100,724],[1070,774],[768,735]],[[1068,752],[1373,799],[1352,847],[1068,800]]],
 entry:[722,928],cell:16,
 surfaces:[
  {id:'left-wall',points:[[30,25,-330],[680,25,-330],[680,715,-120],[30,820,-120]]},
  {id:'right-wall',points:[[680,25,-330],[1385,25,-330],[1385,835,-120],[680,715,-120]]},
  {id:'floor',points:[[90,804,-120],[437,690,-120],[768,712,-120],[1070,774,-120],[1352,847,-120],[1352,976,320],[373,976,320]]},
  {id:'table-top',points:[[431,489,-25],[670,514,-25],[766,551,70],[683,609,70],[446,548,70]]},
  {id:'shelf-back',points:[[796,258,-48],[1083,277,-48],[1083,656,-48],[796,619,-48]]},
  {id:'shelf-top',points:[[785,363,30],[1086,394,30],[1086,418,65],[785,389,65]]},
  {id:'shelf-middle',points:[[785,492,30],[1086,522,30],[1086,544,65],[785,515,65]]},
  {id:'shelf-lower',points:[[785,613,30],[1086,644,30],[1086,665,65],[785,635,65]]},
  {id:'shelf-case',points:[[768,225,12],[797,239,12],[797,671,12],[1084,710,12],[1084,264,12],[1116,278,12],[1116,750,12],[770,703,12]]},
  {id:'fabric-bin',points:[[1068,686,175],[1372,727,175],[1372,798,175],[1345,836,240],[1068,777,240]]},
 ],
};
const item=(id,kind,zh,en,polygon,approach,depth=100,extra={})=>({id,kind,label:{'zh-TW':zh,en},polygon,approach,depth,thickness:kind==='book'?8:kind==='fabric'?12:kind==='machine'?23:3,visual:{asset:'workshop-source.webp',mapping:'source-projection'},...extra});
export const objects=[
 item('dress-teacups','dress','茶杯圖案洋裝','Teacup dress',[[164,394],[185,394],[204,405],[232,418],[252,447],[253,469],[239,487],[220,487],[220,511],[242,561],[284,657],[291,687],[278,705],[237,715],[167,720],[103,706],[72,692],[77,667],[103,580],[130,514],[136,490],[112,491],[95,479],[92,453],[107,424],[136,411]], [320,777],110),
 item('dress-floral','dress','花卉圖案洋裝','Floral dress',[[247,373],[268,379],[288,383],[307,369],[325,373],[348,394],[360,420],[351,441],[331,449],[328,473],[341,506],[362,558],[391,625],[392,647],[371,667],[322,681],[282,677],[281,647],[258,594],[235,544],[220,512],[215,493],[229,487],[247,472],[250,450],[232,439],[219,414],[222,393]], [382,755],103),
 item('dress-patchwork','dress','拼布圖案洋裝','Patchwork dress',[[336,356],[349,350],[367,385],[384,392],[402,385],[407,348],[417,350],[422,386],[425,419],[417,454],[432,481],[449,530],[476,597],[471,613],[428,627],[393,628],[380,602],[355,540],[339,492],[334,468],[342,435],[344,409]], [425,741],96),
 item('sewing-machine','machine','裁縫機','Sewing machine',[[512,460],[517,444],[531,434],[576,435],[611,439],[625,444],[625,431],[627,423],[645,423],[650,430],[646,446],[648,449],[665,461],[678,482],[681,540],[667,553],[525,534],[518,522],[543,518],[548,499],[550,484],[526,482],[515,475]], [712,802],120),
 item('book-cakes','book','點心圖案書本','Cake-pattern book',[[809,259],[880,269],[879,378],[801,367]], [760,802],63),
 item('book-patchwork','book','拼布圖案書本','Patchwork book',[[897,264],[980,278],[974,385],[887,378]], [799,807],65),
 item('book-garden','book','花園圖案書本','Garden book',[[992,276],[1079,287],[1070,396],[982,386]], [853,821],67),
 item('book-blue-stripe','book','藍色條紋書本','Blue striped book',[[799,407],[823,394],[824,487],[800,491]], [776,811],65),
 item('book-peach','book','蜜桃色書本','Peach book',[[825,408],[850,398],[848,494],[824,491]], [795,815],67),
 item('book-rose-stripe','book','玫瑰條紋書本','Rose striped book',[[852,411],[879,400],[876,497],[850,495]], [816,818],69),
 item('book-strawberry','book','草莓圖案書本','Strawberry book',[[881,413],[907,406],[903,500],[878,498]], [837,823],71),
 item('book-flowers','book','小花圖案書本','Small-flower book',[[909,416],[937,411],[934,504],[905,502]], [859,827],73),
 item('book-violet','book','紫色花卉書本','Violet floral book',[[940,420],[966,414],[964,507],[937,505]], [881,833],75),
 item('book-sky','book','天空藍書本','Sky-blue book',[[969,423],[994,417],[995,510],[967,508]], [904,837],77),
 item('book-lilac','book','丁香紫書本','Lilac book',[[797,533],[825,516],[824,613],[797,610]], [780,813],75),
 item('book-daisy','book','雛菊圖案書本','Daisy book',[[826,535],[850,520],[848,615],[825,614]], [801,818],77),
 item('book-pink-stripe','book','粉紅條紋書本','Pink striped book',[[853,539],[878,525],[876,619],[850,617]], [823,822],79),
 item('book-red','book','紅色花卉書本','Red floral book',[[880,542],[906,529],[904,622],[878,619]], [845,827],81),
 item('book-raspberry','book','覆盆莓色書本','Raspberry book',[[908,545],[936,532],[931,625],[906,623]], [866,831],83),
 item('book-check','book','粉紅格紋書本','Pink checked book',[[938,546],[962,535],[958,628],[934,626]], [888,836],85),
 item('book-horizontal-pink','book','平放的粉紅書本','Lying pink book',[[976,573],[1086,586],[1084,611],[970,598],[966,587]], [938,848],88),
 item('book-horizontal-floral','book','平放的花卉書本','Lying floral book',[[968,599],[1084,612],[1080,642],[965,626],[961,614]], [956,854],87),
 // Trace the visible roll/cap silhouettes, excluding the wall between caps
 // and the fixed wooden lip. These contours also bound source erasure.
 item('fabric-strawberry','fabric','草莓圖案布捲','Strawberry fabric roll',[[1138,468],[1142,464],[1157,462],[1158,453],[1161,448],[1170,446],[1182,449],[1191,453],[1193,457],[1191,466],[1189,472],[1197,472],[1200,476],[1198,487],[1153,707],[1100,695],[1134,485]], [1048,843],125,{axis:[1127,700]}),
 item('fabric-cats','fabric','貓咪圖案布捲','Cat-pattern fabric roll',[[1200,477],[1206,474],[1212,474],[1213,462],[1216,457],[1227,457],[1240,461],[1247,465],[1248,469],[1245,482],[1256,482],[1258,486],[1212,721],[1154,708],[1198,486]], [1135,868],128,{axis:[1183,714]}),
 item('fabric-navy','fabric','深藍花卉布捲','Navy floral fabric roll',[[1258,488],[1264,483],[1269,483],[1271,469],[1274,465],[1285,465],[1298,469],[1303,473],[1304,478],[1301,489],[1309,490],[1311,494],[1268,733],[1213,721],[1256,496]], [1220,886],131,{axis:[1241,727]}),
 item('fabric-rose','fabric','玫瑰花卉布捲','Rose floral fabric roll',[[1310,493],[1316,488],[1325,488],[1326,478],[1330,474],[1340,474],[1353,478],[1358,482],[1357,488],[1355,495],[1366,496],[1368,500],[1337,725],[1309,741],[1269,733]], [1296,913],134,{axis:[1299,738]}),
];
export const workshopCopy={
 'zh-TW':{title:'城堡裡的工坊',description:'手繪工坊裡，三件洋裝掛在左側；窗邊是裁縫機，藍色書架與四捲布在右側。點選物件，她會跑到物件前方。',ready:'光退去，城堡裡的工坊出現在書頁上。',entering:'她從書頁下方跑進工坊。',actorReady:'她在工坊下方停下了。',guide:'工坊裡的角色',floor:'在地板上移動角色',floorHelp:'點選地板即可跑過去；聚焦此按鈕後，可用方向鍵移動，Home、Page Up、End、Page Down 斜向移動。',floorMoving:'她正跑向那裡。',floorArrived:'她到了。',moving:'正跑向：',arrived:'已到達：',choose:'探索工坊物件',selected:'已選取：',close:'收起物件說明',return:'回到城堡',loading:'正在準備工坊…',error:'工坊尚未載入完成。',retry:'重新載入工坊',hint:'可點選洋裝、裁縫機、書本與布捲',kind:{dress:'洋裝',machine:'裁縫機',book:'書本',fabric:'布捲'},detail:{dress:'輕輕展開，看看手繪的花紋。',machine:'窗邊的裁縫機，等候下一個故事。',book:'從書架取出一點靈感。',fabric:'輕轉布捲，看看不同的花色。'}},
 en:{title:'The castle workshop',description:'Three dresses hang at the left of the hand-drawn workshop. A sewing machine sits by the window; a blue bookcase and four fabric rolls stand at the right. Select an object and she will run over to it.',ready:'The light clears, revealing the castle workshop on the pages.',entering:'She runs into the workshop from the bottom of the pages.',actorReady:'She stops near the bottom of the workshop.',guide:'The workshop guide',floor:'Run across the workshop floor',floorHelp:'Click the floor to run there. When this button has focus, use arrow keys; Home, Page Up, End and Page Down move diagonally.',floorMoving:'She runs over there.',floorArrived:'She has arrived.',moving:'Running to: ',arrived:'Arrived at: ',choose:'Explore workshop objects',selected:'Selected: ',close:'Close object description',return:'Return to castle',loading:'Preparing the workshop…',error:'The workshop could not finish loading.',retry:'Try loading the workshop again',hint:'Explore the dresses, sewing machine, books and fabric',kind:{dress:'Dress',machine:'Sewing machine',book:'Book',fabric:'Fabric roll'},detail:{dress:'A gentle sway reveals the hand-drawn pattern.',machine:'The sewing machine by the window awaits the next story.',book:'A little inspiration from the bookshelf.',fabric:'Turn the roll gently to explore its pattern.'}},
};
export const toPage=([x,y])=>[(x-room.crop[0])/room.crop[2]*room.size[0],(y-room.crop[1])/room.crop[3]*room.size[1]];
