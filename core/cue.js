/* core/cue.js —— 提示：这句话在讲什么
   ---------------------------------------------------------------
   这一段新加的东西。场本身有二十七处景，但景是「这一卷长什么样」，
   跟当下这一句并没有关系。所以走到哪儿都是同一幅底。

   这一件补的就是那件事：每落一句话，先从这句话里把「它在讲什么」
   读出来，交给场。场据此把对应的那一层推上去、把别的压下去。
   于是讲「环」的时候环形显出来，讲「缝」的时候那道缝自己走到近前。

   读法很土，也很牢：一张表，十四个条目，每条几个字眼，
   落在这一句里就算一票，票多的那条胜。
   没有随机数，也没有模型——同一句话永远给同一个提示。
   这就是「背景与文字对上」的全部机制，一点花巧都没有。 */
window.UA = window.UA || {};
(function (UA) {
  'use strict';

  /* 十四个提示。字眼挑的是有画面的那类，
     像「看」「走」「面」这种哪儿都有的，一概不收——
     收进来它们会把每一句都判成同一个提示。 */
  var TABLE = [
    { id: 'ring', words: ['环', '圈', '绕', '圆心'] },
    { id: 'line', words: ['线', '沿', '横', '水平'] },
    { id: 'beam', words: ['轴', '竖', '光柱'] },
    { id: 'tower', words: ['塔', '柱', '楼', '墙'] },
    { id: 'fall', words: ['雨', '落', '坠', '掉'] },
    { id: 'crack', words: ['缝', '裂', '岔', '断'] },
    { id: 'gaze', words: ['眼', '盯', '望', '目光'] },
    { id: 'grid', words: ['格', '点', '网', '阵'] },
    { id: 'void', words: ['空', '散', '灭', '虚'] },
    { id: 'flood', words: ['水', '潮', '漫', '淹'] },
    { id: 'glyph', words: ['名', '字', '写', '刻'] },
    { id: 'path', words: ['路', '步', '径'] },
    { id: 'band', words: ['带', '幕', '一层层'] },
    { id: 'count', words: ['数', '量', '算'] }
  ];

  /* 六个声音各有一个默认提示：什么都没读出来的时候，按说话的人来定。
     场说话时默认「格」，摩尔纹默认「环」——这两样本来就是它们的样子。
     残响偏「梁」（立着的那一道），计量者偏「数」（量化的那一支）。 */
  var BY_VOICE = { n: '', y: 'gaze', m: 'ring', sys: 'grid', h: 'beam', g: 'count' };

  var LAST = { id: '', k: 0, at: 0 };

  /* 读一句：给回 { id, k }。k 是这条提示有多确定，0..1 */
  function read(text, voice) {
    var s = String(text || '');
    /* 空句子照样有话说：按说话的人给默认。 */
    if (!s) {
      var d = BY_VOICE[voice] || '';
      return { id: d, k: d ? .34 : 0 };
    }
    var best = '', bestN = 0, i, j, n;
    for (i = 0; i < TABLE.length; i++) {
      n = 0;
      for (j = 0; j < TABLE[i].words.length; j++) {
        if (s.indexOf(TABLE[i].words[j]) >= 0) n++;
      }
      if (n > bestN) { bestN = n; best = TABLE[i].id; }
    }
    if (!best) {
      best = BY_VOICE[voice] || '';
      bestN = best ? 1 : 0;
    }
    var k = Math.min(1, bestN / 3);
    return { id: best, k: k };
  }

  UA.cue = {
    TABLE: TABLE, BY_VOICE: BY_VOICE,
    read: read,
    ids: function () { return TABLE.map(function (t) { return t.id; }); },
    get last() { return LAST; },
    /* 给测试用：把一句读一遍并记下最后一次的结果 */
    probe: function (text, voice) {
      var r = read(text, voice);
      LAST = { id: r.id, k: r.k, at: Date.now() };
      return r;
    }
  };
})(window.UA);
