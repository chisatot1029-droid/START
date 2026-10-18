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
//   show('ring') / hide('ring')                          … 時計が 鳴って はねる（watch と いっしょに つかう）
//   show('exclaim') / hide('exclaim')                    … 「！」マーク
//   monster('full' / 'eat' / 'alone' / 'apart' / 'down' / 'captive' / 'none')
//       … バケモノと 人物Aの 絵（つかまえている / 食べている / バケモノだけ /
//         はなれて 立つ / バケモノが たおれている / 人物Aだけ / なし）
//   await monsterWalk(-1300, 1600)                       … バケモノが 横に うごく（距離, ミリ秒）
//   await captiveWalk(0, -700, 1800)                     … 人物Aが うごく（よこ, たて, ミリ秒）
//   police('police' / 'kaitou' / 'none')                 … 警察（仮：青い人）/ 変装を といた 怪盗（仮：黄色い人）/ なし
//   await policeWalk(0, 700, 1800)                       … 警察が うごく（よこ, たて, ミリ秒）。さいしょは 画面の 上の 外
//   await throwItem()                                    … 主人公が 荷物を バケモノに 投げる
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

  // ---------- オートモード（タイトルの「オートで みる」） ----------
  autoSpeed: 4,       // オートの速さ（1 = ふつう、4 = 4ばい速）

  //   えらぶ 選択肢
  //   上から 順番に つかう。なくなったら いちばん左の 選択肢を えらぶ。
  autoChoices: [
    'この場に残る', 'この場に残る', '助けに行く',
    'ヘッドホンのコード',
    '3つ隣の街で…。', '逃げる',
    '愛想笑いをする',
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
        // 1回目の 時計（シナリオ通り）
        show('watch');
        show('ring');
        await say('', 'ピピピピピピッ…。');
        await say('主人公', 'なんだ？\n時計なんて持っていたか？', { face: 'hero' });
        await walkTo(2960, 1400);                                           // ゆっくり 歩き出すと
        hide('ring');                                                       // アラームが 鳴り、止まる
        await say('', 'ピッ…。');
        await say('主人公', '勝手に止まった。\n一体何だったんだ。', { face: 'hero' });
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
        monster('eat');                                                     // 食べられてしまう
        await wait(900);
        monster('alone');
        await wait(500);
        await say('バケモノ', '……………。', { face: 'monster' });             // (64)
        await monsterWalk(-1300, 3600);                                     // (65)〜(68)
        monster('none');
        await walkTo(900, 700);                                             // (69)
        await say('主人公', 'え…？ 死んだ…？\n何が起きたんだ？', { face: 'hero' }); // (72)
        // 2回目の 時計（シナリオ通り。呆然とする 主人公）
        await wait(600);
        show('watch');
        show('ring');
        await say('', 'ピピピピッ。');
        await say('主人公', 'こんな時にまたかよ。', { face: 'hero' });
        await wait(400);
        hide('ring');                                                       // 自ら 止める
        await wait(500);
        hide('watch');

        // ---- 時が もどる（目の前が 光に 包まれる） ----
        await fadeOut('white', 500);                                        // (83)
        await say('主人公', 'ッ！', { face: 'hero' });
        flags.loop = 2;
        monster('apart');                                                   // 2周目は まだ つかまっていない
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
        const item = await choose(['カセットテープ', 'ヘッドホンの\nコード', 'リュック\nサック'],
          { speaker: '主人公の荷物' });                                       // (44)

        // ---- ここから 導入シナリオ（Word「シナリオ_スタート」）。まだ 絵が ない所は note で 仮 ----
        await say('主人公', 'これを使うの…か…？', { face: 'hero' });          // （動揺した表情）
        await say('主人公', 'えいっ！', { face: 'hero' });                   // (45)
        await throwItem();                                                  // (47) 投げる
        monster('down');                                                    // (49) たおれる
        await wait(900);
        monster('apart');                                                   // (51) おきあがる
        await wait(500);
        await monsterWalk(600, 1500);                                       // (53)(55)(57) 右へ にげる
        monster('captive');
        await say('???', '少年！ありがとう！', { face: 'captive' });
        await say('???', '助けてもらったところ申し訳ないが、\n急いでるんだ！', { face: 'captive' });
        await say('???', 'またいつか会えたら\n必ずお礼をするよ！', { face: 'captive' });
        await say('???', 'ほんとありがとう！', { face: 'captive' });
        await captiveWalk(53, -750, 2000);                                  // 人物Aが 去る：これから 行く 道（画面の 上）へ
        monster('none');
        await say('主人公', 'あぁ…。', { face: 'hero' });
        await say('主人公', 'というか、どうなっているんだ？\n同じことが2回起きている…。', { face: 'hero' });

        // ---- 警察 ----
        show('exclaim');                                                    // 奥の方から ドタバタと 足音
        police('police');                                                   // 警察（仮：青い人）が 画面の 上から 来る
        await policeWalk(0, 710, 1800);
        hide('exclaim');
        await say('警察', 'おいそこの君！ここらへんで\n事件が起きたと聞いたが、');
        await say('警察', '何か見なかったか！？');
        await say('主人公', 'ここを出なくては…。\n今ここで面倒なことにはなりたくない。', { face: 'hero' });
        await say('主人公', '事件…。知らないです。', { face: 'hero' });     // 目を 合わせずに
        await say('警察', 'そうか。最近物騒になってきたから\n気をつけろよ。');
        await say('警察', '…君、お家は？');
        await say('主人公', '僕の家は…。', { face: 'hero' });
        await say('主人公', 'まずい、すぐ答えなかったら\n不審がられる。', { face: 'hero' });
        await say('主人公', 'えーと。', { face: 'hero' });
        const answer = await choose(['すぐそこです。', '3つ隣の街で…。', '…。']); // どれでも 怪しまれる
        await say('主人公', answer, { face: 'hero' });
        await say('警察', 'どういうことだ？\n君、少しだけ話を聞いても良いかな？');
        const act = await choose(['戦う', '逃げる', '巻き戻す']);
        note(`「${act}」の 演出は まだ ありません（仮）`);
        await wait(1000);
        note('警察が 拳銃を つきつけ、主人公が 身構える（仮）');
        await wait(1200);
        await fadeOut('white', 80);                                         // 発砲
        await fadeIn(400);
        await say('警察', 'パンッ！');
        note('銃から 銃弾ではなく 花束が 出てくる（仮）');
        await say('主人公', 'っ！…？', { face: 'hero' });
        await say('警察', '…。おいおい、\nなんか言ってくれよ〜。');
        await say('主人公', 'え？', { face: 'hero' });
        await say('警察', 'さっきは助けてくれてありがとうな！');
        await say('主人公', '誰だ…？', { face: 'hero' });
        note('警察が 服を脱いで、さっきの 人物Aだと わかる（仮）');
        for (let i = 0; i < 4; i++) {                                       // 青 → 黄色 に チカチカ 変わる
          police('kaitou'); await wait(150);
          police('police'); await wait(150);
        }
        police('kaitou');                                                   // 怪盗（仮：黄色い人）
        await wait(700);

        // ---- 怪盗 ----
        await say('主人公', 'さっきの！', { face: 'hero' });
        await say('怪盗', 'やっとわかってくれたか！');
        await say('主人公', '…？どう言うことだ？\nなんで襲われていたのに、', { face: 'hero' });
        await say('主人公', '警察に変装して僕を撃とうと…？', { face: 'hero' });
        await say('怪盗', 'やれやれ。君は頭の回転が早いねぇ。');
        await say('怪盗', '君はこの世界に初めて来たんだろう？\n心細いだろうと思って、');
        await say('怪盗', '君を楽しませるために\n色々と用意したんだ！');
        await say('怪盗', 'パーティ会場も用意しているし、\nいろんな人とも出会えるだろう。');
        await say('怪盗', '僕がこんなことをしている本当の\n答え合わせは、最後のお楽しみだ。');
        await say('怪盗', '君、時計を持っているだろう？');
        show('watch');
        await say('主人公', 'あぁ、これ。\nこんなもの持っていなかったのに。', { face: 'hero' });
        await say('怪盗', 'ふふふ。このアラームが鳴った時に\n自分で止めると、巻き戻せるんだ。');
        await say('怪盗', '本当は時間なんて巻き戻せないが、\n人生をやり直せるんだよ。');
        await say('怪盗', '面白いだろう！？');
        hide('watch');
        note('怪盗が 笑顔で 主人公の手を取り 走りだす（仮）');
        await wait(1200);
        await fadeOut('black', 800);
        police('none');

        // ---- 怪盗の家の前（暗い通路を抜け、星空のもとに ポツンと たたずむ家） ----
        note('怪盗の家の前（星空と家）の 絵は まだ ありません（仮）');
        await wait(800);
        await say('怪盗', 'こんなに走ったのは久々だ！');
        await say('怪盗', 'これからの出来事、\nどうか楽しんでくれ！');
        await say('主人公', '僕はこの世界から出たいんだよ…。', { face: 'hero' });
        const feel = await choose(['素直に伝える', '愛想笑いをする']);
        if (feel === '素直に伝える') {
          await say('主人公', '楽しませようとしているのは\n嬉しいが、助けて欲しいんだ。', { face: 'hero' });
          await say('怪盗', '驚いた…！\n君は無口な子だと思っていたが、');
          await say('怪盗', '素直に伝えられるんだね。\nいいことだ。');
          await say('怪盗', '人は見た目ではわからないね。');
        } else {
          await say('主人公', 'あぁ。楽しみだ…。', { face: 'hero' });
          await say('怪盗', '…。');
          await say('怪盗', '…何か言いたいんじゃないか？\nきっと僕に合わせてくれたんだろう。');
          await say('怪盗', '素敵な優しさだが、\n自分を殺してはいけないよ。');
          await say('主人公', '殺す？', { face: 'hero' });
          await say('怪盗', '比喩表現さ。\n自分の意見や感情を押さえ込んで、');
          await say('怪盗', '他人を優先すること。\n他人を思う優しさでもあるが、');
          await say('怪盗', '次第に自分が\nわからなくなるかもしれない。');
          await say('怪盗', '僕の前では\n自分を殺さなくていいさ。');
          await say('主人公', 'わかった。…ここから出たい。', { face: 'hero' });
          await say('怪盗', '出たいのか。');
        }
        // ここで ①と② が 合流
        await say('怪盗', 'この世界から抜け出すには、\n扉を開ける鍵「星」を集めるんだ。');
        await say('怪盗', 'きっとこれから出会う人たちが\n星を持っているよ。');
        await say('主人公', '星を集める…。', { face: 'hero' });
        await say('怪盗', 'この家の中に、\n星を持っている子が一人いたはず。');
        await say('怪盗', '話してみるといい。');
        note('怪盗が ゆっくり ドアを開ける（仮）');
        await wait(1000);
        await say('怪盗', 'さぁ入って。');
        note('怪盗が 先に 家に入り、主人公も あとを追って 入る（仮）');
        await wait(1500);
        end('導入 おわり\n\nここから先は まだ シナリオがありません。');
      },
    },
  ],
};
