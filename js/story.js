// ============================================================
// ストーリー（田野さんの Figma の画面を、そのまま順番に ならべたもの）
//   ここを書きかえれば、プログラムを さわらずに お話を変えられます。
//   （ ）の番号は Figma の フレーム名「iPad Pro 11" - ○○」です。
//
// ■ 使える命令（かならず 前に await を つける）
//   await say('話す人', 'セリフ', { face: '顔' })
//       話す人が '' なら 名前なし。改行は \n
//       顔：'hero'（主人公）, 'heroSleepy'（ねむそうな主人公）, 'captive'（つかまった人）, 'monster'（バケモノ）
//       { box: 'bottom' } で 会話ウィンドウを 画面の下に出す
//   const c = await choose(['えらぶ1', 'えらぶ2'])      … えらんだ 文字が かえってくる
//   await wait(ミリ秒)                                   … 1000 = 1秒
//   await fadeOut('black' か 'white'), await fadeIn()    … 暗転 / 白く光る
//   await blink()                                        … まばたき して 目をさます（動画の かわり）
//   show('watch') / hide('watch')                        … 時計（主人公の 右うえ）
//   show('exclaim') / hide('exclaim')                    … 「！」マーク
//   monster('full' / 'alone' / 'none')                   … バケモノの 絵（つかまった人ごと / バケモノだけ / なし）
//   await monsterWalk(-1300, 1600)                       … バケモノが 横に うごく（距離, ミリ秒）
//   await camera(マップのy, ミリ秒) / follow()           … カメラを うごかす / 主人公を おいかける に もどす
//   await walkTo(マップのy, ミリ秒)                      … 主人公を 自動で あるかせる
//   resetPlayer()                                        … 主人公を スタート位置に もどす
//   note('メモ')                                         … 画面の右下に 演出メモを 出す（未デザインの所など）
//   end('さいごに 出す文')                               … 「つづく」画面へ
//   flags.なまえ = true                                  … 状態を おぼえる（例：flags.loop）
// ============================================================

const STORY = {
  // ---------- マップ（Figma の 90 を つかっています） ----------
  map: {
    image: 'assets/map.png',
    width: 1194,
    height: 3336,
    floorLeft: 255,   // あるける はんい（左の かべ）
    floorRight: 948,  // あるける はんい（右の かべ）
    floorBottom: 3214,
    // とおれない かべ（まんなかの 入口 と 上の部屋の 入口）
    walls: [
      { x1: 255, x2: 545, y1: 1238, y2: 1424 },
      { x1: 667, x2: 948, y1: 1238, y2: 1424 },
      { x1: 255, x2: 545, y1: 30, y2: 245 },
      { x1: 667, x2: 948, y1: 30, y2: 245 },
    ],
  },
  playerStart: { x: 603, y: 3192 },  // 足もとの 位置
  walkSpeed: 330,                     // あるく速さ
  monsterPos: { x: 590, y: 640 },     // バケモノの 足もと

  // ---------- オートモード（タイトルの「オートで みる」） ----------
  autoSpeed: 4,       // オートの速さ（1 = ふつう、4 = 4ばい速）

  //   えらぶ 選択肢
  //   上から 順番に つかう。なくなったら いちばん左の 選択肢を えらぶ。
  autoChoices: [
    'この場に残る', 'この場に残る', '助けに行く',
    '止めない', '止める',
    'CDプレイヤー',
  ],

  // ---------- さいしょ（タイトルの「スタート」を おしたあと） ----------
  opening: async () => {
    flags.loop = 1;
    await fadeOut('black', 0);
    await wait(600);
    await say('???', 'また眠ってしまったのか…？', { box: 'bottom' });           // (8)
    note('ここは「主人公の一人称の動画」が入る予定（9）');
    await blink();                                                          // (9) の かわり
    await say('主人公', 'まだ目が覚めきらないが、\nとにかくここを出なくては。', { face: 'heroSleepy' }); // (Frame 3)
    await wait(500);
    show('exclaim');
    await say('???', 'おい!誰かいるのか？\n助けてくれー!!');                   // (50)
    hide('exclaim');
    await say('主人公', '…。', { face: 'hero' });                             // (51)

    // 「この場に残る」を えらぶと、また きかれる
    let stay = 0;
    while (true) {
      const options = stay >= 2 ? ['助けに行く'] : ['助けに行く', 'この場に残る'];
      const c = await choose(options);                                      // (52)(78)(80)(82)
      if (c === '助けに行く') break;
      stay++;
      if (stay === 1) await say('主人公', '……………。', { face: 'hero' });   // (79)
      else await say('???', '助けてってばー!!!!!!!!');                      // (81)
    }
    // ここから 自由に あるける
  },

  // ---------- マップの上で おきること ----------
  //   y : 主人公の 足もとが ここより 上に きたら おきる
  triggers: [
    {
      id: 'watch',
      y: 3080,
      if: () => flags.loop === 1,
      run: async () => {
        await say('', 'ピピピピッ…ピピピピッ…');                          // (53)
        await say('主人公', 'なんだ？', { face: 'hero' });                  // (54)
        show('watch');
        await say('主人公', '時計…？\nこんなもの持ってたか？', { face: 'hero' }); // (55)
        await say('', 'ピッ。');                                            // (56)
        await say('主人公', '止まった。\n一体なんだったんだ？', { face: 'hero' }); // (57)
        hide('watch');
      },
    },
    {
      id: 'encounter1',
      y: 1080,
      if: () => flags.loop === 1,
      run: async () => {
        await camera(140, 900);
        await say('???', 'やっと助けが来たのか…!', { face: 'captive' });       // (59)
        await say('主人公', 'な、なんだこのバケモノは・・・!', { face: 'hero' }); // (60)
        await wait(700);                                                    // (61)
        monster('alone');                                                   // (62)(63) 食べられてしまう
        await wait(900);
        await say('バケモノ', '……………。', { face: 'monster' });             // (64)
        await monsterWalk(-1300, 3600);                                     // (65)〜(68)
        monster('none');
        await walkTo(900, 700);                                             // (69)
        await say('主人公', 'え…？ 死んだ…？\n何が起きたんだ？', { face: 'hero' }); // (72)
        show('watch');
        await say('', 'ピピピピッピピピピッ…');                              // (73)
        await say('主人公', 'また？', { face: 'hero' });                    // (74)
        while ((await choose(['止める', '止めない'])) === '止めない') {      // (75)
          note('「止めない」の先は まだ デザインがありません（仮）');
          await say('', 'ピピピピッピピピピッ…');
        }
        await say('', 'ピッ。');                                            // (76)
        hide('watch');

        // ---- 時が もどる ----
        await fadeOut('white', 500);                                        // (83)
        await say('主人公', '!?', { face: 'hero' });                        // (84)
        flags.loop = 2;
        monster('full');
        resetPlayer();
        follow();
        await fadeIn(600);
        await say('主人公', '…?', { face: 'hero' });                        // (85)
        show('exclaim');
        await say('???', 'おい!誰かいるのか?\n助けてくれー!!');               // (86)
        hide('exclaim');
        await say('主人公', 'な、なんだ?', { face: 'hero' });                // (87)
        await say('主人公', 'さっきと同じ声が聞こえる…。', { face: 'hero' }); // (88)
        await say('主人公', '急いでみよう。', { face: 'hero' });             // (89)
      },
    },
    {
      id: 'encounter2',
      y: 1080,
      if: () => flags.loop === 2,
      run: async () => {
        await camera(140, 900);
        await say('主人公', 'やっぱり同じ人だ。', { face: 'hero' });          // (91)
        await say('主人公', 'さっきより早く着けたのか?', { face: 'hero' });   // (92)
        await say('主人公', 'まだ食われていない…。', { face: 'hero' });      // (93)
        await say('???', 'こいつをやっつけてくれ…!', { face: 'captive' });    // (94)
        await say('主人公', 'やっつける!?', { face: 'hero' });              // (95)
        await say('主人公', 'こんなこと初めてだ…。\nどうすればいいんだ?', { face: 'hero' }); // (96)
        const item = await choose(['カセットテープ', 'CDプレイヤー', 'ヘッドホンの\nコード'],
          { speaker: '主人公の荷物' });                                       // (97)
        end(`えらんだ荷物：${item.replace('\n', '')}\n\nここから先は まだ デザインがありません。`);
      },
    },
  ],
};
